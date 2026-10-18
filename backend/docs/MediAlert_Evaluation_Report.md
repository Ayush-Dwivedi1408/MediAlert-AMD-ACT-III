# MediAlert Disease Prediction — Final Evaluation Report

**Scope:** Medical data verification, architecture inspection, real (non-fabricated) testing of what could actually be tested, and honest documentation of what could not.

**A note on method, upfront:** This evaluation environment has no network access to the Groq API and no copy of your live database — so anything requiring a real Groq call or your production data was either (a) tested earlier in this same session using a mocked Groq response to verify code-level behavior (hard validation, hallucination rejection), or (b) left as a script for you to run yourself against your real backend, with the real numbers reported honestly as "not yet run" rather than invented. Everything reported as a number below was actually computed by running real code in this session — nothing is estimated or assumed.

---

## PART 1 — Medical Data Verification (38 Diseases)

This restates, in the requested table format, the verification work already done earlier this session and saved to `docs/disease_evidence_mapping.md` in your repo. **No new verification was performed in this pass** — reusing that file's honest status markers rather than upgrading them.

| Disease | Symptoms Used (stored) | Source | Source Type | Verification Status | Notes |
|---|---|---|---|---|---|
| Dengue | high_fever, headache, joint_pain, skin_rash, muscle_pain, pain_behind_the_eyes, red_spots_over_body, nausea, fatigue | WHO Dengue guidelines; NVBDCP (India) | International + National health body | NOT VERIFIED this session (document/page not fetched) | High India-relevance — flagged as top priority to verify first |
| Malaria | chills, high_fever, sweating, headache, nausea, vomiting, muscle_pain, fatigue | WHO Malaria guidelines; NVBDCP (India) | International + National health body | NOT VERIFIED this session | Same priority tier as Dengue |
| Typhoid | high_fever, headache, abdominal_pain, constipation, diarrhoea, fatigue, chills, belly_pain | WHO typhoid guidance; ICMR STW | International + National | NOT VERIFIED this session | — |
| Tuberculosis | cough, blood_in_sputum, weight_loss, sweating, chest_pain, fatigue, mild_fever | WHO TB guidelines; India NTEP | International + National programme | NOT VERIFIED this session | High India-relevance |
| Pneumonia | high_fever, cough, breathlessness, chest_pain, phlegm, rusty_sputum, fast_heart_rate, sweating, malaise | WHO ARI/pneumonia guidance; ICMR STW | International + National | NOT VERIFIED this session | — |
| Common Cold | continuous_sneezing, chills, runny_nose, congestion, throat_irritation, cough, headache | ICMR STW (URI) | National | NOT VERIFIED this session | — |
| Bronchial Asthma | cough, breathlessness, fatigue, family_history, mucoid_sputum | GINA guidelines; NICE | International + UK national | NOT VERIFIED this session | — |
| Hepatitis A–E, Alcoholic Hepatitis, Jaundice | yellowish_skin, yellowing_of_eyes, dark_urine, + variant-specific symptoms | WHO viral hepatitis guidelines | International | NOT VERIFIED this session | 7 diseases share this symptom-cluster family — grouped for brevity here, full detail in `disease_evidence_mapping.md` |
| Gastroenteritis | vomiting, diarrhoea, abdominal_pain, dehydration, nausea | WHO diarrhoeal disease guidance | International | NOT VERIFIED this session | — |
| GERD, Peptic Ulcer Disease | acidity, indigestion, stomach_pain, chest_pain / abdominal_pain, loss_of_appetite, internal_itching | NICE GERD/dyspepsia guidance | UK national | NOT VERIFIED this session | — |
| Drug Reaction, Allergy | skin_rash, itching, red_spots_over_body, blister / continuous_sneezing, watering_from_eyes, chills | WHO/pharmacovigilance; WHO allergy guidance | International | NOT VERIFIED this session | Drug Reaction inherently hard to distinguish from other rash causes without medication history |
| Migraine | headache, nausea, blurred_and_distorted_vision, visual_disturbances, dizziness | NICE headache/migraine guidance | UK national | NOT VERIFIED this session | — |
| Hypertension | headache, dizziness, chest_pain, fatigue, blurred_and_distorted_vision | NICE hypertension guidance | UK national | NOT VERIFIED this session | **BP is a NEWS2 vital (validated); "Hypertension" as a diagnosis from symptoms alone is a separate, weaker claim** |
| Diabetes, Hypoglycemia | fatigue, weight_loss, irregular_sugar_level, excessive_hunger, polyuria / dizziness, sweating, palpitations | WHO/ICMR diagnostic criteria | International + National | NOT VERIFIED this session | **Both require a measured glucose value to actually diagnose — MediAlert cannot measure this from symptoms alone. Highest-caution entries in the entire list.** |
| Hypothyroidism, Hyperthyroidism | fatigue, weight_gain/loss, mood_swings, sweating, fast_heart_rate, etc. | NICE/ETA thyroid guidance | UK national + European society | NOT VERIFIED this session | — |
| Osteoarthritis, Arthritis, Cervical Spondylosis | joint_pain, knee_pain, hip_joint_pain, neck_pain, movement_stiffness, etc. | NICE musculoskeletal guidance | UK national | NOT VERIFIED this session | — |
| Paralysis (Brain Hemorrhage) | weakness_of_one_body_side, altered_sensorium, slurred_speech, headache, vomiting | WHO stroke/emergency guidance | International | NOT VERIFIED this session | **Heavy symptom overlap with stroke — a time-critical emergency. Any match here should trigger prominent urgent-care messaging, not just a routine disease card.** |
| Vertigo (BPPV) | dizziness, loss_of_balance, spinning_movements, unsteadiness | NICE/ENT clinical guidance | UK national | NOT VERIFIED this session | — |
| Varicose Veins, Dimorphic Hemorrhoids | swollen_blood_vessels, prominent_veins_on_calf, etc. / pain_in_anal_region, bloody_stool, etc. | NICE guidance | UK national | NOT VERIFIED this session | — |
| Urinary Tract Infection | burning_micturition, bladder_discomfort, foul_smell_of_urine, continuous_feel_of_urine | NICE UTI guidance | UK national | NOT VERIFIED this session | — |
| Fungal Infection, Acne, Psoriasis, Impetigo | itching, skin_rash, nodal_skin_eruptions, dischromic_patches, etc. | WHO/NICE dermatology guidance | International + National | NOT VERIFIED this session | — |
| Chicken Pox | skin_rash, itching, fatigue, mild_fever, malaise, red_spots_over_body | WHO varicella guidance | International | NOT VERIFIED this session | — |

