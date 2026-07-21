from __future__ import annotations

from datetime import datetime, timedelta

from trend_trader.config import load_config
from trend_trader.brokers.webull_openapi import WebullOpenApiBroker
from trend_trader.models import Candle
from trend_trader.risk import create_order_plan
from trend_trader.strategy import score_symbol


def make_bars(symbol: str = "SPY") -> list[Candle]:
    start = datetime(2026, 1, 1, 9, 30)
    bars: list[Candle] = []
    price = 100.0
    for index in range(60):
        price += -0.15 if index % 6 == 0 else 0.35
        if index == 59:
            price += 3.4
        volume = 1_000_000 if index < 59 else 1_900_000
        bars.append(
            Candle(
                symbol=symbol,
                timestamp=start + timedelta(minutes=index),
                open=price - 0.2,
                high=price + 0.5,
                low=price - 0.5,
                close=price,
                volume=volume,
            )
        )
    return bars


def main() -> int:
    signal = score_symbol("SPY", make_bars())
    assert signal.score >= 72, signal
    assert signal.decision == "eligible", signal
    assert signal.direction == "bullish", signal
    assert signal.change_pct >= 2.5, signal
    assert signal.entry < signal.close, signal
    assert signal.stop < signal.entry, signal
    assert signal.target > signal.entry, signal

    config = load_config()
    plan = create_order_plan(signal, config)
    assert plan is not None, signal
    assert plan.notional <= config.max_order_notional_usd, plan
    assert plan.quantity <= config.max_order_quantity, plan
    payload = WebullOpenApiBroker(config).preview_order_payload(plan)
    new_order = payload["new_orders"][0]
    assert new_order["combo_type"] == "NORMAL", new_order
    assert new_order["instrument_type"] == "EQUITY", new_order
    assert new_order["market"] == "US", new_order
    assert new_order["entrust_type"] == "QTY", new_order
    assert len(new_order["client_order_id"]) <= 32, new_order

    print("Timmy smoke tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
