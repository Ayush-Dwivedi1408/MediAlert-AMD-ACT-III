import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line,
} from "recharts";
import { api } from "../api/client";

const TRIAGE_COLORS = { P1: "#EF4444", P2: "#F97316", P3: "#F59E0B", P4: "#22C55E" };

// Keys match the API's actual range strings — only the DISPLAY label changes
const RISK_BUCKET_COLORS = {
  "0-25":   "#22C55E",
  "26-50":  "#F59E0B",
  "51-75":  "#F97316",
  "76-100": "#EF4444",
};
const RISK_BUCKET_LABELS = {
  "0-25":   "Low",
  "26-50":  "Moderate",
  "51-75":  "High",
  "76-100": "Critical",
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ title, items, columns, onClose, loading }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000085", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "var(--surface)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 820, maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 60px #00000060" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{title}</div>
          <button onClick={onClose} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 13 }}>✕ Close</button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>Loading...</div>
        ) : !items || items.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: 40, fontSize: 14 }}>No records found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col.key} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--stat-bg)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    {columns.map(col => (
                      <td key={col.key} style={{ padding: "11px 14px", fontSize: 13, color: col.color ? col.color(item) : "var(--text)", fontWeight: col.bold ? 700 : 400 }}>
                        {col.render ? col.render(item) : (item[col.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Improvement Graph Modal ──────────────────────────────────────────────────
function ImprovementModal({ monthlyVisits, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000085", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "var(--surface)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 680, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>📈 Improvement & Risk Analysis</div>
          <button onClick={onClose} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 13 }}>✕ Close</button>
        </div>

        <div style={{ background: "var(--stat-bg)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--text)" }}>Monthly Visit Volume</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={monthlyVisits}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="visits" stroke="var(--accent)" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "var(--stat-bg)", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--text)" }}>Recovery Status Guide</div>
          {[
            { status: "📈 IMPROVING",     color: "#22C55E", desc: "Risk score decreased >15%. Multiple symptoms resolved." },
            { status: "➡️ STABLE",        color: "#F59E0B", desc: "Risk score changed <10%. Condition neither improving nor worsening." },
            { status: "📉 WORSENING",     color: "#EF4444", desc: "Risk score increased >20% or new symptoms appeared. Urgent review needed." },
            { status: "↕️ FLUCTUATING",  color: "#7c3aed", desc: "Risk score changing irregularly. Close monitoring recommended." },
          ].map(item => (
            <div key={item.status} style={{ marginBottom: 10, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ fontWeight: 700, color: item.color, minWidth: 160, fontSize: 13 }}>{item.status}</span>
              <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Analytics Page ──────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [data,             setData]            = useState(null);
  const [riskDist,         setRiskDist]        = useState(null);
  const [loading,          setLoading]         = useState(true);
  const [showModal,        setShowModal]       = useState(false);
  const [modalTitle,       setModalTitle]      = useState("");
  const [modalItems,       setModalItems]      = useState([]);
  const [modalColumns,     setModalColumns]    = useState([]);
  const [modalLoading,     setModalLoading]    = useState(false);
  const [showImprovement,  setShowImprovement] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [overview, dist] = await Promise.all([
        api.analytics.overview(),
        api.analytics.riskDistribution(),
      ]);
      setData(overview);
      setRiskDist(dist);
    } catch (e) { console.error("Analytics load error:", e); }
    setLoading(false);
  }

  // ── Generic modal opener ───────────────────────────────────────────────────
  function openModal(title, columns, fetcher) {
    setModalTitle(title);
    setModalColumns(columns);
    setModalItems([]);
    setModalLoading(true);
    setShowModal(true);
    fetcher()
      .then(items => { setModalItems(items); setModalLoading(false); })
      .catch(e    => { console.error(e);      setModalLoading(false); });
  }

  // ── Column definitions ─────────────────────────────────────────────────────
  const patientCols = [
    { key: "id",               label: "Patient ID",   bold: true },
    { key: "name",             label: "Name",         bold: true },
    { key: "age",              label: "Age",          render: p => (p.age ?? "—") + " yrs" },
    { key: "gender",           label: "Gender" },
    { key: "blood_group",      label: "Blood Group",  render: p => p.blood_group || "Unknown" },
    { key: "known_conditions", label: "Conditions",   render: p => p.known_conditions || "None" },
    { key: "created_at",       label: "Registered",   render: p => p.created_at ? new Date(p.created_at).toLocaleDateString() : "—" },
  ];

  const visitCols = [
    { key: "patient_id",   label: "Patient ID" },
    { key: "visit_date",   label: "Date",       render: v => v.visit_date ? new Date(v.visit_date).toLocaleDateString() : "—" },
    { key: "triage_level", label: "Triage",     bold: true, color: v => TRIAGE_COLORS[v.triage_level] || "var(--text)" },
    { key: "risk_score",   label: "Risk Score", render: v => v.risk_score != null ? Math.round(v.risk_score) + "/100" : "—", bold: true },
    { key: "news2_score",  label: "NEWS2",      render: v => v.news2_score ?? "—" },
    { key: "spo2",         label: "SpO2",       render: v => v.spo2 != null ? v.spo2 + "%" : "—", color: v => v.spo2 && v.spo2 < 90 ? "#EF4444" : "var(--text)" },
    { key: "symptoms",     label: "Symptoms",   render: v => (Array.isArray(v.symptoms) ? v.symptoms : []).slice(0, 3).map(s => s.replace(/_/g, " ")).join(", ") || "—" },
  ];

  const criticalCols = [
    { key: "patient_id",   label: "Patient ID" },
    { key: "visit_date",   label: "Date",       render: v => v.visit_date ? new Date(v.visit_date).toLocaleDateString() : "—" },
    { key: "triage_level", label: "Triage",     bold: true, color: () => "#EF4444" },
    { key: "risk_score",   label: "Risk Score", render: v => v.risk_score != null ? Math.round(v.risk_score) + "/100" : "—", bold: true, color: () => "#EF4444" },
    { key: "spo2",         label: "SpO2",       render: v => v.spo2 != null ? v.spo2 + "%" : "—", color: v => v.spo2 && v.spo2 < 90 ? "#EF4444" : "var(--text)" },
    { key: "pulse",        label: "Pulse",      render: v => v.pulse != null ? v.pulse + " bpm" : "—" },
    { key: "symptoms",     label: "Symptoms",   render: v => (Array.isArray(v.symptoms) ? v.symptoms : []).slice(0, 3).map(s => s.replace(/_/g, " ")).join(", ") || "—" },
  ];

  const alertCols = [
    { key: "alert_type", label: "Type",     bold: true },
    { key: "message",    label: "Message",  render: a => a.message || a.description || "—" },
    { key: "severity",   label: "Severity", bold: true, color: a => a.severity === "critical" ? "#EF4444" : "#F59E0B" },
    { key: "action_status", label: "Status", render: a => {
            const status = a.action_status || (a.is_read ? "read" : "unread");
            const labels = { unread: "● Unread", read: "✓ Read", action_taken: "✅ Action Taken" };
            return labels[status] || "● Unread";
          }, color: a => {
            const status = a.action_status || (a.is_read ? "read" : "unread");
            const colors = { unread: "#EF4444", read: "#3B82F6", action_taken: "#22C55E" };
            return colors[status] || "#EF4444";
          }, bold: true },
    { key: "created_at", label: "Date",     render: a => a.created_at ? new Date(a.created_at).toLocaleDateString() : "—" },
  ];

  // ── Data fetchers ──────────────────────────────────────────────────────────
  const fetchPatients = async () => {
    const res = await api.patients.list();
    return Array.isArray(res) ? res : [];
  };

  const fetchVisits = async () => {
    const res = await api.visits.list();
    return Array.isArray(res) ? res : [];
  };

  const fetchCritical = async () => {
    const res  = await api.visits.list();
    const list = Array.isArray(res) ? res : [];
    return list.filter(v => v.triage_level === "P1" || (v.risk_score != null && v.risk_score >= 75));
  };

  const fetchP1 = async () => {
    const res  = await api.visits.list();
    const list = Array.isArray(res) ? res : [];
    return list.filter(v => v.triage_level === "P1");
  };

  const fetchP2 = async () => {
    const res  = await api.visits.list();
    const list = Array.isArray(res) ? res : [];
    return list.filter(v => v.triage_level === "P2");
  };

  const fetchAlerts = async () => {
    const res = await api.alerts.list();
    return Array.isArray(res) ? res : (res?.alerts || []);
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const s = {
    h1:       { fontSize: 26, fontWeight: 800, marginBottom: 20, color: "var(--text)" },
    card:     { background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", padding: 22, marginBottom: 16 },
    h2:       { fontSize: 15, fontWeight: 700, marginBottom: 14, color: "var(--text)" },
    grid4:    { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 },
    grid3:    { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 },
    statCard: { background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: "18px 20px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" },
    statVal:  { fontSize: 32, fontWeight: 900 },
    statLabel:{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 3 },
    hint:     { fontSize: 10, color: "var(--accent)", marginTop: 5, opacity: 0.8 },
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading analytics...</div>;
  if (!data)   return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>No data yet. Complete some visits first.</div>;

  const triageData = Object.entries(data.triage_distribution || {})
    .map(([k, v]) => ({ name: k, value: v, color: TRIAGE_COLORS[k] }))
    .filter(d => d.value > 0);

  const riskData = riskDist
    ? Object.entries(riskDist.distribution).map(([range, count]) => ({
        range: RISK_BUCKET_LABELS[range] || range, count, fill: RISK_BUCKET_COLORS[range] || "#64748b",
      }))
    : [];

  return (
    <div>
      {/* Modals */}
      {showModal && (
        <DetailModal
          title={modalTitle}
          items={modalItems}
          columns={modalColumns}
          loading={modalLoading}
          onClose={() => setShowModal(false)}
        />
      )}
      {showImprovement && (
        <ImprovementModal
          monthlyVisits={data.monthly_visits || []}
          onClose={() => setShowImprovement(false)}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={s.h1}>📊 Analytics Dashboard</div>
        <button
          onClick={() => setShowImprovement(true)}
          style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
        >
          📈 Improvement Graph
        </button>
      </div>

      {/* ── Top: Summary Stat Cards ──────────────────────────────────────────── */}
      <div style={s.grid4}>
        {[
          { val: data.summary.critical_cases,  label: "High Priority Cases", color: "#EF4444",      onClick: () => openModal(`🚨 High Priority Cases (${data.summary.critical_cases})`, criticalCols, fetchCritical) },
          { val: data.summary.total_patients,  label: "Total Patients",      color: "var(--accent)", onClick: () => openModal(`👥 All Patients (${data.summary.total_patients})`, patientCols, fetchPatients) },
          { val: data.summary.total_visits,    label: "Total Assessments",   color: "var(--accent)", onClick: () => openModal(`📋 All Assessments (${data.summary.total_visits})`, visitCols, fetchVisits) },
          { val: data.summary.avg_risk_score,  label: "Average Risk",        color: "var(--accent)", onClick: () => setShowImprovement(true) },
        ].map((stat, i) => (
          <div
            key={i}
            style={s.statCard}
            onClick={stat.onClick}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 24px #00000020"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none";             e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ ...s.statVal, color: stat.color }}>{stat.val}</div>
            <div style={s.statLabel}>{stat.label}</div>
            <div style={s.hint}>Click to view details →</div>
          </div>
        ))}
      </div>

      {/* ── Middle: Large Monthly Trend Chart ────────────────────────────────── */}
      <div style={s.card}>
        <div style={s.h2}>Monthly Assessment Trend</div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.monthly_visits}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
            <Line type="monotone" dataKey="visits" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Bottom: Risk Distribution / Priority Distribution / Suggested Conditions ── */}
      <div style={s.grid3}>
        {/* Risk Distribution */}
        {riskData.length > 0 && (
          <div style={s.card}>
            <div style={s.h2}>Risk Distribution</div>
            <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
              {Object.entries(RISK_BUCKET_COLORS).map(([range, color]) => (
                <div key={range} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{RISK_BUCKET_LABELS[range]}</span>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={riskData}>
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v) => [`${v} visit${v !== 1 ? "s" : ""}`, "Count"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {riskData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Priority Distribution — now a horizontal bar chart, was a pie */}
        <div style={s.card}>
          <div style={s.h2}>Priority Distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={triageData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={30} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v) => [`${v} visit${v !== 1 ? "s" : ""}`, "Count"]} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {triageData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Most Frequently Suggested Conditions */}
        {data.top_diseases?.length > 0 && (
          <div style={s.card}>
            <div style={s.h2}>Most Frequently Suggested Conditions</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.top_diseases.slice(0, 8)} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Emergency Summary */}
      <div style={s.card}>
        <div style={s.h2}>Emergency Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {[
            { val: data.summary.critical_cases,  label: "P1 Critical",            color: "#EF4444", onClick: () => openModal(`🚨 P1 Critical (${data.summary.critical_cases})`, criticalCols, fetchP1) },
            { val: data.summary.high_risk_cases,  label: "P2 High Risk",           color: "#F97316", onClick: () => openModal(`⚠️ P2 High Risk (${data.summary.high_risk_cases})`, visitCols, fetchP2) },
            { val: data.summary.total_alerts,     label: "Total Alerts Generated", color: "#F59E0B", onClick: () => openModal(`🔔 All Alerts (${data.summary.total_alerts})`, alertCols, fetchAlerts) },
          ].map((item, i) => (
            <div
              key={i}
              onClick={item.onClick}
              style={{ textAlign: "center", padding: 20, background: item.color + "12", borderRadius: 12, border: `1px solid ${item.color}33`, cursor: "pointer", transition: "transform 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
            >
              <div style={{ fontSize: 34, fontWeight: 900, color: item.color }}>{item.val}</div>
              <div style={{ fontSize: 12, color: item.color, fontWeight: 700, marginTop: 2 }}>{item.label}</div>
              <div style={{ fontSize: 10, color: item.color, opacity: 0.7, marginTop: 5 }}>Click to view →</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
