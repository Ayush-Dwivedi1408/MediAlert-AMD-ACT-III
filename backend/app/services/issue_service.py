from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.models.issue import Issue
from app.services.notification_service import notify_patient, notify_admin

# ── Status pipeline (Point 8) ───────────────────────────────────────────────
# Pending -> Under Review -> Waiting for Patient Feedback -> Closed (satisfied)
#                                                          -> Reopened (not satisfied)
# Pending / Under Review -> Rejected (admin determines the issue is invalid)
#
# Note: "Resolved" from the spec is treated as the *action* an admin takes
# (logged in the Activity Log as "Resolved Issue"), not a separate stored
# status — the moment an admin resolves something, it's already waiting on
# the patient, so we store that state directly rather than a status that
# would only be true for an instant.
PENDING = "Pending"
UNDER_REVIEW = "Under Review"
WAITING_FEEDBACK = "Waiting for Patient Feedback"
CLOSED = "Closed"
REOPENED = "Reopened"
REJECTED = "Rejected"

ALL_STATUSES = [PENDING, UNDER_REVIEW, WAITING_FEEDBACK, CLOSED, REOPENED, REJECTED]

# How long an issue can sit in "Waiting for Patient Feedback" with no response
# before it's auto-closed. Spec: "If the patient gives no response after a
# defined period, the issue can automatically move to Solved." Adjust freely.
AUTO_CLOSE_AFTER_DAYS = 7


def sweep_stale_issues(db: Session) -> int:
    """Auto-closes any issue that's been waiting on the patient for longer
    than AUTO_CLOSE_AFTER_DAYS with no satisfaction response. Called lazily
    at the top of issue-listing endpoints rather than via a background
    scheduler, since none exists in this stack yet. Returns the number of
    issues closed."""
    cutoff = datetime.utcnow() - timedelta(days=AUTO_CLOSE_AFTER_DAYS)
    stale = (
        db.query(Issue)
        .filter(Issue.status == WAITING_FEEDBACK, Issue.updated_at < cutoff)
        .all()
    )
    for issue in stale:
        issue.status = CLOSED
        issue.patient_satisfaction = "auto_closed_no_response"
        issue.satisfaction_at = datetime.utcnow()
        notify_patient(
            db, issue.patient_id, "issue_auto_closed",
            f"Issue {issue.token_number} was automatically closed after {AUTO_CLOSE_AFTER_DAYS} days with no response from you.",
            link=f"/support-center/{issue.id}",
        )
        if issue.assigned_admin_id:
            notify_admin(
                db, issue.assigned_admin_id, "issue_auto_closed",
                f"Issue {issue.token_number} was auto-closed after {AUTO_CLOSE_AFTER_DAYS} days of no patient response.",
                link=f"/admin/issues/{issue.id}",
            )
    if stale:
        db.commit()
    return len(stale)
