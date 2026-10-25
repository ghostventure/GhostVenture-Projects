"""Bounded local persistence for named scanner filter presets.

Integration: instantiate ``ScannerPresetStore()`` (defaults to
``$TIMMY_HOME/scanner-presets.json``), call ``create``/``update``/``delete``
from UI actions, and pass a preset's ``query``, ``category`` and
``min_score`` to the existing local scanner. This module only stores filters;
it does not run scans, fetch market data, or submit orders.

Limits are deliberately small: 50 presets, 80-character names, 500-character
queries, 48-character categories, and a 128 KiB persistence file.
"""
from __future__ import annotations

import json
import os
import tempfile
import threading
import uuid
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone
from pathlib import Path

MAX_PRESETS = 50
MAX_NAME_LENGTH = 80
MAX_QUERY_LENGTH = 500
MAX_CATEGORY_LENGTH = 48
MAX_FILE_BYTES = 128 * 1024


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_text(
    value: str, label: str, limit: int, *, multiline: bool = False, allow_empty: bool = False
) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{label} must be text")
    value = value.strip()
    if not value and not allow_empty:
        raise ValueError(f"{label} cannot be empty")
    if len(value) > limit:
        raise ValueError(f"{label} cannot exceed {limit} characters")
    allowed = "\t\r\n" if multiline else ""
    if any(ord(char) < 32 and char not in allowed for char in value):
        raise ValueError(f"{label} contains unsupported control characters")
    return value


@dataclass(frozen=True)
class ScannerPreset:
    """A named scanner filter set; ``min_score`` is inclusive."""

    name: str
    query: str
    category: str | None = None
    min_score: int | None = None
    id: str = ""
    created_at: str = ""
    updated_at: str = ""

    def __post_init__(self) -> None:
        object.__setattr__(self, "name", _clean_text(self.name, "name", MAX_NAME_LENGTH))
        object.__setattr__(
            self,
            "query",
            _clean_text(self.query, "query", MAX_QUERY_LENGTH, multiline=True, allow_empty=True),
        )
        if self.category is not None:
            category = _clean_text(self.category, "category", MAX_CATEGORY_LENGTH).lower()
            object.__setattr__(self, "category", category)
        if self.min_score is not None:
            if isinstance(self.min_score, bool) or not isinstance(self.min_score, int):
                raise ValueError("min_score must be an integer")
            if not 0 <= self.min_score <= 100:
                raise ValueError("min_score must be between 0 and 100")
        if not self.query and self.category is None and self.min_score is None:
            raise ValueError("Preset must contain a query, category, or minimum score")
        if not self.id:
            object.__setattr__(self, "id", uuid.uuid4().hex)
        if not self.created_at:
            object.__setattr__(self, "created_at", _timestamp())
        if not self.updated_at:
            object.__setattr__(self, "updated_at", self.created_at)


