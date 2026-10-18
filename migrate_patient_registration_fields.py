"""
One-time migration: adds guardian_name, guardian_phone, preferred_language,
and consent_given columns to the existing `patients` table.

Run this ONCE from your project root:
    cd /Users/ayushdwivedi/Desktop/medialert_project
    source backend/venv/bin/activate
    python migrate_patient_registration_fields.py

Safe to re-run -- it checks which columns already exist before adding.
"""
import sqlite3

DB_PATH = "data/medialert.db"  # adjust if your DB lives elsewhere

NEW_COLUMNS = {
    "guardian_name": "VARCHAR DEFAULT ''",
    "guardian_phone": "VARCHAR DEFAULT ''",
    "preferred_language": "VARCHAR DEFAULT 'en'",
    "consent_given": "INTEGER DEFAULT 0",
}

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(patients)")
    existing = {row[1] for row in cur.fetchall()}

    for col, coltype in NEW_COLUMNS.items():
        if col in existing:
            print(f"[skip] '{col}' already exists")
            continue
        cur.execute(f"ALTER TABLE patients ADD COLUMN {col} {coltype}")
        print(f"[added] '{col}' ({coltype})")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    main()
