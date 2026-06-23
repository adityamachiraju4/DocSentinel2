# ─────────────────────────────────────────
# DocSentinel v2 — Collection Models
# PhRedSec™ | models/collection.py
#
# Smart Collections: Gmail-style labels, not physical folders.
# A document can belong to many collections (many-to-many).
# `source` on the join records WHO placed the doc there (AI / USER / SYSTEM)
# so user corrections become training signal later.
# ─────────────────────────────────────────
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, backref
from app.core.database import Base


class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    icon = Column(String, nullable=True)          # lucide icon name (monochrome)
    system_created = Column(Boolean, default=True)  # True for seeded system collections
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    document_links = relationship(
        "DocumentCollection",
        back_populates="collection",
        cascade="all, delete-orphan",
    )


class DocumentCollection(Base):
    __tablename__ = "document_collections"
    __table_args__ = (
        UniqueConstraint("document_id", "collection_id", name="uq_document_collection"),
    )

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False, index=True)
    source = Column(String, nullable=False, default="AI")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    collection = relationship("Collection", back_populates="document_links")
    document = relationship(
        "Document",
        backref=backref("collection_links", cascade="all, delete-orphan", passive_deletes=True),
    )
