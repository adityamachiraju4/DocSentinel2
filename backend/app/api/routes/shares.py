# ─────────────────────────────────────────
# DocSentinel v2 — Sharing Routes
# PhRedSec™ | api/routes/shares.py
# v1: identity-based shares. Login + email match. View-only. No token links.
# ─────────────────────────────────────────
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.document_share import (
    DocumentShare,
    PERMISSION_VIEW,
    PERMISSIONS_V1,
    STATUS_ACTIVE,
)
from app.services import audit_service

router = APIRouter(prefix="/documents", tags=["shares"])

DEFAULT_EXPIRY_DAYS = 30
MAX_EXPIRY_DAYS = 365


class ShareCreate(BaseModel):
    recipient_email: EmailStr
    permission: str = PERMISSION_VIEW
    expires_in_days: int | None = DEFAULT_EXPIRY_DAYS  # None = never


def _serialize(s: DocumentShare) -> dict:
    return {
        "id": s.id,
        "document_id": s.document_id,
        "recipient_email": s.recipient_email,
        "permission": s.permission,
        "status": s.status,
        "expires_at": s.expires_at.isoformat() if s.expires_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.post("/{document_id}/shares")
def create_share(
    document_id: int,
    payload: ShareCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Owner-only: same ownership filter as every other document route.
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Hard block: sensitive documents are not shareable in v1.
    if doc.effective_sensitive:
        raise HTTPException(
            status_code=400,
            detail="Sharing is disabled for sensitive documents.",
        )

    # v1 accepts VIEW only; other permissions are reserved for later.
    permission = (payload.permission or PERMISSION_VIEW).upper()
    if permission not in PERMISSIONS_V1:
        raise HTTPException(
            status_code=400,
            detail="Only VIEW sharing is supported in this version.",
        )

    # Normalize recipient email.
    email = payload.recipient_email.strip().lower()

    # No self-share.
    if email == (current_user.email or "").strip().lower():
        raise HTTPException(
            status_code=400,
            detail="You cannot share a document with yourself.",
        )

    # Expiry: bounded; None means never.
    expires_at = None
    if payload.expires_in_days is not None:
        days = payload.expires_in_days
        if days < 1 or days > MAX_EXPIRY_DAYS:
            raise HTTPException(
                status_code=400,
                detail=f"Expiry must be between 1 and {MAX_EXPIRY_DAYS} days, or null for never.",
            )
        expires_at = datetime.now(timezone.utc) + timedelta(days=days)

    # Idempotency: reuse an existing active, non-expired share for (doc, email).
    now = datetime.now(timezone.utc)
    existing = (
        db.query(DocumentShare)
        .filter(
            DocumentShare.document_id == document_id,
            DocumentShare.recipient_email == email,
            DocumentShare.status == STATUS_ACTIVE,
        )
        .first()
    )
    if existing:
        exp = existing.expires_at
        if exp is not None and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp is None or exp > now:
            return _serialize(existing)

    share = DocumentShare(
        document_id=document_id,
        owner_id=current_user.id,
        recipient_email=email,
        permission=permission,
        status=STATUS_ACTIVE,
        expires_at=expires_at,
    )
    db.add(share)
    db.commit()
    db.refresh(share)

    audit_service.log_event(
        db, current_user.id, audit_service.DOCUMENT_SHARE_CREATED,
        document_id=document_id, request=request,
    )

    return _serialize(share)
