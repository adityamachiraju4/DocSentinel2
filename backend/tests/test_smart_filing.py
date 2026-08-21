#!/usr/bin/env python3
# ─────────────────────────────────────────
# DocSentinel v2 — Phase 4a/4b Smart-Filing Test (POSITIVE)
# PhRedSec™ | test_smart_filing.py
# ─────────────────────────────────────────
#
# Proves the COMPLEMENT of test_private_no_extract.py:
#   A document uploaded into a SMART (vault_type="smart") folder IS accepted,
#   the Groq/storage seams DO run (stubbed here), and the persisted Document
#   is actually FILED into the target folder (Document.folder_id == folder.id).
#
# This is the positive counterpart to the negative ZK guardrail. The negative
# test asserts "no plaintext, no Groq for private". This one asserts "smart
# uploads accept AND file into the folder". Together they pin both arms of the
# per-folder mode model.
#
# Self-contained: throwaway SQLite in a temp dir, get_db + get_current_user
# overridden, in-process TestClient. The real docsentinel.db is never opened.
#
# Run from backend/:  python3 tests/test_smart_filing.py
# Exit 0 = smart uploads file correctly. Non-zero = filing broke.
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
from app.models.document import Document
import app.models  # noqa: F401  (register all models on Base.metadata)

FAILURES = []
def check(cond, label):
    if cond:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label}")
        FAILURES.append(label)

BODY = b"%PDF-1.4\nsmart-folder document body\n"


def main():
    tmpdir = tempfile.mkdtemp(prefix="ds_smart_")
    db_path = os.path.join(tmpdir, "smart_test.db")
    engine = create_engine(f"sqlite:///{db_path}")
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    # ---- seed one user + a SMART folder + a second user's folder (control) ----
    seed = TestSession()
    user = User(email="owner@test.local", hashed_password="x", full_name="Owner")
    seed.add(user)
    seed.commit()
    seed.refresh(user)
    uid = user.id
    smart_folder = Folder(user_id=uid, name="Invoices", vault_type="smart")
    seed.add(smart_folder)
    seed.commit()
    seed.refresh(smart_folder)
    sf_id = smart_folder.id

    other = User(email="intruder@test.local", hashed_password="x", full_name="Intruder")
    seed.add(other)
    seed.commit()
    seed.refresh(other)
    other_folder = Folder(user_id=other.id, name="NotYours", vault_type="smart")
    seed.add(other_folder)
    seed.commit()
    seed.refresh(other_folder)
    of_id = other_folder.id
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

    # ---- stub the two external seams (Groq + R2) ----
    real_extract = docroute.classify_and_extract
    real_save = docroute.save_file

    def spy_extract(file_bytes, filename, mime_type):
        return {
            "document_type": "invoice", "module": "invoice", "raw_text": "x",
            "extraction_method": "stub", "confidence": {},
            "verification": {
                "field_metadata": {},
                "verification_status": "unverified",
                "verified_fields_count": 0,
                "total_verifiable_fields": 0,
            },
        }

    def spy_save_file(file_bytes, filename):
        return f"stub-key/{filename}"

    docroute.classify_and_extract = spy_extract
    docroute.save_file = spy_save_file

    try:
        client = TestClient(m.app)

        print("Uploading a document into a SMART (vault_type=smart) folder:\n")

        # --- happy path: upload into own smart folder ---
        resp = client.post(
            "/api/documents/upload",
            files={"file": ("inv.pdf", io.BytesIO(BODY), "application/pdf")},
            data={"folder_id": str(sf_id)},
        )
        check(resp.status_code in (200, 201),
              f"smart upload accepted (got {resp.status_code})")

        doc_id = None
        if resp.status_code in (200, 201):
            doc_id = resp.json().get("document", {}).get("id")
        check(doc_id is not None, "response returned a document id")

        # The core assertion: the persisted Document is FILED into the folder.
        if doc_id is not None:
            verify = TestSession()
            try:
                doc = verify.query(Document).filter(Document.id == doc_id).first()
                check(doc is not None, "document row persisted")
                check(doc is not None and doc.folder_id == sf_id,
                      f"document filed into target folder (folder_id={getattr(doc,'folder_id',None)}, expected {sf_id})")
            finally:
                verify.close()

        # --- control 1: upload with NO folder_id still works, folder_id NULL ---
        resp2 = client.post(
            "/api/documents/upload",
            files={"file": ("nofolder.pdf", io.BytesIO(BODY), "application/pdf")},
        )
        check(resp2.status_code in (200, 201),
              f"upload with no folder_id accepted (got {resp2.status_code})")
        if resp2.status_code in (200, 201):
            did2 = resp2.json().get("document", {}).get("id")
            verify = TestSession()
            try:
                d2 = verify.query(Document).filter(Document.id == did2).first()
                check(d2 is not None and d2.folder_id is None,
                      f"unfiled upload has folder_id NULL (got {getattr(d2,'folder_id',None)})")
            finally:
                verify.close()

        # --- control 2: upload into ANOTHER user's folder -> 404, not filed ---
        resp3 = client.post(
            "/api/documents/upload",
            files={"file": ("x.pdf", io.BytesIO(BODY), "application/pdf")},
            data={"folder_id": str(of_id)},
        )
        check(resp3.status_code == 404,
              f"upload into another user's folder refused 404 (got {resp3.status_code})")

    finally:
        docroute.classify_and_extract = real_extract
        docroute.save_file = real_save
        m.app.dependency_overrides.clear()

    print()
    if FAILURES:
        print(f"SMART-FILING BROKEN — {len(FAILURES)} open:")
        for f in FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    else:
        print("SMART-FILING HOLDS ✓  (smart uploads accept and file into folder)")
        sys.exit(0)


if __name__ == "__main__":
    main()
