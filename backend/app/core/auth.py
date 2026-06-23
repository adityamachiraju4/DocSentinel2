# ─────────────────────────────────────────
# DocSentinel v2 — Authentication
# PhRedSec™ | auth.py
# ─────────────────────────────────────────
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.database import get_db
settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
# Scopes distinguish a fully-authenticated token from a half-authenticated
# one that has passed the password check but still owes a 2FA code.
SCOPE_ACCESS = "access"
SCOPE_2FA_PENDING = "2fa_pending"
SCOPE_REFRESH = "refresh"
# A pending token is short-lived: just long enough to type a code.
PENDING_TOKEN_EXPIRE_MINUTES = 5
# Refresh tokens are long-lived; the access token they mint is short.
REFRESH_TOKEN_EXPIRE_DAYS = 30
def hash_password(password: str) -> str:
    return pwd_context.hash(password)
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Issue a fully-authenticated access token (scope=access by default)."""
    to_encode = data.copy()
    to_encode.setdefault("scope", SCOPE_ACCESS)
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
def create_pending_token(user_id: int) -> str:
    """
    Issue a short-lived token that proves the password step passed but is
    NOT valid for protected routes. It can only be exchanged at /login/verify.
    """
    expire = datetime.utcnow() + timedelta(minutes=PENDING_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": str(user_id), "scope": SCOPE_2FA_PENDING, "exp": expire}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
def decode_pending_token(token: str) -> int:
    """
    Validate a pending token and return its user_id. Rejects anything that
    isn't a live 2fa_pending token. Used only by the verify endpoint.
    """
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired 2FA session. Please sign in again.",
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise invalid
    if payload.get("scope") != SCOPE_2FA_PENDING:
        raise invalid
    user_id = payload.get("sub")
    if user_id is None:
        raise invalid
    return int(user_id)
# ── Refresh tokens ──
# The raw refresh token is an opaque random string handed to the client.
# We persist only its sha256 hash, so a DB leak never exposes usable tokens.
# A JWT wrapper carries the scope/expiry and the jti (= the raw token) so the
# server can hash it on receipt and look up the matching row.
def generate_refresh_token() -> str:
    """Return a fresh opaque random token (the raw value given to the client)."""
    return secrets.token_urlsafe(48)
def hash_refresh_token(raw_token: str) -> str:
    """sha256 of the raw token — this is what gets stored and looked up."""
    return hashlib.sha256(raw_token.encode()).hexdigest()
def new_family_id() -> str:
    """Identifier tying a chain of rotated tokens together (reuse detection)."""
    return secrets.token_urlsafe(16)
def refresh_token_expiry() -> datetime:
    return datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        # A pending (half-authenticated) or refresh token must never reach protected routes.
        if payload.get("scope") != SCOPE_ACCESS:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    from app.models.user import User
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user
