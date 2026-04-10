from typing import Any

from sqlalchemy import delete, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_bootstrap_user_email_for_claim
from app.models import DailyReport, Tag, Todo, User, WeeklyReport, todo_tag


async def _relink_todo_tag(session: AsyncSession, old_tag_id: int, new_tag_id: int) -> None:
    r = await session.execute(select(todo_tag.c.todo_id).where(todo_tag.c.tag_id == old_tag_id))
    todo_ids = [row[0] for row in r.all()]
    for tid in todo_ids:
        dup = (
            await session.execute(
                select(todo_tag.c.todo_id).where(
                    todo_tag.c.todo_id == tid,
                    todo_tag.c.tag_id == new_tag_id,
                )
            )
        ).first()
        if dup:
            await session.execute(
                delete(todo_tag).where(
                    todo_tag.c.todo_id == tid,
                    todo_tag.c.tag_id == old_tag_id,
                )
            )
        else:
            await session.execute(
                update(todo_tag)
                .where(
                    todo_tag.c.todo_id == tid,
                    todo_tag.c.tag_id == old_tag_id,
                )
                .values(tag_id=new_tag_id)
            )


async def claim_legacy_data_for_user(session: AsyncSession, current: User) -> dict[str, Any]:
    """
    1) 将 user_id 为 NULL 的待办挂到当前用户（旧库残留）。
    2) 若存在 BOOTSTRAP_USER_EMAIL 对应用户且不是当前用户，将其待办/标签/报告合并到当前用户后删除该用户。
    """
    out: dict[str, Any] = {
        "orphan_todos_attached": 0,
        "bootstrap_user_found": False,
        "bootstrap_email": None,
        "moved_todos_from_bootstrap": 0,
        "tags_reassigned_or_merged": 0,
        "removed_bootstrap_user": False,
        "message": "",
    }

    r_null = await session.execute(
        text("UPDATE todos SET user_id = :uid WHERE user_id IS NULL"),
        {"uid": current.id},
    )
    out["orphan_todos_attached"] = r_null.rowcount if r_null.rowcount is not None else 0

    bootstrap_email = get_bootstrap_user_email_for_claim()
    out["bootstrap_email"] = bootstrap_email

    if bootstrap_email is None:
        out["message"] = "未配置 BOOTSTRAP_USER_EMAIL；已将无主待办（若有）挂到当前账号。"
        await session.commit()
        return out

    res = await session.execute(select(User).where(User.email == bootstrap_email))
    bootstrap = res.scalar_one_or_none()
    if bootstrap is None:
        out["message"] = "未找到迁移用引导账户，已将无主待办（若有）挂到当前账号。"
        await session.commit()
        return out

    out["bootstrap_user_found"] = True
    if bootstrap.id == current.id:
        out["message"] = "当前已是引导账户；已将无主待办（若有）挂到当前账号。"
        await session.commit()
        return out

    tags = (await session.execute(select(Tag).where(Tag.user_id == bootstrap.id))).scalars().all()
    tag_ops = 0
    for tag in tags:
        ex = await session.scalar(
            select(Tag).where(Tag.user_id == current.id, Tag.name == tag.name)
        )
        if ex:
            await _relink_todo_tag(session, tag.id, ex.id)
            await session.delete(tag)
        else:
            tag.user_id = current.id
        tag_ops += 1
    out["tags_reassigned_or_merged"] = tag_ops

    r_todos = await session.execute(
        update(Todo).where(Todo.user_id == bootstrap.id).values(user_id=current.id)
    )
    out["moved_todos_from_bootstrap"] = r_todos.rowcount if r_todos.rowcount is not None else 0

    await session.execute(
        text(
            """
            UPDATE daily_reports
            SET user_id = :cid
            WHERE user_id = :bid
            AND NOT EXISTS (
                SELECT 1 FROM daily_reports d2
                WHERE d2.user_id = :cid AND d2.report_date = daily_reports.report_date
            )
            """
        ),
        {"cid": current.id, "bid": bootstrap.id},
    )
    await session.execute(delete(DailyReport).where(DailyReport.user_id == bootstrap.id))

    await session.execute(
        text(
            """
            UPDATE weekly_reports
            SET user_id = :cid
            WHERE user_id = :bid
            AND NOT EXISTS (
                SELECT 1 FROM weekly_reports w2
                WHERE w2.user_id = :cid AND w2.week_start = weekly_reports.week_start
            )
            """
        ),
        {"cid": current.id, "bid": bootstrap.id},
    )
    await session.execute(delete(WeeklyReport).where(WeeklyReport.user_id == bootstrap.id))

    # 勿用 session.delete(bootstrap)：ORM 仍可能把已迁走的待办当作子项并执行 user_id=NULL，违反 NOT NULL。
    bootstrap_id = bootstrap.id
    await session.execute(delete(User).where(User.id == bootstrap_id))
    out["removed_bootstrap_user"] = True
    out["message"] = (
        "已将引导账户下的待办、标签与报告合并到当前账号，并移除引导账户。"
        " 若某日/某周报告在您账号下已存在，则仅保留您账号下原有记录。"
    )

    await session.commit()
    return out
