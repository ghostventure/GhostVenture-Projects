"""Read-only, GUI-neutral automation view models.

The caller supplies already-fetched local snapshots. This module does not read
files, contact a broker, change automation state, or submit orders.
"""
from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime, timezone
from itertools import islice
from math import isfinite
from typing import Literal

from .broker_reconciliation import ReconciliationReport, reconcile_broker_state
from .decision_insights import paper_performance
from .market_guards import GuardResult
from .paper_journal_summary import summarize_paper_journal
from .risk import AutomationRiskDecision


MAX_JOURNAL_EVENTS = 5_000
MAX_BROKER_ORDERS = 1_000
MAX_BROKER_POSITIONS = 1_000
MAX_VISIBLE_ISSUES = 12
MAX_VISIBLE_FILLS = 12
MAX_VISIBLE_REASONS = 8
MAX_TEXT_LENGTH = 200

HealthState = Literal["idle", "running", "waiting", "held", "healthy", "degraded", "unavailable"]
ResultState = Literal["allowed", "blocked", "unavailable"]
ReconciliationState = Literal["reconciled", "guarded", "attention", "unavailable", "input-limit-exceeded"]
InsightState = Literal["available", "incomplete", "no-closed-trades", "unavailable", "input-limit-exceeded"]


@dataclass(frozen=True)
class AutomationCycleSnapshot:
    """Small normalized cycle state assembled by the application layer."""

    state: str
    target: str
    mode: str
    enabled_lanes: tuple[str, ...] = ()
    next_run_at: datetime | None = None
    last_run_at: datetime | None = None
    last_duration_seconds: float | None = None
    last_result: str | None = None
    wait_reason: str | None = None
    hold_reason: str | None = None
    data_status: str | None = None


@dataclass(frozen=True)
class AutomationHealthView:
    state: HealthState
    target: str
    mode: str
    enabled_lanes: tuple[str, ...]
    next_run_at: datetime | None
    last_run_at: datetime | None
    last_duration_seconds: float | None
    last_result: str
    wait_reason: str
    hold_reason: str
    data_status: str


@dataclass(frozen=True)
class RiskDecisionView:
    state: ResultState
    symbol: str
    quantity: float | None
    notional: float | None
    reasons: tuple[str, ...]
    reasons_truncated: bool
    guards: tuple[tuple[str, str, str], ...]
    guards_truncated: bool


@dataclass(frozen=True)
class ReconciliationIssueView:
    severity: str
    code: str
    symbol: str
    message: str


@dataclass(frozen=True)
class FillView:
    symbol: str
    side: str
    quantity: float | None
    average_price: float | None
    status: str


@dataclass(frozen=True)
class LiveReconciliationView:
    state: ReconciliationState
    journal_orders: int
    broker_orders: int
    open_orders: int
    fills: int
    positions: int
    duplicate_blocks: int
    issues: tuple[ReconciliationIssueView, ...]
    issue_count: int
    issues_truncated: bool
    recent_fills: tuple[FillView, ...]
    fills_truncated: bool
    message: str


@dataclass(frozen=True)
class LaneInsightsView:
    lane: Literal["paper", "simulation"]
    state: InsightState
    closed_trades: int
    wins: int
    losses: int
    breakeven: int
    win_rate: float | None
    expectancy: float | None
    realized_pnl: float | None
    return_pct: float | None
    max_drawdown_usd: float | None
    max_drawdown_pct: float | None
    current_win_streak: int
    current_loss_streak: int
    incomplete_reasons: tuple[str, ...]
    message: str


@dataclass(frozen=True)
class AutomationBackendView:
    generated_at: datetime
    cycle: AutomationHealthView
    risk: RiskDecisionView
    live_reconciliation: LiveReconciliationView
    paper: LaneInsightsView
    simulation: LaneInsightsView


def build_automation_backend_view(
    cycle: AutomationCycleSnapshot | None,
    risk_decision: AutomationRiskDecision | None,
    *,
    live_journal_events: Iterable[Mapping[str, object]] | None = None,
    broker_orders: Iterable[Mapping[str, object]] | None = None,
    broker_positions: Iterable[Mapping[str, object]] | None = None,
    paper_events: Iterable[Mapping[str, object]] | None = None,
    simulation_events: Iterable[Mapping[str, object]] | None = None,
    paper_starting_balance: float | None = None,
    simulation_starting_balance: float | None = None,
    now: datetime | None = None,
) -> AutomationBackendView:
    """Build a bounded immutable view from current local snapshots.

    The caller is responsible for fetching account/order snapshots and
    selecting only the relevant Live journal records. Missing reconciliation
    inputs produce ``unavailable`` rather than an implied healthy state.
    Risk decisions and journal metrics are delegated to their existing pure
    helpers; this function only adapts their outputs for UI consumption.
    """
    return AutomationBackendView(
        generated_at=now or datetime.now(timezone.utc),
        cycle=normalize_cycle_health(cycle),
        risk=normalize_risk_decision(risk_decision),
        live_reconciliation=build_live_reconciliation_view(
            live_journal_events, broker_orders, broker_positions,
        ),
        paper=build_lane_insights_view("paper", paper_events, starting_balance=paper_starting_balance),
        simulation=build_lane_insights_view("simulation", simulation_events, starting_balance=simulation_starting_balance),
    )


