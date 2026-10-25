"""Local, read-only research helpers for scan coverage and safe imports/exports."""
from __future__ import annotations

import csv
import json
import math
import os
import tempfile
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Mapping

from .models import Candle

_MAX_COVERAGE_HISTORY = 60
_MAX_IMPORT_BYTES = 20 * 1024 * 1024
_MAX_IMPORT_ROWS = 250_000


class ScanCoverageStore:
    """Private bounded history of symbols requested and returned per scan."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path).expanduser()

    def history(self) -> list[dict]:
        try:
            if self.path.stat().st_size > 2_000_000:
                return []
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError, TypeError):
            return []
        rows = payload.get("history") if isinstance(payload, dict) and payload.get("version") == 1 else []
        return [row for row in rows[-_MAX_COVERAGE_HISTORY:] if isinstance(row, dict)] if isinstance(rows, list) else []

    def record(self, requested: Iterable[str], returned: Iterable[str], *, provider: str,
               source: str, issues: Mapping[str, str] | None = None) -> dict:
        requested_symbols = sorted({str(item).strip().upper() for item in requested if str(item).strip()})
        returned_set = {str(item).strip().upper() for item in returned if str(item).strip()}
        issue_map = {str(k).strip().upper(): str(v).strip()[:180] for k, v in (issues or {}).items()}
        symbols = [{
            "symbol": symbol,
            "covered": symbol in returned_set,
            "issue": "" if symbol in returned_set else issue_map.get(symbol, "No current candle data returned."),
        } for symbol in requested_symbols]
        record = {
            "id": datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ"),
            "at": datetime.now(timezone.utc).isoformat(),
            "provider": str(provider or "unknown")[:40],
            "source": str(source or "unknown")[:24],
            "requested": len(requested_symbols),
            "returned": sum(row["covered"] for row in symbols),
            "coverage_pct": round(100 * sum(row["covered"] for row in symbols) / len(symbols), 1) if symbols else 0.0,
            "symbols": symbols,
        }
        history = [*self.history(), record][-_MAX_COVERAGE_HISTORY:]
        self._write({"version": 1, "history": history})
        return record

    def _write(self, payload: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, temporary = tempfile.mkstemp(prefix=f".{self.path.name}.", dir=self.path.parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as stream:
                os.fchmod(stream.fileno(), 0o600)
                json.dump(payload, stream, indent=2, sort_keys=True)
                stream.write("\n")
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, self.path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)


@dataclass(frozen=True)
class CsvImportPreview:
    headers: tuple[str, ...]
    mapping: Mapping[str, str]
    candles: tuple[Candle, ...]
    errors: tuple[str, ...]
    total_rows: int

    @property
    def ready(self) -> bool:
        return bool(self.candles) and not self.errors


def preview_csv_import(path: str | Path, mapping: Mapping[str, str]) -> CsvImportPreview:
    """Map a user CSV without mutating the configured market-data file."""
    source = Path(path)
    if source.stat().st_size > _MAX_IMPORT_BYTES:
        raise ValueError("CSV import exceeds the 20 MiB limit.")
    required = ("symbol", "timestamp", "open", "high", "low", "close", "volume")
    clean_mapping = {key: str(mapping.get(key, "")) for key in required}
    if any(not clean_mapping[key] for key in required) or len(set(clean_mapping.values())) != len(required):
        raise ValueError("Map each required field to a different CSV column.")
    candles: list[Candle] = []
    errors: list[str] = []
    total = 0
    with source.open(newline="", encoding="utf-8-sig") as stream:
        reader = csv.DictReader(stream)
        headers = tuple(str(item or "").strip() for item in (reader.fieldnames or ()))
        if not headers:
            raise ValueError("CSV file has no header row.")
        if any(column not in headers for column in clean_mapping.values()):
            raise ValueError("Choose existing CSV columns for every mapped field.")
        for line, row in enumerate(reader, start=2):
            total += 1
            if total > _MAX_IMPORT_ROWS:
                errors.append(f"Import exceeds the {_MAX_IMPORT_ROWS:,}-row limit.")
                break
            try:
                symbol = str(row.get(clean_mapping["symbol"]) or "").strip().upper()
                timestamp = _as_utc(datetime.fromisoformat(str(row.get(clean_mapping["timestamp"]) or "").strip()))
                values = {key: float(row.get(clean_mapping[key], "")) for key in ("open", "high", "low", "close", "volume")}
                if not symbol or len(symbol) > 24 or any(char.isspace() for char in symbol):
                    raise ValueError("invalid symbol")
                if any(not math.isfinite(value) for value in values.values()):
                    raise ValueError("non-finite numeric value")
                if min(values[key] for key in ("open", "high", "low", "close")) <= 0 or values["volume"] < 0:
                    raise ValueError("prices must be positive and volume non-negative")
                if values["high"] < max(values["open"], values["low"], values["close"]):
                    raise ValueError("high/low range is inconsistent")
                candles.append(Candle(symbol=symbol, timestamp=timestamp, **values))
            except (TypeError, ValueError, OverflowError) as exc:
                if len(errors) < 100:
                    errors.append(f"Row {line}: {str(exc)[:120]}.")
    return CsvImportPreview(headers, clean_mapping, tuple(candles), tuple(errors), total)


def merge_imported_candles(existing: Mapping[str, Iterable[Candle]], incoming: Iterable[Candle]) -> dict[str, list[Candle]]:
    """Return a merged dataset keyed by symbol/timestamp; caller commits atomically."""
    merged: dict[str, dict[datetime, Candle]] = {}
    for symbol, bars in existing.items():
        clean = str(symbol).strip().upper()
        normalized = [replace(bar, timestamp=_as_utc(bar.timestamp)) for bar in bars]
        merged[clean] = {bar.timestamp: bar for bar in normalized}
    for bar in incoming:
        symbol = bar.symbol.strip().upper()
        normalized = replace(bar, timestamp=_as_utc(bar.timestamp))
        merged.setdefault(symbol, {})[normalized.timestamp] = normalized
    return {symbol: sorted(rows.values(), key=lambda bar: bar.timestamp) for symbol, rows in sorted(merged.items())}


def provider_evidence(history: Iterable[Mapping]) -> list[dict]:
    """Compare only recorded scans; deliberately performs no provider requests."""
    latest: dict[str, dict] = {}
    for row in history:
        provider = str(row.get("provider") or "unknown").upper()
        prior = latest.get(provider)
        if prior is None or str(row.get("at", "")) > str(prior.get("at", "")):
            latest[provider] = dict(row)
    return sorted(latest.values(), key=lambda row: str(row.get("provider", "")))


def compare_symbol_groups(groups: Mapping[str, Iterable[str]], bars_by_symbol: Mapping[str, list[Candle]], window: int = 20) -> list[dict]:
    """Compare named local symbol groups without fetching additional data."""
    result = []
    for name, raw_symbols in groups.items():
        symbols = sorted({str(symbol).strip().upper() for symbol in raw_symbols if str(symbol).strip()})
        returns: list[float] = []
        covered = 0
        for symbol in symbols:
            bars = bars_by_symbol.get(symbol, [])[-max(2, window):]
            if len(bars) < 2 or not bars[0].close:
                continue
            returns.append((bars[-1].close / bars[0].close - 1) * 100)
            covered += 1
        result.append({"name": str(name), "symbols": len(symbols), "covered": covered,
                       "mean_return_pct": sum(returns) / len(returns) if returns else None})
    return result


def redacted_research_snapshot(*, provider: str, as_of: datetime, symbols: Iterable[Mapping], issues: Iterable[Mapping]) -> dict:
    """Whitelist research fields; account, broker, configuration, and credentials are excluded."""
    symbol_fields = ("symbol", "close", "change_pct", "score", "decision", "quality")
    issue_fields = ("symbol", "provider", "category", "detail", "action")
    def pick(rows, fields):
        result = []
        for row in rows:
            if isinstance(row, Mapping):
                result.append({key: row[key] for key in fields if key in row})
        return result
    return {"schema_version": 1, "as_of": as_of.astimezone(timezone.utc).isoformat(),
            "provider": str(provider or "unknown")[:40], "symbols": pick(symbols, symbol_fields),
            "issues": pick(issues, issue_fields)}


def _as_utc(timestamp: datetime) -> datetime:
    """Interpret timezone-naive CSV timestamps as UTC and normalize the rest."""
    if timestamp.tzinfo is None:
        return timestamp.replace(tzinfo=timezone.utc)
    return timestamp.astimezone(timezone.utc)
