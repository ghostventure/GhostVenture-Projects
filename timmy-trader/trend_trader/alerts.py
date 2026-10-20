"""Persistent, local rule alerts for Timmy signals.

Alerts are informational only. This module does not fetch market data or submit
orders. The caller supplies the current signals to :meth:`AlertStore.evaluate`.

Quick start::

    store = AlertStore()  # defaults to $TIMMY_HOME/timmy-alerts.json
    rule = store.add_rule(AlertRule(
        name="Trade ready", score_op="at_or_above", score=75,
        action="trade"))
    triggered = store.evaluate(signals)
    store.acknowledge(triggered[0].id)
"""
from __future__ import annotations

import json
import math
import os
import tempfile
import threading
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Literal

from .models import Signal

NumberOp = Literal["above", "at_or_above", "below", "at_or_below"]
_MAX_EVENTS = 1000


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


@dataclass(frozen=True)
class AlertRule:
    """Rule conditions are ANDed; unset conditions are ignored.

    ``symbol`` may be omitted to match every symbol. Price checks use signal
    close; score checks use ``scout_score``; action checks use
    ``sensible_action``. Numeric comparators accept the four ``NumberOp`` values.
    """

    name: str
    symbol: str | None = None
    price_op: NumberOp | None = None
    price: float | None = None
    score_op: NumberOp | None = None
    score: float | None = None
    action: str | None = None
    enabled: bool = True
    id: str = ""
    created_at: str = ""

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise ValueError("Alert rule name cannot be empty")
        object.__setattr__(self, "name", self.name.strip())
        if self.symbol is not None:
            symbol = self.symbol.strip().upper()
            if not symbol:
                raise ValueError("Alert rule symbol cannot be empty")
            object.__setattr__(self, "symbol", symbol)
        if self.action is not None:
            action = self.action.strip().lower()
            if not action:
                raise ValueError("Alert rule action cannot be empty")
            object.__setattr__(self, "action", action)
        for field in ("price", "score"):
            value = getattr(self, field)
            op = getattr(self, f"{field}_op")
            if (value is None) != (op is None):
                raise ValueError(f"{field} and {field}_op must be set together")
            if value is not None and not math.isfinite(float(value)):
                raise ValueError(f"{field} must be finite")
            if op is not None and op not in {"above", "at_or_above", "below", "at_or_below"}:
                raise ValueError(f"Unsupported {field} comparator: {op}")
        if self.score is not None and not 0 <= self.score <= 100:
            raise ValueError("score must be between 0 and 100")
        if not self.id:
            object.__setattr__(self, "id", uuid.uuid4().hex)
        if not self.created_at:
            object.__setattr__(self, "created_at", _iso(_utc_now()))
        if self.price is None and self.score is None and self.action is None:
            raise ValueError("Alert rule must have at least one condition")


@dataclass(frozen=True)
class AlertEvent:
    id: str
    rule_id: str
    rule_name: str
    symbol: str
    triggered_at: str
    price: float
    score: int
    action: str
    acknowledged_at: str | None = None


def _compare(actual: float, op: NumberOp, threshold: float) -> bool:
    return {
        "above": actual > threshold,
        "at_or_above": actual >= threshold,
        "below": actual < threshold,
        "at_or_below": actual <= threshold,
    }[op]