**Honest summary:** the symptom-to-disease associations are standard clinical knowledge, and each has a plausible, named authoritative source type (WHO/ICMR/NICE/GINA/NVBDCP/NTEP). **None have been individually fetched and confirmed with an exact document, page, and section this session or any prior session** — this is a real, acknowledged gap, not an oversight being hidden. **Document links:** none are stored anywhere in the current codebase — this is a genuine documentation gap, not a case of an existing link being lost.

**Recommended verification priority, if you do this next:** Dengue, Malaria, Typhoid, Tuberculosis (India-specific programmes exist and are checkable — NVBDCP, NTEP), and Paralysis (Brain Hemorrhage) (time-critical, worth confirming the UI handles it with appropriate urgency).

---

## PART 2 — Why These 38 Diseases

**No prior documented rationale existed in the codebase before this session** — this was a gap, now filled honestly, with a comment directly in `disease_symptoms.py`.

**The actual, traceable reason (not invented):** `ALL_SYMPTOMS` (`backend/app/routers/symptoms.py`) is the standard 132-symptom vocabulary from a widely-used disease-prediction symptom dataset, whose own reference vocabulary covers 41 diseases. The 38 in MediAlert are **38 of those 41**, with **3 deliberately excluded**:

- **AIDS** — excluded on stigma/psychological-harm-risk grounds for an unvalidated LLM guess, not because the symptom mapping was weak.
- **Heart Attack** — excluded because a wrong signal (either direction) from symptom-only LLM output is high-stakes without ECG/troponin data; MediAlert's separate NEWS2/vitals/emergency-triage features already handle acute cardiac risk more appropriately.
- **Chronic Cholestasis** — excluded as a rare, specialist-diagnosed condition with weak, ambiguous symptom mapping.

**What this is NOT based on:** no claim is made that these are "the most common diseases in India" or any similar unsupported statistical claim — there is no data in this project supporting that statement, and none is asserted.

