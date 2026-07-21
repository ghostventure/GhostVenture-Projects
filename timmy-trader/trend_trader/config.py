from __future__ import annotations

import os
import json
from dataclasses import dataclass


def _csv_set(value: str | None) -> set[str]:
    return {item.strip().upper() for item in (value or "").split(",") if item.strip()}


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
    max_price_over_sma20_pct: float
    max_price_over_sma50_pct: float
    max_rsi_to_buy: float
    max_entry_cash_pct: float
    min_reward_risk_to_trade: float
    max_signal_volatility_pct: float
    max_daily_trades: int
    max_symbol_daily_trades: int
    order_cooldown_minutes: int
    max_recent_rejections: int
    require_market_hours: bool
    auto_start_paper_on_market_open: bool
    auto_start_live_on_market_open: bool
    market_open_poll_seconds: int
    market_data_provider: str
    market_data_max_age_minutes: int
    watchlist_path: str | None
    watchlist_template: str
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
    except Exception:
        pass

    return BotConfig(
        trader_mode=os.getenv("TRADER_MODE", "paper").lower(),
        trader_live=os.getenv("TRADER_LIVE", "0") == "1",
        min_score_to_trade=int(os.getenv("MIN_SCORE_TO_TRADE", "72")),
        max_positions=int(os.getenv("MAX_POSITIONS", "3")),
        max_daily_loss_usd=float(os.getenv("MAX_DAILY_LOSS_USD", "100")),
        risk_per_trade_usd=float(os.getenv("RISK_PER_TRADE_USD", "25")),
        symbol_whitelist=_csv_set(os.getenv("WEBULL_SYMBOL_WHITELIST")),
        max_order_notional_usd=float(os.getenv("WEBULL_MAX_ORDER_NOTIONAL_USD", "250")),
        max_order_quantity=float(os.getenv("WEBULL_MAX_ORDER_QUANTITY", "10")),
        max_price_over_sma20_pct=float(os.getenv("MAX_PRICE_OVER_SMA20_PCT", "6")),
        max_price_over_sma50_pct=float(os.getenv("MAX_PRICE_OVER_SMA50_PCT", "12")),
        max_rsi_to_buy=float(os.getenv("MAX_RSI_TO_BUY", "78")),
        max_entry_cash_pct=float(os.getenv("MAX_ENTRY_CASH_PCT", "20")),
        min_reward_risk_to_trade=float(os.getenv("MIN_REWARD_RISK_TO_TRADE", "1.6")),
        max_signal_volatility_pct=float(os.getenv("MAX_SIGNAL_VOLATILITY_PCT", "4.5")),
        max_daily_trades=int(os.getenv("MAX_DAILY_TRADES", "5")),
        max_symbol_daily_trades=int(os.getenv("MAX_SYMBOL_DAILY_TRADES", "2")),
        order_cooldown_minutes=int(os.getenv("ORDER_COOLDOWN_MINUTES", "15")),
        max_recent_rejections=int(os.getenv("MAX_RECENT_REJECTIONS", "2")),
        require_market_hours=os.getenv("REQUIRE_MARKET_HOURS", "1") != "0",
        auto_start_paper_on_market_open=os.getenv("AUTO_START_PAPER_ON_MARKET_OPEN", "1") != "0",
        auto_start_live_on_market_open=os.getenv("AUTO_START_LIVE_ON_MARKET_OPEN", "0") == "1",
        market_open_poll_seconds=int(os.getenv("MARKET_OPEN_POLL_SECONDS", "30")),
        market_data_provider=os.getenv("MARKET_DATA_PROVIDER", "csv").lower(),
        market_data_max_age_minutes=int(os.getenv("MARKET_DATA_MAX_AGE_MINUTES", "15")),
        watchlist_path=os.getenv("WATCHLIST_PATH") or None,
        watchlist_template=os.getenv("WATCHLIST_TEMPLATE", "equity"),
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
        max_crypto_order_notional_usd=float(os.getenv("WEBULL_MAX_CRYPTO_ORDER_NOTIONAL_USD", "100")),
        max_futures_contracts=float(os.getenv("WEBULL_MAX_FUTURES_CONTRACTS", "1")),
        max_options_contracts=float(os.getenv("WEBULL_MAX_OPTIONS_CONTRACTS", "1")),
        webull_app_key=os.getenv("WEBULL_APP_KEY") or None,
        webull_app_secret=os.getenv("WEBULL_APP_SECRET") or None,
        webull_region=os.getenv("WEBULL_REGION", "us"),
        webull_api_endpoint=os.getenv("WEBULL_API_ENDPOINT") or None,
        webull_account_id=os.getenv("WEBULL_ACCOUNT_ID") or None,
        webull_support_trading_session=os.getenv("WEBULL_SUPPORT_TRADING_SESSION", "CORE").upper(),
        webull_token_check_seconds=int(os.getenv("WEBULL_TOKEN_CHECK_SECONDS", "30")),
        webull_token_check_interval_seconds=int(os.getenv("WEBULL_TOKEN_CHECK_INTERVAL_SECONDS", "3")),
        webull_enable_live_orders=os.getenv("WEBULL_ENABLE_LIVE_ORDERS", "0") == "1",
        webull_require_preview=os.getenv("WEBULL_REQUIRE_PREVIEW", "1") != "0",
    )
