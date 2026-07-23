from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from pathlib import Path
from urllib.request import Request, urlopen

NASDAQ_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt"
OTHER_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/symdir/otherlisted.txt"
BUNDLED_US_LISTED_SYMBOLS_PATH = Path(__file__).with_name("resources") / "us-listed-symbols.csv"


@dataclass(frozen=True)
class ListedInstrument:
    symbol: str
    asset_type: str
    listing_source: str


def fetch_us_listed_symbols(timeout: int = 10) -> list[str]:
    return [instrument.symbol for instrument in fetch_us_listed_instruments(timeout)]


def load_bundled_us_listed_symbols() -> list[str]:
    return [instrument.symbol for instrument in load_bundled_us_listed_instruments()]


def load_bundled_us_listed_instruments() -> list[ListedInstrument]:
    if not BUNDLED_US_LISTED_SYMBOLS_PATH.exists():
        return []
    with BUNDLED_US_LISTED_SYMBOLS_PATH.open(encoding="utf-8", newline="") as file:
        rows = csv.DictReader(file)
        return [
            ListedInstrument(
                row["symbol"].strip().upper(),
                row["asset_type"].strip().lower(),
                row["listing_source"].strip().lower(),
            )
            for row in rows
            if row.get("symbol") and row.get("asset_type") and row.get("listing_source")
        ]


def fetch_us_listed_instruments(timeout: int = 10) -> list[ListedInstrument]:
    instruments = {}
    for instrument in _parse_nasdaq_listed_instruments(_fetch_text(NASDAQ_LISTED_URL, timeout)):
        instruments[instrument.symbol] = instrument
    for instrument in _parse_other_listed_instruments(_fetch_text(OTHER_LISTED_URL, timeout)):
        previous = instruments.get(instrument.symbol)
        if previous is None:
            instruments[instrument.symbol] = instrument
        elif previous.asset_type != "etf" and instrument.asset_type == "etf":
            instruments[instrument.symbol] = ListedInstrument(instrument.symbol, "etf", previous.listing_source)
    return [instruments[symbol] for symbol in sorted(instruments)]


def _fetch_text(url: str, timeout: int) -> str:
    request = Request(url, headers={"User-Agent": "Timmy/0.1"})
    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def _parse_nasdaq_listed(payload: str) -> list[str]:
    return [instrument.symbol for instrument in _parse_nasdaq_listed_instruments(payload)]


def _parse_nasdaq_listed_instruments(payload: str) -> list[ListedInstrument]:
    return [
        ListedInstrument(
            row["Symbol"].strip().upper(),
            _asset_type(row),
            "nasdaq",
        )
        for row in _rows(payload)
        if row.get("Symbol")
        and row.get("Test Issue", "N").strip().upper() != "Y"
        and row.get("Financial Status", "N").strip().upper() not in {"D", "H", "E", "Q"}
        and _is_tradeable_symbol(row["Symbol"])
    ]


def _parse_other_listed(payload: str) -> list[str]:
    return [instrument.symbol for instrument in _parse_other_listed_instruments(payload)]


def _parse_other_listed_instruments(payload: str) -> list[ListedInstrument]:
    return [
        ListedInstrument(
            row["ACT Symbol"].strip().upper(),
            _asset_type(row),
            "other",
        )
        for row in _rows(payload)
        if row.get("ACT Symbol")
        and row.get("Test Issue", "N").strip().upper() != "Y"
        and _is_tradeable_symbol(row["ACT Symbol"])
    ]


def _asset_type(row: dict[str, str]) -> str:
    return "etf" if row.get("ETF", "").strip().upper() == "Y" else "stock"


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
