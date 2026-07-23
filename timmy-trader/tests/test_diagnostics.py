from __future__ import annotations

from trend_trader.diagnostics import (
    classify_failure,
    inspect_trade_ready,
    summarize_backtest_result,
    why_no_trade,
)
from trend_trader.market_guards import GuardResult
from trend_trader.models import OrderPlan, Signal
from trend_trader.strategy_presets import get_strategy_preset, list_strategy_presets, preset_env_overrides


def make_signal(
    symbol: str = "SPY",
    score: int = 90,
    decision: str = "eligible",
    reward_risk: float = 2.0,
    volatility_pct: float = 2.0,
) -> Signal:
    return Signal(
        symbol=symbol,
        score=score,
        decision=decision,
        direction="bullish",
        setup="test",
        reasons=("test signal",),
        close=100.0,
        change_pct=3.0,
        entry=99.0,
        stop=97.0,
        target=103.0,
        volatility_pct=volatility_pct,
        volume_ratio=1.5,
        reward_risk=reward_risk,
        expense_status="fair",
        expense_reasons=(),
        sensible_score=score,
        sensible_action="trade" if decision == "eligible" else "watch",
        scout_score=score,
        scout_action="alert" if decision == "eligible" else "watch",
    )


def make_plan(symbol: str = "SPY") -> OrderPlan:
    return OrderPlan(
        symbol=symbol,
        side="BUY",
        quantity=1,
        order_type="LIMIT",
        limit_price=99.0,
        stop_price=97.0,
        target_price=103.0,
        notional=99.0,
        reason="test",
    )


def test_failure_classifier_groups_common_trade_misses() -> None:
    assert classify_failure("Buying power unavailable").category == "buying-power"
    assert classify_failure("Webull preview rejected the order").category == "broker-preview"
    assert classify_failure("score below threshold").category == "strategy-block"


def test_trade_ready_report_explains_missing_plan_and_guards() -> None:
    signal = make_signal(score=80, decision="eligible", reward_risk=2.0, volatility_pct=2.0)
    report = inspect_trade_ready(
        signal,
        make_plan(),
        [GuardResult("spread", "block", "spread is too wide")],
        min_score_to_trade=72,
        min_reward_risk=1.6,
        max_signal_volatility_pct=4.5,
    )

    assert not report.trade_ready
    assert report.plan_notional == 99.0
    assert any(issue.category == "spread" for issue in report.issues)


def test_why_no_trade_rolls_reports_up_by_category() -> None:
    ready_signal = make_signal(symbol="SPY", score=90, decision="eligible")
    blocked_signal = make_signal(symbol="QQQ", score=50, decision="watch")
    reports = (
        inspect_trade_ready(ready_signal, make_plan("SPY")),
        inspect_trade_ready(blocked_signal, None, min_score_to_trade=72),
    )

    summary = why_no_trade(reports)

    assert summary["ready"] == 1
    assert summary["blocked"] == 1
    assert summary["top_reason"] in {"strategy-block", "score", "order-plan"}


def test_backtest_summary_hook_condenses_result() -> None:
    result = {
        "summary": {"total": 2, "win_rate": 0.5, "net_pnl": 12.25},
        "trades": [{"symbol": "spy"}, {"symbol": "QQQ"}],
    }

    summary = summarize_backtest_result(result)

    assert summary["readiness"] == "profitable"
    assert summary["symbols"] == ("QQQ", "SPY")


def test_strategy_presets_export_env_overrides() -> None:
    presets = list_strategy_presets()
    preset = get_strategy_preset("fractional_cash_saver")
    overrides = preset_env_overrides("fractional-cash-saver")

    assert len(presets) >= 6
    assert preset.name == "Fractional Cash Saver"
    assert overrides["ENABLE_EQUITY_FRACTIONAL_TRADING"] == "1"
    assert "TRADING_PATTERNS" in overrides
