import { useState, useEffect } from "react";
import { useStore } from "../store";
import { api } from "../api/client";
import { triggerMentalHealthSOS } from "../utils/sos";

const SCORE_LABELS    = ["Not at all", "Several days", "More than half the days", "Nearly every day"];
const SCORE_LABELS_HI = ["बिल्कुल नहीं", "कुछ दिन", "आधे से ज्यादा दिन", "लगभग हर दिन"];

const SEVERITY_COLORS = {
  "None / Minimal":            "#22C55E",
  "Minimal Anxiety":           "#22C55E",
  "Mild Depression":           "#F59E0B",
  "Mild Anxiety":              "#F59E0B",
  "Moderate Depression":       "#F97316",
  "Moderate Anxiety":          "#F97316",
  "Moderately Severe Depression": "#EF4444",
  "Severe Depression":         "#B91C1C",
  "Severe Anxiety":            "#B91C1C",
};

// ─── Exercise & Action Recommendations ───────────────────────────────────────
function getExercises(type, score) {
  if (type === "PHQ9" || type === "PHQ-9") {
    if (score >= 20) return [
      "🏃 Daily 30-min walk outside — proven to reduce depression severity by up to 26%",
      "📓 Morning journaling: write 3 things you're grateful for + 1 goal for the day",
      "📞 Call a trusted friend or family member today — social connection is medicine",
      "🛌 Maintain a fixed sleep/wake time even on weekends to stabilise mood",
      "🍽️ Eat 3 regular meals — low blood sugar worsens depressive symptoms",
      "🏥 Consult a psychiatrist this week — severe depression responds well to treatment",
    ];
    if (score >= 15) return [
      "🚶 Light aerobic exercise 3x/week (even a 20-min walk counts)",
      "📓 Daily mood tracking — note energy, sleep, and one positive event each day",
      "🎵 Music therapy: listen to uplifting music for 15 min every morning",
      "🛁 Establish a calming evening routine (warm shower, no screens 1 hr before bed)",
      "🧑‍⚕️ Consider talking to a therapist — CBT is highly effective for this score range",
    ];
    if (score >= 10) return [
      "🧘 5-4-3-2-1 grounding technique: name 5 things you see, 4 you hear, 3 you touch",
      "🚶 20-min brisk walk daily — fresh air and movement shift brain chemistry",
      "📵 Limit social media to 30 min/day — passive scrolling worsens low mood",
      "🌿 Spend time in nature at least 3x/week (park, garden, or rooftop)",
      "📅 Schedule one enjoyable activity per day, no matter how small",
    ];
    if (score >= 5) return [
      "🌬️ 4-7-8 breathing: inhale 4s, hold 7s, exhale 8s — repeat 4 cycles twice daily",
      "📓 Gratitude journaling: 3 things you appreciated today, every evening",
      "🛌 Sleep hygiene: fixed bedtime, dark room, cool temperature, no phone in bed",
      "🧘 10 min mindfulness meditation using a free app (Insight Timer, Calm)",
    ];
    return [
      "🎯 Maintain your current healthy routine — you're doing well",
      "🧘 5 min mindfulness or breathing exercise daily as a preventive habit",
      "🏃 Stay physically active — exercise is the best long-term mood protector",
    ];
  }

  if (type === "GAD7" || type === "GAD-7") {
    if (score >= 15) return [
      "🫁 Box breathing (4-4-4-4): inhale 4s → hold 4s → exhale 4s → hold 4s. Do 5 rounds",
      "💪 Progressive muscle relaxation: tense and release each muscle group head to toe",
      "☕ Limit caffeine to 1 cup before noon — caffeine amplifies anxiety symptoms",
      "📵 Set a 'worry hour': write all worries in a notebook, then close it and move on",
      "🧑‍⚕️ Discuss medication options with your doctor — GAD responds well to treatment",
      "🌊 Cold water splashed on face triggers the dive reflex — instant calm response",
    ];
    if (score >= 10) return [
      "🌬️ 4-7-8 breathing: inhale 4s, hold 7s, exhale 8s — use before any stressful event",
      "🚶 20-min walk daily: physical movement burns off excess adrenaline and cortisol",
      "📓 Worry journaling: write the worry, then write what you can and cannot control",
      "🧘 Body scan meditation before bed — lie down and mentally relax each body part",
      "🫂 Talk to someone you trust — verbalising anxiety reduces its intensity significantly",
    ];
    if (score >= 5) return [
      "🫁 Diaphragmatic breathing: breathe into your belly, not your chest — 5 min/day",
      "🧘 Yoga or gentle stretching for 15 min in the morning to release physical tension",
      "📰 Limit news consumption to 15 min/day — information overload fuels anxiety",
      "✅ Make a short daily to-do list (max 5 items) — structure reduces uncertainty",
    ];
    return [
      "🧘 5 min mindfulness meditation daily — apps like Headspace or Insight Timer work well",
      "🍽️ Regular meals and sleep schedule — skipping meals spikes anxiety",
      "🌿 Spend time in nature weekly — natural environments lower cortisol levels",
    ];
  }

  return ["🩺 Consult a healthcare provider for personalised recommendations."];
}

