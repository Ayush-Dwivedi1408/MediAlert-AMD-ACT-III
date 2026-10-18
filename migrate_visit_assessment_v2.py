"""
Migration: Add expanded Symptom Assessment fields to visits table.
Run once: python migrate_visit_assessment_v2.py

Adds: weight, symptom_severity_score, symptom_frequency, associated_symptoms,
      recent_surgery_hospitalization, family_medical_history, lifestyle, exposure_history
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "medialert.db")

NEW_COLUMNS = [
    ("weight", "REAL"),
    ("symptom_severity_score", "INTEGER"),
    ("symptom_frequency", "TEXT"),
    ("associated_symptoms", "TEXT"),   # JSON stored as TEXT in SQLite
    ("recent_surgery_hospitalization", "TEXT"),
    ("family_medical_history", "TEXT"),
    ("lifestyle", "TEXT"),             # JSON stored as TEXT
    ("exposure_history", "TEXT"),      # JSON stored as TEXT
]

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("PRAGMA table_info(visits)")
    existing_cols = {row[1] for row in cur.fetchall()}

    added = []
    skipped = []
    for col_name, col_type in NEW_COLUMNS:
        if col_name in existing_cols:
            skipped.append(col_name)
            continue
        cur.execute(f"ALTER TABLE visits ADD COLUMN {col_name} {col_type}")
        added.append(col_name)

    conn.commit()
    conn.close()

    print(f"✅ Migration complete.")
    print(f"   Added columns:   {added or 'none'}")
    print(f"   Already existed: {skipped or 'none'}")

if __name__ == "__main__":
    migrate()
