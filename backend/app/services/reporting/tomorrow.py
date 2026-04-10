import json
import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Todo, TodoStatus

TOMORROW_JSON_START = "<<<TOMORROW_JSON"
TOMORROW_JSON_END = ">>>"


def normalize_title_key(title: str) -> str:
    """用于判断两条待办标题是否视为同一条（去首尾空白、折叠空白、大小写不敏感）。"""
    return " ".join(title.strip().casefold().split())


def filter_tomorrow_suggestions_against_open(
    suggestions: list[dict],
    open_titles: list[str],
) -> list[dict]:
    """
    去掉与当前未完成待办标题重复（规范化后相同）的明日建议，避免用户一键创建出重复待办。
    """
    blocked = {normalize_title_key(t) for t in open_titles if t and str(t).strip()}
    out: list[dict] = []
    seen: set[str] = set()
    for s in suggestions:
        if not isinstance(s, dict):
            continue
        title = s.get("title")
        if not title:
            continue
        title_s = str(title).strip()
        if not title_s:
            continue
        key = normalize_title_key(title_s)
        if key in blocked or key in seen:
            continue
        seen.add(key)
        out.append({"title": title_s[:200]})
    return out


async def get_open_incomplete_titles(db: AsyncSession, user_id: int) -> list[str]:
    """当前用户所有进行中待办的标题（规范化去重后保留首次出现的写法）。"""
    all_todos = (
        (await db.execute(select(Todo).where(Todo.user_id == user_id)))
        .scalars()
        .unique()
        .all()
    )
    seen_keys: set[str] = set()
    out: list[str] = []
    for t in all_todos:
        if t.status != TodoStatus.in_progress:
            continue
        raw = (t.title or "").strip()
        if not raw:
            continue
        k = normalize_title_key(raw)
        if k in seen_keys:
            continue
        seen_keys.add(k)
        out.append(raw[:200])
    return out


def parse_daily_report_content(raw: str) -> tuple[str, list[dict]]:
    """从模型输出中剥离明日建议 JSON 块，返回正文与 {title} 列表。"""
    pattern = re.compile(
        re.escape(TOMORROW_JSON_START) + r"\s*(\{.*\})\s*" + re.escape(TOMORROW_JSON_END),
        re.DOTALL,
    )
    m = pattern.search(raw)
    if not m:
        return raw.strip(), []
    cleaned = pattern.sub("", raw).strip()
    try:
        data = json.loads(m.group(1))
        items_in = data.get("items") if isinstance(data, dict) else None
        if not isinstance(items_in, list):
            return cleaned, []
        out: list[dict] = []
        for it in items_in:
            if isinstance(it, dict) and it.get("title"):
                title = str(it["title"]).strip()
                if title:
                    out.append({"title": title[:200]})
        return cleaned, out
    except (json.JSONDecodeError, TypeError, ValueError):
        return cleaned, []
