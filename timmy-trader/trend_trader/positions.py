from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from typing import Iterable


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class Position:
    symbol: str
    quantity: float
    average_price: float
    market_price: float | None = None
    side: str = "LONG"
    opened_at: datetime | None = None
    updated_at: datetime = field(default_factory=_utc_now)
    broker_order_ids: tuple[str, ...] = ()
    metadata: dict[str, object] = field(default_factory=dict)

    @property
    def notional(self) -> float:
        price = self.market_price if self.market_price is not None else self.average_price
        return round(abs(self.quantity) * price, 2)

    @property
    def unrealized_pnl(self) -> float | None:
        if self.market_price is None:
            return None
        multiplier = 1 if self.side.upper() == "LONG" else -1
        return round((self.market_price - self.average_price) * self.quantity * multiplier, 2)

    @property
    def is_open(self) -> bool:
        return abs(self.quantity) > 0


@dataclass(frozen=True)
class ExposureSummary:
    open_positions: int
    gross_notional: float
    symbols: tuple[str, ...]


class PositionBook:
    def __init__(self, positions: Iterable[Position] = ()) -> None:
        self._positions: dict[str, Position] = {
            position.symbol.upper(): replace(position, symbol=position.symbol.upper())
            for position in positions
            if position.is_open
        }

    @classmethod
    def from_broker_positions(cls, broker_positions: Iterable[dict]) -> "PositionBook":
        positions: list[Position] = []
        for item in broker_positions:
            symbol = _first_text(item, "symbol", "ticker", "instrumentSymbol")
            if not symbol:
                continue
            quantity = _first_float(item, "quantity", "qty", "position", "holdingQuantity")
            average_price = _first_float(item, "average_price", "avgPrice", "costPrice", "averageCost")
            market_price = _first_optional_float(item, "market_price", "marketPrice", "lastPrice")
            if quantity == 0:
                continue
            positions.append(
                Position(
                    symbol=symbol.upper(),
                    quantity=abs(quantity),
                    average_price=average_price,
                    market_price=market_price,
                    side="SHORT" if quantity < 0 else "LONG",
                    broker_order_ids=_text_tuple(item.get("broker_order_ids") or item.get("orderIds")),
                )
            )
        return cls(positions)

    def get(self, symbol: str) -> Position | None:
        return self._positions.get(symbol.upper())

    def symbols(self) -> tuple[str, ...]:
        return tuple(sorted(self._positions))

    def has_open_position(self, symbol: str) -> bool:
        position = self.get(symbol)
        return bool(position and position.is_open)

    def apply_fill(
        self,
        symbol: str,
        side: str,
        quantity: float,
        price: float,
        broker_order_id: str | None = None,
        filled_at: datetime | None = None,
        metadata: dict[str, object] | None = None,
    ) -> Position | None:
        symbol = symbol.upper()
        side = side.upper()
        existing = self._positions.get(symbol)
        timestamp = filled_at or _utc_now()
        order_ids = (broker_order_id,) if broker_order_id else ()

        if side == "BUY":
            if existing is None:
                position = Position(
                    symbol=symbol,
                    quantity=quantity,
                    average_price=price,
                    market_price=price,
                    opened_at=timestamp,
                    updated_at=timestamp,
                    broker_order_ids=order_ids,
                    metadata=metadata or {},
                )
            else:
                total_qty = existing.quantity + quantity
                average_price = ((existing.average_price * existing.quantity) + (price * quantity)) / total_qty
                position = replace(
                    existing,
                    quantity=total_qty,
                    average_price=round(average_price, 6),
                    market_price=price,
                    updated_at=timestamp,
                    broker_order_ids=_dedupe(existing.broker_order_ids + order_ids),
                    metadata={**existing.metadata, **(metadata or {})},
                )
            self._positions[symbol] = position
            return position

        if side == "SELL" and existing is not None:
            remaining = round(existing.quantity - quantity, 8)
            if remaining <= 0:
                self._positions.pop(symbol, None)
                return None
            position = replace(
                existing,
                quantity=remaining,
                market_price=price,
                updated_at=timestamp,
                broker_order_ids=_dedupe(existing.broker_order_ids + order_ids),
                metadata={**existing.metadata, **(metadata or {})},
            )
            self._positions[symbol] = position
            return position
        return existing

    def exposure(self) -> ExposureSummary:
        symbols = self.symbols()
        return ExposureSummary(
            open_positions=len(symbols),
            gross_notional=round(sum(position.notional for position in self._positions.values()), 2),
            symbols=symbols,
        )

    def duplicate_trade_reason(self, symbol: str, open_order_symbols: Iterable[str] = ()) -> str | None:
        symbol = symbol.upper()
        if self.has_open_position(symbol):
            return f"{symbol} already has an open position"
        if symbol in {item.upper() for item in open_order_symbols}:
            return f"{symbol} already has an open broker order"
        return None


def _first_text(item: dict, *keys: str) -> str | None:
    for key in keys:
        value = item.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def _first_float(item: dict, *keys: str) -> float:
    value = _first_optional_float(item, *keys)
    return value if value is not None else 0.0


def _first_optional_float(item: dict, *keys: str) -> float | None:
    for key in keys:
        value = item.get(key)
        if value in (None, ""):
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return None


def _text_tuple(value: object) -> tuple[str, ...]:
    if isinstance(value, (list, tuple, set)):
        return tuple(str(item) for item in value if str(item).strip())
    if value:
        return (str(value),)
    return ()


def _dedupe(values: Iterable[str]) -> tuple[str, ...]:
    return tuple(dict.fromkeys(value for value in values if value))
