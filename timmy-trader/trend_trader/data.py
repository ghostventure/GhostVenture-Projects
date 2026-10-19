from __future__ import annotations

import csv
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from .models import Candle


def load_csv_bars(path: str | Path) -> dict[str, list[Candle]]:
    bars: dict[str, list[Candle]] = defaultdict(list)
    with Path(path).open(newline="") as file:
        for row in csv.DictReader(file):
            symbol = row["symbol"].strip().upper()
            timestamp = datetime.fromisoformat(row["timestamp"])
            bars[symbol].append(
                Candle(
                    symbol=symbol,
                    timestamp=timestamp,
                    open=float(row["open"]),
                    high=float(row["high"]),
                    low=float(row["low"]),
                    close=float(row["close"]),
                    volume=float(row["volume"]),
                )
            )

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
