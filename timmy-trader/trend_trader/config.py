from __future__ import annotations

import os
import json
import math
from dataclasses import dataclass
from pathlib import Path


def _csv_set(value: str | None) -> set[str]:
    return {item.strip().upper() for item in (value or "").split(",") if item.strip()}


def _csv_lower_set(value: str | None) -> set[str]:
    return {item.strip().lower() for item in (value or "").split(",") if item.strip()}


def _int_env(name: str, default: int) -> int:
    """Read an integer setting without letting a typo prevent startup."""
    try:
        return int(os.getenv(name, str(default)).strip())
    except (TypeError, ValueError):
        return default


def _float_env(name: str, default: float) -> float:
    """Read a finite numeric setting; NaN and infinity are never valid limits."""
    try:
        value = float(os.getenv(name, str(default)).strip())
    except (TypeError, ValueError):
        return default
    return value if math.isfinite(value) else default


def _risk_limit_float_env(name: str, default: float) -> float:
    """Fail closed for an explicitly invalid/nonpositive exposure limit."""
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = float(raw.strip())
    except (TypeError, ValueError):
        return 0.0
    return value if math.isfinite(value) and value > 0 else 0.0


def _risk_limit_int_env(name: str, default: int) -> int:
    """Fail closed for an explicitly invalid/negative count limit."""
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw.strip())
    except (TypeError, ValueError):
        return 0
    return value if value >= 0 else 0


def _json_map(value: str | None) -> dict[str, object]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    if not isinstance(parsed, dict):
        return {}
    return {str(key).strip().upper(): item for key, item in parsed.items() if str(key).strip()}


def _style(value: str | None) -> str:
    style = (value or "adaptive").strip().lower()
    return style if style in {"adaptive", "aggressive", "balanced", "conservative"} else "adaptive"


@dataclass(frozen=True)
class BotConfig:
    trader_mode: str
    trader_live: bool
    min_score_to_trade: int
    max_positions: int
    max_daily_loss_usd: float
    risk_per_trade_usd: float
    symbol_whitelist: set[str]
    max_order_notional_usd: float
    max_order_quantity: float
    enable_equity_fractional_trading: bool
    min_equity_fractional_notional_usd: float
    equity_fractional_quantity_decimals: int
    max_price_over_sma20_pct: float
    max_price_over_sma50_pct: float
    max_rsi_to_buy: float
    max_entry_cash_pct: float
    min_reward_risk_to_trade: float
    max_signal_volatility_pct: float
    trading_style: str
    enabled_trade_patterns: set[str]
    max_daily_trades: int
    max_symbol_daily_trades: int
    order_cooldown_minutes: int
    max_recent_rejections: int
    require_market_hours: bool
    auto_start_paper_on_market_open: bool
    auto_start_live_on_market_open: bool
    market_open_poll_seconds: int
    paper_simulation_enabled: bool
    paper_simulation_ignore_market_hours: bool
    paper_simulation_min_scout_score: int
    market_data_provider: str
    market_data_max_age_minutes: int
    market_data_fetch_timeout_seconds: int
    market_data_fetch_workers: int
    watchlist_path: str | None
    active_watchlist_path: str | None
    movement_watchlist_path: str | None
    trade_ready_watchlist_path: str | None
    quiet_watchlist_path: str | None
    webull_sync_watchlists: bool
    webull_active_watchlist_name: str
    webull_movement_watchlist_name: str
    webull_trade_ready_watchlist_name: str
    webull_quiet_watchlist_name: str
    watchlist_template: str
    enable_watchlist_rotation: bool
    watchlist_universe: str
    watchlist_universe_batch_size: int
    watchlist_universe_refresh_hours: int
    watchlist_rotation_candidates: set[str]
    max_watchlist_symbols: int
    max_movement_watchlist_symbols: int
    min_watchlist_scout_score: int
    quiet_watchlist_scout_score: int
    enable_crypto_trading: bool
    enable_futures_trading: bool
    enable_options_trading: bool
    enable_event_contract_trading: bool
    crypto_symbols: set[str]
    futures_symbols: set[str]
    options_symbols: set[str]
    event_contract_symbols: set[str]
    option_legs: dict[str, object]
    futures_contracts: dict[str, object]
    max_crypto_order_notional_usd: float
    max_futures_contracts: float
    max_options_contracts: float

    webull_app_key: str | None
    webull_app_secret: str | None
    webull_region: str
    webull_api_endpoint: str | None
    webull_account_id: str | None
    webull_support_trading_session: str
    webull_token_check_seconds: int
    webull_token_check_interval_seconds: int
    webull_enable_live_orders: bool
    webull_require_preview: bool


