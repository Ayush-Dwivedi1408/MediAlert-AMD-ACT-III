"""
One-time migration: adds the missing vitals columns to the existing
`followups` table so previously-collected (and future) vitals actually persist.

Run this ONCE from your project root:
    cd /Users/ayushdwivedi/Desktop/medialert_project
    source backend/venv/bin/activate
    python migrate_followup_vitals.py

Safe to re-run -- it checks which columns already exist before adding.
"""
import sqlite3

DB_PATH = "data/medialert.db"  # adjust if your DB lives elsewhere

NEW_COLUMNS = {
    "pulse": "FLOAT",
    "spo2": "FLOAT",
    "temperature": "FLOAT",
    "blood_pressure": "VARCHAR",
    "respiratory_rate": "FLOAT",
}

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(followups)")
    existing = {row[1] for row in cur.fetchall()}

    for col, coltype in NEW_COLUMNS.items():
        if col in existing:
            print(f"[skip] '{col}' already exists")
            continue
        cur.execute(f"ALTER TABLE followups ADD COLUMN {col} {coltype}")
        print(f"[added] '{col}' ({coltype})")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    main()
