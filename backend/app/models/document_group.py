# ─────────────────────────────────────────
# DocSentinel v2 — Document Group Model
# PhRedSec™ | models/document_group.py
# Version History: a group is the logical document; each
# documents row in the group is an immutable version.
# ─────────────────────────────────────────
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class DocumentGroup(Base):
    __tablename__ = "document_groups"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    display_name = Column(String, nullable=True)
    # Monotonic version allocator: incremented on each promote, so version
    # assignment never needs MAX(version_number) and is race-safe under a
    # row lock. Seeded to 1 when the group is created (anchor becomes v1).
    current_version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
