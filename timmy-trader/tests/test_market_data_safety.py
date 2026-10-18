from __future__ import annotations

import json
from datetime import datetime

import pytest

from trend_trader import market_data
from trend_trader.models import Candle


def test_fetch_parallel_filters_invalid_symbols_and_malformed_bars() -> None:
    requested: list[str] = []

    def fetch_one(symbol: str) -> list[Candle]:
        requested.append(symbol)
        return [
            Candle(symbol, datetime(2026, 1, 1), 10, 11, 9, 10.5, 100),
            Candle(symbol, datetime(2026, 1, 2), 10, 9, 8, 10.5, 100),
            Candle(symbol, datetime(2026, 1, 3), 10, float("nan"), 9, 10.5, 100),
        ]

    result = market_data._fetch_parallel([" spy ", "SPY", "bad/symbol", ""], fetch_one, 10, 2)

    assert requested == ["SPY"]
    assert len(result["SPY"]) == 1
    assert result["SPY"][0].close == 10.5


def test_fetch_parallel_discards_timezone_aware_candles() -> None:
    aware = Candle("SPY", datetime.fromisoformat("2026-01-01T00:00:00+00:00"), 10, 11, 9, 10.5, 100)

    assert market_data._fetch_parallel(["SPY"], lambda _symbol: [aware], 10, 1) == {}


@pytest.mark.parametrize(
    "kwargs",
    [
        {"days": 0},
        {"days": -1},
        {"timeout": 0},
        {"timeout": float("inf")},
        {"max_workers": 0},
    ],
)
def test_fetch_rejects_unsafe_or_invalid_options(kwargs: dict[str, object]) -> None:
    options = {"days": 90, "timeout": 10, "max_workers": 2}
    options.update(kwargs)
    with pytest.raises(ValueError):
        market_data.fetch_yahoo_daily([], **options)


def test_yahoo_parser_uses_timezone_independent_timestamps(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = {
        "chart": {
            "result": [{
                "timestamp": [1767225600],
                "indicators": {"quote": [{
                    "open": [10], "high": [12], "low": [9], "close": [11], "volume": [1000],
                }]},
            }],
        },
    }

    class Response:
        def __enter__(self) -> "Response":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def read(self) -> bytes:
            return json.dumps(payload).encode()

    monkeypatch.setattr(market_data, "urlopen", lambda *_args, **_kwargs: Response())
    candle = market_data._fetch_one_yahoo_symbol("SPY")[0]

    assert candle.timestamp == datetime(2026, 1, 1)


def test_yahoo_parser_skips_bad_timestamp_without_dropping_good_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = {
        "chart": {
            "result": [{
                "timestamp": [float("nan"), 1767225600],
                "indicators": {"quote": [{
                    "open": [10, 10], "high": [12, 12], "low": [9, 9],
                    "close": [11, 11], "volume": [1000, 1000],
                }]},
            }],
        },
    }

    class Response:
        def __enter__(self) -> "Response":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def read(self) -> bytes:
            return json.dumps(payload).encode()

    monkeypatch.setattr(market_data, "urlopen", lambda *_args, **_kwargs: Response())
    candles = market_data._fetch_one_yahoo_symbol("SPY")

    assert len(candles) == 1
    assert candles[0].timestamp == datetime(2026, 1, 1)


def test_fetch_one_rejects_url_path_injection_before_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def unexpected_network(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("invalid ticker must not create a request")

    monkeypatch.setattr(market_data, "urlopen", unexpected_network)
    with pytest.raises(ValueError, match="unsupported characters"):
        market_data._fetch_one_yahoo_symbol("SPY/../../anything")
