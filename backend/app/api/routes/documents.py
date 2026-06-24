# ─────────────────────────────────────────
# DocSentinel v2 — Documents Routes
# PhRedSec™ | api/routes/documents.py
# ─────────────────────────────────────────

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, Header, Request
from app.core.auth import verify_sensitive_grant
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.document import Document
from app.services.storage_service import save_file, get_file
from app.services.sensitive_detector import detect_sensitive
from app.services.document_processor import classify_and_extract
from app.services.collection_router import route_document_to_collections
from app.services import audit_service
from app.models.audit_event import AuditEvent

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
    "text/plain",
]

MAX_FILE_SIZE = 10 * 1024 * 1024


@router.post("/upload")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="File type not allowed. Allowed: PDF, JPG, PNG, TXT."
        )

    file_bytes = await file.read()

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 10MB."
        )

    import hashlib
    sha256_hash = hashlib.sha256(file_bytes).hexdigest()
    storage_key = save_file(file_bytes, file.filename)

    extracted = classify_and_extract(file_bytes, file.filename, file.content_type)

    doc = Document(
        user_id=current_user.id,
        filename=storage_key,
        original_filename=file.filename,
        file_size=len(file_bytes),
        mime_type=file.content_type,
        r2_key=storage_key,
        sha256=sha256_hash,
        document_type=extracted.get("document_type"),
        module=extracted.get("module"),
        vendor_name=extracted.get("vendor_name"),
        invoice_number=extracted.get("invoice_number"),
        invoice_date=extracted.get("invoice_date"),
        total_amount=extracted.get("total_amount"),
        gstin=extracted.get("gstin"),
        hsn_codes=extracted.get("hsn_codes"),
        tax_amount=extracted.get("tax_amount"),
        extraction_method=extracted.get("extraction_method"),
        is_sensitive=detect_sensitive(extracted.get("raw_text")),
        processing_status="completed",
    )
    db.add(doc)

    current_user.documents_used += 1

    db.commit()
    db.refresh(doc)
    route_document_to_collections(db, doc.id, doc.document_type, source="AI")
    audit_service.log_event(db, current_user.id, audit_service.DOCUMENT_UPLOAD, document_id=doc.id, request=request)

    return {
        "message": "Document uploaded and processed successfully.",
        "document": {
            "id": doc.id,
            "filename": doc.original_filename,
            "document_type": doc.document_type,
            "vendor_name": doc.vendor_name,
            "total_amount": doc.total_amount,
            "invoice_date": doc.invoice_date,
            "processing_status": doc.processing_status,
            "created_at": doc.created_at,
        }
    }

@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import func as sqlfunc
    from datetime import datetime, timezone

    # 1. All documents belonging to this user
    all_docs = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .all()
    )

    # 2. Total documents uploaded
    total_documents = len(all_docs)

    # 3. Total amount across all documents
    #    We sum total_amount, skipping None values with 'or 0'
    total_amount = sum(d.total_amount or 0 for d in all_docs)

    # 4. Documents uploaded this calendar month
    now = datetime.now(timezone.utc)
    docs_this_month = sum(
        1 for d in all_docs
        if d.created_at and
           d.created_at.year == now.year and
           d.created_at.month == now.month
    )

    # 5. Storage used — sum of file_size in bytes, converted to KB
    storage_bytes = sum(d.file_size or 0 for d in all_docs)
    storage_kb = round(storage_bytes / 1024, 1)

    # 6. Documents uploaded per month (for the bar chart)
    #    Build a dict like {"Jan 2025": 3, "Feb 2025": 1, ...}
    monthly: dict = {}
    for d in all_docs:
        if d.created_at:
            key = d.created_at.strftime("%b %Y")   # e.g. "May 2026"
            monthly[key] = monthly.get(key, 0) + 1
    # Sort chronologically
    monthly_data = [
        {"month": k, "count": v}
        for k, v in sorted(monthly.items(),
                            key=lambda x: datetime.strptime(x[0], "%b %Y"))
    ]

    # 7. Amount spent per vendor (for the vendor bar chart)
    #    Group by vendor_name, sum amounts
    vendor: dict = {}
    for d in all_docs:
        if d.vendor_name and d.total_amount:
            vendor[d.vendor_name] = vendor.get(d.vendor_name, 0) + d.total_amount
    vendor_data = [
        {"vendor": k, "amount": round(v, 2)}
        for k, v in sorted(vendor.items(), key=lambda x: x[1], reverse=True)
    ]

    # 8. Document type breakdown (for the pie chart)
    type_counts: dict = {}
    for d in all_docs:
        t = d.document_type or "unknown"
        type_counts[t] = type_counts.get(t, 0) + 1
    type_data = [
        {"type": k, "count": v}
        for k, v in type_counts.items()
    ]

    # 9. Last 5 documents for the recent docs table
    recent = sorted(all_docs, key=lambda d: d.created_at or datetime.min, reverse=True)[:5]
    recent_data = [
        {
            "id": d.id,
            "filename": d.original_filename,
            "document_type": d.document_type,
            "vendor_name": d.vendor_name,
            "total_amount": d.total_amount,
            "invoice_date": d.invoice_date,
            "processing_status": d.processing_status,
            "created_at": d.created_at,
        }
        for d in recent
    ]

    return {
        "total_documents": total_documents,
        "total_amount": round(total_amount, 2),
        "docs_this_month": docs_this_month,
        "storage_kb": storage_kb,
        "monthly_data": monthly_data,
        "vendor_data": vendor_data,
        "type_data": type_data,
        "recent_documents": recent_data,
    }