class ScannerPresetStore:
    """Thread-safe JSON store for user-created scanner presets.

    The store is intended for one application process. Atomic replacement
    protects against partial writes; simultaneous writers across processes are
    not coordinated.
    """

    def __init__(self, path: str | Path | None = None) -> None:
        home = Path(os.getenv("TIMMY_HOME", Path.cwd())).expanduser()
        self.path = Path(path).expanduser() if path is not None else home / "scanner-presets.json"
        self._lock = threading.RLock()
        self._presets: dict[str, ScannerPreset] = {}
        self._load()

    @property
    def presets(self) -> tuple[ScannerPreset, ...]:
        with self._lock:
            return tuple(sorted(self._presets.values(), key=lambda item: item.name.casefold()))

    def get(self, preset_id: str) -> ScannerPreset:
        with self._lock:
            return self._presets[preset_id]

    def create(
        self,
        name: str,
        query: str = "",
        *,
        category: str | None = None,
        min_score: int | None = None,
    ) -> ScannerPreset:
        preset = ScannerPreset(name=name, query=query, category=category, min_score=min_score)
        with self._lock:
            self._assert_unique_name(preset.name)
            if len(self._presets) >= MAX_PRESETS:
                raise ValueError(f"A maximum of {MAX_PRESETS} scanner presets is allowed")
            self._presets[preset.id] = preset
            self._save()
            return preset

    def update(self, preset_id: str, **changes: object) -> ScannerPreset:
        allowed = {"name", "query", "category", "min_score"}
        unknown = set(changes) - allowed
        if unknown:
            raise ValueError(f"Unsupported preset fields: {', '.join(sorted(unknown))}")
        with self._lock:
            current = self._presets[preset_id]
            updated = replace(current, **changes, updated_at=_timestamp())
            self._assert_unique_name(updated.name, excluding=preset_id)
            self._presets[preset_id] = updated
            self._save()
            return updated

    def delete(self, preset_id: str) -> bool:
        with self._lock:
            if preset_id not in self._presets:
                return False
            del self._presets[preset_id]
            self._save()
            return True

    def _assert_unique_name(self, name: str, excluding: str | None = None) -> None:
        folded = name.casefold()
        if any(
            preset_id != excluding and preset.name.casefold() == folded
            for preset_id, preset in self._presets.items()
        ):
            raise ValueError(f"A scanner preset named {name!r} already exists")

    def _load(self) -> None:
        try:
            if self.path.stat().st_size > MAX_FILE_BYTES:
                return
            payload = json.loads(self.path.read_text(encoding="utf-8"))
            rows = payload.get("presets") if isinstance(payload, dict) and payload.get("version") == 1 else None
            if not isinstance(rows, list) or len(rows) > MAX_PRESETS:
                return
            loaded = [ScannerPreset(**row) for row in rows if isinstance(row, dict)]
            if len(loaded) != len(rows):
                return
            by_id = {preset.id: preset for preset in loaded}
            if len(by_id) != len(loaded) or len({p.name.casefold() for p in loaded}) != len(loaded):
                return
            self._presets = by_id
        except (OSError, UnicodeError, json.JSONDecodeError, TypeError, ValueError):
            # A bad or oversized profile file should not prevent Timmy startup.
            self._presets = {}

    def _save(self) -> None:
        payload = {
            "version": 1,
            "presets": [asdict(preset) for preset in self._presets.values()],
        }
        encoded = json.dumps(payload, indent=2, sort_keys=True) + "\n"
        if len(encoded.encode("utf-8")) > MAX_FILE_BYTES:
            raise ValueError("Scanner preset data exceeds the persistence size limit")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, temp_path = tempfile.mkstemp(prefix=f".{self.path.name}.", dir=self.path.parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as stream:
                stream.write(encoded)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temp_path, self.path)
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)


class ScannerTablePresetStore:
    """Named round-trip presets for table column order, visibility, and sort."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path).expanduser()
        self._presets: dict[str, dict] = {}
        self._load()

    @property
    def presets(self) -> tuple[dict, ...]:
        return tuple(self._presets[name] for name in sorted(self._presets, key=str.casefold))

    def save(self, name: str, state: dict) -> dict:
        clean_name = _clean_text(name, "table preset name", 48)
        if not isinstance(state, dict):
            raise ValueError("Table layout must be a mapping.")
        safe_state = {
            "columns": list(state.get("columns", [])),
            "visible_columns": list(state.get("visible_columns", [])),
            "sort_column": str(state.get("sort_column", "")),
            "descending": state.get("descending", True),
        }
        if not safe_state["columns"] or not safe_state["visible_columns"] or not isinstance(safe_state["descending"], bool):
            raise ValueError("Table layout must include visible columns and a sort direction.")
        if clean_name not in self._presets and len(self._presets) >= 30:
            raise ValueError("A maximum of 30 named table layouts is allowed.")
        record = {"name": clean_name, **safe_state}
        self._presets[clean_name] = record
        self._write()
        return record

    def delete(self, name: str) -> bool:
        if name not in self._presets:
            return False
        del self._presets[name]
        self._write()
        return True

    def get(self, name: str) -> dict | None:
        record = self._presets.get(name)
        return dict(record) if record else None

    def _load(self) -> None:
        try:
            if self.path.stat().st_size > MAX_FILE_BYTES:
                return
            payload = json.loads(self.path.read_text(encoding="utf-8"))
            rows = payload.get("presets") if isinstance(payload, dict) and payload.get("version") == 1 else None
            if isinstance(rows, list) and len(rows) <= 30:
                self._presets = {row["name"]: row for row in rows if isinstance(row, dict) and isinstance(row.get("name"), str)}
        except (OSError, ValueError, TypeError, KeyError):
            self._presets = {}

    def _write(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        encoded = json.dumps({"version": 1, "presets": list(self._presets.values())}, indent=2, sort_keys=True) + "\n"
        if len(encoded.encode("utf-8")) > MAX_FILE_BYTES:
            raise ValueError("Named table layouts exceed the storage limit.")
        fd, temporary = tempfile.mkstemp(prefix=f".{self.path.name}.", dir=self.path.parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as stream:
                os.fchmod(stream.fileno(), 0o600)
                stream.write(encoded)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, self.path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
