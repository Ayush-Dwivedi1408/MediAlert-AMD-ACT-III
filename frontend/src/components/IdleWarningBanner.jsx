export default function IdleWarningBanner({ secondsLeft, onStay, onLogout }) {
  return (
    <div style={{
      position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
      zIndex: 500, background: "var(--surface)", border: "1px solid #f59e0b66",
      borderRadius: 14, padding: "14px 20px", boxShadow: "0 8px 28px rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", gap: 16, maxWidth: "90vw",
    }}>
      <span style={{ fontSize: 20 }}>⏰</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>
          You'll be logged out in {secondsLeft}s due to inactivity
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
          Move your mouse or click below to stay signed in.
        </div>
      </div>
      <button onClick={onStay} style={{
        padding: "8px 16px", borderRadius: 10, border: "none",
        background: "#d97706", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
        whiteSpace: "nowrap",
      }}>
        Stay Logged In
      </button>
      <button onClick={onLogout} style={{
        padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border)",
        background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer",
        whiteSpace: "nowrap",
      }}>
        Log Out Now
      </button>
    </div>
  );
}
