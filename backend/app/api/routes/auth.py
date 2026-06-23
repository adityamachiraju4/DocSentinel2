# ─────────────────────────────────────────
# DocSentinel v2 — Auth Routes
# PhRedSec™ | api/routes/auth.py
# ─────────────────────────────────────────

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_pending_token,
    decode_pending_token,
    get_current_user,
    generate_refresh_token,
    hash_refresh_token,
    new_family_id,
    refresh_token_expiry,
    create_sensitive_grant,
)
from app.core.config import get_settings
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.services.totp_service import generate_secret, qr_data_uri, verify_code
from app.services import recovery_service
from app.services import audit_service

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


# ── Schemas ───────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    name: str | None
    email: str
    plan: str

    class Config:
        from_attributes = True

class TotpCodeRequest(BaseModel):
    code: str

class LoginVerifyRequest(BaseModel):
    pending_token: str
    code: str | None = None            # TOTP code
    recovery_code: str | None = None   # OR a one-time recovery code

class SensitiveReauthRequest(BaseModel):
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str


# ── Helpers ───────────────────────────────

def _issue_refresh(db: Session, user: User, family_id: str | None = None) -> str:
    """
    Mint a new opaque refresh token, persist only its hash, and return the
    raw value to hand to the client. Reuses family_id during rotation so a
    chain of tokens can be revoked together on reuse detection.
    """
    raw = generate_refresh_token()
    row = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw),
        family_id=family_id or new_family_id(),
        expires_at=refresh_token_expiry(),
        revoked=False,
    )
    db.add(row)
    db.commit()
    return raw


def _issue_access(db: Session, user: User) -> dict:
    """Build the standard authenticated login response (access + refresh)."""
    token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh = _issue_refresh(db, user)
    return {
        "access_token": token,
        "refresh_token": refresh,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.full_name,
            "email": user.email,
            "plan": user.plan,
        },
    }


# ── Register ──────────────────────────────

@router.post("/register", status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    user = User(
        email=payload.email,
        full_name=payload.name,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": "Account created successfully. Please sign in."}


# ── Login (step 1: password) ──────────────

@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated.")

    # 2FA enabled → do not issue an access token yet. Return a short-lived
    # pending token the client must exchange at /login/verify with a code.
    if user.totp_enabled:
        return {
            "totp_required": True,
            "pending_token": create_pending_token(user.id),
        }

    # No 2FA → behave exactly as before.
    return _issue_access(db, user)


# ── Login (step 2: TOTP code) ─────────────

@router.post("/login/verify")
def login_verify(payload: LoginVerifyRequest, db: Session = Depends(get_db)):
    """
    Exchange a valid pending token + current TOTP code for a real access token.
    """
    user_id = decode_pending_token(payload.pending_token)
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid 2FA session.")
    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA is not enabled for this account.")

    # Accept either a TOTP code or a one-time recovery code.
    ok = False
    if payload.code and verify_code(user.totp_secret, payload.code):
        ok = True
    elif payload.recovery_code and recovery_service.verify_and_consume(db, user.id, payload.recovery_code):
        ok = True
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid code. Try again with a fresh code from your app, or a recovery code.")

    return _issue_access(db, user)


# ── Refresh (rotate access + refresh) ─────

@router.post("/refresh")
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    """
    Exchange a valid refresh token for a new access + refresh pair (rotation).
    Presenting a revoked/already-used token is treated as theft: the whole
    family is revoked and the request is rejected.
    """
    invalid = HTTPException(status_code=401, detail="Invalid or expired session. Please sign in again.")

    token_hash = hash_refresh_token(payload.refresh_token)
    row = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if not row:
        raise invalid

    # Reuse detection: a revoked token being presented means either a replay
    # or a stolen-then-rotated token. Burn the entire family.
    if row.revoked:
        db.query(RefreshToken).filter(RefreshToken.family_id == row.family_id).update(
            {RefreshToken.revoked: True}
        )
        db.commit()
        raise invalid

    if row.expires_at < datetime.utcnow():
        raise invalid

    user = db.query(User).filter(User.id == row.user_id).first()
    if not user or not user.is_active:
        raise invalid

    # Rotate: revoke the presented token, issue a fresh one in the same family.
    row.revoked = True
    db.commit()

    new_access = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    new_refresh = _issue_refresh(db, user, family_id=row.family_id)

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
    }


# ── Logout (revoke all refresh tokens) ────

@router.post("/sensitive/reauth")
def sensitive_reauth(
    payload: SensitiveReauthRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-verify password; mint a short-lived sensitive-access grant."""
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect password.")
    grant = create_sensitive_grant(current_user.id)
    audit_service.log_event(db, current_user.id, audit_service.SENSITIVE_ACCESS, request=request)
    return {"sensitive_grant": grant}


@router.post("/logout")
def logout(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Revoke every outstanding refresh token for this user."""
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.revoked == False,  # noqa: E712
    ).update({RefreshToken.revoked: True})
    db.commit()
    return {"message": "Logged out."}


# ── Me (current user) ─────────────────────

@router.get("/me")
def me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.full_name,
        "email": current_user.email,
        "plan": current_user.plan,
        "documents_used": current_user.documents_used,
        "totp_enabled": current_user.totp_enabled,
        "recovery_codes_remaining": recovery_service.remaining_count(db, current_user.id) if current_user.totp_enabled else 0,
    }


# ── 2FA / TOTP enrollment ─────────────────
# Manage 2FA for an already-logged-in user.

@router.post("/2fa/setup")
def totp_setup(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled. Disable it first to re-enroll.")

    secret = generate_secret()
    current_user.totp_secret = secret
    db.commit()

    return {
        "secret": secret,
        "qr": qr_data_uri(secret, current_user.email),
        "message": "Scan the QR with an authenticator app, then confirm with a code.",
    }


@router.post("/2fa/confirm")
def totp_confirm(payload: TotpCodeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled.")
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="No enrollment in progress. Call /2fa/setup first.")
    if not verify_code(current_user.totp_secret, payload.code):
        raise HTTPException(status_code=400, detail="Invalid code. Try again with a fresh code from your app.")

    current_user.totp_enabled = True
    db.commit()

    # Mint recovery codes — shown to the user exactly once, right now.
    codes = recovery_service.generate_codes(db, current_user.id)
    return {
        "message": "Two-factor authentication enabled.",
        "recovery_codes": codes,
    }


@router.post("/2fa/disable")
def totp_disable(payload: TotpCodeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled.")
    if not verify_code(current_user.totp_secret, payload.code):
        raise HTTPException(status_code=400, detail="Invalid code.")

    current_user.totp_secret = None
    current_user.totp_enabled = False
    db.commit()

    # Disabling 2FA invalidates any recovery codes.
    from app.models.recovery_code import RecoveryCode
    db.query(RecoveryCode).filter(RecoveryCode.user_id == current_user.id).delete()
    db.commit()

    return {"message": "Two-factor authentication disabled."}



@router.post("/2fa/recovery/regenerate")
def recovery_regenerate(payload: TotpCodeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Replace the user's recovery codes with a fresh set. Requires a current
    TOTP code, and invalidates all previously issued codes."""
    if not current_user.totp_enabled or not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA is not enabled.")
    if not verify_code(current_user.totp_secret, payload.code):
        raise HTTPException(status_code=400, detail="Invalid code. Try again with a fresh code from your app.")

    codes = recovery_service.generate_codes(db, current_user.id)
    return {
        "message": "Recovery codes regenerated. Previous codes are now invalid.",
        "recovery_codes": codes,
    }
