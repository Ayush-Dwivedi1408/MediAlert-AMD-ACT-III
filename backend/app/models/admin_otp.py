from sqlalchemy import Column, Integer, String, DateTime
from app.db.base import Base
from datetime import datetime


class AdminOTP(Base):
    """One-time codes for the admin 'forgot password' reset flow. Delivery
    is pluggable — dev mode returns the code directly in the API response
    (see request_password_reset() in routers/admin_auth.py); swap that one
    spot for a real email provider call when ready, nothing else in this
    flow needs to change. Mirrors PatientOTP (models/patient_otp.py)."""
    __tablename__ = "admin_otps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    admin_id = Column(String, nullable=False, index=True)
    code = Column(String, nullable=False)
    purpose = Column(String, nullable=False, default="reset_password")
    expires_at = Column(DateTime, nullable=False)
    used = Column(Integer, default=0)
    attempts = Column(Integer, default=0)  # incorrect verify attempts against this code
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
