from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps_admin import get_current_admin
from app.models import AdminUser, User
from app.schemas import (
    AdminLogin,
    AdminOut,
    AdminTokenResponse,
    AdminUserListItem,
    AdminUserListResponse,
    AdminUserPatch,
    RequestResetResponse,
)
from app.auth.security import verify_password
from app.auth.admin_security import create_admin_access_token
from app.services.password_reset_service import issue_reset_token_and_log_link

router = APIRouter()

_RESET_MSG = "若用户存在，已生成重置链接（请查看服务端日志；接入邮件后将发送至邮箱）"


@router.post("/login", response_model=AdminTokenResponse)
async def admin_login(payload: AdminLogin, db: AsyncSession = Depends(get_db)):
    email = str(payload.email).lower().strip()
    result = await db.execute(select(AdminUser).where(AdminUser.email == email))
    admin = result.scalar_one_or_none()
    if admin is None or not verify_password(payload.password, admin.hashed_password):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    if not admin.is_active:
        raise HTTPException(status_code=403, detail="账号已禁用")
    admin.last_login_at = datetime.utcnow()
    await db.commit()
    await db.refresh(admin)
    token = create_admin_access_token(admin.id)
    return AdminTokenResponse(
        access_token=token,
        admin=AdminOut.model_validate(admin),
    )


@router.get("/me", response_model=AdminOut)
async def admin_me(admin: AdminUser = Depends(get_current_admin)):
    return AdminOut.model_validate(admin)


@router.get("/users", response_model=AdminUserListResponse)
async def admin_list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    total = await db.scalar(select(func.count()).select_from(User)) or 0
    q = (
        select(User.id, User.email, User.created_at, User.last_login_at, User.is_active)
        .order_by(User.id.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    items = [
        AdminUserListItem(
            id=r[0],
            email=r[1],
            created_at=r[2],
            last_login_at=r[3],
            is_active=r[4],
        )
        for r in rows
    ]
    return AdminUserListResponse(items=items, total=int(total or 0))


@router.patch("/users/{user_id}", response_model=AdminUserListItem)
async def admin_patch_user(
    user_id: int,
    payload: AdminUserPatch,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    if payload.is_active is not None:
        user.is_active = payload.is_active
    await db.commit()
    await db.refresh(user)
    return AdminUserListItem(
        id=user.id,
        email=user.email,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        is_active=user.is_active,
    )


@router.post("/users/{user_id}/request-password-reset", response_model=RequestResetResponse)
async def admin_request_password_reset(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    user = await db.get(User, user_id)
    if user is not None:
        await issue_reset_token_and_log_link(db, user)
    return RequestResetResponse(message=_RESET_MSG)
