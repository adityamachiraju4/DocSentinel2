import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

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

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const typeColors = [T.accent.violet, T.semantic.info, T.semantic.success, T.semantic.warning, T.text.muted];

function formatINR(value) {
  if (!value) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}
function formatSize(kb) {
  if (!kb && kb !== 0) return "—";
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}
function statusStyle(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("process") || s.includes("complete") || s.includes("done") || s.includes("success")) return { bg: "rgba(63,185,80,0.08)", color: T.semantic.success, border: T.border.success };
  if (s.includes("valid")) return { bg: "rgba(88,166,255,0.08)", color: T.semantic.info, border: T.border.info };
  if (s.includes("pending") || s.includes("queue") || s.includes("processing")) return { bg: "rgba(210,153,34,0.08)", color: T.semantic.warning, border: T.border.warning };
  if (s.includes("fail") || s.includes("error")) return { bg: "rgba(248,81,73,0.08)", color: T.semantic.error, border: T.border.error };
  return { bg: "rgba(255,255,255,0.05)", color: T.text.muted, border: T.border.hairline };
}
function typePillStyle(type) {
  const s = (type || "").toLowerCase();
  if (s === "invoice" || s === "bill") return { backgroundColor: "rgba(124,92,255,0.08)", color: T.accent.bright, border: T.border.violet };
  if (s.includes("gst")) return { backgroundColor: "rgba(88,166,255,0.08)", color: T.semantic.info, border: "1px solid rgba(88,166,255,0.2)" };
  if (s === "contract") return { backgroundColor: "rgba(210,153,34,0.08)", color: T.semantic.warning, border: "1px solid rgba(210,153,34,0.2)" };
  if (s === "receipt") return { backgroundColor: "rgba(63,185,80,0.08)", color: T.semantic.success, border: "1px solid rgba(63,185,80,0.2)" };
  return { backgroundColor: "rgba(255,255,255,0.05)", color: T.text.muted, border: T.border.hairline };
}

// ── Shared chrome label (mono uppercase eyebrow above titles) ──
function Chrome({ children }) {
  return (
    <span style={{ fontSize: "9px", fontFamily: T.font.mono, color: T.text.faint, letterSpacing: "0.12em", textTransform: "uppercase", display: "block" }}>
      {children}
    </span>
  );
}

function CustomTooltip({ active, payload, label, isAmount }) {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: T.bg.panel, border: T.border.strong, padding: "8px 12px", borderRadius: "6px", fontFamily: T.font.mono, fontSize: "11px", boxShadow: "0 8px 30px rgba(0,0,0,0.6)" }}>
        <p style={{ margin: 0, color: T.text.muted, textTransform: "uppercase", fontSize: "9px" }}>{label}</p>
        <p style={{ margin: "4px 0 0 0", color: T.text.primary, fontWeight: "bold" }}>
          {payload[0].name}: <span style={{ color: T.accent.bright }}>{isAmount ? formatINR(payload[0].value) : payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
}

