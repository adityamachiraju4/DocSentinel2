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
    extraction_method = Column(String, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="documents")
