import { useEffect, useState } from "react";
import { useStore } from "../store";
import api from "../api/client";

const ROLES = ["admin", "super_admin"];

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

export default function AdminManagementPage() {
  const { adminUser } = useStore();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // admin object or null

  const [form, setForm] = useState({ name: "", email: "", password: "", role: "admin" });
  const [editForm, setEditForm] = useState({ name: "", email: "", password: "", role: "admin", is_active: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // True only when the Super Admin has opened the Edit modal on their OWN
  // account — that's the one case where a password field is allowed here.
  const isEditingSelf = editTarget && adminUser && editTarget.id === adminUser.id;

  async function loadAdmins() {
    setLoading(true);
    setError("");
    try {
      const data = await api.admin.listAdmins();
      setAdmins(data);
    } catch (err) {
      setError(err.message || "Failed to load admins");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAdmins(); }, []);

  function openEdit(admin) {
    setEditForm({
      name: admin.name,
      email: admin.email,
      password: "",
      role: admin.role,
      is_active: admin.is_active,
    });
    setEditTarget(admin);
    setFormError("");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await api.admin.createAdmin(form);
      setForm({ name: "", email: "", password: "", role: "admin" });
      setShowCreate(false);
      loadAdmins();
    } catch (err) {
      setFormError(err.message || "Failed to create admin");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = { ...editForm };
      // Never send a password field when editing someone else — keeps the
      // request body clean and matches what the backend will accept anyway.
      if (!payload.password || !isEditingSelf) delete payload.password;
      await api.admin.updateAdmin(editTarget.id, payload);
      setEditTarget(null);
      loadAdmins();
    } catch (err) {
      setFormError(err.message || "Failed to update admin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>Admin Management</h2>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Signed in as {adminUser?.name} ({adminUser?.id}) — Super Admin
          </div>
        </div>
        <button onClick={() => { setShowCreate(true); setFormError(""); }} style={{
          padding: "10px 18px", borderRadius: 10, border: "none",
          background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
        }}>
          + Add Admin
        </button>
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
              {["ID", "Name", "Email", "Role", "Status", "2FA", "Last Login", ""].map((h) => (
                <th key={h} style={{ padding: "12px 16px", color: "var(--muted)", fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>Loading…</td></tr>
            )}
            {!loading && admins.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>No admins found</td></tr>
            )}
            {admins.map((a) => (
              <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px", fontWeight: 600 }}>{a.id}</td>
                <td style={{ padding: "12px 16px" }}>{a.name}</td>
                <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{a.email}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: a.role === "super_admin" ? "rgba(59,130,246,0.15)" : "rgba(148,163,184,0.15)",
                    color: a.role === "super_admin" ? "var(--accent)" : "var(--muted)",
                  }}>
                    {a.role === "super_admin" ? "Super Admin" : "Admin"}
                  </span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: a.is_active ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                    color: a.is_active ? "#22C55E" : "#EF4444",
                  }}>
                    {a.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: a.mfa_enabled ? "rgba(34,197,94,0.15)" : "rgba(148,163,184,0.15)",
                    color: a.mfa_enabled ? "#22C55E" : "var(--muted)",
                  }}>
                    {a.mfa_enabled ? "On" : "Off"}
                  </span>
                </td>
                <td style={{ padding: "12px 16px", color: "var(--muted)" }}>
                  {a.last_login_at ? new Date(a.last_login_at).toLocaleString() : "Never"}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                  <button onClick={() => openEdit(a)} style={{
                    padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)",
                    background: "transparent", color: "var(--text)", fontSize: 12, cursor: "pointer",
                  }}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Add Admin" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <Field label="Name">
              <input style={inputStyle} required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input style={inputStyle} type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Password">
              <input style={inputStyle} type="password" required minLength={8} value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Field label="Role">
              <select style={inputStyle} value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r === "super_admin" ? "Super Admin" : "Admin"}</option>)}
              </select>
            </Field>
            {formError && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 12 }}>{formError}</div>}
            <button type="submit" disabled={saving} style={{
              width: "100%", padding: 11, borderRadius: 10, border: "none",
              background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13,
              cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1,
            }}>
              {saving ? "Creating…" : "Create Admin"}
            </button>
          </form>
        </Modal>
      )}

      {editTarget && (
        <Modal title={`Edit ${editTarget.id}`} onClose={() => setEditTarget(null)}>
          <form onSubmit={handleEditSave}>
            <Field label="Name">
              <input style={inputStyle} required value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input style={inputStyle} type="email" required value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </Field>

            {isEditingSelf ? (
              <Field label="New Password (leave blank to keep unchanged)">
                <input style={inputStyle} type="password" minLength={8} value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
              </Field>
            ) : (
              <div style={{
                background: "var(--stat-bg)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "var(--muted)",
                marginBottom: 14, lineHeight: 1.5,
              }}>
                🔒 You can only change your own password here. {editTarget.name} must change
                it themselves from their own <strong>My Security</strong> page, or reset it
                via the forgot-password link on the login screen.
              </div>
            )}

            <Field label="Role">
              <select style={inputStyle} value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r === "super_admin" ? "Super Admin" : "Admin"}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select style={inputStyle} value={editForm.is_active ? "active" : "inactive"}
                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === "active" })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            {formError && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 12 }}>{formError}</div>}
            <button type="submit" disabled={saving} style={{
              width: "100%", padding: 11, borderRadius: 10, border: "none",
              background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13,
              cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1,
            }}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
