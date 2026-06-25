import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth.jsx";

const T = {
  bg: { base: "#07080A", panel: "#0D0E11" },
  card: "linear-gradient(180deg, #17181C 0%, #121317 100%)",
  border: { hairline: "1px solid rgba(255,255,255,0.07)", strong: "1px solid rgba(255,255,255,0.14)" },
  text: { primary: "#F5F6F7", secondary: "#BDC1C8", muted: "#858992", faint: "#5B5F66" },
  accent: { violet: "#7C5CFF", bright: "#9B82FF" },
  semantic: { success: "#3FB950", warning: "#D29922", error: "#F85149", info: "#58A6FF" },
  font: { sans: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" },
};

function fmtWhen(iso) {
  if (!iso) return null;
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  if (isNaN(d)) return null;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SharedWithMe() {
  const { authFetch } = useAuth();
  const [shares, setShares] = useState(null); // null=loading, []=empty, [...]
  const [openingId, setOpeningId] = useState(null);

  async function openShare(sh) {
    if (openingId) return;
    setOpeningId(sh.share_id);
    try {
      const res = await authFetch(`/api/shared/${sh.share_id}/file`, { cache: "no-store" });
      if (!res.ok) { setShares((prev) => prev); return; } // gate failure -> silently no-op (404)
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      // revoke after the new tab has had time to load the blob
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { /* no-op */ }
    finally { setOpeningId(null); }
  }

  useEffect(() => {
    let alive = true;
    authFetch("/api/shared", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => { if (alive) setShares(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (alive) setShares([]); });
    return () => { alive = false; };
  }, [authFetch]);

  return (
    <div style={{ minHeight: "100vh", background: T.bg.base, fontFamily: T.font.sans, color: T.text.primary }}>
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ fontSize: "10px", fontFamily: T.font.mono, letterSpacing: "0.12em", color: T.text.faint, textTransform: "uppercase", marginBottom: "6px" }}>Inbox</div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.01em" }}>Shared with me</h1>
        <div style={{ fontSize: "12px", fontFamily: T.font.mono, color: T.text.muted, marginBottom: "28px" }}>
          Documents others have shared with you · view-only
        </div>

        {shares === null ? (
          <div style={{ fontSize: "12px", fontFamily: T.font.mono, color: T.text.muted }}>Loading…</div>
        ) : shares.length === 0 ? (
          <div style={{ background: T.card, border: T.border.hairline, borderRadius: "12px", padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "14px", color: T.text.secondary, marginBottom: "6px" }}>Nothing shared with you yet.</div>
            <div style={{ fontSize: "12px", fontFamily: T.font.mono, color: T.text.muted }}>When someone shares a document with your email, it lands here.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {shares.map((sh) => {
              const exp = fmtWhen(sh.expires_at);
              const when = fmtWhen(sh.shared_at);
              return (
                <div key={sh.share_id} onClick={() => openShare(sh)} title="Open (view-only)" style={{ background: T.card, border: T.border.hairline, borderRadius: "10px", padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", cursor: openingId ? "wait" : "pointer", opacity: openingId && openingId !== sh.share_id ? 0.5 : 1 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: T.text.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: "5px" }}>{sh.filename || "Untitled"}</div>
                    <div style={{ fontSize: "11px", fontFamily: T.font.mono, color: T.text.muted }}>
                      {when ? `Shared ${when}` : "Shared"}{exp ? ` · expires ${exp}` : " · no expiry"}
                    </div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: "9px", fontFamily: T.font.mono, letterSpacing: "0.05em", textTransform: "uppercase", padding: "3px 8px", borderRadius: "5px", border: T.border.hairline, color: T.text.faint }}>{openingId === sh.share_id ? "Opening\u2026" : "View only"}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
