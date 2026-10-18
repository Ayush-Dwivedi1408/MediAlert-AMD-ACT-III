"""
Migration: add account-lockout tracking columns (Point 14 — Security
Features) to both the admins and patients tables.

  admins:   failed_login_attempts, locked_until
  patients: failed_pin_attempts, pin_locked_until

Safe to re-run: checks whether each column already exists first.

Run once from the backend/ directory:
    python migrate_account_lockout_v1.py
"""
from app.db.session import engine
from sqlalchemy import text


def _add_column_if_missing(conn, table, column, ddl):
    result = conn.execute(text(f"PRAGMA table_info({table})"))
    columns = [row[1] for row in result]
    if column in columns:
        return False
    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))
    return True


def run():
    with engine.connect() as conn:
        added = []

        if _add_column_if_missing(conn, "admins", "failed_login_attempts", "failed_login_attempts INTEGER DEFAULT 0"):
            added.append("admins.failed_login_attempts")
        if _add_column_if_missing(conn, "admins", "locked_until", "locked_until DATETIME"):
            added.append("admins.locked_until")

        if _add_column_if_missing(conn, "patients", "failed_pin_attempts", "failed_pin_attempts INTEGER DEFAULT 0"):
            added.append("patients.failed_pin_attempts")
        if _add_column_if_missing(conn, "patients", "pin_locked_until", "pin_locked_until DATETIME"):
            added.append("patients.pin_locked_until")

        conn.commit()
        if added:
            print(f"Migration complete. Added columns: {', '.join(added)}")
        else:
            print("Columns already exist — nothing to do.")


if __name__ == "__main__":
    run()
