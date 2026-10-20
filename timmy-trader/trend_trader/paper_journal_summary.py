"""Pure UX summaries for completed paper-trade journal records.

This helper reads no files and has no broker or trading side effects. It only
summarizes explicitly closed paper outcomes present in the supplied records.
"""

from __future__ import annotations

import math
from collections.abc import Iterable, Mapping
from dataclasses import dataclass


_CLOSED = {"target-hit", "stopped"}


@dataclass(frozen=True)
class PaperJournalSummary:
    closed_trade_count: int
    wins: int
    losses: int
    breakeven: int
    win_rate: float | None
    average_win: float | None
    average_loss: float | None
    expectancy: float | None
    current_win_streak: int
    current_loss_streak: int
    longest_win_streak: int
    longest_loss_streak: int
    closed_trades_missing_pnl: int
    ignored_non_paper_records: int
    ignored_nonclosed_records: int
    duplicate_records: int
    incomplete_data: bool
    incomplete_reasons: tuple[str, ...]


def summarize_paper_journal(events: Iterable[Mapping[str, object]]) -> PaperJournalSummary:
    """Summarize closed paper outcomes in supplied execution-event mappings.

    A record is eligible only when ``mode == 'paper'`` and ``sell_status`` is
    ``'target-hit'`` or ``'stopped'``. ``paper_pnl`` must be a finite number to
    contribute to win/loss statistics. Missing P&L keeps the explicitly closed
    record in ``closed_trade_count`` but marks the summary incomplete; affected
    metrics are returned as ``None`` rather than treating absent data as zero.

    Open/pending records, live records, and unrecognized records do not become
    trades or positions here. This function makes no claims about holdings.
    Duplicate terminal records are collapsed by ``client_order_id`` when
    present, otherwise by a fallback tuple of symbol, submitted time, quantity,
    and buy price. Later duplicate data can fill a missing P&L.
    """

    closed_by_key: dict[tuple[object, ...], tuple[Mapping[str, object], float | None]] = {}
    ignored_non_paper = 0
    ignored_nonclosed = 0
    duplicate_count = 0
    malformed_records = 0

    for event_index, event in enumerate(events):
        if not isinstance(event, Mapping):
            malformed_records += 1
            continue
        if str(event.get("mode", "")).strip().lower() != "paper":
            ignored_non_paper += 1
            continue
        if str(event.get("sell_status", "")).strip().lower() not in _CLOSED:
            ignored_nonclosed += 1
            continue
        pnl = _finite_number(event.get("paper_pnl"))
        key = _trade_key(event, event_index)
        previous = closed_by_key.get(key)
        if previous is None:
            closed_by_key[key] = (event, pnl)
            continue
        duplicate_count += 1
        previous_event, previous_pnl = previous
        if previous_pnl is None and pnl is not None:
            closed_by_key[key] = (event, pnl)
        elif _event_time(event) > _event_time(previous_event):
            closed_by_key[key] = (event, previous_pnl if pnl is None else pnl)

    ordered = sorted(closed_by_key.values(), key=lambda item: _event_time(item[0]))
    complete = [(event, pnl) for event, pnl in ordered if pnl is not None]
    missing = len(ordered) - len(complete)
    wins_pnl = [pnl for _, pnl in complete if pnl > 0]
    losses_pnl = [pnl for _, pnl in complete if pnl < 0]
    breakeven = sum(1 for _, pnl in complete if pnl == 0)

    outcomes = [None if pnl is None else 1 if pnl > 0 else -1 if pnl < 0 else 0 for _, pnl in ordered]
    longest_win, longest_loss = _longest_streaks(outcomes)
    current_win = _current_streak(outcomes, 1)
    current_loss = _current_streak(outcomes, -1)

    reasons: list[str] = []
    if malformed_records:
        reasons.append(f"{malformed_records} malformed event record(s) were ignored")
    if missing:
        reasons.append(f"{missing} closed paper trade(s) lack a finite realized P&L")

    # A partial set is useful to display, but label aggregate results incomplete
    # and avoid misleading percentages/averages that imply a full journal.
    all_closed_complete = missing == 0 and malformed_records == 0
    pnls = [pnl for _, pnl in complete]
    return PaperJournalSummary(
        closed_trade_count=len(ordered),
        wins=len(wins_pnl),
        losses=len(losses_pnl),
        breakeven=breakeven,
        win_rate=(len(wins_pnl) / len(complete) if complete and all_closed_complete else None),
        average_win=(sum(wins_pnl) / len(wins_pnl) if wins_pnl and all_closed_complete else None),
        average_loss=(sum(losses_pnl) / len(losses_pnl) if losses_pnl and all_closed_complete else None),
        expectancy=(sum(pnls) / len(pnls) if pnls and all_closed_complete else None),
        current_win_streak=current_win,
        current_loss_streak=current_loss,
        longest_win_streak=longest_win,
        longest_loss_streak=longest_loss,
        closed_trades_missing_pnl=missing,
        ignored_non_paper_records=ignored_non_paper,
        ignored_nonclosed_records=ignored_nonclosed,
        duplicate_records=duplicate_count,
        incomplete_data=bool(reasons),
        incomplete_reasons=tuple(reasons),
    )


def _finite_number(value: object) -> float | None:
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError, OverflowError):
        return None
    return number if math.isfinite(number) else None


def _trade_key(event: Mapping[str, object], event_index: int) -> tuple[object, ...]:
    client_id = str(event.get("client_order_id") or "").strip()
    if client_id:
        return ("client", client_id)
    order = event.get("order")
    order = order if isinstance(order, Mapping) else {}
    symbol = str(event.get("symbol") or order.get("symbol") or "").strip().upper()
    submitted = str(event.get("submitted_at") or event.get("recorded_at") or "")
    if not symbol or not submitted:
        return ("unique-record", event_index)
    return (
        "fallback",
        symbol,
        submitted,
        str(event.get("quantity") or order.get("quantity") or ""),
        str(event.get("buy_price") or order.get("limit_price") or ""),
    )


def _event_time(event: Mapping[str, object]) -> str:
    return str(event.get("closed_at") or event.get("submitted_at") or event.get("recorded_at") or "")


def _current_streak(outcomes: list[int | None], outcome: int) -> int:
    count = 0
    for item in reversed(outcomes):
        if item != outcome:
            break
        count += 1
    return count


def _longest_streaks(outcomes: list[int | None]) -> tuple[int, int]:
    longest_win = longest_loss = current_win = current_loss = 0
    for item in outcomes:
        current_win = current_win + 1 if item == 1 else 0
        current_loss = current_loss + 1 if item == -1 else 0
        longest_win = max(longest_win, current_win)
        longest_loss = max(longest_loss, current_loss)
    return longest_win, longest_loss
