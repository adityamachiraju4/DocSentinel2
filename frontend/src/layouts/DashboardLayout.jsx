import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const T = {
  bg: { base: "#07080A", panel: "#0D0E11" },
  border: {
    hairline: "1px solid rgba(255,255,255,0.07)",
    strong: "1px solid rgba(255,255,255,0.14)",
  },
  text: { primary: "#F5F6F7", secondary: "#BDC1C8", muted: "#858992", faint: "#5B5F66" },
  accent: { violet: "#7C5CFF", bright: "#9B82FF" },
  semantic: { success: "#3FB950" },
  font: { sans: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace" },
};

const NAV_ITEMS = [
  { label: "Dashboard", to: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { label: "Vault", to: "/vault", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
  { label: "Shared with me", to: "/shared", icon: "M15 8a3 3 0 100-6 3 3 0 000 6zM9 12a3 3 0 100-6 3 3 0 000 6zM15 22a3 3 0 100-6 3 3 0 000 6zM6.7 10.7l4.6 2.6M11.3 9.7l-4.6-2.6" },
  { label: "Settings", to: "/settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  { label: "Trash", to: "/trash", icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" },
];

// Monochrome icon paths keyed by collection slug (lucide-style strokes).
const COLLECTION_ICONS = {
  invoices:  "M9 14l2-2 4 4m0-3V3M1 21h22",
  receipts:  "M9 12h6m-6 4h4m4 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  contracts: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  tax:       "M3 21h18M5 21V7l8-4v18M19 21V11l-6-4",
  hr:        "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  banking:   "M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11m16-11v11M8 14v3m4-3v3m4-3v3",
  other:     "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z",
};
const FALLBACK_ICON = COLLECTION_ICONS.other;

export default function DashboardLayout() {
  const { user, logout, authFetch } = useAuth();
  const navigate = useNavigate();
  const [collections, setCollections] = useState([]);

  useEffect(() => {
    authFetch(`/api/collections/`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCollections(Array.isArray(data) ? data : []))
      .catch(() => setCollections([]));
  }, []);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const email = user?.email || "";
  const initials = (email ? email[0] : "D").toUpperCase() + (email.includes("@") ? email.split("@")[0].slice(-1).toUpperCase() : "S");

  const navItemStyle = ({ isActive }) => ({
    display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "10px 14px",
    borderRadius: "6px",
    backgroundColor: isActive ? "rgba(124,92,255,0.08)" : "transparent",
    color: isActive ? T.accent.bright : T.text.secondary,
    fontSize: "13px", fontWeight: isActive ? 600 : 400, fontFamily: T.font.sans,
  });

  return (
    <div style={{
      display: "flex", minHeight: "100vh", backgroundColor: T.bg.base,
      color: T.text.primary, fontFamily: T.font.sans, overflowX: "hidden",
    }}>
      <style>{`
        .ds-nav { transition: background-color 0.1s, color 0.1s; text-decoration: none; }
        .ds-nav:hover { background-color: rgba(255,255,255,0.03); color: ${T.text.primary} !important; }
        .ds-logout { transition: all 0.15s ease; }
        .ds-logout:hover { background-color: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.14) !important; color: ${T.text.primary} !important; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #07080A; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.16); }
      `}</style>

      {/* Sidebar */}
      <aside style={{
        width: "240px", flexShrink: 0, backgroundColor: T.bg.panel,
        borderRight: T.border.hairline, display: "flex", flexDirection: "column",
        position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 100,
      }}>
        <div style={{ padding: "24px 20px", borderBottom: T.border.hairline, display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "4px", background: T.accent.violet,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 15px rgba(124,92,255,0.4)",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 17L12 22L22 17" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12L12 17L22 12" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: "bold", letterSpacing: "0.15em", color: T.text.primary, fontFamily: T.font.mono }}>DOCSENTINEL</div>
            <div style={{ fontSize: "9px", color: T.text.muted, fontFamily: T.font.mono, letterSpacing: "0.05em" }}>BY PHREDSEC™</div>
          </div>
        </div>

        <nav style={{ flexGrow: 1, padding: "20px 12px", display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto" }}>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className="ds-nav" style={navItemStyle}>
              {({ isActive }) => (
                <>
                  <svg style={{
                    width: "16px", height: "16px",
                    stroke: isActive ? T.accent.bright : T.text.muted,
                    fill: "none", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round",
                  }} viewBox="0 0 24 24">
                    <path d={item.icon} />
                  </svg>
                  <span style={{ flexGrow: 1 }}>{item.label}</span>
                  {isActive && <div style={{ width: "4px", height: "4px", borderRadius: "50%", backgroundColor: T.accent.bright }} />}
                </>
              )}
            </NavLink>
          ))}

          {/* Collections section */}
          <div style={{
            padding: "16px 14px 8px", fontSize: "10px", fontFamily: T.font.mono,
            letterSpacing: "0.1em", color: T.text.faint, textTransform: "uppercase",
          }}>
            Collections
          </div>

          {collections.map((c) => {
            const icon = COLLECTION_ICONS[c.slug] || FALLBACK_ICON;
            return (
              <NavLink key={c.slug} to={`/collections/${c.slug}`} className="ds-nav" style={navItemStyle}>
                {({ isActive }) => (
                  <>
                    <svg style={{
                      width: "16px", height: "16px",
                      stroke: isActive ? T.accent.bright : T.text.muted,
                      fill: "none", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round",
                    }} viewBox="0 0 24 24">
                      <path d={icon} />
                    </svg>
                    <span style={{ flexGrow: 1 }}>{c.name}</span>
                    <span style={{
                      fontSize: "10px", fontFamily: T.font.mono,
                      color: isActive ? T.accent.bright : T.text.faint,
                      fontVariantNumeric: "tabular-nums",
                    }}>{c.count}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div style={{ padding: "16px", borderTop: T.border.hairline }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: T.semantic.success, display: "inline-block" }} />
            <span style={{ fontSize: "10px", fontFamily: T.font.mono, color: T.text.muted, letterSpacing: "0.05em" }}>AES-256 · ASIA PACIFIC</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: "240px", flexGrow: 1, minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
        <header style={{
          height: "56px", borderBottom: T.border.hairline, display: "flex", alignItems: "center",
          justifyContent: "flex-end", padding: "0 32px", position: "sticky", top: 0, zIndex: 90,
          backdropFilter: "blur(12px)", background: "rgba(13,14,17,0.85)", gap: "16px",
        }}>
          {email && (
            <span style={{ fontFamily: T.font.mono, fontSize: "11px", color: T.text.secondary }}>
              {email}
            </span>
          )}
          <div style={{
            width: "32px", height: "32px", borderRadius: "6px",
            background: "linear-gradient(135deg, #7C5CFF 0%, #9B82FF 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: "bold", fontSize: "11px", color: "#FFF", fontFamily: T.font.mono, border: T.border.strong,
          }}>{initials}</div>
          <button onClick={handleLogout} className="ds-logout" style={{
            backgroundColor: T.bg.panel, border: T.border.strong, color: T.text.secondary,
            borderRadius: "6px", padding: "6px 12px", fontSize: "11px", cursor: "pointer",
            fontFamily: T.font.mono, display: "flex", alignItems: "center", gap: "6px",
          }}>
            <svg style={{ width: "12px", height: "12px", fill: "none", stroke: "currentColor", strokeWidth: "2" }} viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Log out
          </button>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
