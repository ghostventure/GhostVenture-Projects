from __future__ import annotations

from trend_trader.positions import PositionBook


def test_position_book_loads_broker_positions_and_exposure() -> None:
    book = PositionBook.from_broker_positions(
        [
            {"symbol": "spy", "quantity": "1.5", "avgPrice": "500", "marketPrice": "510"},
            {"symbol": "qqq", "quantity": "0", "avgPrice": "400"},
        ]
    )

    assert book.symbols() == ("SPY",)
    assert book.get("SPY").unrealized_pnl == 15.0
    assert book.exposure().gross_notional == 765.0


def test_position_book_applies_fractional_buy_and_sell_fills() -> None:
    book = PositionBook()

    position = book.apply_fill("AMD", "BUY", 0.25, 200, broker_order_id="one")
    assert position.quantity == 0.25
    assert position.average_price == 200

    position = book.apply_fill("AMD", "BUY", 0.25, 220, broker_order_id="two")
    assert position.quantity == 0.5
    assert position.average_price == 210
    assert position.broker_order_ids == ("one", "two")

    position = book.apply_fill("AMD", "SELL", 0.1, 230, broker_order_id="three")
    assert position.quantity == 0.4
    assert book.has_open_position("AMD")

    closed = book.apply_fill("AMD", "SELL", 0.4, 240)
    assert closed is None
    assert not book.has_open_position("AMD")


def test_position_book_reports_duplicate_trade_reasons() -> None:
    book = PositionBook()
    assert book.duplicate_trade_reason("SPY") is None

    book.apply_fill("SPY", "BUY", 1, 500)
    assert book.duplicate_trade_reason("SPY") == "SPY already has an open position"
    assert book.duplicate_trade_reason("QQQ", ["qqq"]) == "QQQ already has an open broker order"
