import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { useStore } from "../store";
import { api } from "../api/client";

const STATUS_COLORS = {
  Resolved: "#22C55E", Improved: "#22C55E", Mild: "#F59E0B", Same: "#F97316", Reported: "#3B82F6",
};
const TREND_COLORS = { down: "#22C55E", up: "#22C55E", flat: "#3B82F6" };
// Note: "down is good" doesn't universally hold (e.g. SpO2 down = bad) -- the backend
// already resolves that into direction+label, so we color by the LABEL, not raw direction.
const trendColor = (label) => (label === "Improving" ? "#22C55E" : label === "Worsening" ? "#EF4444" : "#3B82F6");

// ─── Circular Health Score Gauge ──────────────────────────────────────────────
function HealthGauge({ score, label, delta }) {
  const size = 180, stroke = 14, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = score != null ? score / 100 : 0;
  const color = score >= 85 ? "#22C55E" : score >= 70 ? "#3B82F6" : score >= 50 ? "#F59E0B" : "#EF4444";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={c} strokeDashoffset={c - pct * c} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: "var(--text)" }}>{score ?? "—"}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>/ 100</div>
        </div>
      </div>
      <div style={{ marginTop: 14, fontSize: 15, fontWeight: 700, color }}>{label}</div>
      {delta != null && (
        <div style={{ fontSize: 12, fontWeight: 700, color: delta >= 0 ? "#22C55E" : "#EF4444", marginTop: 4 }}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)} since last visit
        </div>
      )}
    </div>
  );
}

