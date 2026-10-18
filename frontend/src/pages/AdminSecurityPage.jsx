import { useState } from "react";
import { useStore } from "../store";
import api from "../api/client";

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 420, background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 24,
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

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 10,
  border: "1px solid var(--border)", background: "var(--input-bg)",
  color: "var(--text)", fontSize: 13, outline: "none",
};

export default function AdminSecurityPage() {
  const { adminUser, adminToken, setAdmin } = useStore();

  const [mfaSetupOpen, setMfaSetupOpen] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState(null); // { secret, provisioning_uri, qr_code_base64 }
  const [mfaConfirmCode, setMfaConfirmCode] = useState("");
  const [mfaSetupError, setMfaSetupError] = useState("");
  const [mfaSetupLoading, setMfaSetupLoading] = useState(false);
  const [mfaSetupSaving, setMfaSetupSaving] = useState(false);

  const [mfaDisableOpen, setMfaDisableOpen] = useState(false);
  const [mfaDisablePassword, setMfaDisablePassword] = useState("");
  const [mfaDisableError, setMfaDisableError] = useState("");
  const [mfaDisableSaving, setMfaDisableSaving] = useState(false);

  async function refreshCurrentAdmin() {
    try {
      const me = await api.admin.me();
      setAdmin(adminToken, me);
    } catch {
      // non-fatal — status will just look stale until next page load
    }
  }

  async function openMfaSetup() {
    setMfaSetupError("");
    setMfaConfirmCode("");
    setMfaSetupLoading(true);
    setMfaSetupOpen(true);
    try {
      const data = await api.admin.mfa.setup();
      setMfaSetupData(data);
    } catch (err) {
      setMfaSetupError(err.message || "Failed to start MFA setup");
    } finally {
      setMfaSetupLoading(false);
    }
  }

  async function confirmMfaSetup() {
    setMfaSetupError("");
    if (mfaConfirmCode.trim().length !== 6) {
      setMfaSetupError("Enter the 6-digit code from your authenticator app");
      return;
    }
    setMfaSetupSaving(true);
    try {
      await api.admin.mfa.enable(mfaConfirmCode.trim());
      setMfaSetupOpen(false);
      setMfaSetupData(null);
      await refreshCurrentAdmin();
    } catch (err) {
      setMfaSetupError(err.message || "Incorrect code");
    } finally {
      setMfaSetupSaving(false);
    }
  }

  async function confirmMfaDisable() {
    setMfaDisableError("");
    if (!mfaDisablePassword) {
      setMfaDisableError("Enter your password to confirm");
      return;
    }
    setMfaDisableSaving(true);
    try {
      await api.admin.mfa.disable(mfaDisablePassword);
      setMfaDisableOpen(false);
      setMfaDisablePassword("");
      await refreshCurrentAdmin();
    } catch (err) {
      setMfaDisableError(err.message || "Incorrect password");
    } finally {
      setMfaDisableSaving(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>My Security</h2>
        <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
          Manage two-factor authentication for {adminUser?.name} ({adminUser?.id})
        </div>
      </div>

      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
        padding: 20, display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Two-Factor Authentication</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {adminUser?.mfa_enabled
              ? "Enabled — an authenticator app code is required at login."
              : "Not enabled. Add an extra layer of security to your account."}
          </div>
        </div>
        {adminUser?.mfa_enabled ? (
          <button onClick={() => { setMfaDisableOpen(true); setMfaDisableError(""); setMfaDisablePassword(""); }} style={{
            padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.4)",
            background: "transparent", color: "#EF4444", fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}>
            Disable 2FA
          </button>
        ) : (
          <button onClick={openMfaSetup} style={{
            padding: "9px 16px", borderRadius: 10, border: "none",
            background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}>
            Enable 2FA
          </button>
        )}
      </div>

      {mfaSetupOpen && (
        <Modal title="Enable Two-Factor Authentication" onClose={() => { setMfaSetupOpen(false); setMfaSetupData(null); }}>
          {mfaSetupLoading && <div style={{ color: "var(--muted)", padding: 20, textAlign: "center" }}>Generating your code…</div>}
          {mfaSetupError && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 12 }}>{mfaSetupError}</div>}
          {mfaSetupData && !mfaSetupLoading && (
            <>
              <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 14 }}>
                Scan this QR code with Google Authenticator, Authy, or any TOTP app.
              </div>
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <img src={mfaSetupData.qr_code_base64} alt="MFA QR code" style={{ width: 180, height: 180, borderRadius: 10, background: "#fff", padding: 8 }} />
              </div>
              <div style={{
                background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 8,
                padding: "8px 12px", fontSize: 11, color: "var(--muted)", marginBottom: 16, wordBreak: "break-all",
              }}>
                Can't scan? Enter manually: <strong style={{ color: "var(--text)" }}>{mfaSetupData.secret}</strong>
              </div>
              <Field label="Enter the 6-digit code to confirm">
                <input
                  style={{ ...inputStyle, textAlign: "center", letterSpacing: "4px", fontSize: 16, fontWeight: 700 }}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaConfirmCode}
                  onChange={(e) => setMfaConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </Field>
              <button onClick={confirmMfaSetup} disabled={mfaSetupSaving} style={{
                width: "100%", padding: 11, borderRadius: 10, border: "none",
                background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13,
                cursor: mfaSetupSaving ? "default" : "pointer", opacity: mfaSetupSaving ? 0.7 : 1,
              }}>
                {mfaSetupSaving ? "Confirming…" : "Confirm & Enable"}
              </button>
            </>
          )}
        </Modal>
      )}

      {mfaDisableOpen && (
        <Modal title="Disable Two-Factor Authentication" onClose={() => setMfaDisableOpen(false)}>
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "var(--text)", marginBottom: 16,
          }}>
            This removes the extra login step. Enter your password to confirm.
          </div>
          <Field label="Password">
            <input
              style={inputStyle}
              type="password"
              value={mfaDisablePassword}
              onChange={(e) => setMfaDisablePassword(e.target.value)}
            />
          </Field>
          {mfaDisableError && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 12 }}>{mfaDisableError}</div>}
          <button onClick={confirmMfaDisable} disabled={mfaDisableSaving} style={{
            width: "100%", padding: 11, borderRadius: 10, border: "none",
            background: "#EF4444", color: "#fff", fontWeight: 700, fontSize: 13,
            cursor: mfaDisableSaving ? "default" : "pointer", opacity: mfaDisableSaving ? 0.7 : 1,
          }}>
            {mfaDisableSaving ? "Disabling…" : "Disable 2FA"}
          </button>
        </Modal>
      )}
    </div>
  );
}
