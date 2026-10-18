import { useEffect, useState } from "react";
import api from "../api/client";

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 460, background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 24, maxHeight: "85vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{title}</span>
          <button onClick={onClose} style={{
            border: "none", background: "transparent", color: "var(--muted)",
            fontSize: 18, cursor: "pointer", lineHeight: 1,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusBadge({ status, devMode }) {
  const isSent = status === "Sent";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{
        padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
        background: isSent ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
        color: isSent ? "#22C55E" : "#EF4444",
      }}>
        {isSent ? "✓ Sent" : "✗ Failed"}
      </span>
      {devMode && (
        <span style={{
          padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
          background: "rgba(217,119,6,0.15)", color: "#d97706",
        }}>
          DEV
        </span>
      )}
    </span>
  );
}

function ChannelBadge({ channel }) {
  const isWhatsapp = channel === "whatsapp";
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: isWhatsapp ? "rgba(34,197,94,0.15)" : "rgba(59,130,246,0.15)",
      color: isWhatsapp ? "#22C55E" : "var(--accent)",
    }}>
      {isWhatsapp ? "WhatsApp" : "SMS"}
    </span>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: "var(--text)" }}>{value ?? "—"}</div>
    </div>
  );
}

function AttemptBlock({ title, attempt }) {
  const [showResponse, setShowResponse] = useState(false);
  if (!attempt) return null;

  return (
    <div style={{
      background: "var(--stat-bg)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "12px 14px", marginBottom: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <ChannelBadge channel={attempt.channel} />
        <StatusBadge status={attempt.status} devMode={attempt.dev_mode} />
      </div>
      {attempt.provider_response && (
        <button
          onClick={() => setShowResponse((v) => !v)}
          style={{
            border: "none", background: "transparent", color: "var(--accent)",
            fontSize: 11, cursor: "pointer", padding: 0, marginTop: 4,
          }}
        >
          {showResponse ? "Hide" : "Show"} technical details
        </button>
      )}
      {showResponse && attempt.provider_response && (
        <div style={{
          marginTop: 8, fontSize: 11, color: "var(--muted)", fontFamily: "monospace",
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
          padding: "8px 10px", lineHeight: 1.5, wordBreak: "break-word",
        }}>
          {attempt.provider_response}
        </div>
      )}
    </div>
  );
}

export default function AdminEmergencyLogsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadLogs() {
    setLoading(true);
    setError("");
    try {
      const data = await api.admin.emergencyLogs.list();
      setRows(data);
    } catch (err) {
      setError(err.message || "Failed to load emergency notification logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLogs(); }, []);

  async function openDetail(notificationId) {
    setDetailLoading(true);
    try {
      const data = await api.admin.emergencyLogs.get(notificationId);
      setDetail(data);
    } catch (err) {
      setError(err.message || "Failed to load notification detail");
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>🚨 Emergency Notification Logs</h2>
        <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
          Audit trail of every SOS alert send attempt — WhatsApp Business API first, SMS fallback if needed.
        </div>
      </div>

      <div style={{
        background: "var(--stat-bg)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--muted)",
        marginBottom: 16, lineHeight: 1.5,
      }}>
        ℹ️ "Sent" means the provider accepted the message — true delivery confirmation requires a
        provider status webhook, not yet configured. Rows tagged <strong style={{ color: "#d97706" }}>DEV</strong> mean
        no real WhatsApp/SMS credentials are set up yet, so nothing was actually delivered.
      </div>

      {error && (
        <div style={{
          background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
          color: "#EF4444", borderRadius: 10, padding: "10px 12px", fontSize: 13, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 14, overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--stat-bg)", textAlign: "left" }}>
              {["Patient", "Emergency", "Channel", "Status", "Time", ""].map((h) => (
                <th key={h} style={{ padding: "12px 16px", color: "var(--muted)", fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>No emergency alerts sent yet</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={`${r.notification_id}-${r.channel}-${i}`} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px", fontWeight: 600 }}>{r.patient_name}</td>
                <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{r.emergency_type}</td>
                <td style={{ padding: "12px 16px" }}><ChannelBadge channel={r.channel} /></td>
                <td style={{ padding: "12px 16px" }}><StatusBadge status={r.status} devMode={r.dev_mode} /></td>
                <td style={{ padding: "12px 16px", color: "var(--muted)" }}>
                  {new Date(r.timestamp).toLocaleString()}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                  <button onClick={() => openDetail(r.notification_id)} style={{
                    padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)",
                    background: "transparent", color: "var(--text)", fontSize: 12, cursor: "pointer",
                  }}>
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(detail || detailLoading) && (
        <Modal title={detail ? `Notification ${detail.notification_id}` : "Loading…"} onClose={() => setDetail(null)}>
          {detailLoading && !detail ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>Loading…</div>
          ) : (
            <>
              <DetailRow label="Patient" value={`${detail.patient_name} (${detail.patient_id})`} />
              <DetailRow label="Emergency Type" value={detail.emergency_type} />
              <DetailRow label="Recipient" value={detail.recipient_masked} />
              <DetailRow label="Time" value={new Date(detail.timestamp).toLocaleString()} />
              <DetailRow
                label="Overall Result"
                value={detail.delivered_via
                  ? `Delivered via ${detail.delivered_via === "whatsapp" ? "WhatsApp" : "SMS"}`
                  : "Not delivered on any channel"}
              />

              <AttemptBlock title="Primary Channel" attempt={detail.primary} />
              {detail.fallback_triggered && (
                <AttemptBlock title="Fallback Channel" attempt={detail.fallback} />
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
