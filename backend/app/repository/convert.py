from datetime import UTC, datetime


def as_utc(value: datetime | None) -> datetime | None:
    """SQLite возвращает наивные даты; в БД всегда лежит UTC, возвращаем с tzinfo."""
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=UTC)


def required_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)
