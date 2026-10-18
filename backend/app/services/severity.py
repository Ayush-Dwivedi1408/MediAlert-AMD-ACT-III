"""
Emergency Severity Detection Engine
Answers: How dangerous is this patient RIGHT NOW?
Combines NEWS2 vitals scoring with symptom-based red flags.

NOTE on scope: chronic/lifestyle factors (sleep, diet, stress, smoking,
water intake) and recent travel alone are intentionally NOT used here to
escalate acute triage -- they inform the AI's narrative prediction and the
Insights Health Score instead. Acute risk factors (below) are the ones that
plausibly change what a clinician would do RIGHT NOW.
"""

from typing import Optional, List

# Red flag symptoms that escalate severity regardless of vitals
RED_FLAG_SYMPTOMS = {
    "chest_pain": {"level": "CRITICAL", "reason": "Chest pain may indicate cardiac event"},
    "breathlessness": {"level": "HIGH", "reason": "Breathing difficulty detected"},
    "blood_in_sputum": {"level": "HIGH", "reason": "Blood in sputum is a serious warning sign"},
    "altered_sensorium": {"level": "CRITICAL", "reason": "Altered consciousness is a medical emergency"},
    "coma": {"level": "CRITICAL", "reason": "Loss of consciousness — immediate emergency"},
    "slurred_speech": {"level": "CRITICAL", "reason": "Could indicate stroke"},
    "weakness_of_one_body_side": {"level": "CRITICAL", "reason": "Could indicate stroke — call ambulance"},
    "loss_of_balance": {"level": "HIGH", "reason": "Neurological symptom detected"},
    "stomach_bleeding": {"level": "CRITICAL", "reason": "Internal bleeding suspected"},
    "acute_liver_failure": {"level": "CRITICAL", "reason": "Organ failure — emergency care needed"},
    "fast_heart_rate": {"level": "HIGH", "reason": "Rapid heart rate detected"},
    "swelling_of_stomach": {"level": "HIGH", "reason": "Abdominal distension detected"},
    "stiff_neck": {"level": "HIGH", "reason": "Could indicate meningitis"},
    "high_fever": {"level": "HIGH", "reason": "High fever can be dangerous especially in children"},
    "dehydration": {"level": "MEDIUM", "reason": "Dehydration detected"},
    "yellowish_skin": {"level": "HIGH", "reason": "Jaundice detected — liver concern"},
    "yellowing_of_eyes": {"level": "HIGH", "reason": "Jaundice detected — liver concern"},
}

# Vital sign thresholds
VITAL_THRESHOLDS = {
    "spo2": [
        {"max": 90, "level": "CRITICAL", "reason": "Oxygen level critically low (SpO2 < 90%)"},
        {"max": 94, "level": "HIGH", "reason": "Oxygen level low (SpO2 < 94%)"},
        {"max": 96, "level": "MEDIUM", "reason": "Oxygen level slightly low (SpO2 < 96%)"},
    ],
    "pulse": [
        {"min": 130, "level": "CRITICAL", "reason": "Heart rate dangerously high (>130 bpm)"},
        {"max": 40, "level": "CRITICAL", "reason": "Heart rate dangerously low (<40 bpm)"},
        {"min": 110, "level": "HIGH", "reason": "Heart rate elevated (>110 bpm)"},
        {"max": 50, "level": "HIGH", "reason": "Heart rate low (<50 bpm)"},
    ],
    "temperature": {  # Fahrenheit
        "critical_high": {"threshold": 104, "level": "CRITICAL", "reason": "Dangerously high fever (>104°F / 40°C)"},
        "high": {"threshold": 102, "level": "HIGH", "reason": "High fever (>102°F / 38.9°C)"},
        "medium": {"threshold": 100.4, "level": "MEDIUM", "reason": "Fever detected (>100.4°F / 38°C)"},
        "critical_low": {"threshold": 95, "level": "CRITICAL", "reason": "Hypothermia (Body temp <95°F / 35°C)"},
    },
    "respiratory_rate": [
        {"min": 25, "level": "CRITICAL", "reason": "Breathing rate critically high (>25/min)"},
        {"max": 8, "level": "CRITICAL", "reason": "Breathing rate critically low (<8/min)"},
        {"min": 20, "level": "HIGH", "reason": "Breathing rate elevated (>20/min)"},
    ],
}

