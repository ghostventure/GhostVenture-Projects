from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Iterable

from .models import OrderPlan
from .positions import PositionBook


TERMINAL_ORDER_STATUSES = {"filled", "cancelled", "canceled", "rejected", "expired", "failed"}
OPEN_ORDER_STATUSES = {"new", "open", "pending", "partial", "partially_filled", "submitted", "working"}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class BrokerOrder:
    symbol: str
    side: str
    quantity: float
    status: str
    broker_order_id: str | None = None
    client_order_id: str | None = None
    filled_quantity: float = 0.0
    average_fill_price: float | None = None
    submitted_at: datetime | None = None
    updated_at: datetime | None = None
    raw: dict[str, object] = field(default_factory=dict)

    @property
    def is_open(self) -> bool:
        return self.status.lower() in OPEN_ORDER_STATUSES

    @property
    def is_terminal(self) -> bool:
        return self.status.lower() in TERMINAL_ORDER_STATUSES


@dataclass(frozen=True)
class JournalOrder:
    symbol: str
    side: str
    quantity: float
    status: str
    client_order_id: str | None = None
    broker_order_id: str | None = None
    event_type: str = "order"
    raw: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class OrderFill:
    symbol: str
    side: str
    filled_quantity: float
    average_fill_price: float
    broker_order_id: str | None
    client_order_id: str | None
    status: str


@dataclass(frozen=True)
class ReconciliationIssue:
    severity: str
    code: str
    symbol: str
    message: str
    broker_order_id: str | None = None
    client_order_id: str | None = None


@dataclass(frozen=True)
class ReconciliationReport:
    journal_count: int
    broker_order_count: int
    open_order_count: int
    fill_count: int
    position_count: int
    duplicate_block_count: int
    issues: tuple[ReconciliationIssue, ...]
    fills: tuple[OrderFill, ...]

    @property
    def ok(self) -> bool:
        return not any(issue.severity == "error" for issue in self.issues)


@dataclass(frozen=True)
class GuardedBrokerPayload:
    action: str
    dry_run: bool
    allowed: bool
    reason: str
    payload: dict[str, object]


@dataclass(frozen=True)
class BrokerSessionState:
    connected: bool
    authenticated: bool
    last_refresh_at: datetime | None = None
    token_expires_at: datetime | None = None
    last_error: str | None = None

    def refresh_due(self, now: datetime | None = None, minimum_interval: timedelta = timedelta(minutes=20)) -> bool:
        now = now or _utc_now()
        if not self.connected or not self.authenticated:
            return True
        if self.last_error:
            return True
        if self.token_expires_at and self.token_expires_at <= now + timedelta(minutes=5):
            return True
        if self.last_refresh_at is None:
            return True
        return now - self.last_refresh_at >= minimum_interval


@dataclass(frozen=True)
class WatchlistReadBackResult:
    name: str
    desired_symbols: tuple[str, ...]
    actual_symbols: tuple[str, ...]
    missing_symbols: tuple[str, ...]
    extra_symbols: tuple[str, ...]

    @property
    def verified(self) -> bool:
        return not self.missing_symbols and not self.extra_symbols


def parse_broker_orders(items: Iterable[dict]) -> tuple[BrokerOrder, ...]:
    return tuple(_parse_broker_order(item) for item in items)


def parse_journal_orders(events: Iterable[dict]) -> tuple[JournalOrder, ...]:
    orders: list[JournalOrder] = []
    for event in events:
        plan = event.get("order_plan") if isinstance(event.get("order_plan"), dict) else {}
        payload = event.get("request_payload") if isinstance(event.get("request_payload"), dict) else {}
        new_orders = payload.get("new_orders") if isinstance(payload.get("new_orders"), list) else []
        payload_order = new_orders[0] if new_orders and isinstance(new_orders[0], dict) else {}
        symbol = _first_text(event, "symbol") or _first_text(plan, "symbol") or _first_text(payload_order, "symbol")
        if not symbol:
            continue
        orders.append(
            JournalOrder(
                symbol=symbol.upper(),
                side=(
                    _first_text(event, "side")
                    or _first_text(plan, "side")
                    or _first_text(payload_order, "side")
                    or "BUY"
                ).upper(),
                quantity=_first_float(event, "quantity")
                or _first_float(plan, "quantity")
                or _first_float(payload_order, "quantity"),
                status=(_first_text(event, "status") or _first_text(event, "event") or "unknown").lower(),
                client_order_id=_first_text(event, "client_order_id") or _first_text(payload_order, "client_order_id"),
                broker_order_id=_first_text(event, "broker_order_id", "order_id") or _first_text(payload_order, "order_id"),
                event_type=_first_text(event, "event", "type") or "order",
                raw=event,
            )
        )
    return tuple(orders)


