from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.session import get_db
from app.models.issue import Issue, IssueResponse, IssueNote
from app.models.admin import Admin
from app.schemas.admin_issue import (
    IssueAdminOut, AssignRequest, RespondRequest, NoteRequest, StatusUpdateRequest,
    InvestigateRequest, RejectRequest,
)
from app.auth_admin import get_current_admin
from app.services.notification_service import notify_patient, notify_admin
from app.services.admin_activity_service import log_activity
from app.services.issue_service import (
    sweep_stale_issues, PENDING, UNDER_REVIEW, WAITING_FEEDBACK, CLOSED, REOPENED, REJECTED,
)

router = APIRouter()


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("/", response_model=List[IssueAdminOut])
def list_issues(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    assigned_to_me: bool = Query(False),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    sweep_stale_issues(db)  # auto-close anything overdue before returning the list

    q = db.query(Issue)
    if status:
        q = q.filter(Issue.status == status)
    if priority:
        q = q.filter(Issue.priority == priority)
    if category:
        q = q.filter(Issue.category == category)
    if assigned_to_me:
        q = q.filter(Issue.assigned_admin_id == admin.id)
    return q.order_by(Issue.created_at.desc()).all()


@router.get("/{issue_id}", response_model=IssueAdminOut)
def get_issue(issue_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue


@router.post("/{issue_id}/assign", response_model=IssueAdminOut)
def assign_issue(
    issue_id: int,
    data: AssignRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    target_admin = admin
    if data.admin_id and data.admin_id != admin.id:
        target_admin = db.query(Admin).filter(Admin.id == data.admin_id).first()
        if not target_admin:
            raise HTTPException(status_code=404, detail="Admin to assign to was not found")

    issue.assigned_admin_id = target_admin.id
    issue.assigned_admin_name = target_admin.name
    if issue.status == PENDING:
        issue.status = UNDER_REVIEW

    notify_admin(
        db, target_admin.id, "issue_assigned",
        f"Issue {issue.token_number} ({issue.category}) has been assigned to you.",
        link=f"/admin/issues/{issue.id}",
    )

    db.commit()
    db.refresh(issue)
    return issue


@router.post("/{issue_id}/accept", response_model=IssueAdminOut)
def accept_issue(
    issue_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Point 6: 'Accept'. Acknowledges the issue and moves it into active
    handling. Auto-assigns to the accepting admin if nobody's on it yet."""
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    if issue.status not in (PENDING, REOPENED):
        raise HTTPException(status_code=400, detail=f"Cannot accept an issue with status '{issue.status}'")

    issue.status = UNDER_REVIEW
    if not issue.assigned_admin_id:
        issue.assigned_admin_id = admin.id
        issue.assigned_admin_name = admin.name

    log_activity(
        db, admin, "Accepted Issue",
        details=f"Accepted issue {issue.token_number} ({issue.category})",
        ip_address=_client_ip(request),
    )

    db.commit()
    db.refresh(issue)
    return issue


@router.post("/{issue_id}/investigate", response_model=IssueAdminOut)
def investigate_issue(
    issue_id: int,
    data: InvestigateRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Point 6: 'Investigate'. Confirms/keeps the issue in active review —
    usable from Pending or already Under Review — and optionally records
    an internal note about what's being looked into."""
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    if issue.status not in (PENDING, UNDER_REVIEW, REOPENED):
        raise HTTPException(status_code=400, detail=f"Cannot investigate an issue with status '{issue.status}'")

    issue.status = UNDER_REVIEW

    if data.note and data.note.strip():
        db.add(IssueNote(issue_id=issue.id, admin_id=admin.id, admin_name=admin.name, note=data.note.strip()))

    log_activity(
        db, admin, "Investigated Issue",
        details=f"Investigating issue {issue.token_number} ({issue.category})",
        ip_address=_client_ip(request),
    )

    db.commit()
    db.refresh(issue)
    return issue


@router.post("/{issue_id}/respond", response_model=IssueAdminOut)
def respond_to_issue(
    issue_id: int,
    data: RespondRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Point 6: 'Resolve'. Sends the admin's resolution message to the
    patient. The issue moves straight to 'Waiting for Patient Feedback' —
    see services/issue_service.py for why 'Resolved' isn't stored as its
    own separate status."""
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    if issue.status in (CLOSED, REJECTED):
        raise HTTPException(status_code=400, detail=f"Cannot resolve an issue with status '{issue.status}'")

    response = IssueResponse(issue_id=issue.id, admin_id=admin.id, admin_name=admin.name, message=data.message)
    db.add(response)

    issue.status = WAITING_FEEDBACK
    # Reset any prior satisfaction response — this is a fresh resolution
    # cycle, so the patient should get a fresh Satisfied/Not Satisfied
    # prompt rather than staying locked out by a previous round's answer.
    issue.patient_satisfaction = None
    issue.satisfaction_at = None

    notify_patient(
        db, issue.patient_id, "issue_resolved",
        f"You have a response on issue {issue.token_number}. Please review and let us know if it's resolved.",
        link=f"/support-center/{issue.id}",
    )

    log_activity(
        db, admin, "Resolved Issue",
        details=f"Resolved issue {issue.token_number} ({issue.category})",
        ip_address=_client_ip(request),
    )

    db.commit()
    db.refresh(issue)
    return issue


@router.post("/{issue_id}/reject", response_model=IssueAdminOut)
def reject_issue(
    issue_id: int,
    data: RejectRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Point 6: 'Reject'. For issues the admin determines aren't valid.
    The reason is sent to the patient as a response (there's no separate
    rejection-reason column, so this reuses the existing responses table)."""
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    if issue.status in (CLOSED, REJECTED):
        raise HTTPException(status_code=400, detail=f"Cannot reject an issue with status '{issue.status}'")

    response = IssueResponse(
        issue_id=issue.id, admin_id=admin.id, admin_name=admin.name,
        message=f"This issue was reviewed and rejected. Reason: {data.reason}",
    )
    db.add(response)

    issue.status = REJECTED

    notify_patient(
        db, issue.patient_id, "issue_rejected",
        f"Issue {issue.token_number} was reviewed and rejected. Reason: {data.reason}",
        link=f"/support-center/{issue.id}",
    )

    log_activity(
        db, admin, "Rejected Issue",
        details=f"Rejected issue {issue.token_number} ({issue.category}) — {data.reason}",
        ip_address=_client_ip(request),
    )

    db.commit()
    db.refresh(issue)
    return issue


@router.post("/{issue_id}/notes", response_model=IssueAdminOut)
def add_internal_note(
    issue_id: int,
    data: NoteRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    note = IssueNote(issue_id=issue.id, admin_id=admin.id, admin_name=admin.name, note=data.note)
    db.add(note)
    db.commit()
    db.refresh(issue)
    return issue


@router.post("/{issue_id}/status", response_model=IssueAdminOut)
def update_status(
    issue_id: int,
    data: StatusUpdateRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Escape hatch for transitions that don't fit the named actions above."""
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue.status = data.status
    db.commit()
    db.refresh(issue)
    return issue


@router.post("/{issue_id}/close", response_model=IssueAdminOut)
def close_issue(issue_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue.status = CLOSED
    db.commit()
    db.refresh(issue)
    return issue