def normalize_cycle_health(cycle: AutomationCycleSnapshot | None) -> AutomationHealthView:
    if cycle is None:
        return AutomationHealthView(
            "unavailable", "", "", (), None, None, None,
            "Cycle state is unavailable.", "", "", "",
        )
    raw_state = str(cycle.state or "").strip().lower()
    if cycle.hold_reason or raw_state == "held":
        state: HealthState = "held"
    elif raw_state in {"running", "waiting", "idle"}:
        state = raw_state  # type: ignore[assignment]
    elif raw_state == "paused":
        state = "idle"
    elif raw_state in {"healthy", "complete", "completed", "armed", "ready"}:
        state = "healthy"
    elif raw_state in {"failed", "error", "degraded", "blocked"}:
        state = "degraded"
    else:
        state = "unavailable"
    duration = cycle.last_duration_seconds
    if duration is not None and (duration < 0 or not isfinite(duration)):
        duration = None
    return AutomationHealthView(
        state=state,
        target=_clean(cycle.target, 32).upper(),
        mode=_clean(cycle.mode, 32).upper(),
        enabled_lanes=tuple(_clean(item, 32) for item in cycle.enabled_lanes[:8]),
        next_run_at=cycle.next_run_at,
        last_run_at=cycle.last_run_at,
        last_duration_seconds=duration,
        last_result=_clean(cycle.last_result, MAX_TEXT_LENGTH),
        wait_reason=_clean(cycle.wait_reason, MAX_TEXT_LENGTH),
        hold_reason=_clean(cycle.hold_reason, MAX_TEXT_LENGTH),
        data_status=_clean(cycle.data_status, 48),
    )


def normalize_risk_decision(decision: AutomationRiskDecision | None) -> RiskDecisionView:
    if decision is None:
        return RiskDecisionView("unavailable", "", None, None, ("Risk evaluation is unavailable.",), False, (), False)
    plan = decision.plan
    state: ResultState = "allowed" if decision.allowed else "blocked"
    reasons = tuple(_clean(reason, MAX_TEXT_LENGTH) for reason in decision.reasons[:MAX_VISIBLE_REASONS])
    guards = tuple(
        (
            _clean(guard.name, 48),
            _clean(guard.status, 24),
            _clean(guard.reason, MAX_TEXT_LENGTH),
        )
        for guard in decision.guards[:MAX_VISIBLE_REASONS]
    )
    return RiskDecisionView(
        state=state,
        symbol=_clean(plan.symbol, 16).upper() if plan else "",
        quantity=_finite_or_none(plan.quantity) if plan else None,
        notional=_finite_or_none(plan.notional) if plan else None,
        reasons=reasons,
        reasons_truncated=len(decision.reasons) > len(reasons),
        guards=guards,
        guards_truncated=len(decision.guards) > len(guards),
    )


def build_live_reconciliation_view(
    journal_events: Iterable[Mapping[str, object]] | None,
    broker_orders: Iterable[Mapping[str, object]] | None,
    broker_positions: Iterable[Mapping[str, object]] | None,
) -> LiveReconciliationView:
    if journal_events is None or broker_orders is None or broker_positions is None:
        return _unavailable_reconciliation("Live journal, order, and position snapshots are all required.")
    try:
        journal, journal_complete = _bounded_records(journal_events, MAX_JOURNAL_EVENTS)
        orders, orders_complete = _bounded_records(broker_orders, MAX_BROKER_ORDERS)
        positions, positions_complete = _bounded_records(broker_positions, MAX_BROKER_POSITIONS)
    except Exception:
        return _unavailable_reconciliation("Supplied Live snapshots could not be read completely.")
    if not journal_complete or not orders_complete or not positions_complete:
        return LiveReconciliationView(
            "input-limit-exceeded", 0, 0, 0, 0, 0, 0, (), 0, False, (), False,
            "Reconciliation snapshot exceeds the bounded review limit; no complete status is available.",
        )
    try:
        report = reconcile_broker_state(journal, orders, positions)
    except Exception:
        return _unavailable_reconciliation("Supplied Live snapshots could not be reconciled.")
    return normalize_reconciliation_report(report)


