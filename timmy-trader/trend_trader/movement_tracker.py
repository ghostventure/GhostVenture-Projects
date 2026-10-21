from __future__ import annotations

import json
import math
from datetime import datetime, timedelta
from pathlib import Path

from .models import Candle, Signal

WINDOW_HOURS = 96
TRACKER_VERSION = 2

# Market benchmarks, fixed-income proxies, major crypto pairs, and actively
# traded futures extend the official US stock/ETF directory when Yahoo data is
# selected. Arbitrary provider symbols can be added in the runtime extra list.
CROSS_ASSET_SYMBOLS = (
    "^GSPC", "^DJI", "^IXIC", "^RUT", "^VIX", "^TNX", "^FVX", "^IRX", "^TYX",
    "AGG", "BND", "EMB", "GOVT", "HYG", "IEF", "JNK", "LQD", "MUB", "SHY", "TIP", "TLT",
    "BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD", "LTCUSD",
    "ES=F", "NQ=F", "YM=F", "RTY=F", "GC=F", "SI=F", "CL=F", "NG=F", "ZC=F", "ZS=F",
)


class MovementTrackerError(ValueError):
    """Stored movement history is unreadable and must be repaired before rewrite."""


def refresh_movement_tracker(
    path: str | Path,
    bars_by_symbol: dict[str, list[Candle]],
    signals: list[Signal] | None = None,
    now: datetime | None = None,
    window_hours: int = WINDOW_HOURS,
    scan_metadata: dict | None = None,
) -> dict:
    """Merge movement and setup data, plus optional provider-scan audit data."""
    target = Path(path)
    current_time = _naive(now or datetime.now())
    cutoff = current_time - timedelta(hours=max(1, int(window_hours)))
    payload = _read_payload(target)
    records = payload["symbols"]
    as_of_by_symbol = {}
    for symbol, candles in bars_by_symbol.items():
        stamps = [
            _naive(bar.timestamp)
            for bar in candles
            if isinstance(getattr(bar, "timestamp", None), datetime)
        ]
        if stamps:
            as_of_by_symbol[str(symbol).strip().upper()] = max(stamps)

    for raw_symbol, candles in bars_by_symbol.items():
        symbol = str(raw_symbol).strip().upper()
        if not symbol:
            continue
        previous = records.get(symbol, {})
        if not isinstance(previous, dict):
            previous = {}
        movement_times = _movement_timestamps(candles, cutoff, current_time)
        old_observations = previous.get("movement_observation_times", [])
        if not isinstance(old_observations, list):
            old_observations = []
        observations = {
            stamp.isoformat()
            for raw in old_observations
            if (stamp := _parse_timestamp(raw)) is not None and cutoff <= stamp <= current_time
        }
        legacy_movement = _parse_timestamp(previous.get("last_movement_at"))
        if legacy_movement is not None and cutoff <= legacy_movement <= current_time:
            observations.add(legacy_movement.isoformat())
        observations.update(stamp.isoformat() for stamp in movement_times)
        observation_times = sorted(observations)
        old_movement = _parse_timestamp(previous.get("last_movement_at"))
        newest = max([stamp for stamp in (old_movement, *movement_times) if stamp is not None], default=None)
        latest_bar = max((_naive(bar.timestamp) for bar in candles if isinstance(bar.timestamp, datetime)), default=None)
        record = dict(previous)
        if newest is not None:
            record["last_movement_at"] = newest.isoformat()
        record["movement_observation_times"] = observation_times
        record["movement_frequency_96h"] = len(observation_times)
        if latest_bar is not None:
            record["last_bar_at"] = latest_bar.isoformat()
        record["last_checked_at"] = current_time.isoformat()
        records[symbol] = record

    for signal in signals or []:
        symbol = str(getattr(signal, "symbol", "")).strip().upper()
        if not symbol or symbol not in records:
            continue
        if not isinstance(records.get(symbol), dict):
            continue
        direction = str(getattr(signal, "direction", "")).lower()
        change = _finite_float(getattr(signal, "change_pct", None))
        action = str(getattr(signal, "sensible_action", "watch")).lower()
        if direction != "bullish" or action not in {"trade", "watch"} or change is None or change <= 0:
            records[symbol].pop("upside_setup", None)
            records[symbol].pop("shortlist_reference_price", None)
            records[symbol].pop("shortlist_started_at", None)
            continue
        as_of = as_of_by_symbol.get(symbol)
        price = _finite_float(getattr(signal, "close", None))
        if as_of is None or price is None or price <= 0:
            # A signal without a timestamped candle cannot refresh recommendation
            # freshness or establish an observed price history.
            continue
        score = (
            0.4 * _bounded_score(getattr(signal, "score", 0))
            + 0.35 * _bounded_score(getattr(signal, "sensible_score", 0))
            + 0.25 * _bounded_score(getattr(signal, "scout_score", 0))
        )
        previous_setup = records[symbol].get("upside_setup")
        previous_updated_at = _parse_timestamp(previous_setup.get("updated_at")) if isinstance(previous_setup, dict) else None
        previous_reference = _finite_float(records[symbol].get("shortlist_reference_price"))
        previous_started = _parse_timestamp(records[symbol].get("shortlist_started_at"))
        if previous_updated_at is None or previous_updated_at < cutoff or previous_reference is None or previous_started is None:
            previous_reference = price
            previous_started = as_of
        history = records[symbol].get("upside_setup_history", [])
        if not isinstance(history, list):
            history = []
        history = [
            item for item in history[-31:]
            if isinstance(item, dict) and _parse_timestamp(item.get("updated_at")) is not None
        ]
        history_snapshot = {
            "updated_at": as_of.isoformat(),
            "score": round(score, 1),
            "reference_price": round(price, 6),
            "change_pct": round(change, 2),
        }
        if history and history[-1].get("updated_at") == history_snapshot["updated_at"]:
            history[-1] = history_snapshot
        else:
            history.append(history_snapshot)
        records[symbol]["upside_setup_history"] = history[-32:]
        records[symbol]["shortlist_reference_price"] = round(previous_reference, 6)
        records[symbol]["shortlist_started_at"] = previous_started.isoformat()
        records[symbol]["upside_setup"] = {
            "score": round(score, 1),
            "change_pct": round(change, 2),
            "action": action,
            "setup": str(getattr(signal, "setup", "")),
            "reward_risk": round(_finite_float(getattr(signal, "reward_risk", 0.0)) or 0.0, 2),
            "updated_at": as_of.isoformat(),
            "reference_price": round(previous_reference, 6),
            "observed_price": round(price, 6),
            "observed_change_since_shortlist_pct": round((price - previous_reference) / previous_reference * 100.0, 2),
            "shortlist_started_at": previous_started.isoformat(),
        }

    kept: dict[str, dict] = {}
    for symbol, record in records.items():
        if not isinstance(record, dict):
            continue
        stamp = _parse_timestamp(record.get("last_movement_at"))
        if stamp is not None and cutoff <= stamp <= current_time:
            raw_observations = record.get("movement_observation_times", [])
            if not isinstance(raw_observations, list):
                raw_observations = []
            observations = sorted({
                observed.isoformat()
                for raw in raw_observations
                if (observed := _parse_timestamp(raw)) is not None and cutoff <= observed <= current_time
            })
            if not observations:
                observations = [stamp.isoformat()]
            record["movement_observation_times"] = observations
            record["movement_frequency_96h"] = len(observations)
            kept[str(symbol).upper()] = record

    result = {
        key: payload[key]
        for key in ("last_scan_checked_at", "last_scan", "last_successful_scan_at", "last_successful_scan")
        if key in payload
    }
    if scan_metadata is not None:
        scan = _scan_snapshot(scan_metadata, current_time)
        result["last_scan_checked_at"] = current_time.isoformat()
        result["last_scan"] = scan
        if scan["returned_count"] > 0:
            result["last_successful_scan_at"] = current_time.isoformat()
            result["last_successful_scan"] = scan
    payload = {
        **result,
        "version": TRACKER_VERSION,
        "window_hours": max(1, int(window_hours)),
        "updated_at": current_time.isoformat(),
        "symbols": kept,
    }
    return payload


