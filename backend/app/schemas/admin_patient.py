from pydantic import BaseModel, Field
from typing import Optional
from app.schemas.patient import PatientCreate


class AdminPatientCreate(PatientCreate):
    reason: Optional[str] = "Patient registered by admin"


class AdminPatientEdit(BaseModel):
    # All optional — only fields actually provided get compared/updated/audited.
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
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
    preferred_language: Optional[str] = None

    reason: str = Field(..., min_length=3, description="Required — why this change is being made")


class ArchiveRequest(BaseModel):
    reason: str = Field(..., min_length=3)


class RestoreRequest(BaseModel):
    reason: Optional[str] = "Restored by admin"


class PermanentDeleteRequest(BaseModel):
    reason: str = Field(..., min_length=3, description="Required — permanent deletion cannot be undone")
    password: str = Field(..., min_length=1, description="Required — re-authenticates the admin before this destructive action")
