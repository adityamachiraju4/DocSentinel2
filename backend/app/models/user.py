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

    documents = relationship("Document", back_populates="user")
    subscription = relationship("Subscription", back_populates="user", uselist=False)