class AlertStore:
    """JSON-backed rule/event store. Use one instance per profile/process."""

    def __init__(self, path: str | Path | None = None) -> None:
        profile_home = Path(os.getenv("TIMMY_HOME", Path.cwd())).expanduser()
        self.path = Path(path).expanduser() if path is not None else profile_home / "timmy-alerts.json"
        self._lock = threading.RLock()
        self._rules: dict[str, AlertRule] = {}
        self._events: list[AlertEvent] = []
        self._active: set[str] = set()
        self._load()

    @property
    def rules(self) -> tuple[AlertRule, ...]:
        with self._lock:
            return tuple(self._rules.values())

    @property
    def events(self) -> tuple[AlertEvent, ...]:
        with self._lock:
            return tuple(self._events)

    def add_rule(self, rule: AlertRule) -> AlertRule:
        with self._lock:
            if rule.id in self._rules:
                raise ValueError(f"Alert rule id already exists: {rule.id}")
            self._rules[rule.id] = rule
            self._save()
            return rule

    def remove_rule(self, rule_id: str) -> bool:
        with self._lock:
            removed = self._rules.pop(rule_id, None) is not None
            if removed:
                self._active = {key for key in self._active if not key.startswith(f"{rule_id}:")}
                self._save()
            return removed

    def set_enabled(self, rule_id: str, enabled: bool) -> AlertRule:
        with self._lock:
            rule = self._rules[rule_id]
            updated = AlertRule(**{**asdict(rule), "enabled": bool(enabled)})
            self._rules[rule_id] = updated
            if not enabled:
                self._active = {key for key in self._active if not key.startswith(f"{rule_id}:")}
            self._save()
            return updated

    def evaluate(self, signals: Iterable[Signal]) -> list[AlertEvent]:
        """Evaluate supplied signals and return events created by this call.

        Triggering is edge-based: a matching rule/symbol produces one event
        until a later evaluation observes that condition as false. Existing
        unacknowledged events remain in the event history until acknowledged.
        """
        signals_by_symbol = {signal.symbol.upper(): signal for signal in signals}
        created: list[AlertEvent] = []
        with self._lock:
            previous_active = self._active
            next_active = set(previous_active)
            for rule in self._rules.values():
                if not rule.enabled:
                    next_active = {key for key in next_active if not key.startswith(f"{rule.id}:")}
                    continue
                candidates = (
                    [signals_by_symbol[rule.symbol]]
                    if rule.symbol in signals_by_symbol
                    else ([] if rule.symbol else list(signals_by_symbol.values()))
                )
                for signal in candidates:
                    key = f"{rule.id}:{signal.symbol.upper()}"
                    was_active = key in next_active
                    next_active.discard(key)
                    if not self._matches(rule, signal):
                        continue
                    next_active.add(key)
                    if was_active:
                        continue
                    event = AlertEvent(
                        id=uuid.uuid4().hex,
                        rule_id=rule.id,
                        rule_name=rule.name,
                        symbol=signal.symbol.upper(),
                        triggered_at=_iso(_utc_now()),
                        price=float(signal.close),
                        score=int(signal.scout_score),
                        action=str(signal.sensible_action),
                    )
                    self._events.append(event)
                    self._events = self._events[-_MAX_EVENTS:]
                    created.append(event)
            self._active = next_active
            if created or next_active != previous_active:
                self._save()
        return created

    @staticmethod
    def _matches(rule: AlertRule, signal: Signal) -> bool:
        if rule.price is not None and not _compare(float(signal.close), rule.price_op, rule.price):
            return False
        if rule.score is not None and not _compare(float(signal.scout_score), rule.score_op, rule.score):
            return False
        if rule.action is not None and signal.sensible_action.strip().lower() != rule.action:
            return False
        return True

    def acknowledge(self, event_id: str, when: datetime | None = None) -> AlertEvent:
        with self._lock:
            for index, event in enumerate(self._events):
                if event.id == event_id:
                    if event.acknowledged_at is None:
                        updated = AlertEvent(**{**asdict(event), "acknowledged_at": _iso(when or _utc_now())})
                        self._events[index] = updated
                        self._save()
                        return updated
                    return event
            raise KeyError(f"Unknown alert event: {event_id}")

    def _load(self) -> None:
        if not self.path.exists():
            return
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(payload, dict) or payload.get("version") != 1:
                return
            self._rules = {item["id"]: AlertRule(**item) for item in payload.get("rules", [])}
            self._events = [AlertEvent(**item) for item in payload.get("events", [])]
            self._active = {str(item) for item in payload.get("active", [])}
        except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError):
            # A malformed preferences file should not prevent the application starting.
            self._rules, self._events, self._active = {}, [], set()

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": 1,
            "rules": [asdict(item) for item in self._rules.values()],
            "events": [asdict(item) for item in self._events],
            "active": sorted(self._active),
        }
        fd, temp_path = tempfile.mkstemp(prefix=f".{self.path.name}.", dir=self.path.parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as stream:
                json.dump(payload, stream, indent=2, sort_keys=True)
                stream.write("\n")
                stream.flush()
                os.fsync(stream.fileno())
            os.chmod(temp_path, 0o600)
            os.replace(temp_path, self.path)
            os.chmod(self.path, 0o600)
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
