from __future__ import annotations

from datetime import datetime, timedelta

from trend_trader.backtest import run_backtest
from trend_trader.config import load_config
from trend_trader.data import load_csv_bars, write_csv_bars
from trend_trader.market_data import _stooq_symbol, _yahoo_symbol
from trend_trader.market_universe import _parse_nasdaq_listed, _parse_other_listed
from trend_trader.models import Candle
from trend_trader.watchlist import load_watchlist, rotate_watchlist, write_watchlist_template
from trend_trader.strategy import score_symbol


def test_csv_roundtrip(tmp_path) -> None:
    path = tmp_path / "bars.csv"
    bars = {"SPY": [Candle("SPY", datetime(2026, 1, 1), 1, 2, 0.5, 1.5, 1000)]}
    write_csv_bars(path, bars)
    loaded = load_csv_bars(path)
    assert loaded["SPY"][0].close == 1.5


def test_watchlist_loader_dedupes_and_strips_comments(tmp_path) -> None:
    path = tmp_path / "watchlist.txt"
    path.write_text("spy\nQQQ # core\nspy\n", encoding="utf-8")
    assert load_watchlist(path) == ["QQQ", "SPY"]


def test_stooq_symbol_defaults_to_us_suffix() -> None:
    assert _stooq_symbol("SPY") == "spy.us"
    assert _stooq_symbol("btc.us") == "btc.us"


def test_yahoo_symbol_maps_crypto_pairs() -> None:
    assert _yahoo_symbol("BTCUSD") == "BTC-USD"
    assert _yahoo_symbol("SPY") == "SPY"


def test_watchlist_templates(tmp_path) -> None:
    path = tmp_path / "crypto.txt"
    write_watchlist_template(path, "crypto")
    assert "BTCUSD" in load_watchlist(path)


def test_watchlist_template_config(monkeypatch) -> None:
    monkeypatch.setenv("WATCHLIST_TEMPLATE", "commodity-etf")
    assert load_config().watchlist_template == "commodity-etf"


def test_market_universe_parsers_skip_test_and_non_common_symbols() -> None:
    nasdaq_payload = "\n".join([
        "Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares",
        "AAPL|Apple Inc. - Common Stock|Q|N|N|100|N|N",
        "ZVZZT|NASDAQ TEST STOCK|Q|Y|N|100|N|N",
        "ABCDW|Example Warrants|S|N|N|100|N|N",
        "BAD|Bad Status|S|N|D|100|N|N",
        "File Creation Time: 0723202600:00|||||||",
    ])
    other_payload = "\n".join([
        "ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol",
        "IBM|International Business Machines Corporation|N|IBM|N|100|N|IBM",
        "TEST|Test Issue|N|TEST|N|100|Y|TEST",
        "BRK.B|Berkshire Hathaway Inc.|N|BRK.B|N|100|N|BRK.B",
    ])

    assert _parse_nasdaq_listed(nasdaq_payload) == ["AAPL"]
    assert _parse_other_listed(other_payload) == ["IBM"]


def test_rotate_watchlist_replaces_quiet_symbols_with_movers() -> None:
    moving = score_symbol("SPY", _moving_bars("SPY", latest_move=3.0))
    quiet = score_symbol("DIA", _moving_bars("DIA", latest_move=0.1))
    candidate = score_symbol("MSFT", _moving_bars("MSFT", latest_move=3.3))

    rotated = rotate_watchlist(
        ["SPY", "DIA"],
        [quiet, moving, candidate],
        {"MSFT"},
        max_symbols=2,
        min_scout_score=42,
        quiet_scout_score=30,
    )

    assert "SPY" in rotated
    assert "MSFT" in rotated
    assert "DIA" not in rotated


def _moving_bars(symbol: str, latest_move: float) -> list[Candle]:
    start = datetime(2026, 1, 1, 9, 30)
    bars = []
    price = 100.0
    for index in range(60):
        price += 0.2
        bars.append(Candle(symbol, start + timedelta(minutes=index), price - 0.2, price + 0.4, price - 0.4, price, 1_000_000))
    previous = bars[-2].close
    close = previous * (1 + latest_move / 100)
    bars[-1] = Candle(symbol, bars[-1].timestamp, previous, close + 0.6, previous - 0.2, close, 2_000_000)
    return bars


def test_backtest_returns_summary(monkeypatch) -> None:
    monkeypatch.setenv("WEBULL_MAX_ORDER_NOTIONAL_USD", "1000")
    monkeypatch.setenv("REQUIRE_MARKET_HOURS", "0")
    start = datetime(2026, 1, 1, 9, 30)
    bars = []
    price = 100.0
    for index in range(90):
        price += 0.35
        if index % 12 == 0:
            price -= 0.2
        if index in {62, 75}:
            price += 3.0
        bars.append(Candle("SPY", start + timedelta(minutes=index), price - 0.2, price + 0.8, price - 0.8, price, 2_000_000))
    result = run_backtest({"SPY": bars}, load_config(), hold_bars=5)
    assert "summary" in result
    assert result["summary"]["total"] >= 0
