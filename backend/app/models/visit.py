from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime

class Visit(Base):
    __tablename__ = "visits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    visit_date = Column(DateTime, default=datetime.utcnow)

    # Vitals
    pulse = Column(Float, nullable=True)
    spo2 = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    blood_pressure = Column(String, nullable=True)
    respiratory_rate = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)  # NEW — optional, kg

    # Symptoms & context
    symptoms = Column(JSON, default=list)
    current_disease = Column(String, default="")
    current_medications = Column(String, default="")
    risk_factors = Column(JSON, default=list)       # e.g. obesity, family_history -- not symptoms
    symptom_duration = Column(String, nullable=True)  # e.g. "3 days"
    symptom_severity = Column(String, nullable=True)  # Mild / Moderate / Severe (legacy, kept for compatibility)
    symptom_onset = Column(String, nullable=True)     # Sudden / Gradual

    # NEW — Symptom Details (expanded assessment)
    symptom_severity_score = Column(Integer, nullable=True)  # 1-10 slider
    symptom_frequency = Column(String, nullable=True)        # Constant / Intermittent / Occasional
    associated_symptoms = Column(JSON, default=list)         # secondary symptoms, distinct from primary `symptoms`

    # NEW — Medical Background (per-visit, supplements Patient-level fields)
    recent_surgery_hospitalization = Column(String, nullable=True)
    family_medical_history = Column(String, nullable=True)

    # NEW — Lifestyle Assessment (grouped JSON: sleep_quality, water_intake_liters,
    # activity_level, diet_quality, stress_level, smoking, alcohol)
    lifestyle = Column(JSON, default=dict)

    # NEW — Exposure History (grouped JSON: recent_travel, contact_with_sick,
    # recent_injury, animal_insect_bite)
    exposure_history = Column(JSON, default=dict)

    # Results
    predicted_diseases = Column(JSON, default=list)
    first_aid = Column(JSON, default=list)
    risk_score = Column(Float, nullable=True)
    news2_score = Column(Integer, nullable=True)
    news2_risk = Column(String, nullable=True)
    news2_flags = Column(JSON, default=list)
    triage_level = Column(String, nullable=True)
    drug_interactions = Column(JSON, default=list)
    allergy_warnings = Column(JSON, default=list)
    when_to_hospital = Column(String, default="")
    risk_engine = Column(String, default="ml")

    patient = relationship("Patient", back_populates="visits")
