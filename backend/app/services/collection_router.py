# ─────────────────────────────────────────
# DocSentinel v2 — Collection Router
# PhRedSec™ | services/collection_router.py
#
# Maps a document's document_type → one or more system collections,
# then writes document_collections links. Gmail-style labels: a single
# document can land in multiple collections (e.g. purchase_order).
#
# Only the CURRENT extractor enum is supported. module is intentionally
# NOT used for routing — it stays as metadata for future workflows.
# ─────────────────────────────────────────
from sqlalchemy.orm import Session
from app.models.collection import Collection, DocumentCollection

# document_type (lowercased) → list of collection slugs
_TYPE_TO_SLUGS = {
    "invoice":         ["invoices"],
    "receipt":         ["receipts"],
    "bill":            ["receipts"],
    "credit_note":     ["receipts"],
    "debit_note":      ["receipts"],
    "contract":        ["contracts"],
    "payslip":         ["hr"],
    "bank_statement":  ["banking"],
    "tax_return":      ["tax"],
    "gst_return":      ["tax"],
    "purchase_order":  ["invoices", "receipts"],
    "other":           ["other"],
}

# Anything not in the map (e.g. "unknown" from a failed extraction) → Other
_FALLBACK_SLUGS = ["other"]


def route_document_to_collections(db: Session, document_id: int, document_type: str | None, source: str = "AI") -> list[str]:
    """
    Assign a document to its collections based on document_type.
    Idempotent per (document_id, collection_id) thanks to the unique
    constraint — re-routing won't create duplicate links.
    Returns the list of slugs the document was assigned to.
    """
    dtype = (document_type or "").lower().strip()
    slugs = _TYPE_TO_SLUGS.get(dtype, _FALLBACK_SLUGS)

    # Resolve slugs → collection ids in one query
    collections = db.query(Collection).filter(Collection.slug.in_(slugs)).all()
    slug_to_id = {c.slug: c.id for c in collections}

    # Existing links for this doc, to avoid duplicate inserts
    existing = {
        link.collection_id
        for link in db.query(DocumentCollection.collection_id)
        .filter(DocumentCollection.document_id == document_id).all()
    }

    assigned = []
    for slug in slugs:
        cid = slug_to_id.get(slug)
        if cid is None:
            continue  # collection missing (shouldn't happen post-seed)
        if cid in existing:
            assigned.append(slug)
            continue
        db.add(DocumentCollection(
            document_id=document_id,
            collection_id=cid,
            source=source,
        ))
        assigned.append(slug)

    db.commit()
    return assigned
