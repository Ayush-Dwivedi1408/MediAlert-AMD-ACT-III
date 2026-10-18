import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useState } from "react";
import { useCallback } from "react";
import { useStore } from "./store";
import LoginPage from "./pages/LoginPage";
import PatientIdBadge from "./components/PatientIdBadge";
import DashboardPage from "./pages/DashboardPage";
import SymptomsPage from "./pages/SymptomsPage";
import ResultsPage from "./pages/ResultsPage";
import HistoryPage from "./pages/HistoryPage";
import AnalyticsPage from "./pages/AnalyticsPage"; // kept, unrouted from nav — reserved for future admin menu (see notes below)
import InsightsPage from "./pages/InsightsPage";
import MentalHealthPage from "./pages/MentalHealthPage";
import HealthCardPage from "./pages/HealthCardPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminManagementPage from "./pages/AdminManagementPage";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import AdminLayout from "./components/AdminLayout";
import AdminPatientsPage from "./pages/AdminPatientsPage";
import ChangeHistoryPage from "./pages/ChangeHistoryPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import SupportCenterPage from "./pages/SupportCenterPage";
import NotificationBell from "./components/NotificationBell";
import AdminIssuesPage from "./pages/AdminIssuesPage";
import AdminFeedbackPage from "./pages/AdminFeedbackPage";
import AdminActivityPage from "./pages/AdminActivityPage";
import AdminSecurityPage from "./pages/AdminSecurityPage";
import AdminEmergencyLogsPage from "./pages/AdminEmergencyLogsPage";
import LogoutFeedbackModal from "./components/LogoutFeedbackModal";
import EmergencyGuidePage from "./pages/EmergencyGuidePage";
import EmergencyGuideDetailPage from "./pages/EmergencyGuideDetailPage";
import IdleWarningBanner from "./components/IdleWarningBanner";
import { useIdleTimeout } from "./hooks/useIdleTimeout";

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

// Shared sizing for every nav pill so they all render at identical height
// regardless of label length — prevents two-word labels like "Mental
// Health" from wrapping and making that one button taller than its neighbors.
const NAV_PILL_HEIGHT = 34;

