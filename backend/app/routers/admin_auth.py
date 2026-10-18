import base64
import io
import random

import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from jose import JWTError
from datetime import datetime, timedelta

from app.db.session import get_db
from app.models.admin import Admin
from app.models.admin_otp import AdminOTP
from app.schemas.admin import (
    AdminLogin, TokenResponse, MFARequiredResponse, MFAVerifyLoginRequest,
    MFASetupResponse, MFAEnableRequest, MFADisableRequest,
    AdminOTPRequest, AdminResetPasswordRequest,
)
from app.services.admin_security import (
    verify_password, hash_password, create_access_token, create_mfa_pending_token, decode_access_token,
)
from app.services.admin_activity_service import log_activity
from app.auth_admin import get_current_admin

router = APIRouter()

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 3


def _check_not_locked(admin: Admin):
    if admin.locked_until and admin.locked_until > datetime.utcnow():
        remaining = int((admin.locked_until - datetime.utcnow()).total_seconds())
        mins, secs = divmod(max(remaining, 0), 60)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed attempts. Try again in {mins}m {secs}s.",
        )


def _register_failed_attempt(db: Session, admin: Admin):
    """Shared by both the password and MFA-code stages — an attacker
    guessing either one still trips the same account-wide lockout."""
    admin.failed_login_attempts = (admin.failed_login_attempts or 0) + 1
    if admin.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
        admin.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed attempts. Account locked for {LOCKOUT_MINUTES} minutes.",
        )
    db.commit()


def _clear_failed_attempts(admin: Admin):
    admin.failed_login_attempts = 0
    admin.locked_until = None


def _client_ip(request: Request):
    return request.client.host if request.client else None


def _finish_login(db: Session, admin: Admin, request: Request) -> TokenResponse:
    """Shared by both the no-MFA path and the post-MFA-verify path — issues
    the real session token, updates last_login_at, and logs the event."""
    admin.last_login_at = datetime.utcnow()
    log_activity(
        db, admin, "Login",
        details=f"{admin.name} logged in" + (" (MFA)" if admin.mfa_enabled else ""),
        ip_address=_client_ip(request),
    )
    db.commit()
    db.refresh(admin)
    token = create_access_token(admin_id=admin.id, role=admin.role)
    return TokenResponse(access_token=token, admin=admin)


@router.post("/login")
def admin_login(data: AdminLogin, request: Request, db: Session = Depends(get_db)):
    admin = db.query(Admin).filter(Admin.email == data.email).first()

    if admin:
        _check_not_locked(admin)

    # Same generic error whether the email doesn't exist or the password is wrong,
    # so login attempts can't be used to enumerate valid admin emails.
    if not admin or not verify_password(data.password, admin.password_hash):
        if admin:
            _register_failed_attempt(db, admin)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not admin.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This admin account has been deactivated")

    _clear_failed_attempts(admin)
    db.commit()

    if admin.mfa_enabled:
        pending = create_mfa_pending_token(admin.id)
        return MFARequiredResponse(pending_token=pending)

    return _finish_login(db, admin, request)


