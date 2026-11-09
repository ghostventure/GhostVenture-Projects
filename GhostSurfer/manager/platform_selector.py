"""Select the newest Ghost Surfer release supported by a detected system."""

from __future__ import annotations

import platform
import json
import argparse
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen

MANIFEST_URL = "https://ghost-surfer-browser.web.app/downloads/installer-manifest.json"
MAX_MANIFEST_BYTES = 1024 * 1024


@dataclass(frozen=True)
class Target:
    platform: str
    architecture: str
    version: tuple[int, ...] = ()
    build: int = 0
    libc_name: str = ""
    libc_version: tuple[int, ...] = ()


def _version(value: str | tuple[int, ...] | list[int]) -> tuple[int, ...]:
    if isinstance(value, tuple):
        result = list(value)
    elif isinstance(value, list):
        result = [int(part) for part in value]
    else:
        result = []
        for part in str(value).split("."):
            digits = "".join(char for char in part if char.isdigit())
            if not digits:
                break
            result.append(int(digits))
    return tuple((result + [0, 0, 0, 0])[:4])


def _arch(value: str) -> str:
    normalized = value.casefold().replace("-", "_")
    if normalized in {"amd64", "x64", "x86_64"}:
        return "x86_64"
    if normalized in {"arm64", "aarch64"}:
        return "arm64"
    return normalized


def detect_target() -> Target:
    system = platform.system().casefold()
    machine = _arch(platform.machine())
    if system == "windows":
        version = sys.getwindowsversion()
        return Target("windows", machine, (version.major, version.minor), int(version.build))
    if system == "darwin":
        return Target("macos", machine, _version(platform.mac_ver()[0]))
    if system == "linux":
        libc_name, libc_version = platform.libc_ver()
        return Target("linux", machine, libc_name=libc_name.casefold(), libc_version=_version(libc_version))
    return Target(system or "unknown", machine)


def _release_compatibility(release: dict[str, Any], target: Target) -> tuple[bool, str | None]:
    minimum = release.get("minimum", {})
    if target.platform == "windows":
        required_build = int(minimum.get("windowsBuild", 0))
        if required_build and target.build < required_build:
            return False, f"Windows build {required_build} or newer is required."
    elif target.platform == "macos":
        required = _version(minimum.get("macOS", "0"))
        if required and _version(target.version) < required:
            return False, f"macOS {'.'.join(map(str, required))} or newer is required."
    elif target.platform == "linux":
        required_arch = _arch(str(minimum.get("architecture", "")))
        if required_arch and target.architecture != required_arch:
            return False, f"This release requires {required_arch}."
        if target.libc_name and target.libc_name != "glibc":
            return False, "This release requires glibc; musl-based systems are not supported."
        required_glibc = _version(minimum.get("glibc", "0"))
        if required_glibc and target.libc_version and target.libc_version < required_glibc:
            return False, f"glibc {'.'.join(map(str, required_glibc))} or newer is required."

    architectures = {_arch(str(item)) for item in release.get("architectures", [])}
    if architectures and target.architecture not in architectures:
        return False, f"This release does not support {target.architecture}."
    return True, None


def select_release(manifest: dict[str, Any], target: Target) -> dict[str, Any]:
    """Return the newest compatible release or raise ValueError with a reason."""
    platform_info = manifest.get("platforms", {}).get(target.platform)
    if not platform_info:
        raise ValueError(f"Ghost Surfer has no release for {target.platform}.")
    supported_architectures = {_arch(str(item)) for item in platform_info.get("architectures", [])}
    if supported_architectures and target.architecture not in supported_architectures:
        raise ValueError(f"Ghost Surfer does not currently support {target.architecture} on {target.platform}.")

    releases = sorted(
        platform_info.get("releases", []),
        key=lambda item: _version(item.get("version", "0")),
        reverse=True,
    )
    reasons: list[str] = []
    for release in releases:
        allowed, reason = _release_compatibility(release, target)
        if allowed:
            selected = dict(release)
            selected["platform"] = target.platform
            selected["compatibilityWarning"] = None
            if target.platform == "linux":
                tested_glibc = _version(release.get("tested", {}).get("glibc", "0"))
                if tested_glibc and (not target.libc_version or target.libc_version < tested_glibc):
                    selected["compatibilityWarning"] = release.get("compatibilityNote")
            return selected
        if reason:
            reasons.append(reason)

    detail = " ".join(dict.fromkeys(reasons))
    raise ValueError(detail or f"No compatible {target.platform} release is available.")


def load_manifest(source: str) -> dict[str, Any]:
    parsed = urlparse(source)
    if parsed.scheme in {"http", "https"}:
        if parsed.scheme != "https":
            raise ValueError("The release manifest must be loaded over HTTPS.")
        request = Request(source, headers={"User-Agent": "GhostSurfer-Installation-Manager"})
        with urlopen(request, timeout=15) as response:
            if urlparse(response.geturl()).scheme != "https":
                raise ValueError("The release manifest redirected away from HTTPS.")
            body = response.read(MAX_MANIFEST_BYTES + 1)
    else:
        body = Path(source).read_bytes()
    if len(body) > MAX_MANIFEST_BYTES:
        raise ValueError("The release manifest exceeds the 1 MiB safety limit.")
    manifest = json.loads(body.decode("utf-8"))
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != 1 or not isinstance(manifest.get("platforms"), dict):
        raise ValueError("The release manifest has an unsupported schema.")
    for platform_name, platform_info in manifest["platforms"].items():
        if not isinstance(platform_info, dict) or not isinstance(platform_info.get("releases"), list):
            raise ValueError(f"The release manifest has invalid data for {platform_name}.")
        for release in platform_info["releases"]:
            if not isinstance(release, dict) or not isinstance(release.get("artifact"), dict):
                raise ValueError(f"The release manifest has an invalid release for {platform_name}.")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Select the newest Ghost Surfer release compatible with this system.")
    parser.add_argument("--manifest", default=MANIFEST_URL, help="HTTPS manifest URL or local manifest path")
    args = parser.parse_args()
    try:
        manifest = load_manifest(args.manifest)
        target = detect_target()
        selected = select_release(manifest, target)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(json.dumps({"supported": False, "reason": str(error)}, indent=2))
        return 1

    result = {
        "supported": True,
        "target": {
            "platform": target.platform,
            "architecture": target.architecture,
            "version": ".".join(map(str, target.version)) or None,
            "build": target.build or None,
            "libc": target.libc_name or None,
            "libcVersion": ".".join(map(str, target.libc_version)) or None,
        },
        "release": selected,
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
