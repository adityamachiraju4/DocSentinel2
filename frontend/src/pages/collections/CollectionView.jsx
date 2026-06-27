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

const EVENT_META = {
  DOCUMENT_UPLOAD:   { label: "Uploaded",          color: "#7C5CFF" },
  DOCUMENT_VIEW:     { label: "Viewed",            color: "#3FB950" },
  DOCUMENT_DOWNLOAD: { label: "Downloaded",        color: "#9B82FF" },
  SENSITIVE_ACCESS:  { label: "Sensitive unlock",  color: "#F85149" },
  DELETE:            { label: "Deleted",           color: "#858992" },
};

function fmtWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  if (isNaN(d)) return "—";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function friendlyDevice(ua) {
  if (!ua) return null;
  let os = "";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Linux/i.test(ua)) os = "Linux";
  let br = "";
  if (/Edg\//i.test(ua)) br = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) br = "Opera";
  else if (/Chrome\//i.test(ua)) br = "Chrome";
  else if (/Firefox\//i.test(ua)) br = "Firefox";
  else if (/Safari\//i.test(ua)) br = "Safari";
  else if (/curl/i.test(ua)) br = "curl";
  if (br && os) return `${br} on ${os}`;
  if (br) return br;
  if (os) return os;
  return ua.length > 40 ? ua.slice(0, 40) + "…" : ua;
}

// Collapse consecutive identical (event_type + device) events into one row.
// No underlying data is dropped — count reflects how many raw events merged.
function groupActivity(rows) {
  const out = [];
  for (const e of rows) {
    const prev = out[out.length - 1];
    if (prev && prev.event_type === e.event_type && prev.device === e.device) {
      prev.count += 1;
      // rows are newest-first; keep the newest (first-seen) created_at
    } else {
      out.push({ ...e, count: 1 });
    }
  }
  return out;
}

/* ============================ Preview pane (hero) ============================ */

// Maps META_FIELDS keys -> confidence.field_signals keys (only these three are scored)
const FIELD_SIGNAL_KEY = { gstin: "gstin", invoice_date: "invoice_date", hsn_codes: "hsn_codes" };

// Reads doc.confidence.field_signals[key] -> "valid" | "invalid" | "absent" | undefined.
// Renders a badge only for valid/invalid; absent/unknown -> no badge (honest: no invented signal).
function FieldBadge({ doc, fieldKey }) {
  const sigKey = FIELD_SIGNAL_KEY[fieldKey];
  if (!sigKey) return null;
  const sig = doc?.confidence?.field_signals?.[sigKey];
  if (sig !== "valid" && sig !== "invalid") return null;
  const ok = sig === "valid";
  const col = ok ? T.semantic.success : T.semantic.warning;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "9px", fontFamily: T.font.mono, color: col, letterSpacing: "0.04em", marginLeft: "6px", flexShrink: 0 }}>
      <span aria-hidden="true">{ok ? "\u2713" : "\u26A0"}</span>
      {ok ? "OK" : "Review"}
    </span>
  );
}

