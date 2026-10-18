import { useNavigate, useLocation, NavLink } from "react-router-dom";
import { useCallback } from "react";
import { useStore } from "../store";
import api from "../api/client";
import AdminNotificationBell from "./AdminNotificationBell";
import IdleWarningBanner from "./IdleWarningBanner";
import { useIdleTimeout } from "../hooks/useIdleTimeout";



const LIGHT = `
  :root {
    --bg: #f4f6f9; --surface: #ffffff; --border: #e2e8f0;
    --text: #1a202c; --muted: #64748b; --accent: #2563eb;
    --input-bg: #f8fafc; --stat-bg: #f0f4ff;
  }
`;
const DARK = `
  :root {
    --bg: #0F172A; --surface: #1E293B; --border: #334155;
    --text: #F8FAFC; --muted: #94A3B8; --accent: #3B82F6;
    --accent-hover: #2563EB;
    --input-bg: #0F172A; --stat-bg: #1E293B;
  }
`;

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/admin/patients", label: "Patients", icon: "🧑‍⚕️" },
  { to: "/admin/issues", label: "Issues", icon: "🎫" },
  { to: "/admin/emergency-logs", label: "Emergency Logs", icon: "🚨" },
  { to: "/admin/feedback", label: "Patient Experience", icon: "💬" },
  { to: "/admin/activity", label: "Activity Log", icon: "🕒" },
  { to: "/admin/security", label: "My Security", icon: "🔐" },
  { to: "/admin/manage", label: "Manage Admins", icon: "🔑", superAdminOnly: true },
];

export default function AdminLayout({ children, fullBleed = false }) {
  const { dark, adminUser, clearAdmin } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleIdleTimeout = useCallback(async () => {
    try {
      await api.admin.logout();
    } catch (err) {
      // swallow — logging out locally still proceeds
    } finally {
      clearAdmin();
      navigate("/admin/login?reason=timeout");
    }
  }, [clearAdmin, navigate]);

  // Called unconditionally (Rules of Hooks) — gated via `enabled` instead of
  // being skipped on the fullBleed (login page) early return below.
  const { showWarning, secondsLeft, stayActive } = useIdleTimeout({
    timeoutMinutes: 15,
    warningSeconds: 60,
    onTimeout: handleIdleTimeout,
    enabled: !fullBleed && !!adminUser,
  });

  const globalStyles = (
    <>
      <style>{dark ? DARK : LIGHT}</style>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: var(--bg); font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        input, select, textarea, button { font-family: inherit; }
        button:hover { opacity: 0.88; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg); }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        a { text-decoration: none; }
      `}</style>
    </>
  );

  if (fullBleed) {
    return <>{globalStyles}{children}</>;
  }

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.superAdminOnly || adminUser?.role === "super_admin");

  async function handleLogout() {
    // Best-effort: record the logout in the activity log before clearing the
    // local token. If the call fails (e.g. token already expired), we still
    // log the admin out locally rather than blocking them.
    try {
      await api.admin.logout();
    } catch (err) {
      // swallow — logging out locally still proceeds
    } finally {
      clearAdmin();
      navigate("/admin/login");
    }
  }

  return (
    <>
      {globalStyles}
      <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
        <header style={{
  background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "0 24px",
  display: "flex", alignItems: "center", justifyContent: "space-between", height: 56,
  position: "sticky", top: 0, zIndex: 100,
}}>
  <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
    <div onClick={() => navigate("/admin/dashboard")} style={{ cursor: "pointer" }}>
      <span style={{ fontWeight: 800, fontSize: 16, color: "var(--accent)", letterSpacing: "-0.5px" }}>
        🏥 MediAlert Admin
      </span>
    </div>
    <nav style={{ display: "flex", gap: 2 }}>
      {visibleNavItems.map((item) => (
        <NavLink key={item.to} to={item.to} style={({ isActive }) => ({
          padding: "6px 12px", borderRadius: 10, fontSize: 13, fontWeight: isActive ? 700 : 400,
          background: isActive ? "var(--accent)" : "transparent",
          color: isActive ? "#fff" : "var(--muted)",
          display: "flex", alignItems: "center", gap: 4,
        })}>
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  </div>
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <AdminNotificationBell />
    <span style={{ fontSize: 12, color: "var(--muted)" }}>
      {adminUser?.name} ({adminUser?.id})
    </span>
    <button onClick={handleLogout} style={{
      padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border)",
      background: "transparent", color: "#EF4444", cursor: "pointer", fontSize: 12,
    }}>
      Logout 
    </button>
  </div>
</header>
        <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
          {adminUser && !adminUser.mfa_enabled && location.pathname !== "/admin/security" && (
            <div style={{
              background: "#f59e0b12", border: "1px solid #f59e0b44", borderRadius: 12,
              padding: "10px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between",
              alignItems: "center", flexWrap: "wrap", gap: 8,
            }}>
              <span style={{ fontSize: 12, color: "var(--text)" }}>
                🔒 Two-factor authentication isn't enabled on your account yet.
              </span>
              <button onClick={() => navigate("/admin/security")} style={{
                padding: "5px 12px", borderRadius: 8, border: "none",
                background: "#d97706", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer",
              }}>
                Enable Now
              </button>
            </div>
          )}
          {children}
        </main>
      </div>
      {showWarning && (
        <IdleWarningBanner
          secondsLeft={secondsLeft}
          onStay={stayActive}
          onLogout={handleIdleTimeout}
        />
      )}
    </>
  );
}