def normalize_reconciliation_report(report: ReconciliationReport) -> LiveReconciliationView:
    issue_count = len(report.issues)
    issues = tuple(
        ReconciliationIssueView(
            _clean(issue.severity, 16),
            _clean(issue.code, 64),
            _clean(issue.symbol, 16).upper(),
            _clean(issue.message, MAX_TEXT_LENGTH),
        )
        for issue in report.issues[:MAX_VISIBLE_ISSUES]
    )
    fills = tuple(
        FillView(
            _clean(fill.symbol, 16).upper(),
            _clean(fill.side, 12).upper(),
            _finite_or_none(fill.filled_quantity),
            _finite_or_none(fill.average_fill_price),
            _clean(fill.status, 24),
        )
        for fill in report.fills[:MAX_VISIBLE_FILLS]
    )
    has_warning = any(issue.severity.lower() != "info" for issue in report.issues)
    state: ReconciliationState = "attention" if has_warning else "guarded" if issue_count else "reconciled"
    message = "Review reconciliation issues." if has_warning else "Duplicate-trade guards are active." if issue_count else "Broker read-back matches the supplied journal snapshot."
    return LiveReconciliationView(
        state=state,
        journal_orders=report.journal_count,
        broker_orders=report.broker_order_count,
        open_orders=report.open_order_count,
        fills=report.fill_count,
        positions=report.position_count,
        duplicate_blocks=report.duplicate_block_count,
        issues=issues,
        issue_count=issue_count,
        issues_truncated=issue_count > len(issues),
        recent_fills=fills,
        fills_truncated=report.fill_count > len(fills),
        message=message,
    )


def build_lane_insights_view(
    lane: Literal["paper", "simulation"],
    events: Iterable[Mapping[str, object]] | None,
    *,
    starting_balance: float | None = None,
) -> LaneInsightsView:
    if events is None:
        return _unavailable_lane(lane)
    try:
        records, complete = _bounded_records(events, MAX_JOURNAL_EVENTS)
    except Exception:
        return _unavailable_lane(lane)
    if not complete:
        return LaneInsightsView(
            lane, "input-limit-exceeded", 0, 0, 0, 0, None, None, None, None, None, None,
            0, 0, (), "Journal exceeds the bounded insights limit; summary is withheld.",
        )
    if any(not isinstance(event, Mapping) for event in records):
        return _unavailable_lane(lane)

    lane_records = tuple(
        event for event in records
        if str(event.get("mode", "")).strip().lower() == lane
    )
    # The pure insight helpers intentionally select Paper mode. This bounded
    # adapter supplies the same closed-event schema under that selector for
    # Simulation records, then labels the output with its original local lane.
    normalized = tuple(
        {**event, "mode": "paper"} if lane == "simulation" else event
        for event in lane_records
    )
    summary = summarize_paper_journal(normalized)
    performance = paper_performance(normalized, starting_balance=starting_balance)
    if summary.incomplete_data or performance.status == "incomplete-pnl":
        state: InsightState = "incomplete"
    elif summary.closed_trade_count == 0:
        state = "no-closed-trades"
    else:
        state = "available"
    reasons = tuple(_clean(reason, MAX_TEXT_LENGTH) for reason in summary.incomplete_reasons[:MAX_VISIBLE_REASONS])
    return LaneInsightsView(
        lane=lane,
        state=state,
        closed_trades=summary.closed_trade_count,
        wins=summary.wins,
        losses=summary.losses,
        breakeven=summary.breakeven,
        win_rate=summary.win_rate,
        expectancy=summary.expectancy,
        realized_pnl=performance.realized_pnl,
        return_pct=performance.return_pct,
        max_drawdown_usd=performance.max_drawdown_usd,
        max_drawdown_pct=performance.max_drawdown_pct,
        current_win_streak=summary.current_win_streak,
        current_loss_streak=summary.current_loss_streak,
        incomplete_reasons=reasons,
        message=_lane_message(lane, state, performance.note),
    )


def _bounded_records(
    values: Iterable[Mapping[str, object]], limit: int,
) -> tuple[tuple[Mapping[str, object], ...], bool]:
    rows = tuple(islice(values, limit + 1))
    if len(rows) > limit:
        return (), False
    return rows, True


def _unavailable_reconciliation(message: str) -> LiveReconciliationView:
    return LiveReconciliationView(
        "unavailable", 0, 0, 0, 0, 0, 0, (), 0, False, (), False, _clean(message, MAX_TEXT_LENGTH),
    )


def _unavailable_lane(lane: Literal["paper", "simulation"]) -> LaneInsightsView:
    return LaneInsightsView(
        lane, "unavailable", 0, 0, 0, 0, None, None, None, None, None, None,
        0, 0, (), "Journal snapshot is unavailable; no performance is inferred.",
    )


def _lane_message(lane: str, state: InsightState, note: str) -> str:
    label = "Paper" if lane == "paper" else "Simulation"
    if state == "no-closed-trades":
        return f"No closed {label} outcomes are available. Open or pending records are not treated as results."
    if state == "incomplete":
        return f"{label} outcomes are incomplete; affected aggregate metrics are withheld."
    return _clean(note, MAX_TEXT_LENGTH)


def _clean(value: object, limit: int) -> str:
    return " ".join(str(value or "").split())[:limit]


def _finite_or_none(value: object) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return result if isfinite(result) else None
