import re
from typing import List, Optional

from app.routers.symptoms import ALL_SYMPTOMS
from app.data.disease_symptoms import DISEASE_SYMPTOMS

_ALL_SYMPTOMS_SET = set(ALL_SYMPTOMS)

_unknown = {sym for syms in DISEASE_SYMPTOMS.values() for sym in syms if sym not in _ALL_SYMPTOMS_SET}
if _unknown:
    print(f"⚠️ WARNING: DISEASE_SYMPTOMS references unknown symptom keys (typo?): {sorted(_unknown)}")

SYMPTOM_SYNONYMS = {
    "high temperature": "high_fever", "feeling feverish": "high_fever",
    "temperature is high": "high_fever", "temperature is very high": "high_fever", "fever": "high_fever",
    "low grade fever": "mild_fever", "slight fever": "mild_fever",
    "difficulty breathing": "breathlessness", "hard to breathe": "breathlessness",
    "can't breathe properly": "breathlessness", "shortness of breath": "breathlessness",
    "breathless": "breathlessness", "trouble breathing": "breathlessness",
    "stomach ache": "stomach_pain", "tummy pain": "stomach_pain",
    "throwing up": "vomiting", "puking": "vomiting",
    "loose motion": "diarrhoea", "loose motions": "diarrhoea",
    "diarrhea": "diarrhoea", "loose stools": "diarrhoea",
    "head pain": "headache", "pounding headache": "headache",
    "tired": "fatigue", "exhausted": "fatigue", "no energy": "fatigue",
    "low energy": "fatigue", "weak": "muscle_weakness",
    "body pain": "muscle_pain", "body ache": "muscle_pain", "aching body": "muscle_pain",
    "rash": "skin_rash", "itchy skin": "itching", "skin itching": "itching",
    "dizzy": "dizziness", "lightheaded": "dizziness", "light headed": "dizziness",
    "yellow skin": "yellowish_skin", "skin turning yellow": "yellowish_skin",
    "yellow eyes": "yellowing_of_eyes", "eyes turning yellow": "yellowing_of_eyes",
    "dark colored urine": "dark_urine", "urine is dark": "dark_urine",
    "burning while urinating": "burning_micturition", "painful urination": "burning_micturition",
    "burning urination": "burning_micturition",
    "chest tightness": "chest_pain", "tight chest": "chest_pain",
    "racing heart": "fast_heart_rate", "fast heartbeat": "fast_heart_rate",
    "heart racing": "fast_heart_rate", "heart beating fast": "fast_heart_rate",
    "sore throat": "throat_irritation", "throat pain": "throat_irritation",
    "blocked nose": "congestion", "stuffy nose": "congestion", "nose is blocked": "congestion",
    "losing weight": "weight_loss", "lost weight": "weight_loss",
    "gaining weight": "weight_gain", "putting on weight": "weight_gain",
    "not hungry": "loss_of_appetite", "no appetite": "loss_of_appetite",
    "always hungry": "excessive_hunger", "very hungry": "excessive_hunger",
    "frequent urination": "polyuria", "peeing a lot": "polyuria", "urinating often": "polyuria",
    "blurry vision": "blurred_and_distorted_vision", "blurred vision": "blurred_and_distorted_vision",
    "vision is blurry": "blurred_and_distorted_vision",
    "one side of body weak": "weakness_of_one_body_side", "numbness on one side": "weakness_of_one_body_side",
    "slurring words": "slurred_speech", "speech is slurred": "slurred_speech",
    "leg swelling": "swollen_legs", "swollen legs": "swollen_legs", "legs are swollen": "swollen_legs",
    "irritable": "irritability", "feeling irritable": "irritability",
    "anxious": "anxiety", "feeling anxious": "anxiety",
    "restless": "restlessness", "can't sit still": "restlessness",
    "sweating a lot": "sweating", "night sweats": "sweating",
    "cold hands": "cold_hands_and_feets", "cold feet": "cold_hands_and_feets",
    "swollen joints": "swelling_joints", "joints are swollen": "swelling_joints",
    "stiff joints": "movement_stiffness", "joint stiffness": "movement_stiffness",
    "pain while walking": "painful_walking", "hurts to walk": "painful_walking",
    "unsteady on feet": "unsteadiness", "losing balance": "loss_of_balance",
    "spinning sensation": "spinning_movements", "room is spinning": "spinning_movements",
}

_BODY_PART_PAIN_MAP = {
    "joint": "joint_pain", "joints": "joint_pain",
    "knee": "knee_pain", "hip": "hip_joint_pain",
    "back": "back_pain", "neck": "neck_pain",
    "stomach": "stomach_pain", "belly": "belly_pain", "abdomen": "abdominal_pain",
    "chest": "chest_pain", "muscle": "muscle_pain", "muscles": "muscle_pain",
    "head": "headache",
}
_PAIN_WORDS = ["hurt", "hurts", "hurting", "ache", "aches", "aching", "pain", "sore"]


def _pain_pass(text_lower: str) -> set:
    matched = set()
    if any(pw in text_lower for pw in _PAIN_WORDS):
        for part, symptom in _BODY_PART_PAIN_MAP.items():
            if part in text_lower:
                matched.add(symptom)
    return matched


def normalize_freetext(text: Optional[str]) -> List[str]:
    if not text:
        return []
    text_lower = text.lower()
    matched = set()

    for phrase in sorted(SYMPTOM_SYNONYMS, key=len, reverse=True):
        if phrase in text_lower:
            matched.add(SYMPTOM_SYNONYMS[phrase])

    for sym in ALL_SYMPTOMS:
        spaced = sym.replace("_", " ")
        if spaced in text_lower:
            matched.add(sym)

    matched |= _pain_pass(text_lower)

    return sorted(matched)


def score_diseases(
    selected_symptoms: List[str],
    freetext_symptoms: List[str],
    threshold: float = 0.15,
    max_candidates: int = 10,
) -> List[dict]:
    all_input_symptoms = set(selected_symptoms) | set(freetext_symptoms)
    if not all_input_symptoms:
        return []

    scored = []
    for disease, disease_symptoms in DISEASE_SYMPTOMS.items():
        disease_symptom_set = set(disease_symptoms)
        matched = all_input_symptoms & disease_symptom_set
        if not matched:
            continue
        score = len(matched) / len(disease_symptom_set)
        scored.append({
            "name": disease,
            "match_score": round(score, 3),
            "matched_symptoms": sorted(matched),
            "missing_symptoms": sorted(disease_symptom_set - matched),
        })

    scored.sort(key=lambda x: x["match_score"], reverse=True)
    candidates = [c for c in scored if c["match_score"] >= threshold]
    return candidates[:max_candidates]
