from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from collections import Counter

from app.db.session import get_db
from app.models.patient import Patient
from app.models.visit import Visit
from app.models.admin import Admin
from app.models.admin_activity import AdminActivityLog
from app.auth_admin import get_current_admin
from app.models.feedback import Feedback
from app.services.issue_service import PENDING, UNDER_REVIEW, WAITING_FEEDBACK, CLOSED, REOPENED, REJECTED

router = APIRouter()

AGE_BUCKETS = [
    (0, 17, "0-17"),
    (18, 30, "18-30"),
    (31, 45, "31-45"),
    (46, 60, "46-60"),
    (61, 999, "60+"),
]


def _disease_label(d):
    if isinstance(d, dict):
        return str(d.get("name") or d.get("disease") or d.get("condition") or d)
    return str(d)


@router.get("/overview")
def get_dashboard_overview(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    total_patients = db.query(Patient).count()
    archived_patients = db.query(Patient).filter(Patient.is_archived == 1).count()
    active_patients = total_patients - archived_patients

    today = datetime.utcnow().date()
    today_registrations = (
        db.query(Patient)
        .filter(func.date(Patient.created_at) == today.isoformat())
        .count()
    )

    # "Critical" = active patient whose most recent visit was triaged P1.
    latest_visit_subq = (
        db.query(Visit.patient_id, func.max(Visit.visit_date).label("max_date"))
        .group_by(Visit.patient_id)
        .subquery()
    )
    critical_patients = (
        db.query(Visit)
        .join(
            latest_visit_subq,
            (Visit.patient_id == latest_visit_subq.c.patient_id)
            & (Visit.visit_date == latest_visit_subq.c.max_date),
        )
        .join(Patient, Patient.id == Visit.patient_id)
        .filter(Visit.triage_level == "P1", Patient.is_archived == 0)
        .count()
    )

    # "Total Emergency Cases" (Point 2 spec) — cumulative P1 visits, all-time,
    # regardless of current patient status. Distinct from critical_patients
    # above, which is a live snapshot of currently-critical active patients.
    total_emergency_cases = db.query(Visit).filter(Visit.triage_level == "P1").count()

    # ── Monthly trends: registrations per month, last 6 months ──────────────
    six_months_ago = (today.replace(day=1) - timedelta(days=150)).replace(day=1)
    rows = (
        db.query(
            func.strftime("%Y-%m", Patient.created_at).label("month"),
            func.count(Patient.id).label("count"),
        )
        .filter(Patient.created_at >= six_months_ago.isoformat())
        .group_by("month")
        .order_by("month")
        .all()
    )
    monthly_trends = [{"month": r.month, "registrations": r.count} for r in rows]

    # ── Risk distribution (bar chart): most recent triage level per active patient ──
    triage_rows = (
        db.query(Visit.triage_level, func.count(Visit.id).label("count"))
        .join(
            latest_visit_subq,
            (Visit.patient_id == latest_visit_subq.c.patient_id)
            & (Visit.visit_date == latest_visit_subq.c.max_date),
        )
        .join(Patient, Patient.id == Visit.patient_id)
        .filter(Patient.is_archived == 0, Visit.triage_level.isnot(None))
        .group_by(Visit.triage_level)
        .all()
    )
    risk_distribution = [{"level": r.triage_level, "count": r.count} for r in triage_rows]

    # ── Gender distribution (pie) — all registered patients, active + archived ──
    gender_rows = (
        db.query(Patient.gender, func.count(Patient.id).label("count"))
        .filter(Patient.gender.isnot(None), Patient.gender != "")
        .group_by(Patient.gender)
        .all()
    )
    gender_distribution = [{"gender": r.gender, "count": r.count} for r in gender_rows]

    # ── Age group distribution (bar) ─────────────────────────────────────────
    age_rows = db.query(Patient.age).filter(Patient.age.isnot(None)).all()
    age_bucket_counts = {label: 0 for _, _, label in AGE_BUCKETS}
    for (age,) in age_rows:
        for lo, hi, label in AGE_BUCKETS:
            if lo <= age <= hi:
                age_bucket_counts[label] += 1
                break
    age_distribution = [{"group": label, "count": age_bucket_counts[label]} for _, _, label in AGE_BUCKETS]

    # ── Blood group distribution (pie) ───────────────────────────────────────
    bg_rows = (
        db.query(Patient.blood_group, func.count(Patient.id).label("count"))
        .filter(Patient.blood_group.isnot(None), Patient.blood_group != "")
        .group_by(Patient.blood_group)
        .all()
    )
    blood_group_distribution = [{"group": r.blood_group, "count": r.count} for r in bg_rows]

    # ── Disease distribution (horizontal bar, top 8) ─────────────────────────
    disease_counter = Counter()
    for v in db.query(Visit.predicted_diseases).all():
        diseases = v[0] or []
        if isinstance(diseases, list):
            for d in diseases:
                disease_counter[_disease_label(d)] += 1
    disease_distribution = [
        {"disease": name, "count": count}
        for name, count in disease_counter.most_common(8)
    ]

    # ── Admin activity (bar, last 14 days) ───────────────────────────────────
    fourteen_days_ago = datetime.utcnow() - timedelta(days=14)
    activity_rows = (
        db.query(
            func.strftime("%Y-%m-%d", AdminActivityLog.created_at).label("day"),
            func.count(AdminActivityLog.id).label("count"),
        )
        .filter(AdminActivityLog.created_at >= fourteen_days_ago)
        .group_by("day")
        .order_by("day")
        .all()
    )
    admin_activity_trend = [{"day": r.day, "count": r.count} for r in activity_rows]

    # ── Today's activity summary (replaces the old raw audit-log list) ──────
    today_start = datetime.combine(today, datetime.min.time())
    today_logs = (
        db.query(AdminActivityLog)
        .filter(AdminActivityLog.created_at >= today_start)
        .all()
    )
    patient_update_actions = {"Added Patient", "Updated Patient", "Archived Patient", "Restored Patient"}
    activity_today = {
        "total": len(today_logs),
        "patient_updates": sum(1 for a in today_logs if a.action in patient_update_actions),
        "issues_resolved": sum(1 for a in today_logs if a.action == "Resolved Issue"),
        "logins": sum(1 for a in today_logs if a.action == "Login"),
    }

    from app.models.issue import Issue

    open_statuses = [PENDING, UNDER_REVIEW, REOPENED]
    resolved_statuses = [WAITING_FEEDBACK, CLOSED, REJECTED]

    open_issues = db.query(Issue).filter(Issue.status.in_(open_statuses)).count()
    resolved_issues = db.query(Issue).filter(Issue.status.in_(resolved_statuses)).count()

    issue_total = open_issues + resolved_issues
    issue_resolution_rate = round((resolved_issues / issue_total) * 100, 1) if issue_total else None

    resolved_with_times = db.query(Issue).filter(Issue.status.in_(resolved_statuses)).all()
    if resolved_with_times:
        total_hours = sum(
            (i.updated_at - i.created_at).total_seconds() / 3600
            for i in resolved_with_times
            if i.updated_at and i.created_at
        )
        avg_resolution_time_hours = round(total_hours / len(resolved_with_times), 1)
    else:
        avg_resolution_time_hours = None

    feedback_total = db.query(Feedback).count()
    if feedback_total > 0:
        avg_rating = db.query(func.avg(Feedback.overall_rating)).scalar()
        recommend_count = db.query(Feedback).filter(Feedback.would_recommend == 1).count()
        patient_satisfaction = round(avg_rating, 1) if avg_rating else None
        feedback_score = round((recommend_count / feedback_total) * 100, 1)
    else:
        patient_satisfaction = None
        feedback_score = None

    # ── Feedback rating distribution (bar, 1-5 stars) ────────────────────────
    rating_rows = (
        db.query(Feedback.overall_rating, func.count(Feedback.id).label("count"))
        .filter(Feedback.overall_rating.isnot(None))
        .group_by(Feedback.overall_rating)
        .all()
    )
    rating_counts = {r.overall_rating: r.count for r in rating_rows}
    feedback_rating_distribution = [
        {"rating": n, "count": rating_counts.get(n, 0)} for n in range(1, 6)
    ]

    return {
        "kpis": {
            "total_patients": total_patients,
            "active_patients": active_patients,
            "critical_patients": critical_patients,
            "archived_patients": archived_patients,
            "total_emergency_cases": total_emergency_cases,
            "today_registrations": today_registrations,
            "open_issues": open_issues,
            "resolved_issues": resolved_issues,
            "issue_resolution_rate": issue_resolution_rate,
            "avg_resolution_time_hours": avg_resolution_time_hours,
            "patient_satisfaction": patient_satisfaction,
            "feedback_score": feedback_score,
        },
        "monthly_trends": monthly_trends,
        "risk_distribution": risk_distribution,
        "gender_distribution": gender_distribution,
        "age_distribution": age_distribution,
        "blood_group_distribution": blood_group_distribution,
        "disease_distribution": disease_distribution,
        "admin_activity_trend": admin_activity_trend,
        "feedback_rating_distribution": feedback_rating_distribution,
        "activity_today": activity_today,
    }
