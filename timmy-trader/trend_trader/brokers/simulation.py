from __future__ import annotations

from .paper import PaperBroker


class SimulationBroker(PaperBroker):
    """Local-only simulation adapter; it never initializes a network client."""

    def __init__(self, journal_path: str) -> None:
        super().__init__(journal_path, mode="simulation")

    def submit(self, order, context: dict | None = None) -> dict:
        local_context = dict(context or {})
        local_context["execution_model"] = "daily OHLC target/stop threshold; stop-first if both touched"
        local_context["broker_request_sent"] = False
        return super().submit(order, local_context)
