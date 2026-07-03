# ─────────────────────────────────────────
# DocSentinel v2 — Document Model
# PhRedSec™ | models/document.py
# ─────────────────────────────────────────

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # File info
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String, nullable=True)
    r2_key = Column(String, nullable=True)
    sha256 = Column(String, nullable=True)

    # Classification
    document_type = Column(String, nullable=True)
    module = Column(String, nullable=True)

    # Extracted data
    extracted_text = Column(Text, nullable=True)
    vendor_name = Column(String, nullable=True)
    invoice_number = Column(String, nullable=True)
    invoice_date = Column(String, nullable=True)
    total_amount = Column(Float, nullable=True)
    gstin = Column(String, nullable=True)
    hsn_codes = Column(Text, nullable=True)
    tax_amount = Column(Float, nullable=True)

    # Status
    is_encrypted = Column(Boolean, default=True)
    processing_status = Column(String, default="pending")
    is_sensitive = Column(Boolean, default=False, nullable=False)
    sensitive_override = Column(Boolean, nullable=True)
    extraction_method = Column(String, nullable=True)
    confidence = Column(Text, nullable=True)  # JSON: deterministic confidence object
    # Verification Layer
    field_metadata = Column(Text, nullable=True)  # JSON: per-field {ai_value,current_value,confidence,verified,verified_by,verified_at,last_modified_at}
    # Summary (Sprint B feature 2) — JSON: {version, summary, key_points[]}; cached, on-demand
    summary = Column(Text, nullable=True)
    # Version History (Sprint C) — NULL until this doc is explicitly grouped.
    # group_id NULL = standalone doc (the common case). Within a group,
    # version_number is 1..N and exactly one row has is_latest True.
    # is_latest maintained in the promote/delete service layer (NOT a DB
    # trigger) for SQLite/Postgres parity.
    group_id = Column(Integer, ForeignKey("document_groups.id"), nullable=True)
    version_number = Column(Integer, nullable=True)
    is_latest = Column(Boolean, nullable=True)
    verification_status = Column(String, nullable=False, default="AI_EXTRACTED")  # AI_EXTRACTED | NEEDS_REVIEW | VERIFIED
    verified_fields_count = Column(Integer, nullable=False, default=0)
    total_verifiable_fields = Column(Integer, nullable=False, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="documents")

    @property
    def effective_sensitive(self) -> bool:
        if self.sensitive_override is not None:
            return self.sensitive_override
        return bool(self.is_sensitive)
