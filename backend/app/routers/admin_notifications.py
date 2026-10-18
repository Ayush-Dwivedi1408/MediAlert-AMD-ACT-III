from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.notification import Notification
from app.models.admin import Admin
from app.schemas.notification import NotificationOut
from app.auth_admin import get_current_admin

router = APIRouter()


@router.get("/", response_model=List[NotificationOut])
def list_my_notifications(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return (
        db.query(Notification)
        .filter(Notification.admin_id == admin.id)
        .order_by(Notification.id.desc())
        .all()
    )


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    count = (
        db.query(Notification)
        .filter(Notification.admin_id == admin.id, Notification.is_read == 0)
        .count()
    )
    return {"unread_count": count}


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    n = db.query(Notification).filter(Notification.id == notification_id, Notification.admin_id == admin.id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = 1
    db.commit()
    db.refresh(n)
    return n


@router.post("/mark-all-read")
def mark_all_read(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    """Explicit, deliberate bulk mark-as-read — only triggered by the admin
    clicking a dedicated button, never automatically (e.g. just opening the
    notification bell must never mark anything as read)."""
    updated = (
        db.query(Notification)
        .filter(Notification.admin_id == admin.id, Notification.is_read == 0)
        .update({"is_read": 1})
    )
    db.commit()
    return {"marked_read": updated}