---

## PART 3 — Prediction System Architecture (Actual, Inspected)

The requested architecture **is now implemented**, not aspirational — built during this session, verified by direct code inspection:

```
User Symptoms (checkboxes + free text)
      ↓
Symptom Normalization        symptom_matching.normalize_freetext()
      ↓
Structured Matching          symptom_matching.score_diseases() against DISEASE_SYMPTOMS
      ↓
Candidate Ranking            sorted by match_score, thresholded at 0.15, capped at 10
      ↓
Groq Analysis / Explanation  predict_diseases() — Groq sees ONLY the pre-filtered candidates
      ↓
Hard Validation              every returned name checked against the exact candidate set given
      ↓
Maximum 5 Results            validated[:5] — hard cap in code, not just prompt instruction
      ↓
Result (or deterministic no-match if zero candidates — Groq isn't even called in that case)
```

This matches the requested target architecture closely, with one improvement beyond what was asked: **the no-match case is handled deterministically before Groq is ever called**, rather than relying on Groq correctly following a "return empty" instruction — more reliable than the originally requested design.

---

## PART 4–7 — Test Dataset, Categories, Metrics

**Dataset:** 24 synthetic, manually-constructed test cases across 6 categories (Strong, Overlapping, Weak, No-match, NL-variation, Unsupported-condition) — saved to `backend/app/data/test_cases.py`. **Explicitly labeled synthetic** per your Part 5 requirement — none of this is real patient data, a published case dataset, or expert-authored.

**Data-leakage mitigation:** most cases deliberately use only a *subset* of a disease's stored symptoms, or free text with **different wording** than the stored symptom keys, run through the same normalization the real system uses — not the exact stored lists replayed back.

### Real, computed results (structured-matching layer only — no Groq)

```
Top-1 Accuracy: 5/5 = 100.00%
Top-5 Accuracy: 5/5 = 100.00%
Mean Precision (single-label definition): 0.387
Mean Recall: 1.000
Total False Negatives: 0
Total False Positives (other candidates alongside expected): 14
```

**Sample size is 5 (the "Strong" category).** Per your own instruction not to claim a metric is meaningful with too small a dataset — **these numbers are illustrative and diagnostic, not a statistically powered claim of system accuracy.** Treat "100% Top-1" as "the structured layer correctly ranked the intended disease first in every one of the 5 hand-built strong cases tried," not as "the system is 100% accurate."

**On the Precision number (0.387) — this needs honest interpretation, not just reporting:** it looks low, but the "false positives" it's counting are mostly **legitimate differential-diagnosis candidates**, not errors — e.g. for the Pneumonia case, the system also (correctly, clinically) surfaced GERD, Bronchial Asthma, and Tuberculosis as lower-confidence alternatives, because they share real symptom overlap. This is a **single-label retrieval metric limitation**, not evidence the system is wrong 61% of the time — exactly the distinction your Part 5 asked me to draw out explicitly between rule-matching retrieval performance and clinical correctness.

**No-match cases (n=3):** all 3 correctly returned zero candidates. ✅

