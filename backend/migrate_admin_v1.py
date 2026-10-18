"""
Phase A migration: creates the `admins` table and seeds the first Super Admin.

Run from the backend/ directory with the venv active:
    python migrate_admin_v1.py

Safe to re-run: skips seeding if any admin already exists.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import engine, SessionLocal
from app.db.base import Base
from app.models.admin import Admin
from app.services.admin_security import hash_password

import getpass


def run():
    print("Creating admins table if it does not exist...")
    Base.metadata.create_all(bind=engine)
    print("Done.")

    db = SessionLocal()
    try:
        existing = db.query(Admin).count()
        if existing > 0:
            print(f"{existing} admin(s) already exist. Skipping seed step.")
            return

        print("\nNo admins found. Let's create the first Super Admin.\n")
        name = input("Super Admin name: ").strip()
        email = input("Super Admin email: ").strip()
        password = getpass.getpass("Super Admin password: ").strip()
        confirm = getpass.getpass("Confirm password: ").strip()

        if password != confirm:
            print("Passwords do not match. Aborting — re-run the script to try again.")
            return
        if len(password) < 8:
            print("Password must be at least 8 characters. Aborting.")
            return

        admin = Admin(
            id="AD001",
            name=name,
            email=email,
            password_hash=hash_password(password),
            role="super_admin",
            is_active=1,
        )
        db.add(admin)
        db.commit()
        print(f"\nSuper Admin created: {admin.id} ({admin.email})")
    finally:
        db.close()


if __name__ == "__main__":
    run()
