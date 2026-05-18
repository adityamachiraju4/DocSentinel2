# ─────────────────────────────────────────
# DocSentinel v2 — Storage Service
# PhRedSec™ | services/storage_service.py
# ─────────────────────────────────────────

import uuid
from pathlib import Path

# The folder where uploaded files will be saved.
# On Railway this lives inside the container filesystem.
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


def save_file(file_bytes: bytes, original_filename: str) -> str:
    """
    Save raw file bytes to disk.
    Returns the storage_key (unique filename) — this is what we store in the DB.
    """
    # Generate a unique 8-char prefix so no two files ever clash
    unique_id = str(uuid.uuid4())[:8]

    # Grab the file extension e.g. ".pdf", ".png", ".jpg"
    extension = Path(original_filename).suffix

    # Final filename e.g. "a3f9c1d2-invoice.pdf"
    storage_key = f"{unique_id}-{original_filename}"

    # Write the bytes to disk
    file_path = UPLOAD_DIR / storage_key
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    return storage_key


def delete_file(storage_key: str) -> None:
    """
    Delete a file from disk by its storage key.
    """
    file_path = UPLOAD_DIR / storage_key
    if file_path.exists():
        file_path.unlink()