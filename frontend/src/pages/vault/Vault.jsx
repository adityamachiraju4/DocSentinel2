
// ─────────────────────────────────────────
// DocSentinel v2 — Smart Vault
// PhRedSec™ | pages/vault/Vault.jsx
// ─────────────────────────────────────────

import { useState, useEffect, useRef } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Vault() {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);

  // Get the JWT token stored during login
  const token = localStorage.getItem("token");

  // ── Fetch documents on load ─────────────
  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    try {
      const res = await fetch(`${API}/api/documents/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err) {
      setError("Failed to load documents.");
    }
  }

  // ── Handle file upload ──────────────────
  async function uploadFile(file) {
    setError(null);
    setSuccess(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API}/api/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Upload failed.");
        return;
      }

      setSuccess(`"${file.name}" processed successfully.`);
      fetchDocuments(); // Refresh the list
    } catch (err) {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // ── Drag and drop handlers ──────────────
  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFileInput(e) {
    const file = e.target.files[0];
    if (file) uploadFile(file);
  }

  // ── Format currency ─────────────────────
  function formatAmount(amount) {
    if (!amount) return "—";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  }

  // ── Format date ─────────────────────────
  function formatDate(dateStr) {
    if (!dateStr) return "—";
    return dateStr;
  }

  // ── Badge color by document type ────────
  function typeBadgeStyle(type) {
    const colors = {
      invoice: { background: "#EAF4EE", color: "#2D6A4F" },
      bill: { background: "#EAF4EE", color: "#2D6A4F" },
      receipt: { background: "#FEF9C3", color: "#854D0E" },
      contract: { background: "#EDE9FE", color: "#5B21B6" },
      other: { background: "#F3F4F6", color: "#6B7280" },
    };
    return colors[type] || colors.other;
  }

  return (
    <div style={{ padding: "32px", maxWidth: "960px", margin: "0 auto", fontFamily: "DM Sans, sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: "28px", color: "#1A1A18", margin: 0 }}>
          Smart Vault
        </h1>
        <p style={{ color: "#6B6B64", marginTop: "6px" }}>
          Upload invoices, bills, and financial documents. AI extracts everything automatically.
        </p>
      </div>

      {/* ── Upload Zone ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current.click()}
        style={{
          border: `2px dashed ${dragOver ? "#2D6A4F" : "rgba(26,26,24,0.15)"}`,
          borderRadius: "16px",
          padding: "48px",
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? "#EAF4EE" : "#FAFAF7",
          transition: "all 0.2s ease",
          marginBottom: "24px",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.txt"
          style={{ display: "none" }}
          onChange={handleFileInput}
        />

        {uploading ? (
          <div>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
            <p style={{ color: "#2D6A4F", fontWeight: 600 }}>Processing document...</p>
            <p style={{ color: "#6B6B64", fontSize: "14px" }}>AI is extracting data. This takes a few seconds.</p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📄</div>
            <p style={{ color: "#1A1A18", fontWeight: 600, fontSize: "16px", margin: 0 }}>
              Drop a file here or click to upload
            </p>
            <p style={{ color: "#6B6B64", fontSize: "14px", marginTop: "6px" }}>
              PDF, JPG, PNG, TXT — max 10MB
            </p>
          </div>
        )}
      </div>

      {/* ── Success / Error Messages ── */}
      {success && (
        <div style={{ background: "#EAF4EE", border: "1px solid #52B788", borderRadius: "10px", padding: "12px 16px", color: "#2D6A4F", marginBottom: "16px", fontSize: "14px" }}>
          ✅ {success}
        </div>
      )}
      {error && (
        <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: "10px", padding: "12px 16px", color: "#B91C1C", marginBottom: "16px", fontSize: "14px" }}>
          ❌ {error}
        </div>
      )}

      {/* ── Documents Table ── */}
      <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid rgba(26,26,24,0.10)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(26,26,24,0.08)" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#1A1A18" }}>
            Documents {documents.length > 0 && `(${documents.length})`}
          </h2>
        </div>

        {documents.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#6B6B64" }}>
            No documents yet. Upload your first file above.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FAFAF7" }}>
                {["File", "Type", "Vendor", "Amount", "Date", "Status"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6B6B64", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, i) => (
                <tr key={doc.id} style={{ borderTop: "1px solid rgba(26,26,24,0.06)", background: i % 2 === 0 ? "#fff" : "#FAFAF7" }}>
                  <td style={{ padding: "14px 16px", fontSize: "14px", color: "#1A1A18", fontWeight: 500 }}>
                    {doc.filename}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ ...typeBadgeStyle(doc.document_type), padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600 }}>
                      {doc.document_type || "unknown"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "14px", color: "#1A1A18" }}>
                    {doc.vendor_name || "—"}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "14px", color: "#1A1A18", fontWeight: 600 }}>
                    {formatAmount(doc.total_amount)}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "14px", color: "#6B6B64" }}>
                    {formatDate(doc.invoice_date)}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ background: "#EAF4EE", color: "#2D6A4F", padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600 }}>
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