import os
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = os.getenv("ADMIN_JWT_SECRET", "change-this-in-your-env-file")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("ADMIN_JWT_EXPIRE_MINUTES", "480"))  # 8 hours

# Short-lived, scope-restricted token issued after password verifies but
# before MFA verifies. It intentionally cannot be used on any protected
# admin route — see get_current_admin() in auth_admin.py, which rejects
# any token carrying this scope.
MFA_PENDING_EXPIRE_MINUTES = 5


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_access_token(admin_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {
        "sub": admin_id,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_mfa_pending_token(admin_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=MFA_PENDING_EXPIRE_MINUTES)
    payload = {
        "sub": admin_id,
        "scope": "mfa_pending",
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Raises jose.JWTError if invalid or expired."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
