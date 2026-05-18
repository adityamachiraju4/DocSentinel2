# ─────────────────────────────────────────
# DocSentinel v2 — Auth Routes
# PhRedSec™ | api/routes/auth.py
# ─────────────────────────────────────────

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import timedelta

from app.core.database import get_db
from app.core.auth import hash_password, verify_password, create_access_token, get_current_user
from app.core.config import get_settings
from app.models.user import User

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


# ── Register ──────────────────────────────

@router.post("/register", status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    # Check if email already exists
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    # Validate password length
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    # Create user
    user = User(
        email=payload.email,
        full_name=payload.name,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": "Account created successfully. Please sign in."}


# ── Login ─────────────────────────────────

@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    # Find user
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated.")

    # Create JWT
    token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.full_name,
            "email": user.email,
            "plan": user.plan,
        }
    }


# ── Me (current user) ─────────────────────

@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.full_name,
        "email": current_user.email,
        "plan": current_user.plan,
        "documents_used": current_user.documents_used,
    }
