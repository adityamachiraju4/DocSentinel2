# ─────────────────────────────────────────
# DocSentinel v2 — Documents Routes
# PhRedSec™ | api/routes/documents.py
# ─────────────────────────────────────────

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.document import Document
from app.services.storage_service import save_file
from app.services.document_processor import classify_and_extract

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

    storage_key = save_file(file_bytes, file.filename)

    extracted = classify_and_extract(file_bytes, file.filename, file.content_type)

    doc = Document(
        user_id=current_user.id,
        filename=storage_key,
        original_filename=file.filename,
        file_size=len(file_bytes),
        mime_type=file.content_type,
        r2_key=storage_key,
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
        processing_status="completed",
    )
    db.add(doc)

    current_user.documents_used += 1

    db.commit()
    db.refresh(doc)

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
