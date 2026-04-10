"""IANA 时区规范化与校验（定时任务、设置保存共用）。"""

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

_ALIASES: dict[str, str] = {
    "asia/beijing": "Asia/Shanghai",
    "beijing": "Asia/Shanghai",
    "china": "Asia/Shanghai",
    "prc": "Asia/Shanghai",
    "utc+8": "Asia/Shanghai",
    "gmt+8": "Asia/Shanghai",
}


def normalize_iana_tz(name: str | None) -> str:
    n = (name or "").strip()
    if not n:
        return "Asia/Shanghai"
    key = n.lower().replace(" ", "_")
    return _ALIASES.get(key, n)


def validate_and_normalize_timezone(name: str | None) -> str:
    """返回可写入数据库的 IANA 名称；无效则抛 ValueError。"""
    normalized = normalize_iana_tz(name)
    try:
        ZoneInfo(normalized)
    except ZoneInfoNotFoundError as e:
        raise ValueError(
            f"无效的 IANA 时区「{name}」。请从列表选择（中国大陆请选 Asia/Shanghai，勿使用 Beijing）。"
        ) from e
    return normalized
