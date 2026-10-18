from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime

class FollowUp(Base):
    __tablename__ = "followups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    original_visit_id = Column(Integer, ForeignKey("visits.id"), nullable=False)
    followup_date = Column(DateTime, default=datetime.utcnow)
    day_number = Column(Integer, nullable=False)   # Day 1, Day 3, Day 7 etc

    # Current status
    symptoms_improved = Column(JSON, default=list)   # symptoms that got better
    symptoms_worsened = Column(JSON, default=list)   # symptoms that got worse
    symptoms_new = Column(JSON, default=list)        # new symptoms
    current_risk_score = Column(Float, nullable=True)
    notes = Column(String, default="")

    # Vitals at this check-in (were referenced everywhere but never actually declared — added now)
    pulse = Column(Float, nullable=True)
    spo2 = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    blood_pressure = Column(String, nullable=True)
    respiratory_rate = Column(Float, nullable=True)

    # Recovery status: IMPROVING, STABLE, WORSENING
    recovery_status = Column(String, default="STABLE")

    patient = relationship("Patient")
    original_visit = relationship("Visit")
