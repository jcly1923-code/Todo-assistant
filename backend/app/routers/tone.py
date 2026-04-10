"""自写日报语气库：样本 CRUD、开关、重建摘要。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User, UserToneProfile, WritingSample
from app.schemas import (
    TONE_SAMPLES_MAX,
    ToneSettingsPatch,
    ToneStatusOut,
    WritingSampleCreate,
    WritingSampleOut,
    WritingSampleUpdate,
)
from app.services.tone_service import rebuild_tone_profile

router = APIRouter()


async def _profile_row(db: AsyncSession, user_id: int) -> Optional[UserToneProfile]:
    r = await db.execute(select(UserToneProfile).where(UserToneProfile.user_id == user_id))
    return r.scalar_one_or_none()


@router.get("/status", response_model=ToneStatusOut)
async def tone_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = await db.scalar(
        select(func.count()).select_from(WritingSample).where(WritingSample.user_id == current_user.id)
    )
    row = await _profile_row(db, current_user.id)
    return ToneStatusOut(
        tone_enabled=bool(row and row.tone_enabled),
        profile_text=row.profile_text if row else None,
        last_error=row.last_error if row else None,
        sample_count=int(n or 0),
        samples_max=TONE_SAMPLES_MAX,
        profile_updated_at=row.updated_at if row else None,
    )


@router.get("/samples", response_model=list[WritingSampleOut])
async def list_samples(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(
        select(WritingSample)
        .where(WritingSample.user_id == current_user.id)
        .order_by(WritingSample.id.desc())
    )
    return [WritingSampleOut.model_validate(x) for x in r.scalars().all()]


@router.post("/samples", response_model=WritingSampleOut)
async def create_sample(
    body: WritingSampleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = await db.scalar(
        select(func.count()).select_from(WritingSample).where(WritingSample.user_id == current_user.id)
    )
    if (n or 0) >= TONE_SAMPLES_MAX:
        raise HTTPException(status_code=400, detail=f"最多保存 {TONE_SAMPLES_MAX} 条自写日报")
    s = WritingSample(user_id=current_user.id, title=body.title.strip(), body=body.body.strip())
    db.add(s)
    await db.flush()
    await rebuild_tone_profile(db, current_user.id)
    await db.commit()
    await db.refresh(s)
    return WritingSampleOut.model_validate(s)


@router.patch("/samples/{sample_id}", response_model=WritingSampleOut)
async def update_sample(
    sample_id: int,
    body: WritingSampleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(
        select(WritingSample).where(
            WritingSample.id == sample_id,
            WritingSample.user_id == current_user.id,
        )
    )
    s = r.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="样本不存在")
    data = body.model_dump(exclude_unset=True)
    if not data:
        return WritingSampleOut.model_validate(s)
    if "title" in data and data["title"] is not None:
        s.title = data["title"].strip()
    if "body" in data and data["body"] is not None:
        s.body = data["body"].strip()
    await db.flush()
    await rebuild_tone_profile(db, current_user.id)
    await db.commit()
    await db.refresh(s)
    return WritingSampleOut.model_validate(s)


@router.delete("/samples/{sample_id}", status_code=204)
async def delete_sample(
    sample_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(
        select(WritingSample).where(
            WritingSample.id == sample_id,
            WritingSample.user_id == current_user.id,
        )
    )
    s = r.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="样本不存在")
    await db.delete(s)
    await db.flush()
    await rebuild_tone_profile(db, current_user.id)
    await db.commit()


@router.delete("/samples", status_code=204)
async def clear_samples(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(delete(WritingSample).where(WritingSample.user_id == current_user.id))
    await db.flush()
    await rebuild_tone_profile(db, current_user.id)
    await db.commit()


@router.patch("/settings", response_model=ToneStatusOut)
async def patch_tone_settings(
    body: ToneSettingsPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(select(UserToneProfile).where(UserToneProfile.user_id == current_user.id))
    row = r.scalar_one_or_none()
    if not row:
        row = UserToneProfile(user_id=current_user.id, tone_enabled=body.tone_enabled)
        db.add(row)
    else:
        row.tone_enabled = body.tone_enabled
    await db.commit()
    await db.refresh(row)
    n = await db.scalar(
        select(func.count()).select_from(WritingSample).where(WritingSample.user_id == current_user.id)
    )
    return ToneStatusOut(
        tone_enabled=row.tone_enabled,
        profile_text=row.profile_text,
        last_error=row.last_error,
        sample_count=int(n or 0),
        samples_max=TONE_SAMPLES_MAX,
        profile_updated_at=row.updated_at,
    )


@router.post("/rebuild", response_model=ToneStatusOut)
async def post_rebuild(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await rebuild_tone_profile(db, current_user.id)
    await db.commit()
    row = await _profile_row(db, current_user.id)
    n = await db.scalar(
        select(func.count()).select_from(WritingSample).where(WritingSample.user_id == current_user.id)
    )
    return ToneStatusOut(
        tone_enabled=bool(row and row.tone_enabled),
        profile_text=row.profile_text if row else None,
        last_error=row.last_error if row else None,
        sample_count=int(n or 0),
        samples_max=TONE_SAMPLES_MAX,
        profile_updated_at=row.updated_at if row else None,
    )
