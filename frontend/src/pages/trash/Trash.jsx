// ─────────────────────────────────────────
// DocSentinel v2 — Trash / Recovery
// PhRedSec™ | pages/trash/Trash.jsx
// ─────────────────────────────────────────

import { useState, useEffect } from "react";
import { useAuth } from '../../hooks/useAuth.jsx';

const T = {
  bg: { base: "#07080A", panel: "#0D0E11", card: "linear-gradient(180deg, #17181C 0%, #121317 100%)" },
  border: {
    hairline: "1px solid rgba(255,255,255,0.07)",
    strong: "1px solid rgba(255,255,255,0.14)",
    success: "1px solid rgba(63,185,80,0.30)",
    warning: "1px solid rgba(210,153,34,0.30)",
    error: "1px solid rgba(248,81,73,0.30)",
    info: "1px solid rgba(88,166,255,0.30)",
    violet: "1px solid rgba(124,92,255,0.20)",
  },
  text: { primary: "#F5F6F7", secondary: "#BDC1C8", muted: "#858992", faint: "#5B5F66" },
  accent: { violet: "#7C5CFF", bright: "#9B82FF" },
  semantic: { success: "#3FB950", warning: "#D29922", error: "#F85149", info: "#58A6FF" },
  font: { sans: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" },
};

// Format an ISO timestamp to a compact, readable date. Returns "—" on missing/bad input.
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Render the recovery-window state for a row using the backend's real computed values.
// Never fabricates a countdown — reflects days_remaining / expired exactly as returned.
function windowStyle(expired) {
  return expired
    ? { bg: "rgba(248,81,73,0.08)", color: T.semantic.error, border: T.border.error }
    : { bg: "rgba(210,153,34,0.08)", color: T.semantic.warning, border: T.border.warning };
}

export default function Trash() {
  const { authFetch } = useAuth();
  const [items, setItems] = useState([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null); // row-level action lock

  useEffect(() => { fetchTrash(); }, []);

  async function fetchTrash() {
    setLoading(true);
    try {
      const res = await authFetch(`/api/documents/trash`);
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      setItems(data.items || []);
      if (typeof data.retention_days === "number") setRetentionDays(data.retention_days);
      setError(null);
    } catch (err) {
      setError("Failed to load trash.");
    } finally {
      setLoading(false);
    }
  }

  async function restoreDocument(id) {
    setBusyId(id);
    setError(null);
    try {
      const res = await authFetch(`/api/documents/${id}/restore`, { method: "POST" });
      if (res.status === 409) {
        // Recovery window elapsed — restore no longer possible; permanent delete remains available.
        setError("Recovery window has expired for that document. You can still delete it permanently.");
        return;
      }
      if (!res.ok) throw new Error("restore failed");
      fetchTrash();
    } catch (err) {
      setError("Failed to restore document.");
    } finally {
      setBusyId(null);
    }
  }

  async function purgeDocument(id, name) {
    if (!window.confirm(`Permanently delete "${name}"? This cannot be undone — the file and its contents are destroyed.`)) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await authFetch(`/api/documents/${id}/purge`, { method: "DELETE" });
      if (!res.ok) throw new Error("purge failed");
      fetchTrash();
    } catch (err) {
      setError("Failed to permanently delete document.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: "32px 40px", fontFamily: T.font.sans, color: T.text.primary, maxWidth: "1100px" }}>
      <style>{`
        .ds-restore:hover { color: ${T.semantic.success} !important; background-color: rgba(63,185,80,0.08) !important; border-color: rgba(63,185,80,0.30) !important; }
        .ds-purge:hover { color: ${T.semantic.error} !important; background-color: rgba(248,81,73,0.08) !important; border-color: rgba(248,81,73,0.30) !important; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: "8px", display: "flex", alignItems: "baseline", gap: "12px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>Trash</h1>
        <span style={{ fontFamily: T.font.mono, fontSize: "11px", color: T.text.faint, fontVariantNumeric: "tabular-nums" }}>
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      {/* Honest retention copy — no auto-sweep exists, so we never promise auto-deletion. */}
      <p style={{ fontSize: "13px", color: T.text.muted, margin: "0 0 24px", lineHeight: 1.5, maxWidth: "620px" }}>
        Deleted files are kept for at least {retentionDays} days; you can restore them within that window
        or delete them permanently anytime.
      </p>

      {error && (
        <div style={{ marginBottom: "16px", padding: "10px 14px", borderRadius: "8px", background: "rgba(248,81,73,0.08)", border: T.border.error, color: T.semantic.error, fontSize: "12px", fontFamily: T.font.mono }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: T.text.muted, fontSize: "13px", padding: "40px 0" }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: "48px 24px", textAlign: "center", background: T.bg.panel, border: T.border.hairline, borderRadius: "10px", color: T.text.muted, fontSize: "13px" }}>
          Trash is empty.
        </div>
      ) : (
        <div style={{ background: T.bg.panel, border: T.border.hairline, borderRadius: "10px", overflow: "hidden" }}>
          {/* Column header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 150px 200px", gap: "16px", padding: "12px 20px", borderBottom: T.border.hairline, background: "rgba(255,255,255,0.02)" }}>
            {["File", "Deleted", "Recovery", "Actions"].map((h) => (
              <span key={h} style={{ fontSize: "9px", fontFamily: T.font.mono, color: T.text.faint, letterSpacing: "0.12em", textTransform: "uppercase" }}>{h}</span>
            ))}
          </div>

          {items.map((doc) => {
            const ws = windowStyle(doc.expired);
            const busy = busyId === doc.id;
            return (
              <div key={doc.id} style={{ display: "grid", gridTemplateColumns: "1fr 130px 150px 200px", gap: "16px", padding: "14px 20px", borderBottom: T.border.hairline, alignItems: "center" }}>
                {/* File name */}
                <span style={{ fontSize: "13px", color: T.text.secondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={doc.original_filename}>
                  {doc.original_filename || "—"}
                </span>

                {/* Deleted date */}
                <span style={{ fontSize: "12px", color: T.text.muted, fontFamily: T.font.mono, fontVariantNumeric: "tabular-nums" }}>
                  {fmtDate(doc.deleted_at)}
                </span>

                {/* Recovery window — real computed values from backend */}
                <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: "5px", fontSize: "10px", fontFamily: T.font.mono, fontWeight: "bold", letterSpacing: "0.04em", backgroundColor: ws.bg, color: ws.color, border: ws.border, width: "fit-content", fontVariantNumeric: "tabular-nums" }}>
                  {doc.expired ? "EXPIRED" : `${doc.days_remaining}d LEFT`}
                </span>

                {/* Actions */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => restoreDocument(doc.id)}
                    disabled={busy || doc.expired}
                    className="ds-restore"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "none", border: T.border.hairline, color: doc.expired ? T.text.faint : T.text.muted, cursor: busy || doc.expired ? "default" : "pointer", opacity: busy ? 0.5 : 1, fontSize: "10px", fontWeight: "bold", padding: "5px 10px", borderRadius: "6px", fontFamily: T.font.mono, letterSpacing: "0.05em", transition: "all 0.1s" }}
                    title={doc.expired ? "Recovery window has expired" : "Restore this document"}
                  >
                    RESTORE
                  </button>
                  <button
                    onClick={() => purgeDocument(doc.id, doc.original_filename)}
                    disabled={busy}
                    className="ds-purge"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "none", border: T.border.hairline, color: T.text.muted, cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1, fontSize: "10px", fontWeight: "bold", padding: "5px 10px", borderRadius: "6px", fontFamily: T.font.mono, letterSpacing: "0.05em", transition: "all 0.1s" }}
                    title="Permanently delete — cannot be undone"
                  >
                    DELETE FOREVER
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
