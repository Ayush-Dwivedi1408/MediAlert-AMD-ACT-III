from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.notification import Notification
from app.models.patient import Patient
from app.schemas.notification import NotificationOut

router = APIRouter()


@router.get("/patient/{patient_id}", response_model=List[NotificationOut])
def list_patient_notifications(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return (
        db.query(Notification)
        .filter(Notification.patient_id == patient_id)
        .order_by(Notification.id.desc())
        .all()
    )


@router.get("/patient/{patient_id}/unread-count")
def unread_count(patient_id: str, db: Session = Depends(get_db)):
    count = (
        db.query(Notification)
        .filter(Notification.patient_id == patient_id, Notification.is_read == 0)
        .count()
    )
    return {"unread_count": count}


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: int, db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notification_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = 1
    db.commit()
    db.refresh(n)
    return n


@router.post("/patient/{patient_id}/mark-all-read")
def mark_all_read(patient_id: str, db: Session = Depends(get_db)):
    """Explicit, deliberate bulk mark-as-read — only triggered by the patient
    clicking a dedicated button, never automatically (e.g. just opening the
    notification bell must never mark anything as read)."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    updated = (
        db.query(Notification)
        .filter(Notification.patient_id == patient_id, Notification.is_read == 0)
        .update({"is_read": 1})
    )
    db.commit()
    return {"marked_read": updated}
