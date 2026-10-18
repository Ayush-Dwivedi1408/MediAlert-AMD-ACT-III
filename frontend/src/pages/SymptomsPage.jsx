import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { api } from "../api/client";
import { translations } from "../i18n";

const SYMPTOM_GROUPS = {
  general: ["fatigue","high_fever","mild_fever","chills","shivering","sweating","weight_loss","weight_gain","malaise","lethargy","loss_of_appetite","dehydration","anxiety","mood_swings","restlessness","depression","irritability"],
  respiratory: ["cough","breathlessness","phlegm","throat_irritation","runny_nose","congestion","sinus_pressure","blood_in_sputum","mucoid_sputum","rusty_sputum","continuous_sneezing"],
  digestive: ["nausea","vomiting","diarrhoea","constipation","abdominal_pain","stomach_pain","indigestion","acidity","belly_pain","stomach_bleeding","distention_of_abdomen","passage_of_gases","bloody_stool","pain_during_bowel_movements"],
  cardiac: ["chest_pain","fast_heart_rate","palpitations","swollen_blood_vessels","prominent_veins_on_calf"],
  neurological: ["headache","dizziness","altered_sensorium","lack_of_concentration","visual_disturbances","blurred_and_distorted_vision","slurred_speech","loss_of_balance","unsteadiness","spinning_movements","weakness_of_one_body_side","stiff_neck","loss_of_smell","coma"],
  musculoskeletal: ["joint_pain","muscle_pain","muscle_weakness","muscle_wasting","knee_pain","hip_joint_pain","neck_pain","back_pain","cramps","movement_stiffness","swelling_joints","painful_walking","weakness_in_limbs"],
  skin: ["itching","skin_rash","nodal_skin_eruptions","yellowish_skin","redness_of_eyes","red_spots_over_body","blister","pus_filled_pimples","blackheads","skin_peeling","silver_like_dusting","small_dents_in_nails","inflammatory_nails","yellow_crust_ooze","bruising","dischromic_patches","patches_in_throat","ulcers_on_tongue"],
  urinary: ["burning_micturition","spotting_urination","bladder_discomfort","foul_smell_of_urine","continuous_feel_of_urine","yellow_urine","dark_urine","polyuria"],
};

const GROUP_ICONS = {
  general: "🌡️", respiratory: "🫁", digestive: "🫃", cardiac: "❤️",
  neurological: "🧠", musculoskeletal: "💪", skin: "🩹", urinary: "💧",
};

const RISK_FACTORS = [
  { key: "obesity", label: "Obesity", icon: "⚖️" },
  { key: "family_history", label: "Family History of Relevant Conditions", icon: "🧬" },
];

const SEVERITY_OPTIONS = ["Mild", "Moderate", "Severe"];
const ONSET_OPTIONS = ["Sudden", "Gradual"];
const FREQUENCY_OPTIONS = ["Constant", "Intermittent", "Occasional"];
const QUALITY_OPTIONS = ["Poor", "Fair", "Good", "Excellent"];
const ACTIVITY_OPTIONS = ["Sedentary", "Light", "Moderate", "Active"];
const STRESS_OPTIONS = ["Low", "Moderate", "High"];
const YES_NO_OPTIONS = ["No", "Occasionally", "Yes"];

// ── Collapsible section wrapper ────────────────────────────────────────────────
function Section({ title, icon, subtitle, defaultOpen = false, badge, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", marginBottom: 16, overflow: "hidden" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: "18px 22px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
            {icon} {title}
            {badge > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--stat-bg)", padding: "2px 9px", borderRadius: 20 }}>
                {badge} added
              </span>
            )}
          </div>
          {subtitle && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{subtitle}</div>}
        </div>
        <span style={{ color: "var(--muted)", fontSize: 14 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && <div style={{ padding: "0 22px 22px" }}>{children}</div>}
    </div>
  );
}

