import { useNavigate } from "react-router-dom";
import { useStore } from "../store";

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

export default function EmergencyGuideLayout({ children }) {
  const { dark } = useStore();
  const navigate = useNavigate();

  return (
    <>
      <style>{dark ? DARK : LIGHT}</style>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: var(--bg); font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        button { font-family: inherit; }
        button:hover { opacity: 0.88; }
        a { text-decoration: none; }
      `}</style>
      <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
        <header style={{
          background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "0 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between", height: 56,
        }}>
          <div onClick={() => navigate("/emergency-guide")} style={{ cursor: "pointer" }}>
            <span style={{ fontWeight: 800, fontSize: 16, color: "var(--accent)" }}>
              🏥 MediAlert — Emergency Guide
            </span>
          </div>
          <button onClick={() => navigate("/")} style={{
            padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border)",
            background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12,
          }}>
            ← Back to Login
          </button>
        </header>
        <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
          {children}
        </main>
      </div>
    </>
  );
}
