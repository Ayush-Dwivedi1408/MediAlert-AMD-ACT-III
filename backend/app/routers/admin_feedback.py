from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.db.session import get_db
from app.models.feedback import Feedback
from app.models.admin import Admin
from app.schemas.feedback import FeedbackOut, FeedbackAnalytics
from app.auth_admin import get_current_admin

router = APIRouter()


@router.get("/", response_model=List[FeedbackOut])
def list_feedback(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return db.query(Feedback).order_by(Feedback.created_at.desc()).all()


@router.get("/analytics", response_model=FeedbackAnalytics)
def feedback_analytics(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    total = db.query(Feedback).count()
    if total == 0:
        return FeedbackAnalytics(
            total_feedback=0, average_rating=None, would_recommend_percentage=None,
            rating_distribution={str(i): 0 for i in range(1, 6)},
        )

    avg_rating = db.query(func.avg(Feedback.overall_rating)).scalar()
    recommend_count = db.query(Feedback).filter(Feedback.would_recommend == 1).count()

    distribution = {str(i): 0 for i in range(1, 6)}
    rows = db.query(Feedback.overall_rating, func.count(Feedback.id)).group_by(Feedback.overall_rating).all()
    for rating, count in rows:
        distribution[str(rating)] = count

    return FeedbackAnalytics(
        total_feedback=total,
        average_rating=round(avg_rating, 2) if avg_rating else None,
        would_recommend_percentage=round((recommend_count / total) * 100, 1),
        rating_distribution=distribution,
    )
