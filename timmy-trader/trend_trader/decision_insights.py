"""Presentation helpers for explaining existing Timmy signals and risk limits.

This module is deliberately read-only: it formats fields already produced by
the strategy and computes hypothetical sizing previews. It does not alter a
signal, create an order plan, or submit anything to a broker.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import floor, isfinite, sqrt
from typing import Iterable, Mapping

from .asset_classes import asset_profile
from .config import BotConfig
from .models import Candle, OrderPlan, Signal


@dataclass(frozen=True)
class SignalFactor:
    name: str
    status: str  # support, caution, or context
    detail: str


@dataclass(frozen=True)
class SignalExplanation:
    symbol: str
    score: int
    score_scale: int
    factors: tuple[SignalFactor, ...]
    favorable: tuple[str, ...]
    cautions: tuple[str, ...]


@dataclass(frozen=True)
class BlockerGuidance:
    category: str
    message: str
    next_step: str
    adjustable_here: bool


@dataclass(frozen=True)
class WhatIfRow:
    size_multiplier: float
    quantity: float
    notional: float
    estimated_stop_loss: float
    estimated_target_gain: float
    binding_limit: str


@dataclass(frozen=True)
class PositionWhatIf:
    symbol: str
    entry: float
    stop: float
    target: float
    available_cash: float | None
    rows: tuple[WhatIfRow, ...]
    note: str = "Illustrative sizing only; excludes fees, slippage, and broker buying-power rules."


@dataclass(frozen=True)
class PaperPerformance:
    closed_trades: int
    realized_pnl: float | None
    return_pct: float | None
    max_drawdown_usd: float | None
    max_drawdown_pct: float | None
    starting_balance: float | None
    missing_pnl_events: int
    status: str
    note: str


@dataclass(frozen=True)
class BenchmarkComparison:
    portfolio_return_pct: float | None
    benchmark_name: str | None
    benchmark_return_pct: float | None
    excess_return_pct: float | None
    status: str
    note: str


@dataclass(frozen=True)
class NormalizedPoint:
    x: float  # 0 is oldest/left; 1 is newest/right
    y: float  # 0 is price floor/bottom; 1 is price ceiling/top
    value: float


@dataclass(frozen=True)
class NormalizedVolumeBar:
    x: float
    height: float  # 0..1 relative to maximum displayed volume
    value: float


@dataclass(frozen=True)
class NormalizedChartLevel:
    name: str
    value: float
    y: float


@dataclass(frozen=True)
class ChartContext:
    symbol: str
    price_min: float
    price_max: float
    candles: tuple[dict[str, float], ...]
    volume_bars: tuple[NormalizedVolumeBar, ...]
    sma20: tuple[NormalizedPoint, ...]
    sma50: tuple[NormalizedPoint, ...]
    levels: tuple[NormalizedChartLevel, ...]
    note: str


@dataclass(frozen=True)
class SymbolComparison:
    symbol: str
    return_pct: float | None
    volatility_pct: float | None
    range_pct: float | None
    relative_return_pct_points: float | None
    bars_used: int
    status: str
    note: str


_FACTOR_MATCHERS: tuple[tuple[str, tuple[str, ...], str], ...] = (
    ("Price trend", ("moving-average", "above 20-period", "below 20-period"), "trend"),
    ("Breakout", ("broke above prior", "breakout"), "breakout"),
    ("Momentum", ("rsi", "momentum"), "momentum"),
    ("Volume", ("volume",), "volume"),
    ("Volatility", ("volatility",), "volatility"),
    ("Reward / risk", ("reward/risk", "target aims", "stop near"), "risk"),
    ("Direction", ("bullish", "bearish", "neutral"), "direction"),
    ("Pattern settings", ("pattern is disabled",), "pattern"),
    ("Scout context", ("scout:", "quiet scout"), "scout"),
    ("Entry context", ("entry", "pullback pattern"), "entry"),
    ("Strategy profile", ("style profile:", "adaptive profile:"), "profile"),
)


def explain_signal(signal: Signal) -> SignalExplanation:
    """Group the signal's own explanation strings into readable UI sections.

    The strategy does not expose per-factor score contributions, so this helper
    intentionally never invents point values for individual factors.
    """
    factors: list[SignalFactor] = []
    seen: set[str] = set()
    favorable: list[str] = []
    cautions: list[str] = []
    reasons = tuple(signal.reasons) + tuple(signal.expense_reasons)
    for reason in reasons:
        low = reason.lower()
        matched = next((item for item in _FACTOR_MATCHERS if any(token in low for token in item[1])), None)
        status = "support"
        if any(token in low for token in ("disabled", "bearish", "thin", "extended", "expensive", "too-expensive", "invalid", "quiet")):
            status = "caution"
        elif any(token in low for token in ("style profile", "adaptive profile", "entry", "scout:")):
            status = "context"
        if matched:
            name = matched[0]
            if name in seen:
                name = f"{name} detail"
            seen.add(name)
        else:
            name = "Signal note"
        factors.append(SignalFactor(name, status, reason))
        if status == "support":
            favorable.append(reason)
        elif status == "caution":
            cautions.append(reason)

    # Keep the headline signal fields visible even when strategy reason text is sparse.
    if not any(f.name == "Direction" for f in factors):
        factors.insert(0, SignalFactor("Direction", "context", f"{signal.direction.title()} setup; decision is {signal.decision}."))
    return SignalExplanation(
        symbol=signal.symbol.upper(), score=signal.score, score_scale=100,
        factors=tuple(factors), favorable=tuple(favorable), cautions=tuple(cautions),
    )


_BLOCKER_GUIDANCE: tuple[tuple[tuple[str, ...], str, bool], ...] = (
    (("score", "strategy-block", "quiet scout", "bearish"), "Review the signal details and scanner thresholds. Wait for the setup to change; lowering a threshold does not improve the setup itself.", False),
    (("reward/risk", "reward-risk", "thin"), "Review the entry, stop, and target levels. A plan remains blocked until the configured minimum reward/risk is met.", False),
    (("too-expensive", "expense"), "Review the extension and expense reasons. Recheck after new market bars arrive.", False),
    (("volatility",), "Review the volatility limit in Strategy / Risk settings, then confirm the resulting risk remains acceptable.", True),
    (("pattern",), "Review enabled trade patterns in Strategy settings. Enabling a pattern changes strategy eligibility.", True),
    (("symbol", "whitelist", "asset", "instrument"), "Check the symbol whitelist and whether this instrument type is configured and enabled.", True),
    (("quantity", "notional", "risk", "position", "daily loss", "cooldown"), "Review the risk and exposure limits in Risk settings and the account's current capacity.", True),
    (("cash", "buying power"), "Refresh account data and verify available buying power with the broker.", False),
    (("market closed", "session"), "Check the market session and the order's supported trading session.", False),
    (("stale", "quote", "market data"), "Refresh market data and confirm its timestamp is current before reviewing the signal again.", False),
    (("auth", "credential", "token", "login"), "Reconnect the broker account through the app's account setup flow.", False),
    (("network", "timeout", "connection", "broker unavailable"), "Check the connection status and retry after the broker service is reachable.", False),
    (("preview", "submit", "rejected", "placement"), "Open the broker response details and resolve the specific rejection before retrying.", False),
)


def explain_blocker(message: str, category: str | None = None) -> BlockerGuidance:
    """Map an existing blocker message/category to a concise operator next step."""
    text = f"{category or ''} {message}".lower()
    for terms, next_step, adjustable in _BLOCKER_GUIDANCE:
        if any(term in text for term in terms):
            return BlockerGuidance(category or terms[0], message, next_step, adjustable)
    return BlockerGuidance(
        category or "unknown", message,
        "Open the related diagnostic details and inspect the source message before changing settings.",
        False,
    )


def explain_blockers(messages: Iterable[str]) -> tuple[BlockerGuidance, ...]:
    """Convenience wrapper for a readiness report's issue messages."""
    return tuple(explain_blocker(message) for message in messages)


