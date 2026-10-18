"""
Phase E migration: creates the feedback table.

Run from the backend/ directory with the venv active:
    python migrate_feedback_v1.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import engine
from app.db.base import Base
from app.models.feedback import Feedback  # noqa: F401


def run():
    print("Creating feedback table if it does not exist...")
    Base.metadata.create_all(bind=engine)
    print("Done.")


if __name__ == "__main__":
    run()
