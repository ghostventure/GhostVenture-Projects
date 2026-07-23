from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping

from .market_guards import GuardResult
from .models import OrderPlan, Signal


@dataclass(frozen=True)
class FailureIssue:
    category: str
    severity: str
    message: str
    source: str = "timmy"


@dataclass(frozen=True)
class TradeReadinessReport:
    symbol: str
    status: str
    issues: tuple[FailureIssue, ...]
    reasons: tuple[str, ...]
    plan_notional: float | None = None

    @property
    def trade_ready(self) -> bool:
        return self.status == "ready"


def classify_failure(message: str, source: str = "timmy") -> FailureIssue:
    text = message.lower()
    category = "unknown"
    severity = "warn"
    patterns = (
        ("data-stale", ("stale", "old quote", "market data", "quote freshness")),
        ("market-closed", ("market closed", "outside market", "session closed")),
        ("broker-auth", ("credential", "token", "unauthorized", "auth", "login")),
        ("buying-power", ("buying power", "insufficient cash", "cash unavailable")),
        ("risk-limit", ("daily loss", "drawdown", "max positions", "daily cap", "cooldown")),
        ("strategy-block", ("score below", "reward/risk", "too-expensive", "quiet scout", "bearish")),
        ("broker-preview", ("preview rejected", "preview failed")),
        ("broker-submit", ("submit rejected", "order rejected", "placement failed")),
        ("network", ("timeout", "connection", "network", "broker unavailable")),
    )
    for candidate, terms in patterns:
        if any(term in text for term in terms):
            category = candidate
            break
    if category in {"broker-auth", "broker-submit", "risk-limit", "buying-power"}:
        severity = "block"
    elif category in {"network", "broker-preview", "data-stale", "market-closed"}:
        severity = "caution"
    return FailureIssue(category, severity, message, source)


def inspect_trade_ready(
    signal: Signal,
    plan: OrderPlan | None = None,
    guard_results: Iterable[GuardResult] = (),
    min_score_to_trade: int | None = None,
    min_reward_risk: float | None = None,
    max_signal_volatility_pct: float | None = None,
) -> TradeReadinessReport:
    issues: list[FailureIssue] = []
    reasons = list(signal.reasons)
    if signal.decision != "eligible":
        issues.append(FailureIssue("strategy-block", "block", f"signal decision is {signal.decision}"))
    if min_score_to_trade is not None and signal.score < min_score_to_trade:
        issues.append(FailureIssue("score", "block", f"score {signal.score} is below {min_score_to_trade}"))
    if signal.expense_status == "too-expensive":
        issues.append(FailureIssue("expense", "block", "signal is marked too-expensive"))
        reasons.extend(signal.expense_reasons)
    if min_reward_risk is not None and signal.reward_risk < min_reward_risk:
        issues.append(FailureIssue("reward-risk", "block", f"reward/risk {signal.reward_risk:.2f} is below {min_reward_risk:.2f}"))
    if max_signal_volatility_pct is not None and signal.volatility_pct > max_signal_volatility_pct:
        issues.append(FailureIssue("volatility", "block", f"signal volatility {signal.volatility_pct:.2f}% is above {max_signal_volatility_pct:.2f}%"))
    if plan is None:
        issues.append(FailureIssue("order-plan", "block", "no executable order plan was created"))
    for guard in guard_results:
        if guard.status in {"block", "unknown"}:
            issues.append(FailureIssue(guard.name, "block" if guard.status == "block" else "warn", guard.reason, "guard"))
        elif guard.status == "caution":
            issues.append(FailureIssue(guard.name, "warn", guard.reason, "guard"))
    blocking = [issue for issue in issues if issue.severity == "block"]
    status = "ready" if not blocking and plan is not None and signal.decision == "eligible" else "blocked"
    return TradeReadinessReport(
        symbol=signal.symbol.upper(),
        status=status,
        issues=tuple(issues),
        reasons=tuple(reasons),
        plan_notional=plan.notional if plan else None,
    )


def why_no_trade(reports: Iterable[TradeReadinessReport]) -> dict[str, object]:
    reports_tuple = tuple(reports)
    category_counts: dict[str, int] = {}
    blocked_symbols: list[str] = []
    ready_symbols: list[str] = []
    for report in reports_tuple:
        if report.trade_ready:
            ready_symbols.append(report.symbol)
            continue
        blocked_symbols.append(report.symbol)
        for issue in report.issues:
            category_counts[issue.category] = category_counts.get(issue.category, 0) + 1
    top_reason = max(category_counts.items(), key=lambda item: item[1], default=(None, 0))[0]
    return {
        "total": len(reports_tuple),
        "ready": len(ready_symbols),
        "blocked": len(blocked_symbols),
        "ready_symbols": tuple(ready_symbols),
        "blocked_symbols": tuple(blocked_symbols),
        "category_counts": category_counts,
        "top_reason": top_reason,
    }


def summarize_backtest_result(result: Mapping[str, object]) -> dict[str, object]:
    summary = result.get("summary", {})
    trades = result.get("trades", ())
    if not isinstance(summary, Mapping):
        summary = {}
    total = int(summary.get("total") or 0)
    net_pnl = float(summary.get("net_pnl") or 0.0)
    win_rate = summary.get("win_rate")
    readiness = "no-trades" if total == 0 else "profitable" if net_pnl > 0 else "needs-review"
    return {
        "total": total,
        "win_rate": win_rate,
        "net_pnl": net_pnl,
        "readiness": readiness,
        "symbols": tuple(sorted({str(trade.get("symbol", "")).upper() for trade in trades if isinstance(trade, Mapping) and trade.get("symbol")})),
    }