def position_what_if(
    signal: Signal,
    config: BotConfig,
    *,
    available_cash: float | None = None,
    plan: OrderPlan | None = None,
    size_multipliers: Iterable[float] = (0.5, 1.0, 1.5),
) -> PositionWhatIf:
    """Compute hypothetical quantities under existing risk/exposure limits.

    Multipliers scale the configured per-trade risk budget. Quantity is capped
    by the configured asset profile, order notional/quantity limits, and (when
    supplied) the cash percentage limit. A supplied plan is only used as a
    display reference; this preview recalculates the cap-based quantity.
    """
    entry = float(plan.limit_price if plan and plan.limit_price else signal.entry)
    stop = float(plan.stop_price if plan else signal.stop)
    target = float(plan.target_price if plan else signal.target)
    symbol = (plan.symbol if plan else signal.symbol).upper()
    risk_per_unit = max(entry - stop, 0.0)
    if not all(isfinite(v) for v in (entry, stop, target)) or entry <= 0 or risk_per_unit <= 0:
        return PositionWhatIf(symbol, entry, stop, target, available_cash, (), "No preview: entry and stop do not define positive per-unit risk.")

    profile = asset_profile(symbol, config)
    if not profile.enabled:
        return PositionWhatIf(symbol, entry, stop, target, available_cash, (), f"No preview: {profile.instrument_type.lower()} trading is not enabled for this symbol.")

    max_notional = min(float(profile.max_notional), float(config.max_order_notional_usd))
    max_quantity = min(float(profile.max_quantity), float(config.max_order_quantity))
    cash_cap: float | None = None
    if available_cash is not None and isfinite(float(available_cash)) and available_cash >= 0:
        cash_cap = float(available_cash) * max(float(config.max_entry_cash_pct), 0.0) / 100.0
        max_notional = min(max_notional, cash_cap)

    rows: list[WhatIfRow] = []
    for raw_multiplier in size_multipliers:
        multiplier = float(raw_multiplier)
        if not isfinite(multiplier) or multiplier < 0:
            continue
        risk_qty = max(float(config.risk_per_trade_usd), 0.0) * multiplier / risk_per_unit
        quantity = max(0.0, min(risk_qty, max_notional / entry, max_quantity))
        if profile.quantity_decimals == 0:
            quantity = float(floor(quantity))
        else:
            quantity = round(quantity, min(max(profile.quantity_decimals, 0), 8))
        notional = quantity * entry
        risk = quantity * risk_per_unit
        gain = quantity * max(target - entry, 0.0)
        if risk_qty <= min(max_notional / entry, max_quantity):
            binding = "per-trade risk budget"
        elif max_notional / entry <= max_quantity:
            binding = "notional/cash limit" if cash_cap is not None and cash_cap <= float(profile.max_notional) else "order notional limit"
        else:
            binding = "quantity limit"
        rows.append(WhatIfRow(multiplier, quantity, round(notional, 2), round(risk, 2), round(gain, 2), binding))
    return PositionWhatIf(symbol, entry, stop, target, available_cash, tuple(rows))


