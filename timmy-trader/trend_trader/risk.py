from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from math import floor, isfinite
from typing import Mapping
from zoneinfo import ZoneInfo

from .asset_classes import asset_profile
from .config import BotConfig
from .data_quality import SymbolDataQuality
from .market_guards import (
    AccountRiskSnapshot,
    GuardResult,
    PositionSnapshot,
    daily_loss_circuit_breaker,
    max_drawdown_circuit_breaker,
    sector_industry_exposure_guard,
)
from .models import OrderPlan, Signal


@dataclass(frozen=True)
class AutomationRiskLimits:
    """Explicit exposure policy supplied by an automated-order caller.

    Percentages are of current account equity. No exposure thresholds are
    silently inferred from strategy settings or broker state.
    """

    max_symbol_exposure_pct: float
    max_total_exposure_pct: float
    max_drawdown_pct: float
    max_sector_exposure_pct: float | None = None
    max_industry_exposure_pct: float | None = None


@dataclass(frozen=True)
class AutomationRiskContext:
    """Locally supplied snapshots required to evaluate one automated entry.

    The evaluator performs no account or market-data calls. Callers must pass
    snapshots already refreshed for the current automation cycle.
    """

    account_equity: float | None
    available_cash: float | None
    positions: tuple[PositionSnapshot, ...] = ()
    pending_order_notionals: Mapping[str, float] | None = None
    day_pnl: float | None = None
    peak_equity: float | None = None
    session_open: bool | None = None
    data_quality: SymbolDataQuality | None = None
    last_symbol_trade_at: Mapping[str, datetime] | None = None
    now: datetime | None = None
    sector: str | None = None
    industry: str | None = None
    is_live: bool = False
    live_auto_opted_in: bool = False
    live_safety_hold: bool = False
    unresolved_live_outcomes: bool = False


@dataclass(frozen=True)
class AutomationRiskDecision:
    plan: OrderPlan | None
    guards: tuple[GuardResult, ...]
    reasons: tuple[str, ...]

    @property
    def allowed(self) -> bool:
        return self.plan is not None and not self.reasons


