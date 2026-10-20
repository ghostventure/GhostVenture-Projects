"""Validated shortcut help registry for future native-GUI integration."""

from __future__ import annotations

import re
from dataclasses import dataclass


_ACTION_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,63}$")
_KEY_RE = re.compile(r"^(?:[A-Za-z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Enter|Escape|Esc|Space|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Up|Down|Left|Right|Plus|Minus|Comma|Period|Slash)$", re.IGNORECASE)
_MODIFIERS = {"ctrl", "control", "alt", "shift", "super", "cmd", "meta"}


@dataclass(frozen=True)
class ShortcutHelpItem:
    group: str
    key: str
    action: str
    description: str


class ShortcutHelpRegistry:
    """In-memory catalog; it documents bindings but does not bind GUI events."""

    def __init__(self) -> None:
        self._items: dict[tuple[str, str], ShortcutHelpItem] = {}

    def register(self, group: str, key: str, action: str, description: str) -> ShortcutHelpItem:
        clean_group = str(group).strip()
        clean_action = str(action).strip()
        clean_description = str(description).strip()
        clean_key = _normalize_key(key)
        if not clean_group or len(clean_group) > 40:
            raise ValueError("Shortcut group must be 1 to 40 characters.")
        if not _ACTION_RE.fullmatch(clean_action):
            raise ValueError("Action id contains unsupported characters or is too long.")
        if not clean_description or len(clean_description) > 160:
            raise ValueError("Description must be 1 to 160 characters.")
        identity = (clean_group.casefold(), clean_action.casefold())
        collision = next(
            (existing for key, existing in self._items.items()
             if key[0] == identity[0] and key != identity and existing.key.casefold() == clean_key.casefold()),
            None,
        )
        if collision is not None:
            raise ValueError(f"Shortcut {clean_key} is already listed for {collision.action} in {clean_group}.")
        item = ShortcutHelpItem(clean_group, clean_key, clean_action, clean_description)
        self._items[identity] = item
        return item

    def unregister(self, action: str, *, group: str | None = None) -> int:
        target = str(action).strip().casefold()
        keys = [key for key in self._items if key[1] == target and (group is None or key[0] == str(group).strip().casefold())]
        for key in keys:
            del self._items[key]
        return len(keys)

    def groups(self) -> list[str]:
        return sorted({item.group for item in self._items.values()}, key=str.casefold)

    def list_items(self, *, group: str | None = None) -> list[ShortcutHelpItem]:
        items = self._items.values()
        if group is not None:
            target = str(group).strip().casefold()
            items = (item for item in items if item.group.casefold() == target)
        return sorted(items, key=lambda item: (item.group.casefold(), item.key.casefold(), item.action.casefold()))

    def search(self, query: str, *, group: str | None = None, limit: int = 30) -> list[ShortcutHelpItem]:
        terms = [part.casefold() for part in str(query).split() if part]
        safe_limit = max(1, min(int(limit), 100))
        matches = []
        for item in self.list_items(group=group):
            searchable = " ".join((item.group, item.key, item.action, item.description)).casefold()
            if all(term in searchable for term in terms):
                matches.append(item)
        return matches[:safe_limit]

    def find_action(self, action: str) -> list[ShortcutHelpItem]:
        target = str(action).strip().casefold()
        return [item for item in self.list_items() if item.action.casefold() == target]


def _normalize_key(value: str) -> str:
    raw_parts = [part.strip() for part in str(value).split("+")]
    if not raw_parts or any(not part for part in raw_parts):
        raise ValueError("Shortcut key must be a key with optional + separated modifiers.")
    modifiers: list[str] = []
    key = ""
    for part in raw_parts:
        if part.casefold() in _MODIFIERS:
            normalized = {"control": "Ctrl", "ctrl": "Ctrl", "cmd": "Cmd", "meta": "Meta", "super": "Super", "alt": "Alt", "shift": "Shift"}[part.casefold()]
            if normalized.casefold() in {item.casefold() for item in modifiers}:
                raise ValueError("Shortcut cannot repeat a modifier.")
            modifiers.append(normalized)
        elif not key and _KEY_RE.fullmatch(part):
            key = _canonical_key(part)
        else:
            raise ValueError(f"Unsupported shortcut key: {part}")
    if not key:
        raise ValueError("Shortcut must include one non-modifier key.")
    return "+".join([*modifiers, key])


def _canonical_key(value: str) -> str:
    names = {
        "enter": "Enter", "escape": "Escape", "esc": "Esc", "space": "Space", "tab": "Tab",
        "backspace": "Backspace", "delete": "Delete", "insert": "Insert", "home": "Home", "end": "End",
        "pageup": "PageUp", "pagedown": "PageDown", "up": "Up", "down": "Down", "left": "Left",
        "right": "Right", "plus": "Plus", "minus": "Minus", "comma": "Comma", "period": "Period", "slash": "Slash",
    }
    return names.get(value.casefold(), value.upper() if len(value) == 1 else value.upper())
