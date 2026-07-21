from __future__ import annotations

from statistics import mean

from .models import Candle


def closes(bars: list[Candle]) -> list[float]:
    return [bar.close for bar in bars]


def sma(values: list[float], period: int) -> float | None:
    if len(values) < period:
        return None
    return mean(values[-period:])


def atr(bars: list[Candle], period: int = 14) -> float | None:
    if len(bars) < period + 1:
        return None
    ranges: list[float] = []
    recent = bars[-(period + 1) :]
    for index in range(1, len(recent)):
        current = recent[index]
        previous = recent[index - 1]
        ranges.append(
            max(
                current.high - current.low,
                abs(current.high - previous.close),
                abs(current.low - previous.close),
            )
        )
    return mean(ranges)


def rsi(values: list[float], period: int = 14) -> float | None:
    if len(values) < period + 1:
        return None
    gains = []
    losses = []
    recent = values[-(period + 1) :]
    for index in range(1, len(recent)):
        delta = recent[index] - recent[index - 1]
        gains.append(max(delta, 0))
        losses.append(abs(min(delta, 0)))
    avg_gain = mean(gains)
    avg_loss = mean(losses)
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def volume_ratio(bars: list[Candle], period: int = 20) -> float | None:
    if len(bars) < period + 1:
        return None
    baseline = mean([bar.volume for bar in bars[-(period + 1) : -1]])
    if baseline <= 0:
        return None
    return bars[-1].volume / baseline


def highest_high(bars: list[Candle], period: int) -> float | None:
    if len(bars) < period:
        return None
    return max(bar.high for bar in bars[-period:])


def lowest_low(bars: list[Candle], period: int) -> float | None:
    if len(bars) < period:
        return None
    return min(bar.low for bar in bars[-period:])
