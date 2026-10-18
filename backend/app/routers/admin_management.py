from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.admin import Admin
from app.schemas.admin import AdminOut, AdminCreate, AdminUpdate
from app.services.admin_security import hash_password
from app.auth_admin import get_current_admin, require_super_admin
from app.services.notification_service import notify_all_super_admins
from app.services.admin_activity_service import log_activity

router = APIRouter()

VALID_ROLES = {"admin", "super_admin"}


def make_next_admin_id(db: Session) -> str:
    """AD001, AD002, AD003... based on the highest existing numeric suffix.
    Not reused if an admin is ever removed, so IDs stay unique over time."""
    admins = db.query(Admin.id).all()
    max_num = 0
    for (admin_id,) in admins:
        if admin_id.startswith("AD") and admin_id[2:].isdigit():
            max_num = max(max_num, int(admin_id[2:]))
    return f"AD{max_num + 1:03d}"


@router.get("/", response_model=List[AdminOut])
def list_admins(db: Session = Depends(get_db), current: Admin = Depends(get_current_admin)):
    return db.query(Admin).order_by(Admin.id).all()


@router.get("/{admin_id}", response_model=AdminOut)
def get_admin(admin_id: str, db: Session = Depends(get_db), current: Admin = Depends(get_current_admin)):
    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    return admin


@router.post("/", response_model=AdminOut)
def create_admin(
    data: AdminCreate,
    request: Request,
    db: Session = Depends(get_db),
    current: Admin = Depends(require_super_admin),
):
    if data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {sorted(VALID_ROLES)}")

    existing = db.query(Admin).filter(Admin.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An admin with this email already exists")

    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    admin = Admin(
        id=make_next_admin_id(db),
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
        is_active=1,
    )
    db.add(admin)
    db.flush()  # get admin.id before notifying
 
    notify_all_super_admins(
        db, "admin_added",
        f"New admin {admin.name} ({admin.id}) was added by {current.name}.",
        link="/admin/manage",
    )

    log_activity(
        db, current, "Added New Admin",
        details=f"Added admin {admin.name} ({admin.id}) with role {admin.role}",
        ip_address=request.client.host if request.client else None,
    )
 
    db.commit()
    db.refresh(admin)
    return admin


@router.put("/{admin_id}", response_model=AdminOut)
def update_admin(
    admin_id: str,
    data: AdminUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current: Admin = Depends(require_super_admin),
):
    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    ip = request.client.host if request.client else None

    if data.email is not None and data.email != admin.email:
        clash = db.query(Admin).filter(Admin.email == data.email, Admin.id != admin_id).first()
        if clash:
            raise HTTPException(status_code=400, detail="Another admin already uses this email")
        admin.email = data.email

    if data.name is not None:
        admin.name = data.name

    if data.role is not None:
        if data.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"role must be one of {sorted(VALID_ROLES)}")
        if admin.id == current.id and data.role != "super_admin":
            raise HTTPException(status_code=400, detail="You cannot demote your own account")
        admin.role = data.role

    if data.is_active is not None:
        if admin.id == current.id and not data.is_active:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
        if bool(admin.is_active) != bool(data.is_active):
            log_activity(
                db, current, "Activated Admin" if data.is_active else "Deactivated Admin",
                details=f"{admin.name} ({admin.id})",
                ip_address=ip,
            )
        admin.is_active = 1 if data.is_active else 0

    if data.password is not None:
        # Self-service only: a Super Admin editing someone ELSE's account
        # cannot set that person's password from here — they must change it
        # themselves via /admin/security, or reset it via forgot-password OTP.
        if admin.id != current.id:
            raise HTTPException(
                status_code=403,
                detail="You can only change your own password here. Other admins must change "
                       "their own password via My Security, or reset it via forgot-password.",
            )
        if len(data.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        admin.password_hash = hash_password(data.password)
        log_activity(
            db, current, "Changed Own Password",
            details=f"{admin.name} ({admin.id}) changed their own password via Admin Management",
            ip_address=ip,
        )

    db.commit()
    db.refresh(admin)
    return admin