def recent_mover_symbols(payload: dict) -> list[str]:
    return sorted(str(symbol).upper() for symbol in payload.get("symbols", {}))


def top_upside_setups(
    payload: dict,
    limit: int = 10,
    now: datetime | None = None,
    freshness_hours: int = WINDOW_HOURS,
    pinned_symbols: list[str] | tuple[str, ...] | set[str] = (),
    pinned_only: bool = False,
    minimum_movement_frequency: int = 0,
) -> list[dict]:
    """Return fresh, ranked recommendations; optional filters retain score ranking."""
    current_time = _naive(now or datetime.now())
    cutoff = current_time - timedelta(hours=max(1, int(freshness_hours)))
    pinned = {str(symbol).strip().upper() for symbol in pinned_symbols}
    minimum_frequency = max(0, int(minimum_movement_frequency))
    ranked = []
    for symbol, record in payload.get("symbols", {}).items():
        setup = record.get("upside_setup") if isinstance(record, dict) else None
        if not isinstance(setup, dict):
            continue
        normalized_symbol = str(symbol).upper()
        last_movement = _parse_timestamp(record.get("last_movement_at"))
        updated = _parse_timestamp(setup.get("updated_at"))
        if last_movement is None or updated is None or not (cutoff <= last_movement <= current_time):
            continue
        if not (cutoff <= updated <= current_time):
            continue
        frequency = _finite_float(record.get("movement_frequency_96h")) or 0
        if frequency < minimum_frequency or (pinned_only and normalized_symbol not in pinned):
            continue
        score = _finite_float(setup.get("score"))
        change = _finite_float(setup.get("change_pct"))
        if score is None or change is None:
            continue
        safe_setup = dict(setup)
        safe_setup["score"] = round(max(0.0, min(100.0, score)), 1)
        safe_setup["change_pct"] = round(change, 2)
        safe_setup["updated_at"] = updated.isoformat()
        observed_change = _finite_float(setup.get("observed_change_since_shortlist_pct"))
        safe_setup["observed_change_since_shortlist_pct"] = round(observed_change, 2) if observed_change is not None else 0.0
        history = []
        raw_history = record.get("upside_setup_history", [])
        if isinstance(raw_history, list):
            for snapshot in raw_history[-32:]:
                if not isinstance(snapshot, dict):
                    continue
                stamp = _parse_timestamp(snapshot.get("updated_at"))
                snapshot_score = _finite_float(snapshot.get("score"))
                snapshot_price = _finite_float(snapshot.get("reference_price"))
                if stamp is None or snapshot_score is None or snapshot_price is None or snapshot_price <= 0:
                    continue
                history.append({
                    "updated_at": stamp.isoformat(),
                    "score": round(max(0.0, min(100.0, snapshot_score)), 1),
                    "price": round(snapshot_price, 6),
                })
        ranked.append({
            "symbol": normalized_symbol,
            **safe_setup,
            "movement_frequency_96h": int(frequency),
            "shortlist_observation_count": len(history),
            "shortlist_history": history,
            "last_movement_at": last_movement.isoformat(),
            "pinned": normalized_symbol in pinned,
        })
    return sorted(
        ranked,
        key=lambda item: (float(item.get("score", 0)), float(item.get("change_pct", 0))),
        reverse=True,
    )[:max(0, limit)]


