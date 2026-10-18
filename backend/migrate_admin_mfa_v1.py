"""
Migration: add mfa_secret and mfa_enabled columns to the admins table
(Point 14 — Admin MFA / TOTP two-factor authentication).

Safe to re-run: checks whether the columns already exist first.

Run once from the backend/ directory:
    python migrate_admin_mfa_v1.py
"""
from app.db.session import engine
from sqlalchemy import text


def run():
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(admins)"))
        columns = [row[1] for row in result]

        added = []
        if "mfa_secret" not in columns:
            conn.execute(text("ALTER TABLE admins ADD COLUMN mfa_secret VARCHAR"))
            added.append("mfa_secret")
        if "mfa_enabled" not in columns:
            conn.execute(text("ALTER TABLE admins ADD COLUMN mfa_enabled INTEGER DEFAULT 0"))
            added.append("mfa_enabled")

        conn.commit()
        if added:
            print(f"Migration complete. Added columns: {', '.join(added)}")
        else:
            print("Columns already exist — nothing to do.")


if __name__ == "__main__":
    run()
