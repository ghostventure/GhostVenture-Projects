"""Private, validated backups for Timmy's local UI preferences.

This deliberately handles only the UI preferences JSON. Broker credentials live
in a separate profile file and are never copied by this helper.
"""
from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

_MAX_SETTINGS_BYTES = 1_000_000


def backup_ui_settings(settings_path: str | Path, backup_dir: str | Path) -> Path:
    """Validate and atomically copy preferences to a private timestamped file."""
    source = Path(settings_path).expanduser()
    destination_dir = Path(backup_dir).expanduser()
    raw = source.read_bytes()
    if len(raw) > _MAX_SETTINGS_BYTES:
        raise ValueError("UI preferences exceed the 1 MB backup limit")
    payload = json.loads(raw.decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("UI preferences must contain a JSON object")
    return _write_backup(raw, destination_dir, "timmy-ui-settings")


def backup_raw_ui_settings(settings_path: str | Path, backup_dir: str | Path) -> Path:
    """Preserve unreadable preferences byte-for-byte without parsing or saving."""
    source = Path(settings_path).expanduser()
    destination_dir = Path(backup_dir).expanduser()
    raw = source.read_bytes()
    if len(raw) > _MAX_SETTINGS_BYTES:
        raise ValueError("UI preferences exceed the 1 MB backup limit")
    if not raw:
        raise ValueError("UI preferences file is empty")
    return _write_backup(raw, destination_dir, "timmy-ui-settings-recovery")


def _write_backup(raw: bytes, destination_dir: Path, prefix: str) -> Path:
    destination_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    target = destination_dir / f"{prefix}-{stamp}.json"
    fd, temp_name = tempfile.mkstemp(prefix=".timmy-ui-settings-", dir=destination_dir)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temp_name, 0o600)
        os.replace(temp_name, target)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
    return target