// ─── Severity bar ─────────────────────────────────────────────────────────────
function SeverityBar({ score, maxScore }) {
  const pct   = Math.min(100, Math.round((score / maxScore) * 100));
  const color = score >= (maxScore * 0.7) ? "#EF4444" : score >= (maxScore * 0.4) ? "#F97316" : score >= (maxScore * 0.2) ? "#F59E0B" : "#22C55E";
  return (
    <div style={{ marginTop: 6, marginBottom: 2 }}>
      <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 3, transition: "width 1s ease" }} />
      </div>
    </div>
  );
}

// ─── Result section wrapper ───────────────────────────────────────────────────
function ResultSection({ title, children }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MentalHealthPage() {
  const { patient, lang } = useStore();
  const [screeningType, setScreeningType] = useState("PHQ9");
  const [questions,     setQuestions]     = useState([]);
  const [answers,       setAnswers]       = useState([]);
  const [result,        setResult]        = useState(null);
  const [history,       setHistory]       = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [submitted,     setSubmitted]     = useState(false);
  const [expandedHist,  setExpandedHist]  = useState(null);
  const [sosLoading,    setSosLoading]    = useState(false);
  const [sosSent,       setSosSent]       = useState(false);
  const [pendingSOS,    setPendingSOS]    = useState(null); // null | 'result' | history index

  useEffect(() => { loadQuestions(); }, [screeningType, lang]);
  useEffect(() => { if (patient) loadHistory(); }, [patient]);

  async function loadQuestions() {
    try {
      const data = await api.symptoms.mentalHealth.questions(screeningType, lang);
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(null));
      setResult(null);
      setSubmitted(false);
    } catch (e) { console.error(e); }
  }

  async function loadHistory() {
    try {
      const data = await api.symptoms.mentalHealth.history(patient.id);
      setHistory(data.screenings || []);
    } catch (e) { console.error(e); }
  }

  async function handleSubmit() {
    if (answers.some(a => a === null)) { alert("Please answer all questions"); return; }
    setLoading(true);
    try {
      const res = await api.symptoms.mentalHealth.submit({
        patient_id:    patient.id,
        screening_type: screeningType,
        answers,
      });
      setResult(res);
      setSubmitted(true);
      setSosSent(false);
      loadHistory();
    } catch (e) { alert(e.message); }
    setLoading(false);
  }

  async function handleMentalHealthSOS(screeningResult) {
    if (!patient?.emergency_contact_phone) {
      alert("No emergency contact phone number is saved for this patient. Add one via Edit Profile first.");
      setPendingSOS(null);
      return;
    }
    setSosLoading(true);
    try {
      await triggerMentalHealthSOS(patient, screeningResult);
      setSosSent(true);
    } catch (e) { console.error(e); }
    setSosLoading(false);
    setPendingSOS(null);
  }

  const labels   = lang === "hi" ? SCORE_LABELS_HI : SCORE_LABELS;
  const sevColor = result ? (SEVERITY_COLORS[result.severity] || "#64748b") : "#64748b";
  const maxScore = screeningType === "PHQ9" ? 27 : 21;
  const answeredCount = answers.filter(a => a !== null).length;
  const progressPct = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  const s = {
    h1:       { fontSize: 26, fontWeight: 800, marginBottom: 6, color: "var(--text)" },
    sub:      { color: "var(--muted)", fontSize: 13, marginBottom: 24 },
    card:     { background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", padding: 22, marginBottom: 16 },
    h2:       { fontSize: 16, fontWeight: 700, marginBottom: 14, color: "var(--text)" },
    toggle:   { display: "flex", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 24, maxWidth: 420 },
    toggleBtn:(a) => ({ flex: 1, padding: "11px 0", border: "none", cursor: "pointer", fontWeight: a ? 700 : 400, fontSize: 14, background: a ? "var(--accent)" : "transparent", color: a ? "#fff" : "var(--muted)", transition: "all 0.2s" }),
    qCard:    { border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 18 },
    qText:    { fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 14 },
    optionRow:{ display: "flex", gap: 8, flexWrap: "wrap" },
    optBtn:   (sel) => ({ padding: "9px 16px", borderRadius: 20, border: "2px solid", borderColor: sel ? "var(--accent)" : "var(--border)", background: sel ? "var(--accent)" : "transparent", color: sel ? "#fff" : "var(--text)", cursor: "pointer", fontSize: 12, fontWeight: sel ? 700 : 400, transition: "all 0.15s" }),
    submitBtn:{ width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 15, background: "var(--accent)", color: "#fff", marginTop: 4 },
    secondaryBtn: { width: "100%", padding: "13px", borderRadius: 12, border: "1px solid var(--border)", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "transparent", color: "var(--text)" },
    resultBox:{ borderRadius: 16, padding: 24, border: "2px solid", borderColor: sevColor, background: sevColor + "12", marginBottom: 16 },
    confirmBox: { background: "#EF444412", border: "2px solid #EF4444", borderRadius: 12, padding: 16 },
    confirmTitle: { fontSize: 13, fontWeight: 700, color: "#EF4444", marginBottom: 6 },
    confirmText: { fontSize: 12, color: "var(--text)", marginBottom: 14, lineHeight: 1.6 },
    progressWrap: { marginBottom: 20 },
    progressLabel: { display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 },
    progressTrack: { height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" },
    progressFill: { height: "100%", background: "var(--accent)", borderRadius: 4, transition: "width 0.3s ease" },
  };

  return (
    <div>
      <div style={s.h1}>🧠 Mental Health Screening</div>
      <div style={s.sub}>PHQ-9 (Depression) & GAD-7 (Anxiety) — validated clinical screening tools</div>

      <div style={s.toggle}>
        <button style={s.toggleBtn(screeningType === "PHQ9")} onClick={() => setScreeningType("PHQ9")}>PHQ-9 (Depression)</button>
        <button style={s.toggleBtn(screeningType === "GAD7")} onClick={() => setScreeningType("GAD7")}>GAD-7 (Anxiety)</button>
      </div>

      {/* ── Submission Result ─────────────────────────────────────────────── */}
      {submitted && result && (
        <div style={s.resultBox}>
          <ResultSection title="Screening Result">
            <div style={{ fontSize: 22, fontWeight: 900, color: sevColor, marginBottom: 6 }}>{result.severity}</div>
            <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 4, color: "var(--text)" }}>
              Score: {result.total_score} <span style={{ fontSize: 14, color: "var(--muted)" }}>/ {maxScore}</span>
            </div>
            <SeverityBar score={result.total_score} maxScore={maxScore} />
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 }}>
              This is a screening score, not a diagnosis. Only a healthcare professional can diagnose depression or anxiety — a higher score means it's worth talking to one, not a confirmed condition.
            </div>
          </ResultSection>

          {result.crisis_flag && (
            <div style={{ background: "#7f1d1d", color: "#fff", borderRadius: 10, padding: "12px 16px", marginTop: 20, fontWeight: 700 }}>
              🆘 {result.crisis_message}
            </div>
          )}

          {result.recommendations?.length > 0 && (
            <ResultSection title="Recommendations">
              {result.recommendations.map((r, i) => (
                <div key={i} style={{ fontSize: 13, marginBottom: 5, color: "var(--text)" }}>• {r}</div>
              ))}
            </ResultSection>
          )}

          <ResultSection title="Daily Exercises">
            <div style={{ background: "var(--surface)", borderRadius: 12, padding: "16px 18px", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {getExercises(screeningType, result.total_score).map((ex, j) => (
                  <div key={j} style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, padding: "8px 12px", background: "var(--stat-bg)", borderRadius: 8, borderLeft: "3px solid var(--accent)" }}>
                    {ex}
                  </div>
                ))}
              </div>
            </div>
          </ResultSection>

          {result.follow_up_recommended && (
            <ResultSection title="Follow-up Plan">
              <div style={{ fontSize: 13, color: "var(--text)" }}>
                📅 Recommended: <strong>{result.follow_up_recommended}</strong>
              </div>
            </ResultSection>
          )}

          {(result.crisis_flag || result.sos_recommended) && (
            <ResultSection title="Emergency Resources">
              <div style={{ background: "#EF444415", border: "1px solid #EF444444", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#EF4444", marginBottom: 8 }}>
                  This result suggests you could really use some support right now. You don't have to go through this alone.
                </div>
                <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 10, lineHeight: 1.6 }}>
                  Crisis helplines are available 24/7: <strong>iCall 9152987821</strong> · <strong>Vandrevala Foundation 1860-2662-345</strong>
                  {result.crisis_flag && <> · <strong>NIMHANS 080-46110007</strong></>}
                </div>
                {pendingSOS === "result" ? (
                  <div style={s.confirmBox}>
                    <div style={s.confirmTitle}>Send emergency alert?</div>
                    <div style={s.confirmText}>This will share your GPS location and screening result with your emergency contact via WhatsApp.</div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button style={{ flex: 1, padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border)", cursor: "pointer", fontWeight: 600, fontSize: 13, background: "transparent", color: "var(--text)" }} onClick={() => setPendingSOS(null)}>Cancel</button>
                      <button style={{ flex: 1, padding: "10px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: "#EF4444", color: "#fff" }} onClick={() => handleMentalHealthSOS(result)} disabled={sosLoading}>
                        {sosLoading ? "Sending..." : "Confirm & Send"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    style={{ padding: "10px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: "#EF4444", color: "#fff" }}
                    onClick={() => setPendingSOS("result")}
                    disabled={sosSent}
                  >
                    {sosSent ? "✅ Emergency contact notified" : "🆘 Notify Emergency Contact"}
                  </button>
                )}
              </div>
            </ResultSection>
          )}

          <button
            style={{ ...s.secondaryBtn, marginTop: 22 }}
            onClick={() => { setSubmitted(false); setAnswers(new Array(questions.length).fill(null)); }}
          >
            Take Again
          </button>
        </div>
      )}

      {/* ── Questions ────────────────────────────────────────────────────────── */}
      {!submitted && (
        <div style={s.card}>
          <div style={s.h2}>
            Over the last 2 weeks, how often have you been bothered by:
          </div>

          <div style={s.progressWrap}>
            <div style={s.progressLabel}>
              <span>Question {Math.min(answeredCount + 1, questions.length)} of {questions.length}</span>
              <span>{answeredCount} of {questions.length} answered</span>
            </div>
            <div style={s.progressTrack}>
              <div style={{ ...s.progressFill, width: progressPct + "%" }} />
            </div>
          </div>

          {questions.map((q, qi) => (
            <div key={qi} style={s.qCard}>
              <div style={s.qText}>{qi + 1}. {q.question}</div>
              <div style={s.optionRow}>
                {labels.map((label, li) => (
                  <button
                    key={li}
                    style={s.optBtn(answers[qi] === li)}
                    onClick={() => {
                      const newAns = [...answers];
                      newAns[qi] = li;
                      setAnswers(newAns);
                    }}
                  >
                    {answers[qi] === li ? "✓ " : ""}{li} — {label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button
            style={s.submitBtn}
            onClick={handleSubmit}
            disabled={loading || answers.some(a => a === null)}
          >
            {loading ? "Scoring..." : "Submit & Get Results"}
          </button>
        </div>
      )}

      {/* ── Past Screenings with Exercises ───────────────────────────────────── */}
      {history.length > 0 && (
        <div style={s.card}>
          <div style={s.h2}>Past Screenings</div>
          {history.map((h, i) => {
            const hColor    = SEVERITY_COLORS[h.severity] || "#64748b";
            const isExp     = expandedHist === i;
            const exercises = getExercises(h.screening_type, h.total_score);
            const hMax      = (h.screening_type === "PHQ9" || h.screening_type === "PHQ-9") ? 27 : 21;

            return (
              <div
                key={i}
                style={{ background: "var(--stat-bg)", borderRadius: 14, padding: 16, marginBottom: 12, border: `1px solid ${hColor}33` }}
              >
                {/* Header row */}
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  onClick={() => setExpandedHist(isExp ? null : i)}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>
                      {h.screening_type} · Score: {h.total_score}
                      <span style={{ fontWeight: 400, fontSize: 12, color: "var(--muted)", marginLeft: 6 }}>/ {hMax}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {new Date(h.screened_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                    <SeverityBar score={h.total_score} maxScore={hMax} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ padding: "4px 12px", borderRadius: 20, background: hColor + "22", color: hColor, fontSize: 12, fontWeight: 700 }}>
                      {h.severity}
                    </span>
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>{isExp ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Expanded: recommendations + exercises */}
                {isExp && (
                  <div style={{ marginTop: 14 }}>
                    {/* Recommendations from API */}
                    {h.recommendations?.length > 0 && (
                      <ResultSection title="Recommendations">
                        {h.recommendations.map((r, ri) => (
                          <div key={ri} style={{ fontSize: 13, color: "var(--text)", marginBottom: 4 }}>• {r}</div>
                        ))}
                      </ResultSection>
                    )}

                    {/* Exercises */}
                    <ResultSection title="Daily Exercises">
                      <div style={{ background: "var(--surface)", borderRadius: 12, padding: "14px 16px", border: `1px solid ${hColor}33` }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                          {exercises.map((ex, ei) => (
                            <div
                              key={ei}
                              style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, padding: "8px 12px", background: "var(--stat-bg)", borderRadius: 8, borderLeft: `3px solid ${hColor}` }}
                            >
                              {ex}
                            </div>
                          ))}
                        </div>
                      </div>
                    </ResultSection>

                    {/* Follow-up info */}
                    {h.follow_up_recommended && (
                      <ResultSection title="Follow-up Plan">
                        <div style={{ fontSize: 12, color: "var(--text)" }}>
                          📅 <strong>{h.follow_up_recommended}</strong>
                        </div>
                      </ResultSection>
                    )}

                    {/* Crisis note */}
                    {h.crisis_flag && (
                      <ResultSection title="Emergency Resources">
                        <div style={{ background: "#7f1d1d22", border: "1px solid #7f1d1d55", borderRadius: 8, padding: "10px 14px" }}>
                          <div style={{ fontSize: 13, color: "#EF4444", fontWeight: 700, marginBottom: 8 }}>
                            🆘 Crisis flag was raised at time of screening. Please seek professional support.
                          </div>
                          {pendingSOS === i ? (
                            <div style={{ ...s.confirmBox, marginTop: 8 }}>
                              <div style={s.confirmTitle}>Send emergency alert?</div>
                              <div style={s.confirmText}>This will share your GPS location and screening result with your emergency contact via WhatsApp.</div>
                              <div style={{ display: "flex", gap: 10 }}>
                                <button style={{ flex: 1, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", fontWeight: 600, fontSize: 12, background: "transparent", color: "var(--text)" }} onClick={() => setPendingSOS(null)}>Cancel</button>
                                <button style={{ flex: 1, padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, background: "#EF4444", color: "#fff" }} onClick={() => handleMentalHealthSOS({ screening_type: h.screening_type })} disabled={sosLoading}>
                                  {sosLoading ? "Sending..." : "Confirm & Send"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              style={{ padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, background: "#EF4444", color: "#fff" }}
                              onClick={() => setPendingSOS(i)}
                            >
                              🆘 Notify Emergency Contact
                            </button>
                          )}
                        </div>
                      </ResultSection>
                    )}
                  </div>
                )}

                {!isExp && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--accent)", cursor: "pointer" }} onClick={() => setExpandedHist(i)}>
                    Click to see exercises & recommendations →
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Disclaimer */}
      <div style={{ fontSize: 12, color: "var(--muted)", padding: "16px 0", lineHeight: 1.6 }}>
        <strong>Disclaimer:</strong> PHQ-9 © Pfizer Inc. GAD-7 © Pfizer Inc. These tools are for informational screening only, not diagnosis.
        If you are in crisis, call <strong>iCall: 9152987821</strong> or <strong>Vandrevala Foundation: 1860-2662-345</strong>.
      </div>
    </div>
  );
}
