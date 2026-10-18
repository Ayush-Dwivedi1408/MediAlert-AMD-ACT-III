from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.visit import Visit
from app.models.patient import Patient
from app.models.alert import Alert
from app.models.followup import FollowUp
from app.models.mental_health import MentalHealthScreening
from app.services.deterioration import analyze_deterioration, compute_recovery_status
from app.services.prediction import summarize_health_record
from app.services.followup_intelligence import build_followup_intelligence
from app.services.insights import (
    compute_health_score, health_score_label, build_personal_trends,
    build_symptom_progress, build_mental_wellness, build_recommended_actions,
)
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta

router = APIRouter()


# ─── ANALYTICS ────────────────────────────────────────────────────────────────
# These match client.js:  /data/analytics/overview  (router mounted at /data)

@router.get("/analytics/overview")
def get_analytics_overview(db: Session = Depends(get_db)):
    total_patients = db.query(Patient).count()
    total_visits   = db.query(Visit).count()
    critical_cases = db.query(Visit).filter(Visit.triage_level == "P1").count()
    high_risk      = db.query(Visit).filter(Visit.triage_level == "P2").count()
    total_alerts   = db.query(Alert).count()

    triage_dist = {}
    for level in ["P1", "P2", "P3", "P4"]:
        triage_dist[level] = db.query(Visit).filter(Visit.triage_level == level).count()

    avg_risk = db.query(func.avg(Visit.risk_score)).scalar() or 0

    monthly = []
    for i in range(5, -1, -1):
        start = datetime.utcnow() - timedelta(days=30 * (i + 1))
        end   = datetime.utcnow() - timedelta(days=30 * i)
        count = db.query(Visit).filter(Visit.visit_date >= start, Visit.visit_date < end).count()
        monthly.append({"month": start.strftime("%b %Y"), "visits": count})

    all_visits = db.query(Visit).filter(Visit.predicted_diseases.isnot(None)).all()
    disease_counts = {}
    for v in all_visits:
        for d in (v.predicted_diseases or []):
            name = d.get("name", "") if isinstance(d, dict) else ""
            if name:
                disease_counts[name] = disease_counts.get(name, 0) + 1
    top_diseases = sorted(disease_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "summary": {
            "total_patients":  total_patients,
            "total_visits":    total_visits,
            "critical_cases":  critical_cases,
            "high_risk_cases": high_risk,
            "total_alerts":    total_alerts,
            "avg_risk_score":  round(avg_risk, 1),
        },
        "triage_distribution": triage_dist,
        "monthly_visits":      monthly,
        "top_diseases": [{"name": d[0], "count": d[1]} for d in top_diseases],
    }


@router.get("/analytics/risk-distribution")
def get_risk_distribution(db: Session = Depends(get_db)):
    visits  = db.query(Visit).filter(Visit.risk_score.isnot(None)).all()
    buckets = {"0-25": 0, "26-50": 0, "51-75": 0, "76-100": 0}
    for v in visits:
        if   v.risk_score <= 25:  buckets["0-25"]   += 1
        elif v.risk_score <= 50:  buckets["26-50"]  += 1
        elif v.risk_score <= 75:  buckets["51-75"]  += 1
        else:                     buckets["76-100"] += 1
    return {"distribution": buckets}


# ─── FOLLOW-UP ────────────────────────────────────────────────────────────────
# These match client.js:  /data/followup  and  /data/followup/visit/{id}

class FollowUpCreate(BaseModel):
    patient_id: str
    original_visit_id: int
    day_number: int
    current_symptoms: List[str]
    current_risk_score: Optional[float] = None
    notes: Optional[str] = ""
    pulse: Optional[float] = None
    spo2: Optional[float] = None
    temperature: Optional[float] = None
    blood_pressure: Optional[str] = None
    respiratory_rate: Optional[float] = None


