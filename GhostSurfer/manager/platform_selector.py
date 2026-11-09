"""Select the newest Ghost Surfer release supported by a detected system."""

from __future__ import annotations

import argparse
import json
import platform
import shlex
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
    distro_id: str = ""
    distro_name: str = ""
    distro_version: str = ""
    distro_like: tuple[str, ...] = ()


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


def _read_os_release() -> dict[str, str]:
    """Read distro metadata as data; never source or execute os-release."""
    for path in (Path("/etc/os-release"), Path("/usr/lib/os-release")):
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        values: dict[str, str] = {}
        for line in lines:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, raw = line.split("=", 1)
            if not key.replace("_", "").isalnum():
                continue
            try:
                parts = shlex.split(raw, comments=False, posix=True)
                values[key] = parts[0] if parts else ""
            except ValueError:
                values[key] = raw.strip().strip("\"").strip("'")
        return values
    return {}


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
        os_release = _read_os_release()
        return Target(
            "linux",
            machine,
            _version(os_release.get("VERSION_ID", "")),
            libc_name=libc_name.casefold(),
            libc_version=_version(libc_version),
            distro_id=os_release.get("ID", "").casefold(),
            distro_name=os_release.get("PRETTY_NAME") or os_release.get("NAME", ""),
            distro_version=os_release.get("VERSION_ID", ""),
            distro_like=tuple(item.casefold() for item in os_release.get("ID_LIKE", "").split()),
        )
    return Target(system or "unknown", machine)


def _linux_target_match(release: dict[str, Any], target: Target) -> tuple[int, str | None, str | None]:
    """Return priority, warning, and reason for explicit derivative groups."""
    groups = release.get("compatibleTargets")
    if not isinstance(groups, list) or not groups:
        return 0, release.get("compatibilityNote") or "This Linux derivative is not listed as verified for this release.", None

    best: tuple[int, str | None, str | None] | None = None
    for group in groups:
        if not isinstance(group, dict):
            continue
        ids = {str(value).casefold() for value in group.get("distroIds", [])}
        families = {str(value).casefold() for value in group.get("distroFamilies", [])}
        is_exact = bool(target.distro_id and target.distro_id in ids)
        is_family = bool(families.intersection(target.distro_like) or target.distro_id in families)
        is_fallback = bool(group.get("fallback"))
        if not (is_exact or is_family or is_fallback):
            continue

        version_limits = group.get("minimumVersions", {})
        required_version = version_limits.get(target.distro_id, "") if isinstance(version_limits, dict) else ""
        if not required_version:
            for family in target.distro_like:
                if isinstance(version_limits, dict) and version_limits.get(family):
                    required_version = version_limits[family]
                    break
        if required_version and target.distro_version and _version(target.distro_version) < _version(required_version):
            continue
        maximum_versions = group.get("maximumVersions", {})
        maximum_version = maximum_versions.get(target.distro_id, "") if isinstance(maximum_versions, dict) else ""
        if not maximum_version:
            for family in target.distro_like:
                if isinstance(maximum_versions, dict) and maximum_versions.get(family):
                    maximum_version = maximum_versions[family]
                    break
        if maximum_version and target.distro_version and _version(target.distro_version) > _version(maximum_version):
            continue
        minimum_glibc = _version(group.get("minimumGlibc", "0"))
        if minimum_glibc != _version("0") and target.libc_version and target.libc_version < minimum_glibc:
            continue

        verified = bool(group.get("verified"))
        specificity = 300 if is_exact else 200 if is_family else 0
        priority = (1000 if verified else 0) + specificity
        warning = None
        if not verified:
            warning = group.get("warning") or release.get("compatibilityNote") or "This Linux derivative is not verified for this release."
        candidate = (priority, warning, None)
        if best is None or candidate[0] > best[0]:
            best = candidate

    if best is not None:
        return best
    identity = target.distro_id or "unknown Linux derivative"
    family = ", ".join(target.distro_like)
    label = f"{identity} ({family})" if family else identity
    return -1, None, f"No compatible release target is configured for {label}."


def _release_compatibility(release: dict[str, Any], target: Target) -> tuple[bool, str | None, int, str | None]:
    minimum = release.get("minimum", {})
    priority = 0
    warning = None
    if target.platform == "windows":
        required_build = int(minimum.get("windowsBuild", 0))
        if required_build and target.build < required_build:
            return False, f"Windows build {required_build} or newer is required.", -1, None
    elif target.platform == "macos":
        required = _version(minimum.get("macOS", "0"))
        if required and _version(target.version) < required:
            return False, f"macOS {'.'.join(map(str, required))} or newer is required.", -1, None
    elif target.platform == "linux":
        required_arch = _arch(str(minimum.get("architecture", "")))
        if required_arch and target.architecture != required_arch:
            return False, f"This release requires {required_arch}.", -1, None
        if target.libc_name and target.libc_name != "glibc":
            return False, "This release requires glibc; musl-based systems are not supported.", -1, None
        required_glibc = _version(minimum.get("glibc", "0"))
        if required_glibc and target.libc_version and target.libc_version < required_glibc:
            return False, f"glibc {'.'.join(map(str, required_glibc))} or newer is required.", -1, None
        priority, warning, reason = _linux_target_match(release, target)
        if reason:
            return False, reason, -1, None

    architectures = {_arch(str(item)) for item in release.get("architectures", [])}
    if architectures and target.architecture not in architectures:
        return False, f"This release does not support {target.architecture}.", -1, None
    return True, None, priority, warning


def select_release(manifest: dict[str, Any], target: Target) -> dict[str, Any]:
    """Return the newest compatible release or raise ValueError with a reason."""
    platform_info = manifest.get("platforms", {}).get(target.platform)
    if not platform_info:
        raise ValueError(f"Ghost Surfer has no release for {target.platform}.")
    supported_architectures = {_arch(str(item)) for item in platform_info.get("architectures", [])}
    if supported_architectures and target.architecture not in supported_architectures:
        raise ValueError(f"Ghost Surfer does not currently support {target.architecture} on {target.platform}.")

    releases = platform_info.get("releases", [])
    reasons: list[str] = []
    compatible: list[tuple[int, tuple[int, ...], dict[str, Any], str | None]] = []
    for release in releases:
        allowed, reason, priority, warning = _release_compatibility(release, target)
        if allowed:
            compatible.append((priority, _version(release.get("version", "0")), release, warning))
        if reason:
            reasons.append(reason)

    if compatible:
        _priority, _version_tuple, release, warning = max(compatible, key=lambda item: (item[0], item[1]))
        selected = dict(release)
        selected["platform"] = target.platform
        selected["compatibilityWarning"] = warning
        if target.platform == "linux":
            tested_glibc = _version(release.get("tested", {}).get("glibc", "0"))
            if tested_glibc != _version("0") and (not target.libc_version or target.libc_version < tested_glibc):
                selected["compatibilityWarning"] = selected["compatibilityWarning"] or release.get("compatibilityNote")
        selected["detectedSystem"] = {
            "architecture": target.architecture,
            "distributionId": target.distro_id or None,
            "distributionName": target.distro_name or None,
            "distributionVersion": target.distro_version or None,
            "distributionLike": list(target.distro_like),
            "libc": target.libc_name or None,
            "libcVersion": ".".join(map(str, target.libc_version)) if target.libc_version else None,
        }
        return selected

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
            "distributionId": target.distro_id or None,
            "distributionName": target.distro_name or None,
            "distributionVersion": target.distro_version or None,
            "distributionLike": list(target.distro_like),
        },
        "release": selected,
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
