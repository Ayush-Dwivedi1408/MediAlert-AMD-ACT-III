from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.session import get_db
from app.models.admin import Admin
from app.models.admin_activity import AdminActivityLog
from app.schemas.admin_activity import ActivityLogOut, to_activity_out
from app.auth_admin import get_current_admin

router = APIRouter()


@router.get("/", response_model=List[ActivityLogOut])
def list_activity(
    admin_id: Optional[str] = Query(None, description="Filter by the admin who performed the action"),
    action: Optional[str] = Query(None, description="Filter by action type, e.g. 'Login'"),
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    q = db.query(AdminActivityLog)
    if admin_id:
        q = q.filter(AdminActivityLog.admin_id == admin_id)
    if action:
        q = q.filter(AdminActivityLog.action == action)
    entries = q.order_by(AdminActivityLog.id.desc()).limit(limit).all()
    return [to_activity_out(e) for e in entries]