def evaluate_automation_order(
    signal: Signal,
    config: BotConfig,
    context: AutomationRiskContext,
    limits: AutomationRiskLimits,
) -> AutomationRiskDecision:
    """Gate and size one equity/ETF automation candidate using local snapshots.

    Integration contract: call after refreshing the strategy and before an
    automated Preview/Submit. Supply account/position/order snapshots,
    session state, per-symbol data-quality result, and last trade timestamps.
    A denied result has ``plan=None`` and explanatory ``reasons``. An allowed
    plan remains subject to the existing preview, account, live opt-in, and
    broker safety gates; this pure function never submits an order.
    """
    symbol = signal.symbol.strip().upper()
    reasons: list[str] = []
    guards: list[GuardResult] = []

    signal_values = (signal.entry, signal.stop, signal.target, signal.volatility_pct, signal.reward_risk)
    try:
        valid_signal = all(isfinite(float(value)) for value in signal_values) and signal.entry > 0 and signal.stop > 0
    except (TypeError, ValueError):
        valid_signal = False
    if not valid_signal:
        return AutomationRiskDecision(None, (), ("Signal prices or risk values are invalid.",))

    profile = asset_profile(symbol, config)
    base_plan = create_order_plan(signal, config)
    if not profile.enabled or profile.instrument_type != "EQUITY":
        reasons.append("Automation risk evaluator supports enabled U.S. equity/ETF instruments only.")
    if base_plan is None:
        reasons.append("Strategy or configured per-trade risk limits did not produce an order plan.")
    if context.is_live:
        if not context.live_auto_opted_in:
            reasons.append("Live Auto requires explicit operator opt-in.")
        if context.live_safety_hold or context.unresolved_live_outcomes:
            reasons.append("Live Auto is held until safety holds and unresolved order outcomes are cleared.")
        try:
            enforce_live_guards(config)
        except RuntimeError as exc:
            reasons.append(str(exc))
    if reasons:
        return AutomationRiskDecision(None, tuple(guards), tuple(reasons))

    try:
        max_symbol_pct = _valid_pct(limits.max_symbol_exposure_pct)
        max_total_pct = _valid_pct(limits.max_total_exposure_pct)
        max_drawdown_pct = _valid_pct(limits.max_drawdown_pct)
        if limits.max_sector_exposure_pct is not None:
            _valid_pct(limits.max_sector_exposure_pct)
        if limits.max_industry_exposure_pct is not None:
            _valid_pct(limits.max_industry_exposure_pct)
    except (TypeError, ValueError) as exc:
        return AutomationRiskDecision(None, tuple(guards), (f"Invalid automation risk policy: {exc}",))

    assert base_plan is not None
    equity = _positive_finite(context.account_equity)
    cash = _positive_finite(context.available_cash)
    if equity is None or cash is None:
        reasons.append("Fresh positive account equity and available cash are required for automated sizing.")
        return AutomationRiskDecision(None, tuple(guards), tuple(reasons))

    positions = tuple(context.positions)
    pending = {str(key).strip().upper(): _nonnegative_finite(value) for key, value in (context.pending_order_notionals or {}).items()}
    if any(value is None for value in pending.values()):
        reasons.append("Pending-order exposure contains an invalid amount.")
        return AutomationRiskDecision(None, tuple(guards), tuple(reasons))
    if any(
        not str(position.symbol).strip()
        or not isfinite(float(position.market_value))
        or float(position.market_value) < 0
        for position in positions
    ):
        reasons.append("Position exposure snapshot is invalid; automated sizing is held.")
        return AutomationRiskDecision(None, tuple(guards), tuple(reasons))

    current_total = sum(float(position.market_value) for position in positions) + sum(float(value) for value in pending.values())
    current_symbol = sum(
        float(position.market_value)
        for position in positions
        if position.symbol.strip().upper() == symbol
    ) + float(pending.get(symbol, 0.0))
    occupied_symbols = {
        position.symbol.strip().upper()
        for position in positions
        if float(position.market_value) > 0
    } | {key for key, value in pending.items() if value and value > 0}

    if (
        config.max_positions <= 0
        or len(occupied_symbols) > config.max_positions
        or (symbol not in occupied_symbols and len(occupied_symbols) >= config.max_positions)
    ):
        reasons.append(f"Maximum position count reached ({len(occupied_symbols)}/{config.max_positions}).")
    if config.require_market_hours and context.session_open is not True:
        reason = "Regular market session is closed." if context.session_open is False else "Market session status is unavailable."
        reasons.append(reason)

    quality = context.data_quality
    if quality is None or quality.symbol.strip().upper() != symbol:
        reasons.append("Current symbol data-quality snapshot is missing or mismatched.")
    elif (
        quality.label != "CURRENT"
        or quality.age_minutes is None
        or quality.age_minutes < 0
        or quality.invalid_ohlc_bars
        or quality.duplicate_timestamps
        or quality.missing_bars_estimate
    ):
        reasons.append(
            f"Market data quality is {quality.label.lower()}; automated entry requires current candles with valid, unique OHLC rows."
        )

    cooldown_minutes = max(0, int(config.order_cooldown_minutes))
    last_trade = (context.last_symbol_trade_at or {}).get(symbol)
    if last_trade is not None and cooldown_minutes:
        try:
            now = _as_utc(context.now or datetime.now(timezone.utc))
            last = _as_utc(last_trade)
            remaining = timedelta(minutes=cooldown_minutes) - (now - last)
            if remaining.total_seconds() > 0:
                reasons.append(f"{symbol} cooldown active for {int(remaining.total_seconds() // 60) + 1}m.")
        except (AttributeError, TypeError, ValueError):
            reasons.append(f"{symbol} cooldown timestamp is invalid; automated entry is held.")

    day_pnl = _finite_number(context.day_pnl)
    if day_pnl is None:
        reasons.append("Daily P&L snapshot is unavailable; drawdown protection cannot be confirmed.")
    else:
        daily_guard = daily_loss_circuit_breaker(
            AccountRiskSnapshot(equity=equity, cash=cash, day_pnl=day_pnl),
            config.max_daily_loss_usd,
        )
        guards.append(daily_guard)
        if not daily_guard.passed:
            reasons.append(daily_guard.reason)

    peak_equity = _positive_finite(context.peak_equity)
    if peak_equity is None:
        drawdown_guard = GuardResult("max-drawdown", "unknown", "peak equity is unavailable or invalid", None, max_drawdown_pct)
    else:
        drawdown_guard = max_drawdown_circuit_breaker(
            AccountRiskSnapshot(
                equity=equity,
                cash=cash,
                day_pnl=day_pnl if day_pnl is not None else 0.0,
                peak_equity=peak_equity,
            ),
            max_drawdown_pct,
        )
    guards.append(drawdown_guard)
    if not drawdown_guard.passed:
        reasons.append(drawdown_guard.reason)

    if reasons:
        return AutomationRiskDecision(None, tuple(guards), tuple(reasons))

    proposed_notional = float(base_plan.quantity) * float(signal.entry)
    cash_cap = cash * max(0.0, float(config.max_entry_cash_pct)) / 100.0
    symbol_limit = equity * max_symbol_pct / 100.0
    total_limit = equity * max_total_pct / 100.0
    available_symbol = max(0.0, symbol_limit - current_symbol)
    available_total = max(0.0, total_limit - current_total)
    sized_notional = min(proposed_notional, cash_cap, available_symbol, available_total)
    quantity = _round_down_quantity(
        min(base_plan.quantity, sized_notional / signal.entry),
        config.equity_fractional_quantity_decimals if config.enable_equity_fractional_trading else profile.quantity_decimals,
    )
    if quantity <= 0 or (quantity < 1 and not config.enable_equity_fractional_trading):
        reasons.append("Exposure, cash, or per-trade risk caps leave no valid equity quantity.")
        return AutomationRiskDecision(None, tuple(guards), tuple(reasons))
    if config.enable_equity_fractional_trading and quantity * signal.entry < config.min_equity_fractional_notional_usd:
        reasons.append("Exposure caps leave less than the configured fractional-equity minimum notional.")
        return AutomationRiskDecision(None, tuple(guards), tuple(reasons))

    sized_plan = replace(base_plan, quantity=quantity, notional=round(quantity * signal.entry, 2))
    if limits.max_sector_exposure_pct is not None:
        if not context.sector:
            reasons.append("Sector concentration cap is enabled but candidate sector metadata is unavailable.")
        if any(position.market_value > 0 and not position.sector for position in positions) or any(pending.values()):
            reasons.append("Sector concentration cap is enabled but existing or pending exposure lacks sector metadata.")
    if limits.max_industry_exposure_pct is not None:
        if not context.industry:
            reasons.append("Industry concentration cap is enabled but candidate industry metadata is unavailable.")
        if any(position.market_value > 0 and not position.industry for position in positions) or any(pending.values()):
            reasons.append("Industry concentration cap is enabled but existing or pending exposure lacks industry metadata.")
    if limits.max_sector_exposure_pct is not None or limits.max_industry_exposure_pct is not None:
        projected_positions = positions + (
            PositionSnapshot(symbol, 0.0, sized_plan.notional, context.sector, context.industry),
        )
        concentration = sector_industry_exposure_guard(
            projected_positions,
            equity,
            limits.max_sector_exposure_pct if limits.max_sector_exposure_pct is not None else 100.0,
            limits.max_industry_exposure_pct if limits.max_industry_exposure_pct is not None else 100.0,
        )
        guards.append(concentration)
        if not concentration.passed:
            reasons.append(concentration.reason)

    if reasons:
        return AutomationRiskDecision(None, tuple(guards), tuple(reasons))
    guards.extend((
        GuardResult("position-count", "pass", f"{len(occupied_symbols) + (symbol not in occupied_symbols)}/{config.max_positions} positions"),
        GuardResult(
            "session",
            "pass",
            "regular market session is open" if context.session_open is True else "market-hours restriction is disabled",
        ),
        GuardResult("data-quality", "pass", "current candle data is structurally valid"),
        GuardResult(
            "symbol-exposure",
            "pass",
            f"projected {(current_symbol + sized_plan.notional) / equity * 100:.2f}%",
            (current_symbol + sized_plan.notional) / equity * 100,
            max_symbol_pct,
        ),
        GuardResult(
            "portfolio-exposure",
            "pass",
            f"projected {(current_total + sized_plan.notional) / equity * 100:.2f}%",
            (current_total + sized_plan.notional) / equity * 100,
            max_total_pct,
        ),
        GuardResult("cash-sizing", "pass", f"sized notional ${sized_plan.notional:.2f} within cap ${cash_cap:.2f}"),
    ))
    return AutomationRiskDecision(sized_plan, tuple(guards), ())


