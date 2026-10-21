"""Read-only realized outcome summaries for supplied closed paper events.

These descriptive metrics are separate from the Trader Profile indicator. They
do not assign a grade or score and never infer open holdings or live balances.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import isfinite, sqrt
from typing import Iterable, Mapping


@dataclass(frozen=True)
class PortfolioConsistencySummary:
    status: str
    input_events: int
    closed_events: int
    valid_pnl_events: int
    missing_or_invalid_pnl_events: int
    minimum_trades_required: int
    realized_pnl: float | None
    win_rate_pct: float | None
    average_trade_pnl: float | None
    average_win: float | None
    average_loss: float | None
    expectancy_per_trade: float | None
    profit_factor: float | None
    best_trade: float | None
    worst_trade: float | None
    pnl_stddev: float | None
    max_winning_streak: int | None
    max_losing_streak: int | None
    max_drawdown_usd: float | None
    note: str


@dataclass(frozen=True)
class PaperPeriodReturns:
    daily_pnl: float | None
    daily_return_pct: float | None
    weekly_pnl: float | None
    weekly_return_pct: float | None
    daily_closed_trades: int
    weekly_closed_trades: int
    daily_missing_pnl: int
    weekly_missing_pnl: int
    status: str
    note: str


def summarize_paper_period_returns(
    events: Iterable[Mapping[str, object]],
    *,
    as_of: object,
    starting_balance: float | None = None,
) -> PaperPeriodReturns:
    """Summarize realized paper P&L for the date/week containing explicit `as_of`.

    Aware event timestamps are converted to the timezone on an aware `as_of`;
    naive timestamps are treated as local journal time. Percent returns are
    emitted only when a finite positive starting balance is explicitly
    supplied. A period with any missing/invalid P&L is withheld instead of
    treating absent values as zero.
    """
    from datetime import date, datetime, timedelta

    reporting_tz = as_of.tzinfo if isinstance(as_of, datetime) else None
    if isinstance(as_of, datetime):
        as_of_date = as_of.date()
    elif isinstance(as_of, date):
        as_of_date = as_of
    else:
        return PaperPeriodReturns(None, None, None, None, 0, 0, 0, 0, "invalid-date",
                                  "Supply an explicit datetime or date for the reporting period.")
    week_start = as_of_date - timedelta(days=as_of_date.weekday())
    periods: dict[str, list[tuple[float | None, object]]] = {"daily": [], "weekly": []}
    closed: dict[tuple[str, ...], Mapping[str, object]] = {}
    for index, event in enumerate(events):
        if (str(event.get("mode", "")).lower() != "paper"
                or str(event.get("sell_status", "")).lower() not in {"target-hit", "stopped"}):
            continue
        client_id = str(event.get("client_order_id") or event.get("order_id") or "").strip()
        if client_id:
            key = ("id", client_id)
        else:
            order = event.get("order")
            order = order if isinstance(order, Mapping) else {}
            symbol = str(event.get("symbol") or order.get("symbol") or "").upper()
            submitted = str(event.get("submitted_at") or event.get("recorded_at") or "")
            key = (("row", str(index)) if not symbol or not submitted else
                   ("legacy", symbol, submitted,
                    str(event.get("quantity") or order.get("quantity") or ""),
                    str(event.get("buy_price") or order.get("limit_price") or "")))
        previous = closed.get(key)
        if previous is None:
            closed[key] = event
        else:
            current_time = str(event.get("closed_at") or event.get("recorded_at") or "")
            previous_time = str(previous.get("closed_at") or previous.get("recorded_at") or "")
            if current_time >= previous_time:
                if (_finite_realized_pnl(event.get("paper_pnl")) is None
                        and _finite_realized_pnl(previous.get("paper_pnl")) is not None):
                    event = {**event, "paper_pnl": _finite_realized_pnl(previous.get("paper_pnl"))}
                closed[key] = event

    for event in closed.values():
        stamp = str(event.get("closed_at") or event.get("submitted_at") or event.get("recorded_at") or "")
        try:
            event_time = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue
        if event_time.tzinfo is not None and reporting_tz is not None:
            event_time = event_time.astimezone(reporting_tz)
        event_date = event_time.date()
        pnl = _finite_realized_pnl(event.get("paper_pnl"))
        if event_date == as_of_date:
            periods["daily"].append((pnl, event))
        if week_start <= event_date <= as_of_date:
            periods["weekly"].append((pnl, event))

    balance = _finite_realized_pnl(starting_balance)
    if balance is not None and balance <= 0:
        balance = None

    def period_value(name: str) -> tuple[float | None, float | None, int, int]:
        rows = periods[name]
        missing = sum(value is None for value, _event in rows)
        if not rows or missing:
            return None, None, len(rows), missing
        total = sum(value for value, _event in rows if value is not None)
        pct = round(total / balance * 100.0, 4) if balance is not None else None
        return round(total, 2), pct, len(rows), 0

    daily_pnl, daily_pct, daily_count, daily_missing = period_value("daily")
    weekly_pnl, weekly_pct, weekly_count, weekly_missing = period_value("weekly")
    missing = daily_missing + weekly_missing
    status = "incomplete" if missing else "available" if daily_count or weekly_count else "no-period-trades"
    note = "Daily/weekly realized P&L uses closed local paper events only."
    if balance is None:
        note += " Percent return needs an explicitly supplied positive starting balance."
    if missing:
        note += " Period totals with missing/non-finite P&L are withheld."
    if not daily_count and not weekly_count:
        note += " No closed paper trades fall in the selected day or current week."
    return PaperPeriodReturns(daily_pnl, daily_pct, weekly_pnl, weekly_pct,
                              daily_count, weekly_count, daily_missing, weekly_missing,
                              status, note)


def summarize_closed_paper_events(
    events: Iterable[Mapping[str, object]],
    *,
    minimum_trades: int = 5,
) -> PortfolioConsistencySummary:
    """Summarize fully realized paper outcomes using strict finite P&L values.

    A closed record must have mode `paper` and sell_status `target-hit` or
    `stopped`. `paper_pnl` must be a finite int/float (numeric strings and bools
    are rejected). If any closed paper record has missing/invalid P&L, all
    aggregate metrics are withheld and status is `incomplete`. Below the
    requested sample count, complete metrics are returned with status
    `insufficient-data` so callers can display them with that qualification.
    """
    supplied = tuple(events)
    threshold = max(int(minimum_trades), 1)
    closed_rows = [
        event for event in supplied
        if str(event.get("mode", "")).lower() == "paper"
        and str(event.get("sell_status", "")).lower() in {"target-hit", "stopped"}
    ]
    # Journal refreshes can append terminal updates more than once. Collapse
    # those updates before calculating metrics so the same trade is not counted
    # repeatedly. Prefer the stable client order id; otherwise use the fields
    # available in older local journal rows.
    deduped: dict[tuple[object, ...], Mapping[str, object]] = {}
    for index, event in enumerate(closed_rows):
        order_id = event.get("client_order_id") or event.get("order_id")
        if order_id:
            key: tuple[object, ...] = ("id", str(order_id))
        else:
            order = event.get("order")
            nested = order if isinstance(order, Mapping) else {}
            symbol = str(event.get("symbol") or nested.get("symbol") or "").upper()
            key = ("legacy", symbol,
                   str(event.get("submitted_at") or event.get("recorded_at") or ""),
                   str(event.get("quantity") or nested.get("quantity") or ""),
                   str(event.get("buy_price") or nested.get("limit_price") or ""))
            if not symbol and not (event.get("submitted_at") or event.get("recorded_at")):
                key = ("row", index)
        previous = deduped.get(key)
        if previous is None:
            deduped[key] = event
            continue
        is_newer = str(event.get("closed_at") or event.get("recorded_at") or "") >= str(
            previous.get("closed_at") or previous.get("recorded_at") or ""
        )
        if is_newer:
            # A later journal refresh may omit P&L even though an earlier
            # terminal update for this same trade had a valid realized value.
            # Preserve that value while still retaining the newer event fields.
            if _finite_realized_pnl(event.get("paper_pnl")) is None:
                prior_pnl = _finite_realized_pnl(previous.get("paper_pnl"))
                if prior_pnl is not None:
                    event = {**event, "paper_pnl": prior_pnl}
            deduped[key] = event
    closed = list(deduped.values())
    values: list[tuple[str, float]] = []
    missing = 0
    for event in closed:
        pnl = _finite_realized_pnl(event.get("paper_pnl"))
        if pnl is None:
            missing += 1
            continue
        timestamp = str(event.get("closed_at") or event.get("submitted_at") or event.get("recorded_at") or "")
        values.append((timestamp, pnl))

    base = dict(
        input_events=len(supplied), closed_events=len(closed), valid_pnl_events=len(values),
        missing_or_invalid_pnl_events=missing, minimum_trades_required=threshold,
    )
    if missing:
        return PortfolioConsistencySummary(
            status="incomplete", **base,
            realized_pnl=None, win_rate_pct=None, average_trade_pnl=None,
            average_win=None, average_loss=None, expectancy_per_trade=None,
            profit_factor=None, best_trade=None, worst_trade=None, pnl_stddev=None,
            max_winning_streak=None, max_losing_streak=None, max_drawdown_usd=None,
            note="At least one closed paper event lacks finite numeric paper_pnl; aggregate metrics are withheld.",
        )
    if not values:
        return PortfolioConsistencySummary(
            status="no-closed-data", **base,
            realized_pnl=None, win_rate_pct=None, average_trade_pnl=None,
            average_win=None, average_loss=None, expectancy_per_trade=None,
            profit_factor=None, best_trade=None, worst_trade=None, pnl_stddev=None,
            max_winning_streak=None, max_losing_streak=None, max_drawdown_usd=None,
            note="No closed paper events with realized outcomes were supplied.",
        )

    # The journal timestamp is the available event order; ties preserve the
    # original order because Python sorting is stable.
    ordered = sorted(enumerate(values), key=lambda item: (item[1][0], item[0]))
    pnls = [item[1][1] for item in ordered]
    wins = [value for value in pnls if value > 0]
    losses = [value for value in pnls if value < 0]
    total = sum(pnls)
    mean = total / len(pnls)
    stddev = sqrt(sum((value - mean) ** 2 for value in pnls) / len(pnls))
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else None

    max_win_streak = max_loss_streak = win_streak = loss_streak = 0
    curve = peak = drawdown = 0.0
    for pnl in pnls:
        if pnl > 0:
            win_streak += 1
            loss_streak = 0
        elif pnl < 0:
            loss_streak += 1
            win_streak = 0
        else:
            win_streak = loss_streak = 0
        max_win_streak = max(max_win_streak, win_streak)
        max_loss_streak = max(max_loss_streak, loss_streak)
        curve += pnl
        peak = max(peak, curve)
        drawdown = max(drawdown, peak - curve)

    enough = len(pnls) >= threshold
    note = (
        "Descriptive realized-paper metrics only; excludes open/unrealized holdings, fees, slippage, and account equity. "
        "Drawdown is dollar peak-to-trough change in cumulative realized P&L, not account-equity drawdown."
    )
    if not enough:
        note += f" Sample is below the requested minimum of {threshold} closed trades."
    if gross_loss == 0:
        note += " Profit factor is unavailable because there are no realized losses."
    return PortfolioConsistencySummary(
        status="complete" if enough else "insufficient-data",
        **base,
        realized_pnl=round(total, 2),
        win_rate_pct=round(len(wins) / len(pnls) * 100.0, 2),
        average_trade_pnl=round(mean, 2),
        average_win=round(sum(wins) / len(wins), 2) if wins else None,
        average_loss=round(sum(losses) / len(losses), 2) if losses else None,
        expectancy_per_trade=round(mean, 2),
        profit_factor=round(profit_factor, 4) if profit_factor is not None else None,
        best_trade=round(max(pnls), 2),
        worst_trade=round(min(pnls), 2),
        pnl_stddev=round(stddev, 2),
        max_winning_streak=max_win_streak,
        max_losing_streak=max_loss_streak,
        max_drawdown_usd=round(drawdown, 2),
        note=note,
    )


def _finite_realized_pnl(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    try:
        number = float(value)
    except OverflowError:
        return None
    return number if isfinite(number) else None
