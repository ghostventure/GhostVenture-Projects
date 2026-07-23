from __future__ import annotations

from datetime import datetime, timedelta

from trend_trader.market_guards import (
    AccountRiskSnapshot,
    PositionSnapshot,
    QuoteSnapshot,
    daily_loss_circuit_breaker,
    liquidity_guard,
    market_trend_filter,
    max_drawdown_circuit_breaker,
    news_event_earnings_guard,
    per_symbol_exposure_guard,
    sector_industry_exposure,
    sector_industry_exposure_guard,
    spread_slippage_guard,
    volatility_regime,
)
from trend_trader.models import Candle


def test_daily_loss_and_drawdown_circuit_breakers_block_at_limits() -> None:
    account = AccountRiskSnapshot(equity=9_000, cash=2_000, day_pnl=-250, peak_equity=10_000)

    assert daily_loss_circuit_breaker(account, 200).status == "block"
    assert max_drawdown_circuit_breaker(account, 8).status == "block"


def test_symbol_and_sector_exposure_helpers() -> None:
    positions = (
        PositionSnapshot("AAPL", 2, 400, sector="Technology", industry="Consumer Electronics"),
        PositionSnapshot("MSFT", 1, 350, sector="Technology", industry="Software"),
    )

    assert per_symbol_exposure_guard("AAPL", positions, 150, 5_000, 12).passed
    assert per_symbol_exposure_guard("AAPL", positions, 300, 5_000, 12).status == "block"
    exposure = sector_industry_exposure(positions, 5_000)
    assert exposure["sector"]["Technology"] == 15.0
    assert sector_industry_exposure_guard(positions, 5_000, max_sector_pct=20, max_industry_pct=10).passed
    assert sector_industry_exposure_guard(positions, 5_000, max_sector_pct=10, max_industry_pct=10).status == "block"


def test_liquidity_and_spread_guards_block_thin_or_wide_quotes() -> None:
    liquid = QuoteSnapshot("SPY", bid=100.00, ask=100.02, last=100.01, volume=2_000_000, average_volume=1_500_000)
    thin = QuoteSnapshot("THIN", bid=10.00, ask=10.20, last=10.10, volume=12_000, average_volume=100_000)

    assert liquidity_guard(liquid).passed
    assert spread_slippage_guard(liquid, expected_fill_price=100.03).passed
    assert liquidity_guard(thin).status == "block"
    assert spread_slippage_guard(thin).status == "block"


def test_volatility_regime_and_market_trend_filter() -> None:
    start = datetime(2026, 1, 1, 9, 30)
    bars = [
        Candle("SPY", start + timedelta(minutes=index), 100, 101, 99.5, 100 + index * 0.05, 1_000_000)
        for index in range(25)
    ]
    downtrend = [
        Candle("SPY", start + timedelta(minutes=index), 100 - index, 101 - index, 99 - index, 100 - index, 1_000_000)
        for index in range(5)
    ]

    assert volatility_regime(bars).passed
    assert market_trend_filter(bars).status in {"pass", "caution"}
    assert market_trend_filter(downtrend).status == "block"


def test_news_event_earnings_guard_stub_blocks_known_events() -> None:
    assert news_event_earnings_guard("AAPL", {"AAPL": ("earnings",)}).status == "block"
    assert news_event_earnings_guard("MSFT", {"AAPL": ("earnings",)}).passed
    assert news_event_earnings_guard("SPY", None).passed
