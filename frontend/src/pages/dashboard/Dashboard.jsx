import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

// ── API base URL — reads from .env, falls back to localhost ───────────────
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Pie chart colours for document types ─────────────────────────────────
const PIE_COLORS = ["#2D6A4F", "#52B788", "#AEAEA8", "#6B6B64", "#1A1A18"];

// ── Helpers ───────────────────────────────────────────────────────────────

// Formats a number as Indian Rupees e.g. ₹6,483.00
function formatAmount(amount) {
  if (!amount) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
}

// Returns badge colours based on document type
function typeBadgeStyle(type) {
  const colors = {
    invoice:  { background: "#EAF4EE", color: "#2D6A4F" },
    bill:     { background: "#EAF4EE", color: "#2D6A4F" },
    receipt:  { background: "#FEF9C3", color: "#854D0E" },
    contract: { background: "#EDE9FE", color: "#5B21B6" },
    unknown:  { background: "#F3F4F6", color: "#6B7280" },
    other:    { background: "#F3F4F6", color: "#6B7280" },
  };
  return colors[type] || colors.other;
}

// ── Stat card component ───────────────────────────────────────────────────
// Renders a single summary card at the top of the dashboard.
// Props: label (string), value (string), icon (emoji)
function StatCard({ label, value, icon }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid rgba(26,26,24,0.10)",
      borderRadius: "16px",
      padding: "24px",
      flex: 1,
      minWidth: "180px",
    }}>
      {/* Icon in a green circle */}
      <div style={{
        width: "40px", height: "40px",
        borderRadius: "12px",
        background: "#EAF4EE",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "20px", marginBottom: "16px",
      }}>
        {icon}
      </div>
      {/* The big number */}
      <div style={{
        fontSize: "24px", fontWeight: 700,
        color: "#1A1A18", fontFamily: "Fraunces, serif",
        marginBottom: "4px",
      }}>
        {value}
      </div>
      {/* The label below */}
      <div style={{ fontSize: "13px", color: "#6B6B64" }}>
        {label}
      </div>
    </div>
  );
}

