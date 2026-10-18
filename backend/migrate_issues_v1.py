"""
Phase D migration: creates tables for Issue Management (Support Center,
Resolution Center) and the Notification Center.

Run from the backend/ directory with the venv active:
    python migrate_issues_v1.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import engine
from app.db.base import Base
from app.models.issue import Issue, IssueResponse, IssueNote  # noqa: F401
from app.models.notification import Notification  # noqa: F401


def run():
    print("Creating issues, issue_responses, issue_notes, notifications tables if they do not exist...")
    Base.metadata.create_all(bind=engine)
    print("Done.")


if __name__ == "__main__":
    run()
