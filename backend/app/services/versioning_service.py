# ─────────────────────────────────────────
# DocSentinel v2 — Versioning Service
# PhRedSec™ | services/versioning_service.py
#
# Version Attachment: attach a standalone document to a version lineage.
# The document's bytes/fields never change — only its lineage does.
#
# INVARIANT: version numbers are assigned when a document ENTERS a version
# group (promotion order), NEVER derived from upload timestamps. Promotion
# is the business event that defines version chronology.
#
# is_latest is maintained HERE (application layer), not by a DB trigger, so
# behaviour is identical on SQLite (dev) and Postgres (prod).
# ─────────────────────────────────────────
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.document_group import DocumentGroup


class PromotionError(Exception):
    """Carries the HTTP status the route should surface.
    404 = visibility/ownership · 400 = malformed · 409 = business conflict."""
    def __init__(self, status: int, detail: str):
        self.status = status
        self.detail = detail
        super().__init__(detail)


def _display_name(anchor: Document) -> str:
    """Presentation-only group label. Mutable later (rename group) without
    touching any document. Fallback chain prefers business identity over
    filename."""
    v = (anchor.vendor_name or "").strip()
    inv = (anchor.invoice_number or "").strip()
    if v and inv:
        return f"{v} · {inv}"
    if inv:
        return inv
    if v:
        return v
    if anchor.original_filename:
        return anchor.original_filename
    return f"Document {anchor.id}"


def promote_to_version(db: Session, user_id: int, new_doc_id: int,
                       anchor_document_id: int) -> dict:
    """Attach new_doc as the newest version in anchor's lineage.

    new_doc_id becomes the latest version regardless of upload time — the
    caller (UI) is the authority on which document is the next version.

    Raises PromotionError; caller maps .status to HTTPException.
    """
    if new_doc_id == anchor_document_id:
        raise PromotionError(400, "A document cannot be a version of itself.")

    new_doc = (
        db.query(Document)
        .filter(Document.id == new_doc_id, Document.user_id == user_id)
        .first()
    )
    if not new_doc:
        raise PromotionError(404, "Document not found.")

    anchor = (
        db.query(Document)
        .filter(Document.id == anchor_document_id, Document.user_id == user_id)
        .first()
    )
    if not anchor:
        raise PromotionError(404, "Document not found.")

    # new_doc must be standalone — promoting an already-versioned doc would
    # merge or rewrite lineage. Histories are immutable; never merge.
    if new_doc.group_id is not None:
        raise PromotionError(409, "Document is already part of a version group.")

    # Explicit cross-group guard (documents the invariant even though the
    # standalone check above already covers new_doc): we never merge two
    # existing lineages.
    if anchor.group_id is not None and new_doc.group_id is not None:
        raise PromotionError(409, "Cannot merge two existing version histories.")

    if anchor.group_id is None:
        # ── Case A: first promotion. Create the lineage. ──
        group = DocumentGroup(
            owner_id=user_id,
            display_name=_display_name(anchor),
            current_version=2,   # anchor=v1, new=v2
        )
        db.add(group)
        db.flush()               # assign group.id

        anchor.group_id = group.id
        anchor.version_number = 1
        anchor.is_latest = False

        new_doc.group_id = group.id
        new_doc.version_number = 2
        new_doc.is_latest = True
    else:
        # ── Case B: anchor already in a lineage. Append. ──
        group = (
            db.query(DocumentGroup)
            .filter(DocumentGroup.id == anchor.group_id,
                    DocumentGroup.owner_id == user_id)
            .with_for_update()   # row lock: race-safe version allocation
            .first()
        )
        if not group:
            raise PromotionError(404, "Version group not found.")

        group.current_version += 1
        next_version = group.current_version

        # Flip the current latest in this group to non-latest.
        prev_latest = (
            db.query(Document)
            .filter(Document.group_id == group.id, Document.is_latest.is_(True))
            .all()
        )
        for d in prev_latest:
            d.is_latest = False

        new_doc.group_id = group.id
        new_doc.version_number = next_version
        new_doc.is_latest = True

    db.commit()
    db.refresh(new_doc)
    db.refresh(group)

    return {
        "group_id": group.id,
        "display_name": group.display_name,
        "current_version": group.current_version,
        "promoted_document_id": new_doc.id,
        "version_number": new_doc.version_number,
        "is_latest": new_doc.is_latest,
    }
