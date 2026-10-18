import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { api } from "../api/client";
import { generateFullHistoryReport } from "../utils/pdfReport";

const TRIAGE_COLORS   = { P1: "#EF4444", P2: "#F97316", P3: "#F59E0B", P4: "#22C55E" };
const RECOVERY_COLORS = { IMPROVING: "#22C55E", STABLE: "#F59E0B", WORSENING: "#EF4444", FLUCTUATING: "#7c3aed" };
const RECOVERY_ICONS  = { IMPROVING: "📈", STABLE: "➡️", WORSENING: "📉", FLUCTUATING: "↕️" };

// ── First aid & medication suggestions ────────────────────────────────────────
function getWorseningAdvice(symptoms = []) {
  const syms = symptoms.map(s => s.toLowerCase());
  const advice = { actions: [], medications: [] };

  if (syms.some(s => s.includes("fever") || s.includes("temperature"))) {
    advice.actions.push("Apply cool wet cloth to forehead and neck");
    advice.actions.push("Stay in a cool, well-ventilated room");
    advice.medications.push("Paracetamol 500mg every 6 hours (max 4 doses/day) for fever above 101°F");
  }
  if (syms.some(s => s.includes("chest") || s.includes("heart") || s.includes("pain"))) {
    advice.actions.push("Sit upright — do NOT lie flat");
    advice.actions.push("Call 102 / 108 immediately if chest pain is severe");
    advice.medications.push("Aspirin 325mg (if not allergic) — only for suspected cardiac event");
  }
  if (syms.some(s => s.includes("breath") || s.includes("spo2") || s.includes("oxygen"))) {
    advice.actions.push("Sit upright or lean forward slightly to ease breathing");
    advice.actions.push("Call 102 / 108 if SpO2 drops below 90%");
  }
  if (syms.some(s => s.includes("anxiety") || s.includes("panic") || s.includes("mood"))) {
    advice.actions.push("Practice 4-7-8 breathing: inhale 4s, hold 7s, exhale 8s");
    advice.medications.push("Avoid caffeine and alcohol completely");
  }
  if (syms.some(s => s.includes("vomit") || s.includes("nausea") || s.includes("dehydrat"))) {
    advice.actions.push("Sip ORS slowly every 15 minutes");
    advice.medications.push("ORS sachets — dissolve in 1L water");
  }
  if (syms.some(s => s.includes("headache") || s.includes("migraine"))) {
    advice.actions.push("Rest in a dark, quiet room");
    advice.medications.push("Paracetamol 500mg or Ibuprofen 400mg (if no stomach issues)");
  }
  if (advice.actions.length === 0) {
    advice.actions = [
      "Seek medical attention immediately — do not delay",
      "Rest completely and avoid all physical exertion",
      "Call 102 / 108 if condition deteriorates further",
    ];
    advice.medications = [
      "Paracetamol 500mg for pain/fever — every 6 hours, max 4 doses/day",
      "Do NOT self-medicate beyond basic first aid without doctor advice",
    ];
  }
  return advice;
}

