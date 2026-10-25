"""Read-only performance feedback for local Paper and Simulation automation.

Integration contract
--------------------
Call :func:`analyze_automation_history` with the app's in-memory execution
events and an explicit ``lane`` of ``"paper"`` or ``"simulation"``. The
function performs no file I/O, market-data request, broker request, or config
write. It returns immutable metrics and human-review recommendations. A caller
may render the result in the Automation workspace, but must not apply its
recommendations to strategy or Live settings automatically.

Only completed local outcomes contribute to return, drawdown, and signal
cohorts. Fill rate and slippage are reported only when explicit fill fields are
present; the current local daily-candle model assumes an entry price and cannot
establish real fills or slippage.
"""
from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from math import isfinite
from typing import Any

from .decision_insights import paper_performance
from .paper_journal_summary import summarize_paper_journal

_LOCAL_LANES = {"paper", "simulation"}
_CLOSED = {"target-hit", "stopped"}
_TRADE_EVENT_TYPES = {"buy-order", "paper-outcome", "simulation-outcome"}


@dataclass(frozen=True)
class CohortOutcome:
    """Closed outcome summary for one signal cohort."""

    dimension: str
    cohort: str
    closed_trades: int
    complete_pnl_trades: int
    wins: int
    losses: int
    net_pnl: float | None
    average_pnl: float | None
    win_rate_pct: float | None
    meets_review_sample: bool


@dataclass(frozen=True)
class InsightRecommendation:
    """A suggestion for human review; this type never represents an action."""

    category: str
    priority: str
    message: str
    evidence: str
    requires_human_review: bool = True
    live_configuration_modified: bool = False


@dataclass(frozen=True)
class AutomationInsights:
    """Descriptive automation history with explicit coverage and limitations."""

    lane: str
    status: str
    input_event_count: int
    malformed_event_count: int
    ignored_non_trade_event_count: int
    trade_count: int
    closed_outcomes: int
    pending_outcomes: int
    closed_outcome_rate_pct: float | None
    wins: int
    losses: int
    breakeven: int
    win_rate_pct: float | None
    net_pnl: float | None
    return_pct: float | None
    max_drawdown_usd: float | None
    max_drawdown_pct: float | None
    missing_pnl_count: int
    fill_rate_pct: float | None
    fill_rate_status: str
    fill_observation_count: int
    slippage_mean_bps: float | None
    slippage_status: str
    slippage_observation_count: int
    explicit_rule_violation_count: int
    potential_guard_violation_events: int
    rule_counts: tuple[tuple[str, int], ...]
    signal_snapshot_coverage_pct: float | None
    cohort_outcomes: tuple[CohortOutcome, ...]
    recommendations: tuple[InsightRecommendation, ...]
    notes: tuple[str, ...]


