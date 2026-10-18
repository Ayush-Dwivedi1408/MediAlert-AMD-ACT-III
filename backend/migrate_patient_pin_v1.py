"""
Migration: add pin_hash column to the patients table (Point 14 — Patient PIN
security). The new patient_otps table doesn't need a migration — it's brand
new, so SQLAlchemy's create_all() picks it up automatically on next backend
startup as long as it's imported in main.py.

Safe to re-run: checks whether the column already exists first.

Run once from the backend/ directory:
    python migrate_patient_pin_v1.py
"""
from app.db.session import engine
from sqlalchemy import text


def run():
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(patients)"))
        columns = [row[1] for row in result]
        if "pin_hash" in columns:
            print("Column pin_hash already exists on patients — nothing to do.")
            return
        conn.execute(text("ALTER TABLE patients ADD COLUMN pin_hash VARCHAR"))
        conn.commit()
        print("Migration complete. pin_hash column added to patients table.")


if __name__ == "__main__":
    run()