export default function InsightsPage() {
  const { patient } = useStore();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVitalsOnChart, setShowVitalsOnChart] = useState(true);

  useEffect(() => {
    if (!patient) { nav("/"); return; }
    load();
  }, [patient]);

  async function load() {
    try {
      const res = await api.insights.get(patient.id);
      setData(res);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const s = {
    h1: { fontSize: 26, fontWeight: 800, marginBottom: 6, color: "var(--text)" },
    sub: { color: "var(--muted)", fontSize: 14, marginBottom: 24 },
    card: { background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", padding: 22, marginBottom: 16 },
    h2: { fontSize: 15, fontWeight: 700, marginBottom: 14, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 },
    grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 },
    statBox: { textAlign: "center", padding: "16px 10px", background: "var(--stat-bg)", borderRadius: 12 },
    statVal: { fontSize: 26, fontWeight: 900, color: "var(--accent)" },
    statLabel: { fontSize: 11, color: "var(--muted)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.4px" },
  };

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}>⏳ Loading insights...</div>;

  if (!data?.has_data) {
    return (
      <div>
        <div style={s.h1}>📈 Insights</div>
        <div style={{ ...s.card, textAlign: "center", color: "var(--muted)", padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div style={{ marginBottom: 16 }}>No assessments yet — complete your first symptom assessment to see personalized insights.</div>
          <button onClick={() => nav("/symptoms")} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
            Start Assessment
          </button>
        </div>
      </div>
    );
  }

  const summaryBullets = (data.ai_clinical_summary || "")
    .split(/(?<=[.!?])\s+/)
    .map(x => x.trim())
    .filter(Boolean);

  return (
    <div>
      <div style={s.h1}>📈 Insights</div>
      <div style={s.sub}>Your personalized health overview, generated from all assessments and follow-ups</div>

      {/* ── 1. AI Clinical Summary ─────────────────────────────────────────── */}
      <div style={{ ...s.card, background: "linear-gradient(135deg, #1e3a8a15, #2563eb08)", border: "1px solid #2563eb44" }}>
        <div style={s.h2}>🤖 AI Clinical Summary</div>
        {summaryBullets.map((line, i) => (
          <div key={i} style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.7, marginBottom: 6, display: "flex", gap: 8 }}>
            <span style={{ color: "var(--accent)" }}>•</span><span>{line}</span>
          </div>
        ))}
      </div>

      {/* ── 2 & 6. Health Score + Mental Wellness side by side ───────────────── */}
      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.h2}>💯 Overall Health Score</div>
          <HealthGauge score={data.health_score?.score} label={data.health_score?.label} delta={data.health_score?.delta} />
        </div>

        <div style={s.card}>
          <div style={s.h2}>🧠 Mental Wellness</div>
          {data.mental_wellness?.has_data ? (
            <>
              {[
                ["Stress", data.mental_wellness.stress],
                ["Mood", data.mental_wellness.mood],
                ["Sleep", data.mental_wellness.sleep],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{val || "Not recorded"}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 4px" }}>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Mental Score</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: "var(--accent)" }}>{data.mental_wellness.score}/100</span>
              </div>
              <button onClick={() => nav("/mental-health")} style={{ marginTop: 10, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: 0 }}>
                View Details →
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: 20 }}>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>No mental health screening yet</div>
              <button onClick={() => nav("/mental-health")} style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                Take Screening
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Recovery Timeline (moved from History) ────────────────────────── */}
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={s.h2}>📈 Recovery Timeline</div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
            <input type="checkbox" checked={showVitalsOnChart} onChange={e => setShowVitalsOnChart(e.target.checked)} />
            Show vitals
          </label>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18 }}>Across all visits and follow-up check-ins</div>

        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase" }}>Risk Score & NEWS2</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.recovery_timeline} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="risk" domain={[0, 100]} tick={{ fontSize: 10 }} />
            <YAxis yAxisId="news2" orientation="right" domain={[0, 20]} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="risk" type="monotone" dataKey="risk" name="Risk Score" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line yAxisId="news2" type="monotone" dataKey="news2" name="NEWS2" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>

        {showVitalsOnChart && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", margin: "22px 0 8px", textTransform: "uppercase" }}>SpO2, Pulse & Temperature</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.recovery_timeline} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="spo2" name="SpO2 %" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="pulse" name="Pulse bpm" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="temperature" name="Temp °F" stroke="#F97316" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* ── 4. Personal Health Trends ─────────────────────────────────────────── */}
      {data.personal_trends?.length > 0 && (
        <div style={s.card}>
          <div style={s.h2}>📊 Personal Health Trends</div>
          <div style={s.grid3}>
            {data.personal_trends.map((t, i) => (
              <div key={i} style={{ ...s.statBox, background: trendColor(t.label) + "12", border: `1px solid ${trendColor(t.label)}33` }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: trendColor(t.label) }}>{t.arrow}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t.metric}</div>
                <div style={{ fontSize: 11, color: trendColor(t.label), marginTop: 2 }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. Symptom Progress ───────────────────────────────────────────────── */}
      {data.symptom_progress?.length > 0 && (
        <div style={s.card}>
          <div style={s.h2}>🩺 Symptom Progress</div>
          {data.symptom_progress.map((sp, i) => {
            const color = STATUS_COLORS[sp.status] || "var(--muted)";
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: color + "10", border: `1px solid ${color}33`, borderRadius: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: "var(--text)", textTransform: "capitalize" }}>{sp.symptom}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color, display: "flex", alignItems: "center", gap: 6 }}>{sp.icon} {sp.status}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 7. Visit Statistics ───────────────────────────────────────────────── */}
      <div style={s.card}>
        <div style={s.h2}>📋 Visit Statistics</div>
        <div style={s.grid3}>
          <div style={s.statBox}>
            <div style={s.statVal}>{data.visit_stats.total_assessments}</div>
            <div style={s.statLabel}>Total Assessments</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statVal}>{data.visit_stats.avg_risk_score ?? "—"}</div>
            <div style={s.statLabel}>Average Risk Score</div>
          </div>
          <div style={{ ...s.statBox, background: "#EF444412" }}>
            <div style={{ ...s.statVal, color: "#EF4444" }}>{data.visit_stats.highest_risk ?? "—"}</div>
            <div style={s.statLabel}>Highest Risk</div>
          </div>
        </div>
      </div>

      {/* ── 8. Follow-up Tracker ──────────────────────────────────────────────── */}
      <div style={s.card}>
        <div style={s.h2}>📅 Follow-up Tracker</div>
        <div style={s.grid2}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Completed</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#22C55E" }}>{data.followup_tracker.completed}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Pending</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: data.followup_tracker.pending > 0 ? "#F59E0B" : "#22C55E" }}>{data.followup_tracker.pending}</span>
            </div>
            {data.followup_tracker.next_visit_date && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--stat-bg)", borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Next Visit</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginTop: 3 }}>
                  {new Date(data.followup_tracker.next_visit_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            )}
            <button onClick={() => nav("/history")} style={{ marginTop: 12, width: "100%", padding: "10px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              📅 Log Follow-up in History
            </button>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>Recommended Actions</div>
            {data.followup_tracker.recommended_actions?.map((a, i) => (
              <div key={i} style={{ fontSize: 13, color: "var(--text)", marginBottom: 6, display: "flex", gap: 8 }}>
                <span style={{ color: "#22C55E" }}>✔</span><span>{a}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
