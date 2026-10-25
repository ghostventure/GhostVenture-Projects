"""Pure UX helpers for filtering supplied execution-journal event mappings.

No files are read, no data is persisted, and no broker/trading state is touched.
Filters are combined with AND. Event fields follow Timmy's journal shape:
``mode``, ``symbol`` (or ``order.symbol``), ``status``/``sell_status``, and
``submitted_at``/``recorded_at``. The text query searches event values and
nested order fields case-insensitively.

Example::

    state = JournalFilterState(mode="paper", symbol="spy", query="accepted")
    visible_rows = filter_journal_events(events, state)
"""
from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
import re
from typing import Any

_SYMBOL = re.compile(r"^[A-Z0-9][A-Z0-9._=^/-]{0,31}$")
_TIME_FIELDS = ("submitted_at", "recorded_at", "timestamp", "created_at")


def _optional_text(value: str | None, field: str, limit: int) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError(f"{field} must be text")
    normalized = value.strip()
    if not normalized:
        return None
    if len(normalized) > limit or any(ord(char) < 32 for char in normalized):
        raise ValueError(f"{field} must be at most {limit} characters without control characters")
    return normalized


def _bound(value: date | datetime | str | None, field: str) -> datetime | None:
    if value is None:
        return None
    date_only = False
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, date):
        parsed = datetime.combine(value, time.min)
        date_only = True
    elif isinstance(value, str):
        raw = value.strip()
        if not raw or len(raw) > 64:
            raise ValueError(f"{field} must be a valid ISO date or datetime")
        try:
            if len(raw) == 10:
                parsed = datetime.combine(date.fromisoformat(raw), time.min)
                date_only = True
            else:
                parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError(f"{field} must be a valid ISO date or datetime") from exc
    else:
        raise ValueError(f"{field} must be a date, datetime, ISO string, or None")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    parsed = parsed.astimezone(timezone.utc)
    if field == "end" and date_only:
        parsed += timedelta(days=1, microseconds=-1)
    return parsed


@dataclass(frozen=True)
class JournalFilterState:
    """Validated, reusable order-journal filter state.

    ``start`` and ``end`` accept ``date``, ``datetime``, or ISO text. Date-only
    end bounds include that entire UTC date. Event bounds are inclusive.
    """

    mode: str | None = None
    symbol: str | None = None
    start: date | datetime | str | None = None
    end: date | datetime | str | None = None
    status: str | None = None
    query: str | None = None

    def __post_init__(self) -> None:
        mode = _optional_text(self.mode, "mode", 16)
        if mode is not None:
            mode = mode.lower()
            if mode not in {"paper", "simulation", "live"}:
                raise ValueError("mode must be 'paper', 'simulation', 'live', or None")
        symbol = _optional_text(self.symbol, "symbol", 32)
        if symbol is not None:
            symbol = symbol.upper()
            if not _SYMBOL.fullmatch(symbol):
                raise ValueError("symbol contains unsupported characters")
        status = _optional_text(self.status, "status", 48)
        query = _optional_text(self.query, "query", 256)
        start = _bound(self.start, "start")
        end = _bound(self.end, "end")
        if start is not None and end is not None and start > end:
            raise ValueError("start must be before or equal to end")
        object.__setattr__(self, "mode", mode)
        object.__setattr__(self, "symbol", symbol)
        object.__setattr__(self, "status", status.casefold() if status else None)
        object.__setattr__(self, "query", query.casefold() if query else None)
        object.__setattr__(self, "start", start)
        object.__setattr__(self, "end", end)


def filter_journal_events(
    events: Iterable[Mapping[str, Any]], state: JournalFilterState
) -> list[Mapping[str, Any]]:
    """Return supplied event mappings matching all active state filters.

    Non-mapping rows are skipped. Input order and mapping objects are preserved.
    When a date filter is active, rows without a parseable event timestamp do
    not match.
    """
    if not isinstance(state, JournalFilterState):
        raise TypeError("state must be a JournalFilterState")
    matched: list[Mapping[str, Any]] = []
    for event in events:
        if not isinstance(event, Mapping):
            continue
        if state.mode and str(event.get("mode", "")).strip().lower() != state.mode:
            continue
        if state.symbol and _event_symbol(event) != state.symbol:
            continue
        if state.status and state.status not in _event_statuses(event):
            continue
        if state.start is not None or state.end is not None:
            timestamp = _event_timestamp(event)
            if timestamp is None:
                continue
            if state.start is not None and timestamp < state.start:
                continue
            if state.end is not None and timestamp > state.end:
                continue
        if state.query and not _contains_query(event, state.query):
            continue
        matched.append(event)
    return matched


def _event_symbol(event: Mapping[str, Any]) -> str:
    symbol = event.get("symbol")
    if not symbol and isinstance(event.get("order"), Mapping):
        symbol = event["order"].get("symbol")
    return str(symbol or "").strip().upper()


def _event_statuses(event: Mapping[str, Any]) -> set[str]:
    values = [event.get("status"), event.get("sell_status")]
    order = event.get("order")
    if isinstance(order, Mapping):
        values.extend((order.get("status"), order.get("sell_status")))
    return {str(value).strip().casefold() for value in values if value is not None}


def _event_timestamp(event: Mapping[str, Any]) -> datetime | None:
    for key in _TIME_FIELDS:
        value = event.get(key)
        if isinstance(value, datetime):
            parsed = value
        elif isinstance(value, str):
            try:
                parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
            except ValueError:
                continue
        else:
            continue
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    return None


def _contains_query(event: Mapping[str, Any], query: str) -> bool:
    pending: list[tuple[Any, int]] = [(event, 0)]
    visited = 0
    while pending and visited < 256:
        value, depth = pending.pop()
        visited += 1
        if isinstance(value, Mapping):
            if depth < 4:
                pending.extend((item, depth + 1) for item in value.values())
        elif isinstance(value, (list, tuple)):
            if depth < 4:
                pending.extend((item, depth + 1) for item in value[:64])
        elif value is not None and query in str(value).casefold():
            return True
    return False
