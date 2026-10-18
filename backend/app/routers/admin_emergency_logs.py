from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.admin import Admin
from app.models.emergency_notification_log import EmergencyNotificationLog
from app.services.emergency_log_service import serialize_log_rows, serialize_log_detail
from app.auth_admin import get_current_admin

router = APIRouter()


@router.get("/")
def list_notification_logs(db: Session = Depends(get_db), current: Admin = Depends(get_current_admin)):
    """Flattened list — one row per channel attempt, most recent first, so a
    WhatsApp-then-SMS fallback shows as two rows sharing a notification_id,
    matching the admin Notification Logs table."""
    logs = db.query(EmergencyNotificationLog).order_by(EmergencyNotificationLog.id.desc()).all()
    rows = []
    for log in logs:
        rows.extend(serialize_log_rows(log))
    return rows


@router.get("/{notification_id}")
def get_notification_log(notification_id: str, db: Session = Depends(get_db), current: Admin = Depends(get_current_admin)):
    try:
        raw_id = int(notification_id.split("-")[-1])
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid notification ID")

    log = db.query(EmergencyNotificationLog).filter(EmergencyNotificationLog.id == raw_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Notification log not found")
    return serialize_log_detail(log)
