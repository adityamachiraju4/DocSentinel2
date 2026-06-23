# ─────────────────────────────────────────
# DocSentinel v2 — Main Entry Point
# PhRedSec™ | main.py
# ─────────────────────────────────────────

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import get_settings
from app.core.database import engine, Base
from sqlalchemy.orm import Session as _Session
from app.core.seed_collections import seed_system_collections
import app.models

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — create all tables
    Base.metadata.create_all(bind=engine)
    # Seed system collections (idempotent)
    with _Session(engine) as _db:
        seed_system_collections(_db)
    yield
    # Shutdown — nothing to clean up yet


app = FastAPI(
    title="DocSentinel v2 API",
    description="AI-powered document intelligence for Indian businesses",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",        # Local Vite dev server
        "https://docsentinel.in",       # Production frontend
        "https://www.docsentinel.in",   # Production frontend with www
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health Check ──────────────────────────
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": "2.0.0"
    }

# ── Routers ───────────────────────────────
from app.api.routes import auth as auth_router
from app.api.routes import documents as documents_router
from app.api.routes import collections as collections_router

app.include_router(auth_router.router, prefix="/api")
app.include_router(documents_router.router, prefix="/api")
app.include_router(collections_router.router, prefix="/api")
