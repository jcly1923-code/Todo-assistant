"""reporting 子包纯函数单测（unittest，无 pytest 依赖）。"""
from __future__ import annotations

import unittest
from datetime import date, datetime
from types import SimpleNamespace

from app.models import TodoStatus
from app.services.reporting.aggregation import aggregate_day_for_todos
from app.services.reporting.tomorrow import (
    filter_tomorrow_suggestions_against_open,
    normalize_title_key,
    parse_daily_report_content,
)


def _tag(name: str) -> SimpleNamespace:
    return SimpleNamespace(name=name)


def _todo(
    *,
    tid: int = 1,
    title: str = "任务",
    created: datetime | None,
    completed: datetime | None = None,
    due: datetime | None = None,
    status: TodoStatus = TodoStatus.in_progress,
    tags: list[SimpleNamespace] | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=tid,
        title=title,
        description="",
        location="",
        created_at=created,
        completed_at=completed,
        due_date=due,
        status=status,
        tags=tags or [],
    )


class TestTomorrow(unittest.TestCase):
    def test_normalize_title_key(self) -> None:
        self.assertEqual(normalize_title_key("  A  B  "), normalize_title_key("a b"))

    def test_filter_tomorrow_dedupes_blocked(self) -> None:
        out = filter_tomorrow_suggestions_against_open(
            [{"title": "  Alpha  "}, {"title": "Beta"}],
            ["alpha"],
        )
        self.assertEqual(out, [{"title": "Beta"}])

    def test_parse_daily_strips_json_block(self) -> None:
        raw = "正文\n\n<<<TOMORROW_JSON\n{\"items\":[{\"title\":\"x\"}]}\n>>>\n"
        body, items = parse_daily_report_content(raw)
        self.assertIn("正文", body)
        self.assertEqual(items, [{"title": "x"}])


class TestAggregation(unittest.TestCase):
    def test_empty(self) -> None:
        d = aggregate_day_for_todos([], date(2025, 6, 1))
        self.assertEqual(d["total_events"], 0)
        self.assertEqual(d["open_incomplete_titles"], [])

    def test_created_on_day(self) -> None:
        day = date(2025, 6, 10)
        t = _todo(
            created=datetime(2025, 6, 10, 12, 0, 0),
            completed=None,
            status=TodoStatus.in_progress,
        )
        d = aggregate_day_for_todos([t], day)
        self.assertEqual(d["total_created"], 1)
        self.assertEqual(d["total_completed"], 0)


if __name__ == "__main__":
    unittest.main()
