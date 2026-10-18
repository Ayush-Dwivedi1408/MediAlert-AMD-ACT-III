from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime
import uuid

class Patient(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, default=lambda: "PAT-" + uuid.uuid4().hex[:4].upper() + "-" + uuid.uuid4().hex[:4].upper())
    name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String, nullable=False)
    allergies = Column(String, default="")
    known_conditions = Column(String, default="")
    current_medications = Column(String, default="")
    blood_group = Column(String, default="")
    emergency_contact = Column(String, default="")
    emergency_contact_phone = Column(String, default="")
    mobile_number    = Column(String, default="")
    date_of_birth    = Column(String, default="")
    guardian_name    = Column(String, default="")
    guardian_phone   = Column(String, default="")
    preferred_language = Column(String, default="en")
    consent_given    = Column(Integer, default=0)  # 0/1 -- consent to store medical information
    is_archived      = Column(Integer, default=0)  # 0/1 -- archived patients are hidden from active lists, never hard-deleted
    pin_hash         = Column(String, nullable=True)  # bcrypt hash of the patient's login PIN. Null for
                                                        # legacy patients registered before this feature —
                                                        # they log in via OTP and are prompted to set one.
    failed_pin_attempts = Column(Integer, default=0)   # resets on any successful PIN login
    pin_locked_until    = Column(DateTime, nullable=True)  # set once failed_pin_attempts hits the cap
    created_at = Column(DateTime, default=datetime.utcnow)

    visits = relationship("Visit", back_populates="patient", cascade="all, delete-orphan")
