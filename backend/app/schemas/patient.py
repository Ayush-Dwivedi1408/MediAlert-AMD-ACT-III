from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class PatientCreate(BaseModel):
    name: str = Field(..., min_length=1)
    age: int = Field(..., ge=0, le=120)
    gender: str
    allergies: Optional[str] = None
    known_conditions: Optional[str] = None
    current_medications: Optional[str] = None
    blood_group: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    mobile_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    preferred_language: Optional[str] = "en"
    consent_given: Optional[bool] = False
    # Optional here so admin-created patients (AdminPatientCreate extends this)
    # aren't forced to set one up front. The public self-registration endpoint
    # enforces these as required — see create_patient() in routers/patients.py.
    pin: Optional[str] = None
    confirm_pin: Optional[str] = None

class PatientOut(BaseModel):
    id: str
    name: str
    age: int
    gender: str
    allergies: str
    known_conditions: str
    current_medications: str
    blood_group: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    mobile_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    preferred_language: Optional[str] = None
    consent_given: Optional[bool] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PatientSummary(BaseModel):
    id: str
    name: str
    age: int
    gender: str
    total_visits: int = 0
    last_visit_date: Optional[datetime] = None
    last_risk_score: Optional[float] = None
    last_triage: Optional[str] = None

    class Config:
        from_attributes = True


# ── PIN & OTP (Point 14 — patient account security) ─────────────────────────
PIN_PATTERN = r"^\d{4,6}$"


class PinSetRequest(BaseModel):
    """Used from the dashboard's 'Secure Your Account' prompt — the patient
    is already authenticated at this point, so no OTP is required."""
    pin: str = Field(..., pattern=PIN_PATTERN, description="4-6 digit PIN")
    confirm_pin: str


class PinVerifyRequest(BaseModel):
    pin: str


class OTPRequest(BaseModel):
    patient_id: str
    purpose: str = Field(..., pattern="^(login|reset_pin)$")


class OTPVerifyRequest(BaseModel):
    patient_id: str
    code: str
    purpose: str = Field(..., pattern="^(login|reset_pin)$")


class ResetPinRequest(BaseModel):
    code: str
    new_pin: str = Field(..., pattern=PIN_PATTERN, description="4-6 digit PIN")
    confirm_pin: str
