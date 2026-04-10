import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.base import JobLookupError
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED, EVENT_JOB_MISSED
from sqlalchemy import select
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from app.database import async_session
from app.models import ReportScheduleConfig
from app.jobs import _run_auto_daily_report, _run_auto_weekly_report
from app.timezone_util import normalize_iana_tz

logger = logging.getLogger(__name__)
# 必须在 asyncio 事件循环上跑任务：BackgroundScheduler + asyncio.run 会新建循环，
# 与 SQLAlchemy async 引擎/会话绑定的主循环不一致，导致定时任务失败或静默异常。
scheduler = AsyncIOScheduler()

_listener_registered = False


def _scheduler_event_listener(event):
    job_id = getattr(event, "job_id", "?")
    if event.code == EVENT_JOB_MISSED:
        logger.warning(
            '定时任务 "%s" 已错过计划时间（进程未运行或已过宽限期），将等待下次触发',
            job_id,
        )
    elif event.code == EVENT_JOB_ERROR:
        tb = getattr(event, "traceback", "") or ""
        logger.error(
            '定时任务 "%s" 执行失败: %s\n%s',
            job_id,
            getattr(event, "exception", "?"),
            tb,
        )
    elif event.code == EVENT_JOB_EXECUTED:
        logger.info('定时任务 "%s" 执行完成', job_id)


def _log_next_runs() -> None:
    for job in scheduler.get_jobs():
        logger.info("定时任务 next_run: id=%s time=%s", job.id, job.next_run_time)


def _weekday_to_apscheduler(day: int) -> str:
    mapping = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    return mapping[day]


def _remove_job_if_exists(job_id: str) -> None:
    try:
        scheduler.remove_job(job_id)
    except JobLookupError:
        return


async def _get_or_create_schedule_config() -> ReportScheduleConfig:
    async with async_session() as session:
        result = await session.execute(select(ReportScheduleConfig).order_by(ReportScheduleConfig.id.asc()))
        config = result.scalars().first()
        if config:
            return config
        config = ReportScheduleConfig()
        session.add(config)
        await session.commit()
        await session.refresh(config)
        return config


def _apply_schedule(config: ReportScheduleConfig) -> None:
    _remove_job_if_exists("auto_daily_report")
    _remove_job_if_exists("auto_weekly_report")

    tz_name = normalize_iana_tz(config.timezone or "Asia/Shanghai")
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        logger.warning("无效时区 %s，回退 Asia/Shanghai", tz_name)
        tz_name = "Asia/Shanghai"
        tz = ZoneInfo(tz_name)

    if config.daily_enabled:
        scheduler.add_job(
            _run_auto_daily_report,
            trigger="cron",
            hour=config.daily_hour,
            minute=config.daily_minute,
            timezone=tz,
            id="auto_daily_report",
            replace_existing=True,
            misfire_grace_time=3600,
            coalesce=True,
        )
    if config.weekly_enabled:
        scheduler.add_job(
            _run_auto_weekly_report,
            trigger="cron",
            day_of_week=_weekday_to_apscheduler(config.weekly_day_of_week),
            hour=config.weekly_hour,
            minute=config.weekly_minute,
            timezone=tz,
            id="auto_weekly_report",
            replace_existing=True,
            misfire_grace_time=3600,
            coalesce=True,
        )


async def start_scheduler():
    """启动定时任务调度器并应用数据库配置。"""
    global _listener_registered
    loop = asyncio.get_running_loop()
    if not scheduler.running:
        scheduler._eventloop = loop

    config = await _get_or_create_schedule_config()
    _apply_schedule(config)
    logger.info(
        "定时配置: tz=%s daily_enabled=%s %02d:%02d weekly_enabled=%s day=%d %02d:%02d",
        normalize_iana_tz(config.timezone or "Asia/Shanghai"),
        config.daily_enabled,
        config.daily_hour,
        config.daily_minute,
        config.weekly_enabled,
        config.weekly_day_of_week,
        config.weekly_hour,
        config.weekly_minute,
    )
    if not scheduler.running:
        if not _listener_registered:
            scheduler.add_listener(
                _scheduler_event_listener,
                EVENT_JOB_ERROR | EVENT_JOB_MISSED | EVENT_JOB_EXECUTED,
            )
            _listener_registered = True
        scheduler.start()
    _log_next_runs()


async def reload_scheduler():
    """根据最新配置热更新调度任务。"""
    if not scheduler.running:
        await start_scheduler()
        return
    scheduler._eventloop = asyncio.get_running_loop()
    config = await _get_or_create_schedule_config()
    _apply_schedule(config)
    _log_next_runs()
