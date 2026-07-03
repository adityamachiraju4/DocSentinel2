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
