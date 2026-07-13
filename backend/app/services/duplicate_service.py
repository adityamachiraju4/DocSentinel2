"""
Duplicate detection — runtime knowledge, never persisted.
L1 exact: SHA-256 byte equality.
L2 business: vendor_key (GSTIN-first) + invoice_number equality.
Per-user scope. Warn-and-allow: callers surface matches, never block.
"""
from sqlalchemy.orm import Session
from app.models.document import Document
from app.services.verification_rules import resolve_vendor_key
from app.services.document_query import exclude_trashed


def _doc_vendor_key(doc: Document) -> str | None:
    return resolve_vendor_key({"gstin": doc.gstin, "vendor_name": doc.vendor_name})


def find_duplicates(
    db: Session,
    *,
    user_id: int,
    sha256: str | None,
    incoming_vendor_key: str | None,
    invoice_number: str | None,
    exclude_document_id: int | None = None,
) -> list[dict]:
    """
    Returns match dicts, exact first. Pure read, nothing persisted.
    Each match: {type, document_id, filename, uploaded_at, reason, ...}
    """
    matches: list[dict] = []
    seen_ids: set[int] = set()

    q = exclude_trashed(db.query(Document).filter(Document.user_id == user_id))
    if exclude_document_id is not None:
        q = q.filter(Document.id != exclude_document_id)
    candidates = q.all()

    if sha256:
        for d in candidates:
            if d.sha256 and d.sha256 == sha256:
                matches.append({
                    "type": "exact",
                    "document_id": d.id,
                    "filename": d.original_filename,
                    "uploaded_at": d.created_at.isoformat() if d.created_at else None,
                    "reason": "Exact SHA-256 match",
                })
                seen_ids.add(d.id)

    if incoming_vendor_key and invoice_number and invoice_number.strip():
        inv = invoice_number.strip()
        for d in candidates:
            if d.id in seen_ids:
                continue
            if not d.invoice_number or d.invoice_number.strip() != inv:
                continue
            if _doc_vendor_key(d) != incoming_vendor_key:
                continue
            matches.append({
                "type": "business",
                "document_id": d.id,
                "filename": d.original_filename,
                "vendor_name": d.vendor_name,
                "invoice_number": d.invoice_number,
                "uploaded_at": d.created_at.isoformat() if d.created_at else None,
                "reason": "Vendor + invoice number match",
            })
            seen_ids.add(d.id)

    return matches
