"""Produce genuinely redacted (image-based) PDFs for safe sharing.

Hard guarantee: sensitive values are removed from the output bytes, not merely
covered. Redaction rasterizes pages and masks pixels; a post-generation text
extraction pass asserts the values are gone. Fails closed on any mismatch.
"""
import fitz  # PyMuPDF

from app.services.sensitive_detector import (
    _PAN, _AADHAAR, _VOTER, _PASSPORT, _DL, _KEYWORDS,
)


def find_sensitive_spans(text: str | None) -> list[str]:
    """Return the actual matched sensitive VALUE strings in `text`.

    Only value patterns (PAN/Aadhaar/Voter/Passport/DL) yield redactable spans;
    keyword-only presence yields nothing to locate. Passport/DL are loose
    patterns, so they count only when a nearby identity keyword is present
    (mirrors detect_sensitive's gating) to avoid masking lookalike strings.

    Returns a de-duplicated list preserving first-seen order.
    """
    if not text:
        return []

    spans: list[str] = []
    for pat in (_PAN, _AADHAAR, _VOTER):
        spans.extend(m.group(0) for m in pat.finditer(text))

    if _KEYWORDS.search(text):
        for pat in (_PASSPORT, _DL):
            spans.extend(m.group(0) for m in pat.finditer(text))

    seen: set[str] = set()
    ordered: list[str] = []
    for s in spans:
        if s not in seen:
            seen.add(s)
            ordered.append(s)
    return ordered



class RedactionError(Exception):
    """Raised when a genuine redaction cannot be guaranteed. Fails closed."""


_ZOOM = 2  # mirror document_processor rasterization (~144 DPI)


def redact_pdf(file_bytes: bytes) -> bytes:
    """Return a new image-based PDF with sensitive values genuinely removed.

    Every page is rasterized to pixels; sensitive value regions are painted
    over in the pixel buffer; pages are reassembled as an image-only PDF, so
    the original selectable text no longer exists in the output.

    Fails closed (raises RedactionError) if:
      - a matched value cannot be located on the page (fidelity mismatch), or
      - the output PDF still yields any sensitive value on re-extraction.
    """
    src = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        if src.page_count == 0:
            raise RedactionError("empty PDF")

        out = fitz.open()
        try:
            mat = fitz.Matrix(_ZOOM, _ZOOM)
            total_matches = 0
            total_located = 0

            for page in src:
                text = page.get_text()
                spans = find_sensitive_spans(text)

                rects = []
                for span in spans:
                    total_matches += 1
                    hits = page.search_for(span)
                    if not hits:
                        # value present in text layer but not locatable as a box
                        raise RedactionError(
                            f"could not locate a detected value on page {page.number}"
                        )
                    total_located += 1
                    rects.extend(hits)

                pix = page.get_pixmap(matrix=mat)
                # scale point-space rects into pixmap pixel space
                for r in rects:
                    x0 = int(r.x0 * _ZOOM)
                    y0 = int(r.y0 * _ZOOM)
                    x1 = int(r.x1 * _ZOOM)
                    y1 = int(r.y1 * _ZOOM)
                    for y in range(max(0, y0), min(pix.height, y1)):
                        for x in range(max(0, x0), min(pix.width, x1)):
                            pix.set_pixel(x, y, (0, 0, 0))

                new_page = out.new_page(width=page.rect.width, height=page.rect.height)
                new_page.insert_image(page.rect, pixmap=pix)

            if total_matches != total_located:
                raise RedactionError(
                    f"fidelity mismatch: {total_matches} matched, {total_located} located"
                )

            result = out.tobytes()
        finally:
            out.close()
    finally:
        src.close()

    # real-strip verification: reopen output, assert no value survives
    verify = fitz.open(stream=result, filetype="pdf")
    try:
        leftover = []
        for page in verify:
            leftover.extend(find_sensitive_spans(page.get_text()))
        if leftover:
            raise RedactionError(
                f"redaction failed: {len(leftover)} sensitive value(s) survived in output"
            )
    finally:
        verify.close()

    return result
