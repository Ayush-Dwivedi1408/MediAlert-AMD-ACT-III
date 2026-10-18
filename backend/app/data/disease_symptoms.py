"""
Disease → Symptom associations for the 38 supported conditions.

This is the structured "source of truth" the hybrid matching pipeline scores
against — Groq no longer freely judges relevance; it ranks/explains
candidates that THIS data already identified as plausible matches.

IMPORTANT — what this data is and isn't:
Each symptom list was derived from the same clinical reasoning used to build
docs/disease_evidence_mapping.md (matching each disease's classically
associated symptoms against the ALL_SYMPTOMS vocabulary in
routers/symptoms.py). This is standard textbook symptom-disease association,
NOT independently verified against a primary source disease-by-disease in
this session — same "NOT VERIFIED" caveat as disease_evidence_mapping.md
applies here. Treat this as a reasonable starting structure for matching,
not as clinically validated ground truth.

Every symptom key below MUST exist in ALL_SYMPTOMS (routers/symptoms.py) —
this is enforced by a startup check in symptom_matching.py, so a typo here
fails loudly instead of silently never matching.
"""

DISEASE_SYMPTOMS = {
    "Fungal Infection": ["itching", "skin_rash", "nodal_skin_eruptions", "dischromic_patches"],
    "Allergy": ["continuous_sneezing", "itching", "skin_rash", "watering_from_eyes", "chills"],
    "GERD": ["acidity", "indigestion", "stomach_pain", "chest_pain", "cough"],
    "Drug Reaction": ["skin_rash", "itching", "red_spots_over_body", "blister", "high_fever"],
    "Peptic Ulcer Disease": ["abdominal_pain", "indigestion", "loss_of_appetite", "internal_itching", "stomach_pain"],
    "Diabetes": ["fatigue", "weight_loss", "irregular_sugar_level", "excessive_hunger", "increased_appetite", "polyuria", "blurred_and_distorted_vision"],
    "Gastroenteritis": ["vomiting", "diarrhoea", "abdominal_pain", "dehydration", "nausea", "sunken_eyes"],
    "Bronchial Asthma": ["cough", "breathlessness", "fatigue", "family_history", "mucoid_sputum"],
    "Hypertension": ["headache", "dizziness", "chest_pain", "fatigue", "blurred_and_distorted_vision", "loss_of_balance"],
    "Migraine": ["headache", "nausea", "blurred_and_distorted_vision", "visual_disturbances", "dizziness", "irritability"],
    "Cervical Spondylosis": ["neck_pain", "back_pain", "dizziness", "loss_of_balance", "weakness_in_limbs"],
    "Paralysis (Brain Hemorrhage)": ["weakness_of_one_body_side", "altered_sensorium", "slurred_speech", "headache", "vomiting", "loss_of_balance"],
    "Jaundice": ["yellowish_skin", "yellowing_of_eyes", "dark_urine", "itching", "vomiting", "fatigue"],
    "Malaria": ["chills", "high_fever", "sweating", "headache", "nausea", "vomiting", "muscle_pain", "fatigue"],
    "Chicken Pox": ["skin_rash", "itching", "fatigue", "mild_fever", "malaise", "red_spots_over_body", "loss_of_appetite"],
    "Dengue": ["high_fever", "headache", "joint_pain", "skin_rash", "muscle_pain", "pain_behind_the_eyes", "red_spots_over_body", "nausea", "fatigue"],
    "Typhoid": ["high_fever", "headache", "abdominal_pain", "constipation", "diarrhoea", "fatigue", "chills", "belly_pain"],
    "Hepatitis A": ["yellowish_skin", "yellowing_of_eyes", "dark_urine", "nausea", "vomiting", "fatigue", "joint_pain"],
    "Hepatitis B": ["yellowish_skin", "yellowing_of_eyes", "dark_urine", "joint_pain", "fatigue", "receiving_blood_transfusion", "receiving_unsterile_injections"],
    "Hepatitis C": ["yellowish_skin", "yellowing_of_eyes", "dark_urine", "fatigue", "receiving_blood_transfusion", "receiving_unsterile_injections"],
    "Hepatitis D": ["yellowish_skin", "yellowing_of_eyes", "dark_urine", "abdominal_pain", "fatigue"],
    "Hepatitis E": ["yellowish_skin", "yellowing_of_eyes", "dark_urine", "nausea", "abdominal_pain", "fatigue", "joint_pain"],
    "Alcoholic Hepatitis": ["yellowish_skin", "abdominal_pain", "history_of_alcohol_consumption", "swelling_of_stomach", "fluid_overload"],
    "Tuberculosis": ["cough", "blood_in_sputum", "weight_loss", "sweating", "chest_pain", "fatigue", "mild_fever"],
    "Common Cold": ["continuous_sneezing", "chills", "runny_nose", "congestion", "throat_irritation", "cough", "headache"],
    "Pneumonia": ["high_fever", "cough", "breathlessness", "chest_pain", "phlegm", "rusty_sputum", "fast_heart_rate", "sweating", "malaise"],
    "Dimorphic Hemorrhoids (Piles)": ["pain_in_anal_region", "bloody_stool", "irritation_in_anus", "constipation", "pain_during_bowel_movements"],
    "Varicose Veins": ["swollen_blood_vessels", "prominent_veins_on_calf", "swollen_legs", "cramps", "fatigue"],
    "Hypothyroidism": ["fatigue", "weight_gain", "cold_hands_and_feets", "mood_swings", "puffy_face_and_eyes", "enlarged_thyroid", "brittle_nails"],
    "Hyperthyroidism": ["weight_loss", "increased_appetite", "restlessness", "sweating", "fast_heart_rate", "mood_swings"],
    "Hypoglycemia": ["dizziness", "sweating", "palpitations", "fatigue", "blurred_and_distorted_vision", "irritability"],
    "Osteoarthritis": ["joint_pain", "knee_pain", "hip_joint_pain", "swelling_joints", "movement_stiffness", "neck_pain"],
    "Arthritis": ["joint_pain", "muscle_weakness", "stiff_neck", "swelling_joints", "movement_stiffness", "painful_walking"],
    "Vertigo (Paroxysmal Positional Vertigo)": ["dizziness", "loss_of_balance", "spinning_movements", "unsteadiness"],
    "Acne": ["skin_rash", "pus_filled_pimples", "blackheads", "scurring"],
    "Urinary Tract Infection": ["burning_micturition", "bladder_discomfort", "foul_smell_of_urine", "continuous_feel_of_urine"],
    "Psoriasis": ["skin_peeling", "silver_like_dusting", "small_dents_in_nails", "inflammatory_nails", "joint_pain"],
    "Impetigo": ["skin_rash", "high_fever", "blister", "red_sore_around_nose", "yellow_crust_ooze"],
}

# Sanity check: every disease listed here must match CANDIDATE_DISEASES
# exactly (name-for-name), and every symptom must be a real ALL_SYMPTOMS key.
# symptom_matching.py runs this check at import time so a mismatch is caught
# immediately rather than silently producing zero matches later.
