# ─────────────────────────────────────────
# DocSentinel v2 — DocumentShare Model
# PhRedSec™ | models/document_share.py
# Invite-based sharing (v1): logged-in recipient, email-matched, view-only.
# Some columns are dormant forward-compat (share_token_hash, allow_download)
# and are NOT wired to any access path in v1.
# ─────────────────────────────────────────
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

# Permission vocabulary. v1 accepts VIEW only; others are reserved.
PERMISSION_VIEW = "VIEW"
PERMISSION_COMMENT = "COMMENT"
PERMISSION_DOWNLOAD = "DOWNLOAD"
PERMISSION_EDIT_METADATA = "EDIT_METADATA"
PERMISSIONS = {PERMISSION_VIEW, PERMISSION_COMMENT, PERMISSION_DOWNLOAD, PERMISSION_EDIT_METADATA}
PERMISSIONS_V1 = {PERMISSION_VIEW}

# Share status values.
STATUS_ACTIVE = "active"
STATUS_REVOKED = "revoked"
STATUS_EXPIRED = "expired"


class DocumentShare(Base):
    __tablename__ = "document_shares"

    id = Column(Integer, primary_key=True, index=True)

    document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Recipient anchored on email; recipient_id backfilled on first access.
    recipient_email = Column(String, nullable=False, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    permission = Column(String, nullable=False, default=PERMISSION_VIEW)
    # Dormant in v1: no download path is wired. Forward-compat only.
    allow_download = Column(Boolean, nullable=False, default=False)

    status = Column(String, nullable=False, default=STATUS_ACTIVE, index=True)

    # Dormant in v1: token-link access is NOT a v1 path. Stored hashed if ever used.
    share_token_hash = Column(String, nullable=True, index=True)

    expires_at = Column(DateTime(timezone=True), nullable=True)
    first_accessed_at = Column(DateTime(timezone=True), nullable=True)
    last_accessed_at = Column(DateTime(timezone=True), nullable=True)
    # Hashed only (SHA-256), never raw IP — DPDP-aligned. Populated when recipient read path exists.
    last_access_ip_hash = Column(String, nullable=True)
    access_count = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoked_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    document = relationship("Document")
