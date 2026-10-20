"""Local strategy snapshots, decision notes, and activity report export."""
from __future__ import annotations

import csv
import hashlib
import json
import os
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from .config import BotConfig

_STRATEGY_FIELDS = (
    "trading_style", "enabled_trade_patterns", "min_score_to_trade", "max_positions",
    "risk_per_trade_usd", "max_daily_loss_usd", "min_reward_risk_to_trade",
    "max_signal_volatility_pct", "max_price_over_sma20_pct", "max_price_over_sma50_pct",
    "max_rsi_to_buy", "max_entry_cash_pct", "symbol_whitelist",
)
_PRIVATE_KEYS = ("token", "secret", "password", "apikey", "accountid", "appkey", "authorization", "credential")
_REPORT_NOTICE = "Decision notes are user-provided; review them for private information before sharing this report."


@dataclass(frozen=True)
class StrategyVersion:
    version_id: str
    created_at: str
    fingerprint: str
    settings: dict[str, Any]


@dataclass(frozen=True)
class DecisionNote:
    event_id: str
    note: str
    created_at: str


def strategy_settings(config: BotConfig) -> dict[str, Any]:
    """Return only strategy/risk inputs, excluding credentials and broker settings."""
    result = {}
    for name in _STRATEGY_FIELDS:
        value = getattr(config, name)
        result[name] = sorted(value) if isinstance(value, set) else value
    return result


def record_strategy_version(config: BotConfig, history_path: str | Path) -> StrategyVersion:
    settings = strategy_settings(config)
    canonical = json.dumps(settings, sort_keys=True, separators=(",", ":"))
    fingerprint = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    path = Path(history_path).expanduser()
    previous = _read_jsonl(path)
    if previous and previous[-1].get("fingerprint") == fingerprint:
        item = previous[-1]
        return StrategyVersion(item["version_id"], item["created_at"], fingerprint, settings)
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    version = StrategyVersion(f"{created_at.replace(':', '').replace('-', '')}-{fingerprint[:10]}", created_at, fingerprint, settings)
    _append_jsonl(path, asdict(version))
    return version


def list_strategy_versions(history_path: str | Path) -> list[StrategyVersion]:
    versions = []
    for item in _read_jsonl(Path(history_path).expanduser()):
        try:
            versions.append(StrategyVersion(**item))
        except (TypeError, KeyError):
            continue
    return versions


def append_decision_note(notes_path: str | Path, event_id: str, note: str) -> DecisionNote:
    event_id = str(event_id).strip()
    note = str(note).strip()
    if not event_id or len(event_id) > 160:
        raise ValueError("A decision note requires an event ID of at most 160 characters.")
    if not note or len(note) > 2000:
        raise ValueError("Decision notes must contain 1 to 2000 characters.")
    result = DecisionNote(event_id, note, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    _append_jsonl(Path(notes_path).expanduser(), asdict(result))
    return result


def activity_event_id(event: dict[str, Any]) -> str:
    """Build a stable local reference for legacy journal rows without IDs."""
    canonical = json.dumps(event, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:32]


def list_decision_notes(notes_path: str | Path, event_id: str | None = None) -> list[DecisionNote]:
    result = []
    for item in _read_jsonl(Path(notes_path).expanduser()):
        try:
            note = DecisionNote(**item)
        except (TypeError, KeyError):
            continue
        if event_id is None or note.event_id == event_id:
            result.append(note)
    return result


def export_activity_report(
    journal_path: str | Path,
    destination: str | Path,
    format: str = "json",
    notes_path: str | Path | None = None,
    strategy_history_path: str | Path | None = None,
) -> Path:
    """Export a redacted local activity report as JSON or flat CSV."""
    events = []
    for event in _read_jsonl(Path(journal_path).expanduser()):
        safe_event = _redact(event)
        safe_event["event_id"] = activity_event_id(event)
        events.append(safe_event)
    notes = [asdict(note) for note in list_decision_notes(notes_path)] if notes_path else []
    versions = [asdict(version) for version in list_strategy_versions(strategy_history_path)] if strategy_history_path else []
    output = Path(destination).expanduser()
    output.parent.mkdir(parents=True, exist_ok=True)
    format = format.lower()
    if format == "json":
        output.write_text(json.dumps({"sharing_notice": _REPORT_NOTICE, "events": events, "notes": notes, "strategy_versions": versions}, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    elif format == "csv":
        fields = ("record_type", "event_id", "submitted_at", "status", "mode", "symbol", "side", "quantity", "buy_price", "sell_status", "sold_price", "note", "version_id", "fingerprint", "sharing_notice")
        with output.open("w", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            writer.writerow({"record_type": "report_notice", "sharing_notice": _REPORT_NOTICE})
            for event in events:
                row = dict(event)
                order = row.pop("order", {})
                row.setdefault("symbol", order.get("symbol"))
                row.setdefault("side", order.get("side"))
                row.setdefault("quantity", order.get("quantity"))
                row.setdefault("buy_price", order.get("limit_price"))
                row["record_type"] = "activity"
                writer.writerow(row)
            for note in notes:
                writer.writerow({"record_type": "decision_note", **note})
            for version in versions:
                writer.writerow({"record_type": "strategy_version", **version})
    else:
        raise ValueError("Activity report format must be 'json' or 'csv'.")
    os.chmod(output, 0o600)
    return output


def _append_jsonl(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(payload, sort_keys=True) + "\n")
    os.chmod(path, 0o600)


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return []
    events = []
    for line in lines:
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(item, dict):
            events.append(item)
    return events


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "[REDACTED]"
            if any(marker in "".join(char for char in str(key).lower() if char.isalnum()) for marker in _PRIVATE_KEYS)
            else _redact(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact(item) for item in value]
    return value