def reconcile_broker_state(
    journal_events: Iterable[dict],
    broker_orders: Iterable[dict],
    broker_positions: Iterable[dict] = (),
) -> ReconciliationReport:
    journal_orders = parse_journal_orders(journal_events)
    broker_order_models = parse_broker_orders(broker_orders)
    position_book = PositionBook.from_broker_positions(broker_positions)
    broker_by_key = {_order_key(order): order for order in broker_order_models if _order_key(order)}
    journal_by_key = {_order_key(order): order for order in journal_orders if _order_key(order)}
    issues: list[ReconciliationIssue] = []

    for journal_order in journal_orders:
        key = _order_key(journal_order)
        if key and key in broker_by_key:
            continue
        if journal_order.status not in {"blocked", "preview-required", "preview", "rejected"}:
            issues.append(
                ReconciliationIssue(
                    "warning",
                    "journal-order-missing-at-broker",
                    journal_order.symbol,
                    "Timmy has an order event that was not found in broker read-back.",
                    journal_order.broker_order_id,
                    journal_order.client_order_id,
                )
            )

    for broker_order in broker_order_models:
        key = _order_key(broker_order)
        if key and key not in journal_by_key and not broker_order.is_terminal:
            issues.append(
                ReconciliationIssue(
                    "warning",
                    "broker-order-missing-in-journal",
                    broker_order.symbol,
                    "Broker has an active order that is not in Timmy's journal.",
                    broker_order.broker_order_id,
                    broker_order.client_order_id,
                )
            )

    open_order_symbols = [order.symbol for order in broker_order_models if order.is_open]
    duplicate_blocks = 0
    for symbol in sorted(set(open_order_symbols)):
        reason = position_book.duplicate_trade_reason(symbol, open_order_symbols=())
        if reason:
            duplicate_blocks += 1
            issues.append(ReconciliationIssue("info", "duplicate-trade-block", symbol, reason))

    fills = track_order_fills(broker_order_models)
    return ReconciliationReport(
        journal_count=len(journal_orders),
        broker_order_count=len(broker_order_models),
        open_order_count=sum(1 for order in broker_order_models if order.is_open),
        fill_count=len(fills),
        position_count=position_book.exposure().open_positions,
        duplicate_block_count=duplicate_blocks,
        issues=tuple(issues),
        fills=fills,
    )


def track_order_fills(orders: Iterable[BrokerOrder | dict]) -> tuple[OrderFill, ...]:
    parsed = tuple(order if isinstance(order, BrokerOrder) else _parse_broker_order(order) for order in orders)
    fills: list[OrderFill] = []
    for order in parsed:
        if order.filled_quantity <= 0 or order.average_fill_price is None:
            continue
        fills.append(
            OrderFill(
                symbol=order.symbol,
                side=order.side,
                filled_quantity=order.filled_quantity,
                average_fill_price=order.average_fill_price,
                broker_order_id=order.broker_order_id,
                client_order_id=order.client_order_id,
                status=order.status,
            )
        )
    return tuple(fills)


def monitor_open_orders(orders: Iterable[BrokerOrder | dict]) -> tuple[BrokerOrder, ...]:
    parsed = tuple(order if isinstance(order, BrokerOrder) else _parse_broker_order(order) for order in orders)
    return tuple(order for order in parsed if order.is_open)


