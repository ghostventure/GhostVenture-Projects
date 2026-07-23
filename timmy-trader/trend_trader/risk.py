from __future__ import annotations

from math import floor

from .asset_classes import asset_profile
from .config import BotConfig
from .models import OrderPlan, Signal


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
