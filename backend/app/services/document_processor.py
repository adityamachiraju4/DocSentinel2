import json
import base64
import io
import fitz  # PyMuPDF
from groq import Groq
from app.services.confidence import compute_confidence
from app.services.verification import build_field_metadata
from app.core.config import get_settings

settings = get_settings()
client = Groq(api_key=settings.GROQ_API_KEY)

# Allowed values — anything outside these gets normalized to a safe default.
_VALID_TYPES = {
    "invoice", "bill", "receipt", "contract", "payslip", "bank_statement",
    "tax_return", "gst_return", "purchase_order", "credit_note",
    "debit_note", "other",
}
_VALID_MODULES = {
    "accounts_payable", "accounts_receivable", "payroll", "compliance", "general",
}

# ── The JSON structure we want Groq to return ──────────────────────────────
EXTRACTION_PROMPT = """You are a document intelligence system for Indian businesses.

You are looking at an image of a single document. Read it the way a person would — including handwriting, stamps, letterheads, and rotated or skewed scans. Extract structured information.

DOCUMENT TYPE GUIDE — choose the single best match:
- "invoice": A bill issued to a customer requesting payment for goods/services, usually has an invoice number.
- "bill": A bill received from a vendor/supplier for goods/services purchased.
- "receipt": Proof of a completed payment (cash, card, UPI), or a hospital/clinic/shop bill-cum-receipt. Usually shorter than an invoice.
- "contract": A legal agreement between two or more parties, has signature blocks or terms/clauses.
- "payslip": Salary slip showing employee earnings, deductions, and net pay for a pay period.
- "bank_statement": A list of bank account transactions over a date range.
- "tax_return": Income tax return (ITR) filings, tax computation summaries, Form 16, or annual tax documents.
- "gst_return": GST filings such as GSTR-1, GSTR-3B, or GST summary documents.
- "purchase_order": A document requesting goods/services from a supplier, issued BEFORE payment, usually has a PO number.
- "credit_note": A document reducing the amount owed (e.g. for returns or corrections).
- "debit_note": A document increasing the amount owed (e.g. for additional charges).
- "other": Use only if none of the above genuinely fit.

VENDOR NAME GUIDE — look carefully for:
- Company/hospital/shop letterhead, logo text, or header at the top of the document
- Lines like "From:", "Issued by:", "Billed by:", "Seller:", "Company Name:"
- For payslips/tax returns, this may be the employer or filing entity name
- For a hospital/clinic bill, the hospital or clinic name is the vendor
- If truly no organization name appears anywhere, only then return null

AMOUNT GUIDE:
- total_amount is the final payable/total figure (e.g. "Total Bill", "Final Bill", "Grand Total", "Net Payable").
- Return it as a plain number, no currency symbol or commas.

Return ONLY a valid JSON object with these exact keys:
{
  "document_type": "invoice | bill | receipt | contract | payslip | bank_statement | tax_return | gst_return | purchase_order | credit_note | debit_note | other",
  "module": "accounts_payable | accounts_receivable | payroll | compliance | general",
  "vendor_name": "string or null",
  "invoice_number": "string or null",
  "invoice_date": "string or null",
  "total_amount": number or null,
  "gstin": "string or null",
  "hsn_codes": "comma-separated string or null",
  "tax_amount": number or null,
  "raw_text": "the complete verbatim text content of the document"
}

Return ONLY the JSON. No explanation. No markdown. No extra text."""

# ── Fallback dict when extraction fails ────────────────────────────────────
def _empty_result(method: str) -> dict:
    return {
        "document_type": "unknown",
        "module": "general",
        "vendor_name": None,
        "invoice_number": None,
        "invoice_date": None,
        "total_amount": None,
        "gstin": None,
        "hsn_codes": None,
        "tax_amount": None,
        "extraction_method": method,
        "raw_text": None,
        "validation_status": "valid",
        "original_document_type": None,
    }

# ── Strip ```json fences if the model wraps its output ─────────────────────
def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return text.strip()

