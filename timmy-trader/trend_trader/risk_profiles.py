"""Explicit, account-scoped risk overlays that can only tighten global limits."""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

from .config import BotConfig

_ACCOUNT_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
_FIELDS = {
    "min_score_to_trade": (0, 100, "max"),
    "max_positions": (1, 100, "min"),
    "max_daily_loss_usd": (0.01, 10_000_000, "min"),
    "risk_per_trade_usd": (0.01, 10_000_000, "min"),
    "max_order_notional_usd": (0.01, 10_000_000, "min"),
    "max_order_quantity": (0.00001, 10_000_000, "min"),
    "min_reward_risk_to_trade": (0, 100, "max"),
    "max_signal_volatility_pct": (0.01, 100, "min"),
}


@dataclass(frozen=True)
class AccountRiskProfile:
    account_id: str
    limits: dict[str, float]
    label: str = ""

    @classmethod
    def from_mapping(cls, payload: dict[str, Any]) -> "AccountRiskProfile":
        account_id = str(payload.get("account_id", "")).strip()
        if not _ACCOUNT_ID.fullmatch(account_id):
            raise ValueError("Risk profile requires a valid account ID.")
        raw_limits = payload.get("limits", {})
        if not isinstance(raw_limits, dict) or not raw_limits:
            raise ValueError("Risk profile requires at least one risk limit.")
        limits: dict[str, float] = {}
        for name, value in raw_limits.items():
            if name not in _FIELDS:
                raise ValueError(f"Unsupported account risk setting: {name}")
            minimum, maximum, _ = _FIELDS[name]
            try:
                number = float(value)
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Risk setting {name} must be numeric.") from exc
            if not minimum <= number <= maximum:
                raise ValueError(f"Risk setting {name} must be between {minimum} and {maximum}.")
            if name in {"min_score_to_trade", "max_positions"} and not number.is_integer():
                raise ValueError(f"Risk setting {name} must be a whole number.")
            limits[name] = int(number) if name in {"min_score_to_trade", "max_positions"} else number
        return cls(account_id=account_id, limits=limits, label=str(payload.get("label", ""))[:80])


def apply_account_risk_profile(
    config: BotConfig, account_id: str, profile: AccountRiskProfile | None
) -> BotConfig:
    """Return a config overlay only for a matching, explicitly selected account.

    Existing global limits remain hard bounds; profiles cannot loosen them or
    alter broker/live switches.
    """
    if profile is None:
        return config
    if not account_id or account_id != profile.account_id:
        raise ValueError("The selected account does not match this risk profile.")
    changes = {}
    for name, value in profile.limits.items():
        if name not in _FIELDS:
            raise ValueError(f"Unsupported account risk setting: {name}")
        _, _, direction = _FIELDS[name]
        base = getattr(config, name)
        changes[name] = max(base, value) if direction == "max" else min(base, value)
    return replace(config, **changes)


def load_account_risk_profiles(path: str | Path) -> dict[str, AccountRiskProfile]:
    file_path = Path(path).expanduser()
    try:
        payload = json.loads(file_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    if not isinstance(payload, list):
        raise ValueError("Risk profile file must contain a JSON list.")
    profiles = [AccountRiskProfile.from_mapping(item) for item in payload if isinstance(item, dict)]
    result = {item.account_id: item for item in profiles}
    if len(result) != len(profiles):
        raise ValueError("Risk profile file contains duplicate account IDs.")
    return result


def save_account_risk_profiles(path: str | Path, profiles: list[AccountRiskProfile]) -> None:
    file_path = Path(path).expanduser()
    validated = [AccountRiskProfile.from_mapping(item.__dict__) for item in profiles]
    if len({item.account_id for item in validated}) != len(validated):
        raise ValueError("Risk profiles must have unique account IDs.")
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(
        json.dumps([item.__dict__ for item in validated], indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    os.chmod(file_path, 0o600)
