from sqlalchemy import Column, Integer, String, DateTime
from app.db.base import Base
from datetime import datetime


class EmergencyNotificationLog(Base):
    """Audit trail for every emergency alert send attempt (WhatsApp Business
    API + SMS fallback). One row per SOS/emergency event; the full
    per-channel attempt history (WhatsApp tried, SMS tried, provider
    responses) is stored as JSON in attempts_json so nothing about the
    incident is lost even when only the fallback channel succeeded."""
    __tablename__ = "emergency_notification_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, nullable=False, index=True)
    patient_name = Column(String, nullable=False)  # snapshot at time of alert
    emergency_type = Column(String, nullable=False, default="SOS")  # "SOS" today; "Fall Detected", "High Heart Rate" etc. once those triggers exist
    recipient_phone = Column(String, nullable=False)  # full number stored; only ever MASKED when returned to the admin frontend — see mask_phone() in emergency_log_service.py
    delivered_via = Column(String, nullable=True)  # "whatsapp" / "sms" / None if every channel failed
    fallback_triggered = Column(Integer, default=0)  # 0/1 — SMS was attempted because WhatsApp didn't succeed
    attempts_json = Column(String, nullable=False)  # JSON list of {channel, success, dev_mode, detail}
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
