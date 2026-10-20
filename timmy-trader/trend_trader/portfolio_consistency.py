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
        if previous is None or str(event.get("closed_at") or event.get("recorded_at") or "") >= str(
            previous.get("closed_at") or previous.get("recorded_at") or ""
        ):
            deduped[key] = event
    closed = list(deduped.values())
    values: list[tuple[str, float]] = []
    missing = 0
    for event in closed:
        raw = event.get("paper_pnl")
        if isinstance(raw, bool) or not isinstance(raw, (int, float)) or not isfinite(float(raw)):
            missing += 1
            continue
        timestamp = str(event.get("closed_at") or event.get("submitted_at") or event.get("recorded_at") or "")
        values.append((timestamp, float(raw)))

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
