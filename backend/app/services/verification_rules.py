# ─────────────────────────────────────────
# DocSentinel v2 — Verification Rules (Learning Engine)
# PhRedSec™ | services/verification_rules.py
#
# Pure + DB helpers for per-tenant correction knowledge.
# "DocSentinel remembers verified corrections for your organization."
# A rules layer — NOT base-model retraining.
#
# Eligibility to WRITE a rule (all must hold):
#   field.verified is True
#   AND current_value != ai_value      (intentional change only)
#   AND document.verification_status == VERIFIED
#   AND vendor_key is not None         (no learning from unknown vendors)
#
# rule_confidence is DERIVED from accept/reject counts — never stored.
# Rules SUGGEST; they never silently overwrite AI extraction.
# ─────────────────────────────────────────
import re
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.verification_rule import VerificationRule
from app.services.confidence import validate_gstin


def normalize_vendor_identity(name: str) -> str:
    """
    IDENTITY normalization — answers "are these the same business?"
    Aggressive: lowercase, strip punctuation, collapse whitespace.
    Use ONLY for vendor key resolution. Never for value matching.
    """
    s = name.lower()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _value_light(v: str) -> str:
    """Conservative: lowercase, trim, collapse whitespace. No punctuation removal."""
    return re.sub(r"\s+", " ", v.lower()).strip()


def _value_trim(v: str) -> str:
    """Trim + collapse whitespace only. Formatting is significant (e.g. invoice_number)."""
    return re.sub(r"\s+", " ", v).strip()


def _value_gstin(v: str) -> str:
    """Uppercase + trim. GSTIN is case-insensitive in practice; display stays original."""
    return re.sub(r"\s+", "", v).upper()


# Per-field VALUE normalization policy for rule matching.
# Reserved structured normalizers (hsn_codes/tax_amount/invoice_date) default to
# light today; replace when those structured matchers are built.
_FIELD_VALUE_NORMALIZER = {
    "vendor_name": _value_light,
    "invoice_number": _value_trim,   # formatting significant: INV-001 != INV001
    "gstin": _value_gstin,
    "document_type": _value_light,
}


def normalize_rule_value(field_name: str, value) -> str | None:
    """
    VALUE normalization — answers "did the AI produce essentially the same value?"
    Field-type aware. Returns None for absent values. Display always uses original.
    """
    if value is None:
        return None
    text = value if isinstance(value, str) else str(value)
    normalizer = _FIELD_VALUE_NORMALIZER.get(field_name, _value_light)
    return normalizer(text)


def resolve_vendor_key(result: dict) -> str | None:
    """
    GSTIN-first, normalized-name fallback, else None.
      valid gstin       -> "gstin:<gstin>"
      else vendor_name  -> "name:<normalized>"
      else              -> None  (not learning-eligible)
    """
    gstin = result.get("gstin")
    if gstin and validate_gstin(gstin) is True:
        return f"gstin:{gstin.strip()}"
    vendor = result.get("vendor_name")
    if isinstance(vendor, str) and vendor.strip():
        norm = normalize_vendor_identity(vendor)
        if norm:
            return f"name:{norm}"
    return None


def rule_confidence(rule: VerificationRule) -> float | None:
    """
    Derived trust signal in [0,1] from accept/reject. None when no signal yet.
    Not AI confidence — rule confidence. Never stored, computed on read.
    """
    total = (rule.accept_count or 0) + (rule.reject_count or 0)
    if total == 0:
        return None
    return round((rule.accept_count or 0) / total, 4)


