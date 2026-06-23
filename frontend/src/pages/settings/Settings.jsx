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
  const [remaining, setRemaining] = useState(null);
  const [loadErr, setLoadErr] = useState("");

  // enrollment state
  const [stage, setStage] = useState("idle"); // idle | enrolling | disabling | regenerating
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // recovery codes shown once (after confirm or regenerate)
  const [recoveryCodes, setRecoveryCodes] = useState(null);

  async function refreshStatus() {
    try {
      const res = await authFetch(`${API}/api/auth/me`);
      if (!res.ok) throw new Error("status " + res.status);
      const data = await res.json();
      setEnabled(!!data.totp_enabled);
      setRemaining(
        typeof data.recovery_codes_remaining === "number"
          ? data.recovery_codes_remaining
          : null
      );
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
      const data = await res.json().catch(() => ({}));
      setStage("idle"); setQr(""); setSecret(""); setCode("");
      setEnabled(true);
      if (Array.isArray(data.recovery_codes) && data.recovery_codes.length) {
        setRecoveryCodes(data.recovery_codes);
      }
      refreshStatus();
    } catch (e) {
      setErr(typeof e.message === "string" ? e.message : "Invalid code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function regenerateCodes() {
    if (code.length !== 6) return;
    setErr(""); setBusy(true);
    try {
      const res = await authFetch(`${API}/api/auth/2fa/recovery/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Invalid code");
      }
      const data = await res.json().catch(() => ({}));
      setStage("idle"); setCode("");
      if (Array.isArray(data.recovery_codes) && data.recovery_codes.length) {
        setRecoveryCodes(data.recovery_codes);
      }
      refreshStatus();
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
      setRemaining(null);
      setRecoveryCodes(null);
    } catch (e) {
      setErr(typeof e.message === "string" ? e.message : "Invalid code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function copyCodes() {
    if (!recoveryCodes) return;
    navigator.clipboard?.writeText(recoveryCodes.join("\n")).catch(() => {});
  }

  function downloadCodes() {
    if (!recoveryCodes) return;
    const blob = new Blob(
      ["DocSentinel recovery codes\nEach code works once. Store them somewhere safe.\n\n" + recoveryCodes.join("\n") + "\n"],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "docsentinel-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
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

      {/* Recovery codes card — only when 2FA is on */}
      {enabled === true && (
        <section style={{
          background: T.card, border: T.border.hairline, borderRadius: "10px",
          padding: "24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600, color: T.text.primary, margin: 0 }}>
              Recovery codes
            </h2>
            {remaining !== null && (
              <span style={{
                fontFamily: T.font.mono, fontSize: "10px", letterSpacing: "0.08em",
                padding: "3px 8px", borderRadius: "4px",
                color: remaining > 0 ? T.text.secondary : T.semantic.warning,
                border: `1px solid ${remaining > 0 ? "rgba(255,255,255,0.14)" : "rgba(210,153,34,0.4)"}`,
                backgroundColor: remaining > 0 ? "transparent" : "rgba(210,153,34,0.08)",
                fontVariantNumeric: "tabular-nums",
              }}>
                {remaining} REMAINING
              </span>
            )}
          </div>
          <p style={{ fontSize: "13px", color: T.text.secondary, lineHeight: 1.5, margin: "0 0 18px" }}>
            Single-use codes to sign in if you lose access to your authenticator. Each works once.
          </p>

          {/* Freshly minted codes — shown once */}
          {recoveryCodes && (
            <div style={{
              background: T.bg.base, border: `1px solid rgba(210,153,34,0.4)`,
              borderRadius: "8px", padding: "16px", marginBottom: "18px",
            }}>
              <div style={{ fontSize: "11px", fontFamily: T.font.mono, color: T.semantic.warning, letterSpacing: "0.06em", marginBottom: "12px" }}>
                SAVE THESE NOW — THEY WON'T BE SHOWN AGAIN
              </div>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "8px 16px", marginBottom: "14px",
              }}>
                {recoveryCodes.map((c) => (
                  <code key={c} style={{
                    fontFamily: T.font.mono, fontSize: "14px", color: T.text.primary,
                    letterSpacing: "0.1em", fontVariantNumeric: "tabular-nums",
                  }}>{c}</code>
                ))}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={copyCodes} style={btnGhost}>Copy</button>
                <button onClick={downloadCodes} style={btnGhost}>Download .txt</button>
                <button onClick={() => setRecoveryCodes(null)} style={btnPrimary(false)}>I've saved them</button>
              </div>
            </div>
          )}

          {/* Regenerate flow */}
          {!recoveryCodes && stage !== "regenerating" && (
            <button onClick={() => { setStage("regenerating"); setErr(""); setCode(""); }} style={btnGhost}>
              Regenerate recovery codes
            </button>
          )}

          {stage === "regenerating" && (
            <div>
              <p style={{ fontSize: "13px", color: T.text.secondary, margin: "0 0 12px" }}>
                This invalidates your existing codes. Enter a current 6-digit code to confirm.
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
                <button onClick={regenerateCodes} disabled={busy || code.length !== 6} style={btnPrimary(busy || code.length !== 6)}>
                  {busy ? "Generating…" : "Regenerate"}
                </button>
                <button onClick={cancelEnroll} disabled={busy} style={btnGhost}>Cancel</button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