// ── Risk score — guaranteed 0 when all normal ─────────────────────────────────
function calculateRisk(baseRisk, currentSymptoms, originalSymptoms, newSymptomsText, vitals) {
  const newSymptomList = newSymptomsText
    .split(",").map(s => s.trim())
    .filter(s => s && s.toLowerCase() !== "nothing" && s.toLowerCase() !== "none" && s.length > 1);

  const allResolved = currentSymptoms.length === 0 && newSymptomList.length === 0;

  const spo2  = parseFloat(vitals.spo2);
  const pulse = parseFloat(vitals.pulse);
  const rr    = parseFloat(vitals.respiratory_rate);
  const temp  = parseFloat(vitals.temperature);
  const hasVitals = !isNaN(spo2) || !isNaN(pulse) || !isNaN(rr) || !isNaN(temp);

  const allVitalsNormal = !hasVitals || (
    (isNaN(spo2)  || spo2  >= 96) &&
    (isNaN(pulse) || (pulse >= 60 && pulse <= 90)) &&
    (isNaN(rr)    || (rr    >= 12 && rr    <= 18)) &&
    (isNaN(temp)  || (temp  >= 97 && temp  <= 99))
  );

  // GUARANTEED ZERO: all symptoms resolved + nothing new + vitals normal (or not entered)
  if (allResolved && allVitalsNormal) return 0;

  const totalOriginal = originalSymptoms.length || 1;
  const symptomRatio  = currentSymptoms.length / totalOriginal;
  let score = allResolved ? 0 : baseRisk * (0.2 + 0.8 * symptomRatio);
  score += newSymptomList.length * 8;

  if (!isNaN(spo2)) {
    if      (spo2 < 90)  score += 30;
    else if (spo2 < 94)  score += 10;
    else if (spo2 >= 96) score  = Math.max(0, score - 5);
  }
  if (!isNaN(pulse)) {
    if      (pulse > 120 || pulse < 50) score += 20;
    else if (pulse > 100)                score += 8;
    else if (pulse >= 60 && pulse <= 90) score = Math.max(0, score - 5);
  }
  if (!isNaN(rr)) {
    if      (rr < 8 || rr > 25)  score += 25;
    else if (rr > 20)             score += 5;
    else if (rr >= 12 && rr <= 18) score = Math.max(0, score - 5);
  }
  if (!isNaN(temp)) {
    if      (temp < 95 || temp > 103) score += 20;
    else if (temp > 100)               score += 8;
    else if (temp >= 97 && temp <= 99) score = Math.max(0, score - 5);
  }
  if (allVitalsNormal) score = Math.max(0, score - 15);

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Follow-Up Modal ──────────────────────────────────────────────────────────
function FollowUpModal({ visit, patientId, onClose, onSave }) {
  const [dayNum,          setDayNum]         = useState(3);
  const [currentSymptoms, setCurrentSymptoms]= useState([...(visit.symptoms || [])]);
  const [newSymptoms,     setNewSymptoms]    = useState("");
  const [notes,           setNotes]          = useState("");
  const [vitals,          setVitals]         = useState({ pulse: "", spo2: "", temperature: "", blood_pressure: "", respiratory_rate: "" });
  const [loading,         setLoading]        = useState(false);
  const [result,          setResult]         = useState(null);
  const fmt = s => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const estimatedRisk = calculateRisk(visit.risk_score || 50, currentSymptoms, visit.symptoms || [], newSymptoms, vitals);

  async function submit() {
    setLoading(true);
    try {
      const newSymptomList = newSymptoms.split(",")
        .map(s => s.trim().toLowerCase().replace(/ /g, "_"))
        .filter(s => s && s !== "nothing" && s !== "none" && s.length > 1);

      const res = await api.followup.create({
        patient_id:         patientId,
        original_visit_id:  visit.id,
        day_number:         dayNum,
        current_symptoms:   [...currentSymptoms, ...newSymptomList],
        current_risk_score: estimatedRisk,
        notes,
        pulse:              vitals.pulse            ? parseFloat(vitals.pulse)            : undefined,
        spo2:               vitals.spo2             ? parseFloat(vitals.spo2)             : undefined,
        temperature:        vitals.temperature      ? parseFloat(vitals.temperature)      : undefined,
        blood_pressure:     vitals.blood_pressure   || undefined,
        respiratory_rate:   vitals.respiratory_rate ? parseFloat(vitals.respiratory_rate) : undefined,
      });
      setResult({ ...res, estimatedRisk, newSymptomList });
      onSave({ ...res, original_visit_id: visit.id });
    } catch (e) { alert(e.message); }
    setLoading(false);
  }

  const s = {
    overlay: { position: "fixed", inset: 0, background: "#00000085", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
    modal:   { background: "var(--surface)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px #00000060", border: "1px solid var(--border)" },
    h2:      { fontSize: 18, fontWeight: 700, marginBottom: 20, color: "var(--text)" },
    label:   { display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px" },
    input:   { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box", outline: "none", fontFamily: "inherit" },
    chip:    (sel) => ({ padding: "5px 12px", borderRadius: 20, border: "1px solid", borderColor: sel ? "var(--accent)" : "var(--border)", background: sel ? "var(--accent)" : "transparent", color: sel ? "#fff" : "var(--text)", cursor: "pointer", fontSize: 12, margin: "0 6px 6px 0", display: "inline-block" }),
    field:   { marginBottom: 20 },
    btnPrimary: { padding: "11px 22px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, background: "var(--accent)", color: "#fff", marginRight: 10 },
    btnSecondary: { padding: "11px 22px", borderRadius: 10, border: "1px solid var(--border)", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "transparent", color: "var(--text)" },
  };

  if (result) {
    const isWorse = result.recovery_status === "WORSENING";
    const advice  = isWorse ? getWorseningAdvice([...currentSymptoms, ...(result.newSymptomList || [])]) : null;

    return (
      <div style={s.overlay} onClick={onClose}>
        <div style={s.modal} onClick={e => e.stopPropagation()}>
          <div style={s.h2}>Follow-Up Recorded ✅</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: RECOVERY_COLORS[result.recovery_status] || "#64748b", marginBottom: 8 }}>
            {RECOVERY_ICONS[result.recovery_status]} {result.recovery_status}
          </div>
          <div style={{ fontSize: 14, color: "var(--text)", marginBottom: 8, lineHeight: 1.6 }}>{result.recovery_message}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
            Risk score: <strong style={{ color: "var(--text)" }}>{result.estimatedRisk}/100</strong> (was {Math.round(visit.risk_score || 0)}/100)
          </div>

          {result.symptoms_resolved?.length > 0 && (
            <div style={s.field}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#22C55E", marginBottom: 8 }}>✅ Symptoms Resolved:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.symptoms_resolved.map(s => <span key={s} style={{ padding: "3px 10px", borderRadius: 20, background: "#22C55E22", color: "#22C55E", fontSize: 12 }}>{s.replace(/_/g," ")}</span>)}
              </div>
            </div>
          )}

          {result.symptoms_new?.length > 0 && (
            <div style={s.field}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#EF4444", marginBottom: 8 }}>🆕 New Symptoms:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.symptoms_new.map(s => <span key={s} style={{ padding: "3px 10px", borderRadius: 20, background: "#EF444422", color: "#EF4444", fontSize: 12 }}>{s.replace(/_/g," ")}</span>)}
              </div>
            </div>
          )}

          {isWorse && advice && (
            <div style={{ marginBottom: 20, borderRadius: 12, border: "1px solid #EF444433", overflow: "hidden" }}>
              <div style={{ background: "#EF444418", padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "#EF4444" }}>⚠️ Immediate Actions Needed</div>
              <div style={{ padding: "12px 16px", background: "var(--stat-bg)" }}>
                {advice.actions.map((a, i) => <div key={i} style={{ fontSize: 12, color: "var(--text)", marginBottom: 5 }}>• {a}</div>)}
                <div style={{ marginTop: 10, padding: "8px 12px", background: "#F59E0B10", border: "1px solid #F59E0B33", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", marginBottom: 4 }}>💊 Medication Guidance:</div>
                  {advice.medications.map((m, i) => <div key={i} style={{ fontSize: 11, color: "var(--text)", marginBottom: 2 }}>• {m}</div>)}
                </div>
              </div>
            </div>
          )}

          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>Day {result.day_number} check-in saved to history.</div>
          <button style={s.btnPrimary} onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.h2}>📅 Log Follow-Up Visit</div>

        <div style={s.field}>
          <label style={s.label}>Which day is this check-in?</label>
          <select style={s.input} value={dayNum} onChange={e => setDayNum(parseInt(e.target.value))}>
            {[1,2,3,5,7,10,14,21,30].map(d => <option key={d} value={d}>Day {d}</option>)}
          </select>
        </div>

        <div style={s.field}>
          <label style={s.label}>Which symptoms are STILL present? (uncheck resolved ones)</label>
          <div style={{ display: "flex", flexWrap: "wrap", marginTop: 8, maxHeight: 200, overflowY: "auto" }}>
            {(visit.symptoms || []).map(sym => (
              <button key={sym} style={s.chip(currentSymptoms.includes(sym))}
                onClick={() => setCurrentSymptoms(prev => prev.includes(sym) ? prev.filter(x => x !== sym) : [...prev, sym])}>
                {fmt(sym)}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
            {currentSymptoms.length} still present · {(visit.symptoms?.length || 0) - currentSymptoms.length} resolved
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>Any NEW symptoms since last visit? (comma separated, or "nothing")</label>
          <input style={s.input} value={newSymptoms} onChange={e => setNewSymptoms(e.target.value)} placeholder='e.g. headache, vomiting — or type "nothing"' />
        </div>

        <div style={s.field}>
          <label style={s.label}>Current Vitals (optional but recommended)</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
            {[
              { key: "pulse",            placeholder: "Pulse (bpm)" },
              { key: "spo2",             placeholder: "SpO2 (%)" },
              { key: "temperature",      placeholder: "Temp (°F)" },
              { key: "blood_pressure",   placeholder: "BP (e.g. 120/80)" },
              { key: "respiratory_rate", placeholder: "Resp Rate (/min)" },
            ].map(f => (
              <input key={f.key} style={s.input} placeholder={f.placeholder}
                value={vitals[f.key]} onChange={e => setVitals(prev => ({ ...prev, [f.key]: e.target.value }))}
                type={f.key === "blood_pressure" ? "text" : "number"} />
            ))}
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>Notes (optional)</label>
          <textarea style={{ ...s.input, height: 80, resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Visited doctor, started antibiotics, fever reduced..." />
        </div>

        <div style={{ background: "var(--stat-bg)", borderRadius: 10, padding: "12px 16px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Estimated Risk Score</span>
          <span style={{ fontSize: 20, fontWeight: 900, color: estimatedRisk >= 75 ? "#EF4444" : estimatedRisk >= 50 ? "#F97316" : estimatedRisk >= 25 ? "#F59E0B" : "#22C55E" }}>{estimatedRisk}/100</span>
        </div>

        <button style={s.btnPrimary} onClick={submit} disabled={loading}>
          {loading ? "Saving..." : "Save Follow-Up"}
        </button>
        <button style={s.btnSecondary} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Vitals Grid ──────────────────────────────────────────────────────────────
function VitalsGrid({ visit }) {
  const vitals = [
    { label: "Pulse",     value: visit.pulse != null ? `${visit.pulse} bpm` : "—",  warn: visit.pulse != null && (visit.pulse < 50 || visit.pulse > 120), icon: "❤️" },
    { label: "SpO2",      value: visit.spo2  != null ? `${visit.spo2}%`    : "—",   warn: visit.spo2  != null && visit.spo2 < 90, icon: "🫁" },
    { label: "Temp",      value: visit.temperature != null ? `${visit.temperature}°F` : "—", warn: visit.temperature != null && (visit.temperature < 95 || visit.temperature > 103), icon: "🌡️" },
    { label: "BP",        value: visit.blood_pressure || "—", warn: false, icon: "🩺" },
    { label: "Resp Rate", value: visit.respiratory_rate != null ? `${visit.respiratory_rate}/min` : "—", warn: visit.respiratory_rate != null && (visit.respiratory_rate < 8 || visit.respiratory_rate > 25), icon: "💨" },
    { label: "NEWS2",     value: visit.news2_score != null ? `${visit.news2_score}/20` : "—", warn: visit.news2_score != null && visit.news2_score >= 7, icon: "📊" },
  ];
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>🩺 Vital Signs</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        {vitals.map((v, i) => (
          <div key={i} style={{ background: v.warn ? "#EF444418" : "var(--stat-bg)", border: `1px solid ${v.warn ? "#EF444455" : "var(--border)"}`, borderRadius: 10, padding: "12px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 14, marginBottom: 3 }}>{v.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: v.warn ? "#F87171" : "var(--text)", lineHeight: 1.2 }}>{v.value}</div>
            <div style={{ fontSize: 9, color: v.warn ? "#F87171" : "var(--muted)", marginTop: 3, fontWeight: v.warn ? 700 : 400 }}>{v.warn ? "⚠ " : ""}{v.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Follow-Up Timeline ───────────────────────────────────────────────────────
function FollowUpTimeline({ followups, intelligence }) {
  const [expanded, setExpanded] = useState(null);
  if (!followups || followups.length === 0) return null;

  const analysisById = {};
  (intelligence?.followups || []).forEach(a => { analysisById[a.followup_id] = a; });
  const persistence = intelligence?.symptom_persistence || {};
  const nextCheckin = intelligence?.next_checkin;
  const overdue = intelligence?.overdue;

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>
        📅 Follow-Up Timeline ({followups.length} check-in{followups.length > 1 ? "s" : ""})
      </div>

      {/* Symptom persistence summary */}
      {Object.keys(persistence).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {Object.entries(persistence).map(([sym, count]) => (
            <span key={sym} style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: count >= 5 ? "#EF444422" : count >= 3 ? "#F9731622" : "#F59E0B22", color: count >= 5 ? "#EF4444" : count >= 3 ? "#F97316" : "#F59E0B" }}>
              {count >= 5 ? "🔴" : count >= 3 ? "🟠" : "🟡"} {sym} — persistent for {count} check-in{count > 1 ? "s" : ""}
            </span>
          ))}
        </div>
      )}

      {/* Next check-in / overdue banner */}
      {nextCheckin && (
        <div style={{
          background: overdue?.overdue ? "#EF444415" : "var(--stat-bg)",
          border: `1px solid ${overdue?.overdue ? "#EF444444" : "var(--border)"}`,
          borderRadius: 10, padding: "12px 16px", marginBottom: 16,
          fontSize: 12, color: overdue?.overdue ? "#EF4444" : "var(--text)", fontWeight: overdue?.overdue ? 700 : 400,
        }}>
          {overdue?.overdue
            ? `⏰ Follow-up overdue by ${overdue.overdue_by_days} day${overdue.overdue_by_days > 1 ? "s" : ""} — ${nextCheckin.message}`
            : `🗓 Next recommended check-in: ${nextCheckin.days === 0 ? "Immediate" : "Day " + nextCheckin.days} — ${nextCheckin.message}`}
        </div>
      )}

      <div style={{ position: "relative", paddingLeft: 26 }}>
        <div style={{ position: "absolute", left: 9, top: 4, bottom: 4, width: 2, background: "var(--border)", borderRadius: 1 }} />

        {followups.map((fu, i) => {
          const color   = RECOVERY_COLORS[fu.recovery_status] || "#64748b";
          const icon    = RECOVERY_ICONS[fu.recovery_status]  || "➡️";
          const isExp   = expanded === i;
          const isWorse = fu.recovery_status === "WORSENING";
          const symptoms = [...(fu.symptoms_improved || []), ...(fu.symptoms_worsened || [])];
          const advice  = isWorse ? getWorseningAdvice(symptoms) : null;
          const analysis = analysisById[fu.id];

          return (
            <div key={fu.id || i} style={{ position: "relative", marginBottom: 18 }}>
              {/* Dot on timeline */}
              <div style={{
                position: "absolute", left: -21, top: 16,
                width: 16, height: 16, borderRadius: "50%",
                background: color, border: "3px solid var(--surface)",
                boxShadow: `0 0 0 2px ${color}55`,
                zIndex: 1,
              }} />

              <div
                style={{ background: "var(--stat-bg)", borderRadius: 14, border: `1px solid ${color}33`, padding: "16px 20px", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}
                onClick={() => setExpanded(isExp ? null : i)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color }}>{icon} Day {fu.day_number}</span>
                    <span style={{ padding: "3px 12px", borderRadius: 20, background: color + "22", color, fontSize: 11, fontWeight: 700 }}>
                      {fu.recovery_status}
                    </span>
                    {fu.current_risk_score != null && (
                      <span style={{ fontSize: 11, fontWeight: 700, color }}>Risk: {Math.round(fu.current_risk_score)}/100</span>
                    )}
                    {analysis?.retriage?.triggered && (
                      <span style={{ padding: "3px 12px", borderRadius: 20, background: "#EF444422", color: "#EF4444", fontSize: 11, fontWeight: 800 }}>
                        🤖 AI RE-TRIAGE TRIGGERED
                      </span>
                    )}
                    {analysis?.escalation?.length > 0 && (
                      <span style={{ padding: "3px 12px", borderRadius: 20, background: "#EF444422", color: "#EF4444", fontSize: 11, fontWeight: 800 }}>
                        🚨 NEW HIGH-CONCERN SYMPTOM
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {fu.followup_date && (
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>
                        {new Date(fu.followup_date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    )}
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{isExp ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Change summary narrative — always visible */}
                {analysis?.change_summary?.narrative && (
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10, lineHeight: 1.5, fontStyle: "italic" }}>
                    Since last visit: {analysis.change_summary.narrative}
                  </div>
                )}

                {analysis?.retriage?.triggered && (
                  <div style={{ marginTop: 10, background: "#EF444412", border: "1px solid #EF444444", borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#EF4444" }}>Reason: {analysis.retriage.reasons.join("; ")}</div>
                  </div>
                )}

                {isExp && (
                  <div style={{ marginTop: 16 }}>
                    {/* Vitals at this check-in */}
                    {(fu.pulse || fu.spo2 || fu.temperature || fu.blood_pressure || fu.respiratory_rate) && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase" }}>Vitals at This Check-in</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
                          {[
                            { label: "Pulse", val: fu.pulse ? fu.pulse + " bpm" : "—" },
                            { label: "SpO2",  val: fu.spo2  ? fu.spo2  + "%"   : "—" },
                            { label: "Temp",  val: fu.temperature ? fu.temperature + "°F" : "—" },
                            { label: "BP",    val: fu.blood_pressure || "—" },
                            { label: "Resp",  val: fu.respiratory_rate ? fu.respiratory_rate + "/min" : "—" },
                          ].map((v, vi) => (
                            <div key={vi} style={{ textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 4px" }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{v.val}</div>
                              <div style={{ fontSize: 8, color: "var(--muted)", marginTop: 2 }}>{v.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Symptoms resolved */}
                    {fu.symptoms_improved?.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", marginBottom: 6 }}>✅ Resolved:</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {fu.symptoms_improved.map(s => (
                            <span key={s} style={{ padding: "3px 10px", borderRadius: 20, background: "#22C55E22", color: "#22C55E", fontSize: 11 }}>
                              {s.replace(/_/g," ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* New/worsened symptoms */}
                    {fu.symptoms_worsened?.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", marginBottom: 6 }}>🆕 New / Worsened:</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {fu.symptoms_worsened.map(s => (
                            <span key={s} style={{ padding: "3px 10px", borderRadius: 20, background: "#EF444422", color: "#EF4444", fontSize: 11 }}>
                              {s.replace(/_/g," ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* First aid & medication when worsening */}
                    {isWorse && advice && (
                      <div style={{ marginBottom: 10, borderRadius: 10, border: "1px solid #EF444433", overflow: "hidden" }}>
                        <div style={{ background: "#EF444418", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#EF4444" }}>⚠️ Condition Worsening — Immediate Actions</div>
                        <div style={{ padding: "12px 14px", background: "var(--surface)" }}>
                          {advice.actions.slice(0, 3).map((a, ai) => (
                            <div key={ai} style={{ fontSize: 12, color: "var(--text)", marginBottom: 5 }}>• {a}</div>
                          ))}
                          {advice.medications.length > 0 && (
                            <div style={{ marginTop: 10, padding: "8px 12px", background: "#F59E0B10", border: "1px solid #F59E0B33", borderRadius: 6 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B", marginBottom: 4 }}>💊 Medication Guidance:</div>
                              {advice.medications.slice(0, 2).map((m, mi) => (
                                <div key={mi} style={{ fontSize: 11, color: "var(--text)", marginBottom: 2 }}>• {m}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {fu.notes && (
                      <div style={{ fontSize: 13, color: "var(--text)", background: "var(--surface)", borderRadius: 8, padding: "10px 14px", marginTop: 8, lineHeight: 1.5 }}>
                        📝 {fu.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Clinical Event Timeline (flat chronological list, per visit) ───────────
function ClinicalEventTimeline({ intelligence }) {
  const events = intelligence?.timeline || [];
  if (events.length === 0) return null;
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>🕒 Clinical Event Timeline</div>
      <div style={{ background: "var(--stat-bg)", borderRadius: 12, padding: "14px 18px" }}>
        {events.map((e, i) => (
          <div key={i} style={{ display: "flex", gap: 10, fontSize: 12, marginBottom: i === events.length - 1 ? 0 : 10, alignItems: "flex-start" }}>
            <span style={{ fontWeight: 700, color: "var(--accent)", minWidth: 46 }}>Day {e.day}</span>
            <span style={{ color: "var(--text)" }}>
              {e.label}
              {e.detail && <span style={{ color: "var(--muted)" }}> — {e.detail}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────
function FilterBar({ filters, setFilters }) {
  const s = {
    bar: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 20, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 },
    group: { display: "flex", flexDirection: "column", gap: 5 },
    label: { fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px" },
    input: { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text)", fontSize: 13, fontFamily: "inherit" },
  };
  return (
    <div style={s.bar}>
      <div style={s.group}>
        <label style={s.label}>From</label>
        <input style={s.input} type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
      </div>
      <div style={s.group}>
        <label style={s.label}>To</label>
        <input style={s.input} type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
      </div>
      <div style={s.group}>
        <label style={s.label}>Triage Level</label>
        <select style={s.input} value={filters.triage} onChange={e => setFilters(f => ({ ...f, triage: e.target.value }))}>
          <option value="ALL">All</option>
          <option value="P1">Urgency 1 (Highest)</option>
          <option value="P2">Urgency 2 (High)</option>
          <option value="P3">Urgency 3 (Moderate)</option>
          <option value="P4">Urgency 4 (Low)</option>
        </select>
      </div>
      <div style={{ ...s.group, flex: 1, minWidth: 160 }}>
        <label style={s.label}>Search Symptom / Condition</label>
        <input style={s.input} placeholder="e.g. fever, dengue..." value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
      </div>
      {(filters.dateFrom || filters.dateTo || filters.triage !== "ALL" || filters.search) && (
        <button
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 12 }}
          onClick={() => setFilters({ dateFrom: "", dateTo: "", triage: "ALL", search: "" })}
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}


export default function HistoryPage() {
  const { patient } = useStore();
  const nav = useNavigate();
  const [visits,        setVisits]       = useState([]);
  const [followUpsMap,  setFollowUpsMap] = useState({});
  const [intelligenceMap, setIntelligenceMap] = useState({});
  const [loading,       setLoading]      = useState(true);
  const [followUpVisit, setFollowUpVisit]= useState(null);
  const [expandedVisit, setExpandedVisit]= useState(null);
  const [exportingPdf,  setExportingPdf] = useState(false);
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "", triage: "ALL", search: "" });

  useEffect(() => {
    if (!patient) { nav("/"); return; }
    loadVisits();
  }, [patient]);

  async function loadVisits() {
    try {
      const data = await api.visits.forPatient(patient.id);
      setVisits(data);
      const [followupResults, intelligenceResults] = await Promise.all([
        Promise.all(data.map(v => api.followup.forVisit(v.id).catch(() => ({ followups: [] })))),
        Promise.all(data.map(v => api.followup.intelligence(v.id).catch(() => null))),
      ]);
      const map = {};
      const intelMap = {};
      data.forEach((v, i) => {
        map[v.id] = followupResults[i]?.followups || [];
        intelMap[v.id] = intelligenceResults[i] || null;
      });
      setFollowUpsMap(map);
      setIntelligenceMap(intelMap);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleFollowUpSaved(result) {
    setFollowUpVisit(null);
    if (result?.original_visit_id) {
      try {
        const [fu, intel] = await Promise.all([
          api.followup.forVisit(result.original_visit_id),
          api.followup.intelligence(result.original_visit_id).catch(() => null),
        ]);
        setFollowUpsMap(prev => ({ ...prev, [result.original_visit_id]: fu.followups || [] }));
        setIntelligenceMap(prev => ({ ...prev, [result.original_visit_id]: intel }));
      } catch (e) { console.error(e); }
    }
  }

  const filteredVisits = useMemo(() => {
    return visits.filter(v => {
      if (filters.triage !== "ALL" && v.triage_level !== filters.triage) return false;
      if (filters.dateFrom && v.visit_date && new Date(v.visit_date) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && v.visit_date && new Date(v.visit_date) > new Date(filters.dateTo + "T23:59:59")) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const inSymptoms = (v.symptoms || []).some(s => s.toLowerCase().includes(q));
        const inDiseases = (v.predicted_diseases || []).some(d => (d.name || "").toLowerCase().includes(q));
        if (!inSymptoms && !inDiseases) return false;
      }
      return true;
    });
  }, [visits, filters]);

  async function handleExportFullHistory() {
    setExportingPdf(true);
    try {
      generateFullHistoryReport({ patient, visits, followUpsMap, intelligenceMap });
    } catch (e) {
      console.error(e);
      alert("Could not generate PDF. Please try again.");
    }
    setExportingPdf(false);
  }

  const fmt = str => str?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || str;
  const s = {
    h1:   { fontSize: 26, fontWeight: 800, marginBottom: 20, color: "var(--text)" },
    card: { background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", padding: 24, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" },
    h2:   { fontSize: 15, fontWeight: 700, color: "var(--text)" },
    tag:  (color) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: color + "22", color, marginRight: 6, marginBottom: 4 }),
    btnPrimary: { padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 12, background: "var(--accent)", color: "#fff" },
    btnSecondary: { padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", fontWeight: 600, fontSize: 12, background: "transparent", color: "var(--text)" },
  };

  if (loading) return <div style={{ color: "var(--muted)", padding: 60, textAlign: "center" }}>⏳ Loading visit history...</div>;

  return (
    <div>
      {followUpVisit && (
        <FollowUpModal visit={followUpVisit} patientId={patient.id} onClose={() => setFollowUpVisit(null)} onSave={handleFollowUpSaved} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={s.h1}>Visit History</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{visits.length} visit{visits.length !== 1 ? "s" : ""} total</div>
          {visits.length > 0 && (
            <button onClick={handleExportFullHistory} disabled={exportingPdf} style={s.btnPrimary}>
              {exportingPdf ? "Generating..." : "📄 Export Full History PDF"}
            </button>
          )}
        </div>
      </div>

      {visits.length > 0 && (
        <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: "16px 20px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>📈 Want to see your recovery trend?</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>The full trend chart now lives on the Insights page.</div>
          </div>
          <button onClick={() => nav("/insights")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
            View Insights →
          </button>
        </div>
      )}
      {visits.length > 0 && <FilterBar filters={filters} setFilters={setFilters} />}

      {visits.length === 0 ? (
        <div style={{ ...s.card, textAlign: "center", color: "var(--muted)", padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ marginBottom: 16 }}>No visits recorded yet.</div>
          <button onClick={() => nav("/symptoms")} style={{ ...s.btnPrimary, padding: "10px 24px", fontSize: 14 }}>Start First Visit</button>
        </div>
      ) : filteredVisits.length === 0 ? (
        <div style={{ ...s.card, textAlign: "center", color: "var(--muted)", padding: 36 }}>
          No visits match the current filters.
        </div>
      ) : filteredVisits.map((visit) => {
        const i = visits.findIndex(v => v.id === visit.id);
        const isExpanded     = expandedVisit === visit.id;
        const triageColor    = TRIAGE_COLORS[visit.triage_level] || "#64748b";
        const diseases       = visit.predicted_diseases || [];
        const visitFollowUps = followUpsMap[visit.id] || [];
        const visitIntel      = intelligenceMap[visit.id];

        return (
          <div key={visit.id} style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                  <div style={s.h2}>Visit #{visits.length - i}</div>
                  {visit.triage_level && <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: triageColor, color: "#fff" }}>{visit.triage_level}</span>}
                  {visit.risk_score != null && <span style={{ fontSize: 12, fontWeight: 700, color: visit.risk_score >= 75 ? "#EF4444" : visit.risk_score >= 50 ? "#F97316" : "#22C55E" }}>Risk: {Math.round(visit.risk_score)}/100</span>}
                  {visit.news2_score != null && <span style={{ fontSize: 11, background: visit.news2_score >= 7 ? "#EF444422" : "var(--stat-bg)", color: visit.news2_score >= 7 ? "#EF4444" : "var(--muted)", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>NEWS2: {visit.news2_score}</span>}
                  {visitFollowUps.length > 0 && <span style={{ fontSize: 11, background: "#7c3aed22", color: "#7c3aed", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>{visitFollowUps.length} follow-up{visitFollowUps.length > 1 ? "s" : ""}</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{visit.visit_date ? new Date(visit.visit_date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={s.btnSecondary} onClick={() => setFollowUpVisit(visit)}>📅 + Follow-Up</button>
                <button style={s.btnSecondary} onClick={() => setExpandedVisit(isExpanded ? null : visit.id)}>{isExpanded ? "▲ Less" : "▼ More"}</button>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Reported Symptoms</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(visit.symptoms || []).slice(0, 8).map((sym, si) => <span key={si} style={s.tag(triageColor)}>{fmt(sym)}</span>)}
                {(visit.symptoms || []).length > 8 && <span style={{ fontSize: 11, color: "var(--muted)", alignSelf: "center" }}>+{visit.symptoms.length - 8} more</span>}
                {(!visit.symptoms || visit.symptoms.length === 0) && <span style={{ fontSize: 12, color: "var(--muted)" }}>None recorded</span>}
              </div>
            </div>

            <VitalsGrid visit={visit} />

            {diseases.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Possible Conditions</div>
                <div>
                  {diseases.slice(0, 3).map(d => <span key={d.name} style={s.tag("#3B82F6")}>{d.name} {d.probability}%</span>)}
                  {diseases.length > 3 && <span style={{ fontSize: 11, color: "var(--muted)" }}>+{diseases.length - 3} more</span>}
                </div>
              </div>
            )}

            {isExpanded && diseases.length > 0 && (
              <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 12, textTransform: "uppercase" }}>Full Assessment</div>
                {diseases.map((d, di) => (
                  <div key={di} style={{ background: "var(--stat-bg)", borderRadius: 10, padding: "12px 16px", marginBottom: 10, border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>#{di+1} {d.name}</span>
                      <span style={{ fontWeight: 800, color: d.probability > 60 ? "#EF4444" : d.probability > 35 ? "#F59E0B" : "#64748b" }}>{d.probability}%</span>
                    </div>
                    {d.description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 5 }}>{d.description}</div>}
                  </div>
                ))}
              </div>
            )}

            <FollowUpTimeline followups={visitFollowUps} intelligence={visitIntel} />
            <ClinicalEventTimeline intelligence={visitIntel} />
          </div>
        );
      })}
    </div>
  );
}
