from __future__ import annotations

import csv
import io
import json
import math
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from typing import Callable

from .models import Candle

STOOQ_DAILY_URL = "https://stooq.com/q/d/l/"


def fetch_stooq_daily(
    symbols: list[str], days: int = 90, timeout: int = 10, max_workers: int = 6,
    progress_callback: Callable[[dict], None] | None = None,
    diagnostic_callback: Callable[[dict], None] | None = None,
) -> dict[str, list[Candle]]:
    return _fetch_parallel(
        symbols, lambda symbol: _fetch_one_stooq_symbol(symbol, days=days, timeout=timeout),
        days, max_workers, provider="stooq", progress_callback=progress_callback,
        diagnostic_callback=diagnostic_callback,
    )


def fetch_yahoo_daily(
    symbols: list[str], days: int = 90, timeout: int = 10, max_workers: int = 6,
    progress_callback: Callable[[dict], None] | None = None,
    diagnostic_callback: Callable[[dict], None] | None = None,
) -> dict[str, list[Candle]]:
    return _fetch_parallel(
        symbols, lambda symbol: _fetch_one_yahoo_symbol(symbol, days=days, timeout=timeout),
        days, max_workers, provider="yahoo", progress_callback=progress_callback,
        diagnostic_callback=diagnostic_callback,
    )


def fetch_daily_bars(
    provider: str, symbols: list[str], days: int = 90, timeout: int = 10, max_workers: int = 6,
    progress_callback: Callable[[dict], None] | None = None,
    diagnostic_callback: Callable[[dict], None] | None = None,
) -> dict[str, list[Candle]]:
    if provider == "stooq":
        bars = fetch_stooq_daily(
            symbols, days=days, timeout=timeout, max_workers=max_workers,
            progress_callback=progress_callback,
            diagnostic_callback=diagnostic_callback,
        )
        missing_symbols = [symbol.upper() for symbol in symbols if symbol.strip() and symbol.upper() not in bars]
        if missing_symbols:
            yahoo_bars = fetch_yahoo_daily(
                missing_symbols, days=days, timeout=timeout, max_workers=max_workers,
                progress_callback=progress_callback,
                diagnostic_callback=diagnostic_callback,
            )
            bars.update(yahoo_bars)
        return bars
    if provider == "yahoo":
        return fetch_yahoo_daily(
            symbols, days=days, timeout=timeout, max_workers=max_workers,
            progress_callback=progress_callback,
            diagnostic_callback=diagnostic_callback,
        )
    raise ValueError(f"Unsupported market data provider: {provider}")


def _fetch_parallel(
    symbols: list[str], fetch_one, days: int, max_workers: int, *, provider: str,
    progress_callback: Callable[[dict], None] | None = None,
    diagnostic_callback: Callable[[dict], None] | None = None,
) -> dict[str, list[Candle]]:
    bars: dict[str, list[Candle]] = {}
    clean_symbols = sorted(dict.fromkeys(symbol.upper() for symbol in symbols if symbol.strip()))
    if not clean_symbols:
        return bars
    workers = max(1, min(int(max_workers), 6, len(clean_symbols)))
    completed_count = 0
    failed_count = 0

    def report(phase: str, symbol: str | None = None) -> None:
        if progress_callback is None:
            return
        snapshot = {
            "phase": phase,
            "provider": provider,
            "requested": len(clean_symbols),
            "completed": completed_count,
            "returned": len(bars),
            "failed": failed_count,
        }
        if symbol:
            snapshot["symbol"] = symbol
        try:
            progress_callback(snapshot)
        except Exception:
            # Progress reporting must never interrupt market-data retrieval.
            pass

    report("started")
    symbols_to_fetch = iter(clean_symbols)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        # Bound queued work as well as worker threads. Watchlists can be large,
        # and eagerly creating one Future per symbol needlessly retains memory.
        pending = {}
        for _ in range(min(len(clean_symbols), workers * 2)):
            symbol = next(symbols_to_fetch)
            pending[executor.submit(_fetch_one_with_retry, fetch_one, symbol)] = symbol

        while pending:
            completed, _ = wait(pending, return_when=FIRST_COMPLETED)
            for future in completed:
                symbol = pending.pop(future)
                request_raised = False
                try:
                    candles = future.result()
                except Exception as error:
                    candles = []
                    failed_count += 1
                    request_raised = True
                    if diagnostic_callback:
                        if isinstance(error, HTTPError):
                            category, detail = "provider_http", f"Provider returned HTTP {error.code}; retry or confirm symbol availability."
                            status_code = error.code
                        elif isinstance(error, (URLError, TimeoutError, ConnectionError, OSError)):
                            category, detail, status_code = "network", "Provider request timed out or could not connect; check network and retry.", None
                        else:
                            category, detail, status_code = "provider_error", f"Provider request failed ({type(error).__name__}); retry or confirm symbol format.", None
                        try:
                            diagnostic_callback({"symbol": symbol, "provider": provider, "category": category,
                                                 "status_code": status_code, "detail": detail})
                        except Exception:
                            pass
                if candles:
                    valid_candles = [
                        candle for candle in candles
                        if _valid_provider_candle(candle, symbol)
                    ]
                    if valid_candles:
                        ordered = sorted(valid_candles, key=lambda candle: candle.timestamp.timestamp())
                        bars[symbol] = ordered[-max(1, int(days)):]
                    else:
                        failed_count += 1
                        if diagnostic_callback:
                            try:
                                diagnostic_callback({"symbol": symbol, "provider": provider, "category": "invalid_data",
                                                     "status_code": None, "detail": "Provider rows failed OHLCV or symbol validation."})
                            except Exception:
                                pass
                elif not request_raised:
                    # Empty provider responses are unavailable symbols too;
                    # reporting zero failures would make a thin scan look complete.
                    failed_count += 1
                    if diagnostic_callback:
                        try:
                            diagnostic_callback({"symbol": symbol, "provider": provider, "category": "no_data",
                                                 "status_code": None, "detail": "Provider returned no bars for this symbol."})
                        except Exception:
                            pass
                completed_count += 1
                report("progress", symbol)
                next_symbol = next(symbols_to_fetch, None)
                if next_symbol is not None:
                    pending[executor.submit(_fetch_one_with_retry, fetch_one, next_symbol)] = next_symbol
    report("completed")
    return bars


