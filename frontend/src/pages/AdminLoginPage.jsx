import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../store";
import api from "../api/client";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const timedOut = searchParams.get("reason") === "timeout";
  const { setAdmin, dark } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── MFA step ──
  const [pendingToken, setPendingToken] = useState(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  // ── Forgot password step ──
  // view: null while on the normal login/MFA form. "request" = enter email
  // to get a code. "reset" = enter code + new password.
  const [forgotView, setForgotView] = useState(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotDevOtp, setForgotDevOtp] = useState(""); // dev-mode only
  const [forgotCode, setForgotCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.admin.login(email, password);
      if (res.mfa_required) {
        setPendingToken(res.pending_token);
      } else {
        setAdmin(res.access_token, res.admin);
        navigate("/admin/manage");
      }
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit(e) {
    e.preventDefault();
    setError("");
    setMfaLoading(true);
    try {
      const res = await api.admin.mfa.verifyLogin(pendingToken, mfaCode.trim());
      setAdmin(res.access_token, res.admin);
      navigate("/admin/manage");
    } catch (err) {
      setError(err.message || "Incorrect code");
    } finally {
      setMfaLoading(false);
    }
  }

  function backToPassword() {
    setPendingToken(null);
    setMfaCode("");
    setError("");
  }

  function openForgotPassword() {
    setForgotView("request");
    setForgotEmail(email); // convenience: carry over whatever they'd typed
    setForgotError("");
    setForgotSuccess(false);
  }

  function closeForgotPassword() {
    setForgotView(null);
    setForgotEmail("");
    setForgotDevOtp("");
    setForgotCode("");
    setNewPassword("");
    setConfirmPassword("");
    setForgotError("");
    setForgotSuccess(false);
  }

  async function handleForgotRequest(e) {
    e.preventDefault();
    setForgotError("");
    setForgotLoading(true);
    try {
      const res = await api.admin.forgotPassword.request(forgotEmail.trim());
      setForgotDevOtp(res.dev_otp || ""); // dev-mode only — see note below
      setForgotCode(res.dev_otp || "");    // pre-fill for convenience while dev-mode
      setForgotView("reset");
    } catch (err) {
      setForgotError(err.message || "Failed to send reset code");
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleForgotReset(e) {
    e.preventDefault();
    setForgotError("");
    setForgotLoading(true);
    try {
      await api.admin.forgotPassword.reset(forgotEmail.trim(), forgotCode.trim(), newPassword, confirmPassword);
      setForgotSuccess(true);
    } catch (err) {
      setForgotError(err.message || "Failed to reset password");
    } finally {
      setForgotLoading(false);
    }
  }

  const cardStyle = {
    width: 380,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 32,
    boxShadow: dark ? "0 8px 32px rgba(0,0,0,0.4)" : "0 8px 32px rgba(0,0,0,0.08)",
  };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 };
  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--input-bg)",
    color: "var(--text)",
    fontSize: 14,
    marginBottom: 16,
    outline: "none",
  };
  const btnStyle = (loading) => ({
    width: "100%",
    padding: "12px",
    borderRadius: 10,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: loading ? "default" : "pointer",
    opacity: loading ? 0.7 : 1,
  });
  const errorBoxStyle = {
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    color: "#EF4444",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    marginBottom: 16,
  };
  const backLinkStyle = {
    width: "100%", padding: "10px", marginTop: 10, borderRadius: 10,
    border: "none", background: "transparent", color: "var(--muted)",
    fontSize: 12, cursor: "pointer",
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
    }}>
      {forgotView ? (
        <div style={cardStyle}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <span style={{ fontWeight: 800, fontSize: 20, color: "var(--accent)", letterSpacing: "-0.5px" }}>
              🏥 MediAlert
            </span>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
              {forgotSuccess ? "Password Reset" : "Reset Your Password"}
            </div>
          </div>

          {forgotSuccess ? (
            <>
              <div style={{
                background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
                color: "#22C55E", borderRadius: 10, padding: "10px 12px", fontSize: 13,
                marginBottom: 20, textAlign: "center",
              }}>
                ✅ Your password has been reset. You can now sign in with your new password.
              </div>
              <button type="button" onClick={closeForgotPassword} style={btnStyle(false)}>
                Back to Sign In
              </button>
            </>
          ) : forgotView === "request" ? (
            <form onSubmit={handleForgotRequest}>
              <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 16, textAlign: "center" }}>
                Enter your admin email and we'll send a reset code.
              </div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                autoFocus
                style={inputStyle}
              />
              {forgotError && <div style={errorBoxStyle}>{forgotError}</div>}
              <button type="submit" disabled={forgotLoading} style={btnStyle(forgotLoading)}>
                {forgotLoading ? "Sending…" : "Send Reset Code"}
              </button>
              <button type="button" onClick={closeForgotPassword} style={backLinkStyle}>
                ← Back to login
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotReset}>
              {forgotDevOtp && (
                <div style={{
                  background: "#f59e0b12", border: "1px solid #f59e0b44", borderRadius: 10,
                  padding: "10px 12px", fontSize: 12, color: "var(--text)", marginBottom: 16,
                  textAlign: "center",
                }}>
                  ⚠️ DEV MODE — no email is actually sent yet. Your code is <strong>{forgotDevOtp}</strong> (pre-filled below).
                </div>
              )}
              <label style={labelStyle}>Reset Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={forgotCode}
                onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                style={{ ...inputStyle, textAlign: "center", letterSpacing: "6px", fontSize: 18, fontWeight: 700 }}
              />
              <label style={labelStyle}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                style={inputStyle}
              />
              <label style={labelStyle}>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                style={inputStyle}
              />
              {forgotError && <div style={errorBoxStyle}>{forgotError}</div>}
              <button type="submit" disabled={forgotLoading} style={btnStyle(forgotLoading)}>
                {forgotLoading ? "Resetting…" : "Reset Password"}
              </button>
              <button type="button" onClick={closeForgotPassword} style={backLinkStyle}>
                ← Back to login
              </button>
            </form>
          )}
        </div>
      ) : !pendingToken ? (
        <form onSubmit={handleSubmit} style={cardStyle}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <span style={{ fontWeight: 800, fontSize: 20, color: "var(--accent)", letterSpacing: "-0.5px" }}>
              🏥 MediAlert
            </span>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
              Admin Login
            </div>
          </div>

          {timedOut && (
            <div style={{
              background: "#f59e0b12", border: "1px solid #f59e0b44", borderRadius: 10,
              padding: "10px 12px", fontSize: 12, color: "var(--text)", marginBottom: 16, textAlign: "center",
            }}>
              ⏰ You were logged out due to inactivity. Please sign in again.
            </div>
          )}

          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            style={inputStyle}
          />

          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ ...inputStyle, marginBottom: 8 }}
          />

          <div style={{ textAlign: "right", marginBottom: 16 }}>
            <button
              type="button"
              onClick={openForgotPassword}
              style={{
                border: "none", background: "transparent", color: "var(--accent)",
                fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0,
              }}
            >
              Forgot password?
            </button>
          </div>

          {error && <div style={errorBoxStyle}>{error}</div>}

          <button type="submit" disabled={loading} style={btnStyle(loading)}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleMfaSubmit} style={cardStyle}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <span style={{ fontWeight: 800, fontSize: 20, color: "var(--accent)", letterSpacing: "-0.5px" }}>
              🏥 MediAlert
            </span>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
              Two-Factor Authentication
            </div>
          </div>

          <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 16, textAlign: "center" }}>
            Enter the 6-digit code from your authenticator app.
          </div>

          <label style={labelStyle}>Authentication Code</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            autoFocus
            placeholder="000000"
            style={{ ...inputStyle, marginBottom: 20, textAlign: "center", letterSpacing: "6px", fontSize: 20, fontWeight: 700 }}
          />

          {error && <div style={errorBoxStyle}>{error}</div>}

          <button type="submit" disabled={mfaLoading || mfaCode.length !== 6} style={btnStyle(mfaLoading)}>
            {mfaLoading ? "Verifying..." : "Verify & Sign In"}
          </button>

          <button type="button" onClick={backToPassword} style={backLinkStyle}>
            ← Back to login
          </button>
        </form>
      )}
    </div>
  );
}
