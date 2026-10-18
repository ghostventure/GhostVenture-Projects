from __future__ import annotations

import csv
import io
import json
import math
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .models import Candle

STOOQ_DAILY_URL = "https://stooq.com/q/d/l/"
_SAFE_SYMBOL = re.compile(r"^[A-Z0-9][A-Z0-9.^=_-]{0,19}$")


def fetch_stooq_daily(symbols: list[str], days: int = 90, timeout: int = 10, max_workers: int = 12) -> dict[str, list[Candle]]:
    _validate_fetch_options(days, timeout=timeout, max_workers=max_workers)
    return _fetch_parallel(symbols, lambda symbol: _fetch_one_stooq_symbol(symbol, timeout=timeout), days, max_workers)


def fetch_yahoo_daily(symbols: list[str], days: int = 90, timeout: int = 10, max_workers: int = 12) -> dict[str, list[Candle]]:
    _validate_fetch_options(days, timeout=timeout, max_workers=max_workers)
    return _fetch_parallel(symbols, lambda symbol: _fetch_one_yahoo_symbol(symbol, days=days, timeout=timeout), days, max_workers)


def fetch_daily_bars(provider: str, symbols: list[str], days: int = 90, timeout: int = 10, max_workers: int = 12) -> dict[str, list[Candle]]:
    if provider == "stooq":
        bars = fetch_stooq_daily(symbols, days=days, timeout=timeout, max_workers=max_workers)
        if bars:
            return bars
        return fetch_yahoo_daily(symbols, days=days, timeout=timeout, max_workers=max_workers)
    if provider == "yahoo":
        return fetch_yahoo_daily(symbols, days=days, timeout=timeout, max_workers=max_workers)
    raise ValueError(f"Unsupported market data provider: {provider}")


def _fetch_parallel(symbols: list[str], fetch_one, days: int, max_workers: int) -> dict[str, list[Candle]]:
    _validate_fetch_options(days, timeout=None, max_workers=max_workers)
    bars: dict[str, list[Candle]] = {}
    clean_symbols = sorted({
        symbol.strip().upper()
        for symbol in symbols
        if isinstance(symbol, str) and symbol.strip() and _SAFE_SYMBOL.fullmatch(symbol.strip().upper())
    })
    if not clean_symbols:
        return bars
    workers = max(1, min(max_workers, len(clean_symbols)))
    with ThreadPoolExecutor(max_workers=workers) as executor:
        future_by_symbol = {executor.submit(fetch_one, symbol): symbol for symbol in clean_symbols}
        for future in as_completed(future_by_symbol):
            symbol = future_by_symbol[future]
            try:
                candles = future.result()
            except Exception:
                continue
            valid_candles = [candle for candle in candles if _valid_candle(candle)]
            if valid_candles:
                bars[symbol] = sorted(valid_candles, key=lambda candle: candle.timestamp)[-days:]
    return bars


def _fetch_one_stooq_symbol(symbol: str, timeout: int = 10) -> list[Candle]:
    _validate_fetch_options(1, timeout=timeout, max_workers=1)
    symbol = _validated_symbol(symbol)
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
    _validate_fetch_options(days, timeout=timeout, max_workers=1)
    symbol = _validated_symbol(symbol)
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
            timestamp = datetime.fromtimestamp(int(epoch), tz=timezone.utc).replace(tzinfo=None)
        except (IndexError, KeyError, TypeError, ValueError, OverflowError):
            continue
        if None in {open_price, high, low, close}:
            continue
        candles.append(
            Candle(
                symbol=symbol.upper(),
                timestamp=timestamp,
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


def _validate_fetch_options(days: int, timeout: int | None, max_workers: int) -> None:
    if not isinstance(days, int) or isinstance(days, bool) or days < 1:
        raise ValueError("days must be a positive integer")
    if timeout is not None and (not isinstance(timeout, (int, float)) or timeout <= 0 or not math.isfinite(timeout)):
        raise ValueError("timeout must be a positive finite number")
    if not isinstance(max_workers, int) or isinstance(max_workers, bool) or max_workers < 1:
        raise ValueError("max_workers must be a positive integer")


def _validated_symbol(symbol: str) -> str:
    if not isinstance(symbol, str):
        raise ValueError("symbol must be text")
    clean = symbol.strip().upper()
    if not _SAFE_SYMBOL.fullmatch(clean):
        raise ValueError("symbol contains unsupported characters")
    return clean


def _valid_candle(candle: Candle) -> bool:
    try:
        values = (candle.open, candle.high, candle.low, candle.close, candle.volume)
        if not all(math.isfinite(float(value)) for value in values):
            return False
        open_price, high, low, close, volume = map(float, values)
        return (
            open_price > 0
            and close > 0
            and high >= max(open_price, close)
            and low <= min(open_price, close)
            and high >= low
            and volume >= 0
            and isinstance(candle.timestamp, datetime)
            and candle.timestamp.utcoffset() is None
        )
    except (AttributeError, TypeError, ValueError, OverflowError):
        return False
