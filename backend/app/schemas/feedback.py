from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class FeedbackCreate(BaseModel):
    patient_id: str
    overall_rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = ""
    suggestion: Optional[str] = ""
    would_recommend: bool


class FeedbackOut(BaseModel):
    id: int
    patient_id: str
    overall_rating: int
    comment: str
    suggestion: str
    would_recommend: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FeedbackAnalytics(BaseModel):
    total_feedback: int
    average_rating: Optional[float] = None
    would_recommend_percentage: Optional[float] = None
    rating_distribution: dict  # {"1": n, "2": n, ..., "5": n}
