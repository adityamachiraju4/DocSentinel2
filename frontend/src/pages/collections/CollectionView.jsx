import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from '../../hooks/useAuth.jsx';

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const T = {
  bg: { base: "#07080A", panel: "#0D0E11" },
  card: "linear-gradient(180deg, #17181C 0%, #121317 100%)",
  border: { hairline: "1px solid rgba(255,255,255,0.07)", strong: "1px solid rgba(255,255,255,0.14)" },
  text: { primary: "#F5F6F7", secondary: "#BDC1C8", muted: "#858992", faint: "#5B5F66" },
  accent: { violet: "#7C5CFF", bright: "#9B82FF" },
  semantic: { success: "#3FB950", warning: "#D29922", error: "#F85149", info: "#58A6FF" },
  font: { sans: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" },
};

const TYPE_COLORS = {
  invoice: "#9B82FF", purchase_order: "#9B82FF",
  receipt: "#3FB950", bill: "#3FB950", credit_note: "#3FB950", debit_note: "#3FB950",
  tax_return: "#58A6FF", gst_return: "#58A6FF", bank_statement: "#58A6FF",
  contract: "#D29922", payslip: "#9B82FF",
};

const fmtFull = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const META_FIELDS = [
  { key: "vendor_name", label: "Vendor" },
  { key: "invoice_number", label: "Invoice no." },
  { key: "invoice_date", label: "Date" },
  { key: "gstin", label: "GSTIN" },
  { key: "hsn_codes", label: "HSN codes" },
  { key: "tax_amount", label: "Tax amount", money: true },
];

// Known legal-entity suffixes used to derive a human-friendly display vendor.
// We never overwrite extracted data — this is presentation only.
const ENTITY_SUFFIXES = /\b(private limited|pvt\.? ltd\.?|limited|ltd\.?|llp|inc\.?|corporation|corp\.?|co\.?)\b/gi;

// Map well-known seller-of-record legal entities to their recognizable brand.
// Purely cosmetic; the real vendor_name is always shown beneath as provenance.
const VENDOR_ALIASES = [
  { match: /veritrade/i, brand: "Amazon" },
  { match: /clicktech/i, brand: "Amazon" },
  { match: /appario/i, brand: "Amazon" },
  { match: /cloudtail/i, brand: "Amazon" },
  { match: /flipkart|wsretail|w\.?s\.? retail/i, brand: "Flipkart" },
];

// Returns { brand, legal } where brand is the friendly headline and
// legal is the raw extracted entity (null if they're effectively the same).
function deriveVendor(raw) {
  if (!raw) return { brand: null, legal: null };
  const trimmed = String(raw).trim();
  const alias = VENDOR_ALIASES.find((a) => a.match.test(trimmed));
  if (alias) return { brand: alias.brand, legal: trimmed };
  const stripped = trimmed.replace(ENTITY_SUFFIXES, "").replace(/\s+/g, " ").trim();
  // Title-case the stripped brand for readability
  const brand = stripped
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
  const differs = brand.toLowerCase() !== trimmed.toLowerCase();
  return { brand: brand || trimmed, legal: differs ? trimmed : null };
}

/* ============================ Preview pane (hero) ============================ */

function PreviewPane({ doc, onDeleted }) {
  const { authFetch } = useAuth();
  const [blobUrl, setBlobUrl] = useState(null);
  const [previewState, setPreviewState] = useState("loading"); // loading | ready | error | missing
  const [showRaw, setShowRaw] = useState(false);

  const isImage = (doc?.mime_type || "").startsWith("image/");
  const isPdf = (doc?.mime_type || "") === "application/pdf";
  const color = doc ? (TYPE_COLORS[doc.document_type] || T.text.muted) : T.text.muted;
  const { brand, legal } = deriveVendor(doc?.vendor_name);

  useEffect(() => {
    if (!doc) return;
    let revoked = false, url = null;
    setPreviewState("loading");
    setShowRaw(false);
    authFetch(`/api/documents/${doc.id}/file`)
      .then((res) => {
        if (res.status === 404) { setPreviewState("missing"); return null; }
        return res.ok ? res.blob() : Promise.reject();
      })
      .then((blob) => {
        if (revoked || !blob) return;
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setPreviewState("ready");
      })
      .catch(() => !revoked && setPreviewState("error"));
    return () => { revoked = true; if (url) URL.revokeObjectURL(url); };
  }, [doc?.id]);

  function handleDownload() {
    authFetch(`/api/documents/${doc.id}/file?download=true`)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = doc.filename || "document"; a.click();
        URL.revokeObjectURL(url);
      });
  }

  function handleOpen() {
    if (blobUrl) window.open(blobUrl, "_blank", "noopener");
  }

  function handleDelete() {
    if (!window.confirm(`Delete ${doc.filename}? This can't be undone.`)) return;
    authFetch(`/api/documents/${doc.id}`, { method: "DELETE" })
      .then((res) => { if (res.ok) onDeleted(doc.id); });
  }

  if (!doc) {
    return (
      <div style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", color: T.text.faint, fontSize: "13px", fontFamily: T.font.mono }}>
        Select a document to preview
      </div>
    );
  }

  const rawText = doc.extracted_text || doc.raw_text || null;
  const visibleFields = META_FIELDS
    .map((f) => {
      const raw = doc[f.key];
      if (raw == null || raw === "") return null;
      return { label: f.label, value: f.money ? fmtFull(raw) : raw };
    })
    .filter(Boolean);

  return (
    <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0, background: T.bg.panel, borderLeft: T.border.hairline }}>
      {/* Custom header — replaces native PDF chrome */}
      <div style={{ padding: "16px 22px", borderBottom: T.border.hairline, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span style={{ fontSize: "10px", fontFamily: T.font.mono, textTransform: "uppercase", letterSpacing: "0.04em", padding: "3px 8px", borderRadius: "5px", border: `1px solid ${color}33`, background: `${color}12`, color }}>{(doc.document_type || "—").replace(/_/g, " ")}</span>
            {brand && <span style={{ fontSize: "14px", fontWeight: 600, color: T.text.primary }}>{brand}</span>}
          </div>
          <div style={{ fontSize: "11px", fontFamily: T.font.mono, color: T.text.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.filename}</div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <button onClick={handleOpen} disabled={previewState !== "ready"} title="Open in new tab" style={iconBtn(previewState === "ready")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></svg>
          </button>
          <button onClick={handleDownload} title="Download original" style={iconBtn(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
          </button>
          <button onClick={handleDelete} title="Delete" style={{ ...iconBtn(true), color: T.semantic.error, borderColor: "rgba(248,81,73,0.25)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
          </button>
        </div>
      </div>

      {/* Preview (≈60%) */}
      <div key={doc.id} className="cv-fade" style={{ flex: "1 1 60%", minHeight: 0, background: T.bg.base, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {previewState === "loading" && <span style={{ fontSize: "12px", fontFamily: T.font.mono, color: T.text.muted }}>Decrypting…</span>}
        {previewState === "error" && <span style={{ fontSize: "12px", fontFamily: T.font.mono, color: T.text.muted }}>Preview unavailable</span>}
        {previewState === "missing" && (
          <div style={{ textAlign: "center", maxWidth: "260px" }}>
            <div style={{ fontSize: "13px", color: T.text.secondary, marginBottom: "6px" }}>No stored file</div>
            <div style={{ fontSize: "11px", fontFamily: T.font.mono, color: T.text.faint, lineHeight: 1.5 }}>This document predates encrypted storage. Re-upload it to enable preview.</div>
          </div>
        )}
        {previewState === "ready" && isPdf && <iframe title="preview" src={`${blobUrl}#toolbar=0&navpanes=0&view=FitH`} style={{ width: "100%", height: "100%", border: T.border.hairline, borderRadius: "8px", background: "#fff" }} />}
        {previewState === "ready" && isImage && <img alt="preview" src={blobUrl} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "8px" }} />}
        {previewState === "ready" && !isPdf && !isImage && <span style={{ fontSize: "12px", fontFamily: T.font.mono, color: T.text.muted }}>No inline preview for this type</span>}
      </div>

      {/* Fields + raw-text toggle (≈40%) */}
      <div style={{ flex: "1 1 40%", minHeight: 0, overflowY: "auto", borderTop: T.border.hairline, padding: "18px 22px" }}>
        {/* Amount */}
        <div style={{ background: T.card, border: T.border.hairline, borderRadius: "10px", padding: "14px 16px", marginBottom: "18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "10px", fontFamily: T.font.mono, letterSpacing: "0.1em", color: T.text.faint, textTransform: "uppercase" }}>Total amount</span>
          <span style={{ fontSize: "22px", fontWeight: 700, fontFamily: T.font.mono, fontVariantNumeric: "tabular-nums", color: doc.total_amount != null ? T.semantic.success : T.text.faint }}>{doc.total_amount != null ? fmtFull(doc.total_amount) : "—"}</span>
        </div>

        {/* Toggle */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
          <button onClick={() => setShowRaw(false)} style={segBtn(!showRaw)}>Fields</button>
          <button onClick={() => setShowRaw(true)} style={segBtn(showRaw)} title={rawText ? "" : "No extracted text on this document"}>Raw text</button>
        </div>

        {!showRaw ? (
          <div key="fields" className="cv-fade" style={{ display: "flex", flexDirection: "column", gap: "11px" }}>
            {/* Vendor headline with legal entity demoted */}
            {brand && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "baseline" }}>
                <span style={{ fontSize: "11px", color: T.text.muted }}>Vendor</span>
                <span style={{ textAlign: "right", minWidth: 0 }}>
                  <span style={{ fontSize: "13px", color: T.text.primary, display: "block" }}>{brand}</span>
                  {legal && <span style={{ fontSize: "10px", fontFamily: T.font.mono, color: T.text.faint, display: "block", marginTop: "2px", wordBreak: "break-word" }}>{legal}</span>}
                </span>
              </div>
            )}
            {visibleFields.filter((f) => f.label !== "Vendor").map((f) => (
              <div key={f.label} style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
                <span style={{ fontSize: "11px", color: T.text.muted }}>{f.label}</span>
                <span style={{ fontSize: "12px", fontFamily: T.font.mono, color: T.text.secondary, textAlign: "right", wordBreak: "break-all" }}>{f.value}</span>
              </div>
            ))}
            {visibleFields.length === 0 && !brand && (
              <div style={{ fontSize: "12px", color: T.text.faint, fontFamily: T.font.mono }}>No fields extracted.</div>
            )}
            <div style={{ marginTop: "4px", fontSize: "9px", fontFamily: T.font.mono, letterSpacing: "0.08em", color: T.text.faint, textTransform: "uppercase" }}>Extracted by AI</div>
          </div>
        ) : (
          <div key="raw" className="cv-fade" style={{ fontSize: "11px", fontFamily: T.font.mono, color: T.text.secondary, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6 }}>
            {rawText || <span style={{ color: T.text.faint }}>No extracted text stored for this document.</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function iconBtn(enabled) {
  return {
    width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: "7px", background: "rgba(255,255,255,0.03)", border: T.border.hairline,
    color: enabled ? T.text.secondary : T.text.faint, cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.5,
  };
}

function segBtn(active) {
  return {
    flex: 1, padding: "7px 0", borderRadius: "7px", cursor: "pointer",
    fontSize: "11px", fontFamily: T.font.mono, letterSpacing: "0.04em", textTransform: "uppercase",
    background: active ? "rgba(124,92,255,0.12)" : "transparent",
    border: active ? "1px solid rgba(124,92,255,0.35)" : T.border.hairline,
    color: active ? T.accent.bright : T.text.muted,
  };
}

/* ============================ List (left) ============================ */

function SortHeader({ label, field, sort, setSort, align = "left" }) {
  const active = sort.field === field;
  return (
    <button
      onClick={() => setSort((s) => ({ field, dir: s.field === field && s.dir === "desc" ? "asc" : "desc" }))}
      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: T.font.mono, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: active ? T.text.secondary : T.text.faint }}
    >
      {label}<span style={{ marginLeft: "4px", opacity: active ? 1 : 0.25 }}>{active && sort.dir === "asc" ? "↑" : "↓"}</span>
    </button>
  );
}

/* ============================ Page ============================ */

export default function CollectionView() {
  const { authFetch } = useAuth();
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ field: "created_at", dir: "desc" });
  const listRef = useRef(null);

  useEffect(() => {
    setLoading(true); setSelected(null); setQuery("");
    authFetch(`/api/collections/${slug}/documents`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });
  }, [slug]);

  const name = data?.collection?.name || slug;
  const allDocs = data?.documents || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allDocs;
    return allDocs.filter((d) => {
      const { brand } = deriveVendor(d.vendor_name);
      const hay = [d.filename, d.vendor_name, brand, (d.document_type || "").replace(/_/g, " "), d.total_amount != null ? String(d.total_amount) : ""]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [allDocs, query]);

  const docs = useMemo(() => {
    const arr = [...filtered];
    const { field, dir } = sort;
    arr.sort((a, b) => {
      let av, bv;
      if (field === "total_amount") { av = a.total_amount ?? -Infinity; bv = b.total_amount ?? -Infinity; }
      else if (field === "document_type") { av = a.document_type || ""; bv = b.document_type || ""; }
      else if (field === "invoice_date") { av = a.invoice_date || ""; bv = b.invoice_date || ""; }
      else { av = a.created_at || ""; bv = b.created_at || ""; }
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  // Auto-select first doc whenever the visible list changes and nothing valid is selected
  useEffect(() => {
    if (loading) return;
    if (docs.length === 0) { setSelected(null); return; }
    if (!selected || !docs.find((d) => d.id === selected.id)) {
      setSelected(docs[0]);
    }
  }, [docs, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const withAmount = allDocs.filter((d) => d.total_amount != null);
  const totalAmount = withAmount.reduce((s, d) => s + Number(d.total_amount), 0);

  function handleDeleted(id) {
    setData((prev) => prev ? { ...prev, documents: prev.documents.filter((d) => d.id !== id) } : prev);
  }

  const onKey = useCallback((e) => {
    if (!docs.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const idx = selected ? docs.findIndex((d) => d.id === selected.id) : -1;
      let next = e.key === "ArrowDown" ? idx + 1 : idx - 1;
      next = Math.max(0, Math.min(docs.length - 1, next));
      setSelected(docs[next]);
    }
  }, [docs, selected]);

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  // Keep selected row in view
  useEffect(() => {
    if (!selected || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-id="${selected.id}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: T.font.sans, color: T.text.primary }}>
      <style>{`
        .cvl-row { transition: background-color 0.1s ease; cursor: pointer; }
        .cvl-row:hover { background-color: rgba(255,255,255,0.035); }
        .cvl-row.sel { background-color: rgba(124,92,255,0.09); }
        .cvl-bar { transform: scaleY(0); transform-origin: center; transition: transform 0.18s cubic-bezier(0.4,0,0.2,1); }
        .cvl-row.sel .cvl-bar { background-color: ${T.accent.violet}; transform: scaleY(1); }
        .cv-search:focus { outline: none; border-color: rgba(124,92,255,0.5) !important; }
        @keyframes cvRowIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .cvl-row { animation: cvRowIn 0.22s ease both; }
        @keyframes cvFade { from { opacity: 0; } to { opacity: 1; } }
        .cv-fade { animation: cvFade 0.15s ease; }
      `}</style>

      {/* LEFT: list */}
      <div style={{ width: "320px", flexShrink: 0, display: "flex", flexDirection: "column", height: "100vh", borderRight: T.border.hairline }}>
        <div style={{ padding: "24px 20px 16px" }}>
          <div style={{ fontSize: "10px", fontFamily: T.font.mono, letterSpacing: "0.12em", color: T.text.faint, textTransform: "uppercase", marginBottom: "6px" }}>Collection</div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.01em" }}>{name}</h1>
          <div style={{ fontSize: "11px", fontFamily: T.font.mono, color: T.text.muted, display: "flex", gap: "12px" }}>
            <span>{allDocs.length} {allDocs.length === 1 ? "doc" : "docs"}</span>
            {withAmount.length > 0 && <span style={{ color: T.semantic.success }}>{fmtFull(totalAmount)}</span>}
          </div>
        </div>

        {allDocs.length > 0 && (
          <div style={{ padding: "0 16px 12px" }}>
            <div style={{ position: "relative" }}>
              <svg style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "14px", height: "14px", stroke: T.text.muted, fill: "none", strokeWidth: 2, strokeLinecap: "round" }} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
              <input
                className="cv-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: "8px", background: T.bg.base, border: T.border.hairline, color: T.text.primary, fontSize: "12px", fontFamily: T.font.sans }}
              />
            </div>
          </div>
        )}

        {/* sort bar */}
        {allDocs.length > 0 && (
          <div style={{ padding: "0 20px 8px", display: "flex", gap: "16px", borderBottom: T.border.hairline, paddingBottom: "10px" }}>
            <SortHeader label="Date" field="invoice_date" sort={sort} setSort={setSort} />
            <SortHeader label="Amount" field="total_amount" sort={sort} setSort={setSort} />
            <SortHeader label="Type" field="document_type" sort={sort} setSort={setSort} />
          </div>
        )}

        <div ref={listRef} style={{ flexGrow: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: T.text.muted, fontSize: "12px", fontFamily: T.font.mono }}>Loading…</div>
          ) : allDocs.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <div style={{ fontSize: "13px", color: T.text.secondary, marginBottom: "6px" }}>Nothing filed here yet.</div>
              <div style={{ fontSize: "11px", color: T.text.muted, lineHeight: 1.5 }}>Upload to the Vault — matching files land here automatically.</div>
            </div>
          ) : docs.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: T.text.muted, fontSize: "12px" }}>No matches for “{query}”.</div>
          ) : (
            docs.map((d, i) => {
              const color = TYPE_COLORS[d.document_type] || T.text.muted;
              const sel = selected?.id === d.id;
              const { brand } = deriveVendor(d.vendor_name);
              return (
                <div key={d.id} data-id={d.id} className={`cvl-row${sel ? " sel" : ""}`} onClick={() => setSelected(d)} style={{ display: "flex", borderBottom: T.border.hairline, animationDelay: `${Math.min(i * 22, 300)}ms` }}>
                  <div className="cvl-bar" style={{ width: "3px", flexShrink: 0, background: "transparent" }} />
                  <div style={{ padding: "12px 14px", minWidth: 0, flexGrow: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 500, color: T.text.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brand || d.filename}</span>
                      <span style={{ fontSize: "13px", fontFamily: T.font.mono, fontVariantNumeric: "tabular-nums", flexShrink: 0, color: d.total_amount != null ? T.text.primary : T.text.faint }}>{d.total_amount != null ? fmtFull(d.total_amount) : "—"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                      <span style={{ fontSize: "10px", fontFamily: T.font.mono, color, textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(d.document_type || "—").replace(/_/g, " ")}</span>
                      <span style={{ fontSize: "10px", fontFamily: T.font.mono, color: T.text.faint, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{d.invoice_date || "—"}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!loading && allDocs.length > 0 && (
          <div style={{ padding: "10px 20px", borderTop: T.border.hairline, display: "flex", justifyContent: "space-between", fontSize: "10px", fontFamily: T.font.mono, color: T.text.faint }}>
            <span>{docs.length} of {allDocs.length}</span>
            <span>↑↓ navigate</span>
          </div>
        )}
      </div>

      {/* RIGHT: hero preview */}
      <PreviewPane doc={selected} onDeleted={handleDeleted} />
    </div>
  );
}