SEVERITY_ACTIONS = {
    "CRITICAL": {
        "emoji": "🚨",
        "label": "CRITICAL EMERGENCY",
        "action": "Call Ambulance Immediately (102 / 108)",
        "color": "#dc2626",
        "triage": "P1",
        "description": "This is a life-threatening situation. Do not wait. Call emergency services now.",
        "do_not": ["Do not give food or water", "Do not leave patient alone", "Do not wait for symptoms to improve"],
    },
    "HIGH": {
        "emoji": "⚠️",
        "label": "HIGH RISK",
        "action": "Go to Emergency Room Now",
        "color": "#ea580c",
        "triage": "P2",
        "description": "Serious condition requiring urgent medical attention within 1 hour.",
        "do_not": ["Do not drive yourself", "Do not delay seeking care"],
    },
    "MEDIUM": {
        "emoji": "🟡",
        "label": "MODERATE RISK",
        "action": "Visit Doctor Within 24 Hours",
        "color": "#d97706",
        "triage": "P3",
        "description": "Condition needs medical attention but is not immediately life-threatening.",
        "do_not": ["Do not ignore symptoms if they worsen"],
    },
    "LOW": {
        "emoji": "✅",
        "label": "LOW RISK",
        "action": "Home Care — Monitor Symptoms",
        "color": "#16a34a",
        "triage": "P4",
        "description": "Condition can be managed at home. Visit clinic if no improvement in 48 hours.",
        "do_not": [],
    },
}

SEVERITY_RANK = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}


