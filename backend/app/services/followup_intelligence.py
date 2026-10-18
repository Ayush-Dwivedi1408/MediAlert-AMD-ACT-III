"""
Follow-Up Intelligence Engine
------------------------------
Turns raw FollowUp rows into the longitudinal-monitoring features:
  1. Change Summary          - what changed since the previous check-in
  2. Symptom Persistence     - how many consecutive check-ins a symptom has lasted
  3. New Symptom Escalation  - flags high-concern new symptoms
  4. Smart Re-Triage Trigger - decides if a full AI re-triage should fire
  5. Clinical Event Timeline - flat, chronological list of notable events
  6. Next Check-in Recommendation + Overdue status (for the UI banner)

No new DB columns are needed beyond the vitals columns added to FollowUp --
everything else is computed on the fly from existing rows.
"""
from datetime import datetime, timedelta
from app.services.news2 import compute_news2

HIGH_CONCERN_SYMPTOMS = {
    "chest_pain", "difficulty_breathing", "breathlessness", "shortness_of_breath",
    "severe_bleeding", "confusion", "seizure", "blue_lips", "unconsciousness",
    "loss_of_consciousness", "slurred_speech", "one_sided_weakness",
    "severe_headache", "blood_in_vomit", "blood_in_stool", "fainting",
}

def _fmt(s):
    return s.replace("_", " ").strip().capitalize()

def _parse_systolic(bp):
    if not bp:
        return None
    try:
        return float(str(bp).split("/")[0])
    except Exception:
        return None

def _try_compute_news2(vitals):
    if not any(vitals.get(k) is not None for k in ("pulse", "spo2", "temperature", "respiratory_rate")):
        return None
    try:
        result = compute_news2(
            respiratory_rate=vitals.get("respiratory_rate"),
            spo2=vitals.get("spo2"),
            temperature=vitals.get("temperature"),
            pulse=vitals.get("pulse"),
            systolic_bp=_parse_systolic(vitals.get("blood_pressure")),
        )
        return result.get("score")
    except Exception:
        return None

def _vitals_delta(prev, curr):
    deltas = []
    checks = [
        ("spo2", "SpO2", "%", 1),
        ("pulse", "Pulse", " bpm", 5),
        ("temperature", "Temperature", "F", 0.5),
        ("respiratory_rate", "Resp. rate", "/min", 2),
    ]
    for key, label, unit, threshold in checks:
        pv, cv = prev.get(key), curr.get(key)
        if pv is None or cv is None:
            continue
        diff = cv - pv
        if abs(diff) < threshold:
            continue
        arrow = "up" if diff > 0 else "down"
        deltas.append(f"{label} {arrow} {pv}{unit} -> {cv}{unit}")
    return deltas

def _build_change_summary(prev_risk, curr_risk, prev_news2, curr_news2, resolved, persisting, new, vitals_delta):
    lines = []
    risk_change = None
    if prev_risk is not None and curr_risk is not None:
        delta = round(curr_risk - prev_risk)
        direction = "down" if delta < 0 else "up" if delta > 0 else "same"
        risk_change = {"from": round(prev_risk), "to": round(curr_risk), "delta": delta, "direction": direction}
        if direction != "same":
            lines.append(f"Risk {'decreased' if direction == 'down' else 'increased'} {round(prev_risk)} -> {round(curr_risk)}")

    news2_change = None
    if prev_news2 is not None and curr_news2 is not None:
        news2_change = {"from": prev_news2, "to": curr_news2, "unchanged": prev_news2 == curr_news2}
        if prev_news2 == curr_news2:
            lines.append(f"NEWS2 unchanged: {curr_news2}")
        else:
            lines.append(f"NEWS2 {'worsened' if curr_news2 > prev_news2 else 'improved'}: {prev_news2} -> {curr_news2}")

    for sym in resolved:
        lines.append(f"{_fmt(sym)} resolved")
    for sym in persisting:
        lines.append(f"{_fmt(sym)} persists")
    for sym in new:
        lines.append(f"New symptom: {_fmt(sym)}")
    lines.extend(vitals_delta)

    return {
        "risk_change": risk_change,
        "news2_change": news2_change,
        "resolved": sorted(resolved),
        "persisting": sorted(persisting),
        "new": sorted(new),
        "vitals_delta": vitals_delta,
        "narrative": ". ".join(lines) + "." if lines else "No significant change since last check-in.",
    }

