"""定时任务逻辑：日报/周报自动生成（由 AsyncIOScheduler 直接调度 async 函数）。"""
import logging
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from sqlalchemy import select
from app.database import async_session
from app.models import DailyReport, WeeklyReport, ReportMethod, ReportScheduleConfig, User
from app.services.report_service import (
    get_todos_for_date,
    get_todos_for_week,
    build_daily_prompt,
    build_weekly_prompt,
    parse_daily_report_content,
    filter_tomorrow_suggestions_against_open,
)
from app.services.ai_service import generate_report_content
from app.services.tone_service import get_tone_prompt_text
from app.timezone_util import normalize_iana_tz

logger = logging.getLogger(__name__)


async def _resolve_local_today(session) -> date:
    result = await session.execute(select(ReportScheduleConfig).order_by(ReportScheduleConfig.id.asc()))
    cfg = result.scalars().first()
    tz_name = normalize_iana_tz(cfg.timezone if cfg and cfg.timezone else "Asia/Shanghai")
    try:
        return datetime.now(ZoneInfo(tz_name)).date()
    except ZoneInfoNotFoundError:
        logger.warning("无效时区 %s，自动任务回退系统日期", tz_name)
        return date.today()


async def _run_auto_daily_report() -> None:
    """按用户自动生成今日日报"""
    logger.info("自动日报定时任务已触发，开始执行")
    async with async_session() as session:
        try:
            target_date = await _resolve_local_today(session)
            users = (
                await session.execute(select(User).where(User.is_active.is_(True)))
            ).scalars().all()
            for user in users:
                existing = await session.execute(
                    select(DailyReport).where(
                        DailyReport.report_date == target_date,
                        DailyReport.user_id == user.id,
                    )
                )
                if existing.scalar_one_or_none():
                    continue

                todo_data = await get_todos_for_date(session, target_date, user.id)
                if todo_data["total_events"] == 0:
                    continue

                tone = await get_tone_prompt_text(session, user.id)
                prompt = build_daily_prompt(todo_data, tone_profile=tone)
                try:
                    raw_content = await generate_report_content(
                        prompt, db=session, user_id=user.id
                    )
                except ValueError as e:
                    logger.warning(
                        "用户 %s 跳过自动日报（无可用 AI 凭据）: %s",
                        user.id,
                        e,
                    )
                    continue
                clean_content, raw_suggestions = parse_daily_report_content(raw_content)
                stored = [s for s in raw_suggestions if isinstance(s, dict) and s.get("title")]
                stored = filter_tomorrow_suggestions_against_open(
                    stored, todo_data.get("open_incomplete_titles") or []
                )

                report = DailyReport(
                    user_id=user.id,
                    report_date=target_date,
                    content=clean_content,
                    tomorrow_suggestions=stored if stored else None,
                    method=ReportMethod.auto,
                )
                session.add(report)
            await session.commit()
            logger.info(f"自动日报任务完成: {target_date}，用户数 {len(users)}")
        except Exception as e:
            logger.exception(f"自动日报生成失败: {e}")
            await session.rollback()
            raise


async def _run_auto_weekly_report() -> None:
    """按用户自动生成本周周报"""
    logger.info("自动周报定时任务已触发，开始执行")
    async with async_session() as session:
        try:
            today = await _resolve_local_today(session)
            week_start = today - timedelta(days=today.weekday())
            week_end = week_start + timedelta(days=6)
            users = (
                await session.execute(select(User).where(User.is_active.is_(True)))
            ).scalars().all()
            for user in users:
                existing = await session.execute(
                    select(WeeklyReport).where(
                        WeeklyReport.week_start == week_start,
                        WeeklyReport.user_id == user.id,
                    )
                )
                if existing.scalar_one_or_none():
                    continue

                week_data = await get_todos_for_week(session, week_start, user.id)
                if week_data["summary"]["total_events"] == 0:
                    continue

                tone = await get_tone_prompt_text(session, user.id)
                prompt = build_weekly_prompt(week_data, tone_profile=tone)
                try:
                    content = await generate_report_content(
                        prompt, db=session, user_id=user.id
                    )
                except ValueError as e:
                    logger.warning(
                        "用户 %s 跳过自动周报（无可用 AI 凭据）: %s",
                        user.id,
                        e,
                    )
                    continue

                report = WeeklyReport(
                    user_id=user.id,
                    week_start=week_start,
                    week_end=week_end,
                    content=content,
                    method=ReportMethod.auto,
                )
                session.add(report)
            await session.commit()
            logger.info(f"自动周报任务完成: {week_start} ~ {week_end}，用户数 {len(users)}")
        except Exception as e:
            logger.exception(f"自动周报生成失败: {e}")
            await session.rollback()
            raise