function PreviewPane({ doc, onDeleted }) {
  const { authFetch, sensitiveReauth } = useAuth();
  const [blobUrl, setBlobUrl] = useState(null);
  const [previewState, setPreviewState] = useState("loading"); // loading | ready | error | missing | locked
  const [tab, setTab] = useState("fields"); // fields | raw | activity
  const [activity, setActivity] = useState(null); // null=unloaded, []=empty, [...]
  const [activityBusy, setActivityBusy] = useState(false);
  const [reauthPwd, setReauthPwd] = useState("");
  const [reauthBusy, setReauthBusy] = useState(false);
  const [reauthErr, setReauthErr] = useState("");
  const [sensitive, setSensitive] = useState(false);
  const [sensBusy, setSensBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  useEffect(() => { setSensitive(!!doc?.effective_sensitive); }, [doc?.id, doc?.effective_sensitive]);
  useEffect(() => { setActivity(null); setShareOpen(false); }, [doc?.id]);
  useEffect(() => {
    if (tab !== "activity" || activity !== null || !doc?.id) return;
    let alive = true;
    setActivityBusy(true);
    authFetch(`/api/documents/${doc.id}/audit`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => { if (alive) setActivity(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (alive) setActivity([]); })
      .finally(() => { if (alive) setActivityBusy(false); });
    return () => { alive = false; };
  }, [tab, activity, doc?.id, authFetch]);

  const isImage = (doc?.mime_type || "").startsWith("image/");
  const isPdf = (doc?.mime_type || "") === "application/pdf";
  const color = doc ? (TYPE_COLORS[doc.document_type] || T.text.muted) : T.text.muted;
  const { brand, legal } = deriveVendor(doc?.vendor_name);

  const loadPreview = useCallback(() => {
    if (!doc) return () => {};
    let revoked = false, url = null;
    setPreviewState("loading");
    setTab("fields");
    authFetch(`/api/documents/${doc.id}/file`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 404) { setPreviewState("missing"); return null; }
        if (res.status === 403) {
          const body = await res.json().catch(() => ({}));
          if (body.detail === "sensitive_reauth_required") {
            if (!revoked) setPreviewState("locked");
            return null;
          }
          return Promise.reject();
        }
        return res.ok ? res.blob() : Promise.reject();
      })
      .then((blob) => {
        if (revoked || !blob) return;
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setPreviewState("ready");
      })
      .catch(() => !revoked && setPreviewState("error"));
    return () => { revoked = true; if (url) URL.revokeObjectURL(url); setBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; }); };
  }, [doc?.id, authFetch]);

  useEffect(() => {
    setReauthPwd(""); setReauthErr("");
    const cleanup = loadPreview();
    return cleanup;
  }, [loadPreview]);

  async function handleReauth() {
    setReauthBusy(true); setReauthErr("");
    const ok = await sensitiveReauth(reauthPwd);
    setReauthBusy(false);
    if (!ok) { setReauthErr("Incorrect password."); return; }
    setReauthPwd("");
    loadPreview();
  }
  async function toggleSensitive() {
    if (sensBusy) return;
    const next = !sensitive;
    setSensBusy(true);
    try {
      const res = await authFetch(`/api/documents/${doc.id}/sensitive?sensitive=${next}`, { method: "PATCH" });
      if (res.ok) {
        const body = await res.json();
        const eff = !!body.effective_sensitive;
        setSensitive(eff);
        if (doc) doc.effective_sensitive = eff;
        if (eff) { setPreviewState("locked"); }
        else { loadPreview(); }
      }
    } finally { setSensBusy(false); }
  }

  function handleDownload() {
    authFetch(`/api/documents/${doc.id}/file?download=true`, { cache: "no-store" })
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
      return { key: f.key, label: f.label, value: f.money ? fmtFull(raw) : raw };
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
        <div style={{ display: "flex", gap: "8px", flexShrink: 0, position: "relative" }}>
            {!doc.effective_sensitive && (
              <button data-share-toggle onClick={() => setShareOpen((v) => !v)} title="Share access" style={{ ...iconBtn(true), color: shareOpen ? T.accent.bright : T.text.secondary, borderColor: shareOpen ? "rgba(124,92,255,0.35)" : undefined, background: shareOpen ? "rgba(124,92,255,0.12)" : "rgba(255,255,255,0.03)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
              </button>
            )}
            {shareOpen && <ShareDialog doc={doc} onClose={() => setShareOpen(false)} />}
          <button onClick={toggleSensitive} disabled={sensBusy} title={sensitive ? "Marked sensitive — click to unmark" : "Mark as sensitive"} style={{ ...iconBtn(true), color: sensitive ? T.semantic.error : T.text.muted, borderColor: sensitive ? "rgba(248,81,73,0.25)" : undefined }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill={sensitive ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          </button>
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
        {previewState === "locked" && (
          <div style={{ textAlign: "center", maxWidth: "300px" }}>
            <div style={{ fontSize: "13px", color: T.text.secondary, marginBottom: "4px" }}>Sensitive document</div>
            <div style={{ fontSize: "11px", fontFamily: T.font.mono, color: T.text.faint, lineHeight: 1.5, marginBottom: "12px" }}>Re-enter your password to view this document.</div>
            <input
              type="password"
              value={reauthPwd}
              onChange={(e) => setReauthPwd(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && reauthPwd && !reauthBusy) handleReauth(); }}
              placeholder="Password"
              autoFocus
              style={{ width: "100%", padding: "8px 10px", fontSize: "13px", fontFamily: T.font.mono, color: T.text.primary, background: T.bg.base, border: T.border.hairline, borderRadius: "8px", outline: "none", marginBottom: "8px" }}
            />
            {reauthErr && <div style={{ fontSize: "11px", fontFamily: T.font.mono, color: T.semantic.error, marginBottom: "8px" }}>{reauthErr}</div>}
            <button
              onClick={handleReauth}
              disabled={!reauthPwd || reauthBusy}
              style={{ width: "100%", padding: "8px 10px", fontSize: "12px", fontFamily: T.font.mono, color: T.text.primary, background: (!reauthPwd || reauthBusy) ? T.bg.panel : T.accent.violet, border: "none", borderRadius: "8px", cursor: (!reauthPwd || reauthBusy) ? "default" : "pointer" }}
            >
              {reauthBusy ? "Verifying…" : "Unlock"}
            </button>
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

        {/* Security facts — honest, real states only */}
        <div style={{ background: T.card, border: T.border.hairline, borderRadius: "10px", padding: "14px 16px", marginBottom: "18px" }}>
          <div style={{ fontSize: "10px", fontFamily: T.font.mono, letterSpacing: "0.1em", color: T.text.faint, textTransform: "uppercase", marginBottom: "12px" }}>Security</div>
          {[
            doc.is_encrypted && { label: "Encrypted at rest", value: "AES-256-GCM", ok: true },
            doc.is_encrypted && { label: "Storage region", value: "Asia Pacific", ok: true },
            doc.is_encrypted === false && { label: "Stored file", value: "Not stored", ok: false },
            doc.effective_sensitive && { label: "Access", value: "Re-auth required", ok: true },
            doc.sha256 && { label: "Integrity", value: "SHA-256 " + doc.sha256.slice(0, 12) + "\u2026", ok: true },
            { label: "Uploaded", value: doc.created_at ? new Date(doc.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—", ok: null },
          ].filter(Boolean).map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "5px 0" }}>
              <span style={{ fontSize: "11px", color: T.text.muted }}>{row.label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontFamily: T.font.mono, color: row.ok === false ? T.text.faint : T.text.secondary }}>
                {row.ok === true && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: T.semantic.success, flexShrink: 0 }} />}
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Toggle */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
          <button onClick={() => setTab("fields")} style={segBtn(tab === "fields")}>Fields</button>
          <button onClick={() => setTab("raw")} style={segBtn(tab === "raw")} title={rawText ? "" : "No extracted text on this document"}>Raw text</button>
          <button onClick={() => setTab("activity")} style={segBtn(tab === "activity")}>Activity</button>
        </div>

        {tab === "fields" ? (
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
                <span style={{ fontSize: "11px", color: T.text.muted, display: "inline-flex", alignItems: "center" }}>{f.label}<FieldBadge doc={doc} fieldKey={f.key} /></span>
                <span style={{ fontSize: "12px", fontFamily: T.font.mono, color: T.text.secondary, textAlign: "right", wordBreak: "break-all" }}>{f.value}</span>
              </div>
            ))}
            {visibleFields.length === 0 && !brand && (
              <div style={{ fontSize: "12px", color: T.text.faint, fontFamily: T.font.mono }}>No fields extracted.</div>
            )}
            <div style={{ marginTop: "4px", fontSize: "9px", fontFamily: T.font.mono, letterSpacing: "0.08em", color: T.text.faint, textTransform: "uppercase" }}>Extracted by AI</div>
          </div>
        ) : tab === "raw" ? (
          <div key="raw" className="cv-fade" style={{ fontSize: "11px", fontFamily: T.font.mono, color: T.text.secondary, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6 }}>
            {rawText || <span style={{ color: T.text.faint }}>No extracted text stored for this document.</span>}
          </div>
        ) : (
          <div key="activity" className="cv-fade" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {activityBusy && <span style={{ fontSize: "12px", fontFamily: T.font.mono, color: T.text.muted }}>Loading activity…</span>}
            {!activityBusy && activity && activity.length === 0 && (
              <span style={{ fontSize: "12px", fontFamily: T.font.mono, color: T.text.faint }}>No activity recorded yet.</span>
            )}
            {!activityBusy && activity && groupActivity(activity).map((e) => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "baseline" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0, background: EVENT_META[e.event_type]?.color || T.text.faint }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontSize: "12px", color: T.text.primary, display: "block" }}>
                      {EVENT_META[e.event_type]?.label || e.event_type}
                      {e.count > 1 && <span style={{ fontSize: "10px", fontFamily: T.font.mono, color: T.text.faint, marginLeft: "6px" }}>×{e.count}</span>}
                    </span>
                    {e.device && <span style={{ fontSize: "10px", fontFamily: T.font.mono, color: T.text.faint, display: "block", marginTop: "2px" }}>{friendlyDevice(e.device)}</span>}
                  </span>
                </span>
                <span style={{ fontSize: "11px", fontFamily: T.font.mono, color: T.text.muted, whiteSpace: "nowrap" }}>{fmtWhen(e.created_at)}</span>
              </div>
            ))}
            <div style={{ marginTop: "4px", fontSize: "9px", fontFamily: T.font.mono, letterSpacing: "0.08em", color: T.text.faint, textTransform: "uppercase" }}>Access log · this device & IP recorded</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ Share dialog ============================ */

