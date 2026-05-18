# ─────────────────────────────────────────
# DocSentinel v2 — Subscription Model
# PhRedSec™ | models/subscription.py
# ─────────────────────────────────────────

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Plan details
    plan = Column(String, nullable=False, default="free")
    status = Column(String, nullable=False, default="active")

    # Razorpay
    razorpay_subscription_id = Column(String, nullable=True)
    razorpay_plan_id = Column(String, nullable=True)
    razorpay_customer_id = Column(String, nullable=True)

    # Limits
    documents_limit = Column(Integer, default=25)
    documents_used = Column(Integer, default=0)

    # Billing cycle
    current_period_start = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)

    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="subscription")