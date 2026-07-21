from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .config import BotConfig

KNOWN_CRYPTO_PAIRS = {
    "BTCUSD",
    "ETHUSD",
    "SOLUSD",
    "XRPUSD",
    "LTCUSD",
    "DOGEUSD",
    "ADAUSD",
    "AVAXUSD",
    "LINKUSD",
    "DOTUSD",
}

KNOWN_FUTURES_ROOTS = {
    "ES",
    "MES",
    "NQ",
    "MNQ",
    "YM",
    "MYM",
    "RTY",
    "M2K",
    "GC",
    "MGC",
    "SI",
    "SIL",
    "CL",
    "MCL",
    "NG",
    "HG",
    "PL",
    "PA",
    "ZC",
    "ZW",
    "ZS",
    "ZM",
    "ZL",
    "KC",
    "CT",
    "SB",
    "CC",
    "LE",
    "HE",
    "GF",
    "ZN",
    "ZF",
    "ZT",
    "ZB",
}


@dataclass(frozen=True)
class AssetProfile:
    symbol: str
    instrument_type: str
    enabled: bool
    max_notional: float
    max_quantity: float
    quantity_decimals: int
    time_in_force: str = "DAY"
    entrust_type: str = "QTY"
    support_trading_session: str | None = "CORE"
    extra_payload: dict[str, Any] | None = None


def asset_profile(symbol: str, config: BotConfig) -> AssetProfile:
    normalized = symbol.upper()
    if normalized in config.crypto_symbols or normalized in KNOWN_CRYPTO_PAIRS:
        return AssetProfile(
            symbol=normalized,
            instrument_type="CRYPTO",
            enabled=config.enable_crypto_trading and normalized in config.crypto_symbols,
            max_notional=config.max_crypto_order_notional_usd,
            max_quantity=config.max_order_quantity,
            quantity_decimals=8,
            time_in_force="DAY",
            support_trading_session=None,
        )
    if normalized in config.futures_symbols or normalized.endswith("=F") or normalized in KNOWN_FUTURES_ROOTS:
        configured = normalized in config.futures_symbols
        extra_payload = config.futures_contracts.get(normalized)
        if not isinstance(extra_payload, dict):
            extra_payload = None
        return AssetProfile(
            symbol=normalized,
            instrument_type="FUTURES",
            enabled=config.enable_futures_trading and configured,
            max_notional=config.max_order_notional_usd,
            max_quantity=config.max_futures_contracts,
            quantity_decimals=0,
            support_trading_session=None,
            extra_payload=extra_payload,
        )
    if normalized in config.options_symbols:
        legs = config.option_legs.get(normalized)
        extra_payload = {"legs": legs} if isinstance(legs, list) and legs else None
        return AssetProfile(
            symbol=normalized,
            instrument_type="OPTION",
            enabled=config.enable_options_trading and extra_payload is not None,
            max_notional=config.max_order_notional_usd,
            max_quantity=config.max_options_contracts,
            quantity_decimals=0,
            support_trading_session=None,
            extra_payload=extra_payload,
        )
    if normalized in config.event_contract_symbols:
        return AssetProfile(
            symbol=normalized,
            instrument_type="EVENT",
            enabled=False,
            max_notional=config.max_order_notional_usd,
            max_quantity=config.max_order_quantity,
            quantity_decimals=0,
            support_trading_session=None,
        )
    return AssetProfile(
        symbol=normalized,
        instrument_type="EQUITY",
        enabled=True,
        max_notional=config.max_order_notional_usd,
        max_quantity=config.max_order_quantity,
        quantity_decimals=0,
        support_trading_session=config.webull_support_trading_session,
    )


def enabled_asset_classes(config: BotConfig) -> list[str]:
    enabled = ["EQUITY"]
    if config.enable_crypto_trading:
        enabled.append("CRYPTO")
    if config.enable_futures_trading:
        enabled.append("FUTURES")
    if config.enable_options_trading:
        enabled.append("OPTION")
    return enabled
