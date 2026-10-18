"""
One-time migration: adds crisis_flag / crisis_message columns to the existing
`mental_health_screenings` table. These were always computed (score_phq9 /
score_gad7 return them) but never persisted -- so history and the AI summary
could never see them. This fixes that.

Run this ONCE from your project root:
    cd /Users/ayushdwivedi/Desktop/medialert_project
    source backend/venv/bin/activate
    python migrate_mental_health_crisis.py

Safe to re-run -- it checks which columns already exist before adding.
"""
import sqlite3

DB_PATH = "data/medialert.db"  # adjust if your DB lives elsewhere

NEW_COLUMNS = {
    "crisis_flag": "INTEGER DEFAULT 0",
    "crisis_message": "VARCHAR",
}

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(mental_health_screenings)")
    existing = {row[1] for row in cur.fetchall()}

    for col, coltype in NEW_COLUMNS.items():
        if col in existing:
            print(f"[skip] '{col}' already exists")
            continue
        cur.execute(f"ALTER TABLE mental_health_screenings ADD COLUMN {col} {coltype}")
        print(f"[added] '{col}' ({coltype})")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    main()
