from __future__ import annotations

from .asset_classes import enabled_asset_classes
from .config import BotConfig
from .market_calendar import market_session


def readiness_flags(config: BotConfig, plans_count: int = 0, events_count: int = 0) -> dict:
    session = market_session()
    green = []
    red = []

    if session.is_open:
        green.append("Market session is open.")
    elif config.require_market_hours:
        red.append(f"Market session blocked: {session.reason}.")

    if config.trader_mode == "paper":
        green.append("Runtime is in paper mode.")
    elif config.trader_mode == "live":
        if config.trader_live and config.webull_enable_live_orders and config.webull_account_id:
            green.append("Live switches are enabled and account is configured.")
        else:
            red.append("Live mode selected but one or more live switches/account settings are missing.")
    else:
        red.append(f"Unknown trader mode: {config.trader_mode}.")

    if config.webull_require_preview:
        green.append("Webull preview requirement is enabled.")
    else:
        red.append("Webull preview requirement is disabled.")

    green.append(f"Enabled asset classes: {', '.join(enabled_asset_classes(config))}.")
    if config.crypto_symbols and not config.enable_crypto_trading:
        red.append("Crypto symbols are configured but crypto trading is disabled.")
    if config.futures_symbols:
        red.append("Futures symbols are scouting-only until contract-aware sizing is installed.")
    if config.enable_futures_trading:
        red.append("Futures trading switch is set, but futures execution remains blocked pending multiplier/tick/margin support.")
    if config.options_symbols:
        red.append("Options symbols are scouting-only; Timmy does not generate option-leg live orders yet.")
    if config.event_contract_symbols:
        red.append("Event-contract symbols are scouting-only; Timmy does not generate event-contract live orders yet.")
    if config.enable_options_trading:
        red.append("Options trading switch is set, but option execution remains blocked pending leg-specific order support.")
    if config.enable_event_contract_trading:
        red.append("Event-contract trading switch is set, but event execution remains blocked pending contract-specific order support.")

    if plans_count > 0:
        green.append(f"{plans_count} executable plan(s) available.")
    else:
        red.append("No executable plans are currently available.")

    if events_count >= 0:
        green.append(f"{events_count} execution event(s) loaded.")

    return {
        "green_flags": green,
        "red_flags": red,
        "market_session": {
            "is_open": session.is_open,
            "reason": session.reason,
            "opens_at": session.opens_at.isoformat() if session.opens_at else None,
            "closes_at": session.closes_at.isoformat() if session.closes_at else None,
        },
    }
