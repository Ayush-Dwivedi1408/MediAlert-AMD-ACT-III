from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime
import uuid


def make_token_number():
    return "TKT-" + uuid.uuid4().hex[:6].upper()


class Issue(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token_number = Column(String, unique=True, nullable=False, default=make_token_number)

    patient_id = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False)
    description = Column(Text, default="")
    screenshot_path = Column(String, nullable=True)  # optional, path under uploads if provided

    priority = Column(String, nullable=False, default="Medium")  # Critical / High / Medium / Low

    # Status pipeline (Point 8 of the V2 spec):
    # Pending -> Under Review -> Waiting for Patient Feedback -> Closed (satisfied)
    #                                                          -> Reopened (not satisfied)
    # Pending / Under Review -> Rejected
    # See services/issue_service.py for the full status constants + auto-close sweep.
    status = Column(String, nullable=False, default="Pending")

    # Auto-attached when reported from a Change History row — links the issue
    # back to the specific audit entry the patient is disputing/asking about.
    related_change_number = Column(Integer, nullable=True)

    assigned_admin_id = Column(String, nullable=True)
    assigned_admin_name = Column(String, nullable=True)

    # Set once the patient responds to a resolution; "not_satisfied" triggers reopening.
    # Also set to "auto_closed_no_response" by the stale-issue sweep.
    patient_satisfaction = Column(String, nullable=True)
    satisfaction_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    responses = relationship("IssueResponse", back_populates="issue", cascade="all, delete-orphan", order_by="IssueResponse.created_at")
    notes = relationship("IssueNote", back_populates="issue", cascade="all, delete-orphan", order_by="IssueNote.created_at")


class IssueResponse(Base):
    """Admin's response to the patient — visible to the patient (Resolution Center)."""
    __tablename__ = "issue_responses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False, index=True)

    admin_id = Column(String, nullable=False)
    admin_name = Column(String, nullable=False)
    message = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    issue = relationship("Issue", back_populates="responses")


class IssueNote(Base):
    """Internal admin-only note — never shown to the patient."""
    __tablename__ = "issue_notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False, index=True)

    admin_id = Column(String, nullable=False)
    admin_name = Column(String, nullable=False)
    note = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    issue = relationship("Issue", back_populates="notes")