@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    audit_service.log_event(db, current_user.id, audit_service.DELETE, document_id=doc.id, request=request)
    db.delete(doc)
    current_user.documents_used = max(0, current_user.documents_used - 1)
    db.commit()
    return {"message": "Document deleted successfully."}


@router.patch("/{document_id}/sensitive")
def set_sensitive_override(
    document_id: int,
    sensitive: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    doc.sensitive_override = sensitive
    db.commit()
    db.refresh(doc)
    return {
        "id": doc.id,
        "is_sensitive": doc.is_sensitive,
        "sensitive_override": doc.sensitive_override,
        "effective_sensitive": doc.effective_sensitive,
        "sha256": doc.sha256,
    }


@router.get("/")
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )

    return {
        "documents": [
            {
                "id": d.id,
                "filename": d.original_filename,
                "document_type": d.document_type,
                "vendor_name": d.vendor_name,
                "total_amount": d.total_amount,
                "invoice_date": d.invoice_date,
                "processing_status": d.processing_status,
                "created_at": d.created_at,
            }
            for d in docs
        ]
    }


@router.get("/{document_id}/file")
def get_document_file(
    document_id: int,
    request: Request,
    download: bool = False,
    x_sensitive_grant: str = Header(default=""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Decrypt the document from R2 and return the original bytes.
    Inline by default (browser preview); attachment if download=true.
    """
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    if doc.effective_sensitive and not verify_sensitive_grant(x_sensitive_grant, current_user.id):
        raise HTTPException(
            status_code=403,
            detail="sensitive_reauth_required",
        )
    if not doc.r2_key:
        raise HTTPException(status_code=404, detail="No file stored for this document.")

    try:
        file_bytes = get_file(doc.r2_key)
    except Exception as e:
        # Old documents created before R2 storage may have no object.
        if "NoSuchKey" in type(e).__name__ or "NoSuchKey" in str(e):
            raise HTTPException(status_code=404, detail="File not found in storage.")
        raise HTTPException(status_code=500, detail="Could not retrieve file.")

    media_type = doc.mime_type or "application/octet-stream"
    disposition = "attachment" if download else "inline"
    # RFC 5987 filename to handle spaces/unicode safely
    from urllib.parse import quote
    safe_name = quote(doc.original_filename or "document")
    headers = {
        "Content-Disposition": f"{disposition}; filename*=UTF-8''{safe_name}",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Pragma": "no-cache",
        "Expires": "0",
    }
    audit_service.log_event(
        db, current_user.id,
        audit_service.DOCUMENT_DOWNLOAD if download else audit_service.DOCUMENT_VIEW,
        document_id=doc.id, request=request,
    )
    return Response(content=file_bytes, media_type=media_type, headers=headers)


@router.get("/{document_id}/audit")
def get_document_audit(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return this document's audit timeline, newest first."""
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    events = (
        db.query(AuditEvent)
        .filter(AuditEvent.document_id == document_id, AuditEvent.user_id == current_user.id)
        .order_by(AuditEvent.id.desc())
        .all()
    )
    return [
        {
            "id": e.id,
            "event_type": e.event_type,
            "device": e.device,
            "created_at": e.created_at,
        }
        for e in events
    ]
