from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime

class MentalHealthScreening(Base):
    __tablename__ = "mental_health_screenings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    screened_at = Column(DateTime, default=datetime.utcnow)

    screening_type = Column(String, nullable=False)  # PHQ9 or GAD7
    answers = Column(JSON, default=list)             # list of scores per question (0-3)
    total_score = Column(Integer, nullable=False)

    # PHQ-9: 0-4 None, 5-9 Mild, 10-14 Moderate, 15-19 ModSevere, 20-27 Severe
    # GAD-7: 0-4 Minimal, 5-9 Mild, 10-14 Moderate, 15-21 Severe
    severity = Column(String, nullable=False)
    recommendations = Column(JSON, default=list)
    follow_up_recommended = Column(String, default="No")

    # Was previously computed by score_phq9() but never persisted -- now stored
    crisis_flag = Column(Integer, default=0)   # 0/1 -- PHQ-9 Q9 self-harm indicator, or severe GAD-7/PHQ-9
    crisis_message = Column(String, nullable=True)

    patient = relationship("Patient")
