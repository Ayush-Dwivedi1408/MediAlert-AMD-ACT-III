from sqlalchemy import Column, Integer, String, DateTime, Text
from app.db.base import Base
from datetime import datetime


class AuditLog(Base):
    __tablename__ = "audit_logs"

    # "Change Number" — auto-incrementing, doubles as the audit record's own id
    id = Column(Integer, primary_key=True, autoincrement=True)

    patient_id = Column(String, nullable=False, index=True)
    admin_id = Column(String, nullable=False)
    admin_name = Column(String, nullable=False)

    edited_column = Column(String, nullable=False)
    previous_value = Column(Text, default="")
    new_value = Column(Text, default="")
    reason = Column(Text, default="")

    # Single timestamp column; date/time are split out for display in the API layer
    # rather than stored twice, to avoid the two ever drifting out of sync.
    changed_at = Column(DateTime, default=datetime.utcnow, index=True)
