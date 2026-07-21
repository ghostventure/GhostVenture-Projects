from __future__ import annotations

from typing import TYPE_CHECKING

from .indicators import atr, closes, highest_high, lowest_low, rsi, sma, volume_ratio
from .models import Candle, Signal

if TYPE_CHECKING:
    from .config import BotConfig

EARLY_CHANGE_THRESHOLD_PCT = 2.5


def _adaptive_bands(close: float, current_atr: float | None, vol_ratio: float | None) -> tuple[float, float, float, float, str]:
    volatility_pct = (current_atr / close) if current_atr and close > 0 else 0.02
    stop_multiplier = 1.0
    target_multiplier = 2.0
    pullback_multiplier = 0.35
    profile = "normal"

    if volatility_pct >= 0.04:
        stop_multiplier = 1.25
        target_multiplier = 2.4
        pullback_multiplier = 0.5
        profile = "wide volatile"
    elif volatility_pct <= 0.015 and vol_ratio is not None and vol_ratio >= 1.4:
        stop_multiplier = 0.85
        target_multiplier = 1.7
        pullback_multiplier = 0.25
        profile = "tight momentum"
    elif vol_ratio is not None and vol_ratio < 1.0:
        target_multiplier = 1.6
        pullback_multiplier = 0.45
        profile = "low-volume cautious"

    return volatility_pct, stop_multiplier, target_multiplier, pullback_multiplier, profile


def _sensible_score(
    score: int,
    direction: str,
    expense_status: str,
    reward_risk: float,
    volatility_pct: float,
    vol_ratio: float | None,
) -> tuple[int, str]:
    sensible = score
    if direction == "bearish":
        sensible -= 22
    elif direction == "bullish":
        sensible += 6
    else:
        sensible -= 8

    if expense_status == "too-expensive":
        sensible -= 30
    if reward_risk >= 2.0:
        sensible += 8
    elif reward_risk < 1.5:
        sensible -= 18
    if vol_ratio is not None and vol_ratio >= 1.4:
        sensible += 5
    if volatility_pct > 0.045:
        sensible -= 18

    sensible = max(0, min(100, sensible))
    if sensible >= 78 and direction == "bullish" and expense_status != "too-expensive":
        return sensible, "trade"
    if sensible >= 50:
        return sensible, "watch"
    return sensible, "avoid"


def _percent_change(current: float, previous: float | None) -> float:
    if previous is None or previous == 0:
        return 0.0
    return (current - previous) / previous * 100


def _scout_score(
    change_pct: float,
    three_bar_change_pct: float,
    gap_pct: float,
    range_expansion: float,
    near_high: bool,
    near_low: bool,
    direction: str,
    vol_ratio: float | None,
    volatility_pct: float,
    current_rsi: float | None,
) -> tuple[int, str, list[str]]:
    score = 0
    reasons: list[str] = []
    abs_change = abs(change_pct)
    abs_three_bar = abs(three_bar_change_pct)
    abs_gap = abs(gap_pct)

    if abs_change >= EARLY_CHANGE_THRESHOLD_PCT:
        score += 26
        reasons.append(f"single-bar movement crossed vigilance threshold at {change_pct:+.2f}%")
    elif abs_change >= 1.2:
        score += 12
        reasons.append(f"single-bar movement is building at {change_pct:+.2f}%")

    if abs_three_bar >= EARLY_CHANGE_THRESHOLD_PCT:
        score += 24
        reasons.append(f"three-bar acceleration is active at {three_bar_change_pct:+.2f}%")
    elif abs_three_bar >= 1.5:
        score += 12
        reasons.append(f"three-bar drift is worth watching at {three_bar_change_pct:+.2f}%")

    if abs_gap >= 1.0:
        score += 10
        reasons.append(f"opening gap/shift detected at {gap_pct:+.2f}%")

    if vol_ratio is not None and vol_ratio >= 1.8:
        score += 18
        reasons.append(f"unusual volume alert at {vol_ratio:.1f}x average")
    elif vol_ratio is not None and vol_ratio >= 1.25:
        score += 10
        reasons.append(f"volume is above baseline at {vol_ratio:.1f}x")
    elif vol_ratio is not None and vol_ratio < 0.75:
        score -= 10
        reasons.append("low-volume move is treated as lower-confidence noise")

    if range_expansion >= 1.7:
        score += 14
        reasons.append(f"latest range expanded to {range_expansion:.1f}x normal")
    elif range_expansion >= 1.2:
        score += 7
        reasons.append(f"latest range is expanding at {range_expansion:.1f}x normal")

    if direction == "bullish" and near_high:
        score += 10
        reasons.append("bullish move is near recent highs")
    elif direction == "bearish" and near_low:
        score += 10
        reasons.append("bearish move is near recent lows")

    if volatility_pct > 0.055:
        score -= 16
        reasons.append("volatility is high enough to reduce scouting confidence")
    if current_rsi is not None and (current_rsi >= 84 or current_rsi <= 18):
        score -= 10
        reasons.append(f"RSI extreme reduces scout quality ({current_rsi:.1f})")

    score = max(0, min(100, score))
    if score >= 72:
        return score, "alert", reasons
    if score >= 42:
        return score, "watch", reasons
    return score, "quiet", reasons


