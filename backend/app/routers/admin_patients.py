from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from app.db.session import get_db
from app.models.patient import Patient
from app.models.admin import Admin
from app.schemas.admin_patient import AdminPatientCreate, AdminPatientEdit, ArchiveRequest, RestoreRequest, PermanentDeleteRequest
from app.services.audit_service import diff_and_log, log_lifecycle_event
from app.services.admin_activity_service import log_activity
from app.auth_admin import get_current_admin, require_super_admin
from app.services.notification_service import notify_patient, notify_all_admins
from app.services.admin_security import verify_password
from typing import Optional
from sqlalchemy import or_
from app.models.visit import Visit
from app.models.issue import Issue
from app.models.notification import Notification
from app.models.feedback import Feedback
from app.models.mental_health import MentalHealthScreening
from app.models.followup import FollowUp
from app.models.audit_log import AuditLog

router = APIRouter()


def make_patient_id():
    return "PAT-" + uuid.uuid4().hex[:4].upper() + "-" + uuid.uuid4().hex[:4].upper()


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


def patient_out(p: Patient, db: Session = None) -> dict:
    latest_diagnosis = None
    latest_risk_score = None
    latest_triage = None
    removed_by_name = None
    removed_by_id = None
    removal_reason = None
    removed_at = None
    if db is not None:
        latest_visit = (
            db.query(Visit)
            .filter(Visit.patient_id == p.id)
            .order_by(Visit.visit_date.desc())
            .first()
        )
        if latest_visit:
            diseases = latest_visit.predicted_diseases or []
            def _disease_label(d):
                if isinstance(d, dict):
                    return str(d.get("name") or d.get("disease") or d.get("condition") or d)
                return str(d)
            latest_diagnosis = ", ".join(_disease_label(d) for d in diseases) if isinstance(diseases, list) else str(diseases)
            latest_risk_score = latest_visit.risk_score
            latest_triage = latest_visit.triage_level

        # Removal info (Point 4) — only meaningful for currently-archived patients.
        # Pulled from the most recent "archived" lifecycle entry in the audit trail
        # rather than a separate table, since that entry already carries exactly
        # this data (admin, reason, timestamp).
        if getattr(p, "is_archived", 0):
            latest_archive_entry = (
                db.query(AuditLog)
                .filter(
                    AuditLog.patient_id == p.id,
                    AuditLog.edited_column == "__lifecycle__",
                    AuditLog.new_value == "archived",
                )
                .order_by(AuditLog.id.desc())
                .first()
            )
            if latest_archive_entry:
                removed_by_name = latest_archive_entry.admin_name
                removed_by_id = latest_archive_entry.admin_id
                removal_reason = latest_archive_entry.reason
                removed_at = latest_archive_entry.changed_at.isoformat() if latest_archive_entry.changed_at else None
 
    return {
        "id":                      p.id,
        "name":                    p.name,
        "age":                     p.age,
        "gender":                  p.gender,
        "allergies":               p.allergies               or "",
        "known_conditions":        p.known_conditions        or "",
        "current_medications":     p.current_medications     or "",
        "blood_group":             p.blood_group             or "",
        "emergency_contact":       p.emergency_contact       or "",
        "emergency_contact_phone": p.emergency_contact_phone or "",
        "mobile_number":           getattr(p, "mobile_number", "")  or "",
        "date_of_birth":           getattr(p, "date_of_birth", "")  or "",
        "guardian_name":           getattr(p, "guardian_name", "")  or "",
        "guardian_phone":          getattr(p, "guardian_phone", "") or "",
        "preferred_language":      getattr(p, "preferred_language", "en") or "en",
        "is_archived":             bool(getattr(p, "is_archived", 0)),
        "created_at":              p.created_at.isoformat() if p.created_at else None,
        "latest_diagnosis":        latest_diagnosis,
        "latest_risk_score":       latest_risk_score,
        "latest_triage":           latest_triage,
        "removed_by_name":         removed_by_name,
        "removed_by_id":           removed_by_id,
        "removal_reason":          removal_reason,
        "removed_at":              removed_at,
    }