def detect_severity(
    symptoms: List[str],
    spo2: Optional[float] = None,
    pulse: Optional[float] = None,
    temperature: Optional[float] = None,
    respiratory_rate: Optional[float] = None,
    news2_score: Optional[int] = None,
    # NEW — expanded assessment inputs that plausibly affect ACUTE risk
    risk_factors: Optional[List[str]] = None,
    associated_symptoms: Optional[List[str]] = None,
    symptom_severity_score: Optional[int] = None,
    recent_surgery_hospitalization: Optional[str] = None,
    exposure_history: Optional[dict] = None,
) -> dict:
    """
    Main severity detection function.
    Returns full severity assessment with action recommendation.
    """
    triggers = []
    max_severity = "LOW"

    def escalate(level: str, reason: str, source: str):
        nonlocal max_severity
        triggers.append({"level": level, "reason": reason, "source": source})
        if SEVERITY_RANK.get(level, 0) > SEVERITY_RANK.get(max_severity, 0):
            max_severity = level

    def _is_meaningful(val):
        return val and val.strip().lower() not in ("none", "no", "n/a", "na")

    # 1. Check red flag symptoms (primary)
    for symptom in symptoms:
        if symptom in RED_FLAG_SYMPTOMS:
            flag = RED_FLAG_SYMPTOMS[symptom]
            escalate(flag["level"], flag["reason"], f"symptom:{symptom}")

    # 1b. NEW — also check associated (secondary) symptoms against the same red-flag list.
    # Previously only primary symptoms were checked, so a red-flag symptom logged as
    # "associated" instead of "primary" was silently ignored.
    for symptom in (associated_symptoms or []):
        if symptom in RED_FLAG_SYMPTOMS and symptom not in symptoms:
            flag = RED_FLAG_SYMPTOMS[symptom]
            escalate(flag["level"], f"{flag['reason']} (reported as associated symptom)", f"symptom:{symptom}")

    # 2. Check SpO2
    if spo2 is not None:
        for threshold in VITAL_THRESHOLDS["spo2"]:
            if spo2 < threshold["max"]:
                escalate(threshold["level"], threshold["reason"], "vital:spo2")
                break

    # 3. Check pulse
    if pulse is not None:
        for threshold in VITAL_THRESHOLDS["pulse"]:
            if "min" in threshold and pulse >= threshold["min"]:
                escalate(threshold["level"], threshold["reason"], "vital:pulse")
            elif "max" in threshold and pulse <= threshold["max"]:
                escalate(threshold["level"], threshold["reason"], "vital:pulse")

    # 4. Check temperature
    if temperature is not None:
        t = VITAL_THRESHOLDS["temperature"]
        if temperature >= t["critical_high"]["threshold"]:
            escalate(t["critical_high"]["level"], t["critical_high"]["reason"], "vital:temperature")
        elif temperature < t["critical_low"]["threshold"]:
            escalate(t["critical_low"]["level"], t["critical_low"]["reason"], "vital:temperature")
        elif temperature >= t["high"]["threshold"]:
            escalate(t["high"]["level"], t["high"]["reason"], "vital:temperature")
        elif temperature >= t["medium"]["threshold"]:
            escalate(t["medium"]["level"], t["medium"]["reason"], "vital:temperature")

    # 5. Check respiratory rate
    if respiratory_rate is not None:
        for threshold in VITAL_THRESHOLDS["respiratory_rate"]:
            if "min" in threshold and respiratory_rate >= threshold["min"]:
                escalate(threshold["level"], threshold["reason"], "vital:respiratory_rate")
            elif "max" in threshold and respiratory_rate <= threshold["max"]:
                escalate(threshold["level"], threshold["reason"], "vital:respiratory_rate")

    # 6. NEWS2 score override
    if news2_score is not None:
        if news2_score >= 7:
            escalate("CRITICAL", f"NEWS2 score {news2_score} ≥ 7: High clinical risk", "news2")
        elif news2_score >= 5:
            escalate("HIGH", f"NEWS2 score {news2_score} ≥ 5: Medium clinical risk", "news2")

    # 7. NEW — Risk Factors (Obesity, Family History) — previously collected but never used
    for rf in (risk_factors or []):
        if rf == "obesity":
            escalate("MEDIUM", "Obesity increases risk of complications", "context:risk_factor")
        elif rf == "family_history":
            escalate("MEDIUM", "Family history of relevant conditions", "context:risk_factor")

    # 8. NEW — Patient-reported symptom severity (1-10 slider)
    if symptom_severity_score is not None:
        if symptom_severity_score >= 8:
            escalate("HIGH", f"Patient-reported symptom severity is {symptom_severity_score}/10 (severe)", "context:severity_score")
        elif symptom_severity_score >= 6:
            escalate("MEDIUM", f"Patient-reported symptom severity is {symptom_severity_score}/10 (moderate-high)", "context:severity_score")

    # 9. NEW — Recent surgery/hospitalization (postoperative complication risk)
    if _is_meaningful(recent_surgery_hospitalization):
        escalate("MEDIUM", "Recent surgery/hospitalization increases complication risk", "context:medical_history")

    # 10. NEW — Exposure history
    exposure_history = exposure_history or {}
    if _is_meaningful(exposure_history.get("animal_insect_bite")):
        escalate("HIGH", "Animal/insect bite reported — risk of infection or rabies exposure", "context:exposure")
    if _is_meaningful(exposure_history.get("contact_with_sick")):
        escalate("MEDIUM", "Recent contact with a sick individual — possible infectious exposure", "context:exposure")

    action = SEVERITY_ACTIONS[max_severity]
    risk_score = {"CRITICAL": 90, "HIGH": 70, "MEDIUM": 45, "LOW": 20}.get(max_severity, 20)
    if news2_score:
        risk_score = min(100, max(risk_score, news2_score * 14))

    return {
        "severity": max_severity,
        "emoji": action["emoji"],
        "label": action["label"],
        "action": action["action"],
        "color": action["color"],
        "triage": action["triage"],
        "description": action["description"],
        "do_not": action["do_not"],
        "risk_score": risk_score,
        "triggers": triggers,
        "contributing_symptoms": [t for t in triggers if t["source"].startswith("symptom")],
        "contributing_vitals": [t for t in triggers if t["source"].startswith("vital") or t["source"] == "news2"],
        "contributing_context": [t for t in triggers if t["source"].startswith("context")],
    }