def paper_performance(
    events: Iterable[Mapping[str, object]],
    *,
    starting_balance: float | None = None,
) -> PaperPerformance:
    """Summarize realized outcomes from local paper-journal event records.

    Only paper events marked `target-hit` or `stopped` are counted. Duplicate
    updates sharing submitted timestamp and symbol are collapsed, preferring a
    terminal outcome. Open positions, broker holdings, fees, and market marks
    are intentionally excluded. Percentage return/drawdown require an explicit
    positive starting balance; no account balance is inferred here.
    """
    paper = [event for event in events if str(event.get("mode", "")).lower() == "paper"]
    deduped: dict[tuple[str, str], Mapping[str, object]] = {}
    for index, event in enumerate(paper):
        symbol = str(event.get("symbol") or _nested_order_symbol(event) or "").upper()
        submitted = str(event.get("submitted_at") or event.get("recorded_at") or f"row:{index}")
        key = (submitted, symbol)
        previous = deduped.get(key)
        terminal = event.get("sell_status") in {"target-hit", "stopped"}
        prev_terminal = previous and previous.get("sell_status") in {"target-hit", "stopped"}
        if previous is None or (terminal and not prev_terminal):
            deduped[key] = event

    closed = [event for event in deduped.values() if event.get("sell_status") in {"target-hit", "stopped"}]
    closed.sort(key=lambda event: str(event.get("closed_at") or event.get("submitted_at") or ""))
    pnls = [_finite_number(event.get("paper_pnl")) for event in closed]
    missing = sum(value is None for value in pnls)
    known_pnls = [value for value in pnls if value is not None]
    realized = round(sum(known_pnls), 2) if closed and missing == 0 else None

    balance = _finite_number(starting_balance)
    if balance is not None and balance <= 0:
        balance = None
    max_dd_usd: float | None = None
    max_dd_pct: float | None = None
    return_pct: float | None = None
    if balance is not None and closed and missing == 0:
        equity = balance
        peak = balance
        max_dd_usd = 0.0
        max_dd_pct = 0.0
        for pnl in pnls:
            assert pnl is not None
            equity += pnl
            peak = max(peak, equity)
            drawdown = peak - equity
            max_dd_usd = max(max_dd_usd, drawdown)
            if peak > 0:
                max_dd_pct = max(max_dd_pct, drawdown / peak * 100.0)
        return_pct = round((equity - balance) / balance * 100.0, 4)
        max_dd_pct = round(max_dd_pct, 4)
        max_dd_usd = round(max_dd_usd, 2)
    elif closed and missing == 0:
        # Absolute peak-to-trough change in realized P&L is still useful without
        # an account balance, but it is not an equity drawdown percentage.
        curve = 0.0
        peak_pnl = 0.0
        max_dd_usd = 0.0
        for pnl in pnls:
            assert pnl is not None
            curve += pnl
            peak_pnl = max(peak_pnl, curve)
            max_dd_usd = max(max_dd_usd, peak_pnl - curve)
        max_dd_usd = round(max_dd_usd, 2)

    if not closed:
        status = "no-closed-paper-trades"
        note = "No closed paper outcomes were present in the supplied journal events."
    elif missing:
        status = "incomplete-pnl"
        note = f"{missing} closed event(s) lack a numeric paper_pnl; totals and return are withheld."
    elif balance is None:
        status = "realized-only"
        note = "Return and percentage drawdown need an explicitly supplied positive starting balance."
    else:
        status = "complete"
        note = "Realized paper outcomes only; open/unrealized holdings are not included."
    return PaperPerformance(
        closed_trades=len(closed), realized_pnl=realized, return_pct=return_pct,
        max_drawdown_usd=max_dd_usd, max_drawdown_pct=max_dd_pct,
        starting_balance=balance, missing_pnl_events=missing, status=status, note=note,
    )


