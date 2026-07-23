from __future__ import annotations

import json
import shutil
import time
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path


SENSITIVE_MARKERS = ("SECRET", "PASSWORD", "TOKEN", "ACCOUNT_ID", "APP_KEY", "API_KEY", "USERNAME")
RUNTIME_CONFIG_FILES = (".env", ".timmy-profile.env")


@dataclass(frozen=True)
class SettingsProfileResult:
    path: str
    keys: list[str]
    skipped_sensitive: list[str]


@dataclass(frozen=True)
class ConfigVersion:
    version_id: str
    label: str
    created_at: str
    files: dict[str, str]
    path: str


def export_settings(
    home: str | Path,
    destination: str | Path,
    include_sensitive: bool = False,
    files: tuple[str, ...] = RUNTIME_CONFIG_FILES,
) -> SettingsProfileResult:
    home_path = Path(home).expanduser().resolve()
    destination_path = Path(destination).expanduser().resolve()
    keys: list[str] = []
    skipped: list[str] = []
    payload = {"version": 1, "settings": {}}

    for filename in files:
        values = read_env_file(home_path / filename)
        public_values = {}
        for key, value in values.items():
            if is_sensitive_key(key) and not include_sensitive:
                skipped.append(key)
                continue
            public_values[key] = value
            keys.append(key)
        if public_values:
            payload["settings"][filename] = public_values

    _write_private_text(destination_path, json.dumps(payload, indent=2, sort_keys=True) + "\n")
    return SettingsProfileResult(str(destination_path), sorted(keys), sorted(set(skipped)))


def import_settings(
    home: str | Path,
    source: str | Path,
    allow_sensitive: bool = False,
    create_version: bool = True,
) -> SettingsProfileResult:
    home_path = Path(home).expanduser().resolve()
    source_path = Path(source).expanduser().resolve()
    payload = json.loads(source_path.read_text(encoding="utf-8"))
    settings = payload.get("settings", {})
    if not isinstance(settings, dict):
        raise ValueError("Settings profile is missing a settings map.")
    if create_version:
        create_config_version(home_path, "before-import")

    written: list[str] = []
    skipped: list[str] = []
    for filename, values in settings.items():
        if filename not in RUNTIME_CONFIG_FILES or not isinstance(values, dict):
            continue
        target_values = read_env_file(home_path / filename)
        for key, value in values.items():
            key = str(key).strip()
            if not key:
                continue
            if is_sensitive_key(key) and not allow_sensitive:
                skipped.append(key)
                continue
            target_values[key] = str(value)
            written.append(key)
        write_env_file(home_path / filename, target_values)

    return SettingsProfileResult(str(source_path), sorted(written), sorted(set(skipped)))


def create_config_version(home: str | Path, label: str = "manual") -> ConfigVersion:
    home_path = Path(home).expanduser().resolve()
    versions_dir = home_path / ".timmy-config-versions"
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    base_version_id = f"{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}-{_slug(label)}"
    version_id = base_version_id
    target_dir = versions_dir / version_id
    suffix = 2
    while target_dir.exists():
        version_id = f"{base_version_id}-{suffix}"
        target_dir = versions_dir / version_id
        suffix += 1
    target_dir.mkdir(parents=True, exist_ok=False)
    versions_dir.chmod(0o700)
    target_dir.chmod(0o700)

    files: dict[str, str] = {}
    for filename in RUNTIME_CONFIG_FILES:
        source = home_path / filename
        if not source.exists():
            continue
        destination = target_dir / filename
        shutil.copy2(source, destination)
        destination.chmod(0o600)
        files[filename] = _sha256_file(destination)

    manifest = ConfigVersion(version_id, label, created_at, files, str(target_dir))
    _write_private_text(target_dir / "manifest.json", json.dumps(manifest.__dict__, indent=2, sort_keys=True) + "\n")
    return manifest


def list_config_versions(home: str | Path) -> list[ConfigVersion]:
    versions_dir = Path(home).expanduser().resolve() / ".timmy-config-versions"
    versions: list[ConfigVersion] = []
    if not versions_dir.exists():
        return versions
    for manifest_path in sorted(versions_dir.glob("*/manifest.json"), reverse=True):
        try:
            payload = json.loads(manifest_path.read_text(encoding="utf-8"))
            versions.append(
                ConfigVersion(
                    version_id=str(payload["version_id"]),
                    label=str(payload.get("label", "")),
                    created_at=str(payload.get("created_at", "")),
                    files={str(key): str(value) for key, value in payload.get("files", {}).items()},
                    path=str(manifest_path.parent),
                )
            )
        except (KeyError, OSError, ValueError, TypeError):
            continue
    return versions


def rollback_config_version(home: str | Path, version_id: str) -> ConfigVersion:
    home_path = Path(home).expanduser().resolve()
    version_dir = home_path / ".timmy-config-versions" / version_id
    payload = json.loads((version_dir / "manifest.json").read_text(encoding="utf-8"))
    manifest = ConfigVersion(
        version_id=str(payload["version_id"]),
        label=str(payload.get("label", "")),
        created_at=str(payload.get("created_at", "")),
        files={str(key): str(value) for key, value in payload.get("files", {}).items()},
        path=str(version_dir),
    )
    create_config_version(home_path, "before-rollback")
    for filename, expected_hash in manifest.files.items():
        if filename not in RUNTIME_CONFIG_FILES:
            continue
        source = version_dir / filename
        if _sha256_file(source) != expected_hash:
            raise ValueError(f"Config version file failed integrity check: {filename}")
        destination = home_path / filename
        shutil.copy2(source, destination)
        destination.chmod(0o600)
    return manifest


def read_env_file(path: str | Path) -> dict[str, str]:
    values: dict[str, str] = {}
    path = Path(path)
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return values
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        if key:
            values[key] = _unquote(value.strip())
    return values


def write_env_file(path: str | Path, values: dict[str, str]) -> None:
    lines = ["# Timmy runtime settings. Keep this file local."]
    for key in sorted(values):
        if key:
            lines.append(f"{key}={_quote(str(values[key]))}")
    _write_private_text(Path(path), "\n".join(lines) + "\n")


def is_sensitive_key(key: str) -> bool:
    upper = key.upper()
    return any(marker in upper for marker in SENSITIVE_MARKERS)


def _write_private_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    path.chmod(0o600)


def _quote(value: str) -> str:
    if not value or any(char.isspace() for char in value) or any(char in value for char in "\"'#"):
        return json.dumps(value)
    return value


def _unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] == '"':
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value[1:-1]
    return value


def _sha256_file(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


def _slug(value: str) -> str:
    text = "".join(char.lower() if char.isalnum() else "-" for char in value.strip())
    return "-".join(part for part in text.split("-") if part)[:40] or "manual"