def _positive_finite(value: float | None) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if isfinite(parsed) and parsed > 0 else None


def _finite_number(value: float | None) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if isfinite(parsed) else None


def _nonnegative_finite(value: float) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if isfinite(parsed) and parsed >= 0 else None


def _valid_pct(value: float) -> float:
    parsed = float(value)
    if not isfinite(parsed) or parsed <= 0 or parsed > 100:
        raise ValueError("Exposure percentages must be greater than 0 and at most 100.")
    return parsed


def _round_down_quantity(quantity: float, decimals: int) -> float:
    if not isfinite(float(quantity)) or quantity <= 0:
        return 0.0
    precision = max(0, min(int(decimals), 8))
    scale = 10**precision
    return floor(quantity * scale) / scale


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        value = value.replace(tzinfo=ZoneInfo("America/New_York"))
    return value.astimezone(timezone.utc)


def create_order_plan(signal: Signal, config: BotConfig) -> OrderPlan | None:
    if signal.decision != "eligible":
        return None
    if signal.score < config.min_score_to_trade:
        return None
    if signal.expense_status == "too-expensive":
        return None
    if signal.reward_risk < config.min_reward_risk_to_trade:
        return None
    if signal.volatility_pct > config.max_signal_volatility_pct:
        return None
    if config.symbol_whitelist and signal.symbol.upper() not in config.symbol_whitelist:
        return None
    profile = asset_profile(signal.symbol, config)
    if not profile.enabled:
        return None

    risk_per_share = max(signal.entry - signal.stop, 0)
    if risk_per_share <= 0:
        return None

    risk_qty = config.risk_per_trade_usd / risk_per_share
    notional_qty = profile.max_notional / signal.entry
    raw_quantity = max(0.0, min(risk_qty, notional_qty, profile.max_quantity))
    if (
        profile.instrument_type == "EQUITY"
        and config.enable_equity_fractional_trading
        and raw_quantity > 0
    ):
        decimals = max(1, min(config.equity_fractional_quantity_decimals, 5))
        quantity = round(raw_quantity, decimals)
        if quantity * signal.entry < config.min_equity_fractional_notional_usd:
            return None
        return OrderPlan(
            symbol=signal.symbol,
            side="BUY",
            quantity=quantity,
            order_type="MARKET",
            limit_price=None,
            stop_price=signal.stop,
            target_price=signal.target,
            notional=round(quantity * signal.entry, 2),
            reason=f"{signal.setup} score={signal.score} equity fractional-priority market order",
            instrument_type=profile.instrument_type,
            time_in_force=profile.time_in_force,
            entrust_type=profile.entrust_type,
            support_trading_session=profile.support_trading_session,
            extra_payload=profile.extra_payload,
        )

    quantity = raw_quantity
    if profile.quantity_decimals == 0:
        quantity = float(floor(quantity))
    else:
        quantity = round(quantity, profile.quantity_decimals)

    if quantity < 1:
        if profile.quantity_decimals == 0:
            return None
        min_fractional_notional = max(2.0, signal.entry * 0.00000001)
        if quantity * signal.entry < min_fractional_notional:
            return None

    if quantity <= 0:
        return None

    return OrderPlan(
        symbol=signal.symbol,
        side="BUY",
        quantity=quantity,
        order_type="LIMIT",
        limit_price=signal.entry,
        stop_price=signal.stop,
        target_price=signal.target,
        notional=round(quantity * signal.entry, 2),
        reason=f"{signal.setup} score={signal.score} {profile.instrument_type.lower()} buy-low/sell-high band",
        instrument_type=profile.instrument_type,
        time_in_force=profile.time_in_force,
        entrust_type=profile.entrust_type,
        support_trading_session=profile.support_trading_session,
        extra_payload=profile.extra_payload,
    )


def enforce_live_guards(config: BotConfig) -> None:
    if config.trader_mode != "live" or not config.trader_live:
        raise RuntimeError("Live trading is disabled. Set TRADER_MODE=live and TRADER_LIVE=1.")
    if not config.webull_enable_live_orders:
        raise RuntimeError("Webull live order switch is disabled. Set WEBULL_ENABLE_LIVE_ORDERS=1.")
    if not config.webull_account_id:
        raise RuntimeError("WEBULL_ACCOUNT_ID is required for live trading.")
