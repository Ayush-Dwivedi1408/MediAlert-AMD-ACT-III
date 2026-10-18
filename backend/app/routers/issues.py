from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.db.session import get_db
from app.models.issue import Issue
from app.models.patient import Patient
from app.schemas.issue import IssueCreate, IssueOut, SatisfactionRequest
from app.services.notification_service import notify_all_admins, notify_admin
from app.services.issue_service import sweep_stale_issues, PENDING, WAITING_FEEDBACK, CLOSED, REOPENED

router = APIRouter()


@router.post("/", response_model=IssueOut)
def report_issue(data: IssueCreate, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    issue = Issue(
        patient_id=data.patient_id,
        category=data.category,
        description=data.description,
        priority=data.priority,
        related_change_number=data.related_change_number,
        screenshot_path=data.screenshot_path,
        status=PENDING,
    )
    db.add(issue)
    db.flush()  # get issue.id + generated token_number before notifying

    notify_all_admins(
        db,
        "issue_reported",
        f"New {issue.priority} priority issue reported by {patient.name} ({patient.id}): {issue.category}",
        link=f"/admin/issues/{issue.id}",
    )

    db.commit()
    db.refresh(issue)
    return issue


@router.get("/patient/{patient_id}", response_model=List[IssueOut])
def list_patient_issues(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    sweep_stale_issues(db)  # auto-close anything overdue before returning the list

    return (
        db.query(Issue)
        .filter(Issue.patient_id == patient_id)
        .order_by(Issue.created_at.desc())
        .all()
    )


@router.get("/{issue_id}", response_model=IssueOut)
def get_issue(issue_id: int, db: Session = Depends(get_db)):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue


@router.post("/{issue_id}/satisfaction", response_model=IssueOut)
def submit_satisfaction(issue_id: int, data: SatisfactionRequest, db: Session = Depends(get_db)):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    if issue.status != WAITING_FEEDBACK:
        raise HTTPException(status_code=400, detail="Issue must be awaiting your feedback before satisfaction can be recorded")

    issue.patient_satisfaction = data.satisfaction
    issue.satisfaction_at = datetime.utcnow()

    if data.satisfaction == "not_satisfied":
        issue.status = REOPENED  # per spec: automatically reopens
        if issue.assigned_admin_id:
            notify_admin(
                db, issue.assigned_admin_id, "issue_reopened",
                f"Issue {issue.token_number} was reopened — patient marked the resolution as not satisfactory.",
                link=f"/admin/issues/{issue.id}",
            )
        else:
            notify_all_admins(
                db, "issue_reopened",
                f"Issue {issue.token_number} was reopened — patient marked the resolution as not satisfactory.",
                link=f"/admin/issues/{issue.id}",
            )
    else:
        issue.status = CLOSED

    db.commit()
    db.refresh(issue)
    return issue
