from __future__ import annotations

from dataclasses import asdict

from .config import BotConfig
from .models import Candle
from .risk import create_order_plan
from .strategy import score_symbol


def run_backtest(
    bars_by_symbol: dict[str, list[Candle]],
    config: BotConfig,
    lookback: int = 60,
    hold_bars: int = 10,
) -> dict:
    trades = []
    for symbol, bars in bars_by_symbol.items():
        if len(bars) < lookback + 1:
            continue
        for index in range(lookback, len(bars) - 1):
            window = bars[index - lookback:index]
            signal = score_symbol(symbol, window)
            plan = create_order_plan(signal, config)
            if not plan:
                continue
            future = bars[index:min(len(bars), index + hold_bars)]
            outcome = _simulate_plan(plan, future)
            trades.append({
                "symbol": symbol,
                "entry_at": window[-1].timestamp.isoformat(),
                "signal": asdict(signal),
                "plan": asdict(plan),
                **outcome,
            })
    wins = [trade for trade in trades if trade["outcome"] == "target-hit"]
    losses = [trade for trade in trades if trade["outcome"] == "stopped"]
    pnl = round(sum(trade["pnl"] for trade in trades), 2)
    return {
        "trades": trades,
        "summary": {
            "total": len(trades),
            "wins": len(wins),
            "losses": len(losses),
            "open_or_timeout": len(trades) - len(wins) - len(losses),
            "win_rate": round(len(wins) / len(trades), 4) if trades else None,
            "net_pnl": pnl,
        },
    }


def _simulate_plan(plan, bars: list[Candle]) -> dict:
    if not bars:
        return {"outcome": "no-forward-bars", "exit_at": None, "exit_price": None, "pnl": 0.0}
    for bar in bars:
        hit_stop = bar.low <= plan.stop_price
        hit_target = bar.high >= plan.target_price
        if not hit_stop and not hit_target:
            continue
        exit_price = plan.stop_price if hit_stop else plan.target_price
        outcome = "stopped" if hit_stop else "target-hit"
        return {
            "outcome": outcome,
            "exit_at": bar.timestamp.isoformat(),
            "exit_price": exit_price,
            "pnl": round((exit_price - (plan.limit_price or 0)) * plan.quantity, 2),
            "outcome_rule": "stop-first" if hit_stop and hit_target else "ohlc-threshold",
        }
    final = bars[-1]
    exit_price = final.close
    return {
        "outcome": "timeout",
        "exit_at": final.timestamp.isoformat(),
        "exit_price": exit_price,
        "pnl": round((exit_price - (plan.limit_price or 0)) * plan.quantity, 2),
        "outcome_rule": "timeout-close",
    }
