"""Fetch and verify the compatible Ghost Surfer release for a manager build."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

try:
    from .platform_selector import MANIFEST_URL, detect_target, load_manifest, select_release
except ImportError:  # Support running this module as a bundled manager entry point.
    from platform_selector import MANIFEST_URL, detect_target, load_manifest, select_release

MAX_RELEASE_BYTES = 2 * 1024 * 1024 * 1024
CHUNK_BYTES = 1024 * 1024


def resolve_release_url(release: dict[str, Any], manifest_url: str = MANIFEST_URL) -> str:
    artifact = release.get("artifact", {})
    raw_url = str(artifact.get("url", ""))
    resolved = urljoin(manifest_url, raw_url)
    if urlparse(resolved).scheme != "https":
        raise ValueError("Release packages must be downloaded over HTTPS.")
    return resolved


def download_verified_release(
    release: dict[str, Any],
    destination: Path,
    manifest_url: str = MANIFEST_URL,
) -> Path:
    artifact = release.get("artifact", {})
    filename = str(artifact.get("name", ""))
    expected_hash = str(artifact.get("sha256", "")).lower()
    if not filename or Path(filename).name != filename or filename in {".", ".."}:
        raise ValueError("The release manifest contains an unsafe filename.")
    if not re.fullmatch(r"[a-f0-9]{64}", expected_hash):
        raise ValueError("The release manifest does not contain a valid SHA-256 checksum.")

    destination.mkdir(parents=True, exist_ok=True, mode=0o700)
    if destination.is_symlink():
        raise ValueError("Refusing to write through a symbolic-link download directory.")
    if os.name != "nt":
        destination.chmod(0o700)
    target = destination / filename
    if target.is_file() and not target.is_symlink() and _sha256(target) == expected_hash:
        return target

    request = Request(resolve_release_url(release, manifest_url), headers={"User-Agent": "GhostSurfer-Installation-Manager"})
    temporary_path: Path | None = None
    digest = hashlib.sha256()
    received = 0
    try:
        with urlopen(request, timeout=30) as response:
            if urlparse(response.geturl()).scheme != "https":
                raise ValueError("The package download redirected away from HTTPS.")
            content_length = response.headers.get("Content-Length")
            if content_length and int(content_length) > MAX_RELEASE_BYTES:
                raise ValueError("The release package exceeds the 2 GiB safety limit.")
            with tempfile.NamedTemporaryFile(prefix=".ghost-surfer-", suffix=".download", dir=destination, delete=False) as output:
                temporary_path = Path(output.name)
                while True:
                    chunk = response.read(CHUNK_BYTES)
                    if not chunk:
                        break
                    received += len(chunk)
                    if received > MAX_RELEASE_BYTES:
                        raise ValueError("The release package exceeds the 2 GiB safety limit.")
                    digest.update(chunk)
                    output.write(chunk)
        if digest.hexdigest() != expected_hash:
            raise ValueError("The downloaded release failed its SHA-256 check; it was discarded.")
        os.replace(temporary_path, target)
        temporary_path = None
        return target
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(CHUNK_BYTES), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description="Select and download the compatible Ghost Surfer release.")
    parser.add_argument("--manifest", default=MANIFEST_URL, help="HTTPS manifest URL or local manifest path")
    parser.add_argument("--download-dir", type=Path, default=Path.home() / ".cache" / "ghost-surfer-manager")
    parser.add_argument("--select-only", action="store_true", help="Print the selected release without downloading it")
    args = parser.parse_args()

    try:
        manifest = load_manifest(args.manifest)
        target = detect_target()
        release = select_release(manifest, target)
        result: dict[str, Any] = {
            "target": {"platform": target.platform, "architecture": target.architecture},
            "release": release,
            "downloadUrl": resolve_release_url(release, args.manifest if urlparse(args.manifest).scheme == "https" else MANIFEST_URL),
        }
        if not args.select_only:
            package = download_verified_release(release, args.download_dir, args.manifest if urlparse(args.manifest).scheme == "https" else MANIFEST_URL)
            result["verifiedPackage"] = str(package)
        print(json.dumps(result, indent=2))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(json.dumps({"ok": False, "error": str(error)}, indent=2), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
