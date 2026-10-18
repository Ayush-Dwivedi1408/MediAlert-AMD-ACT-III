from sqlalchemy import Column, Integer, String, DateTime
from app.db.base import Base
from datetime import datetime


class PatientOTP(Base):
    """One-time codes for OTP login and 'forgot PIN' reset. Delivery is
    pluggable — see request_otp() in routers/patients.py: dev mode returns
    the code directly in the API response; swap that one spot for a real
    SMS/email provider call when ready, nothing else in this flow changes."""
    __tablename__ = "patient_otps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, nullable=False, index=True)
    code = Column(String, nullable=False)
    purpose = Column(String, nullable=False)  # "login" or "reset_pin"
    expires_at = Column(DateTime, nullable=False)
    used = Column(Integer, default=0)
    attempts = Column(Integer, default=0)  # incorrect verify attempts against this code
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
