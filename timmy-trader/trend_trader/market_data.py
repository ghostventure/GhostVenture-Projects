from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .models import Candle

STOOQ_DAILY_URL = "https://stooq.com/q/d/l/"


def fetch_stooq_daily(symbols: list[str], days: int = 90, timeout: int = 10) -> dict[str, list[Candle]]:
    bars: dict[str, list[Candle]] = {}
    for symbol in symbols:
        candles = _fetch_one_stooq_symbol(symbol, timeout=timeout)
        if candles:
            bars[symbol.upper()] = candles[-days:]
    return bars


def fetch_yahoo_daily(symbols: list[str], days: int = 90, timeout: int = 10) -> dict[str, list[Candle]]:
    bars: dict[str, list[Candle]] = {}
    for symbol in symbols:
        candles = _fetch_one_yahoo_symbol(symbol, days=days, timeout=timeout)
        if candles:
            bars[symbol.upper()] = candles[-days:]
    return bars


def fetch_daily_bars(provider: str, symbols: list[str], days: int = 90, timeout: int = 10) -> dict[str, list[Candle]]:
    if provider == "stooq":
        bars = fetch_stooq_daily(symbols, days=days, timeout=timeout)
        if bars:
            return bars
        return fetch_yahoo_daily(symbols, days=days, timeout=timeout)
    if provider == "yahoo":
        return fetch_yahoo_daily(symbols, days=days, timeout=timeout)
    raise ValueError(f"Unsupported market data provider: {provider}")


def _fetch_one_stooq_symbol(symbol: str, timeout: int = 10) -> list[Candle]:
    stooq_symbol = _stooq_symbol(symbol)
    url = f"{STOOQ_DAILY_URL}?{urlencode({'s': stooq_symbol, 'i': 'd'})}"
    request = Request(url, headers={"User-Agent": "Timmy/0.1"})
    with urlopen(request, timeout=timeout) as response:
        payload = response.read().decode("utf-8", errors="replace")
    if payload.lstrip().startswith("<"):
        return []
    rows = csv.DictReader(io.StringIO(payload))
    candles: list[Candle] = []
    for row in rows:
        if not row or row.get("Close") in {None, "N/D"}:
            continue
        try:
            candles.append(
                Candle(
                    symbol=symbol.upper(),
                    timestamp=datetime.fromisoformat(row["Date"]),
                    open=float(row["Open"]),
                    high=float(row["High"]),
                    low=float(row["Low"]),
                    close=float(row["Close"]),
                    volume=float(row.get("Volume") or 0),
                )
            )
        except (KeyError, ValueError):
            continue
    return sorted(candles, key=lambda candle: candle.timestamp)


def _fetch_one_yahoo_symbol(symbol: str, days: int = 90, timeout: int = 10) -> list[Candle]:
    range_value = "6mo" if days > 90 else "3mo"
    yahoo_symbol = _yahoo_symbol(symbol)
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}?{urlencode({'range': range_value, 'interval': '1d'})}"
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 Timmy/0.1"})
    with urlopen(request, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8", errors="replace"))
    result = (payload.get("chart", {}).get("result") or [None])[0]
    if not result:
        return []
    timestamps = result.get("timestamp") or []
    quote = ((result.get("indicators") or {}).get("quote") or [{}])[0]
    candles: list[Candle] = []
    for index, epoch in enumerate(timestamps):
        try:
            open_price = quote["open"][index]
            high = quote["high"][index]
            low = quote["low"][index]
            close = quote["close"][index]
            volume = quote.get("volume", [0])[index] or 0
        except (IndexError, KeyError, TypeError):
            continue
        if None in {open_price, high, low, close}:
            continue
        candles.append(
            Candle(
                symbol=symbol.upper(),
                timestamp=datetime.fromtimestamp(int(epoch)),
                open=float(open_price),
                high=float(high),
                low=float(low),
                close=float(close),
                volume=float(volume),
            )
        )
    return sorted(candles, key=lambda candle: candle.timestamp)


def _stooq_symbol(symbol: str) -> str:
    clean = symbol.strip().lower()
    if "." in clean:
        return clean
    return f"{clean}.us"


def _yahoo_symbol(symbol: str) -> str:
    clean = symbol.strip().upper()
    aliases = {
        "BTCUSD": "BTC-USD",
        "ETHUSD": "ETH-USD",
        "SOLUSD": "SOL-USD",
        "XRPUSD": "XRP-USD",
        "LTCUSD": "LTC-USD",
        "DOGEUSD": "DOGE-USD",
        "ADAUSD": "ADA-USD",
        "AVAXUSD": "AVAX-USD",
        "LINKUSD": "LINK-USD",
        "DOTUSD": "DOT-USD",
    }
    return aliases.get(clean, clean)