export default function SymptomsPage() {
  const { patient, lang, setCurrentVisit } = useStore();
  const T = translations[lang];
  const nav = useNavigate();

  const [selected, setSelected] = useState([]);
  const [riskFactors, setRiskFactors] = useState([]);
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState("general");
  const [vitals, setVitals] = useState({ pulse: "", spo2: "", temperature: "", blood_pressure: "", respiratory_rate: "", weight: "" });
  const [currentDisease, setCurrentDisease] = useState("");
  const [currentMeds, setCurrentMeds] = useState(patient?.current_medications || "");
  const [symptomDuration, setSymptomDuration] = useState("");
  const [symptomSeverity, setSymptomSeverity] = useState("");
  const [symptomOnset, setSymptomOnset] = useState("");
  const [loading, setLoading] = useState(false);

  // NEW — Symptom Details
  const [severityScore, setSeverityScore] = useState(5);
  const [frequency, setFrequency] = useState("");
  const [associatedSymptoms, setAssociatedSymptoms] = useState([]);
  const [associatedSearch, setAssociatedSearch] = useState("");

  // NEW — Medical Background
  const [allergiesInput, setAllergiesInput] = useState(patient?.allergies || "");
  const [existingConditions, setExistingConditions] = useState(patient?.known_conditions || "");
  const [recentSurgery, setRecentSurgery] = useState("");
  const [familyHistory, setFamilyHistory] = useState("");

  // NEW — Lifestyle Assessment
  const [sleepQuality, setSleepQuality] = useState("");
  const [waterIntake, setWaterIntake] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [dietQuality, setDietQuality] = useState("");
  const [stressLevel, setStressLevel] = useState("");
  const [smoking, setSmoking] = useState("");
  const [alcohol, setAlcohol] = useState("");

  // NEW — Exposure History
  const [recentTravel, setRecentTravel] = useState("");
  const [contactSick, setContactSick] = useState("");
  const [recentInjury, setRecentInjury] = useState("");
  const [animalBite, setAnimalBite] = useState("");

  useEffect(() => { if (!patient) nav("/"); }, [patient]);

  function toggleSymptom(s) {
    setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    setAssociatedSymptoms(prev => prev.filter(x => x !== s)); // can't be both primary and associated
  }

  function toggleAssociated(s) {
    setAssociatedSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  function toggleRiskFactor(k) {
    setRiskFactors(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  }

  const fmt = s => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const allSymptoms = [...new Set(Object.values(SYMPTOM_GROUPS).flat())];
  const filtered = search
    ? allSymptoms.filter(s => s.toLowerCase().includes(search.toLowerCase()))
    : (SYMPTOM_GROUPS[activeGroup] || []);

  const associatedPool = allSymptoms.filter(s => !selected.includes(s));
  const associatedFiltered = associatedSearch
    ? associatedPool.filter(s => s.toLowerCase().includes(associatedSearch.toLowerCase()))
    : associatedPool.slice(0, 24);

  const medicalBgCount = [recentSurgery, familyHistory].filter(Boolean).length +
    (allergiesInput !== (patient?.allergies || "") ? 1 : 0) +
    (existingConditions !== (patient?.known_conditions || "") ? 1 : 0);
  const lifestyleCount = [sleepQuality, waterIntake, activityLevel, dietQuality, stressLevel, smoking, alcohol].filter(Boolean).length;
  const exposureCount = [recentTravel, contactSick, recentInjury, animalBite].filter(Boolean).length;

  const [freetextSymptoms, setFreetextSymptoms] = useState("");

  async function handleSubmit() {
    if (selected.length === 0) { alert("Please select at least one symptom"); return; }
    setLoading(true);
    try {
      const visitPayload = {
        patient_id: patient.id,
        symptoms: selected,
        risk_factors: riskFactors,
        symptom_duration: symptomDuration || null,
        symptom_severity: symptomSeverity || null,
        symptom_onset: symptomOnset || null,
        current_disease: currentDisease,
        current_medications: currentMeds,
        symptoms_freetext: freetextSymptoms || null,
        vitals: {
          pulse: vitals.pulse ? parseFloat(vitals.pulse) : null,
          spo2: vitals.spo2 ? parseFloat(vitals.spo2) : null,
          temperature: vitals.temperature ? parseFloat(vitals.temperature) : null,
          blood_pressure: vitals.blood_pressure || null,
          respiratory_rate: vitals.respiratory_rate ? parseFloat(vitals.respiratory_rate) : null,
          weight: vitals.weight ? parseFloat(vitals.weight) : null,
        },
        // NEW — Symptom Details
        symptom_severity_score: severityScore,
        symptom_frequency: frequency || null,
        associated_symptoms: associatedSymptoms,
        // NEW — Medical Background
        allergies: allergiesInput || null,
        existing_conditions: existingConditions || null,
        recent_surgery_hospitalization: recentSurgery || null,
        family_medical_history: familyHistory || null,
        // NEW — Lifestyle
        lifestyle: {
          sleep_quality: sleepQuality || null,
          water_intake_liters: waterIntake ? parseFloat(waterIntake) : null,
          activity_level: activityLevel || null,
          diet_quality: dietQuality || null,
          stress_level: stressLevel || null,
          smoking: smoking || null,
          alcohol: alcohol || null,
        },
        // NEW — Exposure History
        exposure_history: {
          recent_travel: recentTravel || null,
          contact_with_sick: contactSick || null,
          recent_injury: recentInjury || null,
          animal_insect_bite: animalBite || null,
        },
      };
      const result = await api.visits.create(visitPayload);
      const resultWithVitals = {
        ...result,
        pulse: visitPayload.vitals.pulse,
        spo2: visitPayload.vitals.spo2,
        temperature: visitPayload.vitals.temperature,
        blood_pressure: visitPayload.vitals.blood_pressure,
        respiratory_rate: visitPayload.vitals.respiratory_rate,
        weight: visitPayload.vitals.weight,
        symptoms: visitPayload.symptoms,
        symptoms_freetext: visitPayload.symptoms_freetext,
        risk_factors: visitPayload.risk_factors,
        symptom_duration: visitPayload.symptom_duration,
        symptom_severity: visitPayload.symptom_severity,
        symptom_onset: visitPayload.symptom_onset,
        symptom_severity_score: visitPayload.symptom_severity_score,
        symptom_frequency: visitPayload.symptom_frequency,
        associated_symptoms: visitPayload.associated_symptoms,
        lifestyle: visitPayload.lifestyle,
        exposure_history: visitPayload.exposure_history,
      };
      setCurrentVisit(resultWithVitals);
      nav("/results");
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  }

  const s = {
    h1: { fontSize: 26, fontWeight: 800, marginBottom: 6, color: "var(--text)" },
    sub: { color: "var(--muted)", fontSize: 14, marginBottom: 24 },
    card: { background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", padding: 22, marginBottom: 16 },
    h2: { fontSize: 16, fontWeight: 700, marginBottom: 14, color: "var(--text)" },
    label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px" },
    input: { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box", outline: "none", fontFamily: "inherit" },
    grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 4 },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 0 },
    groupTabs: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    groupTab: (a) => ({ padding: "7px 14px", borderRadius: 20, border: "1px solid", borderColor: a ? "var(--accent)" : "var(--border)", background: a ? "var(--accent)" : "transparent", color: a ? "#fff" : "var(--text)", cursor: "pointer", fontSize: 12, fontWeight: a ? 700 : 400, transition: "all 0.15s" }),
    symptomGrid: { display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 260, overflowY: "auto", padding: "4px 0" },
    chip: (sel) => ({ padding: "5px 12px", borderRadius: 20, border: "1px solid", borderColor: sel ? "var(--accent)" : "var(--border)", background: sel ? "var(--accent)" : "transparent", color: sel ? "#fff" : "var(--text)", cursor: "pointer", fontSize: 12, fontWeight: sel ? 600 : 400, transition: "all 0.15s", whiteSpace: "nowrap" }),
    selectedBox: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, padding: 12, background: "var(--stat-bg)", borderRadius: 10, minHeight: 40 },
    selectedChip: { padding: "4px 10px", borderRadius: 20, background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 },
    removeBtn: { background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1 },
    submitBtn: { width: "100%", padding: "14px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 16, background: selected.length > 0 ? "var(--accent)" : "var(--border)", color: selected.length > 0 ? "#fff" : "var(--muted)", marginTop: 4, transition: "all 0.2s" },
    vitalHint: { fontSize: 11, color: "var(--muted)", marginTop: 4 },
    riskFactorRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--input-bg)", marginBottom: 8, cursor: "pointer" },
    segRow: { display: "flex", gap: 8, flexWrap: "wrap" },
    segBtn: (sel) => ({ padding: "8px 16px", borderRadius: 10, border: "1px solid", borderColor: sel ? "var(--accent)" : "var(--border)", background: sel ? "var(--accent)" : "transparent", color: sel ? "#fff" : "var(--text)", cursor: "pointer", fontSize: 13, fontWeight: sel ? 700 : 400 }),
    field: { marginBottom: 16 },
    textarea: { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box", outline: "none", fontFamily: "inherit", minHeight: 80, resize: "vertical" },
    slider: { width: "100%", accentColor: "var(--accent)", height: 6 },
  };

  const redFlagSelected = selected.filter(sym =>
    ["chest_pain","breathlessness","altered_sensorium","coma","slurred_speech","weakness_of_one_body_side","stomach_bleeding","blood_in_sputum"].includes(sym)
  );

  const severityColor = severityScore >= 8 ? "#EF4444" : severityScore >= 5 ? "#F97316" : severityScore >= 3 ? "#F59E0B" : "#22C55E";

  return (
    <div>
      <div style={s.h1}>Clinical Assessment</div>
      <div style={s.sub}>Select all symptoms present · Enter vitals and clinical details for accurate, personalized risk scoring</div>

      {/* Red flag warning */}
      {redFlagSelected.length > 0 && (
        <div style={{ background: "#EF444412", border: "1px solid #EF444455", borderRadius: 12, padding: "12px 18px", marginBottom: 16, color: "#EF4444", fontWeight: 700, fontSize: 14 }}>
          🚨 Critical symptoms selected: {redFlagSelected.map(s => fmt(s)).join(", ")}. This may indicate a medical emergency.
        </div>
      )}

      {/* ── Vital Signs ─────────────────────────────────────────────────────── */}
      <div style={s.card}>
        <div style={s.h2}>📊 Vital Signs <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>(Enter for accurate NEWS2 & risk scoring)</span></div>
        <div style={s.grid3}>
          {[
            { key: "pulse", label: "Pulse (bpm)", placeholder: "e.g. 72", hint: "Normal: 60-100" },
            { key: "spo2", label: "SpO2 (%)", placeholder: "e.g. 98", hint: "Normal: ≥95%" },
            { key: "temperature", label: "Temperature (°F)", placeholder: "e.g. 98.6", hint: "Normal: 97-99°F" },
          ].map(({ key, label, placeholder, hint }) => (
            <div key={key}>
              <label style={s.label}>{label}</label>
              <input style={{ ...s.input, borderColor: key === "spo2" && vitals.spo2 && parseFloat(vitals.spo2) < 90 ? "#EF4444" : "var(--border)" }} type="number" value={vitals[key]} onChange={e => setVitals(v => ({ ...v, [key]: e.target.value }))} placeholder={placeholder} />
              <div style={s.vitalHint}>{hint}</div>
            </div>
          ))}
        </div>
        <div style={{ ...s.grid3, marginTop: 12 }}>
          {[
            { key: "blood_pressure", label: "Blood Pressure (mmHg)", placeholder: "e.g. 120/80", hint: "Normal: <120/80" },
            { key: "respiratory_rate", label: "Respiratory Rate (/min)", placeholder: "e.g. 16", hint: "Normal: 12-20" },
            { key: "weight", label: "Weight (kg) — optional", placeholder: "e.g. 68", hint: "" },
          ].map(({ key, label, placeholder, hint }) => (
            <div key={key}>
              <label style={s.label}>{label}</label>
              <input style={s.input} type={key === "blood_pressure" ? "text" : "number"} value={vitals[key]} onChange={e => setVitals(v => ({ ...v, [key]: e.target.value }))} placeholder={placeholder} />
              {hint && <div style={s.vitalHint}>{hint}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Symptom selector ────────────────────────────────────────────────── */}
      <div style={s.card}>
        <div style={s.h2}>🩺 Symptoms & Clinical Indicators</div>
        <input style={{ ...s.input, marginBottom: 14 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search symptoms... (e.g. fever, cough)" />

        {!search && (
          <div style={s.groupTabs}>
            {Object.keys(SYMPTOM_GROUPS).map(g => (
              <button key={g} style={s.groupTab(activeGroup === g)} onClick={() => setActiveGroup(g)}>
                {GROUP_ICONS[g]} {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        )}

        <div style={s.symptomGrid}>
          {filtered.map(sym => (
            <button key={sym} style={s.chip(selected.includes(sym))} onClick={() => toggleSymptom(sym)}>
              {fmt(sym)}
            </button>
          ))}
        </div>

        {selected.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", margin: "14px 0 6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Primary Symptoms ({selected.length})
            </div>
            <div style={s.selectedBox}>
              {selected.map(sym => (
                <span key={sym} style={s.selectedChip}>
                  {fmt(sym)}
                  <button style={s.removeBtn} onClick={() => toggleSymptom(sym)}>×</button>
                </span>
              ))}
            </div>
          </>
        )}

        {/* ── Describe in your own words (optional) ─────────────────────── */}
        <div style={{ marginTop: 16 }}>
          <label style={s.label}>Describe your symptoms in your own words (optional)</label>
          <textarea
            style={s.textarea}
            value={freetextSymptoms}
            onChange={e => setFreetextSymptoms(e.target.value)}
            placeholder="e.g. My joints hurt, I have a high temperature, and it's hard to breathe when I walk"
          />
          <div style={s.vitalHint}>This is read alongside your selected symptoms above and is just as important for finding a match — it's not a replacement for selecting symptoms, but adds detail the checkboxes might miss.</div>
        </div>
      </div>

      {/* ── Symptom Details ─────────────────────────────────────────────────── */}
      <div style={s.card}>
        <div style={s.h2}>⏱️ Symptom Details</div>

        <div style={s.field}>
          <label style={s.label}>Duration</label>
          <input style={s.input} value={symptomDuration} onChange={e => setSymptomDuration(e.target.value)} placeholder="e.g. 3 days, 2 weeks" />
        </div>

        <div style={s.field}>
          <label style={s.label}>Severity Category</label>
          <div style={s.segRow}>
            {SEVERITY_OPTIONS.map(opt => (
              <button key={opt} style={s.segBtn(symptomSeverity === opt)} onClick={() => setSymptomSeverity(symptomSeverity === opt ? "" : opt)}>{opt}</button>
            ))}
          </div>
        </div>

        <div style={s.field}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ ...s.label, marginBottom: 0 }}>Severity Rating</label>
            <span style={{ fontSize: 18, fontWeight: 800, color: severityColor }}>{severityScore}/10</span>
          </div>
          <input type="range" min="1" max="10" value={severityScore} onChange={e => setSeverityScore(parseInt(e.target.value))} style={s.slider} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
            <span>Mild</span><span>Moderate</span><span>Severe</span>
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>Onset</label>
          <div style={s.segRow}>
            {ONSET_OPTIONS.map(opt => (
              <button key={opt} style={s.segBtn(symptomOnset === opt)} onClick={() => setSymptomOnset(symptomOnset === opt ? "" : opt)}>{opt}</button>
            ))}
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>Frequency</label>
          <div style={s.segRow}>
            {FREQUENCY_OPTIONS.map(opt => (
              <button key={opt} style={s.segBtn(frequency === opt)} onClick={() => setFrequency(frequency === opt ? "" : opt)}>{opt}</button>
            ))}
          </div>
        </div>

        <div>
          <label style={s.label}>Associated Symptoms <span style={{ textTransform: "none", fontWeight: 400 }}>(secondary, less prominent)</span></label>
          <input style={{ ...s.input, marginBottom: 10 }} value={associatedSearch} onChange={e => setAssociatedSearch(e.target.value)} placeholder="Search to add associated symptoms..." />
          <div style={{ ...s.symptomGrid, maxHeight: 140 }}>
            {associatedFiltered.map(sym => (
              <button key={sym} style={s.chip(associatedSymptoms.includes(sym))} onClick={() => toggleAssociated(sym)}>
                {fmt(sym)}
              </button>
            ))}
          </div>
          {associatedSymptoms.length > 0 && (
            <div style={s.selectedBox}>
              {associatedSymptoms.map(sym => (
                <span key={sym} style={{ ...s.selectedChip, background: "var(--stat-bg)", color: "var(--text)", border: "1px solid var(--border)" }}>
                  {fmt(sym)}
                  <button style={{ ...s.removeBtn, color: "var(--muted)" }} onClick={() => toggleAssociated(sym)}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Risk Factors ─────────────────────────────────────────────────────── */}
      <div style={s.card}>
        <div style={s.h2}>📌 Risk Factors / Medical Context</div>
        {RISK_FACTORS.map(rf => (
          <div key={rf.key} style={s.riskFactorRow} onClick={() => toggleRiskFactor(rf.key)}>
            <input type="checkbox" checked={riskFactors.includes(rf.key)} onChange={() => toggleRiskFactor(rf.key)} style={{ width: 16, height: 16, cursor: "pointer" }} />
            <span style={{ fontSize: 14, color: "var(--text)" }}>{rf.icon} {rf.label}</span>
          </div>
        ))}
      </div>

      {/* ── Medical Background (collapsible) ─────────────────────────────────── */}
      <Section title="Medical Background" icon="📋" subtitle="Allergies, conditions, surgical & family history" badge={medicalBgCount}>
        <div style={s.grid2}>
          <div style={s.field}>
            <label style={s.label}>Current Diagnosed Disease (if any)</label>
            <input style={s.input} value={currentDisease} onChange={e => setCurrentDisease(e.target.value)} placeholder="e.g. Diabetes, Hypertension" />
          </div>
          <div style={s.field}>
            <label style={s.label}>Current Medications</label>
            <input style={s.input} value={currentMeds} onChange={e => setCurrentMeds(e.target.value)} placeholder="e.g. Metformin 500mg, Aspirin" />
          </div>
        </div>
        <div style={s.grid2}>
          <div style={s.field}>
            <label style={s.label}>Allergies</label>
            <input style={s.input} value={allergiesInput} onChange={e => setAllergiesInput(e.target.value)} placeholder="e.g. Penicillin, Peanuts — or None" />
          </div>
          <div style={s.field}>
            <label style={s.label}>Existing Medical Conditions</label>
            <input style={s.input} value={existingConditions} onChange={e => setExistingConditions(e.target.value)} placeholder="e.g. Asthma, Thyroid — or None" />
          </div>
        </div>
        <div style={s.field}>
          <label style={s.label}>Recent Surgery or Hospitalization</label>
          <input style={s.input} value={recentSurgery} onChange={e => setRecentSurgery(e.target.value)} placeholder="e.g. Appendectomy 2 months ago — or None" />
        </div>
        <div>
          <label style={s.label}>Family Medical History <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
          <input style={s.input} value={familyHistory} onChange={e => setFamilyHistory(e.target.value)} placeholder="e.g. Father — heart disease, Mother — diabetes" />
        </div>
      </Section>

      {/* ── Lifestyle Assessment (collapsible) ───────────────────────────────── */}
      <Section title="Lifestyle Assessment" icon="🏃" subtitle="Sleep, diet, activity, and stress" badge={lifestyleCount}>
        <div style={s.field}>
          <label style={s.label}>Sleep Quality</label>
          <div style={s.segRow}>{QUALITY_OPTIONS.map(o => <button key={o} style={s.segBtn(sleepQuality === o)} onClick={() => setSleepQuality(sleepQuality === o ? "" : o)}>{o}</button>)}</div>
        </div>
        <div style={s.field}>
          <label style={s.label}>Daily Water Intake (liters)</label>
          <input style={s.input} type="number" step="0.5" value={waterIntake} onChange={e => setWaterIntake(e.target.value)} placeholder="e.g. 2.5" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Physical Activity Level</label>
          <div style={s.segRow}>{ACTIVITY_OPTIONS.map(o => <button key={o} style={s.segBtn(activityLevel === o)} onClick={() => setActivityLevel(activityLevel === o ? "" : o)}>{o}</button>)}</div>
        </div>
        <div style={s.field}>
          <label style={s.label}>Diet Quality</label>
          <div style={s.segRow}>{QUALITY_OPTIONS.map(o => <button key={o} style={s.segBtn(dietQuality === o)} onClick={() => setDietQuality(dietQuality === o ? "" : o)}>{o}</button>)}</div>
        </div>
        <div style={s.field}>
          <label style={s.label}>Stress Level</label>
          <div style={s.segRow}>{STRESS_OPTIONS.map(o => <button key={o} style={s.segBtn(stressLevel === o)} onClick={() => setStressLevel(stressLevel === o ? "" : o)}>{o}</button>)}</div>
        </div>
        <div style={s.grid2}>
          <div style={s.field}>
            <label style={s.label}>Smoking <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
            <div style={s.segRow}>{YES_NO_OPTIONS.map(o => <button key={o} style={s.segBtn(smoking === o)} onClick={() => setSmoking(smoking === o ? "" : o)}>{o}</button>)}</div>
          </div>
          <div>
            <label style={s.label}>Alcohol <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
            <div style={s.segRow}>{YES_NO_OPTIONS.map(o => <button key={o} style={s.segBtn(alcohol === o)} onClick={() => setAlcohol(alcohol === o ? "" : o)}>{o}</button>)}</div>
          </div>
        </div>
      </Section>

      {/* ── Exposure History (collapsible) ───────────────────────────────────── */}
      <Section title="Exposure History" icon="🌍" subtitle="Travel, contact, injuries" badge={exposureCount}>
        <div style={s.field}>
          <label style={s.label}>Recent Travel</label>
          <input style={s.input} value={recentTravel} onChange={e => setRecentTravel(e.target.value)} placeholder="e.g. Traveled to Mumbai 5 days ago — or None" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Contact With Sick Individuals</label>
          <input style={s.input} value={contactSick} onChange={e => setContactSick(e.target.value)} placeholder="e.g. Family member had flu last week — or None" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Recent Injuries</label>
          <input style={s.input} value={recentInjury} onChange={e => setRecentInjury(e.target.value)} placeholder="e.g. Fell and hurt ankle — or None" />
        </div>
        <div>
          <label style={s.label}>Animal / Insect Bite <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
          <input style={s.input} value={animalBite} onChange={e => setAnimalBite(e.target.value)} placeholder="e.g. Dog bite yesterday — or None" />
        </div>
      </Section>

      <button style={s.submitBtn} onClick={handleSubmit} disabled={loading || selected.length === 0}>
        {loading ? "🔄 Analyzing symptoms with AI..." : `🔍 Assess Risk & Possible Conditions (${selected.length} symptoms selected)`}
      </button>
    </div>
  );
}