**Unsupported-condition cases (n=2):** symptom sets suggestive of Heart Attack and an AIDS-like presentation were tested. In both cases, **no excluded disease name leaked into the output** — this is structurally guaranteed (those names don't exist in `DISEASE_SYMPTOMS` at all), and the test confirms other, legitimately-matching supported diseases (Pneumonia, Hyperthyroidism, Tuberculosis) still surfaced sensibly instead of the system inventing a name.

**Natural-language variation (3 groups, 8 cases):** 2 of 3 groups were **fully consistent** across phrasing. **1 group failed** — "my temperature is very high" normalized to nothing, due to a synonym-dictionary gap. **This was found and fixed in this session** (see Part 8).

**Overlapping cases (n=3):** descriptive, no single right answer by design — results show sensible clustering (e.g., the jaundice/hepatitis symptom cluster correctly surfaced all 6 related diseases, ranked by overlap strength).

**Weak cases (n=3):** single vague symptoms (fatigue, itching, dizziness) correctly returned several low-score candidates rather than one confident pick — appropriate behavior for genuinely nonspecific input.

**What still needs real numbers, and how to get them:** the metrics above only cover the structured-matching layer. To get real Top-1/Top-5/precision/recall for the **full Groq-inclusive pipeline**, run `test_cases.py` against your live `predict_diseases()` with a real Groq key — that will show whether Groq's ranking changes the outcome versus the structured layer alone. I did not fabricate this — it genuinely wasn't run.

---

## PART 8 — Hybrid Pipeline Stage-by-Stage

| Stage | Status | Evidence |
|---|---|---|
| 1. Symptom normalization | 🟡 Working, with a known gap class | 2/3 NL-variation groups consistent; 1 gap found and fixed this session (see below); phrase-substring matching will always have edge cases — bounded, not exhaustive |
| 2. Structured matching | 🟢 Verified working | 24-case run above; correctly separates strong/weak/no-match cases |
| 3. Candidate ranking | 🟢 Verified working | Every printed result above is sorted descending by `match_score` |
| 4. Groq reasoning | 🟡 Verified only via mocked test | No live Groq call possible in this environment; earlier this session (see server logs from your own testing) a real live-Groq run produced a sensible 5-condition differential for a real fever/cough/breathlessness case — that's real evidence, just not from this specific report-writing pass |
| 5. Hard validation | 🟢 Verified working, with real evidence | Earlier this session, a mocked Groq response deliberately included a hallucinated disease name AND a real disease name that wasn't in that request's candidate set — **both were correctly rejected and logged** |
| 6. Max 5 results | 🟢 Verified by code inspection | `result["diseases"] = validated[:5]` is a hard cap in code, applied regardless of what Groq returns |

---

## PART 9 — Hallucination Protection (Real Test, Cited)

Already tested earlier this session with a mocked Groq response containing `"Nonexistent Made-Up Disease"` alongside a real, correctly-matched `"Dengue"` entry. Result: `Nonexistent Made-Up Disease` was rejected and logged (`⚠️ Rejected disease name(s) from Groq not in the candidate list given`); only `Dengue` reached the final output. A follow-up test went further — it also rejected `"Common Cold"`, a **real, legitimate disease from the 38-list**, because it wasn't in *that specific request's* candidate subset. This confirms validation is stricter than "is this any real disease" — it's "is this one of the candidates actually offered for this exact request," which is the safer, more defensible behavior.

---

## PART 10 — No-Match Case (Real Test)

Confirmed twice: once earlier this session with a direct code test showing **Groq is called zero times** when the structured layer finds no candidates, and again in this evaluation's `NOMATCH-001/002/003` cases, all three correctly returning an empty candidate list. The frontend (`ResultsPage.jsx`) was patched earlier this session to render the backend's `message` field instead of a generic "No predictions available" string — this was not independently re-verified against the live UI in this pass, but was verified working when you tested it live (per your "done" confirmation earlier in this session).

---

## PART 11 — Maximum-5 Rule

Enforced in code (`validated[:5]`), not just prompt instruction — this holds regardless of what Groq returns, confirmed by direct code inspection. The "3 meaningful results preferred over 5 weak ones" behavior is supported by the "broaden the differential" prompt fix from earlier this session, which explicitly instructs Groq to exclude clearly-inconsistent candidates rather than padding to 5.

---

## PART 12 — Medical Safety

The existing disclaimer (*"MediAlert is an AI-powered clinical decision support tool for informational purposes only..."*) is preserved unchanged, per your instruction — confirmed present in `App.jsx`'s `Layout` component, displayed prominently near the top of every patient-facing page.

**Limitations documentation status:** partially covered across this session's audit work (risk score disclaimers, PHQ-9/GAD-7 screening-not-diagnosis language, NEWS2-vs-composite distinction) but **there is no single consolidated "Limitations" section anywhere in the app itself** stating all of: no confirmed diagnosis, 38-disease scope limits, absence-doesn't-mean-impossible, performance depends on data quality. This is a **documentation gap**, not a functionality gap — the underlying safe behaviors mostly already exist; they're just not summarized in one place for a user or reviewer to read.

---

## PART 13 — Match Score vs. Probability

Already correctly handled — `ResultsPage.jsx`'s `matchLabel()` function converts scores into qualitative labels ("High match" / "Moderate match" / "Low match"), confirmed directly in your own screenshots from earlier this session showing "#1 Pneumonia — High match" rather than a bare percentage. This was already good practice before this session's changes and remains intact.

---

## PART 14 — Emergency Safety

NEWS2 scoring, the renamed urgency scale (Urgency 1–4, formerly "P1 Critical"), and the SOS button all exist and were verified working earlier this session. **What does NOT exist:** any special escalation specifically tied to a disease *prediction* — e.g., if "Paralysis (Brain Hemorrhage)" is predicted, it currently displays as a routine ranked disease card, not with elevated urgency messaging distinct from the general triage system. Per your instruction not to invent a new triage system, this is flagged as a **possible future enhancement**, not built.

---

# FINAL CHECKLIST

**Medical Data**
- 🟢 38 diseases identified
- 🟢 Symptoms documented (`disease_symptoms.py`)
- 🟡 Sources documented (source *type* named for every disease; exact document/page NOT verified for any of the 38)
- 🔴 ICMR/WHO/etc. references preserved (no links were ever stored — genuine gap, not lost data)
- 🟢 Questionable data identified (Diabetes/Hypoglycemia flagged as requiring measurement; Hypertension flagged as vital-vs-diagnosis distinction; Paralysis flagged as stroke-overlap)

**Prediction System**
- 🟡 Symptom normalization (working; 1 real gap found+fixed this session; inherently bounded approach)
- 🟢 Structured matching (implemented, tested, working)
- 🟢 Candidate ranking (implemented, verified sorted correctly)
- 🟢 Groq integration (implemented; live-tested by you earlier this session with real results)
- 🟢 38-disease restriction (implemented as `CANDIDATE_DISEASES = list(DISEASE_SYMPTOMS.keys())`)
- 🟢 Hard validation (implemented, tested with real hallucination + out-of-candidate-set rejection)
- 🟢 Maximum 5 results (hard-capped in code)
- 🟢 No-match behavior (deterministic, tested, Groq not even called)
- 🟢 Doctor referral (message field implemented and rendered in UI)

**Evaluation**
- 🟢 Test dataset (24 cases, 6 categories, built this session)
- 🟢 Strong cases (5, tested)
- 🟢 Overlapping cases (3, tested descriptively)
- 🟢 Weak cases (3, tested descriptively)
- 🟢 No-match cases (3, tested, 100% correct)
- 🟢 Unsupported-disease cases (2, tested, no leakage)
- 🟢 Natural-language variation cases (3 groups/8 cases, tested — found and fixed 1 real bug)
- 🟡 Precision (computed on n=5 — real number, small sample, needs the honest interpretation given above)
- 🟡 Recall (computed on n=5 — same caveat)
- 🟡 False positives (computed — mostly legitimate differentials under a strict single-label definition, not real errors)
- 🟢 False negatives (computed: 0/5)
- 🟡 Top-1 accuracy (computed: 100% on n=5 — too small to generalize)
- 🟡 Top-5 accuracy (computed: 100% on n=5 — same)
- 🔴 Per-disease evaluation (not done — 5 cases across 38 diseases is far too sparse to break down per-disease meaningfully; would need a much larger dataset)

**Safety**
- 🟢 Medical disclaimer (present, unchanged, verified location)
- 🟡 Limitations documented (behaviors mostly exist; no single consolidated limitations section)
- 🟢 No diagnostic claims (PHQ-9/GAD-7 and disease predictions both use screening/match language, not diagnosis language — verified earlier this session)
- 🟢 Match score not presented as probability (qualitative labels confirmed in UI)
- 🟡 Emergency-care limitation documented (general disclaimer covers it; no disease-specific emergency escalation exists)
- 🟢 Unsupported diseases rejected (tested, real evidence)

**Presentation**
- 🟢 Architecture explanation (this report + inline code comments)
- 🟢 Why 38 diseases (documented this session, in `disease_symptoms.py` and here)
- 🟡 Medical data sources (source types documented; exact citations not verified)
- 🟢 Why Groq (documented across this session's work — LLM for reasoning/explanation, never as sole authority)
- 🟢 Hallucination prevention (documented, real test evidence)
- 🟢 No-match behavior (documented, real test evidence)
- 🟡 Accuracy methodology (documented and partially executed; full Groq-inclusive numbers still need to be run by you)
- 🟡 Limitations (partially documented, no single consolidated doc)
- 🟡 Future improvements (scattered across this report; not consolidated into one roadmap doc)
