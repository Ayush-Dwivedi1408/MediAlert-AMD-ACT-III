import { useState, useEffect } from "react";
import { api } from "../api/client";

const SEVERITY_COLORS = {
  CRITICAL: "#EF4444",
  HIGH:     "#F97316",
  MEDIUM:   "#F59E0B",
  LOW:      "#22C55E",
};

const STATUS_BADGES = {
  unread:       { label: "Unread",            color: "#EF4444", bg: "#EF444415" },
  read:         { label: "✓ Read",            color: "#3B82F6", bg: "#3B82F615" },
  action_taken: { label: "✅ Action Taken",    color: "#22C55E", bg: "#22C55E15" },
};

function statusOf(a) {
  return a.action_status || (a.is_read ? "read" : "unread");
}

export default function RecentAlertsCard({ alerts = [], onAlertsUpdated }) {
  const [localAlerts, setLocalAlerts] = useState(alerts);
  const [loadingId,   setLoadingId]   = useState(null);

  // Sync when the parent actually refetches (new array reference) — NOT on
  // every render. The previous version called setState directly in the
  // render body and compared by length/JSON, which fired on the very next
  // render after an optimistic local removal (before the parent had
  // refetched), stomping the removal and making the buttons look broken.
  // A proper effect keyed on the `alerts` reference only re-syncs when the
  // parent actually hands us a new array (e.g. after a real refetch),
  // leaving an in-flight optimistic update alone in the meantime.
  useEffect(() => {
    setLocalAlerts(alerts);
  }, [alerts]);

  // Alerts the patient has already actioned are never shown here, regardless
  // of whether the backend still returns them in the list — once handled,
  // they're cleared off the dashboard for good.
  const visibleAlerts = localAlerts.filter(a => statusOf(a) !== "action_taken");

  async function handleAction(alertId, status) {
    setLoadingId(alertId);
    try {
      await api.alerts.updateStatus(alertId, status);
      if (status === "action_taken") {
        setLocalAlerts(prev => prev.filter(a => a.id !== alertId));
      } else {
        setLocalAlerts(prev =>
          prev.map(a => a.id === alertId ? { ...a, action_status: status, is_read: true } : a)
        );
      }
      if (typeof onAlertsUpdated === "function") onAlertsUpdated();
    } catch (e) {
      console.error("Failed to update alert:", e);
      alert("Could not update alert status. Please try again.");
    }
    setLoadingId(null);
  }

  const s = {
    card:    { background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.3)" },
    h2:      { fontSize: 16, fontWeight: 700, marginBottom: 18, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 },
    alertBox:(color) => ({ background: color + "12", border: `1px solid ${color}44`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }),
    title:   (color) => ({ fontWeight: 800, fontSize: 14, color, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }),
    message: { fontSize: 13, color: "var(--text)", lineHeight: 1.5, marginBottom: 4 },
    date:    { fontSize: 11, color: "var(--muted)" },
    btnRow:  { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" },
    readBtn: { height: 34, padding: "0 14px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12, fontWeight: 600 },
    actionBtn:{ height: 34, padding: "0 14px", borderRadius: 10, border: "none", background: "#22C55E", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 },
    badge:   (status) => ({
      display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      color: STATUS_BADGES[status]?.color || "var(--muted)",
      background: STATUS_BADGES[status]?.bg || "var(--stat-bg)",
    }),
  };

  const unreadCount = visibleAlerts.filter(a => statusOf(a) === "unread").length;

  return (
    <div style={s.card}>
      <div style={s.h2}>
        🔔 Recent Alerts ({visibleAlerts.length})
        {unreadCount > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", background: "#EF444415", padding: "2px 8px", borderRadius: 20 }}>
            {unreadCount} unread
          </span>
        )}
      </div>

      {visibleAlerts.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 20 }}>
          No alerts to show. 🎉
        </div>
      ) : (
        visibleAlerts.map((a, i) => {
          const color  = SEVERITY_COLORS[a.severity] || "var(--muted)";
          const status = statusOf(a);
          const badge  = STATUS_BADGES[status] || STATUS_BADGES.unread;
          const isLoading = loadingId === a.id;

          return (
            <div key={a.id || i} style={s.alertBox(color)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={s.title(color)}>
                  ⚠️ {a.title || a.alert_type?.replace(/_/g, " ") || "Alert"}
                </div>
                <span style={s.badge(status)}>{badge.label}</span>
              </div>
              <div style={s.message}>{a.message}</div>
              <div style={s.date}>{a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}</div>

              <div style={s.btnRow}>
                {status === "unread" && (
                  <button
                    style={s.readBtn}
                    disabled={isLoading}
                    onClick={() => handleAction(a.id, "read")}
                  >
                    {isLoading ? "..." : "✓ Mark Read"}
                  </button>
                )}
                <button
                  style={s.actionBtn}
                  disabled={isLoading}
                  onClick={() => handleAction(a.id, "action_taken")}
                >
                  {isLoading ? "..." : "✅ Read & Action Taken"}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