def compare_benchmark(
    portfolio_return_pct: float | None,
    benchmark_return_pct: float | None,
    *,
    benchmark_name: str | None = None,
) -> BenchmarkComparison:
    """Compare two explicitly supplied returns; this function fetches no data."""
    portfolio = _finite_number(portfolio_return_pct)
    benchmark = _finite_number(benchmark_return_pct)
    if portfolio is None or benchmark is None:
        return BenchmarkComparison(
            portfolio, benchmark_name, benchmark, None, "missing-input",
            "Supply both portfolio and benchmark returns for the same period; no benchmark is inferred or fetched.",
        )
    return BenchmarkComparison(
        portfolio, benchmark_name or "Benchmark", benchmark,
        round(portfolio - benchmark, 4), "complete",
        "Simple percentage-point difference; period alignment and benchmark suitability must be verified by the caller.",
    )


def chart_context(
    candles: Iterable[Candle],
    signal: Signal | None = None,
    *,
    symbol: str | None = None,
    limit: int = 120,
    padding_fraction: float = 0.04,
) -> ChartContext | None:
    """Normalize local OHLCV candles, SMA20/50, volume, and matching plan levels.

    Price y coordinates use a bottom-origin 0..1 scale; x coordinates use a
    left-to-right 0..1 scale across the returned candles. Raw OHLC and volume
    values are retained alongside their normalized coordinates. The viewport
    includes valid entry/stop/target levels from a matching Signal.
    """
    rows = list(candles)
    if limit > 0:
        rows = rows[-limit:]
    if not rows:
        return None
    chart_symbol = (symbol or (signal.symbol if signal else rows[-1].symbol)).upper()
    rows = [row for row in rows if row.symbol.upper() == chart_symbol]
    if not rows:
        return None

    finite_rows = [row for row in rows if all(isfinite(float(v)) for v in (row.open, row.high, row.low, row.close, row.volume))]
    if not finite_rows:
        return None
    rows = finite_rows
    matching_signal = signal if signal and signal.symbol.upper() == chart_symbol else None
    level_values: list[tuple[str, float]] = []
    if matching_signal:
        for label, raw in (("Entry", matching_signal.entry), ("Stop", matching_signal.stop), ("Target", matching_signal.target)):
            value = _finite_number(raw)
            if value is not None and value > 0:
                level_values.append((label, value))

    raw_min = min(min(row.low, row.open, row.close) for row in rows)
    raw_max = max(max(row.high, row.open, row.close) for row in rows)
    if level_values:
        raw_min = min(raw_min, *(value for _, value in level_values))
        raw_max = max(raw_max, *(value for _, value in level_values))
    span = raw_max - raw_min
    if span <= 0:
        span = max(abs(raw_max) * 0.01, 0.01)
    padding = span * max(_finite_number(padding_fraction) or 0.0, 0.0)
    price_min, price_max = raw_min - padding, raw_max + padding
    normalized_span = price_max - price_min

    def norm_y(value: float) -> float:
        return min(1.0, max(0.0, (value - price_min) / normalized_span))

    count = len(rows)
    xs = [index / (count - 1) if count > 1 else 0.5 for index in range(count)]
    candle_points = tuple({
        "x": xs[index], "open": norm_y(row.open), "high": norm_y(row.high),
        "low": norm_y(row.low), "close": norm_y(row.close),
        "open_value": row.open, "high_value": row.high,
        "low_value": row.low, "close_value": row.close,
    } for index, row in enumerate(rows))
    max_volume = max(max(row.volume, 0.0) for row in rows)
    volume_bars = tuple(
        NormalizedVolumeBar(xs[index], max(row.volume, 0.0) / max_volume if max_volume > 0 else 0.0, row.volume)
        for index, row in enumerate(rows)
    )

    def moving_average(window: int) -> tuple[NormalizedPoint, ...]:
        points: list[NormalizedPoint] = []
        rolling = 0.0
        for index, row in enumerate(rows):
            rolling += row.close
            if index >= window:
                rolling -= rows[index - window].close
            if index >= window - 1:
                value = rolling / window
                points.append(NormalizedPoint(xs[index], norm_y(value), value))
        return tuple(points)

    levels = tuple(NormalizedChartLevel(name, value, norm_y(value)) for name, value in level_values)
    note = "OHLCV and indicators are normalized from the supplied local candles."
    if signal and matching_signal is None:
        note += " Signal levels omitted because its symbol does not match the chart."
    if count < 50:
        note += " SMA50 is omitted until 50 candles are available."
    return ChartContext(
        symbol=chart_symbol,
        price_min=price_min,
        price_max=price_max,
        candles=candle_points,
        volume_bars=volume_bars,
        sma20=moving_average(20),
        sma50=moving_average(50),
        levels=levels,
        note=note,
    )


