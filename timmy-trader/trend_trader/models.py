from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class Candle:
    symbol: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass(frozen=True)
class Signal:
    symbol: str
    score: int
    decision: str
    direction: str
    setup: str
    reasons: tuple[str, ...]
    close: float
    change_pct: float
    entry: float
    stop: float
    target: float
    volatility_pct: float
    volume_ratio: float | None
    reward_risk: float
    expense_status: str
    expense_reasons: tuple[str, ...]
    sensible_score: int
    sensible_action: str
    scout_score: int
    scout_action: str


@dataclass(frozen=True)
class OrderPlan:
    symbol: str
    side: str
    quantity: float
    order_type: str
    limit_price: float | None
    stop_price: float
    target_price: float
    notional: float
    reason: str
    instrument_type: str = "EQUITY"
    market: str = "US"
    time_in_force: str = "DAY"
    entrust_type: str = "QTY"
    support_trading_session: str | None = "CORE"
    extra_payload: dict[str, Any] | None = None
