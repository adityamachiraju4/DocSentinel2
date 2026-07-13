"""Reusable query scopes for Document version-awareness.

Model B (promote-after-upload): a document is either standalone
(group_id IS NULL) or a member of a version group, where exactly one
row per group carries is_latest = TRUE (maintained in the service
layer, not by a DB trigger).

These helpers are pure query transformers: they take a SQLAlchemy
Query and return a new Query. They never touch the session, never
execute, and impose no ordering. Callers keep full control of
filtering, ordering, and execution.
"""

from sqlalchemy import or_

from app.models.document import Document

# Trash retention window (days). Single source of truth for the
# 30-day recovery period; enforced on restore and shown in the trash list.
TRASH_RETENTION_DAYS = 30


def latest_only(q):
    """Restrict to the version-visible set.

    Keeps standalone docs (group_id IS NULL) and, within any group,
    only the row flagged is_latest. Superseded versions are excluded.
    """
    return q.filter(
        or_(Document.group_id.is_(None), Document.is_latest.is_(True))
    )


def include_versions(q):
    """Explicit no-op scope: return every row, superseded versions
    included. Exists so call sites can state version-intent by name
    rather than by the absence of a filter.
    """
    return q


def exclude_trashed(q):
    """Restrict to live documents: deleted_at IS NULL.

    Soft-delete scope (Sprint D). Wire into EVERY user-facing read path.
    A trashed row keeps its data, R2 object, group membership, and audit
    history until purge, but must never surface in normal reads. Pairs
    with only_trashed() for the trash view — the two together are the
    single source of truth for trash visibility; no call site should
    hand-roll a deleted_at filter.
    """
    return q.filter(Document.deleted_at.is_(None))


def only_trashed(q):
    """Inverse of exclude_trashed: restrict to trashed rows
    (deleted_at IS NOT NULL). Used only by the trash listing and by
    restore/purge lookups that must reach a trashed doc by id.
    """
    return q.filter(Document.deleted_at.isnot(None))
