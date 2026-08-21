# ─────────────────────────────────────────
# DocSentinel v2 — Folder Model
# PhRedSec™ | models/folder.py
# ─────────────────────────────────────────
#
# User-owned organizational folder (Phase 4a — household Drive foundation).
#
# This is the user's OWN organization axis ("my Taxes folder"), distinct from
# the global `collections` table which is automatic document-type taxonomy
# ("this is an invoice"). The two coexist as orthogonal axes — a document can
# be an invoice (collection) AND live in Taxes (folder).
#
# v1 scope (locked in docs/phase4-private-vault-design-v2.md):
#   - FLAT: parent_folder_id exists as a nullable column so nesting can be
#     added later without a migration, but v1 enforces a single level in the
#     service layer. Do not build recursive folder queries yet.
#   - vault_type is NOT on this model yet — it arrives in Phase 4b. Phase 4a
#     is folders only, no crypto, so the ownership-isolation guarantee can be
#     proven on a plain container before encryption is layered on.

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    name = Column(String, nullable=False)

    # Nesting door left open (nullable); v1 enforces flat in the service layer.
    parent_folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    # Vault discriminator (Phase 4b). "smart" (default) = server-searchable,
    # AI extraction runs. "private" = zero-knowledge; uploads structurally
    # bypass Groq and plaintext storage. Column-only here; the branch that
    # enforces the bypass lives in the upload route + is proven by
    # tests/test_private_no_extract.py.
    vault_type = Column(String, nullable=False, server_default="smart")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="folders")
