"""Deterministic confidence engine for extraction results.

Every signal here is a computed fact — regex validity, field presence,
schema/validation status — NOT a model-reported probability. Groq chat
completions do not expose reliable token logprobs, so we never fabricate
a per-field model-confidence number. Confidence = rule-based evidence only.
"""
import re
from datetime import datetime

# ── Indian format patterns ─────────────────────────────────────────────────
# GSTIN: 2-digit state code, 10-char PAN, 1 entity digit, fixed 'Z', 1 checksum.
_GSTIN = re.compile(r'^\d{2}[A-Z]{5}\d{4}[A-Z]\dZ[A-Z\d]$')
_PAN = re.compile(r'^[A-Z]{5}\d{4}[A-Z]$')
_HSN = re.compile(r'^\d{4,8}$')  # HSN/SAC codes are 4-8 digits

_DATE_FORMATS = (
    "%d-%b-%Y", "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d",
    "%d %b %Y", "%d %B %Y", "%d-%b-%y", "%b %d, %Y",
)

# Required fields per document_type — presence of these is a real signal.
_REQUIRED_FIELDS = {
    "invoice":        ("vendor_name", "invoice_number", "total_amount"),
    "bill":           ("vendor_name", "total_amount"),
    "receipt":        ("vendor_name", "total_amount"),
    "purchase_order": ("vendor_name", "invoice_number"),
    "credit_note":    ("vendor_name", "invoice_number"),
    "debit_note":     ("vendor_name", "invoice_number"),
    "payslip":        ("vendor_name", "total_amount"),
    "gst_return":     ("gstin",),
    "tax_return":     ("vendor_name",),
    "bank_statement": ("vendor_name",),
    "contract":       ("vendor_name",),
}


def validate_gstin(s) -> bool | None:
    """True/False if present; None if field absent."""
    if not isinstance(s, str) or not s.strip():
        return None
    return bool(_GSTIN.match(s.strip().upper()))


def validate_pan(s) -> bool | None:
    if not isinstance(s, str) or not s.strip():
        return None
    return bool(_PAN.match(s.strip().upper()))


def validate_hsn(s) -> bool | None:
    """hsn_codes is a comma-separated string; valid only if every code matches."""
    if not isinstance(s, str) or not s.strip():
        return None
    codes = [c.strip() for c in s.split(",") if c.strip()]
    if not codes:
        return None
    return all(_HSN.match(c) for c in codes)


def validate_date(s) -> bool | None:
    if not isinstance(s, str) or not s.strip():
        return None
    raw = s.strip()
    for fmt in _DATE_FORMATS:
        try:
            datetime.strptime(raw, fmt)
            return True
        except ValueError:
            continue
    return False


def _signal(flag: bool | None) -> str:
    if flag is None:
        return "absent"
    return "valid" if flag else "invalid"


def compute_confidence(result: dict) -> dict:
    """Build a structured, explainable confidence object from a validated
    extraction dict. All sub-scores derive from deterministic checks.

    Returns:
      {
        "overall": float,           # 0.0-1.0
        "document_type": float,     # from validation_status
        "required_fields": float,   # presence ratio for this doc type
        "schema": float,            # all expected keys present + parseable
        "field_signals": {gstin/pan/hsn_codes/invoice_date: valid|invalid|absent},
      }
    """
    # ── document_type score: straight from honest validation status ──
    vstatus = result.get("validation_status", "valid")
    if vstatus == "valid":
        dtype_score = 1.0
    elif vstatus == "invalid_document_type":
        dtype_score = 0.3   # model returned something, but outside enum
    else:                    # missing_document_type
        dtype_score = 0.0

    # ── field format signals (real regex checks) ──
    field_signals = {
        "gstin": _signal(validate_gstin(result.get("gstin"))),
        "invoice_date": _signal(validate_date(result.get("invoice_date"))),
        "hsn_codes": _signal(validate_hsn(result.get("hsn_codes"))),
    }
    # any present-but-invalid format drags confidence; absent is neutral
    present = [v for v in field_signals.values() if v != "absent"]
    if present:
        field_score = sum(1 for v in present if v == "valid") / len(present)
    else:
        field_score = 1.0  # nothing to validate → no negative evidence

    # ── required-fields presence for this document_type ──
    dtype = result.get("document_type", "other")
    required = _REQUIRED_FIELDS.get(dtype, ())
    if required:
        present_count = sum(
            1 for f in required if result.get(f) not in (None, "", 0, 0.0)
        )
        req_score = present_count / len(required)
    else:
        req_score = 1.0  # no defined requirements (e.g. 'other')

    # ── schema score: did all core keys come through as expected types ──
    core_keys = ("document_type", "module", "raw_text")
    schema_ok = all(k in result for k in core_keys)
    schema_score = 1.0 if schema_ok else 0.0

    # ── overall: weighted blend of the four honest signals ──
    overall = round(
        0.35 * dtype_score
        + 0.30 * req_score
        + 0.20 * field_score
        + 0.15 * schema_score,
        2,
    )

    return {
        "overall": overall,
        "document_type": round(dtype_score, 2),
        "required_fields": round(req_score, 2),
        "schema": round(schema_score, 2),
        "field_signals": field_signals,
    }
