from pydantic import BaseModel
from typing import Optional


class ActivityLogOut(BaseModel):
    activity_id: int
    admin_id: str
    admin_name: str
    action: str
    details: str
    ip_address: Optional[str] = None
    date: str
    time: str

    class Config:
        from_attributes = True


def to_activity_out(entry) -> ActivityLogOut:
    """Splits the single created_at timestamp into separate date/time
    strings for display, mirroring schemas/audit.py's to_audit_out."""
    dt = entry.created_at
    return ActivityLogOut(
        activity_id=entry.id,
        admin_id=entry.admin_id,
        admin_name=entry.admin_name,
        action=entry.action,
        details=entry.details or "",
        ip_address=entry.ip_address,
        date=dt.strftime("%d-%m-%Y") if dt else "",
        time=dt.strftime("%I:%M %p") if dt else "",
    )
