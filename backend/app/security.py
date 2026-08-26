from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)
TOKEN_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def issue_access_token(user: User) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=8)
    return jwt.encode({"sub": str(user.id), "role": user.role.value, "exp": expires_at}, get_settings().jwt_secret, algorithm=TOKEN_ALGORITHM)


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme), db: Session = Depends(get_db)) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="يلزم تسجيل الدخول")
    try:
        claims = jwt.decode(credentials.credentials, get_settings().jwt_secret, algorithms=[TOKEN_ALGORITHM])
        user_id = int(claims["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="جلسة الدخول غير صالحة")
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="الحساب غير متاح")
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="هذه العملية متاحة للإدارة فقط")
    return user


def require_supplier(user: User = Depends(current_user)) -> User:
    if user.role != UserRole.supplier:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="هذه العملية متاحة للموردين فقط")
    return user
