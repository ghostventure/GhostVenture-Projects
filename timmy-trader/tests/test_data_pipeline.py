from __future__ import annotations

from datetime import datetime, timedelta

from trend_trader.backtest import run_backtest
from trend_trader.config import load_config
from trend_trader.data import load_csv_bars, write_csv_bars
from trend_trader.market_data import _stooq_symbol, _yahoo_symbol
from trend_trader.models import Candle
from trend_trader.watchlist import load_watchlist, write_watchlist_template


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
