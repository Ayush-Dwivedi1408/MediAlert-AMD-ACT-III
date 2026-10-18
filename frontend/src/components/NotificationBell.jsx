import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

export default function NotificationBell({ patientId }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  async function load() {
    if (!patientId) return;
    try {
      const [list, count] = await Promise.all([
        api.notifications.forPatient(patientId),
        api.notifications.unreadCount(patientId),
      ]);
      setNotifications(list);
      setUnreadCount(count.unread_count);
    } catch {
      // silent — notification bell shouldn't break the page if this fails
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [patientId]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Opening the bell itself never marks anything as read — only an explicit
  // click on a notification, or the "Mark all as read" button below, does.
  async function handleClickNotification(n) {
    if (!n.is_read) {
      await api.notifications.markRead(n.id);
      load();
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  async function handleMarkAllRead(e) {
    e.stopPropagation();
    if (!patientId) return;
    setMarkingAll(true);
    try {
      await api.notifications.markAllRead(patientId);
      await load();
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        position: "relative", padding: "8px 10px", borderRadius: 10,
        border: "1px solid var(--border)", background: "transparent",
        color: "var(--text)", cursor: "pointer", fontSize: 15,
      }}>
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4, background: "#EF4444", color: "#fff",
            borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 900,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, width: 320, maxHeight: 440,
          overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.2)", zIndex: 300,
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} disabled={markingAll} style={{
                border: "none", background: "transparent", color: "var(--accent)",
                fontSize: 11, fontWeight: 700, cursor: markingAll ? "default" : "pointer",
              }}>
                {markingAll ? "Marking…" : "Mark all as read"}
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              No notifications yet
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} onClick={() => handleClickNotification(n)} style={{
                padding: "12px 16px", borderBottom: "1px solid var(--border)", cursor: "pointer",
                background: n.is_read ? "transparent" : "var(--stat-bg)",
              }}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>{n.message}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>
                  {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
