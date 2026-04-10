"""报告相关：待办聚合、明日建议解析与过滤、提示词拼装。"""

from .aggregation import aggregate_day_for_todos, get_todos_for_date, get_todos_for_week
from .prompts import build_daily_prompt, build_weekly_prompt
from .tomorrow import (
    TOMORROW_JSON_END,
    TOMORROW_JSON_START,
    filter_tomorrow_suggestions_against_open,
    get_open_incomplete_titles,
    normalize_title_key,
    parse_daily_report_content,
)

__all__ = [
    "TOMORROW_JSON_END",
    "TOMORROW_JSON_START",
    "aggregate_day_for_todos",
    "build_daily_prompt",
    "build_weekly_prompt",
    "filter_tomorrow_suggestions_against_open",
    "get_open_incomplete_titles",
    "get_todos_for_date",
    "get_todos_for_week",
    "normalize_title_key",
    "parse_daily_report_content",
]
