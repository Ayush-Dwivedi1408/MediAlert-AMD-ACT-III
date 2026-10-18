"""
MediAlert Disease Prediction — Test Dataset

LABELING (per the evaluation brief's Part 5, data-leakage requirement):
Every case below is SYNTHETIC and MANUALLY CONSTRUCTED by Claude for this
evaluation. None of it is real patient data, a published clinical case
dataset, or an expert-authored case bank. Do not present it as such in any
report or interview.

Where a case uses "selected_symptoms" that overlap with DISEASE_SYMPTOMS
entries, that's unavoidable for STRONG cases (a disease's classic
presentation necessarily uses its own defining symptoms — that's what
"strong case" means). To genuinely test generalization rather than just
replaying the stored lists back at themselves, most cases deliberately:
  - use only a SUBSET of the disease's stored symptoms (not the full list)
  - mix in natural-language free text using DIFFERENT WORDING than the
    stored symptom keys, run through normalize_freetext() rather than
    pre-selected checkboxes
  - for weak/overlapping/no-match cases, use symptom combinations NOT
    lifted directly from any single disease's stored list

Each case has:
  id              - unique identifier
  category        - strong / overlapping / weak / no_match / nl_variation / unsupported
  selected_symptoms - checkbox-style symptoms (ALL_SYMPTOMS keys) passed as-is
  freetext        - natural-language description (run through normalization)
  expected_disease - the disease this case was constructed to represent, or
                      None for no_match / unsupported cases
  difficulty      - Easy / Medium / Hard (subjective, assigned at construction time)
  notes           - why this case is constructed the way it is
"""

