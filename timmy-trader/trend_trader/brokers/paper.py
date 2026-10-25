from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from ..models import OrderPlan


class PaperBroker:
    def __init__(self, journal_path: str = "trade-journal.jsonl", *, mode: str = "paper") -> None:
        if mode not in {"paper", "simulation"}:
            raise ValueError("Local broker mode must be paper or simulation.")
        self.journal_path = Path(journal_path)
        self.mode = mode

    def submit(self, order: OrderPlan, context: dict | None = None) -> dict:
        event = {
            "mode": self.mode,
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
            "status": "accepted-simulation" if self.mode == "simulation" else "accepted-paper",
        }
        if self.mode == "simulation":
            event["simulation_preview_id"] = (context or {}).get("simulation_preview_id")
            event["simulation_fill_model"] = "Daily OHLC target/stop threshold; stop-first if both touched."
        self.journal_path.parent.mkdir(parents=True, exist_ok=True)
        descriptor = os.open(self.journal_path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
        try:
            os.fchmod(descriptor, 0o600)
            with os.fdopen(descriptor, "a", encoding="utf-8") as file:
                descriptor = -1
                file.write(json.dumps(event, sort_keys=True) + "\n")
                file.flush()
                os.fsync(file.fileno())
        finally:
            if descriptor >= 0:
                os.close(descriptor)
        return event
