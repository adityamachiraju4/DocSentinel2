import json
import base64
from groq import Groq
from app.core.config import get_settings

settings = get_settings()
client = Groq(api_key=settings.GROQ_API_KEY)

# ── The JSON structure we want Groq to return ──────────────────────────────
EXTRACTION_PROMPT = """You are a document intelligence system for Indian businesses.

Analyze this document and extract structured information.

DOCUMENT TYPE GUIDE — choose the single best match:
- "invoice": A bill issued to a customer requesting payment for goods/services, usually has an invoice number.
- "bill": A bill received from a vendor/supplier for goods/services purchased.
- "receipt": Proof of a completed payment (cash, card, UPI), usually shorter than an invoice.
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
- Company letterhead, logo text, or header at the top of the document
- Lines like "From:", "Issued by:", "Billed by:", "Seller:", "Company Name:"
- For payslips/tax returns, this may be the employer or filing entity name instead
- If truly no organization name appears anywhere, only then return null

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
  "extraction_method": "groq_vision"
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
    }

# ── Vision path: for JPG / PNG ─────────────────────────────────────────────
def _extract_via_vision(file_bytes: bytes, mime_type: str) -> dict:
    image_b64 = base64.b64encode(file_bytes).decode("utf-8")

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime_type};base64,{image_b64}"
                    },
                },
                {
                    "type": "text",
                    "text": EXTRACTION_PROMPT,
                },
            ],
        }
    ]

    try:
        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=messages,
            temperature=0.1,
            max_tokens=500,
        )
        result_text = response.choices[0].message.content.strip()

        if result_text.startswith("```"):
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]

        result = json.loads(result_text)
        result["extraction_method"] = "groq_vision"
        return result

    except json.JSONDecodeError as e:
        print(f"[VISION JSON ERROR] {e}")
        print(f"[RAW RESPONSE] {result_text}")
        return _empty_result("groq_vision_parse_failed")
    except Exception as e:
        print(f"[VISION ERROR] {type(e).__name__}: {e}")
        return _empty_result("groq_vision_error")


# ── Text path: for TXT and PDF ──────────────────────────────────────────
def _extract_via_text(file_bytes: bytes, filename: str, mime_type: str = "") -> dict:
    if mime_type == "application/pdf" or filename.lower().endswith(".pdf"):
        try:
            import pdfplumber
            import io

            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                raw_text = "\n".join(
                    page.extract_text() or ""
                    for page in pdf.pages
                )
        except Exception:
            raw_text = ""
    else:
        raw_text = file_bytes.decode("utf-8", errors="ignore")

    if not raw_text.strip():
        return _empty_result("none")

    prompt = f"""You are a document intelligence system for Indian businesses.

Analyze the following document text and extract structured information.

Document filename: {filename}
Document text:
{raw_text[:3000]}

DOCUMENT TYPE GUIDE — choose the single best match:
- "invoice": A bill issued to a customer requesting payment for goods/services, usually has an invoice number.
- "bill": A bill received from a vendor/supplier for goods/services purchased.
- "receipt": Proof of a completed payment (cash, card, UPI), usually shorter than an invoice.
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
- Company letterhead, logo text, or header at the top of the document
- Lines like "From:", "Issued by:", "Billed by:", "Seller:", "Company Name:"
- For payslips/tax returns, this may be the employer or filing entity name instead
- If truly no organization name appears anywhere, only then return null

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
  "extraction_method": "groq_text"
}}

Return ONLY the JSON. No explanation. No markdown. No extra text."""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=500,
        )
        result_text = response.choices[0].message.content.strip()

        if result_text.startswith("```"):
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
            result_text = result_text.strip()

        result = json.loads(result_text)
        result["extraction_method"] = "groq_text"
        return result

    except json.JSONDecodeError as e:
        print(f"[TEXT JSON ERROR] {e}")
        print(f"[RAW RESPONSE] {result_text}")
        return _empty_result("groq_text_parse_failed")
    except Exception as e:
        print(f"[TEXT ERROR] {type(e).__name__}: {e}")
        return _empty_result("error")

# ── Public entry point called from documents.py ───────────────────────────
def classify_and_extract(file_bytes: bytes, filename: str, mime_type: str) -> dict:
    if mime_type in ("image/jpeg", "image/jpg", "image/png"):
        return _extract_via_vision(file_bytes, mime_type)
    else:
        return _extract_via_text(file_bytes, filename, mime_type)