function ShareDialog({ doc, onClose }) {
  const { authFetch } = useAuth();
  const ref = useRef(null);
  const [email, setEmail] = useState("");
  const [expiryDays, setExpiryDays] = useState(30); // 0 = never
  const [shares, setShares] = useState(null); // null=loading, []=none, [...]
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const loadShares = useCallback(() => {
    authFetch(`/api/documents/${doc.id}/shares`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setShares(Array.isArray(rows) ? rows : []))
      .catch(() => setShares([]));
  }, [doc.id, authFetch]);

  useEffect(() => { loadShares(); }, [loadShares]);

  async function submitShare() {
    if (!emailValid || submitting) return;
    setSubmitting(true); setErr("");
    try {
      const body = {
        recipient_email: email.trim().toLowerCase(),
        permission: "VIEW",
        expires_in_days: expiryDays > 0 ? expiryDays : null, // null = never
      };
      const res = await authFetch(`/api/documents/${doc.id}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) { setEmail(""); loadShares(); }
      else {
        const b = await res.json().catch(() => ({}));
        setErr(typeof b.detail === "string" ? b.detail : "Could not share.");
      }
    } catch { setErr("Could not share."); }
    finally { setSubmitting(false); }
  }

  async function revokeShare(id) {
    const res = await authFetch(`/api/documents/${doc.id}/shares/${id}`, { method: "DELETE" });
    if (res.ok) loadShares();
  }

  // close on outside click + ESC
  useEffect(() => {
    function onDocClick(e) {
      if (e.target.closest && e.target.closest("[data-share-toggle]")) return; // let the button's own handler toggle
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function onEsc(e) { if (e.key === "Escape") onClose(); }
    // defer click binding so the opening click doesn't immediately close it
    const t = setTimeout(() => document.addEventListener("mousedown", onDocClick), 0);
    document.addEventListener("keydown", onEsc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="cv-fade"
      style={{
        position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 50,
        width: "320px", background: T.bg.panel, border: T.border.strong,
        borderRadius: "12px", boxShadow: "0 12px 40px rgba(0,0,0,0.5)", padding: "16px",
      }}
    >
      <div style={{ fontSize: "10px", fontFamily: T.font.mono, letterSpacing: "0.1em", color: T.text.faint, textTransform: "uppercase", marginBottom: "12px" }}>
        Share access
      </div>

      {/* email input */}
      <input
        type="email"
        placeholder="person@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
        style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: "13px", fontFamily: T.font.mono, color: T.text.primary, background: T.bg.base, border: T.border.hairline, borderRadius: "8px", outline: "none", marginBottom: "12px" }}
      />

      {/* permission */}
      <div style={{ fontSize: "10px", fontFamily: T.font.mono, letterSpacing: "0.08em", color: T.text.faint, textTransform: "uppercase", marginBottom: "6px" }}>Permission</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: "7px", background: "rgba(124,92,255,0.12)", border: "1px solid rgba(124,92,255,0.35)" }}>
          <span style={{ fontSize: "12px", color: T.accent.bright }}>View</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.accent.bright} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        {["Comment", "Download"].map((p) => (
          <div key={p} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: "7px", border: T.border.hairline, opacity: 0.5 }}>
            <span style={{ fontSize: "12px", color: T.text.muted }}>{p}</span>
            <span style={{ fontSize: "9px", fontFamily: T.font.mono, letterSpacing: "0.05em", color: T.text.faint, textTransform: "uppercase" }}>Coming soon</span>
          </div>
        ))}
      </div>

      {/* expiry */}
      <div style={{ fontSize: "10px", fontFamily: T.font.mono, letterSpacing: "0.08em", color: T.text.faint, textTransform: "uppercase", marginBottom: "6px" }}>Expires</div>
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
        {[{ label: "7 days", v: 7 }, { label: "30 days", v: 30 }, { label: "Never", v: 0 }].map((o) => {
          const on = expiryDays === o.v;
          return (
            <div key={o.v} onClick={() => setExpiryDays(o.v)} style={{ flex: 1, textAlign: "center", padding: "7px 0", borderRadius: "7px", fontSize: "11px", fontFamily: T.font.mono, cursor: "pointer", background: on ? "rgba(124,92,255,0.12)" : "transparent", border: on ? "1px solid rgba(124,92,255,0.35)" : T.border.hairline, color: on ? T.accent.bright : T.text.muted }}>
              {o.label}
            </div>
          );
        })}
      </div>

      <button
        disabled={!emailValid}
        onClick={submitShare}
        style={{ width: "100%", padding: "9px 0", fontSize: "12px", fontFamily: T.font.mono, color: T.text.primary, background: emailValid ? T.accent.violet : T.bg.base, border: emailValid ? "none" : T.border.hairline, borderRadius: "8px", cursor: emailValid ? "pointer" : "default" }}
      >
        {submitting ? "Sharing\u2026" : "Share"}
      </button>
      {err && <div style={{ marginTop: "8px", fontSize: "11px", fontFamily: T.font.mono, color: T.semantic.error }}>{err}</div>}

      <div style={{ marginTop: "16px", fontSize: "10px", fontFamily: T.font.mono, letterSpacing: "0.1em", color: T.text.faint, textTransform: "uppercase", marginBottom: "8px" }}>
        Shared with
      </div>
      {shares === null ? (
        <div style={{ fontSize: "11px", fontFamily: T.font.mono, color: T.text.faint }}>Loading\u2026</div>
      ) : shares.length === 0 ? (
        <div style={{ fontSize: "11px", fontFamily: T.font.mono, color: T.text.faint }}>No one yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {shares.map((sh) => {
            const st = (sh.status || "").toLowerCase();
            const pill = st === "active"
              ? { bg: "rgba(63,185,80,0.14)", bd: T.semantic.success + "40", fg: T.semantic.success, label: "Active" }
              : st === "expired"
              ? { bg: "rgba(210,153,34,0.14)", bd: T.semantic.warning + "40", fg: T.semantic.warning, label: "Expired" }
              : { bg: "rgba(255,255,255,0.04)", bd: "rgba(255,255,255,0.1)", fg: T.text.faint, label: "Revoked" };
            return (
              <div key={sh.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontFamily: T.font.mono, color: T.text.secondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sh.recipient_email}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                    <span style={{ fontSize: "9px", fontFamily: T.font.mono, letterSpacing: "0.04em", textTransform: "uppercase", padding: "1px 6px", borderRadius: "4px", background: pill.bg, border: `1px solid ${pill.bd}`, color: pill.fg }}>{pill.label}</span>
                    <span style={{ fontSize: "9px", fontFamily: T.font.mono, color: T.text.faint }}>{sh.expires_at ? "exp " + new Date(sh.expires_at.endsWith("Z") ? sh.expires_at : sh.expires_at + "Z").toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "no expiry"}</span>
                  </div>
                </div>
                {st === "active" && (
                  <button onClick={() => revokeShare(sh.id)} title="Revoke access" style={{ flexShrink: 0, fontSize: "10px", fontFamily: T.font.mono, color: T.semantic.error, background: "transparent", border: `1px solid ${T.semantic.error}40`, borderRadius: "6px", padding: "4px 8px", cursor: "pointer" }}>Revoke</button>
                )}
              </div>
            );
          })}
        </div>
      )}
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
                      <span style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
                        {d.effective_sensitive && (
                          <span title="Sensitive document" style={{ flexShrink: 0, fontSize: "9px", fontFamily: T.font.mono, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 6px", borderRadius: "4px", border: `1px solid ${T.semantic.error}40`, background: `${T.semantic.error}14`, color: T.semantic.error }}>Sensitive</span>
                        )}
                        <span style={{ fontSize: "13px", fontWeight: 500, color: T.text.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brand || d.filename}</span>
                      </span>
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
