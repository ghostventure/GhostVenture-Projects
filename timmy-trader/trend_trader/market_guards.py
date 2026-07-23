from __future__ import annotations

from dataclasses import dataclass
from statistics import mean
from typing import Iterable, Mapping

from .models import Candle


@dataclass(frozen=True)
class GuardResult:
    name: str
    status: str
    reason: str
    value: float | str | None = None
    threshold: float | str | None = None

    @property
    def passed(self) -> bool:
        return self.status == "pass"


@dataclass(frozen=True)
class QuoteSnapshot:
    symbol: str
    bid: float
    ask: float
    last: float
    volume: float
    average_volume: float | None = None


@dataclass(frozen=True)
class PositionSnapshot:
    symbol: str
    quantity: float
    market_value: float
    sector: str | None = None
    industry: str | None = None


@dataclass(frozen=True)
class AccountRiskSnapshot:
    equity: float
    cash: float
    day_pnl: float = 0.0
    peak_equity: float | None = None


def daily_loss_circuit_breaker(account: AccountRiskSnapshot, max_daily_loss_usd: float) -> GuardResult:
    loss = max(0.0, -account.day_pnl)
    if loss >= max_daily_loss_usd:
        return GuardResult("daily-loss", "block", f"daily loss {loss:.2f} reached limit", loss, max_daily_loss_usd)
    return GuardResult("daily-loss", "pass", f"daily loss {loss:.2f} is inside limit", loss, max_daily_loss_usd)


def max_drawdown_circuit_breaker(account: AccountRiskSnapshot, max_drawdown_pct: float) -> GuardResult:
    if not account.peak_equity or account.peak_equity <= 0:
        return GuardResult("max-drawdown", "unknown", "peak equity is unavailable", None, max_drawdown_pct)
    drawdown_pct = max(0.0, (account.peak_equity - account.equity) / account.peak_equity * 100)
    if drawdown_pct >= max_drawdown_pct:
        return GuardResult("max-drawdown", "block", f"drawdown {drawdown_pct:.2f}% reached limit", drawdown_pct, max_drawdown_pct)
    return GuardResult("max-drawdown", "pass", f"drawdown {drawdown_pct:.2f}% is inside limit", drawdown_pct, max_drawdown_pct)


def per_symbol_exposure_guard(
    symbol: str,
    positions: Iterable[PositionSnapshot],
    next_notional: float,
    account_equity: float,
    max_symbol_exposure_pct: float,
) -> GuardResult:
    current = sum(position.market_value for position in positions if position.symbol.upper() == symbol.upper())
    projected_pct = (current + next_notional) / account_equity * 100 if account_equity > 0 else 100.0
    if projected_pct > max_symbol_exposure_pct:
        return GuardResult("symbol-exposure", "block", f"{symbol.upper()} exposure would be {projected_pct:.2f}%", projected_pct, max_symbol_exposure_pct)
    return GuardResult("symbol-exposure", "pass", f"{symbol.upper()} exposure would be {projected_pct:.2f}%", projected_pct, max_symbol_exposure_pct)


def sector_industry_exposure(
    positions: Iterable[PositionSnapshot],
    account_equity: float,
) -> dict[str, dict[str, float]]:
    sector_totals: dict[str, float] = {}
    industry_totals: dict[str, float] = {}
    for position in positions:
        if position.sector:
            sector_totals[position.sector] = sector_totals.get(position.sector, 0.0) + position.market_value
        if position.industry:
            industry_totals[position.industry] = industry_totals.get(position.industry, 0.0) + position.market_value
    return {
        "sector": _exposure_percentages(sector_totals, account_equity),
        "industry": _exposure_percentages(industry_totals, account_equity),
    }


def sector_industry_exposure_guard(
    positions: Iterable[PositionSnapshot],
    account_equity: float,
    max_sector_pct: float,
    max_industry_pct: float,
) -> GuardResult:
    exposures = sector_industry_exposure(positions, account_equity)
    largest_sector = max(exposures["sector"].items(), key=lambda item: item[1], default=(None, 0.0))
    largest_industry = max(exposures["industry"].items(), key=lambda item: item[1], default=(None, 0.0))
    if largest_sector[1] > max_sector_pct:
        return GuardResult("sector-exposure", "block", f"{largest_sector[0]} sector exposure is {largest_sector[1]:.2f}%", largest_sector[1], max_sector_pct)
    if largest_industry[1] > max_industry_pct:
        return GuardResult("industry-exposure", "block", f"{largest_industry[0]} industry exposure is {largest_industry[1]:.2f}%", largest_industry[1], max_industry_pct)
    return GuardResult("sector-industry-exposure", "pass", "sector and industry exposure are inside limits", None, f"{max_sector_pct}/{max_industry_pct}")


