from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime

class VitalsIn(BaseModel):
    pulse: Optional[float] = None
    spo2: Optional[float] = None
    temperature: Optional[float] = None
    blood_pressure: Optional[str] = None
    respiratory_rate: Optional[float] = None
    weight: Optional[float] = None  # NEW — optional, kg

class LifestyleIn(BaseModel):
    sleep_quality: Optional[str] = None        # Poor / Fair / Good / Excellent
    water_intake_liters: Optional[float] = None
    activity_level: Optional[str] = None       # Sedentary / Light / Moderate / Active
    diet_quality: Optional[str] = None         # Poor / Fair / Good / Excellent
    stress_level: Optional[str] = None         # Low / Moderate / High
    smoking: Optional[str] = None              # optional
    alcohol: Optional[str] = None              # optional

class ExposureHistoryIn(BaseModel):
    recent_travel: Optional[str] = None
    contact_with_sick: Optional[str] = None
    recent_injury: Optional[str] = None
    animal_insect_bite: Optional[str] = None   # optional

class VisitCreate(BaseModel):
    patient_id: str
    visit_date: Optional[datetime] = None
    vitals: Optional[VitalsIn] = None
    symptoms: List[str] = []
    risk_factors: List[str] = []  # e.g. obesity, family_history -- not symptoms, contextual risk factors
    symptom_duration: Optional[str] = None    # e.g. "3 days"
    symptom_severity: Optional[str] = None    # Mild / Moderate / Severe (legacy)
    symptom_onset: Optional[str] = None       # Sudden / Gradual
    current_disease: Optional[str] = ""
    current_medications: Optional[str] = ""
    symptoms_freetext: Optional[str] = None  # NEW — patient's own-words symptom description, factored into structured matching (see symptom_matching.py)

    # NEW — Symptom Details
    symptom_severity_score: Optional[int] = Field(None, ge=1, le=10)
    symptom_frequency: Optional[str] = None   # Constant / Intermittent / Occasional
    associated_symptoms: List[str] = []

    # NEW — Medical Background (per-visit)
    recent_surgery_hospitalization: Optional[str] = None
    family_medical_history: Optional[str] = None
    allergies: Optional[str] = None            # overrides patient.allergies for THIS prediction only (not persisted)
    existing_conditions: Optional[str] = None  # used for prediction context only (not persisted)

    # NEW — Lifestyle & Exposure
    lifestyle: Optional[LifestyleIn] = None
    exposure_history: Optional[ExposureHistoryIn] = None

class DiseaseResult(BaseModel):
    name: str
    probability: float
    description: str

class FirstAidItem(BaseModel):
    disease: str
    steps: List[str]

class NEWS2Result(BaseModel):
    score: int
    risk: str
    triage: str
    flags: List[str]

class VisitResult(BaseModel):
    predicted_diseases: List[DiseaseResult]
    first_aid: List[FirstAidItem]
    risk_score: float
    news2: NEWS2Result
    triage_level: str
    drug_interactions: List[str]
    allergy_warnings: List[str]
    when_to_hospital: str
    risk_engine: str

class VisitOut(BaseModel):
    id: int
    patient_id: str
    visit_date: datetime
    pulse: Optional[float]
    spo2: Optional[float]
    temperature: Optional[float]
    blood_pressure: Optional[str]
    respiratory_rate: Optional[float]
    weight: Optional[float] = None
    symptoms: List[str]
    risk_factors: List[str] = []
    symptom_duration: Optional[str] = None
    symptom_severity: Optional[str] = None
    symptom_onset: Optional[str] = None
    symptom_severity_score: Optional[int] = None
    symptom_frequency: Optional[str] = None
    associated_symptoms: List[str] = []
    recent_surgery_hospitalization: Optional[str] = None
    family_medical_history: Optional[str] = None
    lifestyle: Optional[dict] = None
    exposure_history: Optional[dict] = None
    current_disease: str
    current_medications: str
    predicted_diseases: List[Any]
    first_aid: List[Any]
    risk_score: Optional[float]
    news2_score: Optional[int]
    news2_risk: Optional[str]
    news2_flags: List[str]
    triage_level: Optional[str]
    drug_interactions: List[str]
    allergy_warnings: List[str]
    when_to_hospital: str
    risk_engine: str

    class Config:
        from_attributes = True
