"""
Migration: remap Issue.status values from the old ad-hoc enum
(Open / Assigned / Under Review / Resolved / Closed) to the new spec-aligned
pipeline (Pending / Under Review / Waiting for Patient Feedback / Closed /
Reopened / Rejected). No column/schema change — just a data remap.

Run once from the backend/ directory:
    python migrate_issue_status_v2.py
"""
from app.db.session import SessionLocal
from app.models.issue import Issue


def run():
    db = SessionLocal()
    try:
        issues = db.query(Issue).all()
        changed = 0
        for issue in issues:
            old_status = issue.status
            new_status = old_status

            if old_status == "Open":
                # Old code reused "Open" both for brand-new issues and for
                # issues reopened after a "not satisfied" response. Tell
                # them apart using patient_satisfaction.
                if issue.patient_satisfaction == "not_satisfied":
                    new_status = "Reopened"
                else:
                    new_status = "Pending"
            elif old_status == "Assigned":
                new_status = "Under Review"
            elif old_status == "Resolved":
                new_status = "Waiting for Patient Feedback"
            elif old_status == "Closed":
                new_status = "Closed"
            # Any status already matching the new enum (shouldn't happen on
            # a first run) is left untouched.

            if new_status != old_status:
                issue.status = new_status
                changed += 1

        db.commit()
        print(f"Migration complete. {changed} of {len(issues)} issue(s) remapped.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