def movement_scan_summary(payload: dict) -> dict:
    """Return a defensive copy of provider-scan audit fields, if available."""
    latest = payload.get("last_scan") if isinstance(payload, dict) else None
    successful = payload.get("last_successful_scan") if isinstance(payload, dict) else None
    return {
        "last_checked_at": payload.get("last_scan_checked_at") if isinstance(payload, dict) else None,
        "last_successful_at": payload.get("last_successful_scan_at") if isinstance(payload, dict) else None,
        "latest": dict(latest) if isinstance(latest, dict) else None,
        "last_successful": dict(successful) if isinstance(successful, dict) else None,
    }


def _read_payload(path: Path) -> dict:
    if not path.exists():
        return {"version": TRACKER_VERSION, "symbols": {}}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise MovementTrackerError(f"Saved movement tracker could not be read: {exc}") from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("symbols"), dict):
        raise MovementTrackerError("Saved movement tracker has an invalid structure; original file was preserved.")
    return payload


def _scan_snapshot(metadata: dict, now: datetime) -> dict:
    def count(name: str, fallback: int = 0) -> int:
        try:
            value = int(metadata.get(name, fallback))
        except (TypeError, ValueError, OverflowError):
            value = fallback
        return max(0, min(value, 10_000_000))

    requested = count("requested_count")
    returned = count("returned_count")
    failed = count("failed_count")
    universe = count("universe_count") if metadata.get("universe_count") is not None else None
    pinned_requested = count("pinned_requested_count")
    pinned_universe = count("pinned_universe_count")
    pinned_outside_scope = count("pinned_outside_scope_count")
    batch_coverage = round(min(100.0, requested * 100.0 / universe), 1) if universe else None
    provider_return = round(min(100.0, returned * 100.0 / requested), 1) if requested else None
    if returned == 0:
        status = "no-data"
    elif returned < requested:
        status = "partial-provider-response"
    elif universe is not None and requested < universe:
        status = "rotating-batch"
    else:
        # Even a 100% response only describes requested symbols, not complete
        # provider coverage of all tradeable instruments.
        status = "requested-batch-returned"
    source = str(metadata.get("source") or "market-data provider").strip()[:48]
    scope = str(metadata.get("scope") or "configured scan scope").strip()[:48]
    return {
        "checked_at": now.isoformat(),
        "source": source,
        "scope": scope,
        "status": status,
        "requested_count": requested,
        "returned_count": returned,
        "failed_count": failed,
        "universe_count": universe,
        "pinned_requested_count": pinned_requested,
        "pinned_universe_count": pinned_universe,
        "pinned_outside_scope_count": pinned_outside_scope,
        "batch_coverage_pct": batch_coverage,
        "provider_return_pct": provider_return,
    }


def _movement_timestamps(candles: list[Candle], cutoff: datetime, now: datetime) -> list[datetime]:
    ordered = sorted(candles, key=lambda item: item.timestamp)
    movements: list[datetime] = []
    previous_close: float | None = None
    for candle in ordered:
        stamp = _naive(candle.timestamp)
        close = _finite_float(candle.close)
        high = _finite_float(candle.high)
        low = _finite_float(candle.low)
        open_price = _finite_float(candle.open)
        if stamp is None or close is None or high is None or low is None:
            continue
        tolerance = max(abs(close) * 1e-8, 1e-8)
        moved = high - low > tolerance
        moved = moved or (open_price is not None and abs(close - open_price) > tolerance)
        moved = moved or (previous_close is not None and abs(close - previous_close) > tolerance)
        if moved and cutoff <= stamp <= now:
            movements.append(stamp)
        previous_close = close
    return movements


def _parse_timestamp(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        return _naive(datetime.fromisoformat(value))
    except ValueError:
        return None


def _naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone().replace(tzinfo=None)


def _finite_float(value: object) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return result if math.isfinite(result) else None


def _bounded_score(value: object) -> float:
    score = _finite_float(value)
    return max(0.0, min(100.0, score or 0.0))