def _valid_provider_candle(candle: Candle, expected_symbol: str) -> bool:
    """Reject malformed provider rows before they enter scans or local caches."""
    try:
        if not isinstance(candle, Candle) or candle.symbol.strip().upper() != expected_symbol:
            return False
        if not isinstance(candle.timestamp, datetime):
            return False
        candle.timestamp.timestamp()
        open_price, high, low, close = (
            float(candle.open), float(candle.high), float(candle.low), float(candle.close)
        )
        volume = float(candle.volume)
        if not all(math.isfinite(value) and value > 0 for value in (open_price, high, low, close)):
            return False
        if high < max(open_price, low, close):
            return False
        if low > min(open_price, high, close):
            return False
        return math.isfinite(volume) and volume >= 0
    except (AttributeError, OSError, TypeError, ValueError, OverflowError):
        return False


def _fetch_one_with_retry(fetch_one, symbol: str) -> list[Candle]:
    """Retry transient provider failures at most twice with bounded delay."""
    transient_http_codes = {408, 425, 429, 500, 502, 503, 504}
    for attempt in range(3):
        try:
            return fetch_one(symbol)
        except HTTPError as exc:
            if exc.code not in transient_http_codes or attempt >= 2:
                raise
            retry_after = exc.headers.get("Retry-After") if exc.headers else None
            delay = _retry_delay(retry_after, attempt)
        except (URLError, TimeoutError, ConnectionError, OSError):
            if attempt >= 2:
                raise
            delay = min(2.0, 0.4 * (2 ** attempt))
        time.sleep(delay)
    return []


def _retry_delay(retry_after: str | None, attempt: int) -> float:
    if retry_after:
        try:
            return min(5.0, max(0.1, float(retry_after)))
        except ValueError:
            try:
                seconds = (parsedate_to_datetime(retry_after) - datetime.now().astimezone()).total_seconds()
                return min(5.0, max(0.1, seconds))
            except (TypeError, ValueError, OverflowError):
                pass
    return min(2.0, 0.4 * (2 ** attempt))


def _fetch_one_stooq_symbol(symbol: str, days: int = 90, timeout: int = 10) -> list[Candle]:
    stooq_symbol = _stooq_symbol(symbol)
    # Stooq otherwise returns the symbol's entire available history. Request a
    # bounded window with room for weekends, holidays, and missing sessions.
    end_date = datetime.now().date()
    calendar_days = max(30, max(1, days) * 2 + 14)
    start_date = end_date - timedelta(days=calendar_days)
    query = {
        's': stooq_symbol,
        'i': 'd',
        'd1': start_date.strftime('%Y%m%d'),
        'd2': end_date.strftime('%Y%m%d'),
    }
    url = f"{STOOQ_DAILY_URL}?{urlencode(query)}"
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