def score_symbol(
    symbol: str,
    bars: list[Candle],
    max_rsi_to_buy: float = 78.0,
    max_price_over_sma20_pct: float = 6.0,
    max_price_over_sma50_pct: float = 12.0,
) -> Signal:
    values = closes(bars)
    last = bars[-1]
    sma_20 = sma(values, 20)
    sma_50 = sma(values, 50)
    current_rsi = rsi(values, 14)
    current_atr = atr(bars, 14)
    vol_ratio = volume_ratio(bars, 20)
    prior_high = highest_high(bars[:-1], 20)
    prior_low = lowest_low(bars[:-1], 20)
    previous_close = values[-2] if len(values) >= 2 else last.open
    change_pct = _percent_change(last.close, previous_close)
    three_bar_change_pct = _percent_change(last.close, values[-4] if len(values) >= 4 else previous_close)
    gap_pct = _percent_change(last.open, previous_close)
    direction = "bullish" if change_pct >= EARLY_CHANGE_THRESHOLD_PCT else "bearish" if change_pct <= -EARLY_CHANGE_THRESHOLD_PCT else "neutral"

    score = 0
    reasons: list[str] = []
    expense_reasons: list[str] = []
    setup = "trend-continuation"

    if direction == "bullish":
        score += 18
        reasons.append(f"early bullish change detected at {change_pct:.2f}%")
    elif direction == "bearish":
        score += 18
        setup = "bearish-move"
        reasons.append(f"early bearish change detected at {change_pct:.2f}%")

    if direction != "bearish" and sma_20 and sma_50 and last.close > sma_20 > sma_50:
        score += 30
        reasons.append("price above rising 20/50 moving-average structure")
    elif direction != "bearish" and sma_20 and last.close > sma_20:
        score += 16
        reasons.append("price above 20-period average")
    elif direction == "bearish" and sma_20 and last.close < sma_20:
        score += 16
        reasons.append("price moved below 20-period average")

    if direction != "bearish" and prior_high and last.close > prior_high:
        score += 20
        reasons.append("close broke above prior 20-bar high")
        setup = "breakout"

    if current_rsi is not None and 52 <= current_rsi <= 72:
        score += 16
        reasons.append(f"RSI confirms momentum without extreme extension ({current_rsi:.1f})")
    elif current_rsi is not None and current_rsi > 72:
        score += 6
        reasons.append(f"momentum is strong but extended ({current_rsi:.1f})")
    if current_rsi is not None and current_rsi > max_rsi_to_buy:
        expense_reasons.append(f"RSI is expensive/overextended at {current_rsi:.1f}")

    if vol_ratio is not None and vol_ratio >= 1.4:
        score += 18
        reasons.append(f"volume is {vol_ratio:.1f}x recent average")
    elif vol_ratio is not None and vol_ratio >= 1.0:
        score += 8
        reasons.append("volume is at or above recent average")

    volatility_pct, stop_multiplier, target_multiplier, pullback_multiplier, adaptive_profile = _adaptive_bands(
        last.close,
        current_atr,
        vol_ratio,
    )
    latest_range = max(last.high - last.low, 0)
    range_expansion = (latest_range / current_atr) if current_atr and current_atr > 0 else 1.0
    near_high = bool(prior_high and last.close >= prior_high * 0.995)
    near_low = bool(prior_low and last.close <= prior_low * 1.005)
    scout_score, scout_action, scout_reasons = _scout_score(
        change_pct,
        three_bar_change_pct,
        gap_pct,
        range_expansion,
        near_high,
        near_low,
        direction,
        vol_ratio,
        volatility_pct,
        current_rsi,
    )
    reasons.extend(f"scout: {reason}" for reason in scout_reasons)

    if current_atr and volatility_pct <= 0.045:
        score += 10
        reasons.append("volatility is tradable relative to price")

    stop_distance = max((current_atr or last.close * 0.02) * stop_multiplier, last.close * 0.01)
    pullback_distance = min(stop_distance * pullback_multiplier, last.close * 0.02)
    entry = round(max(last.close - pullback_distance, 0.01), 2)
    stop = round(max(entry - stop_distance, 0.01), 2)
    target = round(entry + stop_distance * target_multiplier, 2)
    reward_risk = round((target - entry) / max(entry - stop, 0.01), 2)
    if sma_20:
        over_sma20_pct = (last.close - sma_20) / sma_20 * 100
        if over_sma20_pct > max_price_over_sma20_pct:
            expense_reasons.append(f"price is {over_sma20_pct:.2f}% above 20-period average")
    if sma_50:
        over_sma50_pct = (last.close - sma_50) / sma_50 * 100
        if over_sma50_pct > max_price_over_sma50_pct:
            expense_reasons.append(f"price is {over_sma50_pct:.2f}% above 50-period average")
    if reward_risk < 1.5:
        expense_reasons.append(f"reward/risk is thin at {reward_risk:.2f}")
    expense_status = "too-expensive" if len(expense_reasons) >= 2 and direction == "bullish" else "fair"
    sensible_score, sensible_action = _sensible_score(
        min(score, 100),
        direction,
        expense_status,
        reward_risk,
        volatility_pct,
        vol_ratio,
    )
    reasons.append(f"adaptive profile: {adaptive_profile}")
    reasons.append(f"planned buy-limit entry waits for a pullback near {entry:.2f}")
    reasons.append(f"planned sell target aims near {target:.2f} with stop near {stop:.2f}")

    decision = "eligible" if sensible_action == "trade" else "watch"
    if current_atr and stop <= 0:
        decision = "skip"
        reasons.append("invalid stop distance")
    if direction == "bearish":
        reasons.append("bearish scout only: short selling is not enabled in this buy-low/sell-high build")
    if scout_action == "quiet" and sensible_action != "trade":
        decision = "skip"
        reasons.append("quiet scout: no material movement or confirmation yet")

    return Signal(
        symbol=symbol,
        score=min(score, 100),
        decision=decision,
        direction=direction,
        setup=setup,
        reasons=tuple(reasons),
        close=round(last.close, 2),
        change_pct=round(change_pct, 2),
        entry=entry,
        stop=stop,
        target=target,
        volatility_pct=round(volatility_pct * 100, 2),
        volume_ratio=round(vol_ratio, 2) if vol_ratio is not None else None,
        reward_risk=reward_risk,
        expense_status=expense_status,
        expense_reasons=tuple(expense_reasons),
        sensible_score=sensible_score,
        sensible_action=sensible_action,
        scout_score=scout_score,
        scout_action=scout_action,
    )


def rank_signals(bars_by_symbol: dict[str, list[Candle]], config: "BotConfig | None" = None) -> list[Signal]:
    signals = [
        score_symbol(
            symbol,
            bars,
            max_rsi_to_buy=config.max_rsi_to_buy if config else 78.0,
            max_price_over_sma20_pct=config.max_price_over_sma20_pct if config else 6.0,
            max_price_over_sma50_pct=config.max_price_over_sma50_pct if config else 12.0,
        )
        for symbol, bars in bars_by_symbol.items()
        if len(bars) >= 55
    ]
    return sorted(
        signals,
        key=lambda signal: (signal.scout_score, signal.sensible_score, signal.score),
        reverse=True,
    )
