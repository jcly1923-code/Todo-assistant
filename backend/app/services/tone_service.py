"""自写日报语气库：样本聚合、重建摘要、供日报/周报 prompt 注入。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserToneProfile, WritingSample
from app.services.ai_service import learn_writing_style_from_samples

MAX_SAMPLES_PER_USER = 30
MAX_BODY_CHARS = 20000
MAX_COMBINED_CHARS = 24000
MAX_STORED_PROFILE_CHARS = 12000


async def _get_or_create_profile(db: AsyncSession, user_id: int) -> UserToneProfile:
    r = await db.execute(select(UserToneProfile).where(UserToneProfile.user_id == user_id))
    row = r.scalar_one_or_none()
    if row:
        return row
    row = UserToneProfile(user_id=user_id, tone_enabled=False)
    db.add(row)
    await db.flush()
    return row


async def get_tone_prompt_text(db: AsyncSession, user_id: int) -> Optional[str]:
    """开启语气且已有摘要时返回文本，供 build_*_prompt 注入；否则 None。"""
    r = await db.execute(select(UserToneProfile).where(UserToneProfile.user_id == user_id))
    row = r.scalar_one_or_none()
    if not row or not row.tone_enabled:
        return None
    t = (row.profile_text or "").strip()
    return t if t else None


async def rebuild_tone_profile(db: AsyncSession, user_id: int) -> None:
    """在样本增删改后调用：无样本则清空并关闭开关；否则调用 AI 提炼语气。"""
    row = await _get_or_create_profile(db, user_id)
    n = await db.scalar(
        select(func.count()).select_from(WritingSample).where(WritingSample.user_id == user_id)
    )
    if not n:
        row.profile_text = None
        row.last_error = None
        row.tone_enabled = False
        row.updated_at = datetime.utcnow()
        return

    result = await db.execute(
        select(WritingSample)
        .where(WritingSample.user_id == user_id)
        .order_by(WritingSample.id.asc())
    )
    samples = result.scalars().all()

    parts: list[str] = []
    total = 0
    for s in samples:
        body = (s.body or "")[:MAX_BODY_CHARS]
        chunk = f"## {s.title}\n{body}\n\n"
        if total + len(chunk) > MAX_COMBINED_CHARS:
            break
        parts.append(chunk)
        total += len(chunk)
    combined = "".join(parts)

    try:
        text = await learn_writing_style_from_samples(combined, db=db, user_id=user_id)
        row.profile_text = (text or "")[:MAX_STORED_PROFILE_CHARS] or None
        row.last_error = None
    except Exception as e:
        row.last_error = str(e)[:4000]
    row.updated_at = datetime.utcnow()