def _detect_escalation(new_symptoms):
    flags = []
    for sym in new_symptoms:
        if sym in HIGH_CONCERN_SYMPTOMS:
            flags.append({"symptom": sym, "message": f"{_fmt(sym)} was not reported in the initial visit."})
    return flags

def _should_retrigger(risk_delta, news2_before, news2_after, escalation, spo2_before, spo2_after, persisting_count):
    reasons = []
    if risk_delta is not None and risk_delta >= 15:
        reasons.append(f"Risk increased significantly (+{round(risk_delta)})")
    if news2_before is not None and news2_after is not None and news2_after > news2_before:
        reasons.append(f"NEWS2 worsened ({news2_before} -> {news2_after})")
    if escalation:
        for flag in escalation:
            reasons.append(f"New high-concern symptom: {_fmt(flag['symptom'])}")
    if spo2_after is not None and spo2_after < 94:
        reasons.append(f"SpO2 dropped to {spo2_after}%")
    elif spo2_before is not None and spo2_after is not None and (spo2_before - spo2_after) >= 3:
        reasons.append(f"SpO2 declined {spo2_before}% -> {spo2_after}%")
    if persisting_count >= 3:
        reasons.append(f"{persisting_count} symptoms remain unresolved")
    return {"triggered": len(reasons) > 0, "reasons": reasons}

def _recommend_next_checkin(recovery_status, persisting_count, retriage_triggered):
    if retriage_triggered:
        return {"days": 0, "message": "Immediate reassessment recommended", "urgent": True}
    if recovery_status == "WORSENING":
        return {"days": 1, "message": "Condition worsening -- check in again tomorrow", "urgent": True}
    if recovery_status == "IMPROVING" and persisting_count == 0:
        return {"days": 7, "message": "Recovering well -- next check-in in a week", "urgent": False}
    if recovery_status == "IMPROVING":
        return {"days": 5, "message": "Improving, but some symptoms persist -- check in again soon", "urgent": False}
    if recovery_status == "STABLE" and persisting_count > 0:
        return {"days": 3, "message": "Symptoms persist without improvement -- recheck in 3 days", "urgent": False}
    return {"days": 3, "message": "Routine check-in recommended", "urgent": False}

def _compute_overdue(last_date, recommended_days, now=None):
    now = now or datetime.utcnow()
    if not last_date:
        return {"overdue": False, "due_date": None, "overdue_by_days": 0}
    if isinstance(last_date, str):
        try:
            last_date = datetime.fromisoformat(last_date)
        except Exception:
            return {"overdue": False, "due_date": None, "overdue_by_days": 0}
    due_date = last_date + timedelta(days=recommended_days)
    overdue_by = (now - due_date).days
    return {
        "overdue": overdue_by > 0,
        "due_date": due_date.isoformat(),
        "overdue_by_days": max(0, overdue_by),
    }

def _symptom_persistence(symptom_sets):
    if not symptom_sets:
        return {}
    latest = symptom_sets[-1]
    counts = {}
    for sym in latest:
        count = 0
        for s in reversed(symptom_sets):
            if sym in s:
                count += 1
            else:
                break
        counts[sym] = count
    return counts

