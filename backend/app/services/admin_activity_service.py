from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from app.models.admin_activity import AdminActivityLog
from app.models.admin import Admin


def log_activity(
    db: Session,
    admin: Admin,
    action: str,
    details: str = "",
    ip_address: Optional[str] = None,
) -> AdminActivityLog:
    """Writes a single activity row. Caller commits — same convention as
    audit_service.log_change, so this rides along with the endpoint's
    existing commit instead of opening a second transaction."""
    entry = AdminActivityLog(
        admin_id=admin.id,
        admin_name=admin.name,
        action=action,
        details=details or "",
        ip_address=ip_address,
        created_at=datetime.utcnow(),
    )
    db.add(entry)
    return entry
