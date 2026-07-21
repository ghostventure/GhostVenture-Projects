from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

MARKET_TZ = ZoneInfo("America/New_York")
REGULAR_OPEN = time(9, 30)
REGULAR_CLOSE = time(16, 0)
EARLY_CLOSE = time(13, 0)

NYSE_FULL_CLOSES_2026 = {
    date(2026, 1, 1),
    date(2026, 1, 19),
    date(2026, 2, 16),
    date(2026, 4, 3),
    date(2026, 5, 25),
    date(2026, 6, 19),
    date(2026, 7, 3),
    date(2026, 9, 7),
    date(2026, 11, 26),
    date(2026, 12, 25),
}

NYSE_EARLY_CLOSES_2026 = {
    date(2026, 11, 27): EARLY_CLOSE,
    date(2026, 12, 24): EARLY_CLOSE,
}


@dataclass(frozen=True)
class MarketSession:
    is_open: bool
    opens_at: datetime | None
    closes_at: datetime | None
    reason: str


def market_session(now: datetime | None = None) -> MarketSession:
    current = now.astimezone(MARKET_TZ) if now else datetime.now(tz=MARKET_TZ)
    today = current.date()
    if not _is_trading_day(today):
        next_open = next_market_open(current)
        return MarketSession(False, next_open, None, "market closed")

    opens_at = datetime.combine(today, REGULAR_OPEN, tzinfo=MARKET_TZ)
    closes_at = datetime.combine(today, NYSE_EARLY_CLOSES_2026.get(today, REGULAR_CLOSE), tzinfo=MARKET_TZ)
    if current < opens_at:
        return MarketSession(False, opens_at, closes_at, "before market open")
    if current > closes_at:
        return MarketSession(False, next_market_open(current), closes_at, "after market close")
    return MarketSession(True, opens_at, closes_at, "regular session open")


def next_market_open(now: datetime | None = None) -> datetime:
    current = now.astimezone(MARKET_TZ) if now else datetime.now(tz=MARKET_TZ)
    candidate = current.date()
    if _is_trading_day(candidate) and current.time() < REGULAR_OPEN:
        return datetime.combine(candidate, REGULAR_OPEN, tzinfo=MARKET_TZ)
    candidate += timedelta(days=1)
    while not _is_trading_day(candidate):
        candidate += timedelta(days=1)
    return datetime.combine(candidate, REGULAR_OPEN, tzinfo=MARKET_TZ)


def seconds_until_next_open(now: datetime | None = None) -> int:
    current = now.astimezone(MARKET_TZ) if now else datetime.now(tz=MARKET_TZ)
    return max(1, int((next_market_open(current) - current).total_seconds()))


def _is_trading_day(day: date) -> bool:
    if day.weekday() >= 5:
        return False
    return day not in NYSE_FULL_CLOSES_2026