def compare_symbols(
    candles_by_symbol: Mapping[str, Iterable[Candle]],
    symbols: Iterable[str],
    *,
    window: int = 20,
) -> tuple[SymbolComparison, ...]:
    """Compare local candle histories over timestamps shared by all symbols.

    Return is first-to-last close change. Volatility is the unannualized sample
    standard deviation of close-to-close percentage changes. Range is the
    window's high-low span as a percent of its first close. Relative return is
    percentage points versus the first requested symbol. No current quote is
    fetched or inferred.
    """
    requested = tuple(dict.fromkeys(str(symbol).strip().upper() for symbol in symbols if str(symbol).strip()))
    if not requested:
        return ()
    if window < 2:
        return tuple(SymbolComparison(symbol, None, None, None, None, 0, "invalid-window", "Window must be at least two shared candles.") for symbol in requested)

    normalized: dict[str, dict[object, Candle]] = {}
    for symbol in requested:
        source = candles_by_symbol.get(symbol)
        if source is None:
            source = next((values for key, values in candles_by_symbol.items() if str(key).upper() == symbol), ())
        by_time: dict[object, Candle] = {}
        for candle in source:
            if candle.symbol.upper() != symbol:
                continue
            close = _finite_number(candle.close)
            high = _finite_number(candle.high)
            low = _finite_number(candle.low)
            if close is None or close <= 0 or high is None or low is None:
                continue
            by_time[candle.timestamp] = candle
        normalized[symbol] = by_time

    timestamp_sets = [set(items) for items in normalized.values()]
    shared = sorted(set.intersection(*timestamp_sets)) if timestamp_sets else []
    shared = shared[-window:]
    if len(shared) < 2:
        reason = "Fewer than two valid candles share timestamps across all selected symbols."
        return tuple(SymbolComparison(symbol, None, None, None, None, len(shared), "insufficient-common-data", reason) for symbol in requested)

    metrics: dict[str, tuple[float, float, float]] = {}
    for symbol in requested:
        rows = [normalized[symbol][timestamp] for timestamp in shared]
        first_close, last_close = rows[0].close, rows[-1].close
        returns = [(rows[index].close / rows[index - 1].close - 1.0) * 100.0 for index in range(1, len(rows))]
        mean = sum(returns) / len(returns)
        volatility = sqrt(sum((value - mean) ** 2 for value in returns) / (len(returns) - 1)) if len(returns) > 1 else 0.0
        price_range = (max(row.high for row in rows) - min(row.low for row in rows)) / first_close * 100.0
        metrics[symbol] = ((last_close / first_close - 1.0) * 100.0, volatility, price_range)
    baseline_symbol = requested[0]
    baseline_return = metrics[baseline_symbol][0]
    return tuple(
        SymbolComparison(
            symbol=symbol,
            return_pct=round(metrics[symbol][0], 4),
            volatility_pct=round(metrics[symbol][1], 4),
            range_pct=round(metrics[symbol][2], 4),
            relative_return_pct_points=round(metrics[symbol][0] - baseline_return, 4),
            bars_used=len(shared),
            status="complete",
            note=f"Relative return is versus {baseline_symbol}; common local candle timestamps only.",
        )
        for symbol in requested
    )


def _nested_order_symbol(event: Mapping[str, object]) -> str | None:
    order = event.get("order")
    if isinstance(order, Mapping):
        value = order.get("symbol")
        return str(value) if value else None
    return None


def _finite_number(value: object) -> float | None:
    try:
        result = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return result if isfinite(result) else None
