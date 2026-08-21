# ─────────────────────────────────────────
# DocSentinel v2 — Folders Routes
# PhRedSec™ | api/routes/folders.py
# ─────────────────────────────────────────
#
# Phase 4a — user-owned folders (household Drive organization).
#
# PRIMARY GUARANTEE: ownership isolation. Every route is scoped to the
# authenticated user. Anything not owned returns 404 (never 403) — no
# existence disclosure, consistent with the sharing/redaction access paths.
#
# v1 scope (locked in docs/phase4-private-vault-design-v2.md):
#   - FLAT: parent_folder_id is ignored on create (always NULL in v1). The
#     column exists so nesting can be added later without a migration.
#   - Delete semantics: deleting a folder UNFILES its documents
#     (folder_id -> NULL); documents are never trashed or destroyed by a
#     folder delete. Organization != content.
#   - NO vault_type / crypto here. That is Phase 4b.

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.folder import Folder
from app.services.document_query import exclude_trashed
from pydantic import BaseModel, constr

router = APIRouter(prefix="/folders", tags=["folders"])


# ── payloads ──
class FolderCreate(BaseModel):
    name: constr(strip_whitespace=True, min_length=1, max_length=120)


class FolderRename(BaseModel):
    name: constr(strip_whitespace=True, min_length=1, max_length=120)


class MoveToFolder(BaseModel):
    # None = unfile (move document back to root / unfiled).
    folder_id: int | None = None


# ── helpers ──
def _owned_folder_or_404(folder_id: int, db: Session, user: User) -> Folder:
    """Fetch a folder by id scoped to the owner, or 404. The ownership
    filter is in the query itself — a non-owner and a nonexistent id are
    indistinguishable to the caller (no existence disclosure)."""
    folder = (
        db.query(Folder)
        .filter(Folder.id == folder_id, Folder.user_id == user.id)
        .first()
    )
    if folder is None:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder


def _serialize(folder: Folder, doc_count: int) -> dict:
    return {
        "id": folder.id,
        "name": folder.name,
        "created_at": folder.created_at.isoformat() if folder.created_at else None,
        "document_count": doc_count,
    }


# ── routes ──
@router.post("/")
def create_folder(
    payload: FolderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a folder owned by the current user. Flat in v1 (no parent)."""
    folder = Folder(user_id=current_user.id, name=payload.name)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return _serialize(folder, 0)


@router.get("/")
def list_folders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the current user's own folders, each with a live (non-trashed)
    document count. Only this user's folders are ever returned."""
    folders = (
        db.query(Folder)
        .filter(Folder.user_id == current_user.id)
        .order_by(Folder.created_at.desc())
        .all()
    )

    # Per-folder live document counts, scoped to this user.
    counts_raw = exclude_trashed(
        db.query(Document.folder_id, func.count(Document.id))
        .filter(Document.user_id == current_user.id, Document.folder_id.isnot(None))
    ).group_by(Document.folder_id).all()
    counts = {fid: n for fid, n in counts_raw}

    return [_serialize(f, counts.get(f.id, 0)) for f in folders]


@router.get("/{folder_id}")
def get_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One folder + its live documents. 404 if not owned or nonexistent."""
    folder = _owned_folder_or_404(folder_id, db, current_user)

    docs = exclude_trashed(
        db.query(Document)
        .filter(
            Document.user_id == current_user.id,
            Document.folder_id == folder.id,
        )
    ).order_by(Document.created_at.desc()).all()

    out = _serialize(folder, len(docs))
    out["documents"] = [
        {
            "id": d.id,
            "original_filename": d.original_filename,
            "document_type": d.document_type,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]
    return out


@router.patch("/{folder_id}")
def rename_folder(
    folder_id: int,
    payload: FolderRename,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rename an owned folder. 404 if not owned."""
    folder = _owned_folder_or_404(folder_id, db, current_user)
    folder.name = payload.name
    db.commit()
    db.refresh(folder)
    return _serialize(folder, 0)


@router.delete("/{folder_id}")
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an owned folder. Its documents are UNFILED (folder_id -> NULL),
    never trashed or destroyed. 404 if not owned.

    Isolation note: the unfile UPDATE is itself scoped by user_id as well as
    folder_id, so it can never touch another user's rows even in the
    theoretical case of a shared folder_id."""
    folder = _owned_folder_or_404(folder_id, db, current_user)

    unfiled = (
        db.query(Document)
        .filter(Document.user_id == current_user.id, Document.folder_id == folder.id)
        .update({Document.folder_id: None}, synchronize_session=False)
    )
    db.delete(folder)
    db.commit()
    return {"deleted": True, "folder_id": folder_id, "documents_unfiled": unfiled}


@router.patch("/documents/{document_id}")
def move_document(
    document_id: int,
    payload: MoveToFolder,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Move a document into a folder, or out to unfiled (folder_id=None).
    BOTH the document and the target folder must be owned by the user.
    404 on either not owned — no existence disclosure of either side."""
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    if payload.folder_id is not None:
        # Validate target folder ownership before assigning.
        _owned_folder_or_404(payload.folder_id, db, current_user)

    doc.folder_id = payload.folder_id
    db.commit()
    return {
        "document_id": document_id,
        "folder_id": payload.folder_id,
        "unfiled": payload.folder_id is None,
    }
