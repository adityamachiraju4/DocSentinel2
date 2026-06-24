# ─────────────────────────────────────────
# DocSentinel v2 — Refresh Token Model
# PhRedSec™ | models/refresh_token.py
# ─────────────────────────────────────────
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String, unique=True, index=True, nullable=False)  # sha256 of raw token, never the token itself
    family_id = Column(String, index=True, nullable=False)                # ties rotated tokens together for reuse detection
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)              # kill switch: logout / 2FA disable / reuse
    device = Column(String, nullable=True)                               # User-Agent string, truncated
    ip_hash = Column(String, nullable=True)                              # sha256 of client IP, never raw (privacy/DPDP)
    last_used_at = Column(DateTime(timezone=True), nullable=True)        # bumped on each rotation
    created_at = Column(DateTime(timezone=True), server_default=func.now())
