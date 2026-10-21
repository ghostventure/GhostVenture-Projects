"""Validated, JSON-ready scanner view state; intentionally has no I/O or GUI."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, Mapping


_NAME_RE = re.compile(r"^[^\x00-\x1f]{1,48}$")
_COLUMN_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]{0,39}$")
_MAX_COLUMNS = 50


@dataclass(frozen=True)
class ScannerViewState:
    """A named scanner presentation preset, with columns ordered left to right."""

    name: str
    columns: tuple[str, ...]
    visible_columns: frozenset[str]
    sort_column: str
    descending: bool = True

    @property
    def visible_order(self) -> tuple[str, ...]:
        return tuple(column for column in self.columns if column in self.visible_columns)


def make_scanner_view(
    name: str,
    columns: Iterable[str],
    visible_columns: Iterable[str],
    sort_column: str,
    descending: bool = True,
    *,
    allowed_columns: Iterable[str],
) -> ScannerViewState:
    """Validate a view against the scanner's current column identifiers."""

    allowed = _validated_allowed(allowed_columns)
    clean_name = str(name).strip()
    if not _NAME_RE.fullmatch(clean_name):
        raise ValueError("View name must be 1 to 48 printable characters.")
    if not isinstance(descending, bool):
        raise ValueError("Sort direction must be a boolean.")
    order = _unique_columns(columns, allowed)
    visible = frozenset(_unique_columns(visible_columns, allowed))
    sort = str(sort_column).strip()
    if sort not in allowed:
        raise ValueError(f"Unknown scanner sort column: {sort}")
    if not order:
        raise ValueError("A scanner view must include at least one column.")
    if not visible:
        raise ValueError("A scanner view must show at least one column.")
    if not visible.issubset(order):
        raise ValueError("Visible columns must also appear in the saved column order.")
    if sort not in visible:
        raise ValueError("The sort column must be visible in the saved view.")
    return ScannerViewState(clean_name, order, visible, sort, descending)


def scanner_view_to_dict(view: ScannerViewState) -> dict[str, object]:
    """Return a JSON-serializable representation suitable for a settings store."""

    return {
        "name": view.name,
        "columns": list(view.columns),
        "visible_columns": [column for column in view.columns if column in view.visible_columns],
        "sort_column": view.sort_column,
        "descending": view.descending,
    }


def scanner_view_from_dict(
    payload: Mapping[str, object], *, allowed_columns: Iterable[str]
) -> ScannerViewState:
    """Load and validate a saved representation; unknown columns are rejected."""

    if not isinstance(payload, Mapping):
        raise ValueError("Saved scanner view must be a mapping.")
    columns = payload.get("columns")
    visible = payload.get("visible_columns")
    if not isinstance(columns, (list, tuple)) or not isinstance(visible, (list, tuple)):
        raise ValueError("Saved scanner view is missing its column order or visibility list.")
    descending = payload.get("descending", True)
    if not isinstance(descending, bool):
        raise ValueError("Saved scanner sort direction must be boolean.")
    return make_scanner_view(
        str(payload.get("name", "")),
        columns,
        visible,
        str(payload.get("sort_column", "")),
        descending,
        allowed_columns=allowed_columns,
    )


def _validated_allowed(columns: Iterable[str]) -> frozenset[str]:
    allowed: list[str] = []
    for raw in columns:
        column = str(raw).strip()
        if not _COLUMN_RE.fullmatch(column):
            raise ValueError(f"Invalid scanner column identifier: {column}")
        if column not in allowed:
            allowed.append(column)
    if not allowed or len(allowed) > _MAX_COLUMNS:
        raise ValueError(f"Allowed columns must contain between 1 and {_MAX_COLUMNS} identifiers.")
    return frozenset(allowed)


def _unique_columns(columns: Iterable[str], allowed: frozenset[str]) -> tuple[str, ...]:
    result: list[str] = []
    for raw in columns:
        column = str(raw).strip()
        if column not in allowed:
            raise ValueError(f"Unknown scanner column: {column}")
        if column not in result:
            result.append(column)
        if len(result) > _MAX_COLUMNS:
            raise ValueError(f"At most {_MAX_COLUMNS} scanner columns are supported.")
    return tuple(result)