@router.post("/followup")
def create_followup(data: FollowUpCreate, db: Session = Depends(get_db)):
    original          = db.query(Visit).filter(Visit.id == data.original_visit_id).first()
    original_symptoms = original.symptoms if original else []
    original_risk     = (original.risk_score or 50) if original else 50

    recovery = compute_recovery_status(
        original_risk=original_risk,
        current_risk=data.current_risk_score or original_risk,
        original_symptoms=original_symptoms,
        current_symptoms=data.current_symptoms,
    )

    followup = FollowUp(
        patient_id=data.patient_id,
        original_visit_id=data.original_visit_id,
        day_number=data.day_number,
        symptoms_improved=recovery["symptoms_resolved"],
        symptoms_worsened=recovery["symptoms_new"],
        symptoms_new=recovery["symptoms_new"],
        current_risk_score=data.current_risk_score,
        notes=data.notes or "",
        recovery_status=recovery["status"],
        pulse=data.pulse,
        spo2=data.spo2,
        temperature=data.temperature,
        blood_pressure=data.blood_pressure,
        respiratory_rate=data.respiratory_rate,
    )
    db.add(followup)
    db.commit()
    db.refresh(followup)

    # Immediate intelligence preview so the UI doesn't need a second round trip
    all_followups = (
        db.query(FollowUp)
        .filter(FollowUp.original_visit_id == data.original_visit_id)
        .order_by(FollowUp.day_number)
        .all()
    )
    intelligence = build_followup_intelligence(original, all_followups) if original else None
    latest_analysis = intelligence["followups"][-1] if intelligence and intelligence["followups"] else None

    return {
        "followup_id":       followup.id,
        "recovery_status":   recovery["status"],
        "recovery_message":  recovery["message"],
        "symptoms_resolved": recovery["symptoms_resolved"],
        "symptoms_new":      recovery["symptoms_new"],
        "day_number":        data.day_number,
        "original_visit_id": data.original_visit_id,
        "change_summary":    latest_analysis["change_summary"] if latest_analysis else None,
        "escalation":        latest_analysis["escalation"] if latest_analysis else [],
        "retriage":          latest_analysis["retriage"] if latest_analysis else {"triggered": False, "reasons": []},
        "next_checkin":      intelligence["next_checkin"] if intelligence else None,
    }


@router.get("/followup/visit/{visit_id}")
def get_followups_for_visit(visit_id: int, db: Session = Depends(get_db)):
    followups = (
        db.query(FollowUp)
        .filter(FollowUp.original_visit_id == visit_id)
        .order_by(FollowUp.day_number)
        .all()
    )
    return {"followups": [
        {
            "id":                 f.id,
            "day_number":         f.day_number,
            "recovery_status":    f.recovery_status,
            "symptoms_improved":  f.symptoms_improved or [],
            "symptoms_worsened":  f.symptoms_worsened or [],
            "symptoms_new":       f.symptoms_new or [],
            "current_risk_score": f.current_risk_score,
            "notes":              f.notes or "",
            "followup_date":      f.followup_date.isoformat() if f.followup_date else None,
            "pulse":              f.pulse,
            "spo2":               f.spo2,
            "temperature":        f.temperature,
            "blood_pressure":     f.blood_pressure,
            "respiratory_rate":   f.respiratory_rate,
        }
        for f in followups
    ]}


@router.get("/followup/visit/{visit_id}/intelligence")
def get_followup_intelligence(visit_id: int, db: Session = Depends(get_db)):
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    followups = (
        db.query(FollowUp)
        .filter(FollowUp.original_visit_id == visit_id)
        .order_by(FollowUp.day_number)
        .all()
    )
    return build_followup_intelligence(visit, followups)


@router.get("/deterioration/{patient_id}")
def get_deterioration(patient_id: str, db: Session = Depends(get_db)):
    visits = (
        db.query(Visit)
        .filter(Visit.patient_id == patient_id, Visit.risk_score.isnot(None))
        .order_by(Visit.visit_date)
        .all()
    )
    risk_scores = [v.risk_score for v in visits]
    return analyze_deterioration(risk_scores)


