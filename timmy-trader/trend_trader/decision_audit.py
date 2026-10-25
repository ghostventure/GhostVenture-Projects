"""Read-only, explainable decision audit for signals and order eligibility."""
from __future__ import annotations

from dataclasses import asdict, dataclass

from .asset_classes import asset_profile
from .config import BotConfig
from .models import OrderPlan, Signal
from .risk import create_order_plan


@dataclass(frozen=True)
class DecisionGate:
    name: str
    status: str  # pass, block, or info
    detail: str


@dataclass(frozen=True)
class DecisionAudit:
    symbol: str
    outcome: str  # order-plan-ready, blocked, or watch
    recommendation: str
    gates: tuple[DecisionGate, ...]
    plan: dict | None
    summary: str

    def to_dict(self) -> dict:
        return asdict(self)


def audit_signal_decision(signal: Signal, config: BotConfig) -> DecisionAudit:
    """Explain the current signal-to-plan decision without submitting an order.

    The final plan is produced by the same risk function used by the app. The
    gate details expose why eligibility was denied, while leaving that function
    as the source of truth for whether an order plan can be created.
    """
    gates: list[DecisionGate] = []
    gates.append(DecisionGate(
        "strategy", "pass" if signal.decision == "eligible" else "block",
        f"Strategy decision is {signal.decision} (score {signal.score}/100; sensible action {signal.sensible_action}).",
    ))
    checks = (
        ("minimum-score", signal.score >= config.min_score_to_trade,
         f"Score {signal.score} vs required minimum {config.min_score_to_trade}."),
        ("expense", signal.expense_status != "too-expensive",
         f"Expense status is {signal.expense_status}; too-expensive setups are blocked."),
        ("reward-risk", signal.reward_risk >= config.min_reward_risk_to_trade,
         f"Reward/risk {signal.reward_risk:.2f} vs required minimum {config.min_reward_risk_to_trade:.2f}."),
        ("volatility", signal.volatility_pct <= config.max_signal_volatility_pct,
         f"Volatility {signal.volatility_pct:.2%} vs maximum {config.max_signal_volatility_pct:.2%}."),
        ("symbol-whitelist", not config.symbol_whitelist or signal.symbol.upper() in config.symbol_whitelist,
         "No symbol whitelist is configured." if not config.symbol_whitelist else
         (f"{signal.symbol.upper()} is allowed." if signal.symbol.upper() in config.symbol_whitelist else
          f"{signal.symbol.upper()} is not in the configured whitelist.")),
    )
    gates.extend(DecisionGate(name, "pass" if passed else "block", detail) for name, passed, detail in checks)

    profile = asset_profile(signal.symbol, config)
    gates.append(DecisionGate(
        "instrument", "pass" if profile.enabled else "block",
        f"{profile.instrument_type} is {'enabled' if profile.enabled else 'disabled'} for this symbol.",
    ))
    risk_per_unit = signal.entry - signal.stop
    valid_levels = signal.entry > 0 and risk_per_unit > 0 and signal.target > signal.entry
    gates.append(DecisionGate(
        "price-levels", "pass" if valid_levels else "block",
        "Entry, stop, and target define positive per-unit risk and reward." if valid_levels else
        "Entry, stop, and target do not define a valid long trade with positive risk and reward.",
    ))

    plan: OrderPlan | None = create_order_plan(signal, config)
    blockers = [gate for gate in gates if gate.status == "block"]
    if plan is not None:
        outcome = "order-plan-ready"
        recommendation = "Review the preview and normal execution controls; this audit does not submit the plan."
        summary = "All reported gates pass and the standard risk planner produced an order plan."
    elif signal.decision != "eligible":
        outcome = "watch"
        recommendation = "Wait for a new signal update; strategy eligibility is not currently met."
        summary = "The strategy has not marked this setup eligible."
    else:
        outcome = "blocked"
        recommendation = "Resolve the blocking gates, then refresh the signal and audit again."
        summary = "The standard risk planner did not produce an order plan."
        # Keep the audit honest if plan creation has another guard not represented above.
        if not blockers:
            gates.append(DecisionGate(
                "plan-sizing", "block",
                "The standard planner declined sizing, likely due to a quantity, fractional-notional, or risk constraint.",
            ))
    return DecisionAudit(
        symbol=signal.symbol.upper(), outcome=outcome, recommendation=recommendation,
        gates=tuple(gates), plan=asdict(plan) if plan else None, summary=summary,
    )