@router.post("/mfa/verify-login", response_model=TokenResponse)
def verify_mfa_login(data: MFAVerifyLoginRequest, request: Request, db: Session = Depends(get_db)):
    try:
        payload = decode_access_token(data.pending_token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login session expired. Please log in again.")

    if payload.get("scope") != "mfa_pending":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid login session")

    admin = db.query(Admin).filter(Admin.id == payload.get("sub")).first()
    if not admin or not admin.is_active or not admin.mfa_enabled or not admin.mfa_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid login session")

    _check_not_locked(admin)

    totp = pyotp.TOTP(admin.mfa_secret)
    if not totp.verify(data.code, valid_window=1):  # ±30s clock drift tolerance
        _register_failed_attempt(db, admin)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect authentication code")

    _clear_failed_attempts(admin)
    return _finish_login(db, admin, request)


@router.post("/logout")
def admin_logout(request: Request, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    """The JWT itself isn't revoked server-side (it just expires naturally
    after 8 hours) — this endpoint exists purely to record the logout event
    in the activity log before the frontend clears its local token."""
    log_activity(
        db, admin, "Logout",
        details=f"{admin.name} logged out",
        ip_address=_client_ip(request),
    )
    db.commit()
    return {"status": "logged_out"}


@router.get("/me", response_model=None)
def get_me(admin: Admin = Depends(get_current_admin)):
    return {
        "id": admin.id,
        "name": admin.name,
        "email": admin.email,
        "role": admin.role,
        "is_active": bool(admin.is_active),
        "mfa_enabled": bool(admin.mfa_enabled),
    }


# ── Forgot password (dev-mode OTP — mirrors the patient OTP pattern in
# routers/patients.py) ───────────────────────────────────────────────────────
OTP_EXPIRY_MINUTES = 5
OTP_WINDOW_MINUTES = 10
OTP_MAX_REQUESTS_PER_WINDOW = 3
OTP_MAX_VERIFY_ATTEMPTS = 5


def _generate_otp_code() -> str:
    return f"{random.randint(0, 999999):06d}"


@router.post("/forgot-password/request")
def request_password_reset(data: AdminOTPRequest, db: Session = Depends(get_db)):
    admin = db.query(Admin).filter(Admin.email == data.email).first()
    if not admin:
        raise HTTPException(status_code=404, detail="No admin account found with this email")

    window_start = datetime.utcnow() - timedelta(minutes=OTP_WINDOW_MINUTES)
    recent_count = (
        db.query(AdminOTP)
        .filter(AdminOTP.admin_id == admin.id, AdminOTP.created_at >= window_start)
        .count()
    )
    if recent_count >= OTP_MAX_REQUESTS_PER_WINDOW:
        raise HTTPException(
            status_code=429,
            detail="Too many reset requests. Please wait a few minutes and try again.",
        )

    code = _generate_otp_code()
    otp = AdminOTP(
        admin_id=admin.id,
        code=code,
        purpose="reset_password",
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES),
    )
    db.add(otp)
    db.commit()

    # DEV MODE: the code is returned directly in the response instead of being
    # emailed. Swap this one spot for a real email provider call when ready
    # (e.g. SendGrid, SMTP) — expiry, rate-limiting, and verification below
    # don't need to change. Mirrors the dev_otp pattern in routers/patients.py.
    return {
        "status": "otp_sent",
        "dev_otp": code,  # ⚠️ dev-mode only — remove once real delivery is wired up
        "expires_in_seconds": OTP_EXPIRY_MINUTES * 60,
    }


@router.post("/forgot-password/reset")
def reset_password(data: AdminResetPasswordRequest, db: Session = Depends(get_db)):
    admin = db.query(Admin).filter(Admin.email == data.email).first()
    if not admin:
        raise HTTPException(status_code=404, detail="No admin account found with this email")

    if data.new_password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    otp = (
        db.query(AdminOTP)
        .filter(AdminOTP.admin_id == admin.id, AdminOTP.purpose == "reset_password", AdminOTP.used == 0)
        .order_by(AdminOTP.id.desc())
        .first()
    )
    if not otp:
        raise HTTPException(status_code=400, detail="No active reset request found. Please request a new code.")
    if otp.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Code has expired. Please request a new code.")
    if otp.attempts >= OTP_MAX_VERIFY_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Please request a new code.")
    if otp.code != data.code:
        otp.attempts += 1
        db.commit()
        raise HTTPException(status_code=401, detail="Incorrect code")

    otp.used = 1
    admin.password_hash = hash_password(data.new_password)
    # A successful reset also clears any login lockout — this is the
    # account-recovery path, so an admin locked out by failed password
    # attempts isn't left stuck even after proving ownership of the email.
    admin.failed_login_attempts = 0
    admin.locked_until = None
    log_activity(
        db, admin, "Reset Own Password",
        details=f"{admin.name} reset their password via forgot-password OTP",
        ip_address=None,
    )
    db.commit()
    return {"status": "password_reset"}
