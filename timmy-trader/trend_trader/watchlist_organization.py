"""Profile-local, user-managed watchlist groups and pinned symbols.

This store is intentionally separate from generated active, quiet, movement,
and trade-ready watchlists. Reading or editing it cannot change trading scope.

Integration::

    store = WatchlistOrganizationStore(profile_home)
    group = store.create_group("Semiconductors", ["NVDA", "AMD", "AVGO"])
    store.reorder_symbols(group.id, ["AMD", "NVDA", "AVGO"])
    store.pin_symbol("SPY")

Limits: 100 groups, 100 symbols per group, 100 pinned symbols, 64-character
group names, 32-character symbols, 500 locally quieted symbols, and a 64 KiB
JSON file. Local quieting only affects research/radar visibility and local
signal-alert evaluation; it never changes generated trading watchlists.
"""
from __future__ import annotations

import json
import os
import re
import tempfile
import threading
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

MAX_GROUPS = 100
MAX_SYMBOLS_PER_GROUP = 100
MAX_PINNED_SYMBOLS = 100
MAX_QUIET_SYMBOLS = 500
MAX_GROUP_NAME_LENGTH = 64
MAX_SYMBOL_LENGTH = 32
MAX_FILE_BYTES = 64 * 1024
_SYMBOL_PATTERN = re.compile(r"^[A-Z0-9][A-Z0-9._=^/-]*$")


@dataclass(frozen=True)
class WatchlistGroup:
    id: str
    name: str
    symbols: tuple[str, ...]


def _normalize_symbol(symbol: str) -> str:
    if not isinstance(symbol, str):
        raise ValueError("Symbol must be text")
    normalized = symbol.strip().upper()
    if (
        not normalized
        or len(normalized) > MAX_SYMBOL_LENGTH
        or not _SYMBOL_PATTERN.fullmatch(normalized)
    ):
        raise ValueError(f"Invalid symbol: {symbol!r}")
    return normalized


def _normalize_symbols(symbols: Iterable[str], *, limit: int) -> tuple[str, ...]:
    if isinstance(symbols, (str, bytes)):
        raise ValueError("Symbols must be provided as a collection of symbol strings")
    clean: list[str] = []
    seen: set[str] = set()
    for symbol in symbols:
        normalized = _normalize_symbol(symbol)
        if normalized not in seen:
            seen.add(normalized)
            clean.append(normalized)
            if len(clean) > limit:
                raise ValueError(f"A maximum of {limit} symbols is allowed")
    return tuple(clean)


def _normalize_name(name: str) -> str:
    if not isinstance(name, str):
        raise ValueError("Group name must be text")
    normalized = name.strip()
    if not normalized or len(normalized) > MAX_GROUP_NAME_LENGTH:
        raise ValueError(f"Group name must contain 1 to {MAX_GROUP_NAME_LENGTH} characters")
    if any(ord(char) < 32 for char in normalized):
        raise ValueError("Group name contains unsupported control characters")
    return normalized


