from pydantic import BaseModel
from datetime import datetime


class AuditEntryOut(BaseModel):
    change_number: int
    patient_id: str
    admin_id: str
    admin_name: str
    edited_column: str
    previous_value: str
    new_value: str
    reason: str
    date: str  # split from changed_at for display, e.g. "2026-08-04"
    time: str  # e.g. "09:19:10"

    class Config:
        from_attributes = True


def to_audit_out(entry) -> AuditEntryOut:
    """Builds the response shape from an AuditLog ORM row, splitting the
    single changed_at timestamp into separate date/time strings for display."""
    changed_at: datetime = entry.changed_at
    return AuditEntryOut(
        change_number=entry.id,
        patient_id=entry.patient_id,
        admin_id=entry.admin_id,
        admin_name=entry.admin_name,
        edited_column=entry.edited_column,
        previous_value=entry.previous_value or "",
        new_value=entry.new_value or "",
        reason=entry.reason or "",
        date=changed_at.strftime("%Y-%m-%d") if changed_at else "",
        time=changed_at.strftime("%H:%M:%S") if changed_at else "",
    )
