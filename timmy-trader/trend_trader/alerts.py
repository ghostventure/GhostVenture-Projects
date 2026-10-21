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
from typing import Iterable, Literal, Sequence

from .models import Signal

NumberOp = Literal["above", "at_or_above", "below", "at_or_below"]
_MAX_EVENTS = 1000
_MAX_RULES = 500
_MAX_STORE_BYTES = 2_000_000


@dataclass(frozen=True)
class AlertRuleTemplate:
    """Reusable starting point for a local signal alert rule."""

    id: str
    label: str
    description: str
    name: str
    kind: Literal["price", "score", "action"]
    operator: NumberOp | None = None
    default_value: str = ""


ALERT_RULE_TEMPLATES: tuple[AlertRuleTemplate, ...] = (
    AlertRuleTemplate("price_level_up", "Price reaches a level", "Alert when close is at or above a price.",
                      "Price level reached", "price", "at_or_above"),
    AlertRuleTemplate("price_level_down", "Price falls to a level", "Alert when close is at or below a price.",
                      "Price level crossed down", "price", "at_or_below"),
    AlertRuleTemplate("strong_score", "Strong scout score", "Alert when scout score reaches 75 or more.",
                      "Strong scout score", "score", "at_or_above", "75"),
    AlertRuleTemplate("weak_score", "Low scout score", "Alert when scout score is 45 or lower.",
                      "Low scout score", "score", "at_or_below", "45"),
    AlertRuleTemplate("trade_action", "Signal action is Trade", "Alert when the signal action is trade.",
                      "Trade signal", "action", default_value="trade"),
    AlertRuleTemplate("watch_action", "Signal action is Watch", "Alert when the signal action is watch.",
                      "Watch signal", "action", default_value="watch"),
    AlertRuleTemplate("avoid_action", "Signal action is Avoid", "Alert when the signal action is avoid.",
                      "Avoid signal", "action", default_value="avoid"),
)


def alert_rule_from_template(template_id: str, *, name: str | None = None,
                             symbol: str | None = None, value: str | float | None = None) -> "AlertRule":
    """Build a validated rule from a built-in template and optional edits."""
    template = next((item for item in ALERT_RULE_TEMPLATES if item.id == template_id), None)
    if template is None:
        raise ValueError(f"Unknown alert template: {template_id}")
    raw = template.default_value if value is None else str(value).strip()
    common = {"name": name or template.name, "symbol": symbol}
    if template.kind == "price":
        return AlertRule(**common, price_op=template.operator, price=float(raw))
    if template.kind == "score":
        return AlertRule(**common, score_op=template.operator, score=float(raw))
    if raw.lower() not in {"trade", "watch", "avoid"}:
        raise ValueError("Action must be trade, watch, or avoid.")
    return AlertRule(**common, action=raw.lower())