def build_followup_intelligence(visit, followups):
    """Main orchestrator -- call this from the router."""
    vitals0 = {
        "pulse": visit.pulse, "spo2": visit.spo2, "temperature": visit.temperature,
        "blood_pressure": visit.blood_pressure, "respiratory_rate": visit.respiratory_rate,
    }
    symptom_sets = [set(visit.symptoms or [])]
    states = [{
        "day": 0, "date": visit.visit_date, "risk": visit.risk_score,
        "news2": visit.news2_score, "vitals": vitals0, "symptoms": symptom_sets[0],
    }]

    per_followup = []
    timeline = [{
        "day": 0, "date": visit.visit_date.isoformat() if visit.visit_date else None,
        "label": "Initial assessment",
        "detail": f"Risk {round(visit.risk_score or 0)}/100, Triage {visit.triage_level or '-'}",
    }]

    running_symptoms = set(symptom_sets[0])

    for f in followups:
        prev_state = states[-1]
        resolved = set(f.symptoms_improved or [])
        new = set(f.symptoms_new or [])
        persisting = running_symptoms - resolved
        running_symptoms = persisting | new
        symptom_sets.append(set(running_symptoms))

        curr_vitals = {
            "pulse": f.pulse, "spo2": f.spo2, "temperature": f.temperature,
            "blood_pressure": f.blood_pressure, "respiratory_rate": f.respiratory_rate,
        }
        news2_now = _try_compute_news2(curr_vitals)
        vitals_delta = _vitals_delta(prev_state["vitals"], curr_vitals)

        change_summary = _build_change_summary(
            prev_state["risk"], f.current_risk_score,
            prev_state["news2"], news2_now,
            resolved, persisting, new, vitals_delta,
        )
        escalation = _detect_escalation(new)
        risk_delta = (f.current_risk_score - prev_state["risk"]) if (f.current_risk_score is not None and prev_state["risk"] is not None) else None
        retriage = _should_retrigger(
            risk_delta, prev_state["news2"], news2_now, escalation,
            prev_state["vitals"].get("spo2"), curr_vitals.get("spo2"),
            len(persisting),
        )

        followup_date = f.followup_date.isoformat() if f.followup_date else None
        per_followup.append({
            "followup_id": f.id,
            "day_number": f.day_number,
            "followup_date": followup_date,
            "recovery_status": f.recovery_status,
            "risk": f.current_risk_score,
            "news2": news2_now,
            "vitals": curr_vitals,
            "change_summary": change_summary,
            "escalation": escalation,
            "retriage": retriage,
        })

        for sym in resolved:
            timeline.append({"day": f.day_number, "date": followup_date, "label": f"{_fmt(sym)} resolved", "detail": None})
        if change_summary["risk_change"] and change_summary["risk_change"]["direction"] != "same":
            rc = change_summary["risk_change"]
            timeline.append({"day": f.day_number, "date": followup_date, "label": f"Risk {'decreased' if rc['direction']=='down' else 'increased'} {rc['from']} -> {rc['to']}", "detail": None})
        for sym in new:
            timeline.append({"day": f.day_number, "date": followup_date, "label": f"New symptom: {_fmt(sym)}", "detail": None})
        if retriage["triggered"]:
            timeline.append({"day": f.day_number, "date": followup_date, "label": "AI re-triage triggered", "detail": "; ".join(retriage["reasons"])})

        states.append({
            "day": f.day_number, "date": f.followup_date, "risk": f.current_risk_score,
            "news2": news2_now, "vitals": curr_vitals, "symptoms": running_symptoms,
        })

    persistence = _symptom_persistence(symptom_sets)

    last_followup = followups[-1] if followups else None
    last_state = states[-1]
    next_checkin = _recommend_next_checkin(
        recovery_status=last_followup.recovery_status if last_followup else "STABLE",
        persisting_count=len(last_state["symptoms"]),
        retriage_triggered=per_followup[-1]["retriage"]["triggered"] if per_followup else False,
    )
    overdue = _compute_overdue(last_state["date"], next_checkin["days"])
    if overdue["overdue"]:
        timeline.append({
            "day": (last_followup.day_number if last_followup else 0) + overdue["overdue_by_days"],
            "date": None, "label": "Follow-up overdue",
            "detail": f"{overdue['overdue_by_days']} day(s) past recommended check-in",
        })

    timeline.sort(key=lambda e: e["day"])

    return {
        "visit_id": visit.id,
        "timeline": timeline,
        "symptom_persistence": {_fmt(k): v for k, v in persistence.items()},
        "followups": per_followup,
        "next_checkin": next_checkin,
        "overdue": overdue,
    }
