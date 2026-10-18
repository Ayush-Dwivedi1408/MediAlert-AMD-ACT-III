import { useState } from "react";
import api from "../api/client";

export default function LogoutFeedbackModal({ patientId, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState(null); // true / false / null
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!rating) {
      setError("Please select a rating");
      return;
    }
    if (wouldRecommend === null) {
      setError("Please let us know if you'd recommend MediAlert");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.feedback.submit({
        patient_id: patientId,
        overall_rating: rating,
        comment,
        suggestion,
        would_recommend: wouldRecommend,
      });
      onDone();
    } catch (err) {
      setError(err.message || "Failed to submit feedback");
      setSubmitting(false);
    }
  }

  const textareaStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 10, resize: "vertical",
    border: "1px solid var(--border)", background: "var(--input-bg)",
    color: "var(--text)", fontSize: 13, outline: "none",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500,
    }}>
      <div style={{
        width: 420, background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 28,
      }}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Before you go…</div>
        <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
          How was your experience with MediAlert?
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 8 }}>
            Overall Rating
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} style={{
                flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--border)",
                background: rating >= n ? "var(--accent)" : "transparent",
                color: rating >= n ? "#fff" : "var(--muted)",
                fontSize: 16, cursor: "pointer",
              }}>
                ★
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
            Comment (optional)
          </label>
          <textarea rows={2} style={textareaStyle} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
            Suggestion (optional)
          </label>
          <textarea rows={2} style={textareaStyle} value={suggestion} onChange={(e) => setSuggestion(e.target.value)} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 8 }}>
            Would you recommend MediAlert?
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setWouldRecommend(true)} style={{
              flex: 1, padding: 10, borderRadius: 10, border: "1px solid var(--border)",
              background: wouldRecommend === true ? "#22C55E" : "transparent",
              color: wouldRecommend === true ? "#fff" : "var(--text)",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>
              Yes
            </button>
            <button onClick={() => setWouldRecommend(false)} style={{
              flex: 1, padding: 10, borderRadius: 10, border: "1px solid var(--border)",
              background: wouldRecommend === false ? "#EF4444" : "transparent",
              color: wouldRecommend === false ? "#fff" : "var(--text)",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>
              No
            </button>
          </div>
        </div>

        {error && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onDone} disabled={submitting} style={{
            flex: 1, padding: 11, borderRadius: 10, border: "1px solid var(--border)",
            background: "transparent", color: "var(--muted)", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>
            Skip
          </button>
          <button onClick={handleSubmit} disabled={submitting} style={{
            flex: 2, padding: 11, borderRadius: 10, border: "none",
            background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13,
            cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1,
          }}>
            {submitting ? "Submitting…" : "Submit & Logout"}
          </button>
        </div>
      </div>
    </div>
  );
}
