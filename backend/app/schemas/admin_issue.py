from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.schemas.issue import IssueResponseOut


class IssueNoteOut(BaseModel):
    id: int
    admin_id: str
    admin_name: str
    note: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class IssueAdminOut(BaseModel):
    id: int
    token_number: str
    patient_id: str
    category: str
    description: str
    screenshot_path: Optional[str] = None
    priority: str
    status: str
    related_change_number: Optional[int] = None
    assigned_admin_id: Optional[str] = None
    assigned_admin_name: Optional[str] = None
    patient_satisfaction: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    responses: List[IssueResponseOut] = []
    notes: List[IssueNoteOut] = []  # internal — admin view only

    class Config:
        from_attributes = True


class AssignRequest(BaseModel):
    admin_id: Optional[str] = None  # if omitted, assigns to the requesting admin


class RespondRequest(BaseModel):
    message: str = Field(..., min_length=1)


class NoteRequest(BaseModel):
    note: str = Field(..., min_length=1)


class InvestigateRequest(BaseModel):
    note: Optional[str] = None  # optional internal note, e.g. what's being looked into


class RejectRequest(BaseModel):
    reason: str = Field(..., min_length=3)


class StatusUpdateRequest(BaseModel):
    status: str = Field(
        ...,
        pattern="^(Pending|Under Review|Waiting for Patient Feedback|Closed|Reopened|Rejected)$",
    )
