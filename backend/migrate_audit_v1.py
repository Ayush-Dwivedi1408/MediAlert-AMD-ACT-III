"""
Phase B migration:
  1. Creates the audit_logs table.
  2. Adds an is_archived column to patients (0/1, default 0) — archive/restore
     replaces hard delete per spec, so patients need a soft-delete flag.

Run from the backend/ directory with the venv active:
    python migrate_audit_v1.py

Safe to re-run: checks for the column/table before adding either.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.session import engine, SessionLocal
from app.db.base import Base
from app.models.audit_log import AuditLog
from app.models.patient import Patient  # noqa: F401 — ensures patients table is registered on Base


def column_exists(db, table, column):
    result = db.execute(text(f"PRAGMA table_info({table})"))
    return any(row[1] == column for row in result)


def run():
    print("Creating audit_logs table if it does not exist...")
    Base.metadata.create_all(bind=engine)
    print("Done.")

    db = SessionLocal()
    try:
        if column_exists(db, "patients", "is_archived"):
            print("patients.is_archived already exists. Skipping.")
        else:
            print("Adding is_archived column to patients...")
            db.execute(text("ALTER TABLE patients ADD COLUMN is_archived INTEGER DEFAULT 0"))
            db.commit()
            print("Done.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
