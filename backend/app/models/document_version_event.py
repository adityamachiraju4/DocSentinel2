# ─────────────────────────────────────────
# DocSentinel v2 — Document Version Event Model
# PhRedSec™ | models/document_version_event.py
# Immutable audit-style history: one row per version promotion.
# event_type is present from day one so this table can host future
# events (VERSION_RESTORED, VERSION_RENAMED, VERSION_MERGED) without
# a schema migration. Rows are never mutated after insert.
# ─────────────────────────────────────────
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class DocumentVersionEvent(Base):
    __tablename__ = "document_version_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False)
    group_id = Column(Integer, ForeignKey("document_groups.id"), nullable=False)
    from_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    to_document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    reason = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