# ── Coerce a value to float, tolerating "₹1,234.50" style strings ──────────
def _to_number(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        cleaned = value.replace(",", "").replace("₹", "").replace("Rs", "").strip()
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None

# ── Normalize a raw model dict into our exact schema ───────────────────────
def _validate(raw: dict, method: str) -> dict:
    result = _empty_result(method)

    dtype = str(raw.get("document_type") or "").lower().strip()
    if dtype in _VALID_TYPES:
        result["document_type"] = dtype
        result["validation_status"] = "valid"
    elif dtype:
        result["document_type"] = "other"
        result["validation_status"] = "invalid_document_type"
        result["original_document_type"] = dtype
    else:
        result["document_type"] = "other"
        result["validation_status"] = "missing_document_type"

    module = str(raw.get("module") or "").lower().strip()
    result["module"] = module if module in _VALID_MODULES else "general"

    for key in ("vendor_name", "invoice_number", "invoice_date", "gstin", "hsn_codes"):
        val = raw.get(key)
        if isinstance(val, str):
            val = val.strip()
            result[key] = val if val and val.lower() not in ("null", "none", "n/a") else None
        else:
            result[key] = val if val is not None else None

    result["total_amount"] = _to_number(raw.get("total_amount"))
    result["tax_amount"] = _to_number(raw.get("tax_amount"))
    rt = raw.get("raw_text")
    result["raw_text"] = rt.strip() if isinstance(rt, str) and rt.strip() else None
    return result

# ── Render the first page of a PDF to PNG bytes ────────────────────────────
def _pdf_to_image_bytes(file_bytes: bytes) -> bytes | None:
    """
    Rasterize page 1 of a PDF to PNG using PyMuPDF. Returns None on failure.
    Every PDF goes through here so the vision model 'sees' the page like a
    human would — works for digital PDFs, scans, and phone-photo PDFs alike.
    """
    try:
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            if doc.page_count == 0:
                return None
            page = doc.load_page(0)
            # 2x zoom (~144 DPI) — sharper text for the vision model.
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            return pix.tobytes("png")
    except Exception as e:
        print(f"[PDF RASTER ERROR] {type(e).__name__}: {e}")
        return None

# ── Vision path: for JPG / PNG / every rasterized PDF page ─────────────────
def _extract_via_vision(image_bytes: bytes, mime_type: str, method: str) -> dict:
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{image_b64}"}},
                {"type": "text", "text": EXTRACTION_PROMPT},
            ],
        }
    ]

    try:
        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=messages,
            temperature=0,
            seed=42,
            max_tokens=1500,
            response_format={"type": "json_object"},
        )
        result_text = _strip_fences(response.choices[0].message.content)
        raw = json.loads(result_text)
        return _validate(raw, method)

    except json.JSONDecodeError as e:
        print(f"[VISION JSON ERROR] {e}")
        print(f"[RAW RESPONSE] {result_text}")
        return _empty_result(f"{method}_parse_failed")
    except Exception as e:
        print(f"[VISION ERROR] {type(e).__name__}: {e}")
        return _empty_result(f"{method}_error")

# ── Text path: only for genuine plain-text files (.txt) ────────────────────
def _extract_via_text(file_bytes: bytes, filename: str) -> dict:
    raw_text = file_bytes.decode("utf-8", errors="ignore")
    if not raw_text.strip():
        return _empty_result("none")

    prompt = f"""You are a document intelligence system for Indian businesses.

Analyze the following document text and extract structured information.

Document filename: {filename}
Document text:
{raw_text[:3000]}

DOCUMENT TYPE GUIDE — choose the single best match:
- "invoice", "bill", "receipt", "contract", "payslip", "bank_statement",
  "tax_return", "gst_return", "purchase_order", "credit_note", "debit_note", "other".

Return ONLY a valid JSON object with these exact keys:
{{
  "document_type": "invoice | bill | receipt | contract | payslip | bank_statement | tax_return | gst_return | purchase_order | credit_note | debit_note | other",
  "module": "accounts_payable | accounts_receivable | payroll | compliance | general",
  "vendor_name": "string or null",
  "invoice_number": "string or null",
  "invoice_date": "string or null",
  "total_amount": number or null,
  "gstin": "string or null",
  "hsn_codes": "comma-separated string or null",
  "tax_amount": number or null,
  "raw_text": "the complete verbatim text content of the document"
}}

Return ONLY the JSON. No explanation. No markdown. No extra text."""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            seed=42,
            max_tokens=1500,
            response_format={"type": "json_object"},
        )
        result_text = _strip_fences(response.choices[0].message.content)
        raw = json.loads(result_text)
        out = _validate(raw, "groq_text")
        out["raw_text"] = raw_text
        return out

    except json.JSONDecodeError as e:
        print(f"[TEXT JSON ERROR] {e}")
        print(f"[RAW RESPONSE] {result_text}")
        return _empty_result("groq_text_parse_failed")
    except Exception as e:
        print(f"[TEXT ERROR] {type(e).__name__}: {e}")
        return _empty_result("error")

# ── Public entry point called from documents.py ───────────────────────────
def _classify_and_extract_raw(file_bytes: bytes, filename: str, mime_type: str) -> dict:
    # Images → vision directly.
    if mime_type in ("image/jpeg", "image/jpg", "image/png"):
        return _extract_via_vision(file_bytes, mime_type, "groq_vision")

    # PDFs → always rasterize page 1 and read it as an image.
    if mime_type == "application/pdf" or filename.lower().endswith(".pdf"):
        image_bytes = _pdf_to_image_bytes(file_bytes)
        if image_bytes is not None:
            return _extract_via_vision(image_bytes, "image/png", "groq_pdf_vision")
        return _empty_result("pdf_raster_failed")

    # Everything else (.txt and friends) → text path.
    return _extract_via_text(file_bytes, filename)


def classify_and_extract(file_bytes: bytes, filename: str, mime_type: str) -> dict:
    """Public entrypoint. Runs raw extraction, then attaches a deterministic,
    explainable confidence object. Additive — existing keys unchanged."""
    result = _classify_and_extract_raw(file_bytes, filename, mime_type)
    result["confidence"] = compute_confidence(result)
    result["verification"] = build_field_metadata(result, result["confidence"])
    return result