def analyze_automation_history(
    events: Iterable[Mapping[str, Any]],
    *,
    lane: str,
    starting_balance: float | None = None,
    minimum_cohort_sample: int = 5,
) -> AutomationInsights:
    """Summarize supplied local Paper or Simulation automation history.

    ``starting_balance`` is optional and never inferred from cash or positions.
    Percentage return and percentage drawdown remain unavailable without a
    finite positive explicit value. ``minimum_cohort_sample`` only controls
    whether a cohort may be mentioned in a recommendation; small cohorts still
    appear in the descriptive output with ``meets_review_sample=False``.

    The function deliberately rejects ``lane="live"``. It is not a live
    trading analyzer and cannot update settings or make execution decisions.
    """
    target = str(lane).strip().lower()
    if target not in _LOCAL_LANES:
        raise ValueError("lane must be 'paper' or 'simulation'; live analysis is not supported")
    min_sample = max(int(minimum_cohort_sample), 1)
    supplied = list(events)
    malformed = sum(not isinstance(event, Mapping) for event in supplied)

    selected: list[Mapping[str, Any]] = []
    ignored_non_trade = 0
    for event in supplied:
        if not isinstance(event, Mapping):
            continue
        if str(event.get("mode", "")).strip().lower() != target:
            continue
        if not _is_trade_record(event):
            ignored_non_trade += 1
            continue
        selected.append(event)

    trades = _deduplicate_trade_rows(selected)
    closed = [event for event in trades if _is_closed(event)]
    pending = sum(
        str(event.get("sell_status", "")).strip().lower() == "target-pending"
        for event in trades
    )
    # Existing summaries intentionally accept only Paper records. Normalize
    # copies for Simulation; never mutate or relabel the caller's events.
    normalized = tuple({**event, "mode": "paper"} for event in trades)
    journal = summarize_paper_journal(normalized)
    performance = paper_performance(normalized, starting_balance=starting_balance)

    fill_rate, fill_status, fill_observations = _fill_rate(trades)
    slippage, slippage_status, slippage_observations = _slippage_summary(trades)
    explicit_violations, potential_violations, rule_counts = _rule_audit(trades)
    cohorts, snapshot_coverage = _cohort_summaries(closed, min_sample)

    notes = [
        "Paper and Simulation outcomes describe local models, not broker-confirmed executions.",
        "Return and percentage drawdown require an explicitly supplied positive starting balance.",
        "Fill rate and slippage use explicit event fields only; they are not inferred from accepted orders or candle outcomes.",
        "Recommendations are review prompts. This module never changes strategy, automation, risk, or Live settings.",
    ]
    status = "available"
    if not trades:
        status = "no-trades"
    elif malformed or journal.incomplete_data:
        status = "incomplete-data"
    elif not closed:
        status = "awaiting-outcomes"
    elif len(closed) < min_sample:
        status = "small-sample"

    recommendations = _recommendations(
        lane=target,
        trade_count=len(trades),
        closed_count=len(closed),
        missing_pnl=journal.closed_trades_missing_pnl,
        net_pnl=performance.realized_pnl,
        fill_status=fill_status,
        slippage_status=slippage_status,
        explicit_violations=explicit_violations,
        potential_violations=potential_violations,
        cohorts=cohorts,
        minimum_sample=min_sample,
    )
    return AutomationInsights(
        lane=target,
        status=status,
        input_event_count=len(supplied),
        malformed_event_count=malformed,
        ignored_non_trade_event_count=ignored_non_trade,
        trade_count=len(trades),
        closed_outcomes=len(closed),
        pending_outcomes=pending,
        closed_outcome_rate_pct=(round(len(closed) / len(trades) * 100.0, 2) if trades else None),
        wins=journal.wins,
        losses=journal.losses,
        breakeven=journal.breakeven,
        win_rate_pct=(round(journal.win_rate * 100.0, 2) if journal.win_rate is not None else None),
        net_pnl=performance.realized_pnl,
        return_pct=performance.return_pct,
        max_drawdown_usd=performance.max_drawdown_usd,
        max_drawdown_pct=performance.max_drawdown_pct,
        missing_pnl_count=journal.closed_trades_missing_pnl,
        fill_rate_pct=(round(fill_rate * 100.0, 2) if fill_rate is not None else None),
        fill_rate_status=fill_status,
        fill_observation_count=fill_observations,
        slippage_mean_bps=(round(slippage, 3) if slippage is not None else None),
        slippage_status=slippage_status,
        slippage_observation_count=slippage_observations,
        explicit_rule_violation_count=explicit_violations,
        potential_guard_violation_events=potential_violations,
        rule_counts=rule_counts,
        signal_snapshot_coverage_pct=(
            round(snapshot_coverage * 100.0, 2) if closed else None
        ),
        cohort_outcomes=cohorts,
        recommendations=recommendations,
        notes=tuple(notes),
    )


def _is_trade_record(event: Mapping[str, Any]) -> bool:
    event_type = str(event.get("event_type", "")).strip().lower()
    sell_status = str(event.get("sell_status", "")).strip().lower()
    status = str(event.get("status", "")).strip().lower()
    return (
        event_type in _TRADE_EVENT_TYPES
        or sell_status in _CLOSED | {"target-pending"}
        or status in {"accepted-paper", "accepted-simulation"}
    )


def _is_closed(event: Mapping[str, Any]) -> bool:
    return str(event.get("sell_status", "")).strip().lower() in _CLOSED


def _deduplicate_trade_rows(events: Sequence[Mapping[str, Any]]) -> list[Mapping[str, Any]]:
    by_key: dict[tuple[str, ...], Mapping[str, Any]] = {}
    for index, event in enumerate(events):
        key = _trade_key(event, index)
        previous = by_key.get(key)
        if previous is None or _prefer_event(event, previous):
            if previous is not None and _is_closed(event) and _pnl(event) is None and _pnl(previous) is not None:
                event = {**event, "paper_pnl": _pnl(previous)}
            by_key[key] = event
    return sorted(by_key.values(), key=_event_sort_key)


def _trade_key(event: Mapping[str, Any], index: int) -> tuple[str, ...]:
    order = event.get("order")
    order = order if isinstance(order, Mapping) else {}
    client_id = str(
        event.get("client_order_id") or event.get("order_id") or order.get("client_order_id") or ""
    ).strip()
    if client_id:
        return ("id", client_id)
    symbol = str(event.get("symbol") or order.get("symbol") or "").strip().upper()
    submitted = str(event.get("submitted_at") or event.get("recorded_at") or "").strip()
    quantity = str(event.get("quantity") or order.get("quantity") or "")
    price = str(event.get("buy_price") or order.get("limit_price") or "")
    if symbol and submitted:
        return ("legacy", symbol, submitted, quantity, price)
    return ("row", str(index))


def _prefer_event(candidate: Mapping[str, Any], previous: Mapping[str, Any]) -> bool:
    candidate_closed, previous_closed = _is_closed(candidate), _is_closed(previous)
    if candidate_closed != previous_closed:
        return candidate_closed
    candidate_has_pnl, previous_has_pnl = _pnl(candidate) is not None, _pnl(previous) is not None
    if candidate_has_pnl != previous_has_pnl:
        return candidate_has_pnl
    return _event_sort_key(candidate) >= _event_sort_key(previous)


def _event_sort_key(event: Mapping[str, Any]) -> tuple[float, str]:
    raw = str(event.get("closed_at") or event.get("submitted_at") or event.get("recorded_at") or "")
    try:
        stamp = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=timezone.utc)
        return stamp.timestamp(), raw
    except (TypeError, ValueError, OverflowError):
        return float("-inf"), raw


def _pnl(event: Mapping[str, Any]) -> float | None:
    value = event.get("paper_pnl")
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    try:
        number = float(value)
    except (ValueError, OverflowError):
        return None
    return number if isfinite(number) else None


def _fill_rate(events: Sequence[Mapping[str, Any]]) -> tuple[float | None, str, int]:
    denominator = 0.0
    numerator = 0.0
    observations = 0
    invalid = False
    for event in events:
        order = event.get("order")
        order = order if isinstance(order, Mapping) else {}
        requested = _first_number((event.get("quantity"), order.get("quantity")))
        filled = _first_number((
            event.get("filled_quantity"), event.get("filled_qty"), event.get("executed_quantity"),
            order.get("filled_quantity"), order.get("filled_qty"),
        ))
        if requested is None or requested <= 0 or filled is None or filled < 0 or filled > requested:
            invalid = True
            continue
        denominator += requested
        numerator += filled
        observations += 1
    if not observations:
        return None, "unavailable", 0
    if invalid or observations < len(events):
        return numerator / denominator, "partial", observations
    return numerator / denominator, "complete", observations


