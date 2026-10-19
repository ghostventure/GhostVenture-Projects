from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import shutil
import tarfile
import tempfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from urllib.error import HTTPError
from urllib.request import Request, urlopen

GITHUB_REPOSITORY = "GhostVenture/GhostVenture-Projects"
GITHUB_API = f"https://api.github.com/repos/{GITHUB_REPOSITORY}"
RELEASE_ASSET = "Timmy-linux-x86_64.tar.gz"
CHECKSUM_ASSET = "SHA256SUMS"
MAX_DOWNLOAD_BYTES = 250 * 1024 * 1024


@dataclass(frozen=True)
class UpdateResult:
    status: str
    version: str | None = None


def check_and_install_update(timeout: float = 20.0) -> UpdateResult:
    """Install a verified GitHub release into the user's app directory."""
    release = _github_json(f"{GITHUB_API}/releases/latest", timeout)
    if not isinstance(release, dict) or not release or release.get("draft") or release.get("prerelease"):
        return UpdateResult("No stable GitHub release is available.")
    tag = str(release.get("tag_name") or "").strip()
    if not tag or not re.fullmatch(r"[A-Za-z0-9._+-]{1,80}", tag):
        raise ValueError("GitHub release has an invalid version tag.")
    assets = {str(asset.get("name")): asset for asset in release.get("assets", []) if isinstance(asset, dict)}
    archive_asset = assets.get(RELEASE_ASSET)
    checksum_asset = assets.get(CHECKSUM_ASSET)
    if not archive_asset or not checksum_asset:
        return UpdateResult("Latest release has no Linux update package yet.", tag)

    install_root = Path.home() / ".local" / "share" / "timmy-trader"
    current_version = _installed_version(install_root)
    if current_version == tag:
        return UpdateResult(f"Timmy is up to date ({tag}).", tag)

    archive_url = str(archive_asset.get("browser_download_url") or "")
    checksum_url = str(checksum_asset.get("browser_download_url") or "")
    if not archive_url.startswith("https://github.com/") or not checksum_url.startswith("https://github.com/"):
        raise ValueError("GitHub release download URL was invalid.")
    with tempfile.TemporaryDirectory(prefix="timmy-update-") as temp_name:
        temp = Path(temp_name)
        archive_path = temp / RELEASE_ASSET
        checksum_path = temp / CHECKSUM_ASSET
        _download(checksum_url, checksum_path, timeout, 64 * 1024)
        _download(archive_url, archive_path, timeout, MAX_DOWNLOAD_BYTES)
        expected = _checksum_for(checksum_path, RELEASE_ASSET)
        actual = _sha256(archive_path)
        if not expected or not hmac.compare_digest(expected.lower(), actual):
            raise ValueError("Timmy update checksum did not match.")
        _install_archive(archive_path, install_root, tag)
    return UpdateResult(f"Timmy update {tag} installed. It will be used next time Timmy starts.", tag)


def _github_json(url: str, timeout: float) -> object:
    request = Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "Timmy-Updater"})
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code == 404 and url.endswith("/releases/latest"):
            return {}
        raise


def _download(url: str, destination: Path, timeout: float, limit: int) -> None:
    request = Request(url, headers={"User-Agent": "Timmy-Updater"})
    with urlopen(request, timeout=timeout) as response, destination.open("wb") as output:
        total = 0
        while chunk := response.read(1024 * 1024):
            total += len(chunk)
            if total > limit:
                raise ValueError("Timmy update download exceeded the size limit.")
            output.write(chunk)


def _checksum_for(path: Path, asset_name: str) -> str:
    for line in path.read_text(encoding="ascii").splitlines():
        parts = line.strip().split()
        if len(parts) == 2 and parts[1].lstrip("*") == asset_name and re.fullmatch(r"[0-9a-fA-F]{64}", parts[0]):
            return parts[0]
    return ""


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _installed_version(install_root: Path) -> str | None:
    link = install_root / "current"
    try:
        return link.resolve(strict=True).name if link.is_symlink() else None
    except OSError:
        return None


def _install_archive(archive_path: Path, install_root: Path, tag: str) -> None:
    versions = install_root / "versions"
    target = versions / tag
    versions.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        stage = Path(tempfile.mkdtemp(prefix=".staging-", dir=versions))
        try:
            with tarfile.open(archive_path, "r:gz") as archive:
                members = archive.getmembers()
                for member in members:
                    name = PurePosixPath(member.name)
                    if name.is_absolute() or ".." in name.parts or not name.parts or name.parts[0] != "Timmy":
                        raise ValueError("Timmy update archive contained an unsafe path.")
                    if not (member.isfile() or member.isdir()):
                        raise ValueError("Timmy update archive contained an unsupported file type.")
                archive.extractall(stage, members=members)
            bundle = stage / "Timmy"
            executable = bundle / "Timmy"
            if not executable.is_file():
                raise ValueError("Timmy update package is incomplete.")
            executable.chmod(executable.stat().st_mode | 0o111)
            os.replace(bundle, target)
        finally:
            shutil.rmtree(stage, ignore_errors=True)

    install_root.mkdir(parents=True, exist_ok=True)
    new_link = install_root / ".current-next"
    new_link.unlink(missing_ok=True)
    new_link.symlink_to(Path("versions") / tag)
    os.replace(new_link, install_root / "current")
    _install_user_launcher(install_root)


def _install_user_launcher(install_root: Path) -> None:
    home = Path.home()
    bin_dir = home / ".local" / "bin"
    bin_dir.mkdir(parents=True, exist_ok=True)
    launcher = bin_dir / "timmy-trader"
    content = (
        "#!/bin/sh\n"
        f"export TIMMY_HOME=\"${{TIMMY_HOME:-{home}/.config/timmy-trader}}\"\n"
        f"exec \"{install_root}/current/Timmy\" \"$@\"\n"
    )
    temporary = launcher.with_suffix(".tmp")
    temporary.write_text(content, encoding="utf-8")
    temporary.chmod(0o755)
    os.replace(temporary, launcher)

    applications = home / ".local" / "share" / "applications"
    applications.mkdir(parents=True, exist_ok=True)
    desktop = applications / "timmy-trader.desktop"
    desktop.write_text(
        "[Desktop Entry]\nType=Application\nName=Timmy\nGenericName=Trading Assistant\n"
        "Comment=Launch Timmy\n"
        f"Exec={launcher}\nTerminal=false\nCategories=Office;Finance;\nStartupNotify=true\n",
        encoding="utf-8",
    )
    desktop.chmod(0o644)
