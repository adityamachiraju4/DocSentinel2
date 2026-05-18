import json
import base64
from groq import Groq
from app.core.config import get_settings

settings = get_settings()
client = Groq(api_key=settings.GROQ_API_KEY)

# ── The JSON structure we want Groq to return ──────────────────────────────
EXTRACTION_PROMPT = """You are a document intelligence system for Indian businesses.

Analyze this document and extract structured information.

Return ONLY a valid JSON object with these exact keys:
{
  "document_type": "invoice | bill | receipt | contract | payslip | bank_statement | other",
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
    # 1. Encode the raw image bytes as a base64 string.
    #    Groq Vision expects images in base64 format, not raw bytes.
    image_b64 = base64.b64encode(file_bytes).decode("utf-8")

    # 2. Build the message. Groq Vision uses a "content" list that can
    #    contain both text and image_url blocks.
    #    image_url here is a data URI — it embeds the image directly
    #    in the request instead of pointing to a URL.
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
            temperature=0.1,   # low temperature = more deterministic output
            max_tokens=500,
        )
        result_text = response.choices[0].message.content.strip()

        # 3. Sometimes models wrap JSON in ```json ... ``` fences.
        #    Strip those out before parsing.
        if result_text.startswith("```"):
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]

        result = json.loads(result_text)
        result["extraction_method"] = "groq_vision"
        return result

    except json.JSONDecodeError:
        return _empty_result("groq_vision_parse_failed")
    except Exception:
        return _empty_result("groq_vision_error")


# ── Text path: for TXT and (eventually) PDF ───────────────────────────────
def _extract_via_text(file_bytes: bytes, filename: str, mime_type: str = "") -> dict:
    # If it's a PDF, use pdfplumber to extract real text from it.
    # PDFs are binary files — decoding them as UTF-8 gives garbage.
    # pdfplumber reads the actual text layer inside the PDF.
    if mime_type == "application/pdf" or filename.lower().endswith(".pdf"):
        try:
            import pdfplumber
            import io

            # io.BytesIO wraps the raw bytes so pdfplumber can read them
            # as if they were a file on disk — without saving to disk first.
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                # Loop through every page and extract text, then join with newlines
                raw_text = "\n".join(
                    page.extract_text() or ""   # extract_text() can return None, so 'or ""'
                    for page in pdf.pages
                )
        except Exception:
            # If pdfplumber fails for any reason, fall back to empty
            raw_text = ""
    else:
        # For TXT and other text files, plain UTF-8 decode works fine
        raw_text = file_bytes.decode("utf-8", errors="ignore")

    if not raw_text.strip():
        return _empty_result("none")

    prompt = f"""You are a document intelligence system for Indian businesses.

Analyze the following document text and extract structured information.

Document filename: {filename}
Document text:
{raw_text[:3000]}

Return ONLY a valid JSON object with these exact keys:
{{
  "document_type": "invoice | bill | receipt | contract | payslip | bank_statement | other",
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
        result = json.loads(result_text)
        return result

    except json.JSONDecodeError:
        return _empty_result("groq_text_parse_failed")
    except Exception:
        return _empty_result("error")

# ── Public entry point called from documents.py ───────────────────────────
def classify_and_extract(file_bytes: bytes, filename: str, mime_type: str) -> dict:
    if mime_type in ("image/jpeg", "image/jpg", "image/png"):
        return _extract_via_vision(file_bytes, mime_type)
    else:
        # Pass mime_type so _extract_via_text knows if it's a PDF
        return _extract_via_text(file_bytes, filename, mime_type)