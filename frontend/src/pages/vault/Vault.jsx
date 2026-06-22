// ─────────────────────────────────────────
// DocSentinel v2 — Smart Vault
// PhRedSec™ | pages/vault/Vault.jsx
// ─────────────────────────────────────────

import { useState, useEffect, useRef } from "react";

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
const MAX_CONCURRENT = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png", "txt"];

function Chrome({ children }) {
  return (
    <span style={{ fontSize: "9px", fontFamily: T.font.mono, color: T.text.faint, letterSpacing: "0.12em", textTransform: "uppercase", display: "block" }}>
      {children}
    </span>
  );
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

// Client-side validation before sending to backend
function validateFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) return "Unsupported type";
  if (file.size > MAX_FILE_SIZE) return "Exceeds 10MB";
  return null;
}

export default function Vault() {
  const [documents, setDocuments] = useState([]);
  const [queue, setQueue] = useState([]); // [{ id, name, size, status, error }]
  const [batchActive, setBatchActive] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const uidRef = useRef(0);

  const token = localStorage.getItem("token");

  useEffect(() => { fetchDocuments(); }, []);

  async function fetchDocuments() {
    try {
      const res = await fetch(`${API}/api/documents/`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err) { setError("Failed to load documents."); }
  }

  // Upload one file, updating its queue row by id as it progresses
  async function uploadOne(item) {
    setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: "processing" } : x)));
    const formData = new FormData();
    formData.append("file", item.file);
    try {
      const res = await fetch(`${API}/api/documents/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (!res.ok) {
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: "failed", error: data.detail || "Upload failed" } : x)));
        return;
      }
      setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: "done" } : x)));
    } catch (err) {
      setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: "failed", error: "Network error" } : x)));
    }
  }

  // Process an array of queue items with a concurrency cap
  async function runBatch(items) {
    setBatchActive(true);
    let cursor = 0;
    async function worker() {
      while (cursor < items.length) {
        const item = items[cursor++];
        await uploadOne(item);
      }
    }
    const workers = Array.from({ length: Math.min(MAX_CONCURRENT, items.length) }, worker);
    await Promise.all(workers);
    setBatchActive(false);
    fetchDocuments(); // refresh table once after batch settles
  }

  // Turn a FileList into validated queue items, then run them
  function handleFiles(fileList) {
    setError(null);
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const items = files.map((file) => {
      const validationError = validateFile(file);
      return {
        id: ++uidRef.current,
        file,
        name: file.name,
        size: file.size,
        status: validationError ? "failed" : "queued",
        error: validationError,
      };
    });

    setQueue(items);
    const valid = items.filter((x) => x.status === "queued");
    if (valid.length > 0) runBatch(valid);
  }

  async function deleteDocument(id) {
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API}/api/documents/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Delete failed");
      fetchDocuments();
    } catch (err) { setError("Failed to delete document."); }
  }

  function handleDrop(e) { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); }
  function handleFileInput(e) { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }
  function clearQueue() { setQueue([]); }
  function formatAmount(amount) { if (!amount) return "—"; return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount); }
  function formatDate(dateStr) { if (!dateStr) return "—"; return dateStr; }
  function formatSize(bytes) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

  const doneCount = queue.filter((x) => x.status === "done").length;
  const failedCount = queue.filter((x) => x.status === "failed").length;
  const allSettled = queue.length > 0 && !batchActive;

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1040px", margin: "0 auto", fontFamily: T.font.sans, display: "flex", flexDirection: "column", gap: "20px" }}>
      <style>{`
        @keyframes ds-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes ds-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .tabular-nums { font-variant-numeric: tabular-nums; font-family: ${T.font.mono}; }
        .ds-row { transition: background-color 0.1s; }
        .ds-row:hover { background-color: rgba(255,255,255,0.015); }
        .ds-delete:hover { color: ${T.semantic.error} !important; background-color: rgba(248,81,73,0.08) !important; }
        .ds-clear:hover { color: ${T.text.secondary} !important; border-color: rgba(255,255,255,0.14) !important; }
      `}</style>

      {/* Header */}
      <div>
        <Chrome>Module</Chrome>
        <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "4px 0 0 0", color: T.text.primary, letterSpacing: "-0.03em" }}>Smart Vault</h1>
        <p style={{ color: T.text.secondary, margin: "4px 0 0 0", fontSize: "13px" }}>Upload invoices, bills, and financial documents. Drop multiple files at once — AI extracts everything automatically.</p>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current.click()}
        style={{ border: `1.5px dashed ${dragOver ? T.accent.violet : "rgba(255,255,255,0.14)"}`, borderRadius: "10px", padding: "44px", textAlign: "center", cursor: "pointer", background: dragOver ? "rgba(124,92,255,0.05)" : T.bg.card, transition: "all 0.2s ease" }}
      >
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.txt" style={{ display: "none" }} onChange={handleFileInput} />
        {batchActive ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "28px", height: "28px", border: "2px solid rgba(255,255,255,0.05)", borderTopColor: T.accent.bright, borderRadius: "50%", animation: "ds-spin 0.8s linear infinite" }} />
            <p style={{ color: T.accent.bright, fontWeight: 600, margin: 0, fontSize: "14px" }}>Processing batch…</p>
            <p className="tabular-nums" style={{ color: T.text.muted, fontSize: "12px", margin: 0 }}>{doneCount + failedCount} of {queue.length} complete</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <span style={{ display: "flex", width: "44px", height: "44px", borderRadius: "10px", border: T.border.hairline, background: "rgba(255,255,255,0.02)", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dragOver ? T.accent.bright : T.text.muted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" />
              </svg>
            </span>
            <p style={{ color: T.text.primary, fontWeight: 600, fontSize: "15px", margin: 0 }}>Drop files here or click to upload</p>
            <p style={{ color: T.text.muted, fontSize: "11px", margin: 0, fontFamily: T.font.mono, letterSpacing: "0.06em" }}>PDF · JPG · PNG · TXT — MAX 10MB EACH — MULTIPLE OK</p>
          </div>
        )}
      </div>

      {/* Upload Queue */}
      {queue.length > 0 && (
        <div style={{ backgroundColor: T.bg.panel, borderRadius: "10px", border: T.border.hairline, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: T.border.hairline, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <Chrome>Upload Queue</Chrome>
              <h2 style={{ margin: "3px 0 0 0", fontSize: "13px", fontWeight: 600, color: T.text.primary }}>
                {batchActive ? "Processing" : "Batch complete"}
                {" · "}
                <span className="tabular-nums" style={{ color: T.semantic.success }}>{doneCount} done</span>
                {failedCount > 0 && <><span style={{ color: T.text.faint }}>{" · "}</span><span className="tabular-nums" style={{ color: T.semantic.error }}>{failedCount} failed</span></>}
              </h2>
            </div>
            {allSettled && (
              <button onClick={clearQueue} className="ds-clear" style={{ background: "none", border: T.border.hairline, color: T.text.muted, cursor: "pointer", fontSize: "10px", fontWeight: "bold", padding: "5px 12px", borderRadius: "6px", fontFamily: T.font.mono, letterSpacing: "0.05em", transition: "all 0.1s" }}>CLEAR</button>
            )}
          </div>
          <div>
            {queue.map((item) => {
              const st = statusStyle(item.status);
              return (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 20px", borderBottom: T.border.hairline }}>
                  <span style={{ display: "flex", width: "24px", height: "24px", borderRadius: "6px", border: T.border.hairline, background: "rgba(255,255,255,0.02)", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {item.status === "processing" ? (
                      <div style={{ width: "12px", height: "12px", border: "1.5px solid rgba(255,255,255,0.1)", borderTopColor: T.accent.bright, borderRadius: "50%", animation: "ds-spin 0.8s linear infinite" }} />
                    ) : (
                      <svg style={{ width: "12px", height: "12px", stroke: T.text.muted, fill: "none", strokeWidth: "2" }} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></svg>
                    )}
                  </span>
                  <span style={{ flex: 1, fontSize: "12px", color: T.text.primary, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name}
                    {item.error && <span style={{ color: T.semantic.error, fontFamily: T.font.mono, fontSize: "10px", marginLeft: "8px" }}>— {item.error}</span>}
                  </span>
                  <span className="tabular-nums" style={{ fontSize: "10px", color: T.text.faint, flexShrink: 0 }}>{formatSize(item.size)}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "3px 10px", borderRadius: "4px", fontSize: "9px", fontFamily: T.font.mono, fontWeight: "bold", backgroundColor: st.bg, color: st.color, border: st.border, flexShrink: 0, animation: item.status === "processing" ? "ds-pulse 1.5s ease-in-out infinite" : "none" }}>
                    <span style={{ width: "4px", height: "4px", borderRadius: "50%", backgroundColor: st.color }} />{item.status.toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div style={{ background: "rgba(248,81,73,0.08)", border: T.border.error, borderRadius: "8px", padding: "12px 16px", color: T.semantic.error, fontSize: "13px", display: "flex", alignItems: "center", gap: "10px", fontFamily: T.font.mono }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>{error}
        </div>
      )}

      {/* Documents Table */}
      <div style={{ backgroundColor: T.bg.panel, borderRadius: "10px", border: T.border.hairline, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: T.border.hairline, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Chrome>Vault Contents</Chrome>
            <h2 style={{ margin: "3px 0 0 0", fontSize: "13px", fontWeight: 600, color: T.text.primary }}>Documents</h2>
          </div>
          {documents.length > 0 && (
            <span style={{ fontFamily: T.font.mono, fontSize: "11px", color: T.text.secondary }}>
              <span className="tabular-nums" style={{ fontWeight: "bold", color: T.accent.bright }}>{documents.length}</span> total
            </span>
          )}
        </div>

        {documents.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: T.text.muted, fontFamily: T.font.mono, fontSize: "12px" }}>No documents yet. Upload your first file above.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
              <thead>
                <tr style={{ borderBottom: T.border.hairline, backgroundColor: "rgba(255,255,255,0.02)" }}>
                  {["FILE", "TYPE", "VENDOR", "AMOUNT", "DATE", "STATUS", ""].map((h, idx) => (
                    <th key={h || idx} style={{ padding: "11px 20px", color: T.text.faint, fontFamily: T.font.mono, fontWeight: 500, fontSize: "10px", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
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
                      <td className="tabular-nums" style={{ padding: "12px 20px", color: T.text.primary, fontWeight: 500 }}>{formatAmount(doc.total_amount)}</td>
                      <td className="tabular-nums" style={{ padding: "12px 20px", color: T.text.secondary }}>{formatDate(doc.invoice_date)}</td>
                      <td style={{ padding: "12px 20px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "3px 10px", borderRadius: "4px", fontSize: "9px", fontFamily: T.font.mono, fontWeight: "bold", backgroundColor: st.bg, color: st.color, border: st.border }}>
                          <span style={{ width: "4px", height: "4px", borderRadius: "50%", backgroundColor: st.color }} />{(doc.processing_status || "unknown").toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "12px 20px", textAlign: "right" }}>
                        <button onClick={() => deleteDocument(doc.id)} className="ds-delete" style={{ background: "none", border: "none", color: T.text.muted, cursor: "pointer", fontSize: "10px", fontWeight: "bold", padding: "4px 8px", borderRadius: "4px", fontFamily: T.font.mono, letterSpacing: "0.05em", transition: "all 0.1s" }}>DELETE</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
