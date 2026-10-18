"""
Insights computation service.

IMPORTANT: `health_score` below is a composite wellness indicator invented for
the Insights dashboard. It is NOT a validated clinical score (unlike NEWS2).
Formula: 100 - latest_risk_score, adjusted for trend direction and recent
symptom resolution, clamped 0-100. Documented here so it's never mistaken
for a clinically validated metric downstream.
"""
from typing import List, Optional
from app.services.deterioration import analyze_deterioration
from app.services.severity import detect_severity

MENTAL_SCORE_MAX = {"PHQ9": 27, "GAD7": 21}


def compute_health_score(risk_scores_up_to_now: List[float], symptom_resolution_ratio: Optional[float] = None) -> Optional[int]:
    """Composite wellness score (0-100) — see module docstring."""
    if not risk_scores_up_to_now:
        return None
    latest_risk = risk_scores_up_to_now[-1]
    score = 100 - latest_risk

    if len(risk_scores_up_to_now) >= 2:
        det = analyze_deterioration(risk_scores_up_to_now)
        trend = (det or {}).get("trend", "")
        if trend == "IMPROVING":
            score += 8
        elif trend == "WORSENING":
            score -= 8

    if symptom_resolution_ratio is not None:
        score += round(symptom_resolution_ratio * 10)

    return max(0, min(100, round(score)))


def compute_health_score_series(visit_risk_scores: List[float], resolution_ratios: List[Optional[float]]) -> List[Optional[int]]:
    """Health score at each point in time, using only data available up to that point."""
    series = []
    for i in range(len(visit_risk_scores)):
        ratio = resolution_ratios[i] if i < len(resolution_ratios) else None
        series.append(compute_health_score(visit_risk_scores[: i + 1], ratio))
    return series


def health_score_label(score: Optional[int]) -> str:
    if score is None: return "No data"
    if score >= 85: return "Excellent"
    if score >= 70: return "Good"
    if score >= 50: return "Fair"
    return "Needs attention"


def build_personal_trends(timeline_points: List[dict]) -> List[dict]:
    """
    timeline_points: chronological list of {risk, spo2, temperature, pulse, symptom_count}
    Compares the latest point to the previous one for each metric.
    "Good" direction differs per metric (e.g. SpO2 up = good, risk down = good).
    """
    if len(timeline_points) < 2:
        return []

    latest, prev = timeline_points[-1], timeline_points[-2]

    def trend(key, lower_is_better=True):
        a, b = prev.get(key), latest.get(key)
        if a is None or b is None:
            return None
        diff = b - a
        if abs(diff) < 0.01:
            return {"direction": "flat", "arrow": "→", "label": "Stable" if lower_is_better else "Stable"}
        improved = (diff < 0) if lower_is_better else (diff > 0)
        return {
            "direction": "down" if diff < 0 else "up",
            "arrow": "↓" if diff < 0 else "↑",
            "label": "Improving" if improved else "Worsening",
        }

    metrics = [
        ("Risk Score", "risk", True),
        ("SpO2", "spo2", False),
        ("Temperature", "temperature", True),
        ("Pulse", "pulse", True),
        ("Symptom Count", "symptom_count", True),
    ]
    out = []
    for label, key, lower_better in metrics:
        t = trend(key, lower_better)
        if t:
            out.append({"metric": label, **t})
    return out


def build_symptom_progress(latest_visit_symptoms: List[str], latest_followups: List[dict], persistence: dict) -> List[dict]:
    """
    Status per symptom from the latest visit, using its follow-up history.
    No follow-ups yet -> 'Reported' (baseline, not yet reassessed).
    """
    if not latest_visit_symptoms:
        return []

    if not latest_followups:
        return [{"symptom": s.replace("_", " "), "status": "Reported", "icon": "🆕"} for s in latest_visit_symptoms]

    most_recent = latest_followups[-1]
    resolved_ever = set()
    for fu in latest_followups:
        resolved_ever.update(fu.get("symptoms_improved", []) or [])

    out = []
    for sym in latest_visit_symptoms:
        label = sym.replace("_", " ")
        persist_count = persistence.get(sym, 0)
        if sym in resolved_ever:
            out.append({"symptom": label, "status": "Resolved", "icon": "✔"})
        elif persist_count >= 3:
            out.append({"symptom": label, "status": "Same", "icon": "➡"})
        elif persist_count >= 1:
            out.append({"symptom": label, "status": "Mild", "icon": "⬇"})
        else:
            out.append({"symptom": label, "status": "Improved", "icon": "⬇"})
    return out


def build_mental_wellness(latest_phq9: Optional[dict], latest_gad7: Optional[dict], latest_visit_lifestyle: Optional[dict]) -> dict:
    """
    Real data only where available: sleep from the latest assessment's lifestyle
    field, stress/mood as proxies from GAD-7/PHQ-9 severity (not fabricated numbers).
    """
    if not latest_phq9 and not latest_gad7:
        return {"has_data": False}

    def score_pct(mh):
        if not mh: return None
        max_score = MENTAL_SCORE_MAX.get(mh["screening_type"], 27)
        return round(100 - (mh["total_score"] / max_score) * 100)

    phq_pct = score_pct(latest_phq9)
    gad_pct = score_pct(latest_gad7)
    combined = [p for p in [phq_pct, gad_pct] if p is not None]
    overall = round(sum(combined) / len(combined)) if combined else None

    return {
        "has_data": True,
        "score": overall,
        "mood": (latest_phq9 or {}).get("severity"),        # proxy from PHQ-9
        "stress": (latest_gad7 or {}).get("severity"),       # proxy from GAD-7
        "sleep": (latest_visit_lifestyle or {}).get("sleep_quality"),  # real data, if collected
    }


def build_recommended_actions(latest_visit: dict) -> List[str]:
    """Recompute guidance from stored vitals/symptoms (severity.py is pure/deterministic, no AI call)."""
    if not latest_visit:
        return []
    result = detect_severity(
        symptoms=latest_visit.get("symptoms") or [],
        spo2=latest_visit.get("spo2"),
        pulse=latest_visit.get("pulse"),
        temperature=latest_visit.get("temperature"),
        respiratory_rate=latest_visit.get("respiratory_rate"),
        news2_score=latest_visit.get("news2_score"),
        risk_factors=latest_visit.get("risk_factors"),
        associated_symptoms=latest_visit.get("associated_symptoms"),
        symptom_severity_score=latest_visit.get("symptom_severity_score"),
        recent_surgery_hospitalization=latest_visit.get("recent_surgery_hospitalization"),
        exposure_history=latest_visit.get("exposure_history"),
    )
    actions = [result["action"]]
    actions += [f"Avoid: {d}" for d in result.get("do_not", [])]
    actions.append("Continue monitoring vitals and symptoms")
    if result.get("severity") in ("CRITICAL", "HIGH"):
        actions.append(f"Seek medical help if condition worsens (Triage {result['triage']})")
    return actions