def _slippage_summary(events: Sequence[Mapping[str, Any]]) -> tuple[float | None, str, int]:
    values: list[float] = []
    for event in events:
        value = event.get("realized_slippage_bps")
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            continue
        try:
            number = float(value)
        except (TypeError, ValueError, OverflowError):
            continue
        if isfinite(number):
            values.append(number)
    if not values:
        return None, "unavailable", 0
    status = "complete" if len(values) == len(events) else "partial"
    return sum(values) / len(values), status, len(values)


def _rule_audit(events: Sequence[Mapping[str, Any]]) -> tuple[int, int, tuple[tuple[str, int], ...]]:
    explicit_count = 0
    potential_guard_events = 0
    counts: dict[str, int] = defaultdict(int)
    for event in events:
        raw = event.get("rule_violations", event.get("guardrail_violations", ()))
        names = _names(raw)
        explicit_count += len(names)
        for name in names:
            counts[name] += 1
        context = event.get("paper_context")
        context = context if isinstance(context, Mapping) else {}
        blocks = event.get("operational_blocks", context.get("operational_blocks", ()))
        block_names = _names(blocks)
        if _is_submitted_or_closed(event) and block_names:
            potential_guard_events += 1
            counts["recorded operational block on submitted outcome"] += 1
    return explicit_count, potential_guard_events, tuple(sorted(counts.items()))


def _names(value: Any) -> tuple[str, ...]:
    if value is True:
        return ("unspecified rule violation",)
    if isinstance(value, str):
        name = value.strip()[:120]
        return (name,) if name else ()
    if isinstance(value, Mapping):
        named = value.get("rule") or value.get("name") or value.get("code")
        if named:
            return _names(named)
        return tuple(str(key).strip()[:120] for key, active in value.items() if active and str(key).strip())
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
        return tuple(name for item in value for name in _names(item))
    return ()


def _is_submitted_or_closed(event: Mapping[str, Any]) -> bool:
    return _is_closed(event) or str(event.get("status", "")).strip().lower() in {
        "accepted-paper", "accepted-simulation", "submitted", "filled", "executed"
    }


def _cohort_summaries(
    events: Sequence[Mapping[str, Any]], minimum_sample: int
) -> tuple[tuple[CohortOutcome, ...], float]:
    groups: dict[tuple[str, str], list[float | None]] = defaultdict(list)
    covered = 0
    for event in events:
        snapshot = _signal_snapshot(event)
        if not snapshot:
            continue
        covered += 1
        features = {
            "setup": _label(snapshot.get("setup")),
            "direction": _label(snapshot.get("direction")),
            "decision": _label(snapshot.get("decision") or snapshot.get("sensible_action") or snapshot.get("scout_action")),
            "score band": _score_band(
                snapshot.get("sensible_score", snapshot.get("score", snapshot.get("scout_score")))
            ),
        }
        pnl = _pnl(event)
        for dimension, cohort in features.items():
            if cohort is not None:
                groups[(dimension, cohort)].append(pnl)

    rows: list[CohortOutcome] = []
    for (dimension, cohort), pnls in sorted(groups.items()):
        valid = [value for value in pnls if value is not None]
        complete = len(valid) == len(pnls)
        wins = sum(value > 0 for value in valid)
        losses = sum(value < 0 for value in valid)
        rows.append(CohortOutcome(
            dimension=dimension,
            cohort=cohort,
            closed_trades=len(pnls),
            complete_pnl_trades=len(valid),
            wins=wins,
            losses=losses,
            net_pnl=round(sum(valid), 2) if valid and complete else None,
            average_pnl=round(sum(valid) / len(valid), 2) if valid and complete else None,
            win_rate_pct=round(wins / len(valid) * 100.0, 2) if valid and complete else None,
            meets_review_sample=len(pnls) >= minimum_sample and complete,
        ))
    coverage = covered / len(events) if events else 0.0
    return tuple(rows), coverage


