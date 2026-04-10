"""兼容入口：自 `reporting` 子包再导出，供 `from app.services.report_service import …` 使用。"""

from app.services.reporting import (
    TOMORROW_JSON_END,
    TOMORROW_JSON_START,
    aggregate_day_for_todos,
    build_daily_prompt,
    build_weekly_prompt,
    filter_tomorrow_suggestions_against_open,
    get_open_incomplete_titles,
    get_todos_for_date,
    get_todos_for_week,
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
