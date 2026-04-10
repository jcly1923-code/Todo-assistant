import logging
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.deps import get_current_user
from app.models import DailyReport, WeeklyReport, ReportMethod, ReportScheduleConfig, User
from app.schemas import (
    DailyReportOut,
    TomorrowSuggestionItem,
    TomorrowSuggestionsUpdate,
    WeeklyReportOut,
    GenerateReportRequest,
    GenerateWeeklyReportRequest,
    ReportScheduleConfigOut,
    ReportScheduleConfigUpdate,
)
from app.timezone_util import validate_and_normalize_timezone
from app.services.report_service import (
    get_todos_for_date,
    get_todos_for_week,
    build_daily_prompt,
    build_weekly_prompt,
    parse_daily_report_content,
    filter_tomorrow_suggestions_against_open,
    get_open_incomplete_titles,
)
from app.services.ai_service import generate_report_content
from app.services.tone_service import get_tone_prompt_text
from app.scheduler import reload_scheduler

logger = logging.getLogger(__name__)
router = APIRouter()


async def _get_or_create_schedule_config(db: AsyncSession) -> ReportScheduleConfig:
    result = await db.execute(select(ReportScheduleConfig).order_by(ReportScheduleConfig.id.asc()))
    config = result.scalars().first()
    if config:
        return config
    config = ReportScheduleConfig()
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


def _validate_schedule_payload(payload: ReportScheduleConfigUpdate) -> None:
    if payload.daily_hour is not None and not (0 <= payload.daily_hour <= 23):
        raise HTTPException(status_code=400, detail="daily_hour 必须在 0-23 之间")
    if payload.daily_minute is not None and not (0 <= payload.daily_minute <= 59):
        raise HTTPException(status_code=400, detail="daily_minute 必须在 0-59 之间")
    if payload.weekly_day_of_week is not None and not (0 <= payload.weekly_day_of_week <= 6):
        raise HTTPException(status_code=400, detail="weekly_day_of_week 必须在 0-6 之间（周一=0）")
    if payload.weekly_hour is not None and not (0 <= payload.weekly_hour <= 23):
        raise HTTPException(status_code=400, detail="weekly_hour 必须在 0-23 之间")
    if payload.weekly_minute is not None and not (0 <= payload.weekly_minute <= 59):
        raise HTTPException(status_code=400, detail="weekly_minute 必须在 0-59 之间")
    if payload.timezone is not None:
        try:
            validate_and_normalize_timezone(payload.timezone)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e


# ---------- 日报 ----------


@router.get("/daily", response_model=list[DailyReportOut])
async def list_daily_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DailyReport)
        .where(DailyReport.user_id == current_user.id)
        .order_by(DailyReport.report_date.desc())
    )
    return [DailyReportOut.model_validate(r) for r in result.scalars().all()]


@router.get("/daily/{report_date}", response_model=DailyReportOut)
async def get_daily_report(
    report_date: date,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DailyReport).where(
            DailyReport.report_date == report_date,
            DailyReport.user_id == current_user.id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="该日期无日报")
    return DailyReportOut.model_validate(report)


