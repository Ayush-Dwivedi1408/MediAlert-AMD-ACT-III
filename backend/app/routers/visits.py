from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.visit import Visit
from app.models.patient import Patient
from app.schemas.visit import VisitCreate, VisitOut
from app.services.news2 import compute_news2
from app.services.severity import detect_severity
from app.services.alerts import generate_alerts
from app.services.prediction import predict_diseases
from typing import List, Optional
from datetime import datetime

router = APIRouter()


@router.post("/")
async def create_visit(data: VisitCreate, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    vitals = data.vitals or {}
    pulse = getattr(vitals, "pulse", None)
    spo2 = getattr(vitals, "spo2", None)
    temperature = getattr(vitals, "temperature", None)
    rr = getattr(vitals, "respiratory_rate", None)
    bp = getattr(vitals, "blood_pressure", None)
    weight = getattr(vitals, "weight", None)  # NEW

    # NEW — expanded assessment data, as plain dicts for storage / prompt use
    lifestyle_dict = data.lifestyle.dict(exclude_none=True) if data.lifestyle else {}
    exposure_dict  = data.exposure_history.dict(exclude_none=True) if data.exposure_history else {}

    # Parse systolic BP from string like "120/80"
    systolic_bp = None
    if bp:
        try:
            systolic_bp = float(bp.split("/")[0])
        except Exception:
            pass

    # 1. NEWS2 scoring
    news2 = compute_news2(
        respiratory_rate=rr,
        spo2=spo2,
        temperature=temperature,
        pulse=pulse,
        systolic_bp=systolic_bp,
    )

    # 2. Emergency severity detection
    vitals_summary = f"Pulse: {pulse}, SpO2: {spo2}%, Temp: {temperature}°F, RR: {rr}/min, BP: {bp}"
    severity = detect_severity(
        symptoms=data.symptoms,
        spo2=spo2,
        pulse=pulse,
        temperature=temperature,
        respiratory_rate=rr,
        news2_score=news2["score"],
        # NEW — these were collected but never used in risk scoring before
        risk_factors=data.risk_factors,
        associated_symptoms=data.associated_symptoms,
        symptom_severity_score=data.symptom_severity_score,
        recent_surgery_hospitalization=data.recent_surgery_hospitalization,
        exposure_history=exposure_dict,
    )

    # 3. AI Disease prediction with explainability
    context_notes = []
    if data.symptom_duration: context_notes.append(f"Duration: {data.symptom_duration}")
    if data.symptom_severity: context_notes.append(f"Severity: {data.symptom_severity}")
    if data.symptom_onset: context_notes.append(f"Onset: {data.symptom_onset}")
    if data.risk_factors: context_notes.append(f"Risk factors: {', '.join(data.risk_factors)}")
    vitals_summary = vitals_summary + (" | " + " | ".join(context_notes) if context_notes else "")

    try:
        prediction = await predict_diseases(
            symptoms=data.symptoms,
            symptoms_freetext=data.symptoms_freetext,
            current_disease=data.current_disease,
            current_medications=data.current_medications or patient.current_medications,
            allergies=data.allergies or patient.allergies,
            age=patient.age,
            gender=patient.gender,
            vitals_summary=vitals_summary,
            # NEW — expanded clinical context
            symptom_severity_score=data.symptom_severity_score,
            symptom_frequency=data.symptom_frequency,
            associated_symptoms=data.associated_symptoms,
            recent_surgery_hospitalization=data.recent_surgery_hospitalization,
            family_medical_history=data.family_medical_history,
            lifestyle=lifestyle_dict,
            exposure_history=exposure_dict,
            existing_conditions=data.existing_conditions,
        )
    except Exception as e:
        prediction = {
            "diseases": [],
            "first_aid": [],
            "drug_interactions": [],
            "allergy_warnings": [],
            "when_to_hospital": "Could not generate prediction. Please consult a doctor.",
            "health_literacy": {"simple_summary": "", "key_warning_signs": []},
        }

    # 4. Create visit record
    visit = Visit(
        patient_id=data.patient_id,
        visit_date=data.visit_date or datetime.utcnow(),
        pulse=pulse,
        spo2=spo2,
        temperature=temperature,
        blood_pressure=bp,
        respiratory_rate=rr,
        weight=weight,
        symptoms=data.symptoms,
        risk_factors=data.risk_factors,
        symptom_duration=data.symptom_duration,
        symptom_severity=data.symptom_severity,
        symptom_onset=data.symptom_onset,
        symptom_severity_score=data.symptom_severity_score,
        symptom_frequency=data.symptom_frequency,
        associated_symptoms=data.associated_symptoms,
        recent_surgery_hospitalization=data.recent_surgery_hospitalization,
        family_medical_history=data.family_medical_history,
        lifestyle=lifestyle_dict,
        exposure_history=exposure_dict,
        current_disease=data.current_disease or "",
        current_medications=data.current_medications or "",
        predicted_diseases=prediction.get("diseases", []),
        first_aid=prediction.get("first_aid", []),
        risk_score=severity["risk_score"],
        news2_score=news2["score"],
        news2_risk=news2["risk"],
        news2_flags=news2["flags"],
        triage_level=severity["triage"],
        drug_interactions=prediction.get("drug_interactions", []),
        allergy_warnings=prediction.get("allergy_warnings", []),
        when_to_hospital=prediction.get("when_to_hospital", ""),
        risk_engine="claude-ai",
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)

    # 5. Generate real-time alerts
    alerts = generate_alerts(
        db=db,
        patient_id=data.patient_id,
        visit_id=visit.id,
        spo2=spo2,
        pulse=pulse,
        temperature=temperature,
        respiratory_rate=rr,
    )

    return {
        "visit_id": visit.id,
        "patient_id": visit.patient_id,
        "visit_date": str(visit.visit_date),
        "severity": severity,
        "news2": news2,
        "prediction": prediction,
        "risk_score": severity["risk_score"],
        "triage_level": severity["triage"],
        "pulse": pulse,
        "spo2": spo2,
        "temperature": temperature,
        "blood_pressure": bp,
        "respiratory_rate": rr,
        "weight": weight,
        "symptoms": data.symptoms,
        "risk_factors": data.risk_factors,
        "symptom_duration": data.symptom_duration,
        "symptom_severity": data.symptom_severity,
        "symptom_onset": data.symptom_onset,
        "symptom_severity_score": data.symptom_severity_score,
        "symptom_frequency": data.symptom_frequency,
        "associated_symptoms": data.associated_symptoms,
        "recent_surgery_hospitalization": data.recent_surgery_hospitalization,
        "family_medical_history": data.family_medical_history,
        "lifestyle": lifestyle_dict,
        "exposure_history": exposure_dict,
        "alerts_generated": len(alerts),
        "alerts": [{"type": a.alert_type, "severity": a.severity, "title": a.title, "message": a.message} for a in alerts],
        "health_literacy": prediction.get("health_literacy", {}),
    }


@router.get("/patient/{patient_id}", response_model=List[VisitOut])
def get_patient_visits(patient_id: str, db: Session = Depends(get_db)):
    visits = db.query(Visit).filter(Visit.patient_id == patient_id).order_by(Visit.visit_date.desc()).all()
    return visits


@router.get("/{visit_id}")
def get_visit(visit_id: int, db: Session = Depends(get_db)):
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    return visit


@router.get("/", response_model=list)
def list_all_visits(db: Session = Depends(get_db)):
    visits = db.query(Visit).order_by(Visit.visit_date.desc()).all()
    return [
        {
            "id":                 v.id,
            "patient_id":         v.patient_id,
            "visit_date":         v.visit_date.isoformat() if v.visit_date else None,
            "triage_level":       v.triage_level,
            "risk_score":         round(v.risk_score, 1) if v.risk_score is not None else None,
            "news2_score":        v.news2_score,
            "symptoms":           v.symptoms         or [],
            "risk_factors":       v.risk_factors     or [],
            "symptom_duration":   v.symptom_duration,
            "symptom_severity":   v.symptom_severity,
            "symptom_onset":      v.symptom_onset,
            "symptom_severity_score": getattr(v, "symptom_severity_score", None),
            "symptom_frequency":      getattr(v, "symptom_frequency", None),
            "associated_symptoms":    getattr(v, "associated_symptoms", None) or [],
            "spo2":               v.spo2,
            "pulse":              v.pulse,
            "temperature":        v.temperature,
            "blood_pressure":     v.blood_pressure,
            "respiratory_rate":   v.respiratory_rate,
            "weight":             getattr(v, "weight", None),
            "predicted_diseases": v.predicted_diseases or [],
        }
        for v in visits
    ]


@router.get("/patient/{patient_id}/detail", response_model=list)
def get_patient_visits_detail(patient_id: str, db: Session = Depends(get_db)):
    visits = (
        db.query(Visit)
        .filter(Visit.patient_id == patient_id)
        .order_by(Visit.visit_date.asc())
        .all()
    )
    return [
        {
            "id":                 v.id,
            "patient_id":         v.patient_id,
            "visit_date":         v.visit_date.isoformat() if v.visit_date else None,
            "triage_level":       v.triage_level,
            "risk_score":         round(v.risk_score, 1) if v.risk_score is not None else None,
            "news2_score":        v.news2_score,
            "symptoms":           v.symptoms         or [],
            "risk_factors":       v.risk_factors     or [],
            "symptom_duration":   v.symptom_duration,
            "symptom_severity":   v.symptom_severity,
            "symptom_onset":      v.symptom_onset,
            "symptom_severity_score": getattr(v, "symptom_severity_score", None),
            "symptom_frequency":      getattr(v, "symptom_frequency", None),
            "associated_symptoms":    getattr(v, "associated_symptoms", None) or [],
            "recent_surgery_hospitalization": getattr(v, "recent_surgery_hospitalization", None),
            "family_medical_history":         getattr(v, "family_medical_history", None),
            "lifestyle":               getattr(v, "lifestyle", None) or {},
            "exposure_history":        getattr(v, "exposure_history", None) or {},
            "spo2":               v.spo2,
            "pulse":              v.pulse,
            "temperature":        v.temperature,
            "blood_pressure":     v.blood_pressure,
            "respiratory_rate":   v.respiratory_rate,
            "weight":             getattr(v, "weight", None),
            "predicted_diseases": v.predicted_diseases or [],
            "drug_interactions":  v.drug_interactions  or [],
            "allergy_warnings":   v.allergy_warnings   or [],
            "when_to_hospital":   getattr(v, "when_to_hospital", None),
            "health_literacy":    getattr(v, "health_literacy",  None),
        }
        for v in visits
    ]