EDITABLE_FIELDS = [
    "name", "age", "gender", "allergies", "known_conditions", "current_medications",
    "blood_group", "emergency_contact", "emergency_contact_phone", "mobile_number",
    "date_of_birth", "guardian_name", "guardian_phone", "preferred_language",
]


@router.get("/", response_model=List[dict])
def list_patients(
    status: str = Query("active", pattern="^(active|archived|all)$"),
    search: Optional[str] = Query(None, description="Search by Patient ID, Name, Mobile, Blood Group, Disease, Risk level, or Registration Date"),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    q = db.query(Patient)
    if status == "active":
        q = q.filter((Patient.is_archived == 0) | (Patient.is_archived.is_(None)))
    elif status == "archived":
        q = q.filter(Patient.is_archived == 1)
 
    if search and search.strip():
        term = f"%{search.strip()}%"
        # Patients whose own fields match directly.
        direct_match_ids = {
            p.id for p in q.filter(
                or_(
                    Patient.id.like(term),
                    Patient.name.like(term),
                    Patient.mobile_number.like(term),
                    Patient.blood_group.like(term),
                )
            ).all()
        }
        # Patients whose latest visit's disease/triage/date matches instead.
        visit_match_ids = {
            v.patient_id for v in db.query(Visit).filter(
                or_(
                    Visit.triage_level.like(term),
                    Visit.visit_date.like(term),
                )
            ).all()
        }
        # predicted_diseases is stored as JSON; match it in Python since it's a list column.
        for v in db.query(Visit).all():
            diseases = v.predicted_diseases or []
            if isinstance(diseases, list) and any(search.strip().lower() in str(d).lower() for d in diseases):
                visit_match_ids.add(v.patient_id)
 
        matched_ids = direct_match_ids | visit_match_ids
        q = q.filter(Patient.id.in_(matched_ids))
 
    patients = q.order_by(Patient.created_at.desc()).all()
    return [patient_out(p, db) for p in patients]


@router.get("/{patient_id}")
def get_patient(patient_id: str, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient_out(patient, db)


@router.post("/")
def create_patient(
    data: AdminPatientCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    patient = Patient(
        id=make_patient_id(),
        name=data.name,
        age=data.age,
        gender=data.gender,
        allergies=data.allergies or "",
        known_conditions=data.known_conditions or "",
        current_medications=data.current_medications or "",
        blood_group=data.blood_group or "",
        emergency_contact=data.emergency_contact or "",
        emergency_contact_phone=data.emergency_contact_phone or "",
        mobile_number=data.mobile_number or "",
        date_of_birth=data.date_of_birth or "",
        guardian_name=data.guardian_name or "",
        guardian_phone=data.guardian_phone or "",
        preferred_language=data.preferred_language or "en",
        consent_given=1 if data.consent_given else 0,
        is_archived=0,
    )
    db.add(patient)
    db.flush()  # get patient.id available before the audit row, though id is already set

    log_lifecycle_event(db, patient.id, admin, "created", data.reason)
    log_activity(
        db, admin, "Added Patient",
        details=f"Registered patient {patient.name} ({patient.id})",
        ip_address=_client_ip(request),
    )
    notify_all_admins(
        db, "new_patient",
        f"New patient {patient.name} ({patient.id}) was registered by {admin.name}.",
        link=f"/admin/patients?q={patient.id}",
    )

    db.commit()
    db.refresh(patient)
    return patient_out(patient, db)


@router.put("/{patient_id}")
def edit_patient(
    patient_id: str,
    data: AdminPatientEdit,
    request: Request,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    before = {f: getattr(patient, f, None) for f in EDITABLE_FIELDS}
    updates = data.model_dump(exclude={"reason"}, exclude_unset=True)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    after = {**before, **updates}
    diff_and_log(db, patient_id, admin, before, after, data.reason)
    log_activity(
        db, admin, "Updated Patient",
        details=f"Updated {', '.join(updates.keys())} for {patient.name} ({patient.id})",
        ip_address=_client_ip(request),
    )

    for field, value in updates.items():
        setattr(patient, field, value)
 
    notify_patient(
        db, patient_id, "patient_updated",
        f"Your record was updated by {admin.name}. Reason: {data.reason}",
        link="/change-history",
    )
 
    db.commit()
    db.refresh(patient)
    return patient_out(patient, db)


@router.post("/{patient_id}/archive")
def archive_patient(
    patient_id: str,
    data: ArchiveRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.is_archived:
        raise HTTPException(status_code=400, detail="Patient is already archived")

    patient.is_archived = 1
    log_lifecycle_event(db, patient_id, admin, "archived", data.reason)
    log_activity(
        db, admin, "Archived Patient",
        details=f"Archived {patient.name} ({patient.id}) — {data.reason}",
        ip_address=_client_ip(request),
    )
    db.commit()
    db.refresh(patient)
    return patient_out(patient, db)


@router.post("/{patient_id}/restore")
def restore_patient(
    patient_id: str,
    data: RestoreRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not patient.is_archived:
        raise HTTPException(status_code=400, detail="Patient is not archived")

    patient.is_archived = 0
    log_lifecycle_event(db, patient_id, admin, "restored", data.reason)
    log_activity(
        db, admin, "Restored Patient",
        details=f"Restored {patient.name} ({patient.id})",
        ip_address=_client_ip(request),
    )
    db.commit()
    db.refresh(patient)
    return patient_out(patient, db)


@router.delete("/{patient_id}")
def permanently_delete_patient(
    patient_id: str,
    data: PermanentDeleteRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_super_admin),
):
    """Point 4: 'Permanently delete if required' — Super Admin only, and only
    on already-archived patients (never delete straight from Active). This
    cascades related records (visits, follow-ups, mental health screenings,
    issues + their responses/notes, notifications, feedback) since Patient
    isn't a strict foreign key elsewhere in this schema and would otherwise
    leave orphaned rows.

    The audit trail is deliberately NOT deleted — the fact that this patient
    existed, was edited, and was ultimately permanently removed (by whom,
    when, why) remains a permanent historical record, even though the
    Patient row itself is gone and won't appear anywhere in the UI anymore.
    """
    if not verify_password(data.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password")

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not patient.is_archived:
        raise HTTPException(status_code=400, detail="Patient must be archived before permanent deletion")

    patient_name = patient.name

    # Log first, before anything is removed.
    log_lifecycle_event(db, patient_id, admin, "permanently_deleted", data.reason)
    log_activity(
        db, admin, "Permanently Deleted Patient",
        details=f"Permanently deleted {patient_name} ({patient_id}) — {data.reason}",
        ip_address=_client_ip(request),
    )
    db.flush()  # make sure the log rows above are written before we start deleting

    # Cascade cleanup — fetch-then-delete for Issues so SQLAlchemy's ORM-level
    # cascade removes their responses/notes too; bulk delete for the rest
    # since none of those have further dependents in this schema.
    visit_ids = [v.id for v in db.query(Visit.id).filter(Visit.patient_id == patient_id).all()]
    if visit_ids:
        db.query(FollowUp).filter(FollowUp.original_visit_id.in_(visit_ids)).delete(synchronize_session=False)
    db.query(Visit).filter(Visit.patient_id == patient_id).delete(synchronize_session=False)
    db.query(MentalHealthScreening).filter(MentalHealthScreening.patient_id == patient_id).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.patient_id == patient_id).delete(synchronize_session=False)
    db.query(Feedback).filter(Feedback.patient_id == patient_id).delete(synchronize_session=False)

    for issue in db.query(Issue).filter(Issue.patient_id == patient_id).all():
        db.delete(issue)

    db.delete(patient)
    db.commit()

    return {"status": "permanently_deleted", "patient_id": patient_id, "patient_name": patient_name}
