"""
One-time migration: adds risk_factors, symptom_duration, symptom_severity,
and symptom_onset columns to the existing `visits` table.

Run this ONCE from your project root:
    cd /Users/ayushdwivedi/Desktop/medialert_project
    source backend/venv/bin/activate
    python migrate_visit_clinical_context.py

Safe to re-run -- it checks which columns already exist before adding.
"""
import sqlite3

DB_PATH = "data/medialert.db"  # adjust if your DB lives elsewhere

NEW_COLUMNS = {
    "risk_factors": "JSON",
    "symptom_duration": "VARCHAR",
    "symptom_severity": "VARCHAR",
    "symptom_onset": "VARCHAR",
}

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(visits)")
    existing = {row[1] for row in cur.fetchall()}

    for col, coltype in NEW_COLUMNS.items():
        if col in existing:
            print(f"[skip] '{col}' already exists")
            continue
        cur.execute(f"ALTER TABLE visits ADD COLUMN {col} {coltype}")
        print(f"[added] '{col}' ({coltype})")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    main()
