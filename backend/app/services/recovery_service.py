# ─────────────────────────────────────────
# DocSentinel v2 — Recovery Code Service
# PhRedSec™ | services/recovery_service.py
# ─────────────────────────────────────────
import secrets
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.models.recovery_code import RecoveryCode

# bcrypt, same scheme as login passwords (bcrypt==4.0.1 pinned for py3.12)
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

CODE_COUNT = 6
_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # no ambiguous chars (0/o/1/l/i)

def _make_code() -> str:
    # format: xxxx-xxxx (lowercase, hyphenated for readability)
    raw = "".join(secrets.choice(_ALPHABET) for _ in range(8))
    return f"{raw[:4]}-{raw[4:]}"

def _normalize(code: str) -> str:
    return code.strip().lower().replace(" ", "")

def generate_codes(db: Session, user_id: int) -> list[str]:
    """Delete any existing codes for the user, mint a fresh set, store hashes.
    Returns the PLAINTEXT codes — shown to the user exactly once."""
    db.query(RecoveryCode).filter(RecoveryCode.user_id == user_id).delete()
    plaintext = [_make_code() for _ in range(CODE_COUNT)]
    for code in plaintext:
        db.add(RecoveryCode(user_id=user_id, code_hash=_pwd.hash(_normalize(code))))
    db.commit()
    return plaintext

def verify_and_consume(db: Session, user_id: int, code: str) -> bool:
    """Check a submitted code against the user's unused codes.
    On match: mark that code used (single-use) and return True."""
    candidate = _normalize(code)
    if not candidate:
        return False
    rows = db.query(RecoveryCode).filter(
        RecoveryCode.user_id == user_id,
        RecoveryCode.used == False,  # noqa: E712
    ).all()
    for row in rows:
        if _pwd.verify(candidate, row.code_hash):
            row.used = True
            db.commit()
            return True
    return False

def remaining_count(db: Session, user_id: int) -> int:
    return db.query(RecoveryCode).filter(
        RecoveryCode.user_id == user_id,
        RecoveryCode.used == False,  # noqa: E712
    ).count()
