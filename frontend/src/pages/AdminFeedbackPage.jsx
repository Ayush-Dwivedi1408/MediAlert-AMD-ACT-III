import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useStore } from "../store";
import api from "../api/client";

function StatCard({ label, value, accent }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 14, padding: "16px 18px",
    }}>
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent || "var(--text)" }}>{value}</div>
    </div>
  );
}

export default function AdminFeedbackPage() {
  const { dark } = useStore();
  const [analytics, setAnalytics] = useState(null);
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [recommendFilter, setRecommendFilter] = useState("all");


  useEffect(() => {
    Promise.all([api.admin.feedback.analytics(), api.admin.feedback.list()])
      .then(([a, list]) => { setAnalytics(a); setFeedbackList(list); })
      .catch((err) => setError(err.message || "Failed to load feedback"))
      .finally(() => setLoading(false));
  }, []);

  const gridColor = dark ? "#334155" : "#e2e8f0";
  const axisColor = dark ? "#94A3B8" : "#64748b";
  const accent = dark ? "#3B82F6" : "#2563eb";

  if (loading) return <div style={{ color: "var(--muted)", padding: 20 }}>Loading…</div>;
  if (error) return (
    <div style={{
      background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
      color: "#EF4444", borderRadius: 10, padding: "10px 12px", fontSize: 13,
    }}>
      {error}
    </div>
  );
  const filteredFeedback = feedbackList.filter((f) => {
      if (ratingFilter !== "all" && String(f.overall_rating) !== ratingFilter) return false;
      if (recommendFilter === "yes" && !f.would_recommend) return false;
      if (recommendFilter === "no" && f.would_recommend) return false;
      return true;
    });

  const distributionData = Object.entries(analytics.rating_distribution)
    .sort((a, b) => a[0] - b[0])
    .map(([rating, count]) => ({ rating: `${rating}★`, count }));

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>Patient Experience</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Feedback" value={analytics.total_feedback} />
        <StatCard label="Average Rating" value={analytics.average_rating ?? "—"} accent="#F59E0B" />
        <StatCard label="Would Recommend" value={analytics.would_recommend_percentage != null ? `${analytics.would_recommend_percentage}%` : "—"} accent="#22C55E" />
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Rating Distribution</div>
        {analytics.total_feedback === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>No feedback yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={distributionData}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="rating" stroke={axisColor} fontSize={12} />
              <YAxis stroke={axisColor} fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill={accent} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Recent Feedback</div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)} style={{
              padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--input-bg)", color: "var(--text)", fontSize: 12,
            }}>
              <option value="all">All Ratings</option>
              {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} Star{r > 1 ? "s" : ""}</option>)}
            </select>
            <select value={recommendFilter} onChange={(e) => setRecommendFilter(e.target.value)} style={{
              padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--input-bg)", color: "var(--text)", fontSize: 12,
            }}>
              <option value="all">All</option>
              <option value="yes">Would Recommend</option>
              <option value="no">Would Not Recommend</option>
            </select>
          </div>
        </div>
        {filteredFeedback.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>No feedback matches these filters</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredFeedback.map((f) => (
              <div key={f.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>
                    {"★".repeat(f.overall_rating)}{"☆".repeat(5 - f.overall_rating)}
                    <span style={{ marginLeft: 8, fontWeight: 400, color: f.would_recommend ? "#22C55E" : "#EF4444" }}>
                      {f.would_recommend ? "Would recommend" : "Would not recommend"}
                    </span>
                  </span>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>
                    {f.patient_id} · {f.created_at ? new Date(f.created_at).toLocaleDateString() : ""}
                  </span>
                </div>
                {f.comment && <div style={{ color: "var(--text)", marginBottom: 2 }}>{f.comment}</div>}
                {f.suggestion && <div style={{ color: "var(--muted)", fontStyle: "italic" }}>Suggestion: {f.suggestion}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
