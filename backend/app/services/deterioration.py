"""
Patient Deterioration Early Warning System
Analyzes risk score trend across visits.
Predicts future risk trajectory.
"""

from typing import List, Optional


def analyze_deterioration(risk_scores: List[float]) -> dict:
    """
    Given list of risk scores across visits (oldest first),
    determine if patient is improving, stable, or deteriorating.
    Predict next risk score.
    """
    if not risk_scores:
        return {"status": "INSUFFICIENT_DATA", "message": "No visit history available"}

    if len(risk_scores) == 1:
        return {
            "status": "INSUFFICIENT_DATA",
            "message": "Need at least 2 visits to detect trend",
            "current_risk": risk_scores[0],
        }

    current = risk_scores[-1]
    previous = risk_scores[-2]
    change = current - previous
    change_pct = (change / previous * 100) if previous > 0 else 0

    # Calculate trend over all visits
    if len(risk_scores) >= 3:
        # Simple linear regression slope
        n = len(risk_scores)
        x_mean = (n - 1) / 2
        y_mean = sum(risk_scores) / n
        numerator = sum((i - x_mean) * (risk_scores[i] - y_mean) for i in range(n))
        denominator = sum((i - x_mean) ** 2 for i in range(n))
        slope = numerator / denominator if denominator != 0 else 0
        predicted_next = max(0, min(100, current + slope))
    else:
        slope = change
        predicted_next = max(0, min(100, current + change * 0.7))

    # Determine status
    if change_pct <= -15 or (len(risk_scores) >= 3 and slope < -3):
        status = "IMPROVING"
        emoji = "📈"
        color = "#16a34a"
        message = f"Risk score decreased by {abs(round(change_pct))}%. Patient is improving."
    elif change_pct >= 20 or (len(risk_scores) >= 3 and slope > 5):
        status = "WORSENING"
        emoji = "📉"
        color = "#dc2626"
        message = f"Risk score increased by {round(change_pct)}%. Patient condition is worsening."
        if predicted_next >= 70:
            message += " High chance of deterioration — recommend urgent review."
    elif abs(change_pct) < 10:
        status = "STABLE"
        emoji = "➡️"
        color = "#d97706"
        message = "Risk score is stable. Continue monitoring."
    else:
        status = "FLUCTUATING"
        emoji = "↕️"
        color = "#7c3aed"
        message = "Risk score is fluctuating. Close monitoring recommended."

    # Alert if predicted next score is in danger zone
    deterioration_alert = None
    if predicted_next >= 70 and current < 70:
        deterioration_alert = {
            "level": "WARNING",
            "message": f"⚠️ Predicted risk in next visit: {round(predicted_next)}/100. Patient may deteriorate significantly.",
        }
    elif predicted_next >= 90:
        deterioration_alert = {
            "level": "CRITICAL",
            "message": f"🚨 Predicted risk in next visit: {round(predicted_next)}/100. Urgent medical review strongly recommended.",
        }

    return {
        "status": status,
        "emoji": emoji,
        "color": color,
        "message": message,
        "current_risk": round(current),
        "previous_risk": round(previous),
        "change": round(change, 1),
        "change_pct": round(change_pct, 1),
        "predicted_next_risk": round(predicted_next),
        "trend_slope": round(slope, 2),
        "total_visits_analyzed": len(risk_scores),
        "deterioration_alert": deterioration_alert,
        "risk_history": [round(r) for r in risk_scores],
    }


def compute_recovery_status(
    original_risk: float,
    current_risk: float,
    original_symptoms: List[str],
    current_symptoms: List[str],
) -> dict:
    """
    For follow-up visits: determine if patient is recovering.
    """
    risk_change = current_risk - original_risk
    symptoms_resolved = [s for s in original_symptoms if s not in current_symptoms]
    symptoms_new = [s for s in current_symptoms if s not in original_symptoms]

    if risk_change <= -20 and len(symptoms_resolved) > len(symptoms_new):
        status = "IMPROVING"
        message = f"{len(symptoms_resolved)} symptoms resolved. Risk score down {abs(round(risk_change))} points."
    elif risk_change >= 15 or len(symptoms_new) > 2:
        status = "WORSENING"
        message = f"{len(symptoms_new)} new symptoms. Risk score up {round(risk_change)} points."
    else:
        status = "STABLE"
        message = "Condition is stable. Continue current treatment."

    return {
        "status": status,
        "message": message,
        "symptoms_resolved": symptoms_resolved,
        "symptoms_new": symptoms_new,
        "risk_change": round(risk_change, 1),
    }
