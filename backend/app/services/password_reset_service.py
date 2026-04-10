import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.password_rules import validate_password_strength
from app.auth.security import get_password_hash
from app.models import PasswordResetToken, User

logger = logging.getLogger(__name__)

RESET_TOKEN_TTL_HOURS = int(os.getenv("PASSWORD_RESET_TOKEN_HOURS", "1"))


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _public_app_base() -> str:
    return os.getenv("PUBLIC_APP_URL", "http://localhost:5173").rstrip("/")


async def issue_reset_token_and_log_link(db: AsyncSession, user: User) -> None:
    """使旧未使用 token 失效，签发新 token，并将重置链接写入日志（当前环境不发邮件）。"""
    await db.execute(
        delete(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
    )
    raw = secrets.token_urlsafe(32)
    now = datetime.utcnow()
    expires = now + timedelta(hours=RESET_TOKEN_TTL_HOURS)
    row = PasswordResetToken(
        user_id=user.id,
        token_hash=_hash_token(raw),
        expires_at=expires,
        created_at=now,
    )
    db.add(row)
    await db.commit()
    url = f"{_public_app_base()}/reset-password?token={raw}"
    logger.info(
        "[password-reset] user_id=%s email=%s reset_url=%s (email disabled; check server logs)",
        user.id,
        user.email,
        url,
    )


async def validate_reset_token(db: AsyncSession, raw_token: str) -> bool:
    if not raw_token or len(raw_token) < 10:
        return False
    th = _hash_token(raw_token)
    now = datetime.utcnow()
    row = await db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == th,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
    )
    return row is not None


async def consume_reset_token_and_set_password(
    db: AsyncSession, raw_token: str, new_password: str
) -> None:
    validate_password_strength(new_password)
    th = _hash_token(raw_token)
    now = datetime.utcnow()
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == th,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise ValueError("链接无效或已过期")
    user = await db.get(User, row.user_id)
    if user is None or not user.is_active:
        raise ValueError("账号不可用")
    user.hashed_password = get_password_hash(new_password)
    row.used_at = now
    await db.commit()
