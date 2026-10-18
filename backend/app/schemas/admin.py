from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class AdminLogin(BaseModel):
    email: EmailStr
    password: str


class AdminOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    is_active: bool
    mfa_enabled: bool = False
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: AdminOut


class AdminCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "admin"  # "admin" or "super_admin"


class AdminUpdate(BaseModel):
    # `password` is present on the schema, but the router only allows it
    # when the caller is editing their OWN account (self-service password
    # change from the Super Admin's own Edit modal). Attempting to set it
    # on another admin's account is rejected in update_admin() — every
    # other admin must change their own password via /admin/security or
    # the forgot-password OTP flow (see AdminOTPRequest / AdminResetPasswordRequest).
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


# ── Forgot password (dev-mode OTP, mirrors patient OTP pattern) ─────────────
class AdminOTPRequest(BaseModel):
    email: EmailStr


class AdminResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str
    confirm_password: str


# ── MFA (Point 14 — admin two-factor authentication) ────────────────────────
class MFARequiredResponse(BaseModel):
    """Returned by /admin/login in place of TokenResponse when the account
    has MFA enabled — no session token is issued until the code verifies."""
    mfa_required: bool = True
    pending_token: str


class MFAVerifyLoginRequest(BaseModel):
    pending_token: str
    code: str = Field(..., min_length=6, max_length=6)


class MFASetupResponse(BaseModel):
    secret: str
    provisioning_uri: str
    qr_code_base64: str  # data:image/png;base64,... ready to drop into an <img src>


class MFAEnableRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class MFADisableRequest(BaseModel):
    password: str  # re-authentication required to lower security posture
