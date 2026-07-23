from __future__ import annotations

from datetime import datetime, timedelta, timezone

from trend_trader.broker_reconciliation import (
    BrokerSessionState,
    build_cancel_replace_payload,
    duplicate_trade_reason,
    monitor_open_orders,
    partial_profit_metadata,
    reconcile_broker_state,
    track_order_fills,
    trailing_stop_metadata,
    verify_watchlist_read_back,
)
from trend_trader.models import OrderPlan
from trend_trader.positions import PositionBook


def test_reconcile_broker_state_tracks_fills_open_orders_and_duplicates() -> None:
    report = reconcile_broker_state(
        journal_events=[
            {
                "status": "submitted",
                "request_payload": {"new_orders": [{"client_order_id": "timmy-spy", "symbol": "SPY"}]},
                "order_plan": {"symbol": "SPY", "side": "BUY", "quantity": 1},
            }
        ],
        broker_orders=[
            {
                "clientOrderId": "timmy-spy",
                "orderId": "broker-1",
                "symbol": "SPY",
                "side": "BUY",
                "quantity": "1",
                "filledQty": "0.4",
                "avgFillPrice": "501.25",
                "status": "partial",
            }
        ],
        broker_positions=[{"symbol": "SPY", "quantity": "0.4", "avgPrice": "501.25"}],
    )

    assert report.ok
    assert report.open_order_count == 1
    assert report.fill_count == 1
    assert report.position_count == 1
    assert report.duplicate_block_count == 1
    assert report.fills[0].average_fill_price == 501.25


def test_reconcile_reports_unmatched_active_broker_order() -> None:
    report = reconcile_broker_state(
        journal_events=[],
        broker_orders=[{"orderId": "external-1", "symbol": "QQQ", "quantity": "1", "status": "open"}],
    )

    assert report.ok
    assert [issue.code for issue in report.issues] == ["broker-order-missing-in-journal"]


def test_order_fill_and_open_order_trackers_parse_common_broker_shapes() -> None:
    orders = [
        {"symbol": "AMD", "status": "filled", "filledQuantity": "0.5", "averagePrice": "200.10"},
        {"symbol": "MSFT", "status": "submitted", "quantity": "1"},
    ]

    assert track_order_fills(orders)[0].symbol == "AMD"
    assert monitor_open_orders(orders)[0].symbol == "MSFT"


def test_cancel_replace_payload_is_guarded_by_default() -> None:
    replacement = OrderPlan(
        symbol="SPY",
        side="BUY",
        quantity=0.5,
        order_type="LIMIT",
        limit_price=500,
        stop_price=490,
        target_price=530,
        notional=250,
        reason="test replacement",
    )

    guarded = build_cancel_replace_payload(
        monitor_open_orders([{"symbol": "SPY", "status": "open", "orderId": "broker-1"}])[0],
        replacement,
    )

    assert guarded.action == "cancel_replace"
    assert guarded.dry_run is True
    assert guarded.allowed is False
    assert guarded.payload["replace_with"]["symbol"] == "SPY"


def test_risk_metadata_scaffolds_do_not_create_live_order_payloads() -> None:
    trailing = trailing_stop_metadata(100, 94)
    partial = partial_profit_metadata(120, [(110, 0.5), (120, 0.5)])

    assert trailing["enabled"] is False
    assert trailing["trail_pct"] == 6.0
    assert trailing["live_order_payload"] is False
    assert partial["levels"][0]["close_fraction"] == 0.5
    assert partial["live_order_payload"] is False


def test_broker_session_refresh_due_handles_stale_or_expiring_sessions() -> None:
    now = datetime(2026, 7, 23, tzinfo=timezone.utc)
    fresh = BrokerSessionState(True, True, last_refresh_at=now - timedelta(minutes=5))
    stale = BrokerSessionState(True, True, last_refresh_at=now - timedelta(minutes=30))
    expiring = BrokerSessionState(True, True, last_refresh_at=now, token_expires_at=now + timedelta(minutes=2))

    assert fresh.refresh_due(now) is False
    assert stale.refresh_due(now) is True
    assert expiring.refresh_due(now) is True


def test_watchlist_read_back_verification_reports_missing_and_extra_symbols() -> None:
    result = verify_watchlist_read_back("Timmy Active", ["spy", "qqq"], ["SPY", "AMD"])

    assert result.verified is False
    assert result.missing_symbols == ("QQQ",)
    assert result.extra_symbols == ("AMD",)


def test_duplicate_trade_reason_checks_positions_then_open_orders() -> None:
    book = PositionBook.from_broker_positions([{"symbol": "SPY", "quantity": "1", "avgPrice": "500"}])

    assert duplicate_trade_reason("SPY", book, []) == "SPY already has an open position"
    assert (
        duplicate_trade_reason("QQQ", book, [{"symbol": "QQQ", "status": "open"}])
        == "QQQ already has an open broker order"
    )
