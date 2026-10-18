import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useStore } from "../store";
import { api } from "../api/client";
import { translations } from "../i18n";
import { triggerSOS } from "../utils/sos";
import EditPatientModal from "../components/EditPatientModal";
import RecentAlertsCard from "../components/RecentAlertsCard";

function dismissedKeyFor(patientId) {
  return `medialert_dismissed_changes_${patientId}`;
}

function loadDismissed(patientId) {
  try {
    const stored = JSON.parse(localStorage.getItem(dismissedKeyFor(patientId)) || "[]");
    return new Set(stored);
  } catch {
    return new Set();
  }
}

export default function DashboardPage() {
  const { patient, lang, setUnreadAlerts } = useStore();
  const T = translations[lang];
  const nav = useNavigate();
  const [showEditModal, setShowEditModal] = useState(false);
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [deterioration, setDeterioration] = useState(null);
  const [aiSummary, setAiSummary] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [intelligence, setIntelligence] = useState(null);

  // ── Point 10: Highlight Modified Fields ──
  const [auditMap, setAuditMap] = useState({}); // field key -> most recent audit entry
  const [dismissed, setDismissed] = useState(new Set());
  const [openBadge, setOpenBadge] = useState(null); // change_number currently showing its popover
  const profileCardRef = useRef(null);

  // ── Point 14: Secure Your Account (PIN prompt for legacy patients) ──
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [setupPin, setSetupPin] = useState("");
  const [setupPinConfirm, setSetupPinConfirm] = useState("");
  const [setupPinError, setSetupPinError] = useState("");
  const [setupPinSaving, setSetupPinSaving] = useState(false);
  const [setupPinDone, setSetupPinDone] = useState(false);

  useEffect(() => {
    if (!patient) { nav("/"); return; }
    loadData();
    setDismissed(loadDismissed(patient.id));
  }, [patient]);

  // Close the "Updated by..." popover when clicking outside the profile card
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileCardRef.current && !profileCardRef.current.contains(e.target)) {
        setOpenBadge(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadData() {
    try {
      const [sumData, alertData, detData] = await Promise.all([
        api.patients.summary(patient.id),
        api.alerts.forPatient(patient.id),
        api.analytics.deterioration(patient.id),
      ]);
      setSummary(sumData);
      setAlerts(alertData.alerts || []);
      setUnreadAlerts(alertData.unread_count || 0);
      setDeterioration(detData);

      // Latest visit's follow-up intelligence -- powers "Next check-in" and "Needs attention"
      try {
        const visits = await api.visits.forPatient(patient.id);
        const lastVisit = visits && visits.length > 0 ? visits[visits.length - 1] : null;
        if (lastVisit) {
          const intel = await api.followup.intelligence(lastVisit.id);
          setIntelligence(intel);
        } else {
          setIntelligence(null);
        }
      } catch { setIntelligence(null); }

      // Build a map of field -> most recent change, for the "Updated" badges below.
      try {
        const auditEntries = await api.patients.auditHistory(patient.id);
        const map = {};
        for (const entry of auditEntries) {
          if (entry.edited_column === "__lifecycle__") continue;
          if (!map[entry.edited_column]) map[entry.edited_column] = entry; // list is newest-first
        }
        setAuditMap(map);
      } catch { setAuditMap({}); }
    } catch (e) {
      console.error(e);
    }
  }

  async function loadAISummary() {
    setLoadingAI(true);
    try {
      const data = await api.patients.aiSummary(patient.id);
      setAiSummary(data.summary);
    } catch { setAiSummary("Could not load AI summary."); }
    setLoadingAI(false);
  }

  async function handleSOS() {
    setSosLoading(true);
    await triggerSOS(patient);
    setSosLoading(false);
  }

  function shouldShowBadge(entry) {
    if (!entry) return false;
    return !dismissed.has(entry.change_number) || openBadge === entry.change_number;
  }

  function handleBadgeClick(entry) {
    setOpenBadge((prev) => (prev === entry.change_number ? null : entry.change_number));
    const next = new Set(dismissed);
    next.add(entry.change_number);
    localStorage.setItem(dismissedKeyFor(patient.id), JSON.stringify([...next]));
    setDismissed(next);
  }

  async function handleSetPin() {
    setSetupPinError("");
    if (!/^\d{4,6}$/.test(setupPin)) {
      setSetupPinError("PIN must be 4-6 digits");
      return;
    }
    if (setupPin !== setupPinConfirm) {
      setSetupPinError("PINs do not match");
      return;
    }
    setSetupPinSaving(true);
    try {
      await api.patients.setPin(patient.id, setupPin, setupPinConfirm);
      setSetupPinDone(true);
      setSetupPin("");
      setSetupPinConfirm("");
    } catch (e) {
      setSetupPinError(e.message || "Could not set PIN. Please try again.");
    } finally {
      setSetupPinSaving(false);
    }
  }

  const stats = summary?.stats || {};
  const riskHistory = (summary?.risk_history || []).map((r, i) => ({ visit: `V${i + 1}`, risk: r }));
  const hasCritical = stats.has_critical_history;

  const rawRiskHistory = summary?.risk_history || [];
  const firstRisk = rawRiskHistory.length > 0 ? Math.round(rawRiskHistory[0]) : null;
  const lastRisk = rawRiskHistory.length > 0 ? Math.round(rawRiskHistory[rawRiskHistory.length - 1]) : null;
  const riskTrendDirection = (firstRisk !== null && lastRisk !== null)
    ? (lastRisk < firstRisk ? "decreased" : lastRisk > firstRisk ? "increased" : "remained stable at")
    : null;
  const riskTrendText = riskTrendDirection
    ? (riskTrendDirection === "remained stable at"
        ? `Risk score remained stable at ${lastRisk} across the latest ${rawRiskHistory.length} assessment${rawRiskHistory.length !== 1 ? "s" : ""}.`
        : `Risk score ${riskTrendDirection} from ${firstRisk} → ${lastRisk} across the latest ${rawRiskHistory.length} assessments.`)
    : null;

  const lastAssessedText = stats.last_visit_date
    ? new Date(stats.last_visit_date).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
    : null;

  const latestFollowupAnalysis = intelligence?.followups?.length ? intelligence.followups[intelligence.followups.length - 1] : null;
  const needsAttention = latestFollowupAnalysis?.retriage?.triggered;
  const nextCheckin = intelligence?.next_checkin;
  const isOverdue = intelligence?.overdue?.overdue;

  const profileFields = [
    { key: "allergies", label: "Allergies", value: patient?.allergies },
    { key: "known_conditions", label: "Conditions", value: patient?.known_conditions },
    { key: "current_medications", label: "Medications", value: patient?.current_medications },
    { key: "mobile_number", label: "Mobile Number", value: patient?.mobile_number || "—" },
    { key: "date_of_birth", label: "Date of Birth", value: patient?.date_of_birth || "—" },
    { key: "blood_group", label: "Blood Group", value: patient?.blood_group },
    { key: "emergency_contact", label: "Emergency Contact", value: patient?.emergency_contact },
    { key: "guardian_name", label: "Guardian Name", value: patient?.guardian_name },
    { key: "guardian_phone", label: "Guardian Phone", value: patient?.guardian_phone },
  ].filter((f) => f.value);

  const s = {
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
    h1: { fontSize: 26, fontWeight: 800, color: "var(--text)" },
    sosBtn: { padding: "12px 24px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 15, background: "#dc2626", color: "#fff", letterSpacing: "1px", boxShadow: "0 4px 14px #dc262640" },
    card: { background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", padding: 22, marginBottom: 16 },
    grid4: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
    statCard: { background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: "18px 20px", textAlign: "center" },
    statVal: { fontSize: 30, fontWeight: 800, color: "var(--accent)" },
    statLabel: { fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 3 },
    alertCard: (sev) => ({ background: sev === "CRITICAL" ? "#dc262610" : "#f59e0b10", border: `1px solid ${sev === "CRITICAL" ? "#dc262644" : "#f59e0b44"}`, borderRadius: 12, padding: "12px 16px", marginBottom: 8 }),
    alertTitle: (sev) => ({ fontWeight: 700, fontSize: 14, color: sev === "CRITICAL" ? "#dc2626" : "#d97706" }),
    alertMsg: { fontSize: 12, color: "var(--muted)", marginTop: 3 },
    startBtn: { width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 15, background: "var(--accent)", color: "#fff", marginTop: 12 },
    detCard: (color) => ({ background: color + "15", border: `1px solid ${color}44`, borderRadius: 12, padding: "14px 18px", marginBottom: 12 }),
    infoRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, position: "relative" },
    infoLabel: { fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 },
    infoVal: { fontSize: 13, fontWeight: 700, color: "var(--text)" },
    tag: (color) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: color + "22", color, marginRight: 6, marginBottom: 4 }),
    h2: { fontSize: 16, fontWeight: 700, marginBottom: 14, color: "var(--text)" },
    aiBox: { background: "var(--stat-bg)", borderRadius: 10, padding: 14, fontSize: 13, lineHeight: 1.7, color: "var(--text)", marginTop: 10 },
    updatedBadge: { display: "inline-flex", alignItems: "center", gap: 3, cursor: "pointer", padding: "1px 6px", borderRadius: 999, background: "#F59E0B22" },
    updatedDot: { width: 6, height: 6, borderRadius: "50%", background: "#F59E0B" },
    updatedText: { fontSize: 9, fontWeight: 800, color: "#F59E0B", textTransform: "uppercase", letterSpacing: "0.3px" },
    popover: { position: "absolute", top: "calc(100% + 4px)", left: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "var(--text)", boxShadow: "0 6px 18px rgba(0,0,0,0.25)", zIndex: 50, whiteSpace: "nowrap" },
    pinBanner: { background: "#f59e0b12", border: "1px solid #f59e0b44", borderRadius: 12, padding: "14px 18px", marginBottom: 16 },
    pinBannerTitle: { fontWeight: 800, fontSize: 14, color: "#d97706", marginBottom: 4 },
    pinBannerText: { fontSize: 12, color: "var(--text)", marginBottom: 10 },
    pinRow: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" },
    pinInput: { width: 100, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text)", fontSize: 14, outline: "none" },
    pinLabel: { fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4, display: "block" },
    pinSaveBtn: { padding: "9px 18px", borderRadius: 8, border: "none", background: "#d97706", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  };

  return (
    <div>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.h1}>Welcome, {patient?.name} <button onClick={() => setShowEditModal(true)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: 12, fontWeight: 700, marginLeft: 10 }}>✏️ Edit Profile</button></div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>ID: {patient?.id} · {patient?.age} yrs · {patient?.gender}</div>
        </div>
        <button style={s.sosBtn} onClick={handleSOS} disabled={sosLoading}>
          {sosLoading ? "Sending..." : "🆘 SOS"}
        </button>
      </div>

      {/* Critical history alert */}
      {hasCritical && (
        <div style={{ background: "#dc262612", border: "1px solid #dc262655", borderRadius: 12, padding: "12px 18px", marginBottom: 16, color: "#dc2626", fontWeight: 700, fontSize: 14 }}>
          ⚠️ Red Flag: This patient has a previous CRITICAL episode on record. Exercise extra caution.
        </div>
      )}

      {/* Secure Your Account — shown to legacy patients with no PIN on file */}
      {patient && patient.has_pin === false && !setupPinDone && (
        <div style={s.pinBanner}>
          <div style={s.pinBannerTitle}>🔒 Secure Your Account</div>
          {!showPinSetup ? (
            <>
              <div style={s.pinBannerText}>
                Your account doesn't have a PIN set yet. Set one now so you can log in quickly and securely next time.
              </div>
              <button style={s.pinSaveBtn} onClick={() => setShowPinSetup(true)}>Set a PIN</button>
            </>
          ) : (
            <>
              {setupPinError && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>{setupPinError}</div>}
              <div style={s.pinRow}>
                <div>
                  <label style={s.pinLabel}>New PIN</label>
                  <input
                    style={s.pinInput}
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••"
                    value={setupPin}
                    onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </div>
                <div>
                  <label style={s.pinLabel}>Confirm PIN</label>
                  <input
                    style={s.pinInput}
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••"
                    value={setupPinConfirm}
                    onChange={(e) => setSetupPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </div>
                <button style={s.pinSaveBtn} onClick={handleSetPin} disabled={setupPinSaving}>
                  {setupPinSaving ? "Saving…" : "Save PIN"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {setupPinDone && (
        <div style={{ ...s.pinBanner, background: "#22c55e12", borderColor: "#22c55e44" }}>
          <div style={{ ...s.pinBannerTitle, color: "#16a34a" }}>✅ PIN set successfully</div>
          <div style={s.pinBannerText}>You can now log in with your PIN next time.</div>
        </div>
      )}

      {/* Stats */}
      <div style={s.grid4}>
        {[
          { val: stats.total_visits ?? "—", label: "Total Visits" },
          { val: stats.last_risk_score ? Math.round(stats.last_risk_score) : "—", label: "Last Risk Score" },
          { val: stats.last_triage || "—", label: "Last Triage" },
          { val: stats.unread_alerts ?? 0, label: "Unread Alerts" },
        ].map((s2, i) => (
          <div key={i} style={s.statCard}>
            <div style={s.statVal}>{s2.val}</div>
            <div style={s.statLabel}>{s2.label}</div>
          </div>
        ))}
      </div>

      <div style={s.grid2}>
        {/* Left column */}
        <div>
          {/* Patient info */}
          <div style={s.card} ref={profileCardRef}>
            <div style={s.h2}>Patient Profile</div>
            {profileFields.map((f) => {
              const entry = auditMap[f.key];
              const show = shouldShowBadge(entry);
              return (
                <div key={f.key} style={s.infoRow}>
                  <span style={s.infoLabel}>
                    {f.label}
                    {show && (
                      <span
                        onClick={(e) => { e.stopPropagation(); handleBadgeClick(entry); }}
                        style={s.updatedBadge}
                        title="Click for details"
                      >
                        <span style={s.updatedDot} />
                        <span style={s.updatedText}>Updated</span>
                      </span>
                    )}
                    {openBadge === entry?.change_number && (
                      <div style={s.popover}>
                        Updated by {entry.admin_name} ({entry.admin_id}) on {entry.date}
                      </div>
                    )}
                  </span>
                  <span style={s.infoVal}>{f.value}</span>
                </div>
              );
            })}
            <button style={s.startBtn} onClick={() => nav("/symptoms")}>
              + Start New Visit
            </button>
          </div>

          {/* AI Summary */}
          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={s.h2}>🤖 AI Health Summary</div>
              <button onClick={loadAISummary} disabled={loadingAI} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }}>
                {loadingAI ? "Loading..." : "Generate"}
              </button>
            </div>
            {aiSummary ? <div style={s.aiBox}>{aiSummary}</div> : <div style={{ color: "var(--muted)", fontSize: 13 }}>Click Generate to create an AI summary of this patient's health history.</div>}
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Health Trend */}
          {deterioration && deterioration.status !== "INSUFFICIENT_DATA" && (
            <div style={s.detCard(deterioration.color || "#2563eb")}>
              <div style={{ fontWeight: 800, fontSize: 15, color: deterioration.color, marginBottom: 4 }}>
                {deterioration.emoji} Health Trend: {T.recovery[deterioration.status] || deterioration.status}
              </div>
              <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 8 }}>
                {riskTrendText || deterioration.message}
              </div>
              {deterioration.deterioration_alert && (
                <div style={{ background: "#dc262615", border: "1px solid #dc262644", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#dc2626", fontWeight: 700, marginBottom: 8 }}>
                  {deterioration.deterioration_alert.message}
                </div>
              )}
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Current Risk: {deterioration.current_risk} · Predicted Next: {deterioration.predicted_next_risk}
              </div>
              {lastAssessedText && (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                  Last assessed: {lastAssessedText}
                </div>
              )}
              {nextCheckin && (
                <div style={{ marginTop: 6, fontSize: 12, color: isOverdue ? "#dc2626" : "var(--muted)", fontWeight: isOverdue ? 700 : 400 }}>
                  {isOverdue
                    ? `⏰ Follow-up overdue — ${nextCheckin.message}`
                    : `🗓 Next recommended check-in: ${nextCheckin.days === 0 ? "Immediate" : "Day " + nextCheckin.days} — ${nextCheckin.message}`}
                </div>
              )}
            </div>
          )}

          {/* Needs Attention — shown only when the follow-up engine triggered a re-triage */}
          {needsAttention && (
            <div style={{ background: "#dc262615", border: "1px solid #dc262666", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#dc2626", marginBottom: 4 }}>
                ⚠️ Needs Attention
              </div>
              <div style={{ fontSize: 12, color: "var(--text)" }}>
                {latestFollowupAnalysis.retriage.reasons.join("; ")}
              </div>
            </div>
          )}

          {/* Risk trend chart */}
          {riskHistory.length >= 2 && (
            <div style={s.card}>
              <div style={s.h2}>Risk Score Trend</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={riskHistory}>
                  <XAxis dataKey="visit" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="risk" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

         {alerts.length > 0 && <RecentAlertsCard alerts={alerts} onAlertsUpdated={loadData} />}
        </div>
      </div>

      {showEditModal && (
        <EditPatientModal
          onClose={() => setShowEditModal(false)}
          onSaved={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}