function StatCard({ chrome, value, icon, iconColor, accent }) {
  return (
    <div className="ds-stat-card" style={{ background: T.bg.card, border: T.border.hairline, borderRadius: "10px", padding: "20px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "2px", background: `linear-gradient(90deg, ${accent} 0%, transparent 60%)`, opacity: 0.5 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
        <Chrome>{chrome}</Chrome>
        <span style={{ color: iconColor, display: "flex", width: "30px", height: "30px", borderRadius: "7px", border: T.border.hairline, alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.02)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{icon}</svg>
        </span>
      </div>
      <div className="tabular-nums" style={{ fontSize: "30px", fontWeight: 800, color: T.text.primary, letterSpacing: "-0.03em", lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function Panel({ chrome, title, right, children }) {
  return (
    <div style={{ background: T.bg.card, border: T.border.hairline, borderRadius: "10px", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: T.border.hairline, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          {chrome && <Chrome>{chrome}</Chrome>}
          <h3 style={{ fontSize: "13px", fontWeight: 600, margin: chrome ? "3px 0 0 0" : 0, color: T.text.primary }}>{title}</h3>
        </div>
        {right}
      </div>
      <div style={{ padding: "20px" }}>{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchStats() {
      try {
        const token = localStorage.getItem("token") || "";
        const res = await fetch(`${API}/api/documents/stats`, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        setStats(await res.json());
      } catch (err) {
        setError(err.message || "Could not load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1, color: T.text.primary, fontFamily: T.font.mono, gap: "12px" }}>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <div style={{ width: "32px", height: "32px", border: "2px solid rgba(255,255,255,0.05)", borderTopColor: T.accent.bright, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <span style={{ fontSize: "11px", color: T.text.secondary, letterSpacing: "0.05em" }}>LOADING…</span>
      </div>
    );
  }
  if (error || !stats) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1, color: T.semantic.error, fontFamily: T.font.mono, gap: "8px", padding: "32px", textAlign: "center" }}>
        <span style={{ fontSize: "13px" }}>Could not load dashboard data.</span>
        <span style={{ fontSize: "11px", color: T.text.muted }}>{error} — try logging in again.</span>
      </div>
    );
  }

  const docs = stats.recent_documents || [];
  const filteredDocuments = docs.filter((doc) => {
    const q = searchQuery.toLowerCase();
    return (doc.filename || "").toLowerCase().includes(q) || (doc.vendor_name || "").toLowerCase().includes(q) || (doc.document_type || "").toLowerCase().includes(q);
  });

  return (
    <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: "20px", fontFamily: T.font.sans }}>
      <style>{`
        .ds-stat-card { transition: border-color 0.15s, box-shadow 0.15s; }
        .ds-stat-card:hover { border-color: rgba(124,92,255,0.25) !important; box-shadow: 0 4px 24px rgba(124,92,255,0.04); }
        .tabular-nums { font-variant-numeric: tabular-nums; font-family: ${T.font.mono}; }
        .ds-row { transition: background-color 0.1s; }
        .ds-row:hover { background-color: rgba(255,255,255,0.015); }
      `}</style>

      {/* Heading */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: "4px", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <Chrome>Overview</Chrome>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "4px 0 0 0", color: T.text.primary, letterSpacing: "-0.03em" }}>Dashboard</h1>
          <p style={{ margin: "4px 0 0 0", color: T.text.secondary, fontSize: "13px" }}>Overview of your document activity and spending.</p>
        </div>
        <div style={{ position: "relative" }}>
          <input type="text" placeholder="Filter records…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{ backgroundColor: T.bg.panel, border: T.border.strong, color: T.text.primary, borderRadius: "6px", padding: "8px 12px 8px 32px", fontSize: "12px", width: "200px", outline: "none", fontFamily: T.font.mono }} />
          <svg style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "14px", height: "14px", stroke: T.text.muted, fill: "none", strokeWidth: "2" }} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <StatCard chrome="Total Documents" value={stats.total_documents} iconColor={T.accent.bright} accent={T.accent.violet}
          icon={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></>} />
        <StatCard chrome="Total Amount" value={formatINR(stats.total_amount)} iconColor={T.semantic.success} accent={T.semantic.success}
          icon={<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />} />
        <StatCard chrome="This Month" value={stats.docs_this_month} iconColor={T.semantic.info} accent={T.semantic.info}
          icon={<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>} />
        <StatCard chrome="Storage Used" value={formatSize(stats.storage_kb)} iconColor={T.accent.bright} accent={T.accent.violet}
          icon={<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />} />
      </div>

      {/* Two-column charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <Panel chrome="Time Series" title="Documents Uploaded by Month">
          <div style={{ width: "100%", height: "220px" }}>
            {(!stats.monthly_data || stats.monthly_data.length === 0) ? (
              <p style={{ color: T.text.faint, fontSize: "13px", fontFamily: T.font.mono }}>No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthly_data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" stroke={T.text.faint} fontSize={10} fontFamily={T.font.mono} tickLine={false} />
                  <YAxis stroke={T.text.faint} fontSize={10} fontFamily={T.font.mono} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
                  <Bar dataKey="count" name="Documents" fill={T.accent.violet} radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel chrome="Distribution" title="Document Types">
          <div style={{ width: "100%", height: "220px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {(!stats.type_data || stats.type_data.length === 0) ? (
              <p style={{ color: T.text.faint, fontSize: "13px", fontFamily: T.font.mono }}>No data yet.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={stats.type_data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="count" nameKey="type">
                      {stats.type_data.map((e, i) => (<Cell key={i} fill={typeColors[i % typeColors.length]} stroke={T.bg.panel} strokeWidth={2} />))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "16px", marginTop: "12px" }}>
                  {stats.type_data.map((item, idx) => (
                    <div key={item.type} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "2px", backgroundColor: typeColors[idx % typeColors.length], display: "inline-block" }} />
                      <span style={{ fontFamily: T.font.mono, fontSize: "10px", color: T.text.secondary }}>
                        {(item.type || "unknown").toUpperCase()}: <span className="tabular-nums" style={{ color: T.text.primary, fontWeight: "bold" }}>{item.count}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Panel>
      </div>

      {/* Vendor chart */}
      {stats.vendor_data && stats.vendor_data.length > 0 && (
        <Panel chrome="Spend Analysis" title="Amount by Vendor (₹)">
          <div style={{ width: "100%", height: "220px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.vendor_data} layout="vertical" margin={{ top: 10, right: 10, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" stroke={T.text.faint} fontSize={10} fontFamily={T.font.mono} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tickLine={false} />
                <YAxis type="category" dataKey="vendor" stroke={T.text.secondary} fontSize={10} fontFamily={T.font.mono} tickLine={false} axisLine={false} width={120} />
                <Tooltip content={<CustomTooltip isAmount />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
                <Bar dataKey="amount" name="Amount" fill={T.semantic.info} radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* Recent documents table */}
      <div style={{ backgroundColor: T.bg.panel, border: T.border.hairline, borderRadius: "10px", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: T.border.hairline, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Chrome>Activity</Chrome>
            <h3 style={{ fontSize: "13px", fontWeight: 600, margin: "3px 0 0 0", color: T.text.primary }}>Recent Documents</h3>
          </div>
          <span style={{ fontFamily: T.font.mono, fontSize: "11px", color: T.text.secondary }}>
            <span className="tabular-nums" style={{ fontWeight: "bold", color: T.accent.bright }}>{filteredDocuments.length}</span> shown
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
            <thead>
              <tr style={{ borderBottom: T.border.hairline, backgroundColor: "rgba(255,255,255,0.02)" }}>
                {["FILE", "TYPE", "VENDOR", "AMOUNT", "DATE", "STATUS"].map((h) => (
                  <th key={h} style={{ padding: "11px 20px", color: T.text.faint, fontFamily: T.font.mono, fontWeight: 500, fontSize: "10px", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.length > 0 ? filteredDocuments.map((doc) => {
                const st = statusStyle(doc.processing_status);
                return (
                  <tr key={doc.id} className="ds-row" style={{ borderBottom: T.border.hairline }}>
                    <td style={{ padding: "12px 20px", fontWeight: 500, color: T.text.primary }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ display: "flex", width: "26px", height: "26px", borderRadius: "6px", border: T.border.hairline, background: "rgba(255,255,255,0.02)", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg style={{ width: "13px", height: "13px", stroke: T.text.muted, fill: "none", strokeWidth: "2" }} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></svg>
                        </span>
                        <span>{doc.filename}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 20px" }}>
                      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", fontSize: "9px", fontFamily: T.font.mono, fontWeight: "bold", ...typePillStyle(doc.document_type) }}>{(doc.document_type || "unknown").toUpperCase()}</span>
                    </td>
                    <td style={{ padding: "12px 20px", color: T.text.secondary }}>{doc.vendor_name || "—"}</td>
                    <td className="tabular-nums" style={{ padding: "12px 20px", color: T.text.primary, fontWeight: 500 }}>{formatINR(doc.total_amount)}</td>
                    <td className="tabular-nums" style={{ padding: "12px 20px", color: T.text.secondary }}>{doc.invoice_date || "—"}</td>
                    <td style={{ padding: "12px 20px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "3px 10px", borderRadius: "4px", fontSize: "9px", fontFamily: T.font.mono, fontWeight: "bold", backgroundColor: st.bg, color: st.color, border: st.border }}>
                        <span style={{ width: "4px", height: "4px", borderRadius: "50%", backgroundColor: st.color }} />{(doc.processing_status || "unknown").toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="6" style={{ padding: "48px 20px", textAlign: "center", color: T.text.muted, fontFamily: T.font.mono, fontSize: "12px" }}>{docs.length === 0 ? "No documents yet." : "No matching records."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
