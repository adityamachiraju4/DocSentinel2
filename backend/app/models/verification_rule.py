# ─────────────────────────────────────────
# DocSentinel v2 — Verification Rule Model
# PhRedSec™ | models/verification_rule.py
#
# Learning Engine: per-tenant, per-vendor, per-field correction knowledge.
# Stores ONLY correction knowledge — never document content.
# Identity: (user_id, vendor_key, field_name).
# rule_confidence is DERIVED from accept/reject counts at read time —
# never stored, never fabricated.
# ─────────────────────────────────────────
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class VerificationRule(Base):
    __tablename__ = "verification_rules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Rule identity
    vendor_key = Column(String, nullable=False)   # "gstin:<v>" | "name:<normalized>"
    field_name = Column(String, nullable=False)   # one of VERIFIABLE_FIELDS

    # Correction knowledge
    ai_value = Column(Text, nullable=True)         # what the AI extracted
    corrected_value = Column(Text, nullable=True)  # what the user verified
    ai_value_normalized = Column(Text, nullable=True)         # for rule matching; display uses ai_value
    corrected_value_normalized = Column(Text, nullable=True)  # reserved: dedup/conflict detection

    # Usage / trust signals (rule_confidence derived from these, not stored)
    usage_count = Column(Integer, nullable=False, default=0)
    accept_count = Column(Integer, nullable=False, default=0)
    reject_count = Column(Integer, nullable=False, default=0)

    # Provenance
    created_from_document_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("user_id", "vendor_key", "field_name", name="uq_verification_rule_identity"),
    )
