# ─────────────────────────────────────────
# DocSentinel v2 — Verification Layer
# PhRedSec™ | services/verification.py
#
# Pure, deterministic. Builds initial per-field metadata from an extraction
# result + its confidence object. NO model probabilities, NO fabricated data.
# Confidence is what the AI thinks; verification is what the user knows.
# ─────────────────────────────────────────

# Business-critical fields a human would verify. Filename/size/dates excluded.
VERIFIABLE_FIELDS = (
    "vendor_name",
    "invoice_number",
    "invoice_date",
    "gstin",
    "tax_amount",
    "total_amount",
    "hsn_codes",
    "document_type",
)

# Document-level verification states.
STATUS_AI_EXTRACTED = "AI_EXTRACTED"
STATUS_NEEDS_REVIEW = "NEEDS_REVIEW"
STATUS_VERIFIED = "VERIFIED"

EVENT_FIELD_CORRECTED = "FIELD_CORRECTED"
EVENT_FIELD_RESTORED = "FIELD_RESTORED"
EVENT_DOCUMENT_VERIFIED = "DOCUMENT_VERIFIED"
EVENT_RULE_SUGGESTION_ACCEPTED = "RULE_SUGGESTION_ACCEPTED"
EVENT_RULE_SUGGESTION_REJECTED = "RULE_SUGGESTION_REJECTED"


def _is_present(value) -> bool:
    """A field counts as extracted only if it has a real value."""
    if value is None:
        return False
    if isinstance(value, str) and value.strip() == "":
        return False
    return True


def build_field_metadata(result: dict, confidence: dict | None) -> dict:
    """
    Returns:
      {
        "field_metadata": { <field>: {ai_value, current_value, confidence,
                            verified, verified_by, verified_at, last_modified_at} },
        "total_verifiable_fields": int,   # only fields actually extracted
        "verified_fields_count": 0,
        "verification_status": "AI_EXTRACTED",
      }

    Only extracted (non-empty) verifiable fields get an entry. Per-field
    confidence mirrors field_signals where a deterministic validator exists
    (gstin/invoice_date/hsn_codes); otherwise null — never invented.
    """
    signals = (confidence or {}).get("field_signals", {}) or {}

    field_metadata: dict = {}
    for field in VERIFIABLE_FIELDS:
        ai_value = result.get(field)
        if not _is_present(ai_value):
            continue
        field_metadata[field] = {
            "ai_value": ai_value,
            "current_value": ai_value,
            "confidence": signals.get(field),  # signal string or None — honest
            "verified": False,
            "verified_by": None,
            "verified_at": None,
            "last_modified_at": None,
        }

    return {
        "field_metadata": field_metadata,
        "total_verifiable_fields": len(field_metadata),
        "verified_fields_count": 0,
        "verification_status": STATUS_AI_EXTRACTED,
    }
