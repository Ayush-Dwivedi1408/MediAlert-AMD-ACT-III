from sqlalchemy import Column, String, Integer, DateTime, Text
from app.db.base import Base
from datetime import datetime


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Exactly one of these is set depending on who the notification is for.
    patient_id = Column(String, nullable=True, index=True)
    admin_id = Column(String, nullable=True, index=True)

    # e.g. "patient_updated", "issue_assigned", "issue_resolved",
    # "health_report_generated", "feedback_received", "admin_added"
    event_type = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String, nullable=True)  # optional frontend route to deep-link to, e.g. /change-history

    is_read = Column(Integer, default=0)  # 0/1
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
