import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../store";
import api from "../api/client";

const CATEGORIES = ["Incorrect Information", "Technical Issue", "Billing Question", "Privacy Concern", "Other"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];

const STATUS_COLORS = {
  Pending: { bg: "rgba(148,163,184,0.15)", fg: "var(--muted)" },
  "Under Review": { bg: "rgba(245,158,11,0.15)", fg: "#F59E0B" },
  "Waiting for Patient Feedback": { bg: "rgba(59,130,246,0.15)", fg: "var(--accent)" },
  Closed: { bg: "rgba(148,163,184,0.15)", fg: "var(--muted)" },
  Reopened: { bg: "rgba(239,68,68,0.15)", fg: "#EF4444" },
  Rejected: { bg: "rgba(239,68,68,0.15)", fg: "#EF4444" },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.Pending;
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: c.bg, color: c.fg,
    }}>
      {status}
    </span>
  );
}

function closureLabel(issue) {
  if (issue.status !== "Closed") return null;
  if (issue.patient_satisfaction === "satisfied") return "You marked this Satisfied";
  if (issue.patient_satisfaction === "auto_closed_no_response") return "Auto-closed (no response)";
  return "Closed by Admin";
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: wide ? 560 : 420, maxHeight: "80vh", overflowY: "auto",
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

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 10,
  border: "1px solid var(--border)", background: "var(--input-bg)",
  color: "var(--text)", fontSize: 13, outline: "none",
};

export default function SupportCenterPage() {
  const { patient } = useStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showReport, setShowReport] = useState(!!location.state?.relatedChangeNumber);
  const [form, setForm] = useState({
    category: CATEGORIES[0],
    description: "",
    priority: "Medium",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [detailIssue, setDetailIssue] = useState(null);
  const [satisfactionSaving, setSatisfactionSaving] = useState(false);

  const relatedChangeNumber = location.state?.relatedChangeNumber || null;

  async function loadIssues() {
    setLoading(true);
    setError("");
    try {
      const data = await api.issues.forPatient(patient.id);
      setIssues(data);
    } catch (err) {
      setError(err.message || "Failed to load issues");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (patient?.id) loadIssues(); }, [patient?.id]);

  async function handleReport(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await api.issues.report({
        patient_id: patient.id,
        category: form.category,
        description: form.description,
        priority: form.priority,
        related_change_number: relatedChangeNumber,
      });
      setForm({ category: CATEGORIES[0], description: "", priority: "Medium" });
      setShowReport(false);
      navigate(location.pathname, { replace: true, state: {} }); // clear the prefill state
      loadIssues();
    } catch (err) {
      setFormError(err.message || "Failed to report issue");
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(issue) {
    setDetailIssue(await api.issues.get(issue.id));
  }

  async function handleSatisfaction(satisfaction) {
    setSatisfactionSaving(true);
    try {
      const updated = await api.issues.satisfaction(detailIssue.id, { satisfaction });
      setDetailIssue(updated);
      loadIssues();
    } catch (err) {
      alert(err.message || "Failed to submit response");
    } finally {
      setSatisfactionSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>Support Center</h2>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Report an issue and track its resolution
          </div>
        </div>
        <button onClick={() => { setShowReport(true); setFormError(""); }} style={{
          padding: "10px 18px", borderRadius: 10, border: "none",
          background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
        }}>
          + Report Issue
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

      {loading && <div style={{ color: "var(--muted)", padding: 20 }}>Loading…</div>}

      {!loading && issues.length === 0 && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
          padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13,
        }}>
          No issues reported yet.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {issues.map((issue) => (
          <div key={issue.id} onClick={() => openDetail(issue)} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 14, padding: 16, cursor: "pointer",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{issue.token_number} — {issue.category}</span>
              <StatusBadge status={issue.status} />
            </div>
            {closureLabel(issue) && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{closureLabel(issue)}</div>
            )}
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              {issue.description.length > 100 ? issue.description.slice(0, 100) + "…" : issue.description}
            </div>
          </div>
        ))}
      </div>

      {showReport && (
        <Modal title="Report an Issue" onClose={() => setShowReport(false)}>
          <form onSubmit={handleReport}>
            {relatedChangeNumber && (
              <div style={{
                background: "var(--stat-bg)", borderRadius: 10, padding: "8px 12px",
                fontSize: 12, color: "var(--muted)", marginBottom: 14,
              }}>
                Attached: Change #{relatedChangeNumber} on record {patient.id}
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>Category</label>
              <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>Priority</label>
              <select style={inputStyle} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>Description</label>
              <textarea required rows={4} style={{ ...inputStyle, resize: "vertical" }} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            {formError && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 12 }}>{formError}</div>}
            <button type="submit" disabled={saving} style={{
              width: "100%", padding: 11, borderRadius: 10, border: "none",
              background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13,
              cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1,
            }}>
              {saving ? "Submitting…" : "Submit Issue"}
            </button>
          </form>
        </Modal>
      )}

      {detailIssue && (
        <Modal title={`${detailIssue.token_number} — ${detailIssue.category}`} onClose={() => setDetailIssue(null)} wide>
          <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <StatusBadge status={detailIssue.status} />
            {closureLabel(detailIssue) && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>· {closureLabel(detailIssue)}</span>
            )}
          </div>
          <div style={{ fontSize: 13, marginBottom: 16 }}>{detailIssue.description}</div>

          {detailIssue.responses.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Responses</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {detailIssue.responses.map((r) => (
                  <div key={r.id} style={{
                    background: "var(--input-bg)", borderRadius: 10, padding: 12, fontSize: 13,
                  }}>
                    <div style={{ marginBottom: 4 }}>{r.message}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      — {r.admin_name}, {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detailIssue.status === "Waiting for Patient Feedback" && !detailIssue.patient_satisfaction && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Is this resolved to your satisfaction?</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button disabled={satisfactionSaving} onClick={() => handleSatisfaction("satisfied")} style={{
                  flex: 1, padding: 10, borderRadius: 10, border: "none",
                  background: "#22C55E", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}>
                  Satisfied
                </button>
                <button disabled={satisfactionSaving} onClick={() => handleSatisfaction("not_satisfied")} style={{
                  flex: 1, padding: 10, borderRadius: 10, border: "1px solid var(--border)",
                  background: "transparent", color: "var(--text)", fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}>
                  Not Satisfied
                </button>
              </div>
            </div>
          )}

          {detailIssue.status === "Reopened" && (
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "var(--text)",
            }}>
              This issue has been reopened and an admin has been notified. You'll hear back with a new response soon.
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
