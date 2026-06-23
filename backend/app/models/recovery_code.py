# ─────────────────────────────────────────
# DocSentinel v2 — Recovery Code Model
# PhRedSec™ | models/recovery_code.py
# ─────────────────────────────────────────
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class RecoveryCode(Base):
    __tablename__ = "recovery_codes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    code_hash = Column(String, nullable=False)                # bcrypt hash of the raw code, never the code itself
    used = Column(Boolean, default=False, nullable=False)     # single-use: consumed on successful recovery login
    created_at = Column(DateTime(timezone=True), server_default=func.now())
