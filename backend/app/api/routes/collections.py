# ─────────────────────────────────────────
# DocSentinel v2 — Collections Routes
# PhRedSec™ | api/routes/collections.py
# ─────────────────────────────────────────
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.collection import Collection, DocumentCollection

router = APIRouter(prefix="/collections", tags=["collections"])


@router.get("/")
def list_collections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all system collections with a per-user document count.
    Count only reflects the current user's documents.
    """
    collections = db.query(Collection).order_by(Collection.id).all()

    # Per-user counts: join links -> documents, filter by user, group by collection
    counts_raw = (
        db.query(DocumentCollection.collection_id, func.count(DocumentCollection.id))
        .join(Document, Document.id == DocumentCollection.document_id)
        .filter(Document.user_id == current_user.id)
        .group_by(DocumentCollection.collection_id)
        .all()
    )
    counts = {cid: n for cid, n in counts_raw}

    return [
        {
            "id": c.id,
            "name": c.name,
            "slug": c.slug,
            "icon": c.icon,
            "description": c.description,
            "count": counts.get(c.id, 0),
        }
        for c in collections
    ]


@router.get("/{slug}/documents")
def collection_documents(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the current user's documents in a given collection.
    """
    collection = db.query(Collection).filter(Collection.slug == slug).first()
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found.")

    docs = (
        db.query(Document)
        .join(DocumentCollection, DocumentCollection.document_id == Document.id)
        .filter(
            DocumentCollection.collection_id == collection.id,
            Document.user_id == current_user.id,
        )
        .order_by(Document.created_at.desc())
        .all()
    )

    return {
        "collection": {"name": collection.name, "slug": collection.slug, "icon": collection.icon},
        "documents": [
            {
                "id": d.id,
                "filename": d.original_filename,
                "document_type": d.document_type,
                "mime_type": d.mime_type,
                "vendor_name": d.vendor_name,
                "total_amount": d.total_amount,
                "invoice_date": d.invoice_date,
                "processing_status": d.processing_status,
                "created_at": d.created_at,
                "effective_sensitive": d.effective_sensitive,
                "is_encrypted": bool(d.r2_key),
            }
            for d in docs
        ],
    }
