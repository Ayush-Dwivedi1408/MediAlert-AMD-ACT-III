import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { translations } from "../i18n";
import { generateMedicalReport } from "../utils/pdfReport";

const SEVERITY_STYLES = {
  CRITICAL: { bg: "#dc262612", border: "#dc262655", color: "#dc2626", pulse: true },
  HIGH:     { bg: "#ea580c12", border: "#ea580c55", color: "#ea580c", pulse: false },
  MEDIUM:   { bg: "#d9780612", border: "#d9780655", color: "#d97806", pulse: false },
  LOW:      { bg: "#16a34a12", border: "#16a34a55", color: "#16a34a", pulse: false },
};

const TRIAGE_COLORS = { P1: "#dc2626", P2: "#ea580c", P3: "#d97706", P4: "#16a34a" };

// Qualitative match strength instead of a falsely-precise percentage --
// reuses the same 60/35 thresholds already used for probColor below.
function matchLabel(probability) {
  if (probability > 60) return "High match";
  if (probability > 35) return "Moderate match";
  return "Low match";
}

function RiskMeter({ score }) {
  const color = score > 70 ? "#dc2626" : score > 40 ? "#f59e0b" : "#16a34a";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>Risk Indicator</span>
        <span style={{ fontSize: 24, fontWeight: 800, color }}>{score}<span style={{ fontSize: 13, color: "var(--muted)" }}>/100</span></span>
      </div>
      <div style={{ height: 14, borderRadius: 7, background: "var(--border)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: score + "%", background: color, borderRadius: 7, transition: "width 1s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "var(--muted)" }}>
        <span>LOW</span><span>MODERATE</span><span>HIGH</span><span>CRITICAL</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
        Rule-based indicator informed by NEWS2 vitals — not a calibrated clinical probability.
      </div>
    </div>
  );
}

