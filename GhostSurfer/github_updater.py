"""Safe, opt-in updater for stable Ghost Surfer releases hosted on GitHub.

The module deliberately has no repository default. The app must be configured
with its official GitHub owner/repository and its own semantic app version.
Release tags and matching Windows packages use ``vMAJOR.MINOR.PATCH`` and
``GhostSurfer-Setup-vMAJOR.MINOR.PATCH.zip`` (the leading ``v`` is optional).

Only packages authenticated by GitHub's asset SHA-256 digest or a release
``SHA256SUMS.txt``/``checksums.txt`` asset are staged. The archive must contain
an ``Install-GhostSurfer.ps1`` beside a ``Ghost Surfer/Ghost Surfer.exe`` tree.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import shutil
import stat
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Callable


_VERSION_RE = re.compile(
    r"^v?(?P<major>0|[1-9]\d*)\.(?P<minor>0|[1-9]\d*)\.(?P<patch>0|[1-9]\d*)"
    r"(?P<pre>-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$"
)
_PACKAGE_RE = re.compile(
    r"^GhostSurfer-Setup-(?P<version>v?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)\.zip$",
    re.IGNORECASE,
)
_OWNER_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$")
_REPO_RE = re.compile(r"^[A-Za-z0-9_.-]{1,100}$")


class UpdateError(RuntimeError):
    """Base error for a check, download, verification, or staging failure."""


class UpdateConfigurationError(UpdateError):
    """Raised when the official repository or installed app version is missing."""


@dataclass(frozen=True)
class UpdateCandidate:
    owner: str
    repository: str
    tag: str
    version: str
    release_name: str
    release_url: str
    asset_name: str
    asset_url: str
    asset_size: int
    asset_digest: str | None
    checksum_asset_url: str | None
    checksum_asset_name: str | None


@dataclass(frozen=True)
class StagedUpdate:
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


class _HTTPSRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Keep redirects HTTPS-only and never forward an API token across hosts."""

    def redirect_request(self, request, response, code, message, headers, new_url):
        source = urllib.parse.urlparse(request.full_url)
        target = urllib.parse.urlparse(new_url)
        if target.scheme != "https":
            raise UpdateError("GitHub attempted to redirect the update request to a non-HTTPS URL.")
        redirected = super().redirect_request(request, response, code, message, headers, new_url)
        if redirected is not None and source.hostname != target.hostname:
            for key in list(redirected.headers):
                if key.casefold() == "authorization":
                    redirected.remove_header(key)
            for key in list(redirected.unredirected_hdrs):
                if key.casefold() == "authorization":
                    redirected.remove_unredirected_header(key)
        return redirected


def _open_url(request: urllib.request.Request, timeout: float):
    opener = urllib.request.build_opener(_HTTPSRedirectHandler())
    return opener.open(request, timeout=timeout)


def _version_key(value: str) -> tuple:
    match = _VERSION_RE.fullmatch(str(value).strip())
    if not match:
        raise UpdateError(f"Unsupported release version: {value!r}")
    base = tuple(int(match.group(name)) for name in ("major", "minor", "patch"))
    prerelease = match.group("pre")
    if prerelease is None:
        return base, 1, ()
    parts = []
    for part in prerelease[1:].split("."):
        parts.append((0, int(part)) if part.isdigit() else (1, part.casefold()))
    return base, 0, tuple(parts)


def _asset_download_url(owner: str, repository: str, value: object) -> str:
    url = str(value or "")
    parsed = urllib.parse.urlparse(url)
    expected_prefix = f"/" + urllib.parse.quote(owner, safe="") + "/" + urllib.parse.quote(repository, safe="") + "/releases/download/"
    if parsed.scheme != "https" or parsed.hostname != "github.com" or not parsed.path.startswith(expected_prefix):
        raise UpdateError("GitHub returned a release asset URL outside the configured repository.")
    return url


