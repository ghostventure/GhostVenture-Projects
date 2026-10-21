"""Safe persistence and action helpers for the native GUI workspaces.

This module deliberately stores presentation state only. It does not read or
write Timmy runtime configuration, broker profiles, credentials, or order data.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable


_SCHEMA_VERSION = 1
_MAX_PRESETS = 30
_MAX_RECENTS = 20
_MAX_FILE_BYTES = 256_000
_SYMBOL_RE = re.compile(r"^[A-Z0-9.^_-]{1,24}$")
_NAME_RE = re.compile(r"^[^\x00-\x1f]{1,48}$")
_SAFE_STATE_KEYS = {
    "workspace",
    "selected_symbol",
    "timeframe",
    "watchlist_group",
    "density",
    "panels",
    "split_sizes",
    "overview_radar_visible",
}


@dataclass(frozen=True)
class WorkspacePreset:
    name: str
    state: dict[str, object]


@dataclass(frozen=True)
class PaletteAction:
    action_id: str
    label: str
    callback: Callable[[], object]
    category: str = "General"
    shortcut: str = ""
    keywords: tuple[str, ...] = ()


class WorkspaceStore:
    """Persist named UI presets and recently viewed symbols under Timmy home."""

    def __init__(self, home: str | Path) -> None:
        self.home = Path(home).expanduser()
        self.path = self.home / "timmy-ui-workspaces.json"

    def list_presets(self) -> list[WorkspacePreset]:
        payload = self._read()
        presets = payload["presets"]
        return [WorkspacePreset(name, dict(state)) for name, state in presets.items()]

    def load_preset(self, name: str) -> WorkspacePreset | None:
        payload = self._read()
        state = payload["presets"].get(str(name))
        return WorkspacePreset(str(name), dict(state)) if isinstance(state, dict) else None

    def save_preset(self, name: str, state: dict[str, object]) -> WorkspacePreset:
        clean_name = str(name).strip()
        if not _NAME_RE.fullmatch(clean_name):
            raise ValueError("Preset name must be 1 to 48 printable characters.")
        clean_state = _sanitize_state(state)
        payload = self._read()
        presets = payload["presets"]
        if clean_name not in presets and len(presets) >= _MAX_PRESETS:
            raise ValueError(f"At most {_MAX_PRESETS} workspace presets can be saved.")
        presets[clean_name] = clean_state
        payload["active_preset"] = clean_name
        self._write(payload)
        return WorkspacePreset(clean_name, dict(clean_state))

    def delete_preset(self, name: str) -> bool:
        payload = self._read()
        removed = payload["presets"].pop(str(name), None) is not None
        if removed:
            if payload["active_preset"] == name:
                payload["active_preset"] = ""
            self._write(payload)
        return removed

    def active_preset_name(self) -> str | None:
        value = self._read()["active_preset"]
        return value or None

    def remember_last_state(self, state: dict[str, object]) -> dict[str, object]:
        """Persist the most recently used page, ticker, and watchlist group."""
        clean_state = _sanitize_state(state)
        payload = self._read()
        payload["last_state"] = clean_state
        self._write(payload)
        return dict(clean_state)

    def last_state(self) -> dict[str, object]:
        return dict(self._read()["last_state"])

    def remember_symbol(self, symbol: str) -> list[str]:
        clean = str(symbol).strip().upper()
        if not _SYMBOL_RE.fullmatch(clean):
            raise ValueError("Symbol contains unsupported characters or is too long.")
        payload = self._read()
        recents = [item for item in payload["recent_symbols"] if item != clean]
        payload["recent_symbols"] = [clean, *recents][:_MAX_RECENTS]
        self._write(payload)
        return list(payload["recent_symbols"])

    def recent_symbols(self) -> list[str]:
        return list(self._read()["recent_symbols"])

    def _read(self) -> dict[str, object]:
        try:
            if self.path.stat().st_size > _MAX_FILE_BYTES:
                return _empty_payload()
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError, TypeError):
            return _empty_payload()
        if not isinstance(raw, dict) or raw.get("version") != _SCHEMA_VERSION:
            return _empty_payload()
        presets_raw = raw.get("presets", {})
        presets: dict[str, dict[str, object]] = {}
        if isinstance(presets_raw, dict):
            for name, state in list(presets_raw.items())[:_MAX_PRESETS]:
                if isinstance(name, str) and _NAME_RE.fullmatch(name) and isinstance(state, dict):
                    try:
                        presets[name] = _sanitize_state(state)
                    except ValueError:
                        continue
        recent_raw = raw.get("recent_symbols", [])
        recent: list[str] = []
        if isinstance(recent_raw, list):
            for item in recent_raw:
                candidate = str(item).strip().upper()
                if _SYMBOL_RE.fullmatch(candidate) and candidate not in recent:
                    recent.append(candidate)
                if len(recent) >= _MAX_RECENTS:
                    break
        active = raw.get("active_preset", "")
        active = active if isinstance(active, str) and active in presets else ""
        try:
            last_state = _sanitize_state(raw.get("last_state", {}))
        except ValueError:
            last_state = {}
        return {
            "version": _SCHEMA_VERSION,
            "presets": presets,
            "active_preset": active,
            "recent_symbols": recent,
            "last_state": last_state,
        }

    def _write(self, payload: dict[str, object]) -> None:
        self.home.mkdir(parents=True, exist_ok=True)
        encoded = json.dumps(payload, indent=2, sort_keys=True) + "\n"
        if len(encoded.encode("utf-8")) > _MAX_FILE_BYTES:
            raise ValueError("Workspace state is too large to save.")
        fd, temporary_name = tempfile.mkstemp(prefix=".timmy-ui-workspaces-", dir=self.home)
        temporary = Path(temporary_name)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as stream:
                stream.write(encoded)
                stream.flush()
                os.fsync(stream.fileno())
            temporary.chmod(0o600)
            os.replace(temporary, self.path)
            self.path.chmod(0o600)
        finally:
            try:
                temporary.unlink()
            except FileNotFoundError:
                pass


class ActionRegistry:
    """Small, UI-independent registry used by a command palette and shortcuts."""

    def __init__(self) -> None:
        self._actions: dict[str, PaletteAction] = {}

    def register(
        self,
        action_id: str,
        label: str,
        callback: Callable[[], object],
        *,
        category: str = "General",
        shortcut: str = "",
        keywords: Iterable[str] = (),
    ) -> PaletteAction:
        key = str(action_id).strip().lower()
        clean_label = str(label).strip()
        if not key or not clean_label or not callable(callback):
            raise ValueError("Actions need an id, label, and callable callback.")
        if key in self._actions:
            raise ValueError(f"Action id is already registered: {key}")
        action = PaletteAction(
            key,
            clean_label,
            callback,
            str(category).strip() or "General",
            str(shortcut).strip(),
            tuple(str(word).strip().lower() for word in keywords if str(word).strip()),
        )
        self._actions[key] = action
        return action

    def unregister(self, action_id: str) -> bool:
        return self._actions.pop(str(action_id).strip().lower(), None) is not None

    def actions(self) -> list[PaletteAction]:
        return sorted(self._actions.values(), key=lambda item: (item.category.casefold(), item.label.casefold()))

    def search(self, query: str, limit: int = 12) -> list[PaletteAction]:
        terms = [term.casefold() for term in str(query).split() if term]
        limit = max(1, min(int(limit), 50))
        ranked: list[tuple[int, str, PaletteAction]] = []
        for action in self._actions.values():
            haystack = " ".join((action.action_id, action.label, action.category, *action.keywords)).casefold()
            if all(term in haystack for term in terms):
                score = sum(4 if term in action.label.casefold() else 2 if term in action.action_id else 1 for term in terms)
                ranked.append((-score, action.label.casefold(), action))
        return [entry[2] for entry in sorted(ranked)[:limit]]

    def invoke(self, action_id: str) -> object:
        action = self._actions.get(str(action_id).strip().lower())
        if action is None:
            raise KeyError(f"Unknown action: {action_id}")
        return action.callback()


def _empty_payload() -> dict[str, object]:
    return {"version": _SCHEMA_VERSION, "presets": {}, "active_preset": "", "recent_symbols": [], "last_state": {}}


def _sanitize_state(state: dict[str, object]) -> dict[str, object]:
    if not isinstance(state, dict):
        raise ValueError("Workspace state must be a mapping.")
    clean: dict[str, object] = {}
    for key, value in state.items():
        if key not in _SAFE_STATE_KEYS:
            continue
        if key in {"workspace", "watchlist_group", "density"}:
            if isinstance(value, (str, int, float, bool)):
                clean[key] = str(value)[:64]
        elif key == "selected_symbol":
            symbol = str(value).strip().upper()
            if not _SYMBOL_RE.fullmatch(symbol):
                raise ValueError("Selected symbol is invalid.")
            clean[key] = symbol
        elif key == "overview_radar_visible":
            if isinstance(value, bool):
                clean[key] = value
        elif key == "timeframe":
            timeframe = str(value).strip().lower()
            if not re.fullmatch(r"(?:1|2|5|10|15|30|60|90|120|240|1d|1w|1mo)(?:m|h)?", timeframe):
                raise ValueError("Timeframe is not supported.")
            clean[key] = timeframe
        elif key == "panels" and isinstance(value, dict):
            clean[key] = {str(name)[:40]: bool(shown) for name, shown in list(value.items())[:24] if str(name).strip()}
        elif key == "split_sizes" and isinstance(value, dict):
            sizes: dict[str, int] = {}
            for name, amount in list(value.items())[:12]:
                try:
                    size = int(amount)
                except (TypeError, ValueError):
                    continue
                if str(name).strip() and 80 <= size <= 4000:
                    sizes[str(name)[:40]] = size
            clean[key] = sizes
    return clean
