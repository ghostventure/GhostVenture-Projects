from __future__ import annotations

import csv
import io
from urllib.request import Request, urlopen

NASDAQ_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt"
OTHER_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/symdir/otherlisted.txt"


def fetch_us_listed_symbols(timeout: int = 10) -> list[str]:
    symbols = set()
    symbols.update(_parse_nasdaq_listed(_fetch_text(NASDAQ_LISTED_URL, timeout)))
    symbols.update(_parse_other_listed(_fetch_text(OTHER_LISTED_URL, timeout)))
    return sorted(symbols)


def _fetch_text(url: str, timeout: int) -> str:
    request = Request(url, headers={"User-Agent": "Timmy/0.1"})
    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def _parse_nasdaq_listed(payload: str) -> list[str]:
    return [
        row["Symbol"].strip().upper()
        for row in _rows(payload)
        if row.get("Symbol")
        and row.get("Test Issue", "N").strip().upper() != "Y"
        and row.get("Financial Status", "N").strip().upper() not in {"D", "H", "E", "Q"}
        and _is_tradeable_symbol(row["Symbol"])
    ]


def _parse_other_listed(payload: str) -> list[str]:
    return [
        row["ACT Symbol"].strip().upper()
        for row in _rows(payload)
        if row.get("ACT Symbol")
        and row.get("Test Issue", "N").strip().upper() != "Y"
        and _is_tradeable_symbol(row["ACT Symbol"])
    ]


def _rows(payload: str) -> list[dict[str, str]]:
    clean_lines = [
        line
        for line in payload.splitlines()
        if line.strip() and not line.startswith("File Creation Time:")
    ]
    return list(csv.DictReader(io.StringIO("\n".join(clean_lines)), delimiter="|"))


def _is_tradeable_symbol(symbol: str) -> bool:
    clean = symbol.strip().upper()
    if not clean or not clean.isalnum():
        return False
    if len(clean) > 5:
        return False
    suffix = clean[-1]
    if len(clean) == 5 and suffix in {"W", "R", "U"}:
        return False
    return True
