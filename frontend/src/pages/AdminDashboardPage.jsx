import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useStore } from "../store";
import api from "../api/client";

const PIE_COLORS = ["#3B82F6", "#F59E0B", "#22C55E", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

function KpiCard({ label, value, accent }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 14, padding: "16px 18px", minWidth: 0,
    }}>
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent || "var(--text)" }}>
        {value === null || value === undefined ? "—" : value}
      </div>
    </div>
  );
}

function ChartCard({ title, children, empty }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{title}</div>
      {empty ? (
        <div style={{ color: "var(--muted)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>No data yet</div>
      ) : children}
    </div>
  );
}

function ProgressRing({ percent, color }) {
  const size = 96;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = percent === null || percent === undefined ? 0 : (percent / 100) * circumference;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round"
      />
    </svg>
  );
}

export default function AdminDashboardPage() {
  const { dark } = useStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.admin.dashboardOverview()
      .then(setData)
      .catch((err) => setError(err.message || "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const gridColor = dark ? "#334155" : "#e2e8f0";
  const axisColor = dark ? "#94A3B8" : "#64748b";
  const accent = dark ? "#3B82F6" : "#2563eb";
  const tooltipStyle = { background: "var(--surface)", border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 };

  if (loading) return <div style={{ color: "var(--muted)", padding: 20 }}>Loading dashboard…</div>;
  if (error) return (
    <div style={{
      background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
      color: "#EF4444", borderRadius: 10, padding: "10px 12px", fontSize: 13,
    }}>
      {error}
    </div>
  );

  const {
    kpis, monthly_trends, risk_distribution, activity_today,
    gender_distribution, age_distribution, blood_group_distribution,
    disease_distribution, admin_activity_trend, feedback_rating_distribution,
  } = data;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>Admin Dashboard</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
        <KpiCard label="Total Patients" value={kpis.total_patients} />
        <KpiCard label="Active Patients" value={kpis.active_patients} accent="#22C55E" />
        <KpiCard label="Critical Patients" value={kpis.critical_patients} accent="#EF4444" />
        <KpiCard label="Removed Patients" value={kpis.archived_patients} accent="#94A3B8" />
        <KpiCard label="Total Emergency Cases" value={kpis.total_emergency_cases} accent="#EF4444" />
        <KpiCard label="Today's Registrations" value={kpis.today_registrations} accent={accent} />
        <KpiCard label="Open Issues" value={kpis.open_issues} />
        <KpiCard label="Resolved Issues" value={kpis.resolved_issues} />
        <KpiCard label="Avg Resolution Time" value={kpis.avg_resolution_time_hours ? `${kpis.avg_resolution_time_hours}h` : "—"} />
        <KpiCard label="Patient Satisfaction" value={kpis.patient_satisfaction ?? "—"} />
        <KpiCard label="Feedback Score" value={kpis.feedback_score !== null ? `${kpis.feedback_score}%` : "—"} />
      </div>

      {/* Monthly Registrations + Risk Distribution */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>
        <ChartCard title="Monthly Patient Growth" empty={monthly_trends.length === 0}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthly_trends}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke={axisColor} fontSize={12} />
              <YAxis stroke={axisColor} fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="registrations" stroke={accent} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Risk Distribution" empty={risk_distribution.length === 0}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={risk_distribution}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="level" stroke={axisColor} fontSize={12} />
              <YAxis stroke={axisColor} fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill={accent} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Gender + Age */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 16, marginBottom: 16 }}>
        <ChartCard title="Gender Distribution" empty={gender_distribution.length === 0}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={gender_distribution} dataKey="count" nameKey="gender" cx="50%" cy="50%" outerRadius={80} label={({ gender, count }) => `${gender} (${count})`}>
                {gender_distribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Age Group Distribution" empty={age_distribution.every((a) => a.count === 0)}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={age_distribution}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="group" stroke={axisColor} fontSize={12} />
              <YAxis stroke={axisColor} fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Blood Group + Disease */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 16, marginBottom: 16 }}>
        <ChartCard title="Blood Group Distribution" empty={blood_group_distribution.length === 0}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={blood_group_distribution} dataKey="count" nameKey="group" cx="50%" cy="50%" outerRadius={80} label={({ group, count }) => `${group} (${count})`}>
                {blood_group_distribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Disease Distribution (Top 8)" empty={disease_distribution.length === 0}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={disease_distribution} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis type="number" stroke={axisColor} fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="disease" stroke={axisColor} fontSize={11} width={120} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#F97316" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Admin Activity + Issue Resolution Rate + Feedback Ratings */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>
        <ChartCard title="Admin Activity (Last 14 Days)" empty={admin_activity_trend.length === 0}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={admin_activity_trend}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke={axisColor} fontSize={11} />
              <YAxis stroke={axisColor} fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#14B8A6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
            padding: 18, display: "flex", alignItems: "center", gap: 20,
          }}>
            <div style={{ position: "relative", width: 96, height: 96 }}>
              <ProgressRing percent={kpis.issue_resolution_rate} color="#22C55E" />
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 800,
              }}>
                {kpis.issue_resolution_rate !== null ? `${kpis.issue_resolution_rate}%` : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Issue Resolution Rate</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {kpis.resolved_issues} resolved of {kpis.resolved_issues + kpis.open_issues} total
              </div>
            </div>
          </div>

          <ChartCard title="Feedback Ratings" empty={feedback_rating_distribution.every((r) => r.count === 0)}>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={feedback_rating_distribution}>
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                <XAxis dataKey="rating" stroke={axisColor} fontSize={12} tickFormatter={(v) => `${v}★`} />
                <YAxis stroke={axisColor} fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
        padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Activity Today</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
            {activity_today.total} action{activity_today.total === 1 ? "" : "s"}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {activity_today.patient_updates} patient update{activity_today.patient_updates === 1 ? "" : "s"}
            {" · "}{activity_today.issues_resolved} issue{activity_today.issues_resolved === 1 ? "" : "s"} resolved
            {" · "}{activity_today.logins} login{activity_today.logins === 1 ? "" : "s"}
          </div>
        </div>
        <a href="/admin/activity" style={{
          fontSize: 13, fontWeight: 700, color: "var(--accent)", whiteSpace: "nowrap",
        }}>
          View Activity Log →
        </a>
      </div>
    </div>
  );
}
