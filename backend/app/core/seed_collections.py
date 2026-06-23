# ─────────────────────────────────────────
# DocSentinel v2 — Seed System Collections
# PhRedSec™ | core/seed_collections.py
#
# Idempotent: inserts only collections that don't already exist.
# Safe to call on every startup. Slugs are the stable identifier.
# ─────────────────────────────────────────
from sqlalchemy.orm import Session
from app.models.collection import Collection

# Only REAL collections the extractor can populate today.
# No Identity / Medical / Personal / Review Needed — those are future phases.
SYSTEM_COLLECTIONS = [
    {"slug": "invoices",  "name": "Invoices",  "icon": "file-text",   "description": "Invoices issued and received"},
    {"slug": "receipts",  "name": "Receipts",  "icon": "receipt",     "description": "Payment receipts, bills, credit/debit notes"},
    {"slug": "contracts", "name": "Contracts", "icon": "file-signature", "description": "Agreements and contracts"},
    {"slug": "tax",       "name": "Tax",       "icon": "landmark",     "description": "Income tax and GST filings"},
    {"slug": "hr",        "name": "HR",        "icon": "users",        "description": "Payslips and HR documents"},
    {"slug": "banking",   "name": "Banking",   "icon": "building-2",   "description": "Bank statements"},
    {"slug": "other",     "name": "Other",     "icon": "folder",       "description": "Uncategorized documents"},
]


def seed_system_collections(db: Session) -> None:
    existing_slugs = {row.slug for row in db.query(Collection.slug).all()}
    created = 0
    for c in SYSTEM_COLLECTIONS:
        if c["slug"] not in existing_slugs:
            db.add(Collection(
                slug=c["slug"],
                name=c["name"],
                icon=c["icon"],
                description=c["description"],
                system_created=True,
            ))
            created += 1
    if created:
        db.commit()
        print(f"[SEED] Created {created} system collection(s).")
    else:
        print("[SEED] System collections already present.")
