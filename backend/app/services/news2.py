"""
NEWS2 — National Early Warning Score 2
Published by the Royal College of Physicians (UK).
Used across NHS England and NHS Scotland to detect patient deterioration.

Simplifications (documented):
- No +2 oxygen therapy modifier (not captured in data model)
- No SpO2 Scale 2 for COPD patients (chronic diagnosis not yet tracked)
"""

from typing import Optional

def compute_news2(
    respiratory_rate: Optional[float] = None,
    spo2: Optional[float] = None,
    temperature: Optional[float] = None,  # in Fahrenheit
    pulse: Optional[float] = None,
    systolic_bp: Optional[float] = None,
) -> dict:
    score = 0
    flags = []
    red_score = False

    # Respiratory rate (breaths/min)
    if respiratory_rate is not None:
        rr = respiratory_rate
        if rr <= 8:
            score += 3; flags.append("RR ≤8: +3 (RED)"); red_score = True
        elif rr <= 11:
            score += 1; flags.append("RR 9-11: +1")
        elif rr <= 20:
            flags.append("RR 12-20: +0")
        elif rr <= 24:
            score += 2; flags.append("RR 21-24: +2")
        else:
            score += 3; flags.append("RR ≥25: +3 (RED)"); red_score = True

    # SpO2 (%)
    if spo2 is not None:
        if spo2 >= 96:
            flags.append("SpO2 ≥96%: +0")
        elif spo2 >= 94:
            score += 1; flags.append("SpO2 94-95%: +1")
        elif spo2 >= 92:
            score += 2; flags.append("SpO2 92-93%: +2")
        else:
            score += 3; flags.append("SpO2 ≤91%: +3 (RED)"); red_score = True

    # Temperature (convert from °F to °C)
    if temperature is not None:
        tc = (temperature - 32) * 5 / 9
        if tc <= 35.0:
            score += 3; flags.append("Temp ≤35°C: +3")
        elif tc <= 36.0:
            score += 1; flags.append("Temp 35.1-36°C: +1")
        elif tc <= 38.0:
            flags.append("Temp 36.1-38°C: +0")
        elif tc <= 39.0:
            score += 1; flags.append("Temp 38.1-39°C: +1")
        else:
            score += 2; flags.append("Temp ≥39.1°C: +2")

    # Pulse (bpm)
    if pulse is not None:
        if pulse <= 40:
            score += 3; flags.append("Pulse ≤40: +3 (RED)"); red_score = True
        elif pulse <= 50:
            score += 1; flags.append("Pulse 41-50: +1")
        elif pulse <= 90:
            flags.append("Pulse 51-90: +0")
        elif pulse <= 110:
            score += 1; flags.append("Pulse 91-110: +1")
        elif pulse <= 130:
            score += 2; flags.append("Pulse 111-130: +2")
        else:
            score += 3; flags.append("Pulse ≥131: +3 (RED)"); red_score = True

    # Systolic BP (mmHg)
    if systolic_bp is not None:
        if systolic_bp <= 90:
            score += 3; flags.append("SBP ≤90: +3 (RED)"); red_score = True
        elif systolic_bp <= 100:
            score += 2; flags.append("SBP 91-100: +2")
        elif systolic_bp <= 110:
            score += 1; flags.append("SBP 101-110: +1")
        elif systolic_bp <= 219:
            flags.append("SBP 111-219: +0")
        else:
            score += 3; flags.append("SBP ≥220: +3")

    # Determine risk and triage
    if score >= 7:
        risk = "HIGH"
        triage = "P1"
    elif score >= 5:
        risk = "MEDIUM"
        triage = "P2"
    elif red_score:
        risk = "LOW-MEDIUM"
        triage = "P3"
    elif score >= 1:
        risk = "LOW-MEDIUM"
        triage = "P3"
    else:
        risk = "LOW"
        triage = "P4"

    # Single red score escalation: minimum P3
    if red_score and triage == "P4":
        triage = "P3"

    risk_score = min(100, score * 14)

    return {
        "score": score,
        "risk": risk,
        "triage": triage,
        "flags": flags,
        "risk_score": risk_score,
        "red_score": red_score,
    }