TEST_CASES = [
    # ── A. STRONG / CLEAR CASES ──────────────────────────────────────────────
    # Deliberately using only 3-4 of each disease's symptoms (not the full
    # stored list) plus, where natural, one via free text in different words.
    {
        "id": "STRONG-001", "category": "strong",
        "selected_symptoms": ["high_fever", "joint_pain", "pain_behind_the_eyes"],
        "freetext": "I also have a skin rash all over my body",
        "expected_disease": "Dengue", "difficulty": "Easy",
        "notes": "Classic dengue triad (fever, joint pain, retro-orbital pain) + rash via free text, not checkbox",
    },
    {
        "id": "STRONG-002", "category": "strong",
        "selected_symptoms": ["cough", "breathlessness"],
        "freetext": "high temperature and chest hurts a lot, coughing up thick mucus",
        "expected_disease": "Pneumonia", "difficulty": "Easy",
        "notes": "Only 2 checkbox symptoms; fever/chest pain/phlegm all come from free-text normalization",
    },
    {
        "id": "STRONG-003", "category": "strong",
        "selected_symptoms": ["burning_micturition", "bladder_discomfort"],
        "freetext": "",
        "expected_disease": "Urinary Tract Infection", "difficulty": "Easy",
        "notes": "Minimal 2-symptom subset of UTI's 4 stored symptoms",
    },
    {
        "id": "STRONG-004", "category": "strong",
        "selected_symptoms": [],
        "freetext": "my knee hurts and my hip hurts too, and the joints feel stiff",
        "expected_disease": "Osteoarthritis", "difficulty": "Medium",
        "notes": "Entirely free-text, zero checkboxes — tests normalization + pain-pass alone",
    },
    {
        "id": "STRONG-005", "category": "strong",
        "selected_symptoms": ["weakness_of_one_body_side", "slurred_speech"],
        "freetext": "sudden headache and vomiting",
        "expected_disease": "Paralysis (Brain Hemorrhage)", "difficulty": "Easy",
        "notes": "High-stakes stroke-overlap case — verifying this is correctly flagged as high-priority",
    },

    # ── B. OVERLAPPING CASES ─────────────────────────────────────────────────
    # Symptom sets chosen to genuinely overlap 2+ diseases' stored lists.
    {
        "id": "OVERLAP-001", "category": "overlapping",
        "selected_symptoms": ["high_fever", "headache", "fatigue", "chills"],
        "freetext": "",
        "expected_disease": None,  # plausibly Malaria, Typhoid, or Dengue — no single "right" answer
        "difficulty": "Hard",
        "notes": "Generic febrile-illness cluster overlapping Malaria/Typhoid/Dengue — evaluated as 'is a reasonable disease present in top 5', not a single expected match",
    },
    {
        "id": "OVERLAP-002", "category": "overlapping",
        "selected_symptoms": ["yellowish_skin", "yellowing_of_eyes", "dark_urine", "fatigue"],
        "freetext": "",
        "expected_disease": None,  # overlaps Jaundice + all 5 Hepatitis variants
        "difficulty": "Hard",
        "notes": "Deliberately overlaps 6 diseases (Jaundice, Hep A-E) — tests whether ranking/breadth behaves sensibly under heavy overlap",
    },
    {
        "id": "OVERLAP-003", "category": "overlapping",
        "selected_symptoms": ["cough", "chest_pain"],
        "freetext": "",
        "expected_disease": None,  # GERD, Pneumonia, Tuberculosis, Bronchial Asthma all plausible
        "difficulty": "Medium",
        "notes": "Minimal 2-symptom overlap across 4 different diseases",
    },

    # ── C. WEAK CASES ────────────────────────────────────────────────────────
    {
        "id": "WEAK-001", "category": "weak",
        "selected_symptoms": ["fatigue"],
        "freetext": "",
        "expected_disease": None,
        "difficulty": "Hard",
        "notes": "Single, maximally nonspecific symptom — appears in 15+ of the 38 diseases",
    },
    {
        "id": "WEAK-002", "category": "weak",
        "selected_symptoms": ["itching"],
        "freetext": "",
        "expected_disease": None,
        "difficulty": "Hard",
        "notes": "Single weak symptom, tests whether threshold correctly limits candidate count",
    },
    {
        "id": "WEAK-003", "category": "weak",
        "selected_symptoms": ["dizziness"],
        "freetext": "",
        "expected_disease": None,
        "difficulty": "Medium",
        "notes": "Appears in Hypertension, Migraine, Cervical Spondylosis, Hypoglycemia, Vertigo — 5-way weak overlap",
    },

    # ── D. NO-MATCH CASES ────────────────────────────────────────────────────
    # Symptom combinations that shouldn't score above threshold for ANY
    # disease, or are nonsensical.
    {
        "id": "NOMATCH-001", "category": "no_match",
        "selected_symptoms": [],
        "freetext": "askjdlaksjd nonsense text with no real symptoms",
        "expected_disease": None, "difficulty": "Easy",
        "notes": "Pure gibberish — normalize_freetext() should return an empty list",
    },
    {
        "id": "NOMATCH-002", "category": "no_match",
        "selected_symptoms": [],
        "freetext": "",
        "expected_disease": None, "difficulty": "Easy",
        "notes": "Completely empty input on both fields — must not crash, must return diseases: []",
    },
    {
        "id": "NOMATCH-003", "category": "no_match",
        "selected_symptoms": ["obesity"],
        "freetext": "",
        "expected_disease": None, "difficulty": "Medium",
        "notes": "obesity is a listed risk_factor / weak general symptom with very sparse disease association — checks the system doesn't force a match just because SOME symptom was entered",
    },

    # ── E. NATURAL-LANGUAGE VARIATION CASES ─────────────────────────────────
    # Same underlying symptom set, described 3 different ways, expecting the
    # SAME normalized result / candidate list each time.
    {
        "id": "NLVAR-001a", "category": "nl_variation", "variation_group": "fever_phrasing",
        "selected_symptoms": [], "freetext": "I have a fever",
        "expected_disease": None, "difficulty": "Easy",
        "notes": "Variation 1 of 3 — plain word",
    },
    {
        "id": "NLVAR-001b", "category": "nl_variation", "variation_group": "fever_phrasing",
        "selected_symptoms": [], "freetext": "my temperature is very high",
        "expected_disease": None, "difficulty": "Easy",
        "notes": "Variation 2 of 3 — descriptive phrasing",
    },
    {
        "id": "NLVAR-001c", "category": "nl_variation", "variation_group": "fever_phrasing",
        "selected_symptoms": [], "freetext": "I've been feeling feverish since morning",
        "expected_disease": None, "difficulty": "Medium",
        "notes": "Variation 3 of 3 — conversational phrasing with extra words",
    },
    {
        "id": "NLVAR-002a", "category": "nl_variation", "variation_group": "breathing_phrasing",
        "selected_symptoms": [], "freetext": "hard to breathe",
        "expected_disease": None, "difficulty": "Easy", "notes": "Variation 1 of 3",
    },
    {
        "id": "NLVAR-002b", "category": "nl_variation", "variation_group": "breathing_phrasing",
        "selected_symptoms": [], "freetext": "I can't breathe properly when I walk",
        "expected_disease": None, "difficulty": "Medium", "notes": "Variation 2 of 3",
    },
    {
        "id": "NLVAR-002c", "category": "nl_variation", "variation_group": "breathing_phrasing",
        "selected_symptoms": [], "freetext": "shortness of breath, especially at night",
        "expected_disease": None, "difficulty": "Medium", "notes": "Variation 3 of 3",
    },
    {
        "id": "NLVAR-003a", "category": "nl_variation", "variation_group": "joint_pain_phrasing",
        "selected_symptoms": [], "freetext": "joint pain",
        "expected_disease": None, "difficulty": "Easy", "notes": "Variation 1 of 2 — exact stored phrase",
    },
    {
        "id": "NLVAR-003b", "category": "nl_variation", "variation_group": "joint_pain_phrasing",
        "selected_symptoms": [], "freetext": "my joints really hurt",
        "expected_disease": None, "difficulty": "Medium",
        "notes": "Variation 2 of 2 — this exact phrase failed before the pain-pass fix was added; regression check",
    },

    # ── F. UNSUPPORTED-CONDITION CASES ──────────────────────────────────────
    # Symptom combinations suggestive of a real condition OUTSIDE the
    # 38-disease list (e.g. heart attack, AIDS — deliberately excluded per
    # disease_symptoms.py's own documented safety rationale). The system
    # must never invent a name for these outside the 38.
    {
        "id": "UNSUPPORTED-001", "category": "unsupported",
        "selected_symptoms": ["chest_pain", "fast_heart_rate"],
        "freetext": "crushing chest pain radiating to my left arm, sweating heavily",
        "expected_disease": None, "difficulty": "Hard",
        "notes": "Suggestive of a heart attack (deliberately excluded from the 38). "
                 "Correct behavior: return only genuinely-supported candidates (if any legitimately score, "
                 "e.g. GERD/Pneumonia on chest_pain) — MUST NOT invent 'Heart Attack' as a name.",
    },
    {
        "id": "UNSUPPORTED-002", "category": "unsupported",
        "selected_symptoms": [],
        "freetext": "unexplained severe weight loss, recurring infections, night sweats for months",
        "expected_disease": None, "difficulty": "Hard",
        "notes": "Suggestive of an immunocompromising condition (deliberately excluded from the 38 — see "
                 "disease_symptoms.py rationale). Must not invent a name outside the list.",
    },
]

# Quick integrity check — every expected_disease (where not None) must
# actually exist in the real DISEASE_SYMPTOMS keys, otherwise the test
# dataset itself would be invalid.
def _validate_dataset():
    from app.data.disease_symptoms import DISEASE_SYMPTOMS
    valid_names = set(DISEASE_SYMPTOMS.keys())
    bad = [c["id"] for c in TEST_CASES if c["expected_disease"] and c["expected_disease"] not in valid_names]
    if bad:
        raise ValueError(f"Test cases reference expected_disease not in DISEASE_SYMPTOMS: {bad}")

_validate_dataset()
