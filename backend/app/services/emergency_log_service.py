"""
Emergency Notification Log Service
Records every emergency alert send attempt (WhatsApp Business API + SMS
fallback) to the audit trail, and provides the read/format helpers the
admin-facing Notification Logs page uses.
"""

import json
from sqlalchemy.orm import Session

from app.models.emergency_notification_log import EmergencyNotificationLog


def mask_phone(phone: str) -> str:
    """+919876543210 -> +91*******10. Never expose the full number to the
    admin UI — only enough to confirm 'yes, this looks like the right
    contact', not enough to read or reuse it."""
    if not phone:
        return "—"
    digits = phone.strip()
    if len(digits) <= 5:
        return "*" * len(digits)
    return digits[:3] + "*" * (len(digits) - 5) + digits[-2:]


def log_emergency_notification(
    db: Session,
    patient_id: str,
    patient_name: str,
    emergency_type: str,
    recipient_phone: str,
    result: dict,  # the dict returned by emergency_alert_service.send_emergency_alert()
) -> EmergencyNotificationLog:
    attempts = result.get("attempts", [])
    log = EmergencyNotificationLog(
        patient_id=patient_id,
        patient_name=patient_name,
        emergency_type=emergency_type,
        recipient_phone=recipient_phone,
        delivered_via=result.get("delivered_via"),
        fallback_triggered=1 if len(attempts) > 1 else 0,
        attempts_json=json.dumps(attempts),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def _display_id(log: EmergencyNotificationLog) -> str:
    return f"N-{log.id:05d}"


def _attempt_status(attempt: dict) -> str:
    """"Sent" (accepted by the provider) or "Failed". True delivery-receipt
    confirmation ("Delivered") requires a provider status webhook, which
    isn't wired up yet — see the note on the admin Notification Logs page."""
    return "Sent" if attempt.get("success") else "Failed"


def serialize_log_rows(log: EmergencyNotificationLog) -> list:
    """One row PER CHANNEL ATTEMPT (so a fallback shows as two rows sharing
    the same notification_id) — matches the admin list view."""
    attempts = json.loads(log.attempts_json)
    rows = []
    for attempt in attempts:
        rows.append({
            "notification_id":    _display_id(log),
            "patient_id":         log.patient_id,
            "patient_name":       log.patient_name,
            "emergency_type":     log.emergency_type,
            "channel":            attempt.get("channel"),
            "status":             _attempt_status(attempt),
            "dev_mode":           attempt.get("dev_mode", False),
            "fallback_triggered": bool(log.fallback_triggered),
            "timestamp":          log.created_at.isoformat(),
        })
    return rows


def serialize_log_detail(log: EmergencyNotificationLog) -> dict:
    attempts = json.loads(log.attempts_json)
    primary  = attempts[0] if len(attempts) > 0 else None
    fallback = attempts[1] if len(attempts) > 1 else None

    def _fmt(attempt):
        if not attempt:
            return None
        return {
            "channel":           attempt.get("channel"),
            "status":            _attempt_status(attempt),
            "dev_mode":          attempt.get("dev_mode", False),
            "provider_response": attempt.get("detail"),
        }

    return {
        "notification_id":    _display_id(log),
        "patient_id":         log.patient_id,
        "patient_name":       log.patient_name,
        "emergency_type":     log.emergency_type,
        "recipient_masked":   mask_phone(log.recipient_phone),
        "delivered_via":      log.delivered_via,
        "fallback_triggered": bool(log.fallback_triggered),
        "primary":            _fmt(primary),
        "fallback":           _fmt(fallback),
        "timestamp":          log.created_at.isoformat(),
    }
