from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from trend_trader.market_calendar import market_session, next_market_open

NY = ZoneInfo("America/New_York")


def test_market_open_regular_session() -> None:
    session = market_session(datetime(2026, 7, 20, 10, 0, tzinfo=NY))
    assert session.is_open
    assert session.reason == "regular session open"


def test_market_closed_on_2026_independence_observed() -> None:
    session = market_session(datetime(2026, 7, 3, 10, 0, tzinfo=NY))
    assert not session.is_open
    assert next_market_open(datetime(2026, 7, 3, 10, 0, tzinfo=NY)).date().isoformat() == "2026-07-06"


def test_market_early_close_black_friday_2026() -> None:
    open_session = market_session(datetime(2026, 11, 27, 12, 30, tzinfo=NY))
    closed_session = market_session(datetime(2026, 11, 27, 13, 30, tzinfo=NY))
    assert open_session.is_open
    assert not closed_session.is_open
