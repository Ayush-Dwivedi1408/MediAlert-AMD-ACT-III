from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.feedback import Feedback
from app.models.patient import Patient
from app.schemas.feedback import FeedbackCreate, FeedbackOut
from app.services.notification_service import notify_all_admins

router = APIRouter()


@router.post("/", response_model=FeedbackOut)
def submit_feedback(data: FeedbackCreate, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    feedback = Feedback(
        patient_id=data.patient_id,
        overall_rating=data.overall_rating,
        comment=data.comment or "",
        suggestion=data.suggestion or "",
        would_recommend=1 if data.would_recommend else 0,
    )
    db.add(feedback)
    db.flush()

    notify_all_admins(
        db, "feedback_received",
        f"{patient.name} left {data.overall_rating}/5 feedback.",
        link="/admin/feedback",
    )

    db.commit()
    db.refresh(feedback)
    return feedback


@router.get("/patient/{patient_id}", response_model=List[FeedbackOut])
def list_patient_feedback(patient_id: str, db: Session = Depends(get_db)):
    return (
        db.query(Feedback)
        .filter(Feedback.patient_id == patient_id)
        .order_by(Feedback.created_at.desc())
        .all()
    )
