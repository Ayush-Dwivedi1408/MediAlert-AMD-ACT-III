# MediAlert — Disease Prediction: Candidate List & Evidence Mapping

**Purpose:** Per the medical validation audit's finding that an open-ended LLM disease list cannot be validated (there's no fixed target to check against any guideline), this document defines a **curated candidate list** the model is constrained to choose from, each mapped to a source type where one plausibly exists. This is Phase 2, item #8.

**How the list was built:** Your `ALL_SYMPTOMS` list is the standard 132-symptom vocabulary from the widely-used "Disease Prediction Using Machine Learning" symptom-disease dataset (recognizable by entries like `nodal_skin_eruptions`, `dischromic_patches`, `yellow_crust_ooze`). That dataset's own reference vocabulary covers 41 diseases. This document uses **38 of those 41**, deliberately excluding three (see below).

**What changed in the code:** `predict_diseases()` now includes this 38-item list in the prompt and instructs the model to select only from it — up to 5 matches, or **zero** if nothing genuinely fits — rather than always forcing exactly 5 free-form names. This doesn't make the *prediction itself* clinically validated — it's still an LLM judgment call, not a trained/tested classifier — but it bounds the output to a checkable set, which is a prerequisite for any future validation work, and stops the model from padding out to 5 when fewer (or none) of the supported conditions actually apply.

**Three diseases deliberately excluded from the original 41-item reference vocabulary:**
- **AIDS** — an LLM-generated symptom-based guess at this condition carries real stigma and psychological-harm risk with no diagnostic testing behind it; excluded on safety grounds, not because the symptom mapping is weak.
- **Heart Attack** — high enough acute stakes that a wrong signal in either direction (false reassurance or false alarm) from symptom-only LLM output is a genuinely dangerous category to guess at without any ECG/troponin data; MediAlert's existing NEWS2/vitals/emergency-triage features already handle acute cardiac risk more appropriately than a disease-name guess would.
- **Chronic Cholestasis** — a rare, specialist-diagnosed condition with a comparatively weak, ambiguous symptom mapping; low value for a general-purpose intake tool.

If you want full parity with the original 41-disease dataset, these three can be added back — just say so — but the recommendation is to leave them out.

---

## Candidate List & Evidence Mapping (38 diseases)

