from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.session import get_db
from app.models.patient import Patient
from app.models.visit import Visit
from app.services.health_card import generate_health_card
from app.services.deterioration import analyze_deterioration
from app.services.alerts import get_unread_count
from app.services.prediction import summarize_health_record
from app.services.notification_service import notify_all_admins
from app.services.admin_security import hash_password, verify_password
from app.services.emergency_alert_service import send_emergency_alert
from app.services.emergency_log_service import log_emergency_notification
from app.models.patient_otp import PatientOTP
from app.schemas.patient import (
    PatientCreate, PatientOut, PatientSummary,
    PinSetRequest, PinVerifyRequest, OTPRequest, OTPVerifyRequest, ResetPinRequest,
)
from typing import List
import uuid
import re
import random
from datetime import datetime, timedelta

router = APIRouter()


def make_patient_id():
    return "PAT-" + uuid.uuid4().hex[:4].upper() + "-" + uuid.uuid4().hex[:4].upper()


# ── Forgot Patient ID ─────────────────────────────────────────────────────
class PatientIdLookup(BaseModel):
    name: str
    mobile_number: str
    date_of_birth: str


@router.post("/lookup-id")
def lookup_patient_id(data: PatientIdLookup, db: Session = Depends(get_db)):
    """Find a patient's ID from Name + Mobile Number + Date of Birth.
    Used by the 'Forgot Patient ID' flow on the login page. Matching is
    case-insensitive on name, digit-only on mobile (so '+91 98765 43210' vs
    '9876543210' still matches), and exact on date of birth. Errors are
    intentionally generic so this endpoint can't be used to enumerate
    valid patients field-by-field."""
    name_norm = (data.name or "").strip().lower()
    dob_norm = (data.date_of_birth or "").strip()
    mobile_digits = re.sub(r"\D", "", data.mobile_number or "")

    if not name_norm or not dob_norm or not mobile_digits:
        raise HTTPException(status_code=400, detail="Name, mobile number, and date of birth are all required")

    candidates = db.query(Patient).filter(Patient.date_of_birth == dob_norm).all()
    for p in candidates:
        stored_name = (p.name or "").strip().lower()
        stored_digits = re.sub(r"\D", "", p.mobile_number or "")
        if not stored_digits:
            continue
        mobile_matches = (
            stored_digits == mobile_digits
            or stored_digits.endswith(mobile_digits)
            or mobile_digits.endswith(stored_digits)
        )
        if stored_name == name_norm and mobile_matches:
            return {"id": p.id, "name": p.name}

    raise HTTPException(
        status_code=404,
        detail="No matching patient record found. Please check your details and try again.",
    )


# ── PIN & OTP login (Point 14 — patient account security) ──────────────────
OTP_EXPIRY_MINUTES = 5
OTP_WINDOW_MINUTES = 10
OTP_MAX_REQUESTS_PER_WINDOW = 3
OTP_MAX_VERIFY_ATTEMPTS = 5


def _generate_otp_code() -> str:
    return f"{random.randint(0, 999999):06d}"


PIN_MAX_FAILED_ATTEMPTS = 5
PIN_LOCKOUT_MINUTES = 3


@router.post("/{patient_id}/verify-pin")
def verify_pin(patient_id: str, data: PinVerifyRequest, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not patient.pin_hash:
        raise HTTPException(
            status_code=400,
            detail="No PIN set for this account. Please log in with OTP, then set a PIN from your dashboard.",
        )

    if patient.pin_locked_until and patient.pin_locked_until > datetime.utcnow():
        remaining = int((patient.pin_locked_until - datetime.utcnow()).total_seconds())
        mins, secs = divmod(max(remaining, 0), 60)
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {mins}m {secs}s, or log in with OTP instead.",
        )

    if not verify_password(data.pin, patient.pin_hash):
        patient.failed_pin_attempts = (patient.failed_pin_attempts or 0) + 1
        if patient.failed_pin_attempts >= PIN_MAX_FAILED_ATTEMPTS:
            patient.pin_locked_until = datetime.utcnow() + timedelta(minutes=PIN_LOCKOUT_MINUTES)
            db.commit()
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed attempts. PIN locked for {PIN_LOCKOUT_MINUTES} minutes — you can still log in with OTP.",
            )
        db.commit()
        raise HTTPException(status_code=401, detail="Incorrect PIN")

    patient.failed_pin_attempts = 0
    patient.pin_locked_until = None
    db.commit()
    return {"verified": True}