class GitHubReleasesUpdater:
    """Check and stage verified onedir release archives from one GitHub repo.

    Args:
        owner, repository: Exact owner and repository names for the official
            Ghost Surfer project. Leaving either blank disables all network work.
        current_version: Installed app's semantic version, e.g. ``1.4.2``.
        install_directory: Existing per-user installation containing
            ``Ghost Surfer.exe``. This directory is never removed by this module.
        token: Optional GitHub token for private repositories. It stays in
            memory only and is never included in exception text or logs.
    """

    API_ROOT = "https://api.github.com"
    USER_AGENT = "GhostSurfer-Updater/1"
    MAX_RELEASE_JSON = 2 * 1024 * 1024
    MAX_CHECKSUM_FILE = 1024 * 1024
    MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024 * 1024
    MAX_EXPANDED_BYTES = 8 * 1024 * 1024 * 1024
    MAX_ARCHIVE_FILES = 25_000

    def __init__(
        self,
        owner: str | None,
        repository: str | None,
        current_version: str | None,
        install_directory: str | os.PathLike[str] | None = None,
        *,
        token: str | None = None,
        timeout: float = 25.0,
        staging_directory: str | os.PathLike[str] | None = None,
    ) -> None:
        self.owner = str(owner or "").strip()
        self.repository = str(repository or "").strip()
        self.current_version = str(current_version or "").strip()
        self.install_directory = Path(install_directory).expanduser() if install_directory else None
        self._token = str(token).strip() if token else None
        self.timeout = max(3.0, min(float(timeout), 120.0))
        if staging_directory:
            self.staging_directory = Path(staging_directory).expanduser()
        else:
            local_app_data = os.environ.get("LOCALAPPDATA")
            base = Path(local_app_data) if local_app_data else Path.home() / "AppData" / "Local"
            self.staging_directory = base / "GhostSurfer" / "updates"

    @property
    def configured(self) -> bool:
        return bool(
            _OWNER_RE.fullmatch(self.owner)
            and _REPO_RE.fullmatch(self.repository)
            and _VERSION_RE.fullmatch(self.current_version)
        )

    def _require_configured(self) -> None:
        if not _OWNER_RE.fullmatch(self.owner) or not _REPO_RE.fullmatch(self.repository):
            raise UpdateConfigurationError("GitHub auto-update is disabled until the official repository owner and name are configured.")
        if not _VERSION_RE.fullmatch(self.current_version):
            raise UpdateConfigurationError("GitHub auto-update is disabled until Ghost Surfer has a semantic app version configured.")

    def _request(self, url: str, *, accept: str = "application/vnd.github+json") -> urllib.request.Request:
        self._require_configured()
        headers = {
            "Accept": accept,
            "User-Agent": self.USER_AGENT,
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        return urllib.request.Request(url, headers=headers)

    def _read_url(self, url: str, limit: int, *, accept: str = "application/vnd.github+json") -> bytes:
        request = self._request(url, accept=accept)
        try:
            with _open_url(request, self.timeout) as response:
                length = response.headers.get("Content-Length")
                if length and int(length) > limit:
                    raise UpdateError("The GitHub response exceeds the allowed size.")
                payload = response.read(limit + 1)
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                raise UpdateError("No stable Ghost Surfer release was found in the configured GitHub repository.") from None
            if exc.code == 403 or exc.code == 429:
                raise UpdateError("GitHub rate-limited the update request; try again later.") from None
            raise UpdateError(f"GitHub update request failed with HTTP {exc.code}.") from None
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
            raise UpdateError(f"Could not reach GitHub: {exc.__class__.__name__}.") from None
        if len(payload) > limit:
            raise UpdateError("The GitHub response exceeds the allowed size.")
        return payload

    def check_for_update(self) -> UpdateCandidate | None:
        """Return the newest compatible stable update, or ``None`` if current."""
        self._require_configured()
        owner = urllib.parse.quote(self.owner, safe="")
        repository = urllib.parse.quote(self.repository, safe="")
        url = f"{self.API_ROOT}/repos/{owner}/{repository}/releases/latest"
        try:
            payload = json.loads(self._read_url(url, self.MAX_RELEASE_JSON))
        except json.JSONDecodeError as exc:
            raise UpdateError("GitHub returned invalid release metadata.") from exc
        if not isinstance(payload, dict) or payload.get("draft") or payload.get("prerelease"):
            raise UpdateError("GitHub did not return a stable published release.")

        tag = str(payload.get("tag_name") or "").strip()
        candidate_version = tag.lstrip("v")
        candidate_key = _version_key(tag)
        if candidate_key <= _version_key(self.current_version):
            return None
        assets = payload.get("assets")
        if not isinstance(assets, list):
            raise UpdateError("The GitHub release has no usable assets.")

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
                    raise UpdateError("The release has more than one Ghost Surfer installer archive.")
                package = asset
                package_version = match.group("version")
            elif name.casefold() in {"sha256sums.txt", "checksums.txt"}:
                checksum = asset
        if package is None or package_version is None:
            raise UpdateError("The release is missing GhostSurfer-Setup-vMAJOR.MINOR.PATCH.zip.")
        if _version_key(package_version) != candidate_key:
            raise UpdateError("The release tag and Ghost Surfer package version do not match.")
        try:
            size = int(package.get("size", 0))
        except (TypeError, ValueError):
            size = 0
        if size < 1 or size > self.MAX_DOWNLOAD_BYTES:
            raise UpdateError("The Ghost Surfer release archive has an invalid size.")
        raw_digest = package.get("digest")
        digest = None
        if isinstance(raw_digest, str) and raw_digest.lower().startswith("sha256:"):
            digest = raw_digest.split(":", 1)[1].lower()
            if not re.fullmatch(r"[0-9a-f]{64}", digest):
                raise UpdateError("GitHub supplied an invalid SHA-256 asset digest.")
        checksum_url = None
        checksum_name = None
        if checksum is not None:
            checksum_name = str(checksum.get("name") or "")
            checksum_url = _asset_download_url(self.owner, self.repository, checksum.get("browser_download_url"))

        return UpdateCandidate(
            owner=self.owner,
            repository=self.repository,
            tag=tag,
            version=candidate_version,
            release_name=str(payload.get("name") or tag),
            release_url=str(payload.get("html_url") or f"https://github.com/{owner}/{repository}/releases/tag/{urllib.parse.quote(tag, safe='') }"),
            asset_name=str(package.get("name") or ""),
            asset_url=_asset_download_url(self.owner, self.repository, package.get("browser_download_url")),
            asset_size=size,
            asset_digest=digest,
            checksum_asset_url=checksum_url,
            checksum_asset_name=checksum_name,
        )

    def _download(self, url: str, destination: Path, expected_size: int | None, limit: int, progress: ProgressCallback | None = None) -> int:
        request = self._request(url, accept="application/octet-stream")
        total = 0
        try:
            with _open_url(request, self.timeout) as response, destination.open("xb") as output:
                header_size = response.headers.get("Content-Length")
                if header_size:
                    declared = int(header_size)
                    if declared > limit or (expected_size is not None and declared != expected_size):
                        raise UpdateError("The GitHub download size did not match release metadata.")
                else:
                    declared = expected_size
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > limit or (expected_size is not None and total > expected_size):
                        raise UpdateError("The GitHub download exceeded the allowed size.")
                    output.write(chunk)
                    if progress is not None:
                        progress(total, declared)
                output.flush()
                os.fsync(output.fileno())
        except UpdateError:
            raise
        except urllib.error.HTTPError as exc:
            raise UpdateError(f"GitHub asset download failed with HTTP {exc.code}.") from None
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
            raise UpdateError(f"Could not download the GitHub release asset: {exc.__class__.__name__}.") from None
        if expected_size is not None and total != expected_size:
            raise UpdateError("The downloaded archive size does not match GitHub release metadata.")
        if total == 0:
            raise UpdateError("GitHub returned an empty release asset.")
        return total

    @staticmethod
    def _checksum_from_manifest(path: Path, asset_name: str) -> str:
        try:
            lines = path.read_text(encoding="utf-8-sig").splitlines()
        except (OSError, UnicodeError) as exc:
            raise UpdateError("The release checksum manifest could not be read.") from exc
        matches = []
        for line in lines:
            parts = line.strip().split()
            if len(parts) < 2 or not re.fullmatch(r"[0-9A-Fa-f]{64}", parts[0]):
                continue
            listed_name = parts[-1].lstrip("*").replace("\\", "/").rsplit("/", 1)[-1]
            if listed_name.casefold() == asset_name.casefold():
                matches.append(parts[0].lower())
        if len(matches) != 1:
            raise UpdateError("The release checksum manifest does not identify this archive exactly once.")
        return matches[0]

    @staticmethod
    def _sha256_file(path: Path) -> str:
        hasher = hashlib.sha256()
        with path.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                hasher.update(chunk)
        return hasher.hexdigest()

    @staticmethod
    def _validate_zip(archive: zipfile.ZipFile, max_expanded_bytes: int, max_files: int) -> None:
        entries = archive.infolist()
        if not entries or len(entries) > max_files:
            raise UpdateError("The release archive contains an invalid number of files.")
        expanded = 0
        seen_paths = set()
        reserved_names = {"con", "prn", "aux", "nul", *(f"com{i}" for i in range(1, 10)), *(f"lpt{i}" for i in range(1, 10))}
        for info in entries:
            raw_name = info.filename.replace("\\", "/")
            path = PurePosixPath(raw_name)
            if path.is_absolute() or ".." in path.parts or any(":" in part for part in path.parts) or not path.parts:
                raise UpdateError("The release archive contains an unsafe file path.")
            normalized_name = "/".join(path.parts).casefold().rstrip("/")
            if normalized_name in seen_paths:
                raise UpdateError("The release archive contains duplicate or conflicting file paths.")
            seen_paths.add(normalized_name)
            if any(part.rstrip(" .").split(".", 1)[0].casefold() in reserved_names or part.endswith((".", " ")) for part in path.parts):
                raise UpdateError("The release archive contains an invalid Windows file name.")
            mode = info.external_attr >> 16
            if stat.S_ISLNK(mode):
                raise UpdateError("The release archive contains a symbolic link.")
            expanded += int(info.file_size)
            if info.file_size < 0 or expanded > max_expanded_bytes:
                raise UpdateError("The release archive expands beyond the allowed size.")

    def download_and_stage(self, candidate: UpdateCandidate, progress: ProgressCallback | None = None) -> StagedUpdate:
        """Download, checksum-verify, inspect, and extract a candidate safely."""
        self._require_configured()
        if candidate.owner != self.owner or candidate.repository != self.repository:
            raise UpdateError("This update candidate belongs to a different GitHub repository.")
        if _version_key(candidate.tag) <= _version_key(self.current_version):
            raise UpdateError("The update candidate is not newer than this installation.")
        self.staging_directory.mkdir(parents=True, exist_ok=True)
        stage = self.staging_directory / f"stage-{candidate.version}-{uuid.uuid4().hex[:10]}"
        stage.mkdir()
        archive_path = stage / candidate.asset_name
        checksum_path = stage / (candidate.checksum_asset_name or "checksums.txt")
        try:
            self._download(candidate.asset_url, archive_path, candidate.asset_size, self.MAX_DOWNLOAD_BYTES, progress)
            digest = candidate.asset_digest
            if digest is None:
                if candidate.checksum_asset_url is None:
                    raise UpdateError("The release has no verifiable SHA-256 digest; refusing to install it.")
                self._download(candidate.checksum_asset_url, checksum_path, None, self.MAX_CHECKSUM_FILE)
                digest = self._checksum_from_manifest(checksum_path, candidate.asset_name)
            actual_digest = self._sha256_file(archive_path)
            if not hmac.compare_digest(actual_digest, digest):
                raise UpdateError("The Ghost Surfer release archive failed its SHA-256 check.")

            with zipfile.ZipFile(archive_path, "r") as archive:
                self._validate_zip(archive, self.MAX_EXPANDED_BYTES, self.MAX_ARCHIVE_FILES)
                extract_root = stage / "package"
                extract_root.mkdir()
                archive.extractall(extract_root)
            candidates = []
            for script in (stage / "package").rglob("Install-GhostSurfer.ps1"):
                root = script.parent
                executable = root / "Ghost Surfer" / "Ghost Surfer.exe"
                if executable.is_file() and not executable.is_symlink():
                    candidates.append((root, script, executable))
            if len(candidates) != 1:
                raise UpdateError("The verified release archive does not contain one recognizable Ghost Surfer installer.")
            root, script, executable = candidates[0]
            return StagedUpdate(
                candidate.version,
                candidate.tag,
                archive_path,
                root,
                script,
                executable,
                actual_digest,
                self._sha256_file(script),
                self._sha256_file(executable),
            )
        except (OSError, zipfile.BadZipFile, RuntimeError) as exc:
            self._remove_staging(stage)
            if isinstance(exc, UpdateError):
                raise
            raise UpdateError(f"The release archive could not be staged: {exc.__class__.__name__}.") from None
        except Exception:
            self._remove_staging(stage)
            raise

    def _remove_staging(self, path: Path) -> None:
        """Remove only a stage folder created directly below our staging root."""
        try:
            resolved_root = self.staging_directory.resolve()
            resolved_path = path.resolve()
            if resolved_path.parent == resolved_root and resolved_path.name.startswith("stage-"):
                shutil.rmtree(resolved_path, ignore_errors=True)
        except OSError:
            pass

    def launch_apply(
        self,
        staged: StagedUpdate,
        *,
        current_pid: int | None = None,
        install_directory: str | os.PathLike[str] | None = None,
    ) -> subprocess.Popen:
        """Start an external PowerShell installer that waits for this app to exit.

        Call this only after the user accepts the update, then close the app
        promptly (for example, return from the slot and call QApplication.quit()).
        The existing installation directory must contain Ghost Surfer.exe. The
        official installer copies into it and restarts Ghost Surfer after the
        old process exits; browser data remains in the separate user profile.
        """
        self._require_configured()
        target = Path(install_directory).expanduser() if install_directory else self.install_directory
        if target is None:
            raise UpdateConfigurationError("The Ghost Surfer installation directory is not configured.")
        target = target.resolve()
        installed_exe = target / "Ghost Surfer.exe"
        if not installed_exe.is_file():
            raise UpdateError("The configured install directory does not contain Ghost Surfer.exe.")
        package_root = staged.package_root.resolve()
        script_path = staged.install_script.resolve()
        expected_exe = (package_root / "Ghost Surfer" / "Ghost Surfer.exe").resolve()
        stage_root = staged.archive_path.parent.resolve()
        expected_package_parent = (stage_root / "package").resolve()
        if not package_root.is_relative_to(expected_package_parent):
            raise UpdateError("The staged package root is outside the private update directory.")
        if (
            not script_path.is_file()
            or not expected_exe.is_file()
            or expected_exe != staged.executable_path.resolve()
            or not script_path.is_relative_to(package_root)
        ):
            raise UpdateError("The staged installer package is incomplete or no longer available.")
        try:
            if not hmac.compare_digest(self._sha256_file(staged.archive_path), staged.sha256):
                raise UpdateError("The staged update archive changed after verification.")
            if not hmac.compare_digest(self._sha256_file(script_path), staged.installer_sha256):
                raise UpdateError("The staged installer script changed after verification.")
            if not hmac.compare_digest(self._sha256_file(expected_exe), staged.executable_sha256):
                raise UpdateError("The staged Ghost Surfer executable changed after verification.")
        except OSError as exc:
            raise UpdateError(f"The staged package could not be verified: {exc.__class__.__name__}.") from None
        pid = int(current_pid if current_pid is not None else os.getpid())
        if pid <= 0:
            raise UpdateError("The current process id is invalid.")

        apply_script = staged.archive_path.parent / "apply-update.ps1"
        script = r"""param(
    [Parameter(Mandatory=$true)][string]$PackageRoot,
    [Parameter(Mandatory=$true)][string]$InstallDirectory,
    [Parameter(Mandatory=$true)][int]$WaitForPid
)
$ErrorActionPreference = 'Stop'
$deadline = [DateTime]::UtcNow.AddMinutes(3)
while (Get-Process -Id $WaitForPid -ErrorAction SilentlyContinue) {
    if ([DateTime]::UtcNow -gt $deadline) { throw 'Ghost Surfer did not close in time.' }
    Start-Sleep -Milliseconds 400
}
$installer = Join-Path $PackageRoot 'Install-GhostSurfer.ps1'
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) { throw 'The staged installer script is missing.' }
& $installer -InstallDirectory $InstallDirectory
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
"""
        script_path.write_text(script, encoding="utf-8")
        powershell = shutil.which("powershell.exe") or str(
            Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe"
        )
        if not Path(powershell).is_file():
            raise UpdateError("Windows PowerShell could not be found to apply the staged update.")
        command = [
            powershell,
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(script_path),
            "-PackageRoot",
            str(package_root),
            "-InstallDirectory",
            str(target),
            "-WaitForPid",
            str(pid),
        ]
        creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        try:
            return subprocess.Popen(command, cwd=str(package_root), close_fds=True, creationflags=creation_flags)
        except OSError as exc:
            raise UpdateError(f"Could not launch the updater: {exc.__class__.__name__}.") from None
