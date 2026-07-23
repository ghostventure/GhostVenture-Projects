from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Mapping


@dataclass(frozen=True)
class StrategyPreset:
    name: str
    description: str
    config_overrides: Mapping[str, object]
    patterns: tuple[str, ...]
    risk_notes: tuple[str, ...]


_PRESETS: dict[str, StrategyPreset] = {
    "conservative": StrategyPreset(
        name="Conservative",
        description="Tighter trade selection for quieter unattended sessions.",
        config_overrides=MappingProxyType({
            "trading_style": "conservative",
            "min_score_to_trade": 82,
            "min_reward_risk_to_trade": 1.9,
            "max_signal_volatility_pct": 3.5,
            "max_entry_cash_pct": 12.0,
        }),
        patterns=("breakout", "pullback", "volume"),
        risk_notes=("higher score threshold", "reduced cash exposure", "high volatility avoided"),
    ),
    "balanced": StrategyPreset(
        name="Balanced",
        description="Default profile for normal liquid-market rotation.",
        config_overrides=MappingProxyType({
            "trading_style": "balanced",
            "min_score_to_trade": 76,
            "min_reward_risk_to_trade": 1.6,
            "max_signal_volatility_pct": 4.5,
            "max_entry_cash_pct": 20.0,
        }),
        patterns=("breakout", "momentum", "pullback", "volume"),
        risk_notes=("default score threshold", "standard cash exposure", "normal volatility allowed"),
    ),
    "aggressive": StrategyPreset(
        name="Aggressive",
        description="Wider scout net for active markets with stricter guard monitoring.",
        config_overrides=MappingProxyType({
            "trading_style": "aggressive",
            "min_score_to_trade": 72,
            "min_reward_risk_to_trade": 1.45,
            "max_signal_volatility_pct": 5.5,
            "max_entry_cash_pct": 25.0,
        }),
        patterns=("breakout", "momentum", "pullback", "volume"),
        risk_notes=("more signals admitted", "higher volatility allowed", "guard checks should stay strict"),
    ),
    "volatility-scout": StrategyPreset(
        name="Volatility Scout",
        description="Finds movement first, then expects risk guards to decide whether it is tradable.",
        config_overrides=MappingProxyType({
            "trading_style": "aggressive",
            "min_score_to_trade": 74,
            "min_reward_risk_to_trade": 1.7,
            "max_signal_volatility_pct": 6.0,
            "min_watchlist_scout_score": 50,
        }),
        patterns=("momentum", "volume"),
        risk_notes=("scouting focused", "pullback entries optional", "spread and slippage guard required"),
    ),
    "fractional-cash-saver": StrategyPreset(
        name="Fractional Cash Saver",
        description="Keeps fractional equities first while limiting notional pressure.",
        config_overrides=MappingProxyType({
            "trading_style": "balanced",
            "enable_equity_fractional_trading": True,
            "min_score_to_trade": 78,
            "max_entry_cash_pct": 10.0,
            "min_equity_fractional_notional_usd": 5.0,
        }),
        patterns=("breakout", "pullback", "volume"),
        risk_notes=("fractional priority", "small cash slice", "full-share fallback avoided when possible"),
    ),
    "high-liquidity-only": StrategyPreset(
        name="High Liquidity Only",
        description="Filters toward high-volume, low-spread symbols before strategy scoring is trusted.",
        config_overrides=MappingProxyType({
            "trading_style": "balanced",
            "min_score_to_trade": 78,
            "min_reward_risk_to_trade": 1.7,
            "max_signal_volatility_pct": 4.0,
        }),
        patterns=("breakout", "momentum", "volume"),
        risk_notes=("requires high liquidity", "wide spreads blocked", "thin symbols avoided"),
    ),
}


def list_strategy_presets() -> tuple[StrategyPreset, ...]:
    return tuple(_PRESETS[key] for key in sorted(_PRESETS))


def get_strategy_preset(name: str) -> StrategyPreset:
    key = name.strip().lower().replace("_", "-")
    if key not in _PRESETS:
        available = ", ".join(sorted(_PRESETS))
        raise KeyError(f"unknown strategy preset {name!r}; available presets: {available}")
    return _PRESETS[key]


def preset_env_overrides(name: str) -> dict[str, str]:
    preset = get_strategy_preset(name)
    env_names = {
        "trading_style": "TRADING_STYLE",
        "min_score_to_trade": "MIN_SCORE_TO_TRADE",
        "min_reward_risk_to_trade": "MIN_REWARD_RISK_TO_TRADE",
        "max_signal_volatility_pct": "MAX_SIGNAL_VOLATILITY_PCT",
        "max_entry_cash_pct": "MAX_ENTRY_CASH_PCT",
        "enable_equity_fractional_trading": "ENABLE_EQUITY_FRACTIONAL_TRADING",
        "min_equity_fractional_notional_usd": "WEBULL_MIN_EQUITY_FRACTIONAL_NOTIONAL_USD",
        "min_watchlist_scout_score": "MIN_WATCHLIST_SCOUT_SCORE",
    }
    overrides = {
        env_names[key]: _env_value(value)
        for key, value in preset.config_overrides.items()
        if key in env_names
    }
    overrides["TRADING_PATTERNS"] = ",".join(preset.patterns)
    return overrides


def _env_value(value: object) -> str:
    if isinstance(value, bool):
        return "1" if value else "0"
    return str(value)
