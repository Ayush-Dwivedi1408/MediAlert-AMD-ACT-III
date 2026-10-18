from sqlalchemy import Column, String, Integer, DateTime, Text
from app.db.base import Base
from datetime import datetime


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, nullable=False, index=True)

    overall_rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text, default="")
    suggestion = Column(Text, default="")
    would_recommend = Column(Integer, nullable=False)  # 0/1

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
