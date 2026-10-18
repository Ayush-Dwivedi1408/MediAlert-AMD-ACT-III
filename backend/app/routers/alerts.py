from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.alert import Alert
from app.services.alerts import get_patient_alerts, mark_all_read, get_unread_count
from datetime import datetime

router = APIRouter()


@router.get("/patient/{patient_id}")
def get_alerts(patient_id: str, unread_only: bool = False, db: Session = Depends(get_db)):
    alerts = get_patient_alerts(db, patient_id, unread_only)
    return {
        "alerts": [
            {
                "id": a.id,
                "type": a.alert_type,
                "severity": a.severity,
                "title": a.title,
                "message": a.message,
                "value": a.value,
                "threshold": a.threshold,
                "is_read": a.is_read,
                "created_at": a.created_at,
            }
            for a in alerts
        ],
        "unread_count": get_unread_count(db, patient_id),
    }


@router.post("/patient/{patient_id}/mark-read")
def mark_read(patient_id: str, db: Session = Depends(get_db)):
    mark_all_read(db, patient_id)
    return {"message": "All alerts marked as read"}


@router.post("/{alert_id}/resolve")
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_resolved = True
    alert.resolved_at = datetime.utcnow()
    db.commit()
    return {"message": "Alert resolved"}


@router.get("/", response_model=list)
def list_all_alerts(db: Session = Depends(get_db)):
    alerts = db.query(Alert).order_by(Alert.created_at.desc()).all()
    return [
        {
            "id":          a.id,
            "patient_id":  a.patient_id,
            "alert_type":  a.alert_type,
            "message":     a.message,
            "severity":    a.severity,
            "title":       a.title,
            "is_read":       a.is_read,
            "action_status": getattr(a, "action_status", "unread"),
            "created_at":    a.created_at.isoformat() if a.created_at else None,
        }
        for a in alerts
    ]


class AlertStatusUpdate(BaseModel):
    status: str  # "read" or "action_taken"


@router.post("/{alert_id}/status")
def update_alert_status(alert_id: int, data: AlertStatusUpdate, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if data.status not in ("read", "action_taken"):
        raise HTTPException(status_code=400, detail="status must be 'read' or 'action_taken'")

    alert.is_read = True
    if hasattr(alert, "action_status"):
        alert.action_status = data.status
    db.commit()
    db.refresh(alert)

    return {
        "id": alert.id,
        "is_read": alert.is_read,
        "action_status": getattr(alert, "action_status", data.status),
        "message": f"Alert marked as {data.status.replace('_', ' ')}"
    }