def liquidity_guard(
    quote: QuoteSnapshot,
    min_volume: float = 500_000,
    min_relative_volume: float = 0.75,
) -> GuardResult:
    if quote.volume < min_volume:
        return GuardResult("liquidity", "block", f"volume {quote.volume:.0f} is below minimum", quote.volume, min_volume)
    if quote.average_volume and quote.average_volume > 0:
        relative = quote.volume / quote.average_volume
        if relative < min_relative_volume:
            return GuardResult("liquidity", "block", f"relative volume {relative:.2f}x is thin", relative, min_relative_volume)
        return GuardResult("liquidity", "pass", f"relative volume {relative:.2f}x is tradable", relative, min_relative_volume)
    return GuardResult("liquidity", "pass", f"volume {quote.volume:.0f} is tradable", quote.volume, min_volume)


def spread_slippage_guard(
    quote: QuoteSnapshot,
    max_spread_bps: float = 25.0,
    max_slippage_bps: float = 35.0,
    expected_fill_price: float | None = None,
) -> GuardResult:
    midpoint = (quote.bid + quote.ask) / 2
    if midpoint <= 0:
        return GuardResult("spread-slippage", "block", "quote midpoint is invalid", None, max_spread_bps)
    spread_bps = (quote.ask - quote.bid) / midpoint * 10_000
    if spread_bps > max_spread_bps:
        return GuardResult("spread", "block", f"spread {spread_bps:.1f} bps is too wide", spread_bps, max_spread_bps)
    if expected_fill_price is not None:
        slippage_bps = abs(expected_fill_price - midpoint) / midpoint * 10_000
        if slippage_bps > max_slippage_bps:
            return GuardResult("slippage", "block", f"expected slippage {slippage_bps:.1f} bps is too high", slippage_bps, max_slippage_bps)
        return GuardResult("spread-slippage", "pass", f"spread {spread_bps:.1f} bps and slippage {slippage_bps:.1f} bps are inside limits", slippage_bps, max_slippage_bps)
    return GuardResult("spread", "pass", f"spread {spread_bps:.1f} bps is inside limit", spread_bps, max_spread_bps)


def volatility_regime(bars: list[Candle], high_volatility_pct: float = 4.5, low_volatility_pct: float = 1.0) -> GuardResult:
    if len(bars) < 2:
        return GuardResult("volatility-regime", "unknown", "not enough bars for volatility regime")
    ranges = [(bar.high - bar.low) / bar.close * 100 for bar in bars[-20:] if bar.close > 0]
    if not ranges:
        return GuardResult("volatility-regime", "unknown", "no valid bar ranges")
    average_range_pct = mean(ranges)
    if average_range_pct >= high_volatility_pct:
        return GuardResult("volatility-regime", "caution", f"high volatility regime at {average_range_pct:.2f}%", average_range_pct, high_volatility_pct)
    if average_range_pct <= low_volatility_pct:
        return GuardResult("volatility-regime", "caution", f"low movement regime at {average_range_pct:.2f}%", average_range_pct, low_volatility_pct)
    return GuardResult("volatility-regime", "pass", f"normal volatility regime at {average_range_pct:.2f}%", average_range_pct, high_volatility_pct)


def market_trend_filter(index_bars: list[Candle], min_trend_pct: float = -1.5) -> GuardResult:
    if len(index_bars) < 2:
        return GuardResult("market-trend", "unknown", "not enough index bars")
    first = index_bars[0].close
    last = index_bars[-1].close
    trend_pct = (last - first) / first * 100 if first > 0 else 0.0
    if trend_pct < min_trend_pct:
        return GuardResult("market-trend", "block", f"market trend is down {trend_pct:.2f}%", trend_pct, min_trend_pct)
    status = "pass" if trend_pct >= 0 else "caution"
    return GuardResult("market-trend", status, f"market trend is {trend_pct:+.2f}%", trend_pct, min_trend_pct)


def news_event_earnings_guard(
    symbol: str,
    event_calendar: Mapping[str, Iterable[str]] | None = None,
    block_unknown: bool = False,
) -> GuardResult:
    if event_calendar is None:
        status = "unknown" if block_unknown else "pass"
        return GuardResult("event-risk", status, "event calendar unavailable", symbol.upper(), "calendar")
    events = tuple(event_calendar.get(symbol.upper(), ()))
    if events:
        return GuardResult("event-risk", "block", f"{symbol.upper()} has event risk: {', '.join(events)}", symbol.upper(), "no-events")
    return GuardResult("event-risk", "pass", f"{symbol.upper()} has no known news/event/earnings block", symbol.upper(), "no-events")


def _exposure_percentages(totals: Mapping[str, float], account_equity: float) -> dict[str, float]:
    if account_equity <= 0:
        return {key: 100.0 for key in totals}
    return {key: round(value / account_equity * 100, 4) for key, value in totals.items()}
