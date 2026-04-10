from __future__ import annotations

from datetime import date, timedelta
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Todo, TodoStatus

from .tomorrow import normalize_title_key


def _todo_snapshot_item(t: Todo) -> dict:
    """供日报事实材料使用的条目（含日期与期望截止）。"""
    due_d = t.due_date.date() if t.due_date else None
    created_d = t.created_at.date() if t.created_at else None
    completed_d = t.completed_at.date() if t.completed_at else None
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description or "",
        "tags": [tag.name for tag in t.tags],
        "location": t.location or "",
        "due_date": due_d.isoformat() if due_d else None,
        "created_date": created_d.isoformat() if created_d else None,
        "completed_date": completed_d.isoformat() if completed_d else None,
    }


def aggregate_day_for_todos(all_todos: Sequence[Todo], target_date: date) -> dict:
    """
    在内存中聚合某一「目标日」的待办统计（可测试、无 I/O）。
    与原先按日查询全表再循环的行为一致。
    """
    created_items: list[dict] = []
    completed_items: list[dict] = []
    completed_today_created_earlier: list[dict] = []
    early_completed_today: list[dict] = []
    incomplete_created_before_today: list[dict] = []
    overdue_incomplete: list[dict] = []

    for t in all_todos:
        created_day = t.created_at.date() if t.created_at else None
        completed_day = t.completed_at.date() if t.completed_at else None
        due_d = t.due_date.date() if t.due_date else None

        base_item = {
            "id": t.id,
            "title": t.title,
            "description": t.description or "",
            "tags": [tag.name for tag in t.tags],
            "location": t.location or "",
        }

        if created_day == target_date:
            created_items.append(base_item)
        if completed_day == target_date:
            completed_items.append(base_item)

        snap = _todo_snapshot_item(t)

        if completed_day == target_date and created_day is not None and created_day < target_date:
            completed_today_created_earlier.append(snap)
            if (
                due_d is not None
                and completed_day is not None
                and completed_day < due_d
            ):
                early_completed_today.append(snap)

        if t.status == TodoStatus.in_progress:
            if created_day is not None and created_day < target_date:
                incomplete_created_before_today.append(snap)
            if due_d is not None and due_d < target_date:
                overdue_incomplete.append(snap)

    overdue_ids = {x["id"] for x in overdue_incomplete}
    incomplete_carryover_not_overdue = [
        x for x in incomplete_created_before_today if x["id"] not in overdue_ids
    ]

    open_keys_seen: set[str] = set()
    open_incomplete_titles: list[str] = []
    for t in all_todos:
        if t.status != TodoStatus.in_progress:
            continue
        raw = (t.title or "").strip()
        if not raw:
            continue
        k = normalize_title_key(raw)
        if k in open_keys_seen:
            continue
        open_keys_seen.add(k)
        open_incomplete_titles.append(raw[:200])

    return {
        "date": target_date.isoformat(),
        "created": created_items,
        "completed": completed_items,
        "total_created": len(created_items),
        "total_completed": len(completed_items),
        "total_events": len(created_items) + len(completed_items),
        "completed_today_created_earlier": completed_today_created_earlier,
        "early_completed_today": early_completed_today,
        "incomplete_created_before_today": incomplete_created_before_today,
        "incomplete_carryover_not_overdue": incomplete_carryover_not_overdue,
        "overdue_incomplete": overdue_incomplete,
        "open_incomplete_titles": open_incomplete_titles,
    }


async def get_todos_for_date(db: AsyncSession, target_date: date, user_id: int) -> dict:
    """聚合某天的待办事件：当天创建、当天完成，以及跨日与期望截止日期相关事实。"""
    all_todos = (
        (await db.execute(select(Todo).where(Todo.user_id == user_id)))
        .scalars()
        .unique()
        .all()
    )
    return aggregate_day_for_todos(list(all_todos), target_date)


async def get_todos_for_week(db: AsyncSession, week_start: date, user_id: int) -> dict:
    """聚合某周：仅查询一次全量待办，再在内存中按日切分。"""
    week_end = week_start + timedelta(days=6)
    all_todos = (
        (await db.execute(select(Todo).where(Todo.user_id == user_id)))
        .scalars()
        .unique()
        .all()
    )
    todos_list = list(all_todos)

    daily_data: list[dict] = []
    total_created = 0
    total_completed = 0

    for i in range(7):
        day = week_start + timedelta(days=i)
        day_data = aggregate_day_for_todos(todos_list, day)
        daily_data.append(day_data)
        total_created += day_data["total_created"]
        total_completed += day_data["total_completed"]

    grand_total = total_created + total_completed
    completion_rate = (
        round(total_completed / grand_total * 100, 1) if grand_total > 0 else 0
    )

    open_incomplete_titles: list[str] = (
        (daily_data[-1].get("open_incomplete_titles") or []) if daily_data else []
    )

    return {
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "daily_data": daily_data,
        "summary": {
            "total_created": total_created,
            "total_completed": total_completed,
            "total_events": grand_total,
            "completion_rate": completion_rate,
        },
        "open_incomplete_titles": open_incomplete_titles,
    }
