from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.admin import Admin
from app.schemas.audit import AuditEntryOut, to_audit_out
from app.auth_admin import get_current_admin

router = APIRouter()


@router.get("/patient/{patient_id}", response_model=List[AuditEntryOut])
def get_patient_audit_log(
    patient_id: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    entries = (
        db.query(AuditLog)
        .filter(AuditLog.patient_id == patient_id)
        .order_by(AuditLog.id.desc())
        .all()
    )
    return [to_audit_out(e) for e in entries]


@router.get("/recent", response_model=List[AuditEntryOut])
def get_recent_audit_entries(
    limit: int = 50,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """All recent changes across all patients — useful for an admin activity feed."""
    entries = (
        db.query(AuditLog)
        .order_by(AuditLog.id.desc())
        .limit(min(limit, 200))
        .all()
    )
    return [to_audit_out(e) for e in entries]
