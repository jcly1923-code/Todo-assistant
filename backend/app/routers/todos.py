from datetime import datetime, date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from app.database import get_db
from app.deps import get_current_user
from app.models import Todo, Tag, TodoStatus, User, todo_tag
from app.schemas import TodoCreate, TodoUpdate, TodoOut

router = APIRouter()


def _created_date_col():
    return func.date(Todo.created_at)


@router.get("/stats/summary")
async def todo_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """待办统计"""
    uid = current_user.id
    total = await db.scalar(select(func.count(Todo.id)).where(Todo.user_id == uid))
    completed = await db.scalar(
        select(func.count(Todo.id)).where(
            Todo.user_id == uid, Todo.status == TodoStatus.completed
        )
    )
    in_progress = await db.scalar(
        select(func.count(Todo.id)).where(
            Todo.user_id == uid, Todo.status == TodoStatus.in_progress
        )
    )
    return {
        "total": total or 0,
        "in_progress": in_progress or 0,
        "completed": completed or 0,
    }


@router.get("/", response_model=list[TodoOut])
async def list_todos(
    status: Optional[TodoStatus] = None,
    tag_id: Optional[int] = None,
    due_date: Optional[date] = None,
    expand_completed: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出待办。进行中始终全部返回；已完成默认仅最近 3 个日历日（含今天）创建的记录，expand_completed 时返回全部已完成。"""
    uid = current_user.id
    created = _created_date_col()
    today = date.today()
    window_start = today - timedelta(days=2)

    user_scope = Todo.user_id == uid

    if status == TodoStatus.in_progress:
        where_clause = and_(user_scope, Todo.status == TodoStatus.in_progress)
    elif status == TodoStatus.completed:
        if expand_completed:
            where_clause = and_(user_scope, Todo.status == TodoStatus.completed)
        else:
            where_clause = and_(
                user_scope,
                Todo.status == TodoStatus.completed,
                or_(
                    created > today,
                    and_(created >= window_start, created <= today),
                ),
            )
    else:
        cond_open = and_(user_scope, Todo.status == TodoStatus.in_progress)
        if expand_completed:
            cond_done = and_(user_scope, Todo.status == TodoStatus.completed)
        else:
            cond_done = and_(
                user_scope,
                Todo.status == TodoStatus.completed,
                or_(
                    created > today,
                    and_(created >= window_start, created <= today),
                ),
            )
        where_clause = or_(cond_open, cond_done)

    query = select(Todo).where(where_clause)

    if due_date is not None:
        start = datetime.combine(due_date, datetime.min.time())
        end = datetime.combine(due_date, datetime.max.time())
        query = query.where(Todo.due_date.between(start, end))
    if tag_id is not None:
        query = query.join(todo_tag).where(todo_tag.c.tag_id == tag_id)

    query = query.order_by(Todo.created_at.desc())
    result = await db.execute(query)
    return result.scalars().unique().all()


@router.post("/", response_model=TodoOut, status_code=201)
async def create_todo(
    payload: TodoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建待办"""
    todo = Todo(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        location=payload.location,
        due_date=payload.due_date,
        completed_at=datetime.utcnow() if payload.status == TodoStatus.completed else None,
    )
    if payload.created_at is not None:
        todo.created_at = payload.created_at

    if payload.tag_ids:
        result = await db.execute(
            select(Tag).where(
                Tag.id.in_(payload.tag_ids),
                Tag.user_id == current_user.id,
            )
        )
        tags = result.scalars().all()
        if len(tags) != len(payload.tag_ids):
            raise HTTPException(status_code=400, detail="部分标签不存在")
        todo.tags = list(tags)

    db.add(todo)
    await db.commit()
    await db.refresh(todo)
    return todo


@router.get("/{todo_id}", response_model=TodoOut)
async def get_todo(
    todo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取单个待办详情"""
    result = await db.execute(
        select(Todo).where(Todo.id == todo_id, Todo.user_id == current_user.id)
    )
    todo = result.scalar_one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="待办不存在")
    return todo


@router.put("/{todo_id}", response_model=TodoOut)
async def update_todo(
    todo_id: int,
    payload: TodoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新待办"""
    result = await db.execute(
        select(Todo).where(Todo.id == todo_id, Todo.user_id == current_user.id)
    )
    todo = result.scalar_one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="待办不存在")

    update_data = payload.model_dump(exclude_unset=True)
    prev_status = todo.status
    tag_ids = update_data.pop("tag_ids", None)

    for field, value in update_data.items():
        setattr(todo, field, value)

    if "status" in update_data:
        new_status = todo.status
        if prev_status != TodoStatus.completed and new_status == TodoStatus.completed:
            todo.completed_at = datetime.utcnow()
        elif prev_status == TodoStatus.completed and new_status != TodoStatus.completed:
            todo.completed_at = None

    if tag_ids is not None:
        result = await db.execute(
            select(Tag).where(
                Tag.id.in_(tag_ids),
                Tag.user_id == current_user.id,
            )
        )
        tags = result.scalars().all()
        if len(tags) != len(tag_ids):
            raise HTTPException(status_code=400, detail="部分标签不存在")
        todo.tags = list(tags)

    todo.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(todo)
    return todo


@router.delete("/{todo_id}", status_code=204)
async def delete_todo(
    todo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除待办"""
    result = await db.execute(
        select(Todo).where(Todo.id == todo_id, Todo.user_id == current_user.id)
    )
    todo = result.scalar_one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="待办不存在")
    await db.delete(todo)
    await db.commit()
