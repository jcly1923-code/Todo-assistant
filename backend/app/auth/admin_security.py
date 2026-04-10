import os
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import get_admin_jwt_secret

ADMIN_JWT_SECRET = get_admin_jwt_secret()
JWT_ALGORITHM = "HS256"
ADMIN_TOKEN_EXPIRE_DAYS = int(os.getenv("ADMIN_JWT_EXPIRE_DAYS", "7"))


def create_admin_access_token(admin_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ADMIN_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(admin_id), "exp": expire, "scope": "admin"}
    return jwt.encode(payload, ADMIN_JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_admin_access_token(token: str) -> int:
    try:
        payload = jwt.decode(token, ADMIN_JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("scope") != "admin":
            raise JWTError("not admin token")
        sub = payload.get("sub")
        if sub is None:
            raise JWTError("missing sub")
        return int(sub)
    except (JWTError, ValueError) as e:
        raise ValueError("无效或过期的管理员令牌") from e
