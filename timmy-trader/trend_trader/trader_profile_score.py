"""Conservative, local-only Trader Scorecard derived from closed-lane results.

This is Timmy's transparent educational rubric, not a credit, suitability, or
broker score. It only grades a lane when the history is sufficiently large and
the realized results are complete. Profile answers, account wealth, broker
buying power, and configured limits are context only and never raise the score.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import isfinite


@dataclass(frozen=True)
class TraderScoreComponent:
    name: str
    weight: int
    score: float | None
    detail: str


@dataclass(frozen=True)
class TraderProfileScore:
    score: int | None
    grade: str
    coverage_pct: int
    closed_paper_trades: int
    components: tuple[TraderScoreComponent, ...]
    methodology: str


MIN_GRADED_CLOSED_TRADES = 20


def calculate_trader_profile_score(
    *,
    closed_paper_trades: int,
    paper_return_pct: float | None,
    max_drawdown_pct: float | None,
    starting_balance: float | None,
    risk_per_trade: float | None = None,
    max_daily_loss: float | None = None,
    account_snapshot_available: bool = False,
    experience_years: float | None = None,
    risk_profile_complete: bool = False,
    lane_label: str = "Paper",
    closed_trades_missing_pnl: int = 0,
) -> TraderProfileScore:
    """Grade complete, closed lane results; wait for 20 clean trades to grade.

    Coverage is strictly the availability of realized return and drawdown.
    Both components have equal weight. Return maps -10%..+10% to 0..100;
    drawdown maps 10%..0% to 0..100. These are Timmy rubric choices, not an
    industry standard. No score is returned for incomplete P&L or fewer than
    20 closed records; the UI can still show the component coverage and sample.
    Extra legacy/profile arguments are accepted for caller compatibility and
    deliberately do not affect the result.
    """
    del starting_balance, risk_per_trade, max_daily_loss, account_snapshot_available
    del experience_years, risk_profile_complete
    count = max(0, int(closed_paper_trades))
    missing = max(0, int(closed_trades_missing_pnl))
    ret = _finite(paper_return_pct)
    dd = _finite(max_drawdown_pct)
    complete = missing == 0 and ret is not None and dd is not None
    components = (
        TraderScoreComponent(
            f"{lane_label} realized return", 50,
            _clamp((ret + 10.0) * 5.0) if complete and ret is not None else None,
            f"Complete closed-{lane_label.lower()} return: {ret:+.2f}%." if complete and ret is not None
            else f"Unavailable until every closed {lane_label.lower()} trade has finite P&L.",
        ),
        TraderScoreComponent(
            f"{lane_label} drawdown", 50,
            _clamp(100.0 - max(0.0, dd) * 10.0) if complete and dd is not None else None,
            f"Observed closed-{lane_label.lower()} maximum drawdown: {max(0.0, dd):.2f}%."
            if complete and dd is not None else "Requires a complete realized equity history.",
        ),
    )
    coverage = sum(c.weight for c in components if c.score is not None)
    raw = (sum(c.weight * c.score for c in components if c.score is not None) / coverage
           if coverage else None)
    if not complete or count < MIN_GRADED_CLOSED_TRADES or raw is None:
        score, grade = None, "Building profile"
    else:
        score = round(raw)
        grade = "Poor" if score < 40 else "OK" if score < 60 else "Good" if score < 80 else "Excellent"
    return TraderProfileScore(
        score=score, grade=grade, coverage_pct=coverage, closed_paper_trades=count,
        components=components,
        methodology=("Internal Timmy rubric: 50% realized return and 50% drawdown; "
                     "grade requires at least 20 closed trades with complete P&L. "
                     "Bands: Poor 0-39, OK 40-59, Good 60-79, Excellent 80-100."),
    )


def recommend_trader_scorecard_next_steps(
    *,
    scorecard: TraderProfileScore,
    lane_label: str,
    realized_return_pct: float | None,
    max_drawdown_pct: float | None,
    closed_trades_missing_pnl: int = 0,
) -> tuple[str, ...]:
    """Return optional record-review prompts grounded in the displayed lane.

    These prompts point to data validation and historical review only. They
    never recommend a security, trade, position size, or a decision to go live.
    """
    lane = lane_label.strip().lower() or "selected"
    count = scorecard.closed_paper_trades
    missing = max(0, int(closed_trades_missing_pnl))
    steps: list[str] = []
    if lane == "live" and scorecard.score is None:
        steps.append("Live grade is unavailable. Reconcile confirmed live closes and realized P&L with broker records; Paper results do not stand in for Live history.")
        steps.append("Timmy does not currently maintain a verified Live equity history for this scorecard. Do not interpret missing Live data as a positive or negative result.")
        steps.append("These are optional record-review prompts, not financial or trade instructions. You decide whether to act.")
        return tuple(steps)
    if missing:
        steps.append(f"Review {missing} closed {lane} journal record(s) without finite realized P&L before relying on its summary.")
    if count < MIN_GRADED_CLOSED_TRADES:
        remaining = MIN_GRADED_CLOSED_TRADES - count
        steps.append(f"The grade is provisional until {remaining} more closed {lane} record(s) are available. Let normal activity build the sample; do not trade more just to reach the threshold.")
    if scorecard.score is not None:
        band_review = {
            "Poor": "Poor band: reconcile losing closes and drawdown rows against the journal before relying on this summary.",
            "OK": "OK band: check whether the return and drawdown came from a small cluster of closes or a broader period.",
            "Good": "Good band: confirm the result holds across the dates shown and that modeled costs are represented in the journal.",
            "Excellent": "Excellent band: verify the sample is representative and costs are included; this historical score does not establish future performance or Live readiness.",
        }.get(scorecard.grade)
        if band_review:
            steps.append(band_review)
        components = [component for component in scorecard.components if component.score is not None]
        weakest = min((component.score for component in components), default=None)
        focus = [component for component in components if component.score == weakest]
        if focus:
            names = " and ".join(component.name.lower() for component in focus)
            steps.append(f"For the next review, inspect the closed records behind {names}; this identifies a review focus, not a prescribed trading change.")
        if realized_return_pct is not None and realized_return_pct < 0:
            steps.append("Check the dates and entries behind the negative cumulative return, and confirm the paper ledger reflects the costs your setup is intended to model.")
        if max_drawdown_pct is not None and max_drawdown_pct > 0:
            steps.append("Inspect the peak-to-trough period behind the recorded drawdown and verify the close order and P&L in those rows.")
        if realized_return_pct is not None and max_drawdown_pct == 0:
            steps.append("No drawdown appears in the closed series; verify journal ordering and P&L completeness before treating that as representative.")
    if not steps:
        steps.append(f"Review the {lane} journal for complete realized closes and confirm that its return and drawdown reflect the period you want to assess.")
    steps.append("These are optional history-review prompts, not financial or trade instructions. You decide whether to act.")
    return tuple(steps[:5])


def _finite(value: float | None) -> float | None:
    try:
        number = float(value) if value is not None else None
    except (TypeError, ValueError):
        return None
    return number if number is not None and isfinite(number) else None


def _clamp(value: float) -> float:
    return max(0.0, min(100.0, value))