@router.post("/{patient_id}/set-pin")
def set_pin(patient_id: str, data: PinSetRequest, db: Session = Depends(get_db)):
    """For the dashboard's 'Secure Your Account' prompt shown to legacy
    patients with no PIN on file. The patient already has a loaded, valid
    session at this point, so no additional verification is required here."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if data.pin != data.confirm_pin:
        raise HTTPException(status_code=400, detail="PINs do not match")
    patient.pin_hash = hash_password(data.pin)
    db.commit()
    return {"status": "pin_set"}


@router.post("/otp/request")
def request_otp(data: OTPRequest, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not patient.mobile_number:
        raise HTTPException(
            status_code=400,
            detail="No mobile number on file for this account. Please contact support.",
        )

    window_start = datetime.utcnow() - timedelta(minutes=OTP_WINDOW_MINUTES)
    recent_count = (
        db.query(PatientOTP)
        .filter(PatientOTP.patient_id == data.patient_id, PatientOTP.created_at >= window_start)
        .count()
    )
    if recent_count >= OTP_MAX_REQUESTS_PER_WINDOW:
        raise HTTPException(
            status_code=429,
            detail="Too many OTP requests. Please wait a few minutes and try again.",
        )

    code = _generate_otp_code()
    otp = PatientOTP(
        patient_id=data.patient_id,
        code=code,
        purpose=data.purpose,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES),
    )
    db.add(otp)
    db.commit()

    # DEV MODE: the code is returned directly in the response instead of being
    # sent via SMS/email. Swap this one spot for a real provider call when
    # ready (e.g. Twilio, MSG91) — expiry, rate-limiting, and verification
    # below don't need to change.
    return {
        "status": "otp_sent",
        "dev_otp": code,  # ⚠️ dev-mode only — remove once real delivery is wired up
        "expires_in_seconds": OTP_EXPIRY_MINUTES * 60,
    }


def _verify_otp_code(db: Session, patient_id: str, code: str, purpose: str) -> PatientOTP:
    otp = (
        db.query(PatientOTP)
        .filter(PatientOTP.patient_id == patient_id, PatientOTP.purpose == purpose, PatientOTP.used == 0)
        .order_by(PatientOTP.id.desc())
        .first()
    )
    if not otp:
        raise HTTPException(status_code=400, detail="No active OTP request found. Please request a new code.")
    if otp.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new code.")
    if otp.attempts >= OTP_MAX_VERIFY_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Please request a new code.")
    if otp.code != code:
        otp.attempts += 1
        db.commit()
        raise HTTPException(status_code=401, detail="Incorrect code")
    return otp


@router.post("/otp/verify")
def verify_otp(data: OTPVerifyRequest, db: Session = Depends(get_db)):
    otp = _verify_otp_code(db, data.patient_id, data.code, data.purpose)
    otp.used = 1
    db.commit()
    return {"verified": True}


@router.post("/{patient_id}/reset-pin")
def reset_pin(patient_id: str, data: ResetPinRequest, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if data.new_pin != data.confirm_pin:
        raise HTTPException(status_code=400, detail="PINs do not match")

    otp = _verify_otp_code(db, patient_id, data.code, "reset_pin")
    otp.used = 1
    patient.pin_hash = hash_password(data.new_pin)
    db.commit()
    return {"status": "pin_reset"}


@router.post("/", response_model=PatientOut)
def create_patient(data: PatientCreate, db: Session = Depends(get_db)):
    if not data.consent_given:
        raise HTTPException(status_code=400, detail="Consent to store medical information is required to register.")

    # PIN is mandatory for self-registration (this endpoint) so every new
    # patient has one from day one. Admin-created patients (admin_patients.py)
    # extend this same schema but don't enforce it here — see that router.
    if not data.pin or not data.confirm_pin:
        raise HTTPException(status_code=400, detail="Please set a PIN to secure your account.")
    if data.pin != data.confirm_pin:
        raise HTTPException(status_code=400, detail="PINs do not match.")

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
        pin_hash=hash_password(data.pin),
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    notify_all_admins(
        db, "new_patient",
        f"New patient {patient.name} ({patient.id}) self-registered.",
        link=f"/admin/patients?q={patient.id}",
    )

    return patient


@router.get("/{patient_id}")
def get_patient(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    from app.models.mental_health import MentalHealthScreening
    latest_mh = (
        db.query(MentalHealthScreening)
        .filter(MentalHealthScreening.patient_id == patient_id)
        .order_by(MentalHealthScreening.screened_at.desc())
        .first()
    )

    return {
        "id":                      patient.id,
        "name":                    patient.name,
        "age":                     patient.age,
        "gender":                  patient.gender,
        "allergies":               patient.allergies               or "None",
        "known_conditions":        patient.known_conditions        or "None",
        "current_medications":     patient.current_medications     or "None",
        "blood_group":             patient.blood_group             or "",
        "emergency_contact":       patient.emergency_contact       or "",
        "emergency_contact_phone": patient.emergency_contact_phone or "",
        "mobile_number":           getattr(patient, "mobile_number",  "") or "",
        "date_of_birth":           getattr(patient, "date_of_birth",  "") or "",
        "guardian_name":           getattr(patient, "guardian_name",  "") or "",
        "guardian_phone":          getattr(patient, "guardian_phone", "") or "",
        "preferred_language":      getattr(patient, "preferred_language", "") or "en",
        "consent_given":           bool(getattr(patient, "consent_given", 0)),
        "has_pin":                 bool(getattr(patient, "pin_hash", None)),
        "mental_health_status":    latest_mh.severity if latest_mh else "",
        "mental_health_crisis":    bool(latest_mh.crisis_flag) if latest_mh else False,
        "created_at":              patient.created_at.isoformat() if patient.created_at else None,
    }


@router.get("/{patient_id}/summary")
def get_patient_summary(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    visits = db.query(Visit).filter(Visit.patient_id == patient_id).order_by(Visit.visit_date).all()
    risk_scores = [v.risk_score for v in visits if v.risk_score is not None]
    last_visit = visits[-1] if visits else None
    unread_alerts = get_unread_count(db, patient_id)
    deterioration = analyze_deterioration(risk_scores) if risk_scores else None

    return {
        "patient": {
            "id": patient.id,
            "name": patient.name,
            "age": patient.age,
            "gender": patient.gender,
            "allergies": patient.allergies,
            "known_conditions": patient.known_conditions,
            "current_medications": patient.current_medications,
            "blood_group":             patient.blood_group             or "",
            "emergency_contact":       patient.emergency_contact       or "",
            "emergency_contact_phone": patient.emergency_contact_phone or "",
            "mobile_number":           getattr(patient, "mobile_number",  "") or "",
            "date_of_birth":           getattr(patient, "date_of_birth",  "") or "",
            "guardian_name":           getattr(patient, "guardian_name",  "") or "",
            "guardian_phone":          getattr(patient, "guardian_phone", "") or "",
            "preferred_language":      getattr(patient, "preferred_language", "") or "en",
            "has_pin":                 bool(getattr(patient, "pin_hash", None)),
            "created_at": patient.created_at,
        },
        "stats": {
            "total_visits": len(visits),
            "last_visit_date": last_visit.visit_date if last_visit else None,
            "last_risk_score": last_visit.risk_score if last_visit else None,
            "last_triage": last_visit.triage_level if last_visit else None,
            "unread_alerts": unread_alerts,
            "has_critical_history": any(v.triage_level == "P1" for v in visits),
        },
        "deterioration": deterioration,
        "risk_history": risk_scores,
    }


@router.get("/{patient_id}/health-card")
def get_health_card(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    card_data = {
        "id":                      patient.id,
        "name":                    patient.name,
        "age":                     patient.age,
        "gender":                  patient.gender,
        "blood_group":             patient.blood_group             or "",
        "allergies":               patient.allergies               or "None",
        "known_conditions":        patient.known_conditions        or "None",
        "chronic_conditions":      patient.known_conditions        or "None",
        "current_medications":     patient.current_medications     or "None",
        "medications":             patient.current_medications     or "None",
        "emergency_contact":       patient.emergency_contact       or "",
        "emergency_contact_phone": patient.emergency_contact_phone or "",
        "mobile_number":           getattr(patient, "mobile_number", "") or "",
        "date_of_birth":           getattr(patient, "date_of_birth", "") or "",
    }

    # Compact mental health status -- only a severity label, never raw answers/scores,
    # since a health card can be shown to strangers/first responders.
    from app.models.mental_health import MentalHealthScreening
    latest_mh = (
        db.query(MentalHealthScreening)
        .filter(MentalHealthScreening.patient_id == patient_id)
        .order_by(MentalHealthScreening.screened_at.desc())
        .first()
    )
    if latest_mh:
        card_data["mental_health_status"] = latest_mh.severity
        card_data["mental_health_crisis"] = bool(latest_mh.crisis_flag)
    else:
        card_data["mental_health_status"] = ""
        card_data["mental_health_crisis"] = False

    try:
        return generate_health_card(card_data)
    except Exception:
        return {"card_data": card_data}


@router.get("/{patient_id}/ai-summary")
async def get_ai_summary(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    visits = db.query(Visit).filter(Visit.patient_id == patient_id).order_by(Visit.visit_date).all()
    visit_dicts = [
        {
            "visit_date": str(v.visit_date),
            "risk_score": v.risk_score,
            "triage_level": v.triage_level,
            "predicted_diseases": v.predicted_diseases or [],
        }
        for v in visits
    ]
    summary = await summarize_health_record(visit_dicts, patient.name)
    return {"summary": summary, "visit_count": len(visits)}


@router.put("/{patient_id}", response_model=PatientOut)
def update_patient(patient_id: str, data: PatientCreate, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    for k, v in data.model_dump().items():
        setattr(patient, k, v)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("/", response_model=list)
def list_all_patients(db: Session = Depends(get_db)):
    patients = db.query(Patient).order_by(Patient.created_at.desc()).all()
    return [
        {
            "id":                      p.id,
            "name":                    p.name,
            "age":                     p.age,
            "gender":                  p.gender,
            "blood_group":             p.blood_group             or "",
            "allergies":               p.allergies               or "None",
            "known_conditions":        p.known_conditions        or "None",
            "current_medications":     p.current_medications     or "None",
            "emergency_contact":       p.emergency_contact       or "",
            "emergency_contact_phone": p.emergency_contact_phone or "",
            "mobile_number":           getattr(p, "mobile_number", "") or "",
            "date_of_birth":           getattr(p, "date_of_birth", "") or "",
            "guardian_name":           getattr(p, "guardian_name", "") or "",
            "guardian_phone":          getattr(p, "guardian_phone", "") or "",
            "preferred_language":      getattr(p, "preferred_language", "") or "en",
            "consent_given":           bool(getattr(p, "consent_given", 0)),
            "created_at":              p.created_at.isoformat() if p.created_at else None,
        }
        for p in patients
    ]


@router.get("/{patient_id}/summary-v2")
async def get_patient_summary_v2(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    visits = db.query(Visit).filter(Visit.patient_id == patient_id).order_by(Visit.visit_date.asc()).all()

    visit_dicts = [
        {
            "id":                 v.id,
            "visit_date":         str(v.visit_date),
            "risk_score":         v.risk_score,
            "triage_level":       v.triage_level,
            "symptoms":           v.symptoms           or [],
            "predicted_diseases": v.predicted_diseases or [],
            "spo2":               v.spo2,
            "pulse":              v.pulse,
            "temperature":        v.temperature,
            "blood_pressure":     v.blood_pressure,
            "respiratory_rate":   v.respiratory_rate,
            "news2_score":        v.news2_score,
        }
        for v in visits
    ]

    patient_data = {
        "blood_group":         patient.blood_group         or "",
        "allergies":           patient.allergies           or "None",
        "known_conditions":    patient.known_conditions    or "None",
        "current_medications": patient.current_medications or "None",
    }

    # Fetch follow-ups for each visit to include in AI summary
    from app.models.followup import FollowUp
    followups_by_visit = {}
    for v_dict in visit_dicts:
        v_id = v_dict.get("id")
        if v_id:
            fups = db.query(FollowUp).filter(FollowUp.original_visit_id == v_id).order_by(FollowUp.day_number).all()
            followups_by_visit[v_id] = [
                {
                    "day_number":        f.day_number,
                    "recovery_status":   f.recovery_status,
                    "current_risk_score":f.current_risk_score,
                    "symptoms_improved": f.symptoms_improved or [],
                    "symptoms_worsened": f.symptoms_worsened or [],
                    "notes":             f.notes or "",
                    "followup_date":     f.followup_date.isoformat() if f.followup_date else None,
                    "pulse":             f.pulse,
                    "spo2":              f.spo2,
                    "temperature":       f.temperature,
                }
                for f in fups
            ]

    # Fetch mental health screenings to include in the AI summary
    from app.models.mental_health import MentalHealthScreening
    mh_records = (
        db.query(MentalHealthScreening)
        .filter(MentalHealthScreening.patient_id == patient_id)
        .order_by(MentalHealthScreening.screened_at.desc())
        .all()
    )
    mental_health_screenings = [
        {
            "screening_type": mh.screening_type,
            "total_score": mh.total_score,
            "severity": mh.severity,
            "screened_at": mh.screened_at.isoformat() if mh.screened_at else None,
            "crisis_flag": bool(mh.crisis_flag),
        }
        for mh in mh_records
    ]

    summary = await summarize_health_record(
        visits=visit_dicts,
        patient_name=patient.name,
        patient_data=patient_data,
        followups_by_visit=followups_by_visit,
        mental_health_screenings=mental_health_screenings,
    )
    return {"summary": summary, "visit_count": len(visits), "mental_health_screening_count": len(mental_health_screenings)}
@router.get("/{patient_id}/audit-history")
def get_patient_audit_history(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
 
    from app.models.audit_log import AuditLog
    from app.schemas.audit import to_audit_out
 
    entries = (
        db.query(AuditLog)
        .filter(AuditLog.patient_id == patient_id)
        .order_by(AuditLog.id.desc())
        .all()
    )
    return [to_audit_out(e).model_dump() for e in entries]


# ── Emergency SOS Alert (WhatsApp Business API + SMS fallback) ──────────────
# Builds the alert message server-side from the patient's real profile +
# latest vitals, then sends via emergency_alert_service.send_emergency_alert()
# — never via a wa.me deep link, so this never opens or uses the patient's
# own personal WhatsApp account.
class SOSAlertRequest(BaseModel):
    latitude: float = None
    longitude: float = None


@router.post("/{patient_id}/sos-alert")
async def send_sos_alert(patient_id: str, data: SOSAlertRequest, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    phone = (patient.emergency_contact_phone or "").strip()
    if not phone:
        raise HTTPException(
            status_code=400,
            detail="No emergency contact phone number on file. Add one in patient profile first.",
        )

    if data.latitude is not None and data.longitude is not None:
        location_text = f"https://maps.google.com/?q={data.latitude},{data.longitude}"
    else:
        location_text = "Location unavailable — please share manually"

    latest_visit = (
        db.query(Visit)
        .filter(Visit.patient_id == patient_id)
        .order_by(Visit.id.desc())
        .first()
    )

    vitals_lines = []
    if latest_visit:
        if latest_visit.pulse:             vitals_lines.append(f"Pulse: {latest_visit.pulse} bpm")
        if latest_visit.spo2:              vitals_lines.append(f"SpO2: {latest_visit.spo2}%")
        if latest_visit.temperature:       vitals_lines.append(f"Temp: {latest_visit.temperature}°F")
        if latest_visit.blood_pressure:    vitals_lines.append(f"BP: {latest_visit.blood_pressure}")
        if latest_visit.respiratory_rate:  vitals_lines.append(f"Resp Rate: {latest_visit.respiratory_rate}/min")
        if latest_visit.news2_score:       vitals_lines.append(f"NEWS2: {latest_visit.news2_score}/20")
        if latest_visit.triage_level:      vitals_lines.append(f"Triage: {latest_visit.triage_level}")
    vitals_text = "\n".join(vitals_lines) if vitals_lines else "No recent vitals on file"

    message = f"""🚨 MEDICAL EMERGENCY — SOS

Patient: {patient.name}, Age: {patient.age}
Blood Group: {patient.blood_group or "Unknown"}
Allergies: {patient.allergies or "None"}
Current Medications: {patient.current_medications or "None"}
Known Conditions: {patient.known_conditions or "None"}
Patient ID: {patient.id}

Critical Vitals:
{vitals_text}

📍 Location: {location_text}

⚕ Emergency: Call 102 / 108
Generated by MediAlert"""

    result = await send_emergency_alert(phone, message)

    log_emergency_notification(
        db, patient_id=patient.id, patient_name=patient.name,
        emergency_type="SOS", recipient_phone=phone, result=result,
    )

    return {
        "delivered_via": result["delivered_via"],  # "whatsapp", "sms", or None (dev-mode / all channels failed)
        "attempts": result["attempts"],
        "message_preview": message,
    }
