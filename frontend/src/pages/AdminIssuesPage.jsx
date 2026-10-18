import { useEffect, useState } from "react";
import { useStore } from "../store";
import api from "../api/client";

const STATUS_TABS = ["Pending", "Under Review", "Waiting for Patient Feedback", "Closed", "Reopened", "Rejected", "All"];
const PRIORITY_COLORS = {
  Critical: "#EF4444", High: "#F97316", Medium: "#F59E0B", Low: "#94A3B8",
};
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
    <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: c.bg, color: c.fg, whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

function closureLabel(issue) {
  if (issue.status !== "Closed") return null;
  if (issue.patient_satisfaction === "satisfied") return "Patient Satisfied";
  if (issue.patient_satisfaction === "auto_closed_no_response") return "Auto-closed (no response)";
  return "Force Closed by Admin";
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 640, maxHeight: "85vh", overflowY: "auto",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{title}</span>
          <button onClick={onClose} style={{
            border: "none", background: "transparent", color: "var(--muted)", fontSize: 18, cursor: "pointer",
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const textareaStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 10, resize: "vertical",
  border: "1px solid var(--border)", background: "var(--input-bg)",
  color: "var(--text)", fontSize: 13, outline: "none",
};

const actionBtn = (bg, color, border) => ({
  padding: "8px 14px", borderRadius: 10, border: border || "none",
  background: bg, color, fontWeight: 700, fontSize: 12, cursor: "pointer",
});

export default function AdminIssuesPage() {
  const { adminUser } = useStore();
  const [statusTab, setStatusTab] = useState("Pending");
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [detail, setDetail] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [responseText, setResponseText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  async function loadIssues() {
    setLoading(true);
    setError("");
    try {
      const params = statusTab === "All" ? {} : { status: statusTab };
      const data = await api.admin.issues.list(params);
      setIssues(data);
    } catch (err) {
      setError(err.message || "Failed to load issues");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadIssues(); }, [statusTab]);
  useEffect(() => { api.admin.listAdmins().then(setAdmins).catch(() => {}); }, []);

  async function openDetail(issue) {
    setActionError("");
    setResponseText("");
    setNoteText("");
    setRejectReason("");
    setShowReject(false);
    setDetail(await api.admin.issues.get(issue.id));
  }

  async function refreshDetail(id) {
    setDetail(await api.admin.issues.get(id));
    loadIssues();
  }

  async function handleAssign(adminId) {
    setBusy(true);
    setActionError("");
    try {
      await api.admin.issues.assign(detail.id, { admin_id: adminId || undefined });
      await refreshDetail(detail.id);
    } catch (err) {
      setActionError(err.message || "Failed to assign");
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept() {
    setBusy(true);
    setActionError("");
    try {
      await api.admin.issues.accept(detail.id);
      await refreshDetail(detail.id);
    } catch (err) {
      setActionError(err.message || "Failed to accept issue");
    } finally {
      setBusy(false);
    }
  }

  async function handleInvestigate() {
    setBusy(true);
    setActionError("");
    try {
      await api.admin.issues.investigate(detail.id, { note: noteText.trim() || undefined });
      setNoteText("");
      await refreshDetail(detail.id);
    } catch (err) {
      setActionError(err.message || "Failed to update issue");
    } finally {
      setBusy(false);
    }
  }

  async function handleRespond() {
    if (!responseText.trim()) return;
    setBusy(true);
    setActionError("");
    try {
      await api.admin.issues.respond(detail.id, { message: responseText });
      setResponseText("");
      await refreshDetail(detail.id);
    } catch (err) {
      setActionError(err.message || "Failed to send response");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (rejectReason.trim().length < 3) {
      setActionError("Please give a reason of at least 3 characters.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await api.admin.issues.reject(detail.id, { reason: rejectReason.trim() });
      setShowReject(false);
      setRejectReason("");
      await refreshDetail(detail.id);
    } catch (err) {
      setActionError(err.message || "Failed to reject issue");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setBusy(true);
    setActionError("");
    try {
      await api.admin.issues.addNote(detail.id, { note: noteText });
      setNoteText("");
      await refreshDetail(detail.id);
    } catch (err) {
      setActionError(err.message || "Failed to add note");
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    setBusy(true);
    setActionError("");
    try {
      await api.admin.issues.close(detail.id);
      await refreshDetail(detail.id);
    } catch (err) {
      setActionError(err.message || "Failed to close issue");
    } finally {
      setBusy(false);
    }
  }

  const canAccept = detail && ["Pending", "Reopened"].includes(detail.status);
  const canInvestigate = detail && ["Pending", "Under Review", "Reopened"].includes(detail.status);
  const canResolve = detail && !["Closed", "Rejected"].includes(detail.status);
  const canReject = detail && !["Closed", "Rejected"].includes(detail.status);
  const isTerminal = detail && ["Closed", "Rejected"].includes(detail.status);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Resolution Center</h2>
        <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Accept, investigate, resolve, or reject patient-reported issues</div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {STATUS_TABS.map((t) => (
          <button key={t} onClick={() => setStatusTab(t)} style={{
            padding: "7px 16px", borderRadius: 999, border: "1px solid var(--border)",
            background: statusTab === t ? "var(--accent)" : "transparent",
            color: statusTab === t ? "#fff" : "var(--text)",
            fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>
            {t}
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

      {loading && <div style={{ color: "var(--muted)", padding: 20 }}>Loading…</div>}
      {!loading && issues.length === 0 && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
          padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13,
        }}>
          No issues in this view.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {issues.map((issue) => (
          <div key={issue.id} onClick={() => openDetail(issue)} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 14, padding: 16, cursor: "pointer",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>
                {issue.token_number} — {issue.category}
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: PRIORITY_COLORS[issue.priority] }}>
                  ● {issue.priority}
                </span>
              </span>
              <StatusBadge status={issue.status} />
            </div>
            {closureLabel(issue) && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{closureLabel(issue)}</div>
            )}
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
              Patient {issue.patient_id} {issue.assigned_admin_name ? `· Assigned to ${issue.assigned_admin_name}` : "· Unassigned"}
            </div>
            <div style={{ fontSize: 13 }}>
              {issue.description.length > 120 ? issue.description.slice(0, 120) + "…" : issue.description}
            </div>
          </div>
        ))}
      </div>

      {detail && (
        <Modal title={`${detail.token_number} — ${detail.category}`} onClose={() => setDetail(null)}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
            <StatusBadge status={detail.status} />
            {closureLabel(detail) && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>· {closureLabel(detail)}</span>
            )}
            <span style={{ fontSize: 12, fontWeight: 700, color: PRIORITY_COLORS[detail.priority] }}>
              ● {detail.priority} priority
            </span>
            {detail.related_change_number && (
              <span style={{ fontSize: 11, color: "var(--muted)" }}>· Linked to Change #{detail.related_change_number}</span>
            )}
          </div>

          <div style={{ fontSize: 13, marginBottom: 16 }}>{detail.description}</div>

          {/* Point 6 actions */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {canAccept && (
              <button onClick={handleAccept} disabled={busy} style={actionBtn("var(--accent)", "#fff")}>
                Accept
              </button>
            )}
            {canInvestigate && (
              <button onClick={handleInvestigate} disabled={busy} style={actionBtn("transparent", "var(--text)", "1px solid var(--border)")}>
                Mark Investigating
              </button>
            )}
            {canReject && (
              <button onClick={() => setShowReject((v) => !v)} disabled={busy} style={actionBtn("transparent", "#EF4444", "1px solid rgba(239,68,68,0.4)")}>
                Reject
              </button>
            )}
          </div>

          {showReject && (
            <div style={{ marginBottom: 16, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                Reason for rejection (sent to the patient)
              </label>
              <textarea rows={2} style={textareaStyle} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              <button onClick={handleReject} disabled={busy || rejectReason.trim().length < 3} style={{ ...actionBtn("#EF4444", "#fff"), marginTop: 8 }}>
                Confirm Rejection
              </button>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>Assign to</label>
            <select
              value={detail.assigned_admin_id || ""}
              onChange={(e) => handleAssign(e.target.value)}
              disabled={busy}
              style={{ ...textareaStyle, resize: "none" }}
            >
              <option value="">Unassigned</option>
              {admins.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
              <option value={adminUser.id}>Assign to me ({adminUser.name})</option>
            </select>
          </div>

          {detail.responses.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Responses (visible to patient)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {detail.responses.map((r) => (
                  <div key={r.id} style={{ background: "var(--input-bg)", borderRadius: 10, padding: 12, fontSize: 13 }}>
                    <div style={{ marginBottom: 4 }}>{r.message}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      — {r.admin_name}, {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {canResolve && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                Resolve — Send Response to Patient
              </label>
              <textarea rows={3} style={textareaStyle} value={responseText} onChange={(e) => setResponseText(e.target.value)} />
              <button onClick={handleRespond} disabled={busy || !responseText.trim()} style={{ ...actionBtn("var(--accent)", "#fff"), marginTop: 8 }}>
                Resolve & Notify Patient
              </button>
            </div>
          )}

          {detail.notes.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Internal Notes (admin only)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {detail.notes.map((n) => (
                  <div key={n.id} style={{ background: "rgba(245,158,11,0.08)", borderRadius: 10, padding: 12, fontSize: 13 }}>
                    <div style={{ marginBottom: 4 }}>{n.note}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      — {n.admin_name}, {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
              Add Internal Note
            </label>
            <textarea rows={2} style={textareaStyle} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            <button onClick={handleAddNote} disabled={busy || !noteText.trim()} style={{ ...actionBtn("transparent", "var(--text)", "1px solid var(--border)"), marginTop: 8 }}>
              Add Note
            </button>
          </div>

          {actionError && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 12 }}>{actionError}</div>}

          {!isTerminal && (
            <button onClick={handleClose} disabled={busy} style={{
              width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)",
              background: "transparent", color: "#EF4444", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>
              Force Close Issue
            </button>
          )}
        </Modal>
      )}
    </div>
  );
}
