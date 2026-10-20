from __future__ import annotations

import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path


_SAFE_CONFIG_FILES = ("timmy-ui-settings.json", "watchlist.txt", "active-watchlist.txt", "watchlist-symbol-notes.json")
_SECRET_LINE = re.compile(r"(?i)^\s*(?:WEBULL_.*(?:KEY|SECRET|TOKEN|ACCOUNT)|.*(?:PASSWORD|PASSWD|TOKEN|APP_SECRET|APP_KEY))\s*=.*$")
_SECRET_VALUE = re.compile(
    r"(?i)([\"']?(?:app[_-]?key|app[_-]?secret|password|passwd|token|account[_-]?id|authorization|bearer)[\"']?)(\s*[:=]\s*)([\"']?)([^\"'\s,;}{]+)"
)


def create_config_backup(home: str | Path, output: str | Path) -> Path:
    """Back up only non-secret UI/watchlist settings; never includes broker profiles."""
    home, output = Path(home), Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        manifest = {"created_at": datetime.now(timezone.utc).isoformat(), "files": []}
        for name in _SAFE_CONFIG_FILES:
            source = home / name
            if source.is_file():
                if name == "timmy-ui-settings.json":
                    settings = json.loads(source.read_text(encoding="utf-8"))
                    settings.pop("selected_webull_account_id", None)
                    archive.writestr(name, json.dumps(settings, indent=2, sort_keys=True) + "\n")
                else:
                    archive.write(source, name)
                manifest["files"].append(name)
        archive.writestr("manifest.json", json.dumps(manifest, indent=2))
    output.chmod(0o600)
    return output


def restore_config_backup(home: str | Path, archive_path: str | Path) -> list[str]:
    """Restore allowlisted non-secret settings after validating every archive path."""
    home, archive_path = Path(home), Path(archive_path)
    restored: list[str] = []
    with zipfile.ZipFile(archive_path) as archive:
        names = archive.namelist()
        if any(Path(name).name != name or name not in {*_SAFE_CONFIG_FILES, "manifest.json"} for name in names):
            raise ValueError("Backup contains an unsupported file path or filename")
        if any(info.file_size > 2_000_000 for info in archive.infolist()):
            raise ValueError("Backup file is larger than the allowed 2 MB limit")
        payloads = {name: archive.read(name) for name in _SAFE_CONFIG_FILES if name in names}
        for name, payload in payloads.items():
            if name.endswith(".json"):
                json.loads(payload.decode("utf-8"))
        for name in _SAFE_CONFIG_FILES:
            if name not in payloads:
                continue
            target = home / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payloads[name])
            target.chmod(0o600)
            restored.append(name)
    return restored


def create_support_bundle(home: str | Path, output: str | Path) -> Path:
    """Collect a small, explicitly allowlisted diagnostics archive with secrets redacted."""
    home, output = Path(home), Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    allowed = ("timmy-crash.log", "timmy-ui-settings.json", "timmy-watchlist-rotation.json")
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("bundle-info.json", json.dumps({
            "created_at": datetime.now(timezone.utc).isoformat(),
            "included": [name for name in allowed if (home / name).is_file()],
            "omitted": ["broker credentials", "account profile", "trade journal", "execution history"],
        }, indent=2))
        for name in allowed:
            source = home / name
            if not source.is_file():
                continue
            text = source.read_text(encoding="utf-8", errors="replace")
            lines = ["[REDACTED SECRET SETTING]" if _SECRET_LINE.match(line) else _SECRET_VALUE.sub(r"\1\2\3[REDACTED]", line) for line in text.splitlines()]
            archive.writestr(name, "\n".join(lines) + ("\n" if lines else ""))
    output.chmod(0o600)
    return output
