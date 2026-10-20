"""Operator-friendly quality summary for supplied local candle data.

The module performs no file, network, broker, or trading operations. Gap counts
are estimates based on a caller-supplied fixed bar interval; exchange sessions,
holidays, and instrument-specific calendars are not inferred.

Example::

    report = summarize_candle_quality(candles, interval_minutes=5)
    print(report.label, report.stale_symbols, report.missing_bars_estimate)
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable

from .models import Candle

_LABEL_RANK = {"CURRENT": 0, "AGING": 1, "STALE": 2, "CHECK DATA": 3, "NO DATA": 4}


@dataclass(frozen=True)
class SymbolDataQuality:
    symbol: str
    label: str
    candle_count: int
    latest_at: datetime | None
    age_minutes: float | None
    missing_bars_estimate: int
    duplicate_timestamps: int
    invalid_ohlc_bars: int
    details: tuple[str, ...]


@dataclass(frozen=True)
class MarketDataQuality:
    label: str
    symbols: tuple[SymbolDataQuality, ...]
    candle_count: int
    stale_symbols: int
    missing_bars_estimate: int
    duplicate_timestamps: int
    invalid_ohlc_bars: int
    details: tuple[str, ...]


def summarize_candle_quality(
    candles: Iterable[Candle],
    *,
    interval_minutes: float,
    now: datetime | None = None,
    stale_after_minutes: float | None = None,
) -> MarketDataQuality:
    """Summarize candle freshness and structure using only supplied data.

    Freshness defaults to three expected intervals. ``AGING`` begins at half
    the stale threshold; ``STALE`` begins at the full threshold. Invalid OHLC
    means a non-finite value or a violation of ``low <= open/close <= high``.
    Duplicate count is the number of extra rows sharing an identical timestamp.
    """
    if not math.isfinite(float(interval_minutes)) or interval_minutes <= 0:
        raise ValueError("interval_minutes must be a positive finite number")
    stale_limit = stale_after_minutes if stale_after_minutes is not None else interval_minutes * 3
    if not math.isfinite(float(stale_limit)) or stale_limit <= 0:
        raise ValueError("stale_after_minutes must be a positive finite number")
    current = _as_utc(now or datetime.now(timezone.utc))
    grouped: dict[str, list[Candle]] = {}
    for candle in candles:
        symbol = str(candle.symbol).strip().upper()
        if symbol:
            grouped.setdefault(symbol, []).append(candle)

    per_symbol = tuple(
        _summarize_symbol(symbol, rows, current, interval_minutes, stale_limit)
        for symbol, rows in sorted(grouped.items())
    )
    if not per_symbol:
        return MarketDataQuality(
            label="NO DATA",
            symbols=(),
            candle_count=0,
            stale_symbols=0,
            missing_bars_estimate=0,
            duplicate_timestamps=0,
            invalid_ohlc_bars=0,
            details=("No candle data was supplied.",),
        )

    worst_label = max((item.label for item in per_symbol), key=_LABEL_RANK.__getitem__)
    stale_symbols = sum(
        item.age_minutes is not None and item.age_minutes >= stale_limit for item in per_symbol
    )
    details: list[str] = []
    if stale_symbols:
        details.append(f"{stale_symbols} symbol(s) have stale candles.")
    missing = sum(item.missing_bars_estimate for item in per_symbol)
    duplicates = sum(item.duplicate_timestamps for item in per_symbol)
    invalid = sum(item.invalid_ohlc_bars for item in per_symbol)
    if missing:
        details.append(f"Estimated missing bars: {missing}.")
    if duplicates:
        details.append(f"Duplicate timestamps: {duplicates} extra row(s).")
    if invalid:
        details.append(f"Invalid OHLC ranges: {invalid} bar(s).")
    if not details:
        details.append("No structural issues or stale candles were detected.")
    return MarketDataQuality(
        label=worst_label,
        symbols=per_symbol,
        candle_count=sum(item.candle_count for item in per_symbol),
        stale_symbols=stale_symbols,
        missing_bars_estimate=missing,
        duplicate_timestamps=duplicates,
        invalid_ohlc_bars=invalid,
        details=tuple(details),
    )


def _summarize_symbol(
    symbol: str,
    candles: list[Candle],
    now: datetime,
    interval_minutes: float,
    stale_after_minutes: float,
) -> SymbolDataQuality:
    timestamps = [_as_utc(candle.timestamp) for candle in candles]
    counts: dict[datetime, int] = {}
    for timestamp in timestamps:
        counts[timestamp] = counts.get(timestamp, 0) + 1
    unique_times = sorted(counts)
    duplicates = sum(count - 1 for count in counts.values())
    missing = 0
    interval_seconds = interval_minutes * 60
    for previous, current in zip(unique_times, unique_times[1:]):
        gap_intervals = (current - previous).total_seconds() / interval_seconds
        # Avoid counting tiny timestamp jitter as missing data. Round to the
        # nearest expected cadence and count only gaps beyond one full bar.
        rounded_intervals = round(gap_intervals)
        if rounded_intervals >= 2 and abs(gap_intervals - rounded_intervals) <= 0.25:
            missing += rounded_intervals - 1

    invalid = sum(not _valid_ohlc(candle) for candle in candles)
    latest = unique_times[-1] if unique_times else None
    age = max(0.0, (now - latest).total_seconds() / 60) if latest else None
    details: list[str] = []
    if invalid:
        details.append(f"{invalid} bar(s) have invalid OHLC ranges.")
    if duplicates:
        details.append(f"{duplicates} duplicate timestamp row(s).")
    if missing:
        details.append(f"About {missing} bar(s) are missing between supplied candles.")
    if age is None:
        label = "NO DATA"
        details.append("No candles available.")
    elif invalid or duplicates or missing:
        label = "CHECK DATA"
    elif age >= stale_after_minutes:
        label = "STALE"
        details.append(f"Latest candle is {age:.0f} minutes old.")
    elif age >= stale_after_minutes / 2:
        label = "AGING"
        details.append(f"Latest candle is {age:.0f} minutes old.")
    else:
        label = "CURRENT"
    return SymbolDataQuality(
        symbol=symbol,
        label=label,
        candle_count=len(candles),
        latest_at=latest,
        age_minutes=age,
        missing_bars_estimate=missing,
        duplicate_timestamps=duplicates,
        invalid_ohlc_bars=invalid,
        details=tuple(details),
    )


def _valid_ohlc(candle: Candle) -> bool:
    try:
        values = (float(candle.open), float(candle.high), float(candle.low), float(candle.close))
    except (TypeError, ValueError):
        return False
    if not all(math.isfinite(value) for value in values):
        return False
    open_price, high, low, close = values
    return low <= open_price <= high and low <= close <= high and low <= high


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
