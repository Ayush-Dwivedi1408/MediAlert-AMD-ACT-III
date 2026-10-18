import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";
import api from "../api/client";

function fieldLabel(edited_column) {
  if (edited_column === "__lifecycle__") return "Record Status";
  return edited_column
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function ChangeHistoryPage() {
  const { patient } = useStore();
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!patient?.id) return;
    setLoading(true);
    setError("");
    api.patients.auditHistory(patient.id)
      .then(setEntries)
      .catch((err) => setError(err.message || "Failed to load change history"))
      .finally(() => setLoading(false));
  }, [patient?.id]);

  function handleReportIssue(entry) {
  navigate("/support-center", { state: { relatedChangeNumber: entry.change_number } });
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Change History</h2>
      <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
        Every change made to your record by an admin, with the reason given.
      </div>

      {loading && <div style={{ color: "var(--muted)", padding: 20 }}>Loading…</div>}

      {error && (
        <div style={{
          background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
          color: "#EF4444", borderRadius: 10, padding: "10px 12px", fontSize: 13, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
          padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13,
        }}>
          No changes have been made to your record yet.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {entries.map((e) => (
          <div key={e.change_number} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 14, padding: 18,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  Change #{e.change_number} — {fieldLabel(e.edited_column)}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                  {e.date} at {e.time}
                </div>
              </div>
              <button onClick={() => handleReportIssue(e)} style={{
                padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)",
                background: "transparent", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                whiteSpace: "nowrap",
              }}>
                Report Issue
              </button>
            </div>

            <div style={{ fontSize: 13, marginBottom: 8 }}>
              {e.edited_column === "__lifecycle__" ? (
                <>Record status changed to <strong>{e.new_value}</strong></>
              ) : (
                <>
                  <span style={{ color: "var(--muted)", textDecoration: "line-through" }}>
                    {e.previous_value || "(empty)"}
                  </span>
                  {"  →  "}
                  <strong>{e.new_value || "(empty)"}</strong>
                </>
              )}
            </div>

            <div style={{
              display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, color: "var(--muted)",
              borderTop: "1px solid var(--border)", paddingTop: 10,
            }}>
              <span>Changed by: <strong style={{ color: "var(--text)" }}>{e.admin_name}</strong> ({e.admin_id})</span>
              <span>Reason: <strong style={{ color: "var(--text)" }}>{e.reason || "—"}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
