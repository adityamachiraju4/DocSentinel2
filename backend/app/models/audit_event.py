# ─────────────────────────────────────────
# DocSentinel v2 — Audit Event Model
# PhRedSec™ | models/audit_event.py
# ─────────────────────────────────────────
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from app.core.database import Base


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    event_type = Column(String, nullable=False)
    ip_hash = Column(String, nullable=True)
    device = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_audit_doc_created", "document_id", "created_at"),
    )