class WatchlistOrganizationStore:
    """Thread-safe organization data stored under an explicit profile home."""

    def __init__(self, profile_home: str | Path, filename: str = "timmy-watchlist-organization.json") -> None:
        home = Path(profile_home).expanduser()
        if not filename or Path(filename).name != filename or filename in {".", ".."}:
            raise ValueError("filename must be a simple file name")
        self.path = home / filename
        self._lock = threading.RLock()
        self._groups: list[WatchlistGroup] = []
        self._pins: list[str] = []
        self._quiet_symbols: list[str] = []
        self.load_error: str | None = None
        self._load()

    @property
    def groups(self) -> tuple[WatchlistGroup, ...]:
        with self._lock:
            return tuple(self._groups)

    @property
    def pinned_symbols(self) -> tuple[str, ...]:
        with self._lock:
            return tuple(self._pins)

    @property
    def quiet_symbols(self) -> tuple[str, ...]:
        """Locally hidden symbols; independent from generated Quiet Removed."""
        with self._lock:
            return tuple(self._quiet_symbols)

    def is_quiet(self, symbol: str) -> bool:
        normalized = _normalize_symbol(symbol)
        with self._lock:
            return normalized in self._quiet_symbols

    def set_quiet(self, symbol: str, quiet: bool = True) -> bool:
        """Quiet/unquiet one symbol locally; return whether state changed."""
        if not isinstance(quiet, bool):
            raise ValueError("quiet must be a boolean")
        normalized = _normalize_symbol(symbol)
        with self._lock:
            current = normalized in self._quiet_symbols
            if current == quiet:
                return False
            previous = list(self._quiet_symbols)
            if quiet:
                if len(self._quiet_symbols) >= MAX_QUIET_SYMBOLS:
                    raise ValueError(f"A maximum of {MAX_QUIET_SYMBOLS} locally quieted symbols is allowed")
                self._quiet_symbols.append(normalized)
            else:
                self._quiet_symbols.remove(normalized)
            try:
                self._save()
            except Exception:
                self._quiet_symbols = previous
                raise
            return True

    def quiet_symbol(self, symbol: str) -> bool:
        return self.set_quiet(symbol, True)

    def unquiet_symbol(self, symbol: str) -> bool:
        return self.set_quiet(symbol, False)

    def get_group(self, group_id: str) -> WatchlistGroup:
        with self._lock:
            return self._groups[self._group_index(group_id)]

    def create_group(self, name: str, symbols: Iterable[str] = ()) -> WatchlistGroup:
        group = WatchlistGroup(uuid.uuid4().hex, _normalize_name(name), _normalize_symbols(symbols, limit=MAX_SYMBOLS_PER_GROUP))
        with self._lock:
            if len(self._groups) >= MAX_GROUPS:
                raise ValueError(f"A maximum of {MAX_GROUPS} groups is allowed")
            self._assert_unique_name(group.name)
            self._groups.append(group)
            self._save()
            return group

    def rename_group(self, group_id: str, name: str) -> WatchlistGroup:
        clean_name = _normalize_name(name)
        with self._lock:
            index = self._group_index(group_id)
            self._assert_unique_name(clean_name, excluding=group_id)
            updated = WatchlistGroup(group_id, clean_name, self._groups[index].symbols)
            self._groups[index] = updated
            self._save()
            return updated

    def delete_group(self, group_id: str) -> bool:
        with self._lock:
            index = next((i for i, group in enumerate(self._groups) if group.id == group_id), None)
            if index is None:
                return False
            del self._groups[index]
            self._save()
            return True

    def set_symbols(self, group_id: str, symbols: Iterable[str]) -> WatchlistGroup:
        clean = _normalize_symbols(symbols, limit=MAX_SYMBOLS_PER_GROUP)
        with self._lock:
            index = self._group_index(group_id)
            group = WatchlistGroup(group_id, self._groups[index].name, clean)
            self._groups[index] = group
            self._save()
            return group

    def add_symbol(self, group_id: str, symbol: str, index: int | None = None) -> WatchlistGroup:
        normalized = _normalize_symbol(symbol)
        with self._lock:
            current = self._groups[self._group_index(group_id)]
            symbols = list(current.symbols)
            if normalized in symbols:
                return current
            if len(symbols) >= MAX_SYMBOLS_PER_GROUP:
                raise ValueError(f"A maximum of {MAX_SYMBOLS_PER_GROUP} symbols per group is allowed")
            position = len(symbols) if index is None else index
            if not isinstance(position, int) or isinstance(position, bool) or not 0 <= position <= len(symbols):
                raise ValueError("index must be between zero and the current symbol count")
            symbols.insert(position, normalized)
            return self.set_symbols(group_id, symbols)

    def remove_symbol(self, group_id: str, symbol: str) -> bool:
        normalized = _normalize_symbol(symbol)
        with self._lock:
            current = self._groups[self._group_index(group_id)]
            if normalized not in current.symbols:
                return False
            self.set_symbols(group_id, [item for item in current.symbols if item != normalized])
            return True

    def reorder_symbols(self, group_id: str, symbols: Iterable[str]) -> WatchlistGroup:
        requested = _normalize_symbols(symbols, limit=MAX_SYMBOLS_PER_GROUP)
        with self._lock:
            current = self._groups[self._group_index(group_id)]
            if len(requested) != len(current.symbols) or set(requested) != set(current.symbols):
                raise ValueError("Reorder must contain every existing symbol exactly once")
            return self.set_symbols(group_id, requested)

    def reorder_groups(self, group_ids: Iterable[str]) -> tuple[WatchlistGroup, ...]:
        requested = tuple(group_ids)
        with self._lock:
            existing = {group.id: group for group in self._groups}
            if len(requested) != len(existing) or set(requested) != set(existing):
                raise ValueError("Reorder must contain every existing group exactly once")
            self._groups = [existing[group_id] for group_id in requested]
            self._save()
            return tuple(self._groups)

    def pin_symbol(self, symbol: str, index: int | None = None) -> tuple[str, ...]:
        normalized = _normalize_symbol(symbol)
        with self._lock:
            if normalized in self._pins:
                return tuple(self._pins)
            if len(self._pins) >= MAX_PINNED_SYMBOLS:
                raise ValueError(f"A maximum of {MAX_PINNED_SYMBOLS} pinned symbols is allowed")
            position = len(self._pins) if index is None else index
            if not isinstance(position, int) or isinstance(position, bool) or not 0 <= position <= len(self._pins):
                raise ValueError("index must be between zero and the current pin count")
            self._pins.insert(position, normalized)
            self._save()
            return tuple(self._pins)

    def unpin_symbol(self, symbol: str) -> bool:
        normalized = _normalize_symbol(symbol)
        with self._lock:
            if normalized not in self._pins:
                return False
            self._pins.remove(normalized)
            self._save()
            return True

    def reorder_pins(self, symbols: Iterable[str]) -> tuple[str, ...]:
        requested = _normalize_symbols(symbols, limit=MAX_PINNED_SYMBOLS)
        with self._lock:
            if len(requested) != len(self._pins) or set(requested) != set(self._pins):
                raise ValueError("Reorder must contain every pinned symbol exactly once")
            self._pins = list(requested)
            self._save()
            return tuple(self._pins)

    def _group_index(self, group_id: str) -> int:
        for index, group in enumerate(self._groups):
            if group.id == group_id:
                return index
        raise KeyError(f"Unknown watchlist group: {group_id}")

    def _assert_unique_name(self, name: str, excluding: str | None = None) -> None:
        folded = name.casefold()
        if any(group.id != excluding and group.name.casefold() == folded for group in self._groups):
            raise ValueError(f"A watchlist group named {name!r} already exists")

    def _load(self) -> None:
        try:
            if self.path.stat().st_size > MAX_FILE_BYTES:
                self.load_error = "Saved watchlist organization exceeds the 64 KiB safety limit."
                return
            payload = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(payload, dict) or payload.get("version") != 1:
                self.load_error = "Saved watchlist organization has an unsupported format."
                return
            raw_groups = payload.get("groups")
            raw_pins = payload.get("pinned_symbols")
            if not isinstance(raw_groups, list) or len(raw_groups) > MAX_GROUPS or not isinstance(raw_pins, list):
                self.load_error = "Saved watchlist organization has invalid collections."
                return
            groups: list[WatchlistGroup] = []
            for raw in raw_groups:
                if not isinstance(raw, dict) or set(raw) != {"id", "name", "symbols"}:
                    self.load_error = "Saved watchlist organization has an invalid group record."
                    return
                if not isinstance(raw["symbols"], list):
                    self.load_error = "Saved watchlist organization has invalid group symbols."
                    return
                group_id = raw["id"]
                if not isinstance(group_id, str) or not group_id or len(group_id) > 64:
                    self.load_error = "Saved watchlist organization has an invalid group ID."
                    return
                symbols = _normalize_symbols(raw["symbols"], limit=MAX_SYMBOLS_PER_GROUP)
                groups.append(WatchlistGroup(group_id, _normalize_name(raw["name"]), symbols))
            if len({group.id for group in groups}) != len(groups):
                self.load_error = "Saved watchlist organization has duplicate group IDs."
                return
            if len({group.name.casefold() for group in groups}) != len(groups):
                self.load_error = "Saved watchlist organization has duplicate group names."
                return
            if not isinstance(raw_pins, list):
                self.load_error = "Saved watchlist organization has invalid pins."
                return
            pins = _normalize_symbols(raw_pins, limit=MAX_PINNED_SYMBOLS)
            raw_quiet = payload.get("quiet_symbols", [])
            if not isinstance(raw_quiet, list):
                self.load_error = "Saved local quiet-symbol list is invalid."
                return
            quiet_symbols = _normalize_symbols(raw_quiet, limit=MAX_QUIET_SYMBOLS)
            self._groups, self._pins, self._quiet_symbols = groups, list(pins), list(quiet_symbols)
        except (OSError, UnicodeError, json.JSONDecodeError, TypeError, ValueError) as exc:
            # A malformed or oversized profile file should not prevent startup.
            self._groups, self._pins, self._quiet_symbols = [], [], []
            self.load_error = f"{type(exc).__name__}: {exc}"

    def _save(self) -> None:
        if self.load_error:
            raise OSError(
                "Saved watchlist organization could not be loaded; the original file is preserved. "
                "Back it up and repair it before changing groups, pins, or local quiet settings."
            )
        payload = {
            "version": 1,
            "groups": [
                {"id": group.id, "name": group.name, "symbols": list(group.symbols)}
                for group in self._groups
            ],
            "pinned_symbols": self._pins,
            "quiet_symbols": self._quiet_symbols,
        }
        encoded = json.dumps(payload, indent=2, sort_keys=True) + "\n"
        if len(encoded.encode("utf-8")) > MAX_FILE_BYTES:
            raise ValueError("Watchlist organization data exceeds the file size limit")
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