def _signal_snapshot(event: Mapping[str, Any]) -> Mapping[str, Any]:
    raw = event.get("signal_snapshot")
    if isinstance(raw, Mapping):
        return raw
    context = event.get("paper_context")
    if isinstance(context, Mapping):
        raw = context.get("signal_snapshot")
        if isinstance(raw, Mapping):
            return raw
    return {}


def _label(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or len(text) > 48 or any(ord(char) < 32 for char in text):
        return None
    return text


def _score_band(value: Any) -> str | None:
    score = _first_number((value,))
    if score is None or score < 0 or score > 100:
        return None
    if score < 60:
        return "under 60"
    if score < 70:
        return "60-69"
    if score < 80:
        return "70-79"
    if score < 90:
        return "80-89"
    return "90+"


def _first_number(values: Sequence[Any]) -> float | None:
    for value in values:
        if isinstance(value, bool) or value is None:
            continue
        try:
            number = float(value)
        except (TypeError, ValueError, OverflowError):
            continue
        if isfinite(number):
            return number
    return None


def _recommendations(
    *,
    lane: str,
    trade_count: int,
    closed_count: int,
    missing_pnl: int,
    net_pnl: float | None,
    fill_status: str,
    slippage_status: str,
    explicit_violations: int,
    potential_violations: int,
    cohorts: Sequence[CohortOutcome],
    minimum_sample: int,
) -> tuple[InsightRecommendation, ...]:
    recommendations: list[InsightRecommendation] = []
    if potential_violations or explicit_violations:
        recommendations.append(InsightRecommendation(
            "guard-review", "high",
            "Review local trade records with recorded rule violations or operational blocks before enabling further automation.",
            f"explicit violations={explicit_violations}; submitted outcomes carrying operational blocks={potential_violations}",
        ))
    if missing_pnl:
        recommendations.append(InsightRecommendation(
            "data-quality", "high",
            "Reconcile closed local outcomes with missing or invalid realized P&L before comparing settings.",
            f"closed outcomes missing finite P&L={missing_pnl}",
        ))
    if closed_count < minimum_sample:
        recommendations.append(InsightRecommendation(
            "sample-size", "normal",
            f"Collect at least {minimum_sample} closed {lane} outcomes before drawing cohort conclusions.",
            f"closed outcomes={closed_count}; minimum review sample={minimum_sample}",
        ))
    underperforming = [
        row for row in cohorts
        if row.meets_review_sample and row.net_pnl is not None and row.net_pnl < 0
    ]
    for row in underperforming[:4]:
        recommendations.append(InsightRecommendation(
            "cohort-review", "normal",
            f"Manually review the {row.dimension} cohort “{row.cohort}” in research before considering any strategy change.",
            f"closed outcomes={row.closed_trades}; net local P&L=${row.net_pnl:,.2f}; win rate={row.win_rate_pct}%",
        ))
    if net_pnl is not None and net_pnl < 0 and closed_count >= minimum_sample:
        recommendations.append(InsightRecommendation(
            "performance-review", "normal",
            f"Review the {lane} period and its risk notes before continuing unattended local automation.",
            f"net realized local P&L=${net_pnl:,.2f}; closed outcomes={closed_count}",
        ))
    if fill_status == "unavailable" or slippage_status == "unavailable":
        recommendations.append(InsightRecommendation(
            "execution-evidence", "normal",
            "Do not treat local fill or candle outcomes as evidence of Live fill quality; explicit fill and slippage observations are absent.",
            f"fill evidence={fill_status}; realized slippage evidence={slippage_status}",
        ))
    if not recommendations:
        recommendations.append(InsightRecommendation(
            "continue-review", "low",
            "Continue monitoring the local outcomes and compare cohorts manually; no automatic strategy change is suggested.",
            f"closed outcomes={closed_count}; trade records={trade_count}",
        ))
    return tuple(recommendations)
