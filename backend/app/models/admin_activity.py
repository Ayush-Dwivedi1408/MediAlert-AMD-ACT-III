from sqlalchemy import Column, Integer, String, DateTime, Text
from app.db.base import Base
from datetime import datetime


class AdminActivityLog(Base):
    """General admin action log — separate from AuditLog (which is patient
    field-change history). Tracks login/logout and every significant admin
    action (patient add/edit/archive/restore, issue resolution, admin
    management, password resets) for accountability."""
    __tablename__ = "admin_activity_logs"

    # "Activity ID"
    id = Column(Integer, primary_key=True, autoincrement=True)

    admin_id = Column(String, nullable=False, index=True)
    admin_name = Column(String, nullable=False)

    action = Column(String, nullable=False)   # e.g. "Login", "Logout", "Added Patient"
    details = Column(Text, default="")        # human-readable context, e.g. "Patient PAT-XXXX-XXXX"
    ip_address = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
