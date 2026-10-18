import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../store";
import api from "../api/client";

const STATUS_TABS = [
  { key: "active", label: "Active" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All" },
];

// Fields the admin can edit — mirrors backend EDITABLE_FIELDS in admin_patients.py
const EDIT_FIELDS = [
  { key: "name", label: "Name", type: "text" },
  { key: "age", label: "Age", type: "number" },
  { key: "gender", label: "Gender", type: "select", options: ["Male", "Female", "Other"] },
  { key: "blood_group", label: "Blood Group", type: "select", options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
  { key: "mobile_number", label: "Mobile Number", type: "text" },
  { key: "date_of_birth", label: "Date of Birth", type: "date" },
  { key: "allergies", label: "Allergies", type: "text" },
  { key: "known_conditions", label: "Known Conditions", type: "text" },
  { key: "current_medications", label: "Current Medications", type: "text" },
  { key: "emergency_contact", label: "Emergency Contact Name", type: "text" },
  { key: "emergency_contact_phone", label: "Emergency Contact Phone", type: "text" },
  { key: "guardian_name", label: "Guardian Name", type: "text" },
  { key: "guardian_phone", label: "Guardian Phone", type: "text" },
  { key: "preferred_language", label: "Preferred Language", type: "text" },
];

const REQUIRED_CREATE_FIELDS = ["name", "age", "gender"];

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: wide ? 860 : 460, maxHeight: "85vh", overflowY: "auto",
        background: "var(--surface)", border: "1px solid var(--border)",
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

function fieldLabel(edited_column) {
  if (edited_column === "__lifecycle__") return "Record Status";
  return edited_column
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function inputStyle() {
  return {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)",
    background: "var(--input-bg)", color: "var(--text)", fontSize: 13, outline: "none",
    boxSizing: "border-box",
  };
}

function labelStyle() {
  return { display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 5, fontWeight: 600 };
}

function FormField({ field, value, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle()}>{field.label}</label>
      {field.type === "select" ? (
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={inputStyle()}>
          <option value="">Select…</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={field.type}
          value={value ?? ""}
          onChange={(e) => onChange(field.type === "number" ? e.target.value.replace(/[^0-9]/g, "") : e.target.value)}
          style={inputStyle()}
        />
      )}
    </div>
  );
}

function primaryButton(disabled) {
  return {
    padding: "9px 18px", borderRadius: 8, border: "none",
    background: disabled ? "var(--border)" : "var(--accent)",
    color: "#fff", fontSize: 13, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

const RISK_COLORS = { P1: "#EF4444", P2: "#F59E0B", P3: "#22C55E" };

export default function AdminPatientsPage() {
  const { adminUser } = useStore();
  const isSuperAdmin = adminUser?.role === "super_admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  // ── Add Patient ──
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({});
  const [createConsent, setCreateConsent] = useState(false);
  const [createReason, setCreateReason] = useState("Patient registered by admin");
  const [createError, setCreateError] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  // ── Edit Patient ──
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editReason, setEditReason] = useState("");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // ── Archive / Restore ──
  const [lifecycleTarget, setLifecycleTarget] = useState(null); // { patient, action: "archive" | "restore" }
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [lifecycleError, setLifecycleError] = useState("");
  const [lifecycleSaving, setLifecycleSaving] = useState(false);

  // ── Permanent Delete (Super Admin only) ──
  const [deleteTarget, setDeleteTarget] = useState(null); // patient object
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Debounce the search box before hitting the backend.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      if (search.trim()) setSearchParams({ q: search.trim() });
      else setSearchParams({});
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  async function loadPatients() {
    setLoading(true);
    setError("");
    try {
      const data = await api.admin.listPatients(status, debouncedSearch);
      setPatients(data);
    } catch (err) {
      setError(err.message || "Failed to load patients");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPatients(); }, [status, debouncedSearch]);

  async function openHistory(patient) {
    setHistoryTarget(patient);
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const entries = await api.admin.auditForPatient(patient.id);
      setHistoryEntries(entries);
    } catch (err) {
      setHistoryError(err.message || "Failed to load audit history");
    } finally {
      setHistoryLoading(false);
    }
  }

  // ── Add Patient handlers ──
  function openCreate() {
    setCreateForm({ preferred_language: "en" });
    setCreateConsent(false);
    setCreateReason("Patient registered by admin");
    setCreateError("");
    setShowCreate(true);
  }

  async function submitCreate() {
    setCreateError("");
    const missing = REQUIRED_CREATE_FIELDS.filter((f) => !createForm[f]);
    if (missing.length) {
      setCreateError(`Please fill in: ${missing.map((f) => f.charAt(0).toUpperCase() + f.slice(1)).join(", ")}`);
      return;
    }
    setCreateSaving(true);
    try {
      const payload = {
        ...createForm,
        age: createForm.age ? Number(createForm.age) : undefined,
        consent_given: createConsent,
        reason: createReason || "Patient registered by admin",
      };
      await api.admin.createPatient(payload);
      setShowCreate(false);
      loadPatients();
    } catch (err) {
      setCreateError(err.message || "Failed to create patient");
    } finally {
      setCreateSaving(false);
    }
  }

  // ── Edit handlers ──
  function openEdit(patient) {
    const initial = {};
    EDIT_FIELDS.forEach((f) => { initial[f.key] = patient[f.key] ?? ""; });
    setEditTarget(patient);
    setEditForm(initial);
    setEditReason("");
    setEditError("");
  }

  async function submitEdit() {
    setEditError("");
    if (editReason.trim().length < 3) {
      setEditError("Reason must be at least 3 characters.");
      return;
    }
    // Only send fields that actually changed, to keep the audit trail clean.
    const changed = {};
    EDIT_FIELDS.forEach((f) => {
      const newVal = f.type === "number" && editForm[f.key] !== "" ? Number(editForm[f.key]) : editForm[f.key];
      const oldVal = editTarget[f.key] ?? "";
      if (String(newVal ?? "") !== String(oldVal ?? "")) {
        changed[f.key] = newVal === "" ? null : newVal;
      }
    });
    if (Object.keys(changed).length === 0) {
      setEditError("No fields were changed.");
      return;
    }
    setEditSaving(true);
    try {
      await api.admin.editPatient(editTarget.id, { ...changed, reason: editReason.trim() });
      setEditTarget(null);
      loadPatients();
    } catch (err) {
      setEditError(err.message || "Failed to save changes");
    } finally {
      setEditSaving(false);
    }
  }

  // ── Archive / Restore handlers ──
  function openLifecycle(patient, action) {
    setLifecycleTarget({ patient, action });
    setLifecycleReason("");
    setLifecycleError("");
  }

  async function submitLifecycle() {
    setLifecycleError("");
    const { patient, action } = lifecycleTarget;
    if (action === "archive" && lifecycleReason.trim().length < 3) {
      setLifecycleError("Reason must be at least 3 characters.");
      return;
    }
    setLifecycleSaving(true);
    try {
      if (action === "archive") {
        await api.admin.archivePatient(patient.id, lifecycleReason.trim());
      } else {
        await api.admin.restorePatient(patient.id, lifecycleReason.trim() || undefined);
      }
      setLifecycleTarget(null);
      loadPatients();
    } catch (err) {
      setLifecycleError(err.message || `Failed to ${action} patient`);
    } finally {
      setLifecycleSaving(false);
    }
  }

  // ── Permanent Delete handlers ──
  function openDelete(patient) {
    setDeleteTarget(patient);
    setDeleteReason("");
    setDeleteConfirmText("");
    setDeletePassword("");
    setDeleteError("");
  }

  async function submitDelete() {
    setDeleteError("");
    if (deleteReason.trim().length < 3) {
      setDeleteError("Reason must be at least 3 characters.");
      return;
    }
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
      setDeleteError('Type "DELETE" to confirm — this cannot be undone.');
      return;
    }
    if (!deletePassword) {
      setDeleteError("Enter your password to confirm this action.");
      return;
    }
    setDeleteSaving(true);
    try {
      await api.admin.permanentlyDeletePatient(deleteTarget.id, deleteReason.trim(), deletePassword);
      setDeleteTarget(null);
      loadPatients();
    } catch (err) {
      setDeleteError(err.message || "Failed to permanently delete patient");
    } finally {
      setDeleteSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>Patients</h2>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            View, edit, and manage patients and their audit history
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, Name, Mobile, Disease, Blood Group…"
            style={{
              padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border)",
              background: "var(--input-bg)", color: "var(--text)", fontSize: 13, width: 280, outline: "none",
            }}
          />
          <button onClick={openCreate} style={{
            padding: "9px 16px", borderRadius: 10, border: "none",
            background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
            whiteSpace: "nowrap",
          }}>
            + Add Patient
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {STATUS_TABS.map((t) => (
          <button key={t.key} onClick={() => setStatus(t.key)} style={{
            padding: "7px 16px", borderRadius: 999, border: "1px solid var(--border)",
            background: status === t.key ? "var(--accent)" : "transparent",
            color: status === t.key ? "#fff" : "var(--text)",
            fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>
            {t.label}
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
              {[
                "Patient ID", "Name", "Mobile", "Blood Group", "Latest Diagnosis", "Risk", "Status", "Registered",
                ...(status === "archived" ? ["Removed By", "Reason"] : []),
                "",
              ].map((h) => (
                <th key={h} style={{ padding: "12px 16px", color: "var(--muted)", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={status === "archived" ? 11 : 9} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>Loading…</td></tr>
            )}
            {!loading && patients.length === 0 && (
              <tr><td colSpan={status === "archived" ? 11 : 9} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>
                {debouncedSearch ? `No patients match "${debouncedSearch}"` : "No patients found"}
              </td></tr>
            )}
            {patients.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px", fontWeight: 600 }}>{p.id}</td>
                <td style={{ padding: "12px 16px" }}>{p.name}</td>
                <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{p.mobile_number || "—"}</td>
                <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{p.blood_group || "—"}</td>
                <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{p.latest_diagnosis || "—"}</td>
                <td style={{ padding: "12px 16px" }}>
                  {p.latest_triage ? (
                    <span style={{
                      padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: `${RISK_COLORS[p.latest_triage] || "#94A3B8"}22`,
                      color: RISK_COLORS[p.latest_triage] || "var(--muted)",
                    }}>
                      {p.latest_triage}
                    </span>
                  ) : "—"}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: p.is_archived ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
                    color: p.is_archived ? "#EF4444" : "#22C55E",
                  }}>
                    {p.is_archived ? "Archived" : "Active"}
                  </span>
                </td>
                <td style={{ padding: "12px 16px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                </td>
                {status === "archived" && (
                  <>
                    <td style={{ padding: "12px 16px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {p.removed_by_name ? `${p.removed_by_name} (${p.removed_by_id})` : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--muted)", maxWidth: 200 }}>
                      {p.removal_reason || "—"}
                    </td>
                  </>
                )}
                <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => openHistory(p)} style={{
                      padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)",
                      background: "transparent", color: "var(--text)", fontSize: 12, cursor: "pointer",
                    }}>
                      History
                    </button>
                    {!p.is_archived && (
                      <button onClick={() => openEdit(p)} style={{
                        padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)",
                        background: "transparent", color: "var(--text)", fontSize: 12, cursor: "pointer",
                      }}>
                        Edit
                      </button>
                    )}
                    {p.is_archived ? (
                      <button onClick={() => openLifecycle(p, "restore")} style={{
                        padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(34,197,94,0.4)",
                        background: "transparent", color: "#22C55E", fontSize: 12, cursor: "pointer",
                      }}>
                        Restore
                      </button>
                    ) : (
                      <button onClick={() => openLifecycle(p, "archive")} style={{
                        padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.4)",
                        background: "transparent", color: "#EF4444", fontSize: 12, cursor: "pointer",
                      }}>
                        Archive
                      </button>
                    )}
                    {p.is_archived && isSuperAdmin && (
                      <button onClick={() => openDelete(p)} style={{
                        padding: "6px 12px", borderRadius: 8, border: "1px solid #EF4444",
                        background: "#EF444422", color: "#EF4444", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      }}>
                        Delete Permanently
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── View History Modal ── */}
      {historyTarget && (
        <Modal title={`Audit History — ${historyTarget.name} (${historyTarget.id})`} onClose={() => setHistoryTarget(null)} wide>
          {historyLoading && <div style={{ color: "var(--muted)", padding: 20, textAlign: "center" }}>Loading…</div>}
          {historyError && (
            <div style={{ color: "#EF4444", fontSize: 13, padding: "10px 0" }}>{historyError}</div>
          )}
          {!historyLoading && !historyError && historyEntries.length === 0 && (
            <div style={{ color: "var(--muted)", padding: 20, textAlign: "center" }}>No changes recorded yet.</div>
          )}
          {!historyLoading && historyEntries.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {historyEntries.map((e) => (
                <div key={e.change_number} style={{
                  border: "1px solid var(--border)", borderRadius: 12, padding: 14,
                  background: "var(--input-bg)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>
                      #{e.change_number} — {fieldLabel(e.edited_column)}
                    </span>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{e.date} · {e.time}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                    {e.edited_column === "__lifecycle__" ? (
                      <>Status changed to <strong style={{ color: "var(--text)" }}>{e.new_value}</strong></>
                    ) : (
                      <>
                        <span style={{ textDecoration: "line-through" }}>{e.previous_value || "(empty)"}</span>
                        {" → "}
                        <strong style={{ color: "var(--text)" }}>{e.new_value || "(empty)"}</strong>
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    By {e.admin_name} ({e.admin_id}) — "{e.reason}"
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* ── Add Patient Modal ── */}
      {showCreate && (
        <Modal title="Add Patient" onClose={() => setShowCreate(false)} wide>
          {createError && (
            <div style={{ color: "#EF4444", fontSize: 13, marginBottom: 14 }}>{createError}</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
            {[
              { key: "name", label: "Name *", type: "text" },
              { key: "age", label: "Age *", type: "number" },
              { key: "gender", label: "Gender *", type: "select", options: ["Male", "Female", "Other"] },
              ...EDIT_FIELDS.filter((f) => !["name", "age", "gender"].includes(f.key)),
            ].map((f) => (
              <FormField
                key={f.key}
                field={f}
                value={createForm[f.key]}
                onChange={(v) => setCreateForm((prev) => ({ ...prev, [f.key]: v }))}
              />
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, margin: "6px 0 14px" }}>
            <input type="checkbox" checked={createConsent} onChange={(e) => setCreateConsent(e.target.checked)} />
            Patient consent obtained
          </label>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle()}>Reason (for audit log)</label>
            <input value={createReason} onChange={(e) => setCreateReason(e.target.value)} style={inputStyle()} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={() => setShowCreate(false)} style={{
              padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text)", fontSize: 13, cursor: "pointer",
            }}>
              Cancel
            </button>
            <button onClick={submitCreate} disabled={createSaving} style={primaryButton(createSaving)}>
              {createSaving ? "Saving…" : "Create Patient"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit Patient Modal ── */}
      {editTarget && (
        <Modal title={`Edit — ${editTarget.name} (${editTarget.id})`} onClose={() => setEditTarget(null)} wide>
          {editError && (
            <div style={{ color: "#EF4444", fontSize: 13, marginBottom: 14 }}>{editError}</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
            {EDIT_FIELDS.map((f) => (
              <FormField
                key={f.key}
                field={f}
                value={editForm[f.key]}
                onChange={(v) => setEditForm((prev) => ({ ...prev, [f.key]: v }))}
              />
            ))}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle()}>Reason for this change *</label>
            <input
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="e.g. Hospital Record Correction"
              style={inputStyle()}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={() => setEditTarget(null)} style={{
              padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text)", fontSize: 13, cursor: "pointer",
            }}>
              Cancel
            </button>
            <button onClick={submitEdit} disabled={editSaving} style={primaryButton(editSaving)}>
              {editSaving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Archive / Restore Modal ── */}
      {lifecycleTarget && (
        <Modal
          title={`${lifecycleTarget.action === "archive" ? "Archive" : "Restore"} — ${lifecycleTarget.patient.name} (${lifecycleTarget.patient.id})`}
          onClose={() => setLifecycleTarget(null)}
        >
          {lifecycleError && (
            <div style={{ color: "#EF4444", fontSize: 13, marginBottom: 14 }}>{lifecycleError}</div>
          )}
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
            {lifecycleTarget.action === "archive"
              ? "Archiving hides this patient from the Active list. The record is preserved and can be restored anytime."
              : "Restoring will move this patient back to the Active list."}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle()}>
              Reason {lifecycleTarget.action === "archive" ? "*" : "(optional)"}
            </label>
            <input
              value={lifecycleReason}
              onChange={(e) => setLifecycleReason(e.target.value)}
              placeholder={lifecycleTarget.action === "archive" ? "e.g. Duplicate record" : "e.g. Restored by admin"}
              style={inputStyle()}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={() => setLifecycleTarget(null)} style={{
              padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text)", fontSize: 13, cursor: "pointer",
            }}>
              Cancel
            </button>
            <button onClick={submitLifecycle} disabled={lifecycleSaving} style={primaryButton(lifecycleSaving)}>
              {lifecycleSaving ? "Saving…" : lifecycleTarget.action === "archive" ? "Archive Patient" : "Restore Patient"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Permanent Delete Modal (Super Admin only) ── */}
      {deleteTarget && (
        <Modal title={`Permanently Delete — ${deleteTarget.name} (${deleteTarget.id})`} onClose={() => setDeleteTarget(null)}>
          {deleteError && (
            <div style={{ color: "#EF4444", fontSize: 13, marginBottom: 14 }}>{deleteError}</div>
          )}
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "var(--text)", marginBottom: 16,
          }}>
            ⚠️ This permanently removes the patient record and all related visits, issues, notifications, and
            feedback. This action <strong>cannot be undone</strong>.
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle()}>Reason for permanent deletion *</label>
            <input
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="e.g. Duplicate record, GDPR request"
              style={inputStyle()}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle()}>Your Password *</label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Confirm it's you"
              style={inputStyle()}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle()}>Type "DELETE" to confirm *</label>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              style={inputStyle()}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={() => setDeleteTarget(null)} style={{
              padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text)", fontSize: 13, cursor: "pointer",
            }}>
              Cancel
            </button>
            <button
              onClick={submitDelete}
              disabled={deleteSaving}
              style={{
                padding: "9px 18px", borderRadius: 8, border: "none",
                background: deleteSaving ? "var(--border)" : "#EF4444",
                color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: deleteSaving ? "not-allowed" : "pointer",
              }}
            >
              {deleteSaving ? "Deleting…" : "Permanently Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
