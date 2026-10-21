from __future__ import annotations

import csv
import math
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from .models import Candle


def load_csv_bars(path: str | Path) -> dict[str, list[Candle]]:
    bars: dict[str, list[Candle]] = defaultdict(list)
    source = Path(path)
    with source.open(newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        if reader.fieldnames is None:
            raise ValueError(f"{source}: missing CSV header; expected symbol,timestamp,open,high,low,close,volume")
        field_map: dict[str, str] = {}
        for original in reader.fieldnames:
            normalized = (original or "").strip().lower()
            if not normalized:
                continue
            if normalized in field_map:
                raise ValueError(f"{source}: duplicate CSV header {normalized!r}")
            field_map[normalized] = original
        required = ("symbol", "timestamp", "open", "high", "low", "close", "volume")
        missing_headers = [name for name in required if name not in field_map]
        if missing_headers:
            raise ValueError(f"{source}: missing CSV header(s): {', '.join(missing_headers)}")
        for line_number, row in enumerate(reader, start=2):
            try:
                symbol = row[field_map["symbol"]].strip().upper()
                timestamp = datetime.fromisoformat(row[field_map["timestamp"]].strip())
                open_price = float(row[field_map["open"]])
                high = float(row[field_map["high"]])
                low = float(row[field_map["low"]])
                close = float(row[field_map["close"]])
                volume = float(row[field_map["volume"]])
            except (KeyError, AttributeError, TypeError, ValueError, OverflowError) as exc:
                raise ValueError(f"{source} row {line_number}: missing or invalid required OHLCV field") from exc
            prices = (open_price, high, low, close)
            if not symbol:
                raise ValueError(f"{source} row {line_number}: symbol is empty")
            if not all(math.isfinite(value) and value > 0 for value in prices):
                raise ValueError(f"{source} row {line_number}: OHLC prices must be finite and positive")
            if high < max(open_price, low, close) or low > min(open_price, high, close):
                raise ValueError(f"{source} row {line_number}: OHLC high/low range is inconsistent")
            if not math.isfinite(volume) or volume < 0:
                raise ValueError(f"{source} row {line_number}: volume must be finite and non-negative")
            bars[symbol].append(Candle(
                symbol=symbol,
                timestamp=timestamp,
                open=open_price,
                high=high,
                low=low,
                close=close,
                volume=volume,
            ))

    # Sort each newly-created list in place. Building a second sorted list per
    # symbol temporarily duplicates the entire candle set for large histories.
    for items in bars.values():
        items.sort(key=lambda candle: candle.timestamp)
    return dict(bars)


def write_csv_bars(path: str | Path, bars_by_symbol: dict[str, list[Candle]]) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=["symbol", "timestamp", "open", "high", "low", "close", "volume"])
        writer.writeheader()
        for symbol in sorted(bars_by_symbol):
            items = bars_by_symbol[symbol]
            chronological = all(
                items[index - 1].timestamp <= items[index].timestamp
                for index in range(1, len(items))
            )
            ordered_items = items if chronological else sorted(items, key=lambda item: item.timestamp)
            for bar in ordered_items:
                writer.writerow({
                    "symbol": bar.symbol,
                    "timestamp": bar.timestamp.isoformat(),
                    "open": bar.open,
                    "high": bar.high,
                    "low": bar.low,
                    "close": bar.close,
                    "volume": bar.volume,
                })
