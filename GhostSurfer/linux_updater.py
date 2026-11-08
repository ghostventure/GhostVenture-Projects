"""Verified GitHub-release updater for the native Linux Ghost Surfer build."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import shlex
import shutil
import subprocess
import tarfile
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Callable


_VERSION_RE = re.compile(
    r"^v?(?P<major>0|[1-9]\d*)\.(?P<minor>0|[1-9]\d*)\.(?P<patch>0|[1-9]\d*)"
    r"(?P<pre>-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$"
)
_PACKAGE_RE = re.compile(
    r"^GhostSurfer-Linux-x86_64-(?P<version>v?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)\.tar\.gz$",
    re.IGNORECASE,
)


class LinuxUpdateError(RuntimeError):
    """A GitHub check, download, verification, staging, or update error."""


@dataclass(frozen=True)
class LinuxUpdateCandidate:
    owner: str
    repository: str
    tag: str
    version: str
    release_name: str
    release_notes: str
    release_url: str
    asset_name: str
    asset_url: str
    asset_size: int
    asset_digest: str | None
    checksum_asset_url: str | None
    checksum_asset_name: str | None


@dataclass(frozen=True)
class StagedLinuxUpdate:
    version: str
    tag: str
    archive_path: Path
    package_root: Path
    install_script: Path
    executable_path: Path
    sha256: str
    installer_sha256: str
    executable_sha256: str


ProgressCallback = Callable[[int, int | None], None]


def _version_key(value: str) -> tuple:
    match = _VERSION_RE.fullmatch(str(value).strip())
    if not match:
        raise LinuxUpdateError(f"Unsupported release version: {value!r}")
    base = tuple(int(match.group(name)) for name in ("major", "minor", "patch"))
    prerelease = match.group("pre")
    if prerelease is None:
        return base, 1, ()
    parts = []
    for part in prerelease[1:].split("."):
        parts.append((0, int(part)) if part.isdigit() else (1, part.casefold()))
    return base, 0, tuple(parts)


class _HTTPSRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        source = urllib.parse.urlparse(request.full_url)
        target = urllib.parse.urlparse(new_url)
        if target.scheme != "https":
            raise LinuxUpdateError("GitHub attempted to redirect the update request to a non-HTTPS URL.")
        hostname = (target.hostname or "").casefold()
        if not (hostname == "github.com" or hostname.endswith(".github.com")
                or hostname == "githubusercontent.com" or hostname.endswith(".githubusercontent.com")):
            raise LinuxUpdateError("GitHub attempted to redirect the update request to an untrusted host.")
        redirected = super().redirect_request(request, response, code, message, headers, new_url)
        if redirected is not None and source.hostname != target.hostname:
            for key in list(redirected.headers):
                if key.casefold() == "authorization":
                    redirected.remove_header(key)
            for key in list(redirected.unredirected_hdrs):
                if key.casefold() == "authorization":
                    redirected.remove_unredirected_header(key)
        return redirected


def _asset_url(owner: str, repository: str, value: object) -> str:
    url = str(value or "")
    parsed = urllib.parse.urlparse(url)
    prefix = f"/{urllib.parse.quote(owner, safe='')}/{urllib.parse.quote(repository, safe='')}/releases/download/"
    if parsed.scheme != "https" or parsed.hostname != "github.com" or not parsed.path.startswith(prefix):
        raise LinuxUpdateError("GitHub returned a release asset URL outside the configured repository.")
    return url


class LinuxGitHubReleasesUpdater:
    API_ROOT = "https://api.github.com"
    USER_AGENT = "GhostSurfer-Linux-Updater/1"
    MAX_RELEASE_JSON = 2 * 1024 * 1024
    MAX_CHECKSUM_FILE = 1024 * 1024
    MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024 * 1024
    MAX_EXPANDED_BYTES = 8 * 1024 * 1024 * 1024
    MAX_ARCHIVE_FILES = 25_000

    def __init__(
        self,
        owner: str,
        repository: str,
        current_version: str,
        install_directory: str | os.PathLike[str] | None = None,
        *,
        timeout: float = 25.0,
        staging_directory: str | os.PathLike[str] | None = None,
    ) -> None:
        self.owner = str(owner).strip()
        self.repository = str(repository).strip()
        self.current_version = str(current_version).strip()
        self.install_directory = Path(install_directory).expanduser() if install_directory else None
        cache_home = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")).expanduser()
        self.staging_directory = Path(staging_directory).expanduser() if staging_directory else cache_home / "ghost-surfer" / "updates"
        self.timeout = max(3.0, min(float(timeout), 120.0))

    def _request(self, url: str, *, accept: str = "application/vnd.github+json") -> urllib.request.Request:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "https":
            raise LinuxUpdateError("Update requests must use HTTPS.")
        return urllib.request.Request(
            url,
            headers={"Accept": accept, "User-Agent": self.USER_AGENT, "X-GitHub-Api-Version": "2022-11-28"},
        )

    def _read(self, url: str, limit: int, *, accept: str = "application/vnd.github+json") -> bytes:
        try:
            with urllib.request.build_opener(_HTTPSRedirectHandler()).open(self._request(url, accept=accept), timeout=self.timeout) as response:
                length = response.headers.get("Content-Length")
                if length and int(length) > limit:
                    raise LinuxUpdateError("The GitHub response exceeds the allowed size.")
                data = response.read(limit + 1)
        except LinuxUpdateError:
            raise
        except urllib.error.HTTPError as exc:
            if exc.code in (403, 429):
                raise LinuxUpdateError("GitHub rate-limited the update request; try again later.") from None
            raise LinuxUpdateError(f"GitHub update request failed with HTTP {exc.code}.") from None
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
            raise LinuxUpdateError(f"Could not reach GitHub: {exc.__class__.__name__}.") from None
        if len(data) > limit:
            raise LinuxUpdateError("The GitHub response exceeds the allowed size.")
        return data

    def check_for_update(self) -> LinuxUpdateCandidate | None:
        owner = urllib.parse.quote(self.owner, safe="")
        repository = urllib.parse.quote(self.repository, safe="")
        try:
            releases = json.loads(self._read(f"{self.API_ROOT}/repos/{owner}/{repository}/releases?per_page=30", self.MAX_RELEASE_JSON))
        except json.JSONDecodeError as exc:
            raise LinuxUpdateError("GitHub returned invalid release metadata.") from exc
        if not isinstance(releases, list):
            raise LinuxUpdateError("GitHub returned an invalid release list.")
        current_key = _version_key(self.current_version)
        candidates: list[LinuxUpdateCandidate] = []
        for release in releases:
            if not isinstance(release, dict) or release.get("draft") or release.get("prerelease"):
                continue
            tag = str(release.get("tag_name") or "").strip()
            try:
                tag_key = _version_key(tag)
            except LinuxUpdateError:
                continue
            if tag_key <= current_key:
                continue
            assets = release.get("assets")
            if not isinstance(assets, list):
                continue
            package = None
            package_version = None
            checksum = None
            for asset in assets:
                if not isinstance(asset, dict):
                    continue
                name = str(asset.get("name") or "")
                match = _PACKAGE_RE.fullmatch(name)
                if match:
                    if package is not None:
                        package = None
                        package_version = None
                        break
                    package = asset
                    package_version = match.group("version")
                elif name.casefold() in {"sha256sums.txt", "checksums.txt"}:
                    checksum = asset
            if package is None or package_version is None or _version_key(package_version) != tag_key:
                continue
            try:
                size = int(package.get("size", 0))
            except (TypeError, ValueError):
                continue
            if size < 1 or size > self.MAX_DOWNLOAD_BYTES:
                continue
            raw_digest = package.get("digest")
            digest = None
            if isinstance(raw_digest, str) and raw_digest.casefold().startswith("sha256:"):
                digest = raw_digest.split(":", 1)[1].lower()
                if not re.fullmatch(r"[0-9a-f]{64}", digest):
                    continue
            checksum_url = checksum_name = None
            if checksum is not None:
                checksum_name = str(checksum.get("name") or "")
                checksum_url = _asset_url(self.owner, self.repository, checksum.get("browser_download_url"))
            if digest is None and checksum_url is None:
                continue
            candidates.append(LinuxUpdateCandidate(
                self.owner, self.repository, tag, tag.lstrip("v"), str(release.get("name") or tag),
                str(release.get("body") or "").strip(),
                str(release.get("html_url") or f"https://github.com/{owner}/{repository}/releases/tag/{urllib.parse.quote(tag, safe='')}"),
                str(package.get("name") or ""), _asset_url(self.owner, self.repository, package.get("browser_download_url")),
                size, digest, checksum_url, checksum_name,
            ))
        return max(candidates, key=lambda item: _version_key(item.tag), default=None)

    def _download(self, url: str, destination: Path, expected_size: int | None, limit: int, progress: ProgressCallback | None = None) -> int:
        total = 0
        try:
            with urllib.request.build_opener(_HTTPSRedirectHandler()).open(self._request(url, accept="application/octet-stream"), timeout=self.timeout) as response, destination.open("xb") as output:
                header_size = response.headers.get("Content-Length")
                if header_size:
                    declared = int(header_size)
                    if declared > limit or (expected_size is not None and declared != expected_size):
                        raise LinuxUpdateError("The GitHub download size did not match release metadata.")
                else:
                    declared = expected_size
                while chunk := response.read(1024 * 1024):
                    total += len(chunk)
                    if total > limit or (expected_size is not None and total > expected_size):
                        raise LinuxUpdateError("The GitHub download exceeded the allowed size.")
                    output.write(chunk)
                    if progress:
                        progress(total, declared)
                output.flush()
                os.fsync(output.fileno())
        except LinuxUpdateError:
            raise
        except urllib.error.HTTPError as exc:
            raise LinuxUpdateError(f"GitHub asset download failed with HTTP {exc.code}.") from None
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
            raise LinuxUpdateError(f"Could not download the GitHub release asset: {exc.__class__.__name__}.") from None
        if total == 0 or expected_size is not None and total != expected_size:
            raise LinuxUpdateError("The downloaded archive size does not match GitHub release metadata.")
        return total

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    @staticmethod
    def _manifest_hash(path: Path, asset_name: str) -> str:
        try:
            lines = path.read_text(encoding="utf-8-sig").splitlines()
        except (OSError, UnicodeError) as exc:
            raise LinuxUpdateError("The release checksum manifest could not be read.") from exc
        matches = []
        for line in lines:
            parts = line.strip().split()
            if len(parts) >= 2 and re.fullmatch(r"[0-9a-fA-F]{64}", parts[0]) and parts[-1].lstrip("*").replace("\\", "/").rsplit("/", 1)[-1].casefold() == asset_name.casefold():
                matches.append(parts[0].lower())
        if len(matches) != 1:
            raise LinuxUpdateError("The release checksum manifest does not identify this archive exactly once.")
        return matches[0]

    def _validate_archive(self, archive: tarfile.TarFile) -> None:
        members = archive.getmembers()
        if not members or len(members) > self.MAX_ARCHIVE_FILES:
            raise LinuxUpdateError("The release archive contains an invalid number of files.")
        expanded = 0
        seen: set[str] = set()
        for member in members:
            name = member.name.replace("\\", "/")
            path = PurePosixPath(name)
            if path.is_absolute() or not path.parts or ".." in path.parts or any(":" in part for part in path.parts):
                raise LinuxUpdateError("The release archive contains an unsafe path.")
            normalized = "/".join(path.parts).casefold().rstrip("/")
            if normalized in seen:
                raise LinuxUpdateError("The release archive contains duplicate paths.")
            seen.add(normalized)
            if member.islnk() or member.isdev() or member.isfifo():
                raise LinuxUpdateError("The release archive contains an unsupported special file.")
            if member.issym():
                link = PurePosixPath(member.linkname)
                if link.is_absolute():
                    raise LinuxUpdateError("The release archive contains an absolute symbolic link.")
                target = PurePosixPath(path.parent, link)
                depth = 0
                for part in target.parts:
                    if part == "..":
                        depth -= 1
                    elif part not in ("", "."):
                        depth += 1
                    if depth < 0:
                        raise LinuxUpdateError("The release archive contains a symbolic link outside its package.")
            elif not (member.isfile() or member.isdir()):
                raise LinuxUpdateError("The release archive contains an unsupported entry.")
            expanded += max(0, int(member.size))
            if expanded > self.MAX_EXPANDED_BYTES:
                raise LinuxUpdateError("The release archive expands beyond the allowed size.")

    def download_and_stage(self, candidate: LinuxUpdateCandidate, progress: ProgressCallback | None = None) -> StagedLinuxUpdate:
        if candidate.owner != self.owner or candidate.repository != self.repository or _version_key(candidate.tag) <= _version_key(self.current_version):
            raise LinuxUpdateError("This update candidate does not apply to this Ghost Surfer installation.")
        self.staging_directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(self.staging_directory, 0o700)
        stage = self.staging_directory / f"stage-{candidate.version}-{uuid.uuid4().hex[:10]}"
        stage.mkdir(mode=0o700)
        archive_path = stage / candidate.asset_name
        checksum_path = stage / (candidate.checksum_asset_name or "checksums.txt")
        try:
            self._download(candidate.asset_url, archive_path, candidate.asset_size, self.MAX_DOWNLOAD_BYTES, progress)
            expected_hash = candidate.asset_digest
            if expected_hash is None:
                if candidate.checksum_asset_url is None:
                    raise LinuxUpdateError("The release has no verifiable SHA-256 digest; refusing to install it.")
                self._download(candidate.checksum_asset_url, checksum_path, None, self.MAX_CHECKSUM_FILE)
                expected_hash = self._manifest_hash(checksum_path, candidate.asset_name)
            actual_hash = self._sha256(archive_path)
            if not hmac.compare_digest(actual_hash, expected_hash):
                raise LinuxUpdateError("The Linux release archive failed its SHA-256 check.")

            extract_root = stage / "package"
            extract_root.mkdir(mode=0o700)
            with tarfile.open(archive_path, "r:gz") as archive:
                self._validate_archive(archive)
                archive.extractall(extract_root, filter="data")
            packages = []
            for script in extract_root.rglob("install-linux.sh"):
                root = script.parent
                executable = root / "app" / "ghost-surfer"
                manifest = root / "release.json"
                if script.is_file() and executable.is_file() and manifest.is_file():
                    try:
                        metadata = json.loads(manifest.read_text(encoding="utf-8"))
                    except (OSError, UnicodeError, json.JSONDecodeError):
                        continue
                    if metadata.get("name") == "Ghost Surfer" and metadata.get("platform") == "linux" and metadata.get("architecture") == "x86_64" and str(metadata.get("version")) == candidate.version:
                        packages.append((root, script, executable))
            if len(packages) != 1:
                raise LinuxUpdateError("The verified release archive does not contain one matching Linux package.")
            root, script, executable = packages[0]
            return StagedLinuxUpdate(candidate.version, candidate.tag, archive_path, root, script, executable,
                                     actual_hash, self._sha256(script), self._sha256(executable))
        except Exception as exc:
            shutil.rmtree(stage, ignore_errors=True)
            if isinstance(exc, LinuxUpdateError):
                raise
            if isinstance(exc, (tarfile.TarError, OSError, ValueError, RuntimeError)):
                raise LinuxUpdateError(f"The Linux release archive could not be staged: {exc.__class__.__name__}.") from None
            raise

    def launch_apply(self, staged: StagedLinuxUpdate, *, current_pid: int | None = None,
                     install_directory: str | os.PathLike[str] | None = None) -> subprocess.Popen:
        configured_target = Path(install_directory).expanduser() if install_directory else self.install_directory
        if configured_target is None:
            raise LinuxUpdateError("Install Ghost Surfer first with the Linux installer before applying updates.")
        if configured_target.is_symlink():
            raise LinuxUpdateError("The configured Linux install directory is a symbolic link.")
        target = configured_target.resolve()
        if target != (Path.home() / ".local/opt/ghost-surfer").resolve():
            raise LinuxUpdateError("The configured Linux install directory is not the managed per-user location.")
        if not (target / ".ghost-surfer-install").is_file() or not (target / "ghost-surfer").is_file():
            raise LinuxUpdateError("The configured directory is not a managed Ghost Surfer installation.")
        stage = staged.archive_path.parent.resolve()
        expected_stage = self.staging_directory.resolve()
        package_root = staged.package_root.resolve()
        script = staged.install_script.resolve()
        executable = staged.executable_path.resolve()
        if not stage.parent == expected_stage or not package_root.is_relative_to(stage / "package"):
            raise LinuxUpdateError("The verified update package is outside the private staging directory.")
        if not script.is_file() or not executable.is_file() or not script.is_relative_to(package_root) or executable != (package_root / "app/ghost-surfer").resolve():
            raise LinuxUpdateError("The staged Linux package is incomplete or moved.")
        if not hmac.compare_digest(self._sha256(staged.archive_path), staged.sha256):
            raise LinuxUpdateError("The staged update archive changed after verification.")
        if not hmac.compare_digest(self._sha256(script), staged.installer_sha256) or not hmac.compare_digest(self._sha256(executable), staged.executable_sha256):
            raise LinuxUpdateError("The staged installer or executable changed after verification.")
        pid = int(current_pid if current_pid is not None else os.getpid())
        if pid <= 0:
            raise LinuxUpdateError("The current process id is invalid.")

        apply_script = stage / "apply-update.sh"
        apply_script.write_text(
            "#!/usr/bin/env bash\nset -euo pipefail\n"
            f"pid={pid}\ninstall_script={shlex.quote(str(script))}\n"
            "deadline=$((SECONDS + 180))\n"
            "while kill -0 \"$pid\" 2>/dev/null; do\n"
            "  if (( SECONDS >= deadline )); then echo 'Ghost Surfer did not close in time.' >&2; exit 1; fi\n"
            "  sleep 0.25\n"
            "done\n"
            "exec \"$install_script\"\n",
            encoding="utf-8",
        )
        apply_script.chmod(0o700)
        log_path = stage / "apply-update.log"
        try:
            with log_path.open("ab") as log:
                return subprocess.Popen(["/bin/bash", str(apply_script)], cwd=str(package_root), stdin=subprocess.DEVNULL,
                                        stdout=log, stderr=subprocess.STDOUT, close_fds=True, start_new_session=True)
        except OSError as exc:
            raise LinuxUpdateError(f"Could not start the Linux updater: {exc.__class__.__name__}.") from None
