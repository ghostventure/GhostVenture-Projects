from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from ..models import OrderPlan


class PaperBroker:
    def __init__(self, journal_path: str = "trade-journal.jsonl") -> None:
        self.journal_path = Path(journal_path)

    def submit(self, order: OrderPlan, context: dict | None = None) -> dict:
        event = {
            "mode": "paper",
            "robot": "Timmy",
            "submitted_at": datetime.now(timezone.utc).isoformat(),
            "order": order.__dict__,
            "paper_context": context or {},
            "event_type": "buy-order",
            "symbol": order.symbol,
            "quantity": order.quantity,
            "buy_price": order.limit_price,
            "sell_target_price": order.target_price,
            "stop_price": order.stop_price,
            "sold_price": None,
            "sell_status": "target-pending",
            "status": "accepted-paper",
        }
        with self.journal_path.open("a", encoding="utf-8") as file:
            file.write(json.dumps(event, sort_keys=True) + "\n")
        return event
