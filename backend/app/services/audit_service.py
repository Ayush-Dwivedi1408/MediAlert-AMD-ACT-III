from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from app.models.audit_log import AuditLog
from app.models.admin import Admin

# Columns we never want to log verbatim in an audit trail readable by admins/patients —
# password data has no business appearing here even though Admin isn't the audited entity.
_NEVER_LOG_AS_IS = set()


def log_change(
    db: Session,
    patient_id: str,
    admin: Admin,
    edited_column: str,
    previous_value,
    new_value,
    reason: str,
) -> AuditLog:
    """Writes a single audit row. Caller commits (kept separate so multiple
    field changes in one update can be batched into one transaction)."""
    entry = AuditLog(
        patient_id=patient_id,
        admin_id=admin.id,
        admin_name=admin.name,
        edited_column=edited_column,
        previous_value="" if previous_value is None else str(previous_value),
        new_value="" if new_value is None else str(new_value),
        reason=reason or "",
        changed_at=datetime.utcnow(),
    )
    db.add(entry)
    return entry


def diff_and_log(
    db: Session,
    patient_id: str,
    admin: Admin,
    before: dict,
    after: dict,
    reason: str,
) -> list:
    """Compares two flat dicts of patient field values and writes one audit
    row per field that actually changed. Returns the list of AuditLog rows
    created (not yet committed)."""
    entries = []
    for field, new_value in after.items():
        old_value = before.get(field)
        if field in _NEVER_LOG_AS_IS:
            continue
        if str(old_value or "") != str(new_value or ""):
            entries.append(
                log_change(db, patient_id, admin, field, old_value, new_value, reason)
            )
    return entries


def log_lifecycle_event(
    db: Session,
    patient_id: str,
    admin: Admin,
    event: str,  # e.g. "created", "archived", "restored"
    reason: str,
) -> AuditLog:
    """For events that aren't a field-level change (create/archive/restore)."""
    return log_change(db, patient_id, admin, "__lifecycle__", "", event, reason)