def build_cancel_replace_payload(
    order: BrokerOrder,
    replacement: OrderPlan,
    *,
    allow_live: bool = False,
    reason: str = "operator-reviewed cancel/replace scaffold",
) -> GuardedBrokerPayload:
    payload = {
        "cancel": {
            "broker_order_id": order.broker_order_id,
            "client_order_id": order.client_order_id,
            "symbol": order.symbol,
        },
        "replace_with": {
            key: value
            for key, value in asdict(replacement).items()
            if key != "extra_payload" or value
        },
    }
    return GuardedBrokerPayload(
        action="cancel_replace",
        dry_run=not allow_live,
        allowed=allow_live,
        reason=reason if allow_live else "dry-run only until live cancel/replace is explicitly enabled",
        payload=payload,
    )


def trailing_stop_metadata(entry_price: float, stop_price: float, trail_pct: float | None = None) -> dict[str, object]:
    distance = max(entry_price - stop_price, 0)
    computed_pct = round((distance / entry_price) * 100, 4) if entry_price > 0 else 0.0
    return {
        "risk_model": "trailing_stop_metadata",
        "enabled": False,
        "entry_price": round(entry_price, 4),
        "initial_stop_price": round(stop_price, 4),
        "trail_distance": round(distance, 4),
        "trail_pct": trail_pct if trail_pct is not None else computed_pct,
        "live_order_payload": False,
    }


def partial_profit_metadata(target_price: float, levels: Iterable[tuple[float, float]]) -> dict[str, object]:
    clean_levels = tuple(
        {"target_price": round(float(price), 4), "close_fraction": round(float(fraction), 4)}
        for price, fraction in levels
        if float(price) > 0 and 0 < float(fraction) <= 1
    )
    return {
        "risk_model": "partial_profit_metadata",
        "enabled": False,
        "primary_target_price": round(target_price, 4),
        "levels": clean_levels,
        "live_order_payload": False,
    }


def verify_watchlist_read_back(
    name: str,
    desired_symbols: Iterable[str],
    actual_symbols: Iterable[str],
) -> WatchlistReadBackResult:
    desired = tuple(sorted({symbol.upper() for symbol in desired_symbols if symbol.strip()}))
    actual = tuple(sorted({symbol.upper() for symbol in actual_symbols if symbol.strip()}))
    desired_set = set(desired)
    actual_set = set(actual)
    return WatchlistReadBackResult(
        name=name,
        desired_symbols=desired,
        actual_symbols=actual,
        missing_symbols=tuple(sorted(desired_set - actual_set)),
        extra_symbols=tuple(sorted(actual_set - desired_set)),
    )


def duplicate_trade_reason(
    symbol: str,
    positions: PositionBook,
    open_orders: Iterable[BrokerOrder | dict] = (),
) -> str | None:
    parsed_orders = tuple(order if isinstance(order, BrokerOrder) else _parse_broker_order(order) for order in open_orders)
    return positions.duplicate_trade_reason(
        symbol,
        open_order_symbols=(order.symbol for order in parsed_orders if order.is_open),
    )


def _parse_broker_order(item: dict) -> BrokerOrder:
    symbol = (_first_text(item, "symbol", "ticker", "instrumentSymbol") or "").upper()
    return BrokerOrder(
        symbol=symbol,
        side=(_first_text(item, "side", "action") or "BUY").upper(),
        quantity=_first_float(item, "quantity", "qty", "totalQuantity"),
        status=(_first_text(item, "status", "orderStatus") or "unknown").lower(),
        broker_order_id=_first_text(item, "broker_order_id", "order_id", "orderId"),
        client_order_id=_first_text(item, "client_order_id", "clientOrderId", "client_orderId"),
        filled_quantity=_first_float(item, "filled_quantity", "filledQty", "filledQuantity", "filled"),
        average_fill_price=_first_optional_float(item, "average_fill_price", "avgFillPrice", "averagePrice"),
        submitted_at=_first_datetime(item, "submitted_at", "createTime", "placedTime"),
        updated_at=_first_datetime(item, "updated_at", "updateTime", "lastUpdatedTime"),
        raw=item,
    )


def _order_key(order: BrokerOrder | JournalOrder) -> str | None:
    if order.client_order_id:
        return f"client:{order.client_order_id}"
    if order.broker_order_id:
        return f"broker:{order.broker_order_id}"
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


def _first_datetime(item: dict, *keys: str) -> datetime | None:
    for key in keys:
        value = item.get(key)
        if isinstance(value, datetime):
            return value
        if value in (None, ""):
            continue
        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            continue
    return None
