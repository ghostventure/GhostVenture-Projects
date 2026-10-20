"""Private, bounded local notes associated with market symbols."""

from __future__ import annotations

import json
import os
import re
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path


_VERSION = 1
_MAX_FILE_BYTES = 512_000
_MAX_NOTES = 500
_MAX_NOTE_CHARS = 2_000
_MAX_SEARCH_RESULTS = 100
_SYMBOL_RE = re.compile(r"^[A-Z0-9.^_-]{1,24}$")


@dataclass(frozen=True)
class SymbolNote:
    symbol: str
    text: str
    updated_at: str


class SymbolNotesStore:
    """CRUD/search for concise symbol notes stored only under the supplied home.

    The file contains user-authored text, not broker settings or credentials.
    Writes use atomic replacement, a 0600 file mode, and strict size limits.
    """

    def __init__(self, home: str | Path) -> None:
        self.home = Path(home).expanduser()
        self.path = self.home / "timmy-symbol-notes.json"

    def get(self, symbol: str) -> SymbolNote | None:
        key = _normalize_symbol(symbol)
        return self._read().get(key)

    def list_notes(self, *, limit: int = _MAX_NOTES) -> list[SymbolNote]:
        safe_limit = max(1, min(int(limit), _MAX_NOTES))
        notes = sorted(self._read().values(), key=lambda note: (note.updated_at, note.symbol), reverse=True)
        return notes[:safe_limit]

    def save(self, symbol: str, text: str) -> SymbolNote:
        key = _normalize_symbol(symbol)
        body = str(text).strip()
        if not body:
            raise ValueError("Note text cannot be empty; use delete() to remove a note.")
        if len(body) > _MAX_NOTE_CHARS:
            raise ValueError(f"Note text must be {_MAX_NOTE_CHARS} characters or fewer.")
        notes = self._read()
        if key not in notes and len(notes) >= _MAX_NOTES:
            raise ValueError(f"At most {_MAX_NOTES} symbol notes can be saved.")
        note = SymbolNote(key, body, _utc_now())
        notes[key] = note
        self._write(notes)
        return note

    def delete(self, symbol: str) -> bool:
        key = _normalize_symbol(symbol)
        notes = self._read()
        if notes.pop(key, None) is None:
            return False
        self._write(notes)
        return True

    def search(self, query: str, *, limit: int = 20) -> list[SymbolNote]:
        terms = [term.casefold() for term in str(query).split() if term]
        if not terms:
            return []
        safe_limit = max(1, min(int(limit), _MAX_SEARCH_RESULTS))
        matches = [
            note
            for note in self._read().values()
            if all(term in f"{note.symbol} {note.text}".casefold() for term in terms)
        ]
        matches.sort(key=lambda note: (note.updated_at, note.symbol), reverse=True)
        return matches[:safe_limit]

    def _read(self) -> dict[str, SymbolNote]:
        try:
            if self.path.stat().st_size > _MAX_FILE_BYTES:
                return {}
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError, TypeError):
            return {}
        if not isinstance(payload, dict) or payload.get("version") != _VERSION:
            return {}
        raw_notes = payload.get("notes")
        if not isinstance(raw_notes, dict):
            return {}
        notes: dict[str, SymbolNote] = {}
        for symbol, raw in list(raw_notes.items())[:_MAX_NOTES]:
            try:
                key = _normalize_symbol(symbol)
            except ValueError:
                continue
            if not isinstance(raw, dict):
                continue
            text = raw.get("text")
            updated_at = raw.get("updated_at", "")
            if not isinstance(text, str) or not text.strip() or len(text) > _MAX_NOTE_CHARS:
                continue
            if not isinstance(updated_at, str):
                updated_at = ""
            notes[key] = SymbolNote(key, text.strip(), updated_at[:32])
        return notes

    def _write(self, notes: dict[str, SymbolNote]) -> None:
        self.home.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": _VERSION,
            "notes": {
                note.symbol: {"text": note.text, "updated_at": note.updated_at}
                for note in sorted(notes.values(), key=lambda item: item.symbol)
            },
        }
        encoded = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        if len(encoded.encode("utf-8")) > _MAX_FILE_BYTES:
            raise ValueError("Symbol notes exceed the storage limit.")
        fd, temp_name = tempfile.mkstemp(prefix=".timmy-symbol-notes-", dir=self.home)
        temporary = Path(temp_name)
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


def _normalize_symbol(symbol: str) -> str:
    key = str(symbol).strip().upper()
    if not _SYMBOL_RE.fullmatch(key):
        raise ValueError("Symbol must be 1 to 24 letters, digits, or . ^ _ - characters.")
    return key


def _utc_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
