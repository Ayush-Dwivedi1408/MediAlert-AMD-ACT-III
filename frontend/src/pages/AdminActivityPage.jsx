import { useEffect, useState } from "react";
import api from "../api/client";

const ACTION_COLORS = {
  Login: "#22C55E",
  Logout: "#94A3B8",
  "Added Patient": "#3B82F6",
  "Updated Patient": "#F59E0B",
  "Archived Patient": "#EF4444",
  "Restored Patient": "#22C55E",
  "Resolved Issue": "#3B82F6",
  "Added New Admin": "#8B5CF6",
  "Reset Password": "#F59E0B",
  "Activated Admin": "#22C55E",
  "Deactivated Admin": "#EF4444",
};

const ACTION_OPTIONS = [
  "", "Login", "Logout", "Added Patient", "Updated Patient", "Archived Patient",
  "Restored Patient", "Resolved Issue", "Added New Admin", "Reset Password",
  "Activated Admin", "Deactivated Admin",
];

export default function AdminActivityPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [adminIdFilter, setAdminIdFilter] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (actionFilter) params.action = actionFilter;
      if (adminIdFilter.trim()) params.admin_id = adminIdFilter.trim();
      const data = await api.admin.activity.list(params);
      setEntries(data);
    } catch (err) {
      setError(err.message || "Failed to load activity log");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [actionFilter]);

  function handleAdminIdKeyDown(e) {
    if (e.key === "Enter") load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>Activity Log</h2>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Every admin login, logout, and significant action, for accountability
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={adminIdFilter}
            onChange={(e) => setAdminIdFilter(e.target.value)}
            onKeyDown={handleAdminIdKeyDown}
            placeholder="Filter by Admin ID (e.g. AD001)"
            style={{
              padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border)",
              background: "var(--input-bg)", color: "var(--text)", fontSize: 13, width: 220, outline: "none",
            }}
          />
          <button onClick={load} style={{
            padding: "9px 16px", borderRadius: 10, border: "1px solid var(--border)",
            background: "transparent", color: "var(--text)", fontSize: 13, cursor: "pointer",
          }}>
            Search
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {ACTION_OPTIONS.map((a) => (
          <button key={a || "all"} onClick={() => setActionFilter(a)} style={{
            padding: "6px 14px", borderRadius: 999, border: "1px solid var(--border)",
            background: actionFilter === a ? "var(--accent)" : "transparent",
            color: actionFilter === a ? "#fff" : "var(--text)",
            fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>
            {a || "All"}
          </button>
        ))}
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
        borderRadius: 14, overflow: "hidden", overflowX: "auto",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--stat-bg)", textAlign: "left" }}>
              {["Activity ID", "Admin", "Action", "Details", "IP Address", "Date", "Time"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", color: "var(--muted)", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>Loading…</td></tr>
            )}
            {!loading && entries.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>No activity recorded yet.</td></tr>
            )}
            {entries.map((e) => (
              <tr key={e.activity_id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--muted)" }}>#{e.activity_id}</td>
                <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>{e.admin_name} ({e.admin_id})</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: `${ACTION_COLORS[e.action] || "#94A3B8"}22`,
                    color: ACTION_COLORS[e.action] || "var(--muted)",
                    whiteSpace: "nowrap",
                  }}>
                    {e.action}
                  </span>
                </td>
                <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{e.details || "—"}</td>
                <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{e.ip_address || "—"}</td>
                <td style={{ padding: "12px 16px", color: "var(--muted)", whiteSpace: "nowrap" }}>{e.date}</td>
                <td style={{ padding: "12px 16px", color: "var(--muted)", whiteSpace: "nowrap" }}>{e.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