@router.post("/daily/generate", response_model=DailyReportOut)
async def generate_daily_report(
    payload: GenerateReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """手动触发生成日报"""
    target_date = payload.target_date or date.today()

    existing = await db.execute(
        select(DailyReport).where(
            DailyReport.report_date == target_date,
            DailyReport.user_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"{target_date} 的日报已存在，无需重复生成")

    todo_data = await get_todos_for_date(db, target_date, current_user.id)

    if todo_data["total_events"] == 0:
        raise HTTPException(status_code=400, detail=f"{target_date} 暂无相关待办数据")

    tone = await get_tone_prompt_text(db, current_user.id)
    prompt = build_daily_prompt(todo_data, tone_profile=tone)

    try:
        raw_content = await generate_report_content(
            prompt, payload.ai_config, db=db, user_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("AI 日报生成失败")
        raise HTTPException(status_code=500, detail=f"AI 调用失败：{e}")

    clean_content, raw_suggestions = parse_daily_report_content(raw_content)

    stored = [s for s in raw_suggestions if isinstance(s, dict) and s.get("title")]
    stored = filter_tomorrow_suggestions_against_open(
        stored, todo_data.get("open_incomplete_titles") or []
    )
    report = DailyReport(
        user_id=current_user.id,
        report_date=target_date,
        content=clean_content,
        tomorrow_suggestions=stored if stored else None,
        method=ReportMethod.manual,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    return DailyReportOut.model_validate(report)


@router.patch("/daily/{report_date}/tomorrow-suggestions", response_model=DailyReportOut)
async def update_daily_tomorrow_suggestions(
    report_date: date,
    body: TomorrowSuggestionsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """用户接受部分明日建议后，更新剩余条目（与前端一致，避免刷新后重复展示）。"""
    result = await db.execute(
        select(DailyReport).where(
            DailyReport.report_date == report_date,
            DailyReport.user_id == current_user.id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="该日期无日报")
    items = [{"title": it.title.strip()[:200]} for it in body.items if it.title.strip()]
    items = filter_tomorrow_suggestions_against_open(
        items, await get_open_incomplete_titles(db, current_user.id)
    )
    report.tomorrow_suggestions = items if items else None
    await db.commit()
    await db.refresh(report)
    return DailyReportOut.model_validate(report)


@router.delete("/daily/{report_date}", status_code=204)
async def delete_daily_report(
    report_date: date,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DailyReport).where(
            DailyReport.report_date == report_date,
            DailyReport.user_id == current_user.id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="该日期无日报")
    await db.delete(report)
    await db.commit()


# ---------- 周报 ----------


@router.get("/weekly", response_model=list[WeeklyReportOut])
async def list_weekly_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WeeklyReport)
        .where(WeeklyReport.user_id == current_user.id)
        .order_by(WeeklyReport.week_start.desc())
    )
    return result.scalars().all()


@router.post("/weekly/generate", response_model=WeeklyReportOut)
async def generate_weekly_report(
    payload: GenerateWeeklyReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """手动触发生成周报"""
    if payload.week_start:
        ws = payload.week_start
    else:
        today = date.today()
        ws = today - timedelta(days=today.weekday())
    we = ws + timedelta(days=6)

    existing = await db.execute(
        select(WeeklyReport).where(
            WeeklyReport.week_start == ws,
            WeeklyReport.user_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"{ws} ~ {we} 的周报已存在")

    week_data = await get_todos_for_week(db, ws, current_user.id)

    if week_data["summary"]["total_events"] == 0:
        raise HTTPException(status_code=400, detail="本周暂无待办数据")

    tone = await get_tone_prompt_text(db, current_user.id)
    prompt = build_weekly_prompt(week_data, tone_profile=tone)

    try:
        content = await generate_report_content(
            prompt, payload.ai_config, db=db, user_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("AI 周报生成失败")
        raise HTTPException(status_code=500, detail=f"AI 调用失败：{e}")

    report = WeeklyReport(
        user_id=current_user.id,
        week_start=ws,
        week_end=we,
        content=content,
        method=ReportMethod.manual,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


@router.delete("/weekly/{report_id}", status_code=204)
async def delete_weekly_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WeeklyReport).where(
            WeeklyReport.id == report_id,
            WeeklyReport.user_id == current_user.id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="周报不存在")
    await db.delete(report)
    await db.commit()


@router.get("/schedule", response_model=ReportScheduleConfigOut)
async def get_schedule_config(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await _get_or_create_schedule_config(db)


@router.put("/schedule", response_model=ReportScheduleConfigOut)
async def update_schedule_config(
    payload: ReportScheduleConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _validate_schedule_payload(payload)
    config = await _get_or_create_schedule_config(db)
    updates = payload.model_dump(exclude_unset=True)
    if "timezone" in updates and updates["timezone"] is not None:
        updates["timezone"] = validate_and_normalize_timezone(updates["timezone"])
    for field, value in updates.items():
        setattr(config, field, value)
    await db.commit()
    await db.refresh(config)
    await reload_scheduler()
    return config