def upsert_rule(
    db: Session,
    *,
    user_id: int,
    vendor_key: str,
    field_name: str,
    ai_value,
    corrected_value,
    document_id: int | None,
) -> VerificationRule:
    """
    Create or update the (user_id, vendor_key, field_name) rule from a verified
    correction. Caller is responsible for enforcing the eligibility triple;
    this function records knowledge only. Does NOT commit.
    """
    rule = (
        db.query(VerificationRule)
        .filter(
            VerificationRule.user_id == user_id,
            VerificationRule.vendor_key == vendor_key,
            VerificationRule.field_name == field_name,
        )
        .first()
    )
    now = datetime.now(timezone.utc)
    if rule is None:
        rule = VerificationRule(
            user_id=user_id,
            vendor_key=vendor_key,
            field_name=field_name,
            ai_value=_as_text(ai_value),
            corrected_value=_as_text(corrected_value),
            ai_value_normalized=normalize_rule_value(field_name, ai_value),
            corrected_value_normalized=normalize_rule_value(field_name, corrected_value),
            usage_count=0,
            accept_count=0,
            reject_count=0,
            created_from_document_id=document_id,
        )
        db.add(rule)
    else:
        # Refresh the knowledge to the latest verified correction.
        rule.ai_value = _as_text(ai_value)
        rule.corrected_value = _as_text(corrected_value)
        rule.ai_value_normalized = normalize_rule_value(field_name, ai_value)
        rule.corrected_value_normalized = normalize_rule_value(field_name, corrected_value)
    return rule


def _get_owned_rule(db: Session, *, rule_id: int, user_id: int) -> VerificationRule | None:
    """Fetch a rule by id, scoped to its owner. None if missing or not owned."""
    return (
        db.query(VerificationRule)
        .filter(VerificationRule.id == rule_id, VerificationRule.user_id == user_id)
        .first()
    )


def record_acceptance(db: Session, *, rule_id: int, user_id: int) -> VerificationRule | None:
    """
    User accepted a suggestion (kept the previously-verified value). Bumps
    usage_count and accept_count. Returns the rule, or None if not owned.
    Does NOT commit.
    """
    rule = _get_owned_rule(db, rule_id=rule_id, user_id=user_id)
    if rule is None:
        return None
    rule.usage_count = (rule.usage_count or 0) + 1
    rule.accept_count = (rule.accept_count or 0) + 1
    rule.last_used_at = datetime.now(timezone.utc)
    return rule


def record_rejection(db: Session, *, rule_id: int, user_id: int) -> VerificationRule | None:
    """
    User kept the AI value over the suggestion. Bumps usage_count and
    reject_count. Returns the rule, or None if not owned. Does NOT commit.
    """
    rule = _get_owned_rule(db, rule_id=rule_id, user_id=user_id)
    if rule is None:
        return None
    rule.usage_count = (rule.usage_count or 0) + 1
    rule.reject_count = (rule.reject_count or 0) + 1
    rule.last_used_at = datetime.now(timezone.utc)
    return rule


def lookup_suggestions(db: Session, *, user_id: int, result: dict) -> dict:
    """
    Pure read. Given an AI extraction result, return per-field suggestions drawn
    from this user's verification rules for the resolved vendor key.

    A suggestion is offered only when the AI's freshly extracted value matches
    (under field-aware value normalization) the value the AI produced when the
    rule was learned. Display uses original values; matching uses normalized.

    Returns: { field_name: {current, previously_verified, rule_id, rule_confidence} }
    Empty dict when no vendor key or no matching rules. No writes, no mutation.
    """
    vendor_key = resolve_vendor_key(result)
    if vendor_key is None:
        return {}

    rules = (
        db.query(VerificationRule)
        .filter(
            VerificationRule.user_id == user_id,
            VerificationRule.vendor_key == vendor_key,
        )
        .all()
    )
    if not rules:
        return {}

    suggestions: dict = {}
    for rule in rules:
        ai_value = result.get(rule.field_name)
        if ai_value is None:
            continue
        ai_norm = normalize_rule_value(rule.field_name, ai_value)
        if ai_norm is None or ai_norm != rule.ai_value_normalized:
            continue
        # Don't suggest a no-op (corrected value identical to what AI produced).
        if normalize_rule_value(rule.field_name, rule.corrected_value) == ai_norm:
            continue
        suggestions[rule.field_name] = {
            "current": ai_value,
            "previously_verified": rule.corrected_value,
            "rule_id": rule.id,
            "rule_confidence": rule_confidence(rule),
        }
    return suggestions


def _as_text(v):
    if v is None:
        return None
    if isinstance(v, str):
        return v
    return str(v)
