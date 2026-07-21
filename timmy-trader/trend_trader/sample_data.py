from __future__ import annotations

import csv
from datetime import datetime, timedelta
from pathlib import Path


def write_sample_bars(path: str | Path) -> None:
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    symbols = {
        "SPY": (500.0, 0.42, 1_900_000),
        "QQQ": (420.0, 0.55, 1_650_000),
        "IWM": (225.0, -0.03, 850_000),
        "AAPL": (210.0, 0.24, 1_200_000),
        "NVDA": (135.0, 0.78, 2_500_000),
    }
    start = datetime(2026, 7, 20, 9, 30)

    with output.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["symbol", "timestamp", "open", "high", "low", "close", "volume"])
        for symbol, (base, drift, volume_base) in symbols.items():
            price = base
            for index in range(70):
                price = max(1, price + drift + (0.08 if index % 5 == 0 else -0.02))
                high = price + max(0.35, abs(drift) * 1.4)
                low = price - max(0.35, abs(drift) * 1.2)
                volume = volume_base + (index * 4200)
                if index == 69 and symbol in {"SPY", "QQQ", "NVDA"}:
                    volume = int(volume * 1.9)
                    high += price * 0.032
                    price = high - 0.1
                elif index == 69 and symbol == "IWM":
                    volume = int(volume * 2.1)
                    price = price * 0.965
                    low = min(low, price - 0.5)
                writer.writerow([
                    symbol,
                    (start + timedelta(minutes=index)).isoformat(),
                    round(price - 0.18, 2),
                    round(high, 2),
                    round(low, 2),
                    round(price, 2),
                    volume,
                ])
