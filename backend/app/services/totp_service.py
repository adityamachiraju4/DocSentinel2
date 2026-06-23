# ─────────────────────────────────────────
# DocSentinel v2 — TOTP Service
# PhRedSec™ | services/totp_service.py
#
# Pure TOTP logic: secret generation, provisioning URI for
# authenticator apps, and code verification. No DB, no routes.
# ─────────────────────────────────────────

import base64
from io import BytesIO

import pyotp
import qrcode

ISSUER = "DocSentinel"


def generate_secret() -> str:
    """Create a new base32 TOTP secret. Store this on the user at enrollment."""
    return pyotp.random_base32()


def provisioning_uri(secret: str, account_email: str) -> str:
    """
    otpauth:// URI that authenticator apps consume. Encodes issuer + account
    so the entry reads 'DocSentinel (user@email)' in the app.
    """
    return pyotp.TOTP(secret).provisioning_uri(name=account_email, issuer_name=ISSUER)


def qr_data_uri(secret: str, account_email: str) -> str:
    """
    Render the provisioning URI as a QR code, returned as a base64 data URI
    the frontend can drop straight into an <img src=...>. Keeps QR generation
    server-side so the secret's only client exposure is the scannable image.
    """
    uri = provisioning_uri(secret, account_email)
    img = qrcode.make(uri)
    buf = BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def verify_code(secret: str, code: str) -> bool:
    """
    Verify a 6-digit code against the secret. valid_window=1 allows the
    adjacent 30s step, covering minor clock drift between server and phone.
    """
    if not secret or not code:
        return False
    return pyotp.TOTP(secret).verify(str(code).strip(), valid_window=1)