function Layout({ children }) {
  const { patient, dark, toggleDark, lang, toggleLang, unreadAlerts, isOnline, clearPatient } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isLogin = location.pathname === "/";
  const [showLogoutFeedback, setShowLogoutFeedback] = useState(false);

  const handleIdleTimeout = useCallback(() => {
    clearPatient();
    navigate("/?reason=timeout");
  }, [clearPatient, navigate]);

  const { showWarning, secondsLeft, stayActive } = useIdleTimeout({
    timeoutMinutes: 15,
    warningSeconds: 60,
    onTimeout: handleIdleTimeout,
    enabled: !!patient,
  });

  // All 9 tabs in one flat, horizontally-scrollable strip — the nav itself
  // scrolls internally (see .nav-scroll below) if they don't all fit, so
  // there's no need to hide any of them behind a "More" menu.
  const navItems = [
    { to: "/dashboard", label: lang === "hi" ? "डैशबोर्ड" : "Dashboard", icon: "🏠" },
    { to: "/symptoms", label: lang === "hi" ? "मूल्यांकन" : "Assessment", icon: "🩺" },
    { to: "/results", label: lang === "hi" ? "परिणाम" : "Results", icon: "📋" },
    { to: "/history", label: lang === "hi" ? "इतिहास" : "History", icon: "📅" },
    { to: "/mental-health", label: lang === "hi" ? "मानसिक स्वास्थ्य" : "Mental Health", icon: "🧠" },
    { to: "/insights", label: lang === "hi" ? "अंतर्दृष्टि" : "Insights", icon: "📊" },
    { to: "/health-card", label: lang === "hi" ? "आपातकालीन कार्ड" : "Emergency Card", icon: "🪪" },
    { to: "/change-history", label: lang === "hi" ? "परिवर्तन इतिहास" : "Change History", icon: "📝" },
    { to: "/support-center", label: lang === "hi" ? "सहायता केंद्र" : "Support Center", icon: "🎫" },
  ];

  return (
    <>
      <style>{dark ? DARK : LIGHT}</style>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { overflow-x: hidden; }
        body { background: var(--bg); font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        input, select, textarea, button { font-family: inherit; }
        button:hover { opacity: 0.88; }
        ::-webkit-scrollbar { width: 6px; height: 6px; } 
        ::-webkit-scrollbar-track { background: var(--bg); }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        a { text-decoration: none; }
        .nav-pill {
          height: ${NAV_PILL_HEIGHT}px;
          padding: 0 11px;
          border-radius: 9px;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
        }
        .nav-pill .nav-icon { font-size: 14px; line-height: 1; }
        .nav-pill .nav-label { line-height: 1; }
        .nav-scroll {
          scrollbar-width: thin;
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", transition: "background 0.3s, color 0.3s" }}>
        {/* Offline banner */}
        {!isOnline && (
          <div style={{ background: "#F59E0B", color: "#fff", padding: "10px 24px", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
            📴 You are offline. Data will sync when connection is restored.
          </div>
        )}

        {/* Medical Disclaimer Banner */}
        <div style={{
          background: dark ? "rgba(59, 130, 246, 0.08)" : "#eff6ff",
          border: `1px solid ${dark ? "rgba(59, 130, 246, 0.35)" : "#bfdbfe"}`,
          borderRadius: 10,
          color: "var(--text)",
          padding: "12px 20px",
          margin: "12px 24px 0",
          fontSize: 13,
          lineHeight: 1.5,
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>
          <span>
            <strong>Medical Disclaimer:</strong> MediAlert is an AI-powered clinical decision support tool for informational purposes only. It is not a substitute for professional medical advice, diagnosis, treatment, or emergency medical care.
          </span>
        </div>
        {isLogin && (
          <div style={{ textAlign: "center", margin: "16px 24px 0" }}>
            <a href="/emergency-guide" style={{
            display: "inline-block", padding: "10px 20px", borderRadius: 10,
            background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#EF4444", fontWeight: 700, fontSize: 13,
          }}>
            🚨 Medical Emergency? View First-Aid Guide
        </a>
      </div>
    )}

        {/* Header */}
        {!isLogin && (
          <header style={{
            background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "0 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between", height: 58,
            position: "sticky", top: 0, zIndex: 100, width: "100%", overflow: "hidden",
          }}>
            {/* Logo + nav share this flexible lane. It shrinks to whatever
                space is left after the fixed-width right-side controls, and
                the <nav> inside it scrolls horizontally on its own if the
                tabs don't fit — the page itself never scrolls sideways. */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, flex: 1, minWidth: 0 }}>
              <div onClick={() => navigate("/dashboard")} style={{ cursor: "pointer", flexShrink: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 18, color: "var(--accent)", letterSpacing: "-0.5px", whiteSpace: "nowrap" }}>🏥 MediAlert</span>
              </div>
              <nav className="nav-scroll" style={{ display: "flex", gap: 3, alignItems: "center", flex: 1, minWidth: 0, overflowX: "auto", overflowY: "hidden" }}>
                {navItems.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className="nav-pill"
                    style={({ isActive }) => ({
                      position: "relative",
                      fontWeight: isActive ? 700 : 500,
                      background: isActive ? "var(--accent)" : "transparent",
                      color: isActive ? "#fff" : "var(--muted)",
                    })}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                    {item.to === "/dashboard" && unreadAlerts > 0 && (
                      <span style={{
                        position: "absolute", top: -4, right: -4,
                        background: "#EF4444", color: "#fff", borderRadius: "50%",
                        width: 16, height: 16, fontSize: 9, fontWeight: 900,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: "2px solid var(--surface)",
                      }}>
                        {unreadAlerts}
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: 12 }}>
              {patient && <NotificationBell patientId={patient.id} />}
              {patient && <PatientIdBadge patient={patient} />}
              <button onClick={toggleLang} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                {lang === "en" ? "हिंदी" : "English"}
              </button>
              <button onClick={toggleDark} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 13 }}>
                {dark ? "☀" : "☾"}
              </button>
              {patient && (
                <button onClick={() => setShowLogoutFeedback(true)} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "#EF4444", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>
                  Logout
                </button>
              )}
            </div>
          </header>
        )}

        <main style={{ padding: isLogin ? 0 : "24px", maxWidth: isLogin ? "none" : 1100, margin: "0 auto" }}>
          {children}
        </main>
      </div>
        {showLogoutFeedback && (
          <LogoutFeedbackModal
          patientId={patient.id}
          onDone={() => { setShowLogoutFeedback(false); clearPatient(); navigate("/"); }}
        />
      )}
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

function ProtectedRoute({ children }) {
  const { patient } = useStore();
  const navigate = useNavigate();
  useEffect(() => { if (!patient) navigate("/"); }, [patient]);
  return patient ? children : null;
}

export default function App() {
  const { setOnline } = useStore();

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><LoginPage /></Layout>} />
        <Route path="/dashboard" element={<Layout><ProtectedRoute><DashboardPage /></ProtectedRoute></Layout>} />
        <Route path="/symptoms" element={<Layout><ProtectedRoute><SymptomsPage /></ProtectedRoute></Layout>} />
        <Route path="/results" element={<Layout><ProtectedRoute><ResultsPage /></ProtectedRoute></Layout>} />
        <Route path="/history" element={<Layout><ProtectedRoute><HistoryPage /></ProtectedRoute></Layout>} />
        <Route path="/change-history" element={<Layout><ProtectedRoute><ChangeHistoryPage /></ProtectedRoute></Layout>} />
        <Route path="/analytics" element={<Layout><ProtectedRoute><AnalyticsPage /></ProtectedRoute></Layout>} />
        {/* ↑ AnalyticsPage: not in nav, reachable directly at /analytics.
            Reserved for a future admin menu — do not remove. */}
        <Route path="/insights" element={<Layout><ProtectedRoute><InsightsPage /></ProtectedRoute></Layout>} />
        <Route path="/mental-health" element={<Layout><ProtectedRoute><MentalHealthPage /></ProtectedRoute></Layout>} />
        <Route path="/health-card" element={<Layout><ProtectedRoute><HealthCardPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/login" element={<AdminLayout fullBleed><AdminLoginPage /></AdminLayout>} />
        <Route path="/support-center" element={<Layout><ProtectedRoute><SupportCenterPage /></ProtectedRoute></Layout>} />
        <Route path="/emergency-guide" element={<EmergencyGuidePage />} />
        <Route path="/emergency-guide/:slug" element={<EmergencyGuideDetailPage />} />  
        <Route path="/admin/manage" element={
          <AdminLayout>
            <AdminProtectedRoute requireSuperAdmin>
             <AdminManagementPage />
           </AdminProtectedRoute>
          </AdminLayout>
} />
        <Route path="/admin/patients" element={
          <AdminLayout>
            <AdminProtectedRoute>
              <AdminPatientsPage />
            </AdminProtectedRoute>
          </AdminLayout>
} />
        <Route path="/admin/dashboard" element={
          <AdminLayout>
            <AdminProtectedRoute>
              <AdminDashboardPage />
            </AdminProtectedRoute>
          </AdminLayout>
} />
        <Route path="/admin/issues" element={
          <AdminLayout>
            <AdminProtectedRoute>
              <AdminIssuesPage />
          </AdminProtectedRoute>
        </AdminLayout>
} />
        <Route path="/admin/emergency-logs" element={
          <AdminLayout>
            <AdminProtectedRoute>
              <AdminEmergencyLogsPage />
            </AdminProtectedRoute>
          </AdminLayout>
} />
        <Route path="/admin/feedback" element={
          <AdminLayout>
            <AdminProtectedRoute>
              <AdminFeedbackPage />
            </AdminProtectedRoute>
          </AdminLayout>
} />
        <Route path="/admin/activity" element={
          <AdminLayout>
            <AdminProtectedRoute>
              <AdminActivityPage />
            </AdminProtectedRoute>
          </AdminLayout>
} />
        <Route path="/admin/security" element={
          <AdminLayout>
            <AdminProtectedRoute>
              <AdminSecurityPage />
            </AdminProtectedRoute>
          </AdminLayout>
} />

      </Routes>
    </BrowserRouter>
  );
}
