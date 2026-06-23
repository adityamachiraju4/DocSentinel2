"""Detect Indian government / personal identity documents from extracted text."""
import re

# Strong patterns (low false-positive): match alone.
_PAN = re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]\b')
_AADHAAR = re.compile(r'\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b')
_VOTER = re.compile(r'\b[A-Z]{3}[0-9]{7}\b')

# Loose patterns: require a nearby keyword to count.
_PASSPORT = re.compile(r'\b[A-PR-WY][0-9]{7}\b')
_DL = re.compile(r'\b[A-Z]{2}[0-9]{2}\s?[0-9]{11}\b')

_KEYWORDS = re.compile(
    r'passport|driving\s*licen[cs]e|aadhaar|aadhar|permanent\s*account|'
    r'income\s*tax\s*department|election\s*commission|voter|'
    r'government\s*of\s*india|unique\s*identification',
    re.IGNORECASE,
)


def detect_sensitive(text: str | None) -> bool:
    if not text:
        return False
    if _PAN.search(text) or _AADHAAR.search(text) or _VOTER.search(text):
        return True
    has_kw = bool(_KEYWORDS.search(text))
    if has_kw and (_PASSPORT.search(text) or _DL.search(text)):
        return True
    if has_kw:
        return True
    return False
