# ─────────────────────────────────────────
# DocSentinel v2 — Recipient (shared-with-me) Routes
# PhRedSec™ | api/routes/shared.py
# v1: login + email-match, then bound to recipient_id after first access.
# View-only (inline, no-store). Sensitive docs blocked continuously.
# This is the ONLY route that serves a document to a non-owner — every
# gate below is load-bearing. No owner user_id filter applies here.
# ─────────────────────────────────────────
import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.document_share import DocumentShare, STATUS_ACTIVE, STATUS_EXPIRED
from app.services.storage_service import get_file
from app.services import audit_service

router = APIRouter(prefix="/shared", tags=["shared"])

# 404 for every access failure: never reveal a share exists to a non-recipient.
_NOT_FOUND = HTTPException(status_code=404, detail="Not found.")


def _hash_ip(request: Request) -> str | None:
    fwd = request.headers.get("x-forwarded-for", "")
    ip = fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "")
    if not ip:
        return None
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()


def _aware(dt):
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _resolve_share(db: Session, share_id: int, user: User, now) -> DocumentShare:
    """Full recipient gate. Returns the share or raises 404 for any failure."""
    share = db.query(DocumentShare).filter(DocumentShare.id == share_id).first()
    if not share:
        raise _NOT_FOUND

    # Auto-expire if past expiry (audited once on transition).
    if share.status == STATUS_ACTIVE:
        exp = _aware(share.expires_at)
        if exp is not None and exp <= now:
            share.status = STATUS_EXPIRED
            db.commit()
            audit_service.log_event(
                db, share.owner_id, audit_service.DOCUMENT_SHARE_EXPIRED,
                document_id=share.document_id, request=None,
            )

    if share.status != STATUS_ACTIVE:
        raise _NOT_FOUND

    email = (user.email or "").strip().lower()

    # Binding: once recipient_id is set, ONLY that user id may access.
    if share.recipient_id is not None:
        if share.recipient_id != user.id:
            raise _NOT_FOUND
    else:
        # First access: email must match; then claim the share for this user id.
        if share.recipient_email != email:
            raise _NOT_FOUND

    return share


@router.get("")
def list_shared_with_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Documents shared with the logged-in user (active, matching identity)."""
    now = datetime.now(timezone.utc)
    email = (current_user.email or "").strip().lower()

    rows = (
        db.query(DocumentShare)
        .filter(
            DocumentShare.status == STATUS_ACTIVE,
            (
                (DocumentShare.recipient_id == current_user.id)
                | (
                    (DocumentShare.recipient_id.is_(None))
                    & (DocumentShare.recipient_email == email)
                )
            ),
        )
        .order_by(DocumentShare.created_at.desc())
        .all()
    )

    out = []
    for sh in rows:
        exp = _aware(sh.expires_at)
        if exp is not None and exp <= now:
            continue  # hide past-expiry; list endpoint won't mutate here
        doc = db.query(Document).filter(Document.id == sh.document_id).first()
        if not doc or doc.effective_sensitive:
            continue  # sensitive docs never appear in a recipient's list
        out.append({
            "share_id": sh.id,
            "document_id": sh.document_id,
            "filename": doc.original_filename,
            "permission": sh.permission,
            "shared_at": sh.created_at.isoformat() if sh.created_at else None,
            "expires_at": sh.expires_at.isoformat() if sh.expires_at else None,
        })
    return out


@router.get("/{share_id}/file")
def get_shared_file(
    share_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    share = _resolve_share(db, share_id, current_user, now)

    doc = db.query(Document).filter(Document.id == share.document_id).first()
    if not doc:
        raise _NOT_FOUND

    # Continuous sensitive re-check: owner may have flagged it after sharing.
    if doc.effective_sensitive:
        raise _NOT_FOUND

    if not doc.r2_key:
        raise _NOT_FOUND

    try:
        file_bytes = get_file(doc.r2_key)
    except Exception as e:
        if "NoSuchKey" in str(e) or "Not Found" in str(e):
            raise _NOT_FOUND
        raise HTTPException(status_code=500, detail="Could not retrieve file.")

    # Claim/track access.
    if share.recipient_id is None:
        share.recipient_id = current_user.id
        share.first_accessed_at = now
    share.last_accessed_at = now
    share.access_count = (share.access_count or 0) + 1
    share.last_access_ip_hash = _hash_ip(request)
    db.commit()

    audit_service.log_event(
        db, current_user.id, audit_service.DOCUMENT_SHARE_OPENED,
        document_id=doc.id, request=request,
    )

    return Response(
        content=file_bytes,
        media_type=doc.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "no-store",
        },
    )