// ── Disease Card — first aid shown for ALL diseases ───────────────────────────
function DiseaseCard({ disease, firstAid, rank }) {
  const [expanded, setExpanded] = useState(rank === 0);
  // Match first aid by disease name OR fall back to same-index entry
  const fa = firstAid?.find(f =>
    f.disease?.toLowerCase().trim() === disease.name?.toLowerCase().trim()
  ) || firstAid?.[rank];

  const probColor = disease.probability > 60 ? "#dc2626" : disease.probability > 35 ? "#f59e0b" : "#64748b";

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
      <div
        style={{ padding: "16px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", background: expanded ? "var(--stat-bg)" : "transparent" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>#{rank + 1} {disease.name} — {matchLabel(disease.probability)}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{disease.description}</div>
          <div style={{ height: 6, borderRadius: 3, background: "var(--border)", marginTop: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: disease.probability + "%", background: probColor, borderRadius: 3, transition: "width 1s" }} />
          </div>
        </div>
        <div style={{ marginLeft: 16, color: "var(--muted)", fontSize: 18 }}>{expanded ? "▲" : "▼"}</div>
      </div>

      {expanded && (
        <div style={{ padding: "0 20px 20px" }}>

          {/* SHAP explanation */}
          {disease.contributing_symptoms?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                🔍 Contributing Factors
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {disease.contributing_symptoms.map(sym => (
                  <span key={sym} style={{ padding: "4px 12px", borderRadius: 20, background: "#2563eb22", color: "#2563eb", fontSize: 12, fontWeight: 600 }}>
                    ✓ {sym.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
              {disease.why_predicted && (
                <div style={{ marginTop: 10, padding: "10px 14px", background: "var(--stat-bg)", borderRadius: 10, fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>
                  💡 {disease.why_predicted}
                </div>
              )}
            </div>
          )}

          {/* First Aid — for EVERY disease */}
          <div style={{ marginTop: 14, background: "var(--stat-bg)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              🩹 First Aid Steps
            </div>
            {fa ? (
              <>
                <ol style={{ paddingLeft: 20, margin: 0 }}>
                  {(fa.immediate_steps || fa.steps || []).map((step, i) => (
                    <li key={i} style={{ fontSize: 13, marginBottom: 6, lineHeight: 1.6, color: "var(--text)" }}>{step}</li>
                  ))}
                </ol>

                {fa.what_to_avoid?.length > 0 && (
                  <div style={{ marginTop: 12, background: "#dc262610", border: "1px solid #dc262633", borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>⛔ AVOID:</div>
                    {fa.what_to_avoid.map((a, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#dc2626", marginBottom: 3 }}>• {a}</div>
                    ))}
                  </div>
                )}

                {fa.recovery_timeline && (
                  <div style={{ marginTop: 10, padding: "8px 12px", background: "#16a34a10", border: "1px solid #16a34a33", borderRadius: 8, fontSize: 12, color: "#16a34a" }}>
                    ⏱ Recovery: {fa.recovery_timeline}
                  </div>
                )}
              </>
            ) : (
              /* Fallback generic first aid when API didn't return it for this disease */
              <div>
                <ol style={{ paddingLeft: 20, margin: 0 }}>
                  {[
                    "Keep the patient calm and comfortable",
                    "Monitor breathing and pulse every 5 minutes",
                    "Do not give food or water until assessed by a doctor",
                    "Seek medical attention if symptoms worsen",
                  ].map((step, i) => (
                    <li key={i} style={{ fontSize: 13, marginBottom: 6, lineHeight: 1.6, color: "var(--text)" }}>{step}</li>
                  ))}
                </ol>
                <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>
                  For specific first aid, consult a healthcare professional.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  const { patient, currentVisit, lang } = useStore();
  const T   = translations[lang];
  const nav = useNavigate();

  if (!currentVisit) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
        <div>No results yet. Start from the Assessment page.</div>
        <button onClick={() => nav("/symptoms")} style={{ marginTop: 16, padding: "10px 24px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
          Go to Assessment
        </button>
      </div>
    );
  }

  const { severity, news2, prediction, risk_score, triage_level, alerts } = currentVisit;
  const sevStyle    = SEVERITY_STYLES[severity?.severity] || SEVERITY_STYLES.LOW;
  const diseases    = prediction?.diseases || [];
  const firstAid    = prediction?.first_aid || [];
  const triageColor = TRIAGE_COLORS[triage_level] || "#64748b";

  // Top-ranked disease's recovery timeline, reused for the Follow-up section
  const topFirstAid = firstAid?.find(f =>
    f.disease?.toLowerCase().trim() === diseases[0]?.name?.toLowerCase().trim()
  ) || firstAid?.[0];

  const hasContributingFactors = severity?.contributing_vitals?.length > 0 || severity?.contributing_symptoms?.length > 0 || severity?.contributing_context?.length > 0;
  const hasRecommendations = prediction?.drug_interactions?.filter(Boolean).length > 0 || prediction?.health_literacy?.simple_summary;
  const hasEmergencyActions = prediction?.allergy_warnings?.filter(Boolean).length > 0 || prediction?.when_to_hospital || prediction?.health_literacy?.key_warning_signs?.length > 0;

  function exportPDF() {
    const visitData = {
      ...currentVisit,
      symptoms:         currentVisit.symptoms || [],
      pulse:            currentVisit.pulse,
      spo2:             currentVisit.spo2,
      temperature:      currentVisit.temperature,
      blood_pressure:   currentVisit.blood_pressure,
      respiratory_rate: currentVisit.respiratory_rate,
    };
    generateMedicalReport({
      patient,
      visit:   visitData,
      results: { ...prediction, risk_score, triage_level },
      severity,
      news2,
    });
  }

  const s = {
    card:      { background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", padding: 22, marginBottom: 16 },
    h1:        { fontSize: 26, fontWeight: 800, marginBottom: 6, color: "var(--text)" },
    h2:        { fontSize: 16, fontWeight: 700, marginBottom: 14, color: "var(--text)" },
    grid2:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 },
    alert:     (color) => ({ background: color + "12", border: `1px solid ${color}44`, borderRadius: 12, padding: "12px 16px", marginBottom: 10, color }),
    tag:       (color) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: color + "22", color, marginRight: 6, marginBottom: 4 }),
    actionRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 },
    btn:       { height: 40, padding: "0 20px", borderRadius: 10, border: "1px solid var(--border)", cursor: "pointer", fontWeight: 700, fontSize: 13, background: "transparent", color: "var(--text)" },
    sectionHeader: (first) => ({ fontSize: 12, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "1px", margin: first ? "0 0 12px" : "28px 0 12px" }),
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={s.h1}>Results & Risk Assessment</div>
        <div style={s.actionRow}>
          <button style={s.btn} onClick={exportPDF}>📄 Export PDF</button>
          <button style={s.btn} onClick={() => nav("/history")}>📋 View History</button>
        </div>
      </div>

      {/* ── Clinical Assessment ─────────────────────────────────────────── */}
      <div style={s.sectionHeader(true)}>Clinical Assessment</div>

      {severity && (
        <div style={{ background: sevStyle.bg, border: `2px solid ${sevStyle.border}`, borderRadius: 16, padding: "20px 24px", marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: sevStyle.color, marginBottom: 6, letterSpacing: "-0.5px" }}>
            {severity.emoji} {severity.label}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: sevStyle.color, marginBottom: 10 }}>
            👉 {severity.action}
          </div>
          <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 10 }}>{severity.description}</div>
          {severity.do_not?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {severity.do_not.map((d, i) => (
                <span key={i} style={{ padding: "4px 12px", borderRadius: 20, background: "#dc262620", color: "#dc2626", fontSize: 12, fontWeight: 600 }}>⛔ {d}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {alerts?.map((a, i) => (
        <div key={i} style={s.alert(a.severity === "CRITICAL" ? "#dc2626" : "#f59e0b")}>
          <strong>{a.title}</strong>
          <div style={{ fontSize: 12, marginTop: 3 }}>{a.message}</div>
        </div>
      ))}

      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.h2}>🎯 Triage Priority</div>
          <div style={{ display: "inline-block", padding: "8px 20px", borderRadius: 10, background: triageColor, color: "#fff", fontWeight: 900, fontSize: 18, marginBottom: 12 }}>
            {T.triage[triage_level]?.label || triage_level}
          </div>
          <RiskMeter score={Math.round(risk_score || 0)} />
        </div>

        <div style={s.card}>
          <div style={s.h2}>📊 NEWS2 Clinical Score</div>
          <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, marginBottom: 8 }}>
            ✓ Validated early warning score — Royal College of Physicians (RCP), 2017
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, color: news2?.score >= 7 ? "#dc2626" : news2?.score >= 5 ? "#f59e0b" : "#16a34a", marginBottom: 10 }}>
            {news2?.score ?? "—"} <span style={{ fontSize: 14, color: "var(--muted)" }}>/ max 20</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {news2?.flags?.map((f, i) => (
              <span key={i} style={s.tag(f.includes("RED") ? "#dc2626" : f.includes("+0") ? "#64748b" : "#f59e0b")}>{f}</span>
            ))}
          </div>
          {!news2?.flags?.length && <div style={{ color: "var(--muted)", fontSize: 13 }}>Enter vitals for NEWS2 scoring</div>}
        </div>
      </div>

      {/* ── Contributing Factors (AI Explainability) ────────────────────── */}
      {hasContributingFactors && (
        <>
          <div style={s.sectionHeader()}>Contributing Factors</div>
          <div style={s.card}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
              These vitals and symptoms most influenced this assessment.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {severity.contributing_vitals?.map((t, i) => (
                <div key={i} style={{ padding: "8px 14px", borderRadius: 10, background: "#dc262612", border: "1px solid #dc262633", fontSize: 13 }}>
                  <span style={{ color: "#dc2626", fontWeight: 700 }}>⚡ </span>{t.reason}
                </div>
              ))}
              {severity.contributing_symptoms?.map((t, i) => (
                <div key={i} style={{ padding: "8px 14px", borderRadius: 10, background: "#f59e0b12", border: "1px solid #f59e0b33", fontSize: 13 }}>
                  <span style={{ color: "#f59e0b", fontWeight: 700 }}>🔴 </span>{t.reason}
                </div>
              ))}
              {severity.contributing_context?.map((t, i) => (
                <div key={i} style={{ padding: "8px 14px", borderRadius: 10, background: "#3B82F612", border: "1px solid #3B82F633", fontSize: 13 }}>
                  <span style={{ color: "#3B82F6", fontWeight: 700 }}>📌 </span>{t.reason}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Possible Conditions ──────────────────────────────────────────── */}
      <div style={s.sectionHeader()}>Possible Conditions</div>
      <div style={s.card}>
        <div style={s.h2}>
          🔬 Possible Conditions to Consider
          <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted)", marginLeft: 8 }}>
            (Click each to expand — First Aid shown for all)
          </span>
        </div>
        {diseases.length === 0 && (
          <div style={{ color: "var(--text)", fontSize: 13, lineHeight: 1.6, padding: "8px 0" }}>
            {prediction?.message || "No predictions available."}
          </div>
        )}
        {diseases.map((d, i) => (
          <DiseaseCard key={i} disease={d} firstAid={firstAid} rank={i} />
        ))}
      </div>

      {/* ── Recommendations ──────────────────────────────────────────────── */}
      {hasRecommendations && (
        <>
          <div style={s.sectionHeader()}>Recommendations</div>

          {prediction?.drug_interactions?.filter(Boolean).length > 0 && (
            <div style={s.alert("#f59e0b")}>
              <strong>💊 Drug Interaction Warning:</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                {prediction.drug_interactions.map((d, i) => <li key={i} style={{ fontSize: 13 }}>{d}</li>)}
              </ul>
            </div>
          )}

          {prediction?.health_literacy?.simple_summary && (
            <div style={{
              ...s.card,
              background: "linear-gradient(135deg, #1e3a8a15, #2563eb08)",
              border: "1px solid #2563eb44",
            }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#60a5fa", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                📚 Educational Recommendation
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.8, color: "var(--text)", fontWeight: 500 }}>
                {prediction.health_literacy.simple_summary}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Follow-up ────────────────────────────────────────────────────── */}
      <div style={s.sectionHeader()}>Follow-up</div>
      <div style={s.card}>
        {topFirstAid?.recovery_timeline ? (
          <div style={{ marginBottom: 14, padding: "10px 14px", background: "#16a34a10", border: "1px solid #16a34a33", borderRadius: 10, fontSize: 13, color: "#16a34a" }}>
            ⏱ Expected recovery for {diseases[0]?.name}: {topFirstAid.recovery_timeline}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
            No specific recovery timeline available for this assessment.
          </div>
        )}
        <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 14, lineHeight: 1.6 }}>
          Track vitals and symptoms over time by logging a follow-up visit. This helps flag any deterioration early.
        </div>
        <button style={s.btn} onClick={() => nav("/history")}>📅 Log Follow-up in History</button>
      </div>

      {/* ── Emergency Actions ────────────────────────────────────────────── */}
      {hasEmergencyActions && (
        <>
          <div style={s.sectionHeader()}>Emergency Actions</div>

          {prediction?.allergy_warnings?.filter(Boolean).length > 0 && (
            <div style={s.alert("#dc2626")}>
              <strong>🚨 Allergy Alert:</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                {prediction.allergy_warnings.map((a, i) => <li key={i} style={{ fontSize: 13 }}>{a}</li>)}
              </ul>
            </div>
          )}

          {(prediction?.when_to_hospital || prediction?.health_literacy?.key_warning_signs?.length > 0) && (
            <div style={{ ...s.alert("#dc2626"), fontSize: 14, borderWidth: 2 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>🚨 Red Flags — Seek Urgent Medical Care</div>
              {prediction?.when_to_hospital && (
                <div style={{ marginBottom: prediction?.health_literacy?.key_warning_signs?.length > 0 ? 12 : 0 }}>
                  {prediction.when_to_hospital}
                </div>
              )}
              {prediction?.health_literacy?.key_warning_signs?.length > 0 && (
                <div>
                  {prediction.health_literacy.key_warning_signs.map((w, i) => (
                    <div key={i} style={{ fontSize: 13, marginBottom: 4, display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <span>⚠</span><span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
