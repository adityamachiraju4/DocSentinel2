# ─────────────────────────────────────────
# DocSentinel v2 — Audit Service
# PhRedSec™ | services/audit_service.py
# ─────────────────────────────────────────
import hashlib
from sqlalchemy.orm import Session
from app.models.audit_event import AuditEvent

# Canonical event types
DOCUMENT_UPLOAD = "DOCUMENT_UPLOAD"
DOCUMENT_VIEW = "DOCUMENT_VIEW"
DOCUMENT_DOWNLOAD = "DOCUMENT_DOWNLOAD"
SENSITIVE_ACCESS = "SENSITIVE_ACCESS"
DELETE = "DELETE"
DOCUMENT_SHARE_CREATED = "DOCUMENT_SHARE_CREATED"
DOCUMENT_SHARE_OPENED = "DOCUMENT_SHARE_OPENED"
DOCUMENT_SHARE_REVOKED = "DOCUMENT_SHARE_REVOKED"
DOCUMENT_SHARE_EXPIRED = "DOCUMENT_SHARE_EXPIRED"
DOCUMENT_VERSION_CREATED = "DOCUMENT_VERSION_CREATED"
DOCUMENT_TRASHED = "DOCUMENT_TRASHED"
DOCUMENT_RESTORED = "DOCUMENT_RESTORED"
DOCUMENT_PURGED = "DOCUMENT_PURGED"


def _hash_ip(ip: str) -> str | None:
    if not ip:
        return None
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()


def _client_ip(request) -> str:
    if request is None:
        return ""
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else ""


def _device(request) -> str | None:
    if request is None:
        return None
    ua = request.headers.get("user-agent", "")
    return ua[:255] if ua else None


def log_event(db: Session, user_id: int, event_type: str,
              document_id: int | None = None, request=None) -> None:
    """Best-effort audit log. Never raises into the request path."""
    try:
        evt = AuditEvent(
            user_id=user_id,
            document_id=document_id,
            event_type=event_type,
            ip_hash=_hash_ip(_client_ip(request)),
            device=_device(request),
        )
        db.add(evt)
        db.commit()
    except Exception:
        db.rollback()
