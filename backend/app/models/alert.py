from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    visit_id = Column(Integer, ForeignKey("visits.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    alert_type = Column(String, nullable=False)   # SPO2_CRITICAL, PULSE_HIGH, TEMP_HIGH etc
    severity = Column(String, nullable=False)      # LOW, MEDIUM, HIGH, CRITICAL
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    value = Column(Float, nullable=True)           # The actual reading that triggered it
    threshold = Column(Float, nullable=True)       # The threshold it crossed
    is_read = Column(Boolean, default=False)
    action_status = Column(String, default="unread")  # unread, read, action_taken
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)

    patient = relationship("Patient")