// ── Chart card wrapper ────────────────────────────────────────────────────
// A white card with a title that wraps each chart.
function ChartCard({ title, children }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid rgba(26,26,24,0.10)",
      borderRadius: "16px",
      padding: "24px",
    }}>
      <h3 style={{
        margin: "0 0 20px 0",
        fontSize: "15px", fontWeight: 600, color: "#1A1A18",
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Main Dashboard component ──────────────────────────────────────────────
export default function Dashboard() {
  // stats holds everything returned by /api/documents/stats
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Read the JWT token from localStorage — same key used at login
  const token = localStorage.getItem("token");

  // Fetch stats once when the component first mounts
  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch(`${API}/api/documents/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError("Could not load dashboard data.");
    } finally {
      // Whether success or error, stop showing the loading state
      setLoading(false);
    }
  }

  // ── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        padding: "32px", textAlign: "center",
        color: "#6B6B64", fontFamily: "DM Sans, sans-serif",
      }}>
        Loading dashboard...
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{
        padding: "32px", color: "#B91C1C",
        fontFamily: "DM Sans, sans-serif",
      }}>
        {error}
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────
  return (
    <div style={{
      padding: "32px",
      maxWidth: "1100px",
      margin: "0 auto",
      fontFamily: "DM Sans, sans-serif",
    }}>

      {/* Page heading */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{
          fontFamily: "Fraunces, serif",
          fontSize: "28px", color: "#1A1A18", margin: 0,
        }}>
          Dashboard
        </h1>
        <p style={{ color: "#6B6B64", marginTop: "6px" }}>
          Overview of your document activity and spending.
        </p>
      </div>

      {/* ── Stat cards row ── */}
      <div style={{
        display: "flex", gap: "16px",
        flexWrap: "wrap",           // wraps on small screens
        marginBottom: "32px",
      }}>
        <StatCard
          icon="📄"
          label="Total Documents"
          value={stats.total_documents}
        />
        <StatCard
          icon="₹"
          label="Total Amount"
          value={formatAmount(stats.total_amount)}
        />
        <StatCard
          icon="📅"
          label="This Month"
          value={stats.docs_this_month}
        />
        <StatCard
          icon="💾"
          label="Storage Used"
          value={`${stats.storage_kb} KB`}
        />
      </div>

      {/* ── Charts row ── */}
      <div style={{
        display: "grid",
        // On wide screens: two columns. The pie chart is narrower.
        gridTemplateColumns: "1fr 1fr",
        gap: "16px",
        marginBottom: "32px",
      }}>

        {/* Bar chart 1: Documents per month */}
        <ChartCard title="Documents Uploaded by Month">
          {stats.monthly_data.length === 0 ? (
            <p style={{ color: "#6B6B64", fontSize: "14px" }}>No data yet.</p>
          ) : (
            // ResponsiveContainer makes the chart fill its parent width
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.monthly_data}>
                {/* XAxis uses the "month" field from each data object */}
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#6B6B64" }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "#6B6B64" }}
                />
                {/* Tooltip appears on hover */}
                <Tooltip
                  contentStyle={{
                    borderRadius: "10px",
                    border: "1px solid rgba(26,26,24,0.10)",
                    fontSize: "13px",
                  }}
                />
                {/* Bar uses the "count" field, filled with green */}
                <Bar dataKey="count" fill="#2D6A4F" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Pie chart: Document types */}
        <ChartCard title="Document Types">
          {stats.type_data.length === 0 ? (
            <p style={{ color: "#6B6B64", fontSize: "14px" }}>No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stats.type_data}
                  dataKey="count"       // the number for each slice
                  nameKey="type"        // the label for each slice
                  cx="50%"             // centre x
                  cy="50%"             // centre y
                  outerRadius={80}
                  label={({ type, percent }) =>
                    // Shows e.g. "invoice 33%" on each slice
                    `${type} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {/* Each Cell gets a colour from PIE_COLORS */}
                  {stats.type_data.map((_, index) => (
                    <Cell
                      key={index}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "10px",
                    border: "1px solid rgba(26,26,24,0.10)",
                    fontSize: "13px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Bar chart 2: Amount by vendor — full width */}
      {stats.vendor_data.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <ChartCard title="Amount by Vendor (₹)">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.vendor_data}>
                <XAxis
                  dataKey="vendor"
                  tick={{ fontSize: 12, fill: "#6B6B64" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6B6B64" }}
                  tickFormatter={(v) =>
                    // Formats Y axis numbers as ₹6,000 (no decimals)
                    new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: "INR",
                      maximumFractionDigits: 0,
                    }).format(v)
                  }
                />
                <Tooltip
                  formatter={(value) => formatAmount(value)}
                  contentStyle={{
                    borderRadius: "10px",
                    border: "1px solid rgba(26,26,24,0.10)",
                    fontSize: "13px",
                  }}
                />
                <Bar dataKey="amount" fill="#52B788" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* ── Recent documents table ── */}
      <div style={{
        background: "#fff",
        border: "1px solid rgba(26,26,24,0.10)",
        borderRadius: "16px",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid rgba(26,26,24,0.08)",
        }}>
          <h2 style={{
            margin: 0, fontSize: "16px",
            fontWeight: 600, color: "#1A1A18",
          }}>
            Recent Documents
          </h2>
        </div>

        {stats.recent_documents.length === 0 ? (
          <div style={{
            padding: "48px", textAlign: "center", color: "#6B6B64",
          }}>
            No documents yet.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FAFAF7" }}>
                {["File", "Type", "Vendor", "Amount", "Date", "Status"].map(h => (
                  <th key={h} style={{
                    padding: "12px 16px", textAlign: "left",
                    fontSize: "12px", fontWeight: 600,
                    color: "#6B6B64", textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.recent_documents.map((doc, i) => (
                <tr
                  key={doc.id}
                  style={{
                    borderTop: "1px solid rgba(26,26,24,0.06)",
                    background: i % 2 === 0 ? "#fff" : "#FAFAF7",
                  }}
                >
                  <td style={{
                    padding: "14px 16px", fontSize: "14px",
                    color: "#1A1A18", fontWeight: 500,
                  }}>
                    {doc.filename}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{
                      ...typeBadgeStyle(doc.document_type),
                      padding: "3px 10px", borderRadius: "20px",
                      fontSize: "12px", fontWeight: 600,
                    }}>
                      {doc.document_type || "unknown"}
                    </span>
                  </td>
                  <td style={{
                    padding: "14px 16px", fontSize: "14px", color: "#1A1A18",
                  }}>
                    {doc.vendor_name || "—"}
                  </td>
                  <td style={{
                    padding: "14px 16px", fontSize: "14px",
                    color: "#1A1A18", fontWeight: 600,
                  }}>
                    {formatAmount(doc.total_amount)}
                  </td>
                  <td style={{
                    padding: "14px 16px", fontSize: "14px", color: "#6B6B64",
                  }}>
                    {doc.invoice_date || "—"}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{
                      background: "#EAF4EE", color: "#2D6A4F",
                      padding: "3px 10px", borderRadius: "20px",
                      fontSize: "12px", fontWeight: 600,
                    }}>
                      {doc.processing_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}