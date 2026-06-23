import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const T = {
  bg: { base: "#07080A", panel: "#0D0E11" },
  card: "linear-gradient(180deg, #17181C 0%, #121317 100%)",
  border: {
    hairline: "1px solid rgba(255,255,255,0.07)",
    strong: "1px solid rgba(255,255,255,0.14)",
  },
  text: { primary: "#F5F6F7", secondary: "#BDC1C8", muted: "#858992", faint: "#5B5F66" },
  accent: { violet: "#7C5CFF", bright: "#9B82FF" },
  semantic: { success: "#3FB950", warning: "#D29922", error: "#F85149", info: "#58A6FF" },
  font: { sans: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" },
};

export default function Settings() {
  const { user, authFetch } = useAuth();

  const [enabled, setEnabled] = useState(null); // null = loading
  const [loadErr, setLoadErr] = useState("");

  // enrollment state
  const [stage, setStage] = useState("idle"); // idle | enrolling | disabling
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function refreshStatus() {
    try {
      const res = await authFetch(`${API}/api/auth/me`);
      if (!res.ok) throw new Error("status " + res.status);
      const data = await res.json();
      setEnabled(!!data.totp_enabled);
    } catch (e) {
      setLoadErr("Could not load security status.");
    }
  }

  useEffect(() => { refreshStatus(); }, []);

  async function startEnroll() {
    setErr(""); setCode(""); setBusy(true);
    try {
      const res = await authFetch(`${API}/api/auth/2fa/setup`, { method: "POST" });
      if (!res.ok) throw new Error("setup failed");
      const data = await res.json();
      setQr(data.qr_data_uri || data.qr || "");
      setSecret(data.secret || "");
      setStage("enrolling");
    } catch (e) {
      setErr("Could not start enrollment. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll() {
    if (code.length !== 6) return;
    setErr(""); setBusy(true);
    try {
      const res = await authFetch(`${API}/api/auth/2fa/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Invalid code");
      }
      setStage("idle"); setQr(""); setSecret(""); setCode("");
      setEnabled(true);
    } catch (e) {
      setErr(typeof e.message === "string" ? e.message : "Invalid code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function cancelEnroll() {
    setStage("idle"); setQr(""); setSecret(""); setCode(""); setErr("");
  }

  async function disable2fa() {
    if (code.length !== 6) return;
    setErr(""); setBusy(true);
    try {
      const res = await authFetch(`${API}/api/auth/2fa/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Invalid code");
      }
      setStage("idle"); setCode("");
      setEnabled(false);
    } catch (e) {
      setErr(typeof e.message === "string" ? e.message : "Invalid code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const codeInputStyle = {
    width: "100%", maxWidth: "200px", padding: "10px 14px",
    backgroundColor: T.bg.base, border: T.border.strong, borderRadius: "6px",
    color: T.text.primary, fontFamily: T.font.mono, fontSize: "18px",
    letterSpacing: "0.3em", textAlign: "center", outline: "none",
    fontVariantNumeric: "tabular-nums",
  };

  const btnPrimary = (disabled) => ({
    padding: "9px 18px", borderRadius: "6px", border: "none",
    background: disabled ? "rgba(124,92,255,0.3)" : "linear-gradient(135deg, #7C5CFF 0%, #9B82FF 100%)",
    color: "#FFF", fontFamily: T.font.sans, fontSize: "13px", fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  const btnGhost = {
    padding: "9px 18px", borderRadius: "6px", border: T.border.strong,
    background: "transparent", color: T.text.secondary,
    fontFamily: T.font.sans, fontSize: "13px", cursor: "pointer",
  };

  return (
    <div style={{ padding: "32px", maxWidth: "760px", fontFamily: T.font.sans }}>
      <h1 style={{ fontSize: "22px", fontWeight: 700, color: T.text.primary, margin: "0 0 4px" }}>Settings</h1>
      <p style={{ fontSize: "13px", color: T.text.muted, margin: "0 0 28px", fontFamily: T.font.mono }}>
        {user?.email}
      </p>

      {/* Security card */}
      <section style={{
        background: T.card, border: T.border.hairline, borderRadius: "10px",
        padding: "24px", marginBottom: "20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: T.text.primary, margin: 0 }}>
            Two-factor authentication
          </h2>
          {enabled !== null && (
            <span style={{
              fontFamily: T.font.mono, fontSize: "10px", letterSpacing: "0.08em",
              padding: "3px 8px", borderRadius: "4px",
              color: enabled ? T.semantic.success : T.text.muted,
              border: `1px solid ${enabled ? "rgba(63,185,80,0.4)" : "rgba(255,255,255,0.14)"}`,
              backgroundColor: enabled ? "rgba(63,185,80,0.08)" : "transparent",
            }}>
              {enabled ? "ENABLED" : "DISABLED"}
            </span>
          )}
        </div>
        <p style={{ fontSize: "13px", color: T.text.secondary, lineHeight: 1.5, margin: "0 0 18px" }}>
          Add a time-based one-time code from an authenticator app to your login.
        </p>

        {loadErr && <div style={{ color: T.semantic.error, fontSize: "12px", fontFamily: T.font.mono }}>{loadErr}</div>}

        {/* IDLE */}
        {stage === "idle" && enabled !== null && (
          enabled ? (
            <button onClick={() => { setStage("disabling"); setErr(""); setCode(""); }} style={btnGhost}>
              Disable 2FA
            </button>
          ) : (
            <button onClick={startEnroll} disabled={busy} style={btnPrimary(busy)}>
              {busy ? "Starting…" : "Enable 2FA"}
            </button>
          )
        )}

        {/* ENROLLING */}
        {stage === "enrolling" && (
          <div>
            <p style={{ fontSize: "13px", color: T.text.secondary, margin: "0 0 14px" }}>
              Scan this QR code in your authenticator app, or enter the key manually.
            </p>
            {qr && (
              <img src={qr} alt="2FA QR code" width="180" height="180" style={{
                borderRadius: "8px", border: T.border.strong, background: "#FFF", padding: "8px", display: "block", marginBottom: "14px",
              }} />
            )}
            {secret && (
              <div style={{ marginBottom: "18px" }}>
                <div style={{ fontSize: "10px", fontFamily: T.font.mono, color: T.text.faint, letterSpacing: "0.08em", marginBottom: "4px" }}>
                  MANUAL ENTRY KEY
                </div>
                <code style={{
                  fontFamily: T.font.mono, fontSize: "13px", color: T.text.primary,
                  background: T.bg.base, border: T.border.hairline, borderRadius: "6px",
                  padding: "8px 12px", display: "inline-block", letterSpacing: "0.1em", wordBreak: "break-all",
                }}>{secret}</code>
              </div>
            )}
            <div style={{ fontSize: "12px", color: T.text.muted, marginBottom: "8px" }}>Enter the 6-digit code:</div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              style={codeInputStyle}
            />
            {err && <div style={{ color: T.semantic.error, fontSize: "12px", fontFamily: T.font.mono, margin: "10px 0 0" }}>{err}</div>}
            <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
              <button onClick={confirmEnroll} disabled={busy || code.length !== 6} style={btnPrimary(busy || code.length !== 6)}>
                {busy ? "Verifying…" : "Verify & enable"}
              </button>
              <button onClick={cancelEnroll} disabled={busy} style={btnGhost}>Cancel</button>
            </div>
          </div>
        )}

        {/* DISABLING */}
        {stage === "disabling" && (
          <div>
            <p style={{ fontSize: "13px", color: T.text.secondary, margin: "0 0 12px" }}>
              Enter a current 6-digit code to confirm disabling 2FA.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              style={codeInputStyle}
            />
            {err && <div style={{ color: T.semantic.error, fontSize: "12px", fontFamily: T.font.mono, margin: "10px 0 0" }}>{err}</div>}
            <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
              <button onClick={disable2fa} disabled={busy || code.length !== 6} style={{
                ...btnPrimary(busy || code.length !== 6),
                background: (busy || code.length !== 6) ? "rgba(248,81,73,0.3)" : T.semantic.error,
              }}>
                {busy ? "Disabling…" : "Disable 2FA"}
              </button>
              <button onClick={cancelEnroll} disabled={busy} style={btnGhost}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
