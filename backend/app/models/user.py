# ─────────────────────────────────────────
# DocSentinel v2 — User Model
# PhRedSec™ | models/user.py
# ─────────────────────────────────────────

from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    gstin = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    plan = Column(String, default="free")
    documents_used = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # ── 2FA / TOTP ──
    totp_secret = Column(String, nullable=True)                    # base32 secret, set at enrollment start
    totp_enabled = Column(Boolean, default=False, nullable=False)  # True only after first code verified
    # ── Private Vault (Phase 4b) ──
    # Per-user Argon2id salt for vault key derivation. NULL until the
    # user initializes a private vault. Salt only — never the key.
    vault_kdf_salt = Column(String, nullable=True)

    documents = relationship("Document", back_populates="user")
    folders = relationship("Folder", back_populates="user")
    subscription = relationship("Subscription", back_populates="user", uselist=False)