# ─── INSIGHTS ─────────────────────────────────────────────────────────────────
# Aggregates everything the new patient-facing Insights page needs into one
# call: AI Clinical Summary, Health Score, Recovery Timeline (moved from
# History), Personal Health Trends, Symptom Progress, Mental Wellness proxy,
# Visit Statistics, and Follow-up Tracker with recomputed recommended actions.

@router.get("/insights/{patient_id}")
async def get_insights(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    visits = db.query(Visit).filter(Visit.patient_id == patient_id).order_by(Visit.visit_date.asc()).all()
    if not visits:
        return {"has_data": False}

    # Follow-ups per visit, ORM objects kept for date math, dicts for computation
    followups_orm = {}
    followups_by_visit = {}
    for v in visits:
        fups = db.query(FollowUp).filter(FollowUp.original_visit_id == v.id).order_by(FollowUp.day_number).all()
        followups_orm[v.id] = fups
        followups_by_visit[v.id] = [
            {
                "day_number": f.day_number,
                "recovery_status": f.recovery_status,
                "current_risk_score": f.current_risk_score,
                "symptoms_improved": f.symptoms_improved or [],
                "symptoms_worsened": f.symptoms_worsened or [],
                "followup_date": f.followup_date.isoformat() if f.followup_date else None,
                "pulse": f.pulse, "spo2": f.spo2, "temperature": f.temperature,
            }
            for f in fups
        ]

    # ── Recovery Timeline (moved here from History) ──────────────────────────
    timeline_points = []
    for i, v in enumerate(visits):
        timeline_points.append({
            "label": f"V{i+1}",
            "risk": v.risk_score, "news2": v.news2_score,
            "spo2": v.spo2, "pulse": v.pulse, "temperature": v.temperature,
            "symptom_count": len(v.symptoms or []),
            "date": v.visit_date.isoformat() if v.visit_date else None,
        })
        for fu in followups_by_visit.get(v.id, []):
            timeline_points.append({
                "label": f"V{i+1} Day {fu['day_number']}",
                "risk": fu["current_risk_score"], "news2": None,
                "spo2": fu["spo2"], "pulse": fu["pulse"], "temperature": fu["temperature"],
                "symptom_count": None,
                "date": fu["followup_date"],
            })
    timeline_points = [p for p in timeline_points if p["date"]]
    timeline_points.sort(key=lambda p: p["date"])

    # ── Health Score ───────────────────────────────────────────────────────
    risk_scores  = [v.risk_score for v in visits if v.risk_score is not None]
    latest_visit = visits[-1]
    latest_fus   = followups_by_visit.get(latest_visit.id, [])

    resolution_ratio = None
    if latest_fus:
        last_fu = latest_fus[-1]
        total_orig = len(latest_visit.symptoms or []) or 1
        resolution_ratio = len(last_fu["symptoms_improved"]) / total_orig

    health_score = compute_health_score(risk_scores, resolution_ratio)
    prev_score   = compute_health_score(risk_scores[:-1], None) if len(risk_scores) >= 2 else None
    delta        = (health_score - prev_score) if (health_score is not None and prev_score is not None) else None

    # ── Personal Trends ────────────────────────────────────────────────────
    trends = build_personal_trends(timeline_points)

    # ── Symptom Progress (based on latest visit + its follow-ups) ────────────
    intelligence = build_followup_intelligence(latest_visit, followups_orm.get(latest_visit.id, []))
    persistence  = (intelligence or {}).get("symptom_persistence", {})
    symptom_progress = build_symptom_progress(latest_visit.symptoms or [], latest_fus, persistence)

    # ── Mental Wellness (proxy from PHQ-9/GAD-7 + latest lifestyle.sleep_quality) ─
    latest_phq9 = (
        db.query(MentalHealthScreening)
        .filter(MentalHealthScreening.patient_id == patient_id, MentalHealthScreening.screening_type == "PHQ9")
        .order_by(MentalHealthScreening.screened_at.desc()).first()
    )
    latest_gad7 = (
        db.query(MentalHealthScreening)
        .filter(MentalHealthScreening.patient_id == patient_id, MentalHealthScreening.screening_type == "GAD7")
        .order_by(MentalHealthScreening.screened_at.desc()).first()
    )
    def _mh(row):
        return {"screening_type": row.screening_type, "total_score": row.total_score, "severity": row.severity} if row else None

    mental_wellness = build_mental_wellness(_mh(latest_phq9), _mh(latest_gad7), getattr(latest_visit, "lifestyle", None))

    # ── Visit Statistics ───────────────────────────────────────────────────
    visit_stats = {
        "total_assessments": len(visits),
        "avg_risk_score": round(sum(risk_scores) / len(risk_scores), 1) if risk_scores else None,
        "highest_risk": round(max(risk_scores), 1) if risk_scores else None,
    }

    # ── Follow-up Tracker ──────────────────────────────────────────────────
    completed_followups = sum(len(v) for v in followups_by_visit.values())
    next_checkin = (intelligence or {}).get("next_checkin")

    next_visit_date = None
    if next_checkin and isinstance(next_checkin, dict) and "days" in next_checkin:
        last_event_date = followups_orm[latest_visit.id][-1].followup_date if followups_orm.get(latest_visit.id) else latest_visit.visit_date
        if last_event_date:
            next_visit_date = (last_event_date + timedelta(days=next_checkin["days"])).isoformat()

    recommended_actions = build_recommended_actions({
        "symptoms": latest_visit.symptoms or [],
        "spo2": latest_visit.spo2, "pulse": latest_visit.pulse,
        "temperature": latest_visit.temperature, "respiratory_rate": latest_visit.respiratory_rate,
        "news2_score": latest_visit.news2_score,
        "risk_factors": getattr(latest_visit, "risk_factors", None),
        "associated_symptoms": getattr(latest_visit, "associated_symptoms", None),
        "symptom_severity_score": getattr(latest_visit, "symptom_severity_score", None),
        "recent_surgery_hospitalization": getattr(latest_visit, "recent_surgery_hospitalization", None),
        "exposure_history": getattr(latest_visit, "exposure_history", None),
    })

    # ── AI Clinical Summary ────────────────────────────────────────────────
    visit_dicts = [
        {
            "visit_date": str(v.visit_date), "risk_score": v.risk_score,
            "triage_level": v.triage_level, "symptoms": v.symptoms or [],
            "predicted_diseases": v.predicted_diseases or [],
            "spo2": v.spo2, "pulse": v.pulse, "temperature": v.temperature,
            "blood_pressure": v.blood_pressure, "respiratory_rate": v.respiratory_rate,
            "news2_score": v.news2_score,
        }
        for v in visits
    ]
    patient_data = {
        "blood_group": patient.blood_group or "", "allergies": patient.allergies or "None",
        "known_conditions": patient.known_conditions or "None", "current_medications": patient.current_medications or "None",
    }
    mh_screenings = [
        {"screening_type": mh.screening_type, "total_score": mh.total_score, "severity": mh.severity,
         "screened_at": mh.screened_at.isoformat() if mh.screened_at else None, "crisis_flag": bool(mh.crisis_flag)}
        for mh in db.query(MentalHealthScreening).filter(MentalHealthScreening.patient_id == patient_id)
            .order_by(MentalHealthScreening.screened_at.desc()).all()
    ]
    ai_summary = await summarize_health_record(
        visits=visit_dicts, patient_name=patient.name, patient_data=patient_data,
        followups_by_visit={v.id: followups_by_visit[v.id] for v in visits},
        mental_health_screenings=mh_screenings,
    )

    return {
        "has_data": True,
        "ai_clinical_summary": ai_summary,
        "health_score": {"score": health_score, "label": health_score_label(health_score), "delta": delta},
        "recovery_timeline": timeline_points,
        "personal_trends": trends,
        "symptom_progress": symptom_progress,
        "mental_wellness": mental_wellness,
        "visit_stats": visit_stats,
        "followup_tracker": {
            "completed": completed_followups,
            "pending": 1 if next_checkin else 0,
            "next_visit_date": next_visit_date,
            "recommended_actions": recommended_actions,
        },
    }
