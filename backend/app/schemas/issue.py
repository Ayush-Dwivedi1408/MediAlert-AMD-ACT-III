from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class IssueCreate(BaseModel):
    patient_id: str
    category: str
    description: str = Field(..., min_length=3)
    priority: str = "Medium"  # Critical / High / Medium / Low
    related_change_number: Optional[int] = None  # auto-attached when reported from Change History
    screenshot_path: Optional[str] = None


class IssueResponseOut(BaseModel):
    id: int
    admin_id: str
    admin_name: str
    message: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class IssueOut(BaseModel):
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

    class Config:
        from_attributes = True


class SatisfactionRequest(BaseModel):
    satisfaction: str = Field(..., pattern="^(satisfied|not_satisfied)$")
