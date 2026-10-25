"""Read-only operations review helpers backed by Timmy's existing local events."""
from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Mapping

SENSITIVE_KEY = re.compile(r"(secret|password|token|credential|account.?id|app.?key|api.?key|authorization|user.?name|email|phone)", re.I)
SENSITIVE_TEXT = re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._~+/-]+=*|((?:[A-Z0-9_]*?(?:secret|password|token|account[_ -]?id|app[_ -]?key|api[_ -]?key|authorization|user[_ -]?name)[A-Z0-9_]*)\s*[=:]\s*)[^\s,;]+|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b")


def order_timeline(events: Iterable[Mapping[str, object]], limit: int = 100) -> list[dict[str, str]]:
    rows = []
    for event in events:
        stamp = str(event.get("recorded_at") or event.get("submitted_at") or event.get("timestamp") or "")
        order = event.get("order") if isinstance(event.get("order"), Mapping) else {}
        symbol = str(event.get("symbol") or order.get("symbol") or "-")
        status = str(event.get("status") or event.get("event") or "update")
        mode = str(event.get("mode") or "unknown")
        rows.append({"time": stamp, "symbol": symbol.upper(), "status": status, "mode": mode,
                     "detail": str(event.get("message") or event.get("reason") or event.get("event") or "")})
    rows.sort(key=lambda row: row["time"])
    return rows[-max(1, limit):]


def mask_identifier(value: object) -> str:
    """Mask a local account identifier while retaining a short suffix for context."""
    identifier = "".join(str(value or "").split())
    if not identifier:
        return "not selected"
    return "•" * max(4, len(identifier) - 4) + identifier[-4:]


def daily_activity_brief(events: Iterable[Mapping[str, object]], now: datetime | None = None) -> list[str]:
    now = now or datetime.now(timezone.utc)
    today = now.astimezone(timezone.utc).date().isoformat()
    selected = []
    for event in events:
        stamp = str(event.get("recorded_at") or event.get("submitted_at") or event.get("timestamp") or "")
        try:
            parsed = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.astimezone()
            if parsed.astimezone(timezone.utc).date().isoformat() == today:
                selected.append(event)
        except ValueError:
            continue
    statuses = Counter(str(e.get("status") or e.get("event") or "other").lower() for e in selected)
    modes = Counter(str(e.get("mode") or "unknown").lower() for e in selected)
    symbols = sorted({str(e.get("symbol") or "").upper() for e in selected if e.get("symbol")})
    return [f"UTC date: {today}", f"Events: {len(selected)}", f"Paper / live / other: {modes['paper']} / {modes['live']} / {sum(v for k, v in modes.items() if k not in {'paper','live'})}",
            "Statuses: " + (", ".join(f"{k} {v}" for k, v in statuses.most_common(8)) or "none recorded"),
            "Symbols: " + (", ".join(symbols[:30]) or "none recorded"),
            "Source: local execution events; this is not a broker statement."]


def save_journal_review(path: str | Path, key: str, label: str, note: str) -> None:
    if not key.strip() or len(label) > 40 or len(note) > 1000:
        raise ValueError("Select a journal event; labels must be 40 characters and notes 1,000 characters or less.")
    target = Path(path)
    try:
        payload = json.loads(target.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            payload = {}
    except (OSError, ValueError):
        payload = {}
    payload[key] = {"label": label.strip(), "note": note.strip(), "updated_at": datetime.now(timezone.utc).isoformat()}
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_suffix(target.suffix + ".tmp")
    temp.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temp.chmod(0o600)
    temp.replace(target)


def redact(value: object, key: str = "") -> object:
    if SENSITIVE_KEY.search(key):
        return "[REDACTED]"
    if isinstance(value, Mapping):
        return {str(k): redact(v, str(k)) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [redact(item) for item in value]
    if isinstance(value, str):
        return SENSITIVE_TEXT.sub(lambda m: (m.group(1) or m.group(2) or "") + "[REDACTED]", value)
    return value


def recovery_steps(message: str) -> tuple[str, ...]:
    text = message.casefold()
    if any(word in text for word in ("credential", "token", "unauthorized", "auth")):
        return ("Pause live automation and keep the account lane unchanged.", "Open Setup and verify the local credential profile and account selection.", "Use Broker → Account Check to confirm access; do not paste credentials into support logs.")
    if any(word in text for word in ("timeout", "network", "connection", "unavailable")):
        return ("Do not repeat an order submission until Broker → Account Check has refreshed.", "Review open orders at the broker and match client order IDs against Audit.", "Retry data refresh after connectivity returns; escalate with a redacted diagnostics bundle if it persists.")
    if any(word in text for word in ("journal", "integrity", "write", "permission")):
        return ("Stop automated or live retries while event persistence is unhealthy.", "Open Audit and Health; preserve the original files before repair.", "Export redacted diagnostics and reconcile broker orders before resuming.")
    if any(word in text for word in ("stale", "old quote", "market data", "quote freshness")):
        return ("Keep the current plan out of the submission path.", "Refresh market data and confirm the displayed timestamp and candle quality.", "Rebuild the plan only after the data freshness warning clears.")
    if any(word in text for word in ("market closed", "session closed", "outside market")):
        return ("Do not treat a closed-session block as an order failure.", "Check the market session and supported trading hours for this instrument.", "Recheck the signal and risk plan during an eligible session.")
    if any(word in text for word in ("buying power", "insufficient cash")):
        return ("Do not retry the same size blindly.", "Refresh broker buying power and verify account lane and pending orders.", "Rebuild a risk-compliant plan only after available funds are confirmed.")
    if any(word in text for word in ("preview rejected", "preview failed")):
        return ("Do not submit the rejected payload.", "Review the broker's preview response, account, symbol, quantity, and session.", "Correct the cause and obtain a fresh preview before any live submission.")
    if any(word in text for word in ("daily loss", "drawdown", "max positions", "daily cap", "cooldown", "risk limit")):
        return ("Keep the guardrail in force; do not lower it to force an order through.", "Review the relevant risk state in Execution and the recent event history in Audit.", "Resume only after the configured limit naturally permits a new plan.")
    return ("Read the exact blocker shown in Health or Broker before acting.", "Refresh the account/data state and verify the order in the broker if submission may have occurred.", "Keep live automation paused until the blocker is cleared and reconciliation is clean.")