def filter_alert_events(events: Sequence["AlertEvent"], *, state: str = "All",
                        query: str = "", sort: str = "Newest") -> list["AlertEvent"]:
    """Filter bounded local alert history by state/query and stable sort order."""
    if state not in {"All", "New", "Seen"}:
        raise ValueError("state must be All, New, or Seen")
    if sort not in {"Newest", "Oldest", "Symbol"}:
        raise ValueError("sort must be Newest, Oldest, or Symbol")
    query = str(query).strip().casefold()
    if len(query) > 100:
        raise ValueError("Alert history search is limited to 100 characters")
    selected = [event for event in events
                if (state == "All" or (state == "New") == (event.acknowledged_at is None))
                and (not query or query in " ".join((event.symbol, event.rule_name, event.action)).casefold())]
    def time_key(event: "AlertEvent") -> tuple[int, str]:
        stamp = event.triggered_at
        try:
            parsed = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return (0, parsed.astimezone(timezone.utc).isoformat())
        except (TypeError, ValueError):
            return (1, str(stamp))
    if sort == "Symbol":
        selected.sort(key=lambda event: (event.symbol.casefold(), time_key(event)), reverse=False)
    else:
        dated = [event for event in selected if time_key(event)[0] == 0]
        undated = [event for event in selected if time_key(event)[0] != 0]
        dated.sort(key=time_key, reverse=(sort == "Newest"))
        undated.sort(key=lambda event: str(event.triggered_at))
        selected = dated + undated
    return selected


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
        self.load_error: str | None = None
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
            try:
                self._save()
            except Exception:
                self._rules.pop(rule.id, None)
                raise
            return rule

    def remove_rule(self, rule_id: str) -> bool:
        with self._lock:
            previous_rules = self._rules.copy()
            rule = self._rules.pop(rule_id, None)
            if rule is None:
                return False
            previous_active = self._active
            self._active = {key for key in previous_active if not key.startswith(f"{rule_id}:")}
            try:
                self._save()
            except Exception:
                self._rules = previous_rules
                self._active = previous_active
                raise
            return True

    def set_enabled(self, rule_id: str, enabled: bool) -> AlertRule:
        with self._lock:
            rule = self._rules[rule_id]
            updated = AlertRule(**{**asdict(rule), "enabled": bool(enabled)})
            self._rules[rule_id] = updated
            previous_active = self._active
            if not enabled:
                self._active = {key for key in previous_active if not key.startswith(f"{rule_id}:")}
            try:
                self._save()
            except Exception:
                self._rules[rule_id] = rule
                self._active = previous_active
                raise
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
            previous_events = list(self._events)
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
                try:
                    self._save()
                except Exception:
                    # Do not consume an edge-trigger when its event could not
                    # be committed. The next scan can retry after storage recovers.
                    self._active = previous_active
                    self._events = previous_events
                    raise
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
                        try:
                            self._save()
                        except Exception:
                            self._events[index] = event
                            raise
                        return updated
                    return event
            raise KeyError(f"Unknown alert event: {event_id}")

    def acknowledge_all(self, when: datetime | None = None) -> int:
        """Acknowledge all pending events in one durable write; return count."""
        with self._lock:
            previous_events = self._events
            pending = [event for event in previous_events if event.acknowledged_at is None]
            if not pending:
                return 0
            acknowledged_at = _iso(when or _utc_now())
            pending_ids = {event.id for event in pending}
            self._events = [
                AlertEvent(**{**asdict(event), "acknowledged_at": acknowledged_at})
                if event.id in pending_ids else event
                for event in previous_events
            ]
            try:
                self._save()
            except Exception:
                self._events = previous_events
                raise
            return len(pending)

    def _load(self) -> None:
        if not self.path.exists():
            return
        try:
            if self.path.stat().st_size > _MAX_STORE_BYTES:
                raise ValueError("Saved alert data exceeds the 2 MB safety limit")
            payload = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(payload, dict):
                self.load_error = "Saved alert data must contain a JSON object."
                return
            if payload.get("version") != 1:
                self.load_error = f"Unsupported saved alert data version: {payload.get('version')!r}."
                return
            if set(payload) != {"version", "rules", "events", "active"}:
                raise ValueError("Saved alert data has missing or unsupported top-level fields")
            raw_rules = payload.get("rules", [])
            raw_events = payload.get("events", [])
            raw_active = payload.get("active", [])
            if (not isinstance(raw_rules, list) or len(raw_rules) > _MAX_RULES
                    or not isinstance(raw_events, list) or len(raw_events) > _MAX_EVENTS
                    or not isinstance(raw_active, list) or len(raw_active) > _MAX_RULES * 100):
                raise ValueError("Saved alert data has invalid or oversized collections")
            rules = [_load_rule(item) for item in raw_rules]
            events = [_load_event(item) for item in raw_events]
            if len({rule.id for rule in rules}) != len(rules):
                raise ValueError("Saved alert data contains duplicate rule IDs")
            if len({event.id for event in events}) != len(events):
                raise ValueError("Saved alert data contains duplicate event IDs")
            if not all(isinstance(item, str) and len(item) <= 160 for item in raw_active):
                raise ValueError("Saved alert data contains invalid active-rule keys")
            self._rules = {item.id: item for item in rules}
            self._events = events
            self._active = set(raw_active)
        except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
            # Keep the app usable, but do not later save an empty replacement
            # over the unreadable file and destroy the user's alert history.
            self._rules, self._events, self._active = {}, [], set()
            self.load_error = f"{type(exc).__name__}: {exc}"

    def _save(self) -> None:
        if self.load_error:
            raise OSError(
                "Saved alert data could not be loaded; the original file is preserved. "
                "Back it up and repair it before changing alert rules or history."
            )
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
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)


def _load_rule(item: object) -> AlertRule:
    if not isinstance(item, dict):
        raise ValueError("Saved alert rule must be an object")
    allowed = {"name", "symbol", "price_op", "price", "score_op", "score", "action", "enabled", "id", "created_at"}
    if set(item) != allowed:
        raise ValueError("Saved alert rule has missing or unsupported fields")
    for key in ("name", "id", "created_at"):
        if not isinstance(item[key], str) or not item[key].strip() or len(item[key]) > 160:
            raise ValueError(f"Saved alert rule has an invalid {key}")
    for key in ("symbol", "action"):
        if item[key] is not None and (not isinstance(item[key], str) or len(item[key]) > 64):
            raise ValueError(f"Saved alert rule has an invalid {key}")
    if not isinstance(item["enabled"], bool):
        raise ValueError("Saved alert rule has an invalid enabled state")
    for key in ("price", "score"):
        value = item[key]
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float))):
            raise ValueError(f"Saved alert rule has an invalid {key}")
    return AlertRule(**item)


def _load_event(item: object) -> AlertEvent:
    if not isinstance(item, dict):
        raise ValueError("Saved alert event must be an object")
    required = {"id", "rule_id", "rule_name", "symbol", "triggered_at", "price", "score", "action", "acknowledged_at"}
    if set(item) != required:
        raise ValueError("Saved alert event has missing or unsupported fields")
    for key in ("id", "rule_id", "rule_name", "symbol", "triggered_at", "action"):
        if not isinstance(item[key], str) or not item[key].strip() or len(item[key]) > 160:
            raise ValueError(f"Saved alert event has an invalid {key}")
    if item["acknowledged_at"] is not None and not isinstance(item["acknowledged_at"], str):
        raise ValueError("Saved alert event has an invalid acknowledgement timestamp")
    if isinstance(item["price"], bool) or not isinstance(item["price"], (int, float)) or not math.isfinite(item["price"]):
        raise ValueError("Saved alert event has an invalid price")
    if isinstance(item["score"], bool) or not isinstance(item["score"], int) or not 0 <= item["score"] <= 100:
        raise ValueError("Saved alert event has an invalid score")
    return AlertEvent(**item)
