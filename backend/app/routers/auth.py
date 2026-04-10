from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import (
    UserRegister,
    UserLogin,
    UserOut,
    TokenResponse,
    ChangePasswordRequest,
    ClaimLegacyOut,
    ResetPasswordValidateOut,
    ResetPasswordWithToken,
)
from app.auth.security import verify_password, get_password_hash, create_access_token
from app.services.legacy_claim import claim_legacy_data_for_user
from app.services.password_reset_service import (
    validate_reset_token,
    consume_reset_token_and_set_password,
)

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    email = str(payload.email).lower().strip()
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该邮箱已注册")
    user = User(email=email, hashed_password=get_password_hash(payload.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    email = str(payload.email).lower().strip()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账号已禁用")
    user.last_login_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)
    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="当前密码错误")
    current_user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()
    return {"ok": True}


@router.post("/claim-legacy-data", response_model=ClaimLegacyOut)
async def claim_legacy_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await claim_legacy_data_for_user(db, current_user)
    return ClaimLegacyOut.model_validate(data)


@router.get("/reset-password/validate", response_model=ResetPasswordValidateOut)
async def reset_password_validate(token: str, db: AsyncSession = Depends(get_db)):
    ok = await validate_reset_token(db, token)
    return ResetPasswordValidateOut(valid=ok)


@router.post("/reset-password")
async def reset_password_with_token(
    payload: ResetPasswordWithToken, db: AsyncSession = Depends(get_db)
):
    try:
        await consume_reset_token_and_set_password(db, payload.token, payload.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"ok": True}
