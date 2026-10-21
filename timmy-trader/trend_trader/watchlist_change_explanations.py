"""Readable local explanations for generated watchlist membership changes."""
from __future__ import annotations

from collections.abc import Callable, Iterable


def explain_membership_changes(
    label: str,
    previous: Iterable[str],
    current: Iterable[str],
    *,
    added_reason: Callable[[str], str],
    removed_reason: Callable[[str], str],
    limit: int = 8,
) -> list[str]:
    """Describe added/removed symbols using caller-supplied rule explanations."""
    limit = max(1, min(int(limit), 20))
    before = {str(symbol).strip().upper() for symbol in previous if str(symbol).strip()}
    after = {str(symbol).strip().upper() for symbol in current if str(symbol).strip()}
    added = sorted(after - before)
    removed = sorted(before - after)
    if not added and not removed:
        return []
    lines = [f"{label} changes"]
    for symbol in added[:limit]:
        lines.append(f"+ {symbol}: {added_reason(symbol)}")
    if len(added) > limit:
        lines.append(f"  +{len(added) - limit} more additions")
    for symbol in removed[:limit]:
        lines.append(f"− {symbol}: {removed_reason(symbol)}")
    if len(removed) > limit:
        lines.append(f"  +{len(removed) - limit} more removals")
    return lines
