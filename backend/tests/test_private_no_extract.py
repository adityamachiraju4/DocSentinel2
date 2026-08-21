#!/usr/bin/env python3
# ─────────────────────────────────────────
# DocSentinel v2 — Phase 4b Zero-Knowledge Bypass Test (NEGATIVE / GUARDRAIL)
# PhRedSec™ | test_private_no_extract.py
# ─────────────────────────────────────────
#
# Proves the CORE Phase 4b guarantee BEFORE the feature exists:
#   A document uploaded into a PRIVATE (vault_type="private") folder is
#   STRUCTURALLY INCAPABLE of reaching the Groq extraction pipeline, and the
#   server never persists its plaintext bytes.
#
# This test is written FIRST and is EXPECTED TO FAIL RED until 4b lands:
#   1) folders.vault_type does not exist yet  -> setup fails
#   2) the upload route has no folder_id param / no private branch
#      -> classify_and_extract() still runs, save_file() still gets plaintext
# Each red failure marks a bypass that does not yet exist. When all four
# assertions go green, the structural bypass is real. This becomes the
# guardrail every subsequent 4b commit must keep green.
#
# It does NOT assert the eventual crypto is correct (that is a later,
# positive test). It asserts only the NEGATIVE: no plaintext, no Groq.
#
# Self-contained: throwaway SQLite in a temp dir, get_db + get_current_user
# overridden, in-process TestClient. The real docsentinel.db is never opened.
#
# Run from backend/:  python3 tests/test_private_no_extract.py
# Exit 0 = bypass holds. Non-zero = plaintext or Groq leak (or not built yet).
import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import io
import tempfile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

import app.main as m
import app.api.routes.documents as docroute
from app.core.database import Base, get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.folder import Folder
import app.models  # noqa: F401  (register all models on Base.metadata)

FAILURES = []
def check(cond, label):
    if cond:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label}")
        FAILURES.append(label)

# Distinctive plaintext marker we can search for in whatever the storage
# seam is handed. If the server ever calls save_file with these bytes for a
# private upload, that is a plaintext leak.
PLAINTEXT_MARKER = b"PHREDSEC-PRIVATE-PLAINTEXT-CANARY-9f3a2b"
PLAINTEXT_BODY = b"%PDF-1.4\n" + PLAINTEXT_MARKER + b"\n_secret household document_\n"


def main():
    tmpdir = tempfile.mkdtemp(prefix="ds_zk_")
    db_path = os.path.join(tmpdir, "zk_test.db")
    engine = create_engine(f"sqlite:///{db_path}")
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    # ---- seed one user + a PRIVATE folder ----
    # NOTE: vault_type does not exist on Folder until 4b. This line is the
    # first expected RED: it will raise TypeError until the column is added.
    seed = TestSession()
    user = User(email="owner@test.local", hashed_password="x", full_name="Owner")
    seed.add(user)
    seed.commit()
    seed.refresh(user)
    uid = user.id
    private_folder = Folder(user_id=uid, name="Household Private", vault_type="private")
    seed.add(private_folder)
    seed.commit()
    seed.refresh(private_folder)
    pf_id = private_folder.id
    seed.close()

    # ---- dependency overrides ----
    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    def override_get_current_user():
        db = TestSession()
        try:
            return db.query(User).filter(User.id == uid).first()
        finally:
            db.close()

    m.app.dependency_overrides[get_db] = override_get_db
    m.app.dependency_overrides[get_current_user] = override_get_current_user

    # ---- instrument the two plaintext seams (as imported into the route) ----
    calls = {"extract": 0, "save_file_plaintext_hits": 0, "save_file_calls": 0}

    real_extract = docroute.classify_and_extract
    real_save = docroute.save_file

    def spy_extract(file_bytes, filename, mime_type):
        calls["extract"] += 1
        # Do not actually hit Groq during the test. Return a fully-shaped
        # result so the (still-present) smart path can build a Document
        # without 500ing — we are testing that this path is NOT taken for
        # private uploads, not exercising it.
        return {
            "document_type": None, "module": None, "raw_text": None,
            "extraction_method": "stub", "confidence": {},
            "verification": {
                "field_metadata": {},
                "verification_status": "unverified",
                "verified_fields_count": 0,
                "total_verifiable_fields": 0,
            },
        }

    def spy_save_file(file_bytes, filename):
        calls["save_file_calls"] += 1
        if PLAINTEXT_MARKER in (file_bytes or b""):
            calls["save_file_plaintext_hits"] += 1
        return f"stub-key/{filename}"

    docroute.classify_and_extract = spy_extract
    docroute.save_file = spy_save_file

    try:
        client = TestClient(m.app)
        resp = client.post(
            "/api/documents/upload",
            files={"file": ("secret.pdf", io.BytesIO(PLAINTEXT_BODY), "application/pdf")},
            data={"folder_id": str(pf_id)},
        )

        print("Uploading a document into a PRIVATE (vault_type=private) folder:\n")

        # 1. The upload must be accepted with folder targeting (route must
        #    learn folder_id). Until then this is red.
        check(resp.status_code in (200, 201),
              f"upload into private folder accepted (got {resp.status_code})")

        # 2. Groq extraction entrypoint must NEVER run for a private upload.
        check(calls["extract"] == 0,
              f"classify_and_extract NOT called for private upload (called {calls['extract']}x)")

        # 3. The server must NEVER persist the plaintext bytes for a private
        #    upload. If save_file runs at all here it must be on ciphertext,
        #    so the canary marker must be absent.
        check(calls["save_file_plaintext_hits"] == 0,
              f"plaintext bytes NEVER handed to save_file (leaks: {calls['save_file_plaintext_hits']})")

        # 4. Belt-and-suspenders: the canary must not survive anywhere in the
        #    response body either (no echo of plaintext).
        check(PLAINTEXT_MARKER not in resp.content,
              "plaintext canary absent from upload response body")

    finally:
        docroute.classify_and_extract = real_extract
        docroute.save_file = real_save
        m.app.dependency_overrides.clear()

    print()
    if FAILURES:
        print(f"ZERO-KNOWLEDGE BYPASS NOT YET ESTABLISHED — {len(FAILURES)} open:")
        for f in FAILURES:
            print(f"  - {f}")
        print("\n(Expected RED until Phase 4b lands the private branch.)")
        sys.exit(1)
    else:
        print("ZERO-KNOWLEDGE BYPASS HOLDS ✓  (no Groq, no plaintext for private uploads)")
        sys.exit(0)


if __name__ == "__main__":
    main()
