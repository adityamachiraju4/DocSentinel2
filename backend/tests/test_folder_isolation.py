#!/usr/bin/env python3
# ─────────────────────────────────────────
# DocSentinel v2 — Phase 4a Ownership-Isolation Test
# PhRedSec™ | test_folder_isolation.py
# ─────────────────────────────────────────
#
# Proves the PRIMARY Phase 4a guarantee: no cross-user folder access on ANY
# route. User B, fully authenticated, attempts to reach User A's folder and
# document through every folder endpoint. Every attempt must return 404
# (never 403, never 200) — no existence disclosure, no access.
#
# Self-contained: builds a THROWAWAY SQLite DB in a temp dir, overrides
# get_db + get_current_user, runs in-process via TestClient. The real
# docsentinel.db is never opened. Temp DB is deleted on exit.
#
# Run from backend/:  python3 test_folder_isolation.py
# Exit code 0 = all isolation boundaries held. Non-zero = a breach.

import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import tempfile

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# Import the app and the seams we override.
import app.main as m
from app.core.database import Base, get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.folder import Folder

# Ensure every model is registered on Base.metadata before create_all.
import app.models  # noqa: F401

FAILURES = []


def check(cond, label):
    if cond:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label}")
        FAILURES.append(label)


def main():
    tmpdir = tempfile.mkdtemp(prefix="ds_isolation_")
    db_path = os.path.join(tmpdir, "isolation_test.db")
    engine = create_engine(f"sqlite:///{db_path}")
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Fresh schema in the throwaway DB.
    Base.metadata.create_all(bind=engine)

    # ---- seed two users + A's folder + A's document, directly ----
    seed = TestSession()
    user_a = User(email="alice@test.local", hashed_password="x", full_name="Alice")
    user_b = User(email="bob@test.local", hashed_password="x", full_name="Bob")
    seed.add_all([user_a, user_b])
    seed.commit()
    seed.refresh(user_a)
    seed.refresh(user_b)
    a_id, b_id = user_a.id, user_b.id

    a_folder = Folder(user_id=a_id, name="Alice Taxes")
    seed.add(a_folder)
    seed.commit()
    seed.refresh(a_folder)
    a_folder_id = a_folder.id

    a_doc = Document(
        user_id=a_id,
        filename="a.pdf",
        original_filename="alice_secret.pdf",
        folder_id=a_folder_id,
    )
    # B owns one doc of their own, unfiled — used to test moving into A's folder.
    b_doc = Document(
        user_id=b_id,
        filename="b.pdf",
        original_filename="bob_own.pdf",
    )
    seed.add_all([a_doc, b_doc])
    seed.commit()
    seed.refresh(a_doc)
    seed.refresh(b_doc)
    a_doc_id, b_doc_id = a_doc.id, b_doc.id
    seed.close()

    # ---- dependency overrides: DB -> temp; auth -> selectable current user ----
    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    # Mutable holder so we can flip which user is "authenticated".
    current = {"uid": b_id}

    def override_get_current_user():
        db = TestSession()
        try:
            return db.query(User).filter(User.id == current["uid"]).first()
        finally:
            db.close()

    m.app.dependency_overrides[get_db] = override_get_db
    m.app.dependency_overrides[get_current_user] = override_get_current_user

    client = TestClient(m.app)

    # ============ acting as USER B, attacking USER A's resources ============
    current["uid"] = b_id
    print("Acting as User B, attempting to reach User A's folder/document:\n")

    # 1. B lists folders -> must NOT contain A's folder
    r = client.get("/api/folders/")
    b_sees = [f["id"] for f in r.json()] if r.status_code == 200 else []
    check(r.status_code == 200 and a_folder_id not in b_sees,
          f"list: B does not see A's folder (status {r.status_code}, sees {b_sees})")

    # 2. B GETs A's folder by id -> 404
    r = client.get(f"/api/folders/{a_folder_id}")
    check(r.status_code == 404, f"GET A's folder -> 404 (got {r.status_code})")

    # 3. B renames A's folder -> 404
    r = client.patch(f"/api/folders/{a_folder_id}", json={"name": "hacked"})
    check(r.status_code == 404, f"PATCH rename A's folder -> 404 (got {r.status_code})")

    # 4. B deletes A's folder -> 404
    r = client.delete(f"/api/folders/{a_folder_id}")
    check(r.status_code == 404, f"DELETE A's folder -> 404 (got {r.status_code})")

    # 5. B moves A's document -> 404 (document not owned)
    r = client.patch(f"/api/folders/documents/{a_doc_id}", json={"folder_id": None})
    check(r.status_code == 404, f"PATCH move A's document -> 404 (got {r.status_code})")

    # 6. B moves B's OWN doc into A's folder -> 404 (target folder not owned)
    r = client.patch(f"/api/folders/documents/{b_doc_id}", json={"folder_id": a_folder_id})
    check(r.status_code == 404,
          f"PATCH move own doc into A's folder -> 404 (got {r.status_code})")

    # ---- verify NOTHING was mutated by the attacks ----
    verify = TestSession()
    a_folder_now = verify.query(Folder).filter(Folder.id == a_folder_id).first()
    a_doc_now = verify.query(Document).filter(Document.id == a_doc_id).first()
    b_doc_now = verify.query(Document).filter(Document.id == b_doc_id).first()
    check(a_folder_now is not None and a_folder_now.name == "Alice Taxes",
          "A's folder unchanged (still exists, name intact)")
    check(a_doc_now is not None and a_doc_now.folder_id == a_folder_id,
          "A's document unchanged (still in A's folder)")
    check(b_doc_now is not None and b_doc_now.folder_id is None,
          "B's own document unchanged (still unfiled)")
    verify.close()

    # ---- positive control: B CAN operate on B's own resources ----
    print("\nPositive control — B acting on B's own resources:\n")
    r = client.post("/api/folders/", json={"name": "Bob Stuff"})
    check(r.status_code == 200, f"B creates own folder -> 200 (got {r.status_code})")
    b_folder_id = r.json().get("id") if r.status_code == 200 else None
    r = client.patch(f"/api/folders/documents/{b_doc_id}", json={"folder_id": b_folder_id})
    check(r.status_code == 200, f"B moves own doc into own folder -> 200 (got {r.status_code})")

    # ---- cleanup ----
    m.app.dependency_overrides.clear()
    engine.dispose()
    try:
        os.remove(db_path)
        os.rmdir(tmpdir)
    except OSError:
        pass

    print("\n" + "=" * 50)
    if FAILURES:
        print(f"ISOLATION BREACH — {len(FAILURES)} failure(s):")
        for f in FAILURES:
            print("   -", f)
        sys.exit(1)
    print("ALL ISOLATION BOUNDARIES HELD ✓")
    sys.exit(0)


if __name__ == "__main__":
    main()