def load_config() -> BotConfig:
    try:
        from dotenv import load_dotenv

        load_dotenv()
        profile_env = os.getenv("TIMMY_PROFILE_ENV")
        if not profile_env:
            profile_env = str(Path(os.getenv("TIMMY_HOME", ".")).expanduser() / ".timmy-profile.env")
        load_dotenv(profile_env, override=True)
    except Exception:
        pass

    return BotConfig(
        trader_mode=os.getenv("TRADER_MODE", "paper").lower(),
        trader_live=os.getenv("TRADER_LIVE", "0") == "1",
        min_score_to_trade=_int_env("MIN_SCORE_TO_TRADE", 72),
        max_positions=_risk_limit_int_env("MAX_POSITIONS", 3),
        max_daily_loss_usd=_risk_limit_float_env("MAX_DAILY_LOSS_USD", 100.0),
        risk_per_trade_usd=_risk_limit_float_env("RISK_PER_TRADE_USD", 25.0),
        symbol_whitelist=_csv_set(os.getenv("WEBULL_SYMBOL_WHITELIST")),
        max_order_notional_usd=_risk_limit_float_env("WEBULL_MAX_ORDER_NOTIONAL_USD", 250.0),
        max_order_quantity=_risk_limit_float_env("WEBULL_MAX_ORDER_QUANTITY", 10.0),
        enable_equity_fractional_trading=os.getenv("ENABLE_EQUITY_FRACTIONAL_TRADING", "0") == "1",
        min_equity_fractional_notional_usd=_float_env("WEBULL_MIN_EQUITY_FRACTIONAL_NOTIONAL_USD", 5.0),
        equity_fractional_quantity_decimals=_int_env("WEBULL_EQUITY_FRACTIONAL_QUANTITY_DECIMALS", 5),
        max_price_over_sma20_pct=_risk_limit_float_env("MAX_PRICE_OVER_SMA20_PCT", 6.0),
        max_price_over_sma50_pct=_risk_limit_float_env("MAX_PRICE_OVER_SMA50_PCT", 12.0),
        max_rsi_to_buy=_risk_limit_float_env("MAX_RSI_TO_BUY", 78.0),
        max_entry_cash_pct=_risk_limit_float_env("MAX_ENTRY_CASH_PCT", 20.0),
        min_reward_risk_to_trade=_float_env("MIN_REWARD_RISK_TO_TRADE", 1.6),
        max_signal_volatility_pct=_risk_limit_float_env("MAX_SIGNAL_VOLATILITY_PCT", 4.5),
        trading_style=_style(os.getenv("TRADING_STYLE")),
        enabled_trade_patterns=_csv_lower_set(os.getenv("TRADING_PATTERNS", "breakout,momentum,pullback,volume")),
        max_daily_trades=_risk_limit_int_env("MAX_DAILY_TRADES", 5),
        max_symbol_daily_trades=_risk_limit_int_env("MAX_SYMBOL_DAILY_TRADES", 2),
        order_cooldown_minutes=_int_env("ORDER_COOLDOWN_MINUTES", 15),
        max_recent_rejections=_risk_limit_int_env("MAX_RECENT_REJECTIONS", 2),
        require_market_hours=os.getenv("REQUIRE_MARKET_HOURS", "1") != "0",
        auto_start_paper_on_market_open=os.getenv("AUTO_START_PAPER_ON_MARKET_OPEN", "1") != "0",
        auto_start_live_on_market_open=os.getenv("AUTO_START_LIVE_ON_MARKET_OPEN", "0") == "1",
        market_open_poll_seconds=_int_env("MARKET_OPEN_POLL_SECONDS", 30),
        paper_simulation_enabled=os.getenv("PAPER_SIMULATION_ENABLED", "0") == "1",
        paper_simulation_ignore_market_hours=os.getenv("PAPER_SIMULATION_IGNORE_MARKET_HOURS", "1") != "0",
        paper_simulation_min_scout_score=_int_env("PAPER_SIMULATION_MIN_SCOUT_SCORE", 40),
        market_data_provider=os.getenv("MARKET_DATA_PROVIDER", "yahoo").lower(),
        market_data_max_age_minutes=_int_env("MARKET_DATA_MAX_AGE_MINUTES", 15),
        market_data_fetch_timeout_seconds=_int_env("MARKET_DATA_FETCH_TIMEOUT_SECONDS", 4),
        market_data_fetch_workers=max(1, min(24, _int_env("MARKET_DATA_FETCH_WORKERS", 12))),
        watchlist_path=os.getenv("WATCHLIST_PATH") or None,
        active_watchlist_path=os.getenv("ACTIVE_WATCHLIST_PATH") or None,
        movement_watchlist_path=os.getenv("MOVEMENT_WATCHLIST_PATH") or None,
        trade_ready_watchlist_path=os.getenv("TRADE_READY_WATCHLIST_PATH") or None,
        quiet_watchlist_path=os.getenv("QUIET_WATCHLIST_PATH") or None,
        webull_sync_watchlists=os.getenv("WEBULL_SYNC_WATCHLISTS", "0") == "1",
        webull_active_watchlist_name=os.getenv("WEBULL_ACTIVE_WATCHLIST_NAME", "Timmy Active"),
        webull_movement_watchlist_name=os.getenv("WEBULL_MOVEMENT_WATCHLIST_NAME", "Timmy Movement"),
        webull_trade_ready_watchlist_name=os.getenv("WEBULL_TRADE_READY_WATCHLIST_NAME", "Timmy Trade Ready"),
        webull_quiet_watchlist_name=os.getenv("WEBULL_QUIET_WATCHLIST_NAME", "Timmy Quiet Removed"),
        watchlist_template=os.getenv("WATCHLIST_TEMPLATE", "equity"),
        enable_watchlist_rotation=os.getenv("ENABLE_WATCHLIST_ROTATION", "0") == "1",
        watchlist_universe=os.getenv("WATCHLIST_UNIVERSE", "all-us").strip().lower(),
        watchlist_universe_batch_size=_int_env("WATCHLIST_UNIVERSE_BATCH_SIZE", 100),
        watchlist_universe_refresh_hours=_int_env("WATCHLIST_UNIVERSE_REFRESH_HOURS", 24),
        watchlist_rotation_candidates=_csv_set(os.getenv("WATCHLIST_ROTATION_CANDIDATES")),
        max_watchlist_symbols=_int_env("MAX_WATCHLIST_SYMBOLS", 12),
        max_movement_watchlist_symbols=_int_env("MAX_MOVEMENT_WATCHLIST_SYMBOLS", 50),
        min_watchlist_scout_score=_int_env("MIN_WATCHLIST_SCOUT_SCORE", 42),
        quiet_watchlist_scout_score=_int_env("QUIET_WATCHLIST_SCOUT_SCORE", 30),
        enable_crypto_trading=os.getenv("ENABLE_CRYPTO_TRADING", "0") == "1",
        enable_futures_trading=os.getenv("ENABLE_FUTURES_TRADING", "0") == "1",
        enable_options_trading=os.getenv("ENABLE_OPTIONS_TRADING", "0") == "1",
        enable_event_contract_trading=os.getenv("ENABLE_EVENT_CONTRACT_TRADING", "0") == "1",
        crypto_symbols=_csv_set(os.getenv("WEBULL_CRYPTO_SYMBOLS")),
        futures_symbols=_csv_set(os.getenv("WEBULL_FUTURES_SYMBOLS")),
        options_symbols=_csv_set(os.getenv("WEBULL_OPTIONS_SYMBOLS")),
        event_contract_symbols=_csv_set(os.getenv("WEBULL_EVENT_CONTRACT_SYMBOLS")),
        option_legs=_json_map(os.getenv("WEBULL_OPTION_LEGS_JSON")),
        futures_contracts=_json_map(os.getenv("WEBULL_FUTURES_CONTRACTS_JSON")),
        max_crypto_order_notional_usd=_risk_limit_float_env("WEBULL_MAX_CRYPTO_ORDER_NOTIONAL_USD", 100.0),
        max_futures_contracts=_risk_limit_float_env("WEBULL_MAX_FUTURES_CONTRACTS", 1.0),
        max_options_contracts=_risk_limit_float_env("WEBULL_MAX_OPTIONS_CONTRACTS", 1.0),
        webull_app_key=os.getenv("WEBULL_APP_KEY") or None,
        webull_app_secret=os.getenv("WEBULL_APP_SECRET") or None,
        webull_region=os.getenv("WEBULL_REGION", "us"),
        webull_api_endpoint=os.getenv("WEBULL_API_ENDPOINT") or None,
        webull_account_id=os.getenv("WEBULL_ACCOUNT_ID") or None,
        webull_support_trading_session=os.getenv("WEBULL_SUPPORT_TRADING_SESSION", "CORE").upper(),
        webull_token_check_seconds=_int_env("WEBULL_TOKEN_CHECK_SECONDS", 30),
        webull_token_check_interval_seconds=_int_env("WEBULL_TOKEN_CHECK_INTERVAL_SECONDS", 3),
        webull_enable_live_orders=os.getenv("WEBULL_ENABLE_LIVE_ORDERS", "0") == "1",
        webull_require_preview=os.getenv("WEBULL_REQUIRE_PREVIEW", "1") != "0",
    )