| Disease | Matching symptom cluster | Evidence type | Source | Verification status |
|---|---|---|---|---|
| Common Cold | continuous_sneezing, chills, runny_nose, congestion, throat_irritation, cough | C. Evidence-supported | ICMR STW (upper respiratory infection) | NOT VERIFIED this session |
| Pneumonia | high_fever, cough, breathlessness, chest_pain, phlegm, rusty_sputum, fast_heart_rate | C. Evidence-supported | WHO ARI/pneumonia guidance; ICMR STW | NOT VERIFIED this session |
| Bronchial Asthma | cough, breathlessness, fatigue, family_history, mucoid_sputum | C. Evidence-supported | GINA guidelines; NICE asthma guidance | NOT VERIFIED this session |
| Tuberculosis | cough, blood_in_sputum, weight_loss, sweating, chest_pain, fatigue, mild_fever | C. Evidence-supported | WHO TB guidelines; India NTEP | NOT VERIFIED this session — high India-relevance, worth verifying first |
| Dengue | high_fever, headache, joint_pain, skin_rash, muscle_pain, pain_behind_the_eyes, red_spots_over_body, nausea | C. Evidence-supported | WHO Dengue guidelines; NVBDCP (India) | NOT VERIFIED this session — high India-relevance |
| Malaria | chills, high_fever, sweating, headache, nausea, vomiting, muscle_pain, fatigue | C. Evidence-supported | WHO Malaria guidelines; NVBDCP (India) | NOT VERIFIED this session |
| Typhoid | high_fever, headache, abdominal_pain, constipation, diarrhoea, fatigue, chills | C. Evidence-supported | WHO typhoid guidance; ICMR STW | NOT VERIFIED this session |
| Hepatitis A | yellowish_skin, yellowing_of_eyes, dark_urine, nausea, vomiting, fatigue | C. Evidence-supported | WHO viral hepatitis guidelines | NOT VERIFIED this session |
| Hepatitis B | yellowish_skin, yellowing_of_eyes, dark_urine, joint_pain, fatigue, receiving_blood_transfusion, receiving_unsterile_injections | C. Evidence-supported | WHO viral hepatitis guidelines | NOT VERIFIED this session |
| Hepatitis C | yellowish_skin, yellowing_of_eyes, dark_urine, fatigue, receiving_blood_transfusion, receiving_unsterile_injections | C. Evidence-supported | WHO viral hepatitis guidelines | NOT VERIFIED this session |
| Hepatitis D | yellowish_skin, yellowing_of_eyes, dark_urine, abdominal_pain, fatigue | C. Evidence-supported | WHO viral hepatitis guidelines | NOT VERIFIED this session |
| Hepatitis E | yellowish_skin, yellowing_of_eyes, dark_urine, nausea, abdominal_pain, fatigue | C. Evidence-supported | WHO viral hepatitis guidelines | NOT VERIFIED this session |
| Alcoholic Hepatitis | yellowish_skin, abdominal_pain, history_of_alcohol_consumption, swelling_of_stomach, fluid_overload | C. Evidence-supported | WHO/clinical hepatology guidance | NOT VERIFIED this session |
| Jaundice | yellowish_skin, yellowing_of_eyes, dark_urine, itching, vomiting, fatigue | C. Evidence-supported | WHO/ICMR guidance (jaundice is a clinical sign, not a standalone disease — see note below) | NOT VERIFIED this session |
| Gastroenteritis | vomiting, diarrhoea, abdominal_pain, dehydration, nausea | C. Evidence-supported | WHO diarrhoeal disease guidance | NOT VERIFIED this session |
| GERD | acidity, indigestion, stomach_pain, chest_pain | C. Evidence-supported | NICE GERD/dyspepsia guidance | NOT VERIFIED this session |
| Peptic Ulcer Disease | abdominal_pain, indigestion, loss_of_appetite, internal_itching | C. Evidence-supported | NICE dyspepsia/peptic ulcer guidance | NOT VERIFIED this session |
| Drug Reaction | skin_rash, itching, red_spots_over_body, blister | C. Evidence-supported | WHO/pharmacovigilance ADR guidance | NOT VERIFIED this session — inherently hard to distinguish from other rash causes without medication-history context |
| Allergy | continuous_sneezing, itching, skin_rash, watering_from_eyes, chills | C. Evidence-supported | WHO/allergy clinical guidance | NOT VERIFIED this session |
| Migraine | headache, nausea, blurred_and_distorted_vision, visual_disturbances, dizziness | C. Evidence-supported | NICE headache/migraine guidance | NOT VERIFIED this session |
| Hypertension | headache, dizziness, chest_pain, fatigue, blurred_and_distorted_vision | See caution note below | NICE hypertension guidance | NOT VERIFIED this session — **BP itself is a NEWS2 vital (validated); "Hypertension" as a diagnosed disease from symptoms alone is a separate, weaker claim** |
| Diabetes | fatigue, weight_loss, irregular_sugar_level, excessive_hunger, increased_appetite, polyuria, blurred_and_distorted_vision | See caution note below | WHO/ICMR diabetes diagnostic criteria | NOT VERIFIED this session — **requires a measured glucose/HbA1c value to actually diagnose; MediAlert cannot measure this from symptoms** |
| Hypoglycemia | dizziness, sweating, palpitations, fatigue, blurred_and_distorted_vision | See caution note below | WHO/clinical guidance | NOT VERIFIED this session — same measurement caveat as Diabetes; this is an acute, potentially dangerous state that ideally needs an actual glucose reading, not a guess |
| Hypothyroidism | fatigue, weight_gain, cold_hands_and_feets, mood_swings, puffy_face_and_eyes, enlarged_thyroid, brittle_nails | C. Evidence-supported | NICE/ETA hypothyroidism guidance | NOT VERIFIED this session |
| Hyperthyroidism | weight_loss, increased_appetite, restlessness, sweating, fast_heart_rate, mood_swings | C. Evidence-supported | NICE/ETA hyperthyroidism guidance | NOT VERIFIED this session |
| Urinary Tract Infection | burning_micturition, bladder_discomfort, foul_smell_of_urine, continuous_feel_of_urine | C. Evidence-supported | NICE UTI guidance | NOT VERIFIED this session |
| Osteoarthritis | joint_pain, knee_pain, hip_joint_pain, swelling_joints, movement_stiffness, neck_pain | C. Evidence-supported | NICE osteoarthritis guidance | NOT VERIFIED this session |
| Arthritis | joint_pain, muscle_weakness, stiff_neck, swelling_joints, movement_stiffness, painful_walking | C. Evidence-supported | NICE arthritis guidance | NOT VERIFIED this session |
| Cervical Spondylosis | neck_pain, back_pain, dizziness, loss_of_balance | C. Evidence-supported | NICE/orthopedic guidance | NOT VERIFIED this session |
| Vertigo (Paroxysmal Positional Vertigo) | dizziness, loss_of_balance, spinning_movements, unsteadiness | C. Evidence-supported | NICE/ENT guidance on BPPV | NOT VERIFIED this session |
| Paralysis (Brain Hemorrhage) | weakness_of_one_body_side, altered_sensorium, slurred_speech, headache, vomiting | High-stakes — see note | WHO stroke/emergency guidance | NOT VERIFIED this session — **this symptom cluster overlaps heavily with stroke, a time-critical emergency; any match here should trigger the emergency/urgent-care pathway prominently, not just a routine disease card** |
| Varicose Veins | swollen_blood_vessels, prominent_veins_on_calf, swollen_legs, cramps, fatigue | C. Evidence-supported | NICE varicose veins guidance | NOT VERIFIED this session |
| Dimorphic Hemorrhoids (Piles) | pain_in_anal_region, bloody_stool, irritation_in_anus, constipation, pain_during_bowel_movements | C. Evidence-supported | NICE hemorrhoids guidance | NOT VERIFIED this session |
| Fungal Infection | itching, skin_rash, nodal_skin_eruptions, dischromic_patches | C. Evidence-supported | WHO/dermatology guidance on dermatophytosis | NOT VERIFIED this session |
| Acne | skin_rash, pus_filled_pimples, blackheads, scurring | C. Evidence-supported | NICE/dermatology acne guidance | NOT VERIFIED this session |
| Psoriasis | skin_peeling, silver_like_dusting, small_dents_in_nails, inflammatory_nails, joint_pain | C. Evidence-supported | NICE psoriasis guidance | NOT VERIFIED this session |
| Impetigo | skin_rash, high_fever, blister, red_sore_around_nose, yellow_crust_ooze | C. Evidence-supported | NICE/dermatology impetigo guidance | NOT VERIFIED this session |
| Chicken Pox | skin_rash, itching, fatigue, mild_fever, malaise, red_spots_over_body | C. Evidence-supported | WHO varicella guidance | NOT VERIFIED this session |

**What "NOT VERIFIED" honestly means here:** for every row, the symptom-to-disease association is standard textbook clinical knowledge, but I have **not** individually fetched and confirmed the exact ICMR/WHO/NICE document, page, and section for each one in this session — doing that properly for all 38 would need 38+ dedicated source-verification passes. This is honest about that gap rather than inventing citations to fill it.

**Highest-priority entries to actually verify first**, given India relevance and/or acute risk: **Tuberculosis, Dengue, Malaria, Typhoid** (India-specific programs exist — NTEP, NVBDCP), and **Paralysis (Brain Hemorrhage)** (time-critical stroke overlap — verify the emergency pathway is correctly triggered, not just the disease name shown).

---

## Recommended Next Step (beyond this session)

Verify the 5 highest-priority entries above with direct source fetches in a follow-up session — that's tractable and gives you several conditions you can speak to with full confidence, plus confirms the emergency-pathway behavior for the stroke-overlap case is actually correct in your UI, not just in this document.
