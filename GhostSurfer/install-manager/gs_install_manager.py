from __future__ import annotations

import base64
import ctypes
import hashlib
import os
import platform
import shutil
import stat
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import winreg
import zipfile
from pathlib import Path, PurePosixPath

from PySide6.QtCore import QObject, QSettings, QThread, Qt, Signal, Slot
from PySide6.QtGui import QIcon
from PySide6.QtNetwork import QLocalServer, QLocalSocket
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QDialog,
    QFileDialog,
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QProgressBar,
    QPushButton,
    QTabWidget,
    QTextBrowser,
    QVBoxLayout,
    QWidget,
)


APP_TITLE = "GS Install Manager"
APP_EXE_NAME = "Ghost Surfer.exe"
MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024
MAX_EXPANDED_BYTES = 8 * 1024 * 1024 * 1024
MAX_ARCHIVE_FILES = 25_000
CHUNK_BYTES = 4 * 1024 * 1024
VC_REDIST_URL = "https://aka.ms/vc14/vc_redist.x64.exe"
VC_MINIMUM = (14, 28, 0, 0)
VC_DOWNLOAD_LIMIT = 50 * 1024 * 1024
LEGAL_CONTENT_VERSION = "2026-10-27-v2"
WEBENGINE_FILES = (
    "PySide6/QtWebEngineCore.pyd",
    "PySide6/QtWebEngineWidgets.pyd",
    "PySide6/QtWebEngineProcess.exe",
    "PySide6/resources/icudtl.dat",
    "PySide6/resources/qtwebengine_resources.pak",
    "PySide6/plugins/platforms/qwindows.dll",
    "PySide6/qt.conf",
)


def asset_path(name: str) -> Path:
    bundle_root = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return bundle_root / "assets" / name


def install_directory() -> Path:
    local = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    return local / "Programs" / "Ghost Surfer"


def profile_directory() -> Path:
    # Ghost Surfer sets organizationName=GhostSurferLocal and applicationName=Ghost Surfer.
    local = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    return local / "GhostSurferLocal" / "Ghost Surfer"


def _version_tuple(value: str) -> tuple[int, ...]:
    digits = []
    for part in str(value).strip().lstrip("vV").split("."):
        if not part.isdigit():
            break
        digits.append(int(part))
    return tuple((digits + [0, 0, 0, 0])[:4])


def inspect_os() -> dict:
    version = sys.getwindowsversion()
    build = int(version.build)
    machine = platform.machine().upper()
    supported = version.major == 10 and version.minor == 0 and build >= 17763 and machine in {"AMD64", "X86_64"}
    edition = "Windows 11" if build >= 22000 else "Windows 10" if version.major == 10 else platform.platform()
    display_version = ""
    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows NT\CurrentVersion") as key:
            display_version = str(winreg.QueryValueEx(key, "DisplayVersion")[0])
            product_name = str(winreg.QueryValueEx(key, "ProductName")[0])
            if build < 22000:
                edition = product_name
    except OSError:
        pass
    label = f"{edition} {display_version} (build {build}), {machine or 'unknown architecture'}"
    return {"label": label, "supported": supported, "build": build, "machine": machine}


def inspect_vc_runtime() -> dict:
    key_path = r"SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64"
    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, key_path, 0, winreg.KEY_READ | winreg.KEY_WOW64_64KEY) as key:
            installed = int(winreg.QueryValueEx(key, "Installed")[0]) == 1
            version = str(winreg.QueryValueEx(key, "Version")[0])
    except OSError:
        return {"ok": False, "version": "not detected", "reason": "not installed"}
    ok = installed and _version_tuple(version) >= VC_MINIMUM
    return {"ok": ok, "version": version, "reason": "ready" if ok else "missing or older than 14.28"}


def inspect_install_location(target: Path) -> dict:
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(prefix=".gs-install-check-", dir=target.parent, delete=True):
            pass
        free = shutil.disk_usage(target.parent).free
        return {"writable": True, "free": free}
    except OSError:
        return {"writable": False, "free": 0}


def _required_webengine_files_present(payload: Path) -> tuple[list[str], int]:
    internal = payload / "_internal"
    missing = [relative for relative in WEBENGINE_FILES if not (internal / Path(relative)).is_file()]
    runtime_dlls = (internal / "VCRUNTIME140.dll").is_file() or (internal / "PySide6" / "VCRUNTIME140.dll").is_file()
    msvcp_dll = (internal / "PySide6" / "MSVCP140.dll").is_file()
    if not runtime_dlls:
        missing.append("VCRUNTIME140.dll (app-local)")
    if not msvcp_dll:
        missing.append("PySide6/MSVCP140.dll (app-local)")
    size, _count = _source_size_and_validate(payload)
    return missing, size


def inspect_package(source: Path) -> dict:
    if source.suffix.casefold() == ".zip" and source.is_file():
        if source.stat().st_size > MAX_ARCHIVE_BYTES:
            return {"ok": False, "message": "ZIP is larger than the 2 GB safety limit.", "size": 0, "is_zip": True}
        try:
            with zipfile.ZipFile(source, "r") as archive:
                files, expanded = _validate_archive(archive)
                names = {"/".join(_safe_zip_name(item.filename).parts).casefold() for item in files}
                exe_names = [name for name in names if name.endswith("/ghost surfer.exe") or name == "ghost surfer.exe"]
                roots = {name.rsplit("/", 1)[0] if "/" in name else "" for name in exe_names}
                if len(roots) != 1:
                    raise ValueError("The ZIP must contain exactly one Ghost Surfer payload.")
                prefix = next(iter(roots))
                expected = {f"{prefix}/_internal/{relative}".strip("/").casefold() for relative in WEBENGINE_FILES}
                missing = sorted(expected - names)
                if f"{prefix}/_internal/vcruntime140.dll" not in names and f"{prefix}/_internal/pyside6/vcruntime140.dll" not in names:
                    missing.append("VCRUNTIME140.dll (app-local)")
                if f"{prefix}/_internal/pyside6/msvcp140.dll" not in names:
                    missing.append("PySide6/MSVCP140.dll (app-local)")
                label = f"ZIP structure: {len(files):,} files, {expanded / (1024**2):,.0f} MiB expanded"
                return {"ok": not missing, "message": label if not missing else label + "; missing: " + ", ".join(missing), "size": expanded, "is_zip": True}
        except (OSError, zipfile.BadZipFile, ValueError) as exc:
            return {"ok": False, "message": f"Package check failed: {exc}", "size": 0, "is_zip": True}
    if source.is_dir():
        try:
            payload = _find_payload(source.resolve())
            missing, size = _required_webengine_files_present(payload)
            message = f"Payload: {size / (1024**2):,.0f} MiB; WebEngine runtime and Qt platform plugin present"
            if missing:
                message = "Payload is incomplete; missing " + ", ".join(missing)
            return {"ok": not missing, "message": message, "size": size, "is_zip": False}
        except (OSError, ValueError) as exc:
            return {"ok": False, "message": f"Package check failed: {exc}", "size": 0, "is_zip": False}
    return {"ok": False, "message": "Choose a ZIP package or extracted payload folder.", "size": 0, "is_zip": False}


def _safe_zip_name(name: str) -> PurePosixPath:
    normalized = name.replace("\\", "/")
    path = PurePosixPath(normalized)
    reserved = {"con", "prn", "aux", "nul", *(f"com{i}" for i in range(1, 10)), *(f"lpt{i}" for i in range(1, 10))}
    if path.is_absolute() or not path.parts or ".." in path.parts or any(":" in part for part in path.parts):
        raise ValueError("The package contains an unsafe path.")
    if any(part.rstrip(" .").split(".", 1)[0].casefold() in reserved or part.endswith((".", " ")) for part in path.parts):
        raise ValueError("The package contains a Windows-reserved filename.")
    return path


def _validate_archive(archive: zipfile.ZipFile) -> tuple[list[zipfile.ZipInfo], int]:
    entries = archive.infolist()
    if not entries or len(entries) > MAX_ARCHIVE_FILES:
        raise ValueError("The package has an invalid number of files.")
    seen: set[str] = set()
    expanded = 0
    files: list[zipfile.ZipInfo] = []
    for entry in entries:
        path = _safe_zip_name(entry.filename)
        key = "/".join(path.parts).casefold().rstrip("/")
        if key in seen:
            raise ValueError("The package contains duplicate file paths.")
        seen.add(key)
        if stat.S_ISLNK(entry.external_attr >> 16):
            raise ValueError("The package contains a symbolic link.")
        if entry.file_size < 0:
            raise ValueError("The package contains an invalid file size.")
        expanded += entry.file_size
        if expanded > MAX_EXPANDED_BYTES:
            raise ValueError("The package expands beyond the allowed size.")
        if not entry.is_dir():
            files.append(entry)
    return files, expanded


def _extract_archive(source: Path, destination: Path, progress) -> Path:
    if source.stat().st_size > MAX_ARCHIVE_BYTES:
        raise ValueError("The installer archive is larger than the 2 GB safety limit.")
    destination.mkdir(parents=True, exist_ok=False)
    with zipfile.ZipFile(source, "r") as archive:
        files, total_bytes = _validate_archive(archive)
        extracted = 0
        for entry in archive.infolist():
            relative = _safe_zip_name(entry.filename)
            target = destination.joinpath(*relative.parts)
            if entry.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            written = 0
            with archive.open(entry, "r") as input_stream, target.open("xb") as output_stream:
                while True:
                    chunk = input_stream.read(CHUNK_BYTES)
                    if not chunk:
                        break
                    written += len(chunk)
                    extracted += len(chunk)
                    if extracted > MAX_EXPANDED_BYTES or written > entry.file_size:
                        raise ValueError("The package expands beyond its declared size.")
                    output_stream.write(chunk)
                    progress(5 + int(35 * extracted / max(1, total_bytes)), f"Extracting package: {target.name}")
            if written != entry.file_size:
                raise ValueError("The package contains a truncated file.")
    return _find_payload(destination)


def _find_payload(source: Path) -> Path:
    candidates: list[Path] = []
    direct = source / APP_EXE_NAME
    nested = source / "Ghost Surfer" / APP_EXE_NAME
    if direct.is_file():
        candidates.append(source)
    if nested.is_file():
        candidates.append(source / "Ghost Surfer")
    if not candidates:
        try:
            for exe in source.glob("release-*/Ghost Surfer/Ghost Surfer.exe"):
                candidates.append(exe.parent)
        except OSError:
            pass
    candidates = [candidate for candidate in candidates if (candidate / "_internal").is_dir()]
    unique = {str(candidate.resolve()).casefold(): candidate.resolve() for candidate in candidates}
    if len(unique) != 1:
        raise ValueError("Select the Ghost Surfer payload folder, or a ZIP containing one payload. The folder must contain Ghost Surfer.exe and _internal.")
    return next(iter(unique.values()))


def _source_size_and_validate(source: Path) -> tuple[int, int]:
    total = 0
    count = 0
    for current, directories, names in os.walk(source, followlinks=False):
        current_path = Path(current)
        for name in list(directories):
            path = current_path / name
            if path.is_symlink():
                raise ValueError("The application payload contains a symbolic link.")
        for name in names:
            path = current_path / name
            if path.is_symlink() or not path.is_file():
                raise ValueError("The application payload contains an unsupported file.")
            count += 1
            total += path.stat().st_size
            if count > MAX_ARCHIVE_FILES or total > MAX_EXPANDED_BYTES:
                raise ValueError("The application payload is larger than the supported safety limits.")
    return total, count


def _copy_payload(source: Path, destination: Path, progress) -> None:
    total, _count = _source_size_and_validate(source)
    copied = 0
    destination.mkdir(parents=True, exist_ok=False)
    for current, directories, names in os.walk(source, followlinks=False):
        source_dir = Path(current)
        relative_dir = source_dir.relative_to(source)
        target_dir = destination / relative_dir
        target_dir.mkdir(parents=True, exist_ok=True)
        for name in directories:
            (target_dir / name).mkdir(exist_ok=True)
        for name in names:
            src = source_dir / name
            if src.is_symlink() or not src.is_file():
                raise ValueError("The application payload changed while it was being copied.")
            dst = target_dir / name
            with src.open("rb") as input_stream, dst.open("xb") as output_stream:
                while True:
                    chunk = input_stream.read(CHUNK_BYTES)
                    if not chunk:
                        break
                    output_stream.write(chunk)
                    copied += len(chunk)
                    progress(40 + int(50 * copied / max(1, total)), f"Copying {name}")
            shutil.copystat(src, dst, follow_symlinks=False)


def _quoted_ps(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _powershell(script: str) -> str:
    executable = shutil.which("powershell.exe") or str(Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe")
    if not Path(executable).is_file():
        raise RuntimeError("Windows PowerShell could not be found to create shortcuts.")
    encoded = base64.b64encode(script.encode("utf-16le")).decode("ascii")
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    result = subprocess.run(
        [executable, "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
        capture_output=True,
        text=True,
        timeout=30,
        creationflags=flags,
    )
    if result.returncode:
        raise RuntimeError((result.stderr or "Windows PowerShell command failed.").strip()[:800])
    return result.stdout.strip()


def _create_shortcuts(target: Path, include_desktop: bool) -> None:
    exe = target / APP_EXE_NAME
    start_menu = Path(os.environ["APPDATA"]) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Ghost Surfer"
    script = (
        "$shell = New-Object -ComObject WScript.Shell; "
        f"$menu = {_quoted_ps(str(start_menu))}; "
        "New-Item -ItemType Directory -Path $menu -Force | Out-Null; "
        "$shortcut = $shell.CreateShortcut((Join-Path $menu 'Ghost Surfer.lnk')); "
        f"$shortcut.TargetPath = {_quoted_ps(str(exe))}; "
        f"$shortcut.WorkingDirectory = {_quoted_ps(str(target))}; "
        "$shortcut.Save(); "
    )
    if include_desktop:
        script += (
            "$desktop = [Environment]::GetFolderPath('Desktop'); "
            "$shortcut = $shell.CreateShortcut((Join-Path $desktop 'Ghost Surfer.lnk')); "
            f"$shortcut.TargetPath = {_quoted_ps(str(exe))}; "
            f"$shortcut.WorkingDirectory = {_quoted_ps(str(target))}; "
            "$shortcut.Save(); "
        )
    _powershell(script)


def _remove_shortcuts() -> None:
    start_menu = Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Ghost Surfer"
    script = (
        f"$menu = {_quoted_ps(str(start_menu))}; "
        "Remove-Item -LiteralPath (Join-Path $menu 'Ghost Surfer.lnk') -Force -ErrorAction SilentlyContinue; "
        "$desktop = [Environment]::GetFolderPath('Desktop'); "
        "Remove-Item -LiteralPath (Join-Path $desktop 'Ghost Surfer.lnk') -Force -ErrorAction SilentlyContinue; "
        "try { Remove-Item -LiteralPath $menu -Force -ErrorAction Stop } catch { }"
    )
    try:
        _powershell(script)
    except Exception:
        pass


def _running_pids(executable: Path) -> list[int]:
    if os.name != "nt":
        return []

    class PROCESSENTRY32W(ctypes.Structure):
        _fields_ = [
            ("dwSize", ctypes.c_ulong), ("cntUsage", ctypes.c_ulong), ("th32ProcessID", ctypes.c_ulong),
            ("th32DefaultHeapID", ctypes.c_size_t), ("th32ModuleID", ctypes.c_ulong), ("cntThreads", ctypes.c_ulong),
            ("th32ParentProcessID", ctypes.c_ulong), ("pcPriClassBase", ctypes.c_long), ("dwFlags", ctypes.c_ulong),
            ("szExeFile", ctypes.c_wchar * 260),
        ]

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateToolhelp32Snapshot.argtypes = [ctypes.c_ulong, ctypes.c_ulong]
    kernel.CreateToolhelp32Snapshot.restype = ctypes.c_void_p
    kernel.Process32FirstW.argtypes = [ctypes.c_void_p, ctypes.POINTER(PROCESSENTRY32W)]
    kernel.Process32NextW.argtypes = [ctypes.c_void_p, ctypes.POINTER(PROCESSENTRY32W)]
    kernel.OpenProcess.argtypes = [ctypes.c_ulong, ctypes.c_int, ctypes.c_ulong]
    kernel.OpenProcess.restype = ctypes.c_void_p
    kernel.QueryFullProcessImageNameW.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_wchar_p, ctypes.POINTER(ctypes.c_ulong)]
    kernel.CloseHandle.argtypes = [ctypes.c_void_p]
    snapshot = kernel.CreateToolhelp32Snapshot(0x00000002, 0)
    if snapshot in (0, ctypes.c_void_p(-1).value):
        raise RuntimeError("Windows could not check whether Ghost Surfer is running; retry the operation.")
    expected = os.path.normcase(os.path.abspath(executable))
    matches: list[int] = []
    entry = PROCESSENTRY32W()
    entry.dwSize = ctypes.sizeof(entry)
    try:
        ok = kernel.Process32FirstW(snapshot, ctypes.byref(entry))
        while ok:
            if entry.szExeFile.casefold() == APP_EXE_NAME.casefold():
                handle = kernel.OpenProcess(0x1000, False, entry.th32ProcessID)
                if not handle:
                    raise RuntimeError("Windows found a Ghost Surfer process but could not verify its path. Close Ghost Surfer or retry before changing its files.")
                try:
                    buffer = ctypes.create_unicode_buffer(32768)
                    length = ctypes.c_ulong(len(buffer))
                    if not kernel.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(length)):
                        raise RuntimeError("Windows found a Ghost Surfer process but could not verify its path. Close Ghost Surfer or retry before changing its files.")
                    if os.path.normcase(os.path.abspath(buffer.value)) == expected:
                        matches.append(int(entry.th32ProcessID))
                finally:
                    kernel.CloseHandle(handle)
            ok = kernel.Process32NextW(snapshot, ctypes.byref(entry))
    finally:
        kernel.CloseHandle(snapshot)
    return matches


class OperationWorker(QObject):
    progress = Signal(int, str)
    finished = Signal(bool, str)
    queued = Signal(bool, str)

    def __init__(self, mode: str, source: Path | None, target: Path, desktop_shortcut: bool = False, install_vc: bool = False, personal_vault_enabled: bool = True):
        super().__init__()
        self.mode = mode
        self.source = source
        self.target = target
        self.desktop_shortcut = desktop_shortcut
        self.install_vc = install_vc
        self.personal_vault_enabled = personal_vault_enabled
        self.cancel_requested = threading.Event()

    def cancel(self) -> None:
        self.cancel_requested.set()

    @Slot()
    def run(self) -> None:
        try:
            self._wait_for_app_to_close()
            if self.mode == "uninstall":
                self._uninstall()
                success_message = "Ghost Surfer was removed. Browser profile and browsing data were kept."
            else:
                self._install()
                success_message = "Ghost Surfer is installed and ready."
        except Exception as exc:
            self.finished.emit(False, str(exc) or exc.__class__.__name__)
        else:
            self.finished.emit(True, success_message)

    def _wait_for_app_to_close(self) -> None:
        pids = _running_pids(self.target / APP_EXE_NAME)
        if not pids:
            return
        action = {"install": "Install", "update": "Update", "uninstall": "Uninstall"}.get(self.mode, "Operation")
        self.queued.emit(True, f"{action} queued. Ghost Surfer is open; save your work and close it when convenient. The manager will continue without force-closing it.")
        last_notice = time.monotonic()
        while pids:
            if self.cancel_requested.is_set():
                message = f"Queued {action.lower()} canceled. No Ghost Surfer files were changed."
                self.queued.emit(False, message)
                raise RuntimeError(message)
            self.cancel_requested.wait(1.5)
            pids = _running_pids(self.target / APP_EXE_NAME)
            if pids and time.monotonic() - last_notice >= 20:
                self.queued.emit(True, f"{action} remains queued while Ghost Surfer is open. Close it when convenient, or cancel the queued operation.")
                last_notice = time.monotonic()
        self.queued.emit(False, f"Ghost Surfer has closed; continuing the {action.lower()}.")

    def _install(self) -> None:
        if self.source is None:
            raise ValueError("Choose a Ghost Surfer package first.")
        if self.install_vc:
            self._install_vc_runtime()
        self.target.parent.mkdir(parents=True, exist_ok=True)
        resolved_target = self.target.resolve()
        expected_parent = (Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "Programs").resolve()
        if resolved_target.parent != expected_parent or self.target.is_symlink():
            raise ValueError("The Ghost Surfer install location failed its safety check.")
        if self.source.suffix.casefold() == ".zip" and self.source.is_file():
            with tempfile.TemporaryDirectory(prefix=".gs-install-manager-package-", dir=self.target.parent) as temporary:
                payload = _extract_archive(self.source, Path(temporary) / "extract", self.progress.emit)
                self._copy_commit(payload, self.personal_vault_enabled if self.mode == "install" else None)
        elif self.source.is_dir():
            payload = _find_payload(self.source.resolve())
            if self.target.parent.resolve().is_relative_to(payload):
                raise ValueError("Choose the Ghost Surfer payload folder, not a parent containing the install location.")
            self._copy_commit(payload, self.personal_vault_enabled if self.mode == "install" else None)
        else:
            raise ValueError("Choose an extracted Ghost Surfer payload folder or a .zip package.")
        self.progress.emit(96, "Creating Start Menu shortcuts")
        _create_shortcuts(self.target, self.desktop_shortcut)
        self.progress.emit(100, "Installation complete")

    def _install_vc_runtime(self) -> None:
        if inspect_vc_runtime()["ok"]:
            return
        self.progress.emit(2, "Downloading the official Microsoft Visual C++ x64 runtime")
        cache = Path(tempfile.gettempdir()) / "GSInstallManager"
        cache.mkdir(parents=True, exist_ok=True)
        installer = cache / "vc_redist.x64.exe"
        request = urllib.request.Request(VC_REDIST_URL, headers={"User-Agent": "GS-Install-Manager/1.0"})
        digest = hashlib.sha256()
        downloaded = 0
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                final_url = urllib.parse.urlparse(response.geturl())
                host = (final_url.hostname or "").casefold()
                if final_url.scheme != "https" or not (host == "aka.ms" or host == "microsoft.com" or host.endswith(".microsoft.com") or host == "visualstudio.com" or host.endswith(".visualstudio.com")):
                    raise RuntimeError("The Microsoft download redirected outside approved HTTPS Microsoft domains.")
                declared = response.headers.get("Content-Length")
                if declared and int(declared) > VC_DOWNLOAD_LIMIT:
                    raise RuntimeError("The Microsoft runtime download exceeded the size limit.")
                with installer.open("wb") as output:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        downloaded += len(chunk)
                        if downloaded > VC_DOWNLOAD_LIMIT:
                            raise RuntimeError("The Microsoft runtime download exceeded the size limit.")
                        output.write(chunk)
                        digest.update(chunk)
                        self.progress.emit(4, f"Downloading Microsoft runtime ({downloaded / (1024**2):.0f} MiB)")
                    output.flush()
                    os.fsync(output.fileno())
        except RuntimeError:
            installer.unlink(missing_ok=True)
            raise
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
            installer.unlink(missing_ok=True)
            raise RuntimeError(f"Could not download the Microsoft runtime. Check your connection and try again ({exc.__class__.__name__}).") from None
        if downloaded == 0 or (declared and downloaded != int(declared)):
            installer.unlink(missing_ok=True)
            raise RuntimeError("The Microsoft runtime download was empty or incomplete.")
        digest_before = digest.hexdigest()
        self.progress.emit(5, "Verifying Microsoft Authenticode signature and SHA-256")
        signature_command = (
            f"$sig = Get-AuthenticodeSignature -FilePath {_quoted_ps(str(installer))}; "
            "if ($sig.Status -ne 'Valid') { throw 'The Microsoft signature is not valid.' }; "
            "if ($sig.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') { throw 'The signer is not Microsoft Corporation.' }; "
            "Write-Output $sig.SignerCertificate.Subject"
        )
        try:
            signer = _powershell(signature_command)
        except Exception:
            installer.unlink(missing_ok=True)
            raise RuntimeError("The downloaded runtime failed Microsoft signature verification; it was not installed.") from None
        if not signer or not _sha256_file(installer) == digest_before:
            installer.unlink(missing_ok=True)
            raise RuntimeError("The downloaded runtime changed during verification; it was not installed.")
        self.progress.emit(8, f"Verified Microsoft signer and SHA-256 {digest_before[:16]}…; requesting UAC approval")
        powershell = shutil.which("powershell.exe") or str(Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe")
        script = (
            f"$p = Start-Process -FilePath {_quoted_ps(str(installer))} "
            "-ArgumentList '/install /quiet /norestart' -Verb RunAs -Wait -PassThru; "
            "exit $p.ExitCode"
        )
        encoded = base64.b64encode(script.encode("utf-16le")).decode("ascii")
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        try:
            result = subprocess.run(
                [powershell, "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
                capture_output=True,
                text=True,
                timeout=600,
                creationflags=flags,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise RuntimeError(f"Microsoft runtime installation did not complete ({exc.__class__.__name__}).") from None
        if result.returncode not in (0, 3010) or not inspect_vc_runtime()["ok"]:
            raise RuntimeError("Microsoft runtime installation failed, was canceled, or needs a restart. No Ghost Surfer files were changed.")
        installer.unlink(missing_ok=True)

    def _copy_commit(self, payload: Path, personal_vault_enabled: bool | None = None) -> None:
        stage = self.target.parent / f".gs-install-manager-stage-{uuid.uuid4().hex}"
        backup = self.target.parent / f".gs-install-manager-backup-{uuid.uuid4().hex}"
        try:
            _copy_payload(payload, stage, self.progress.emit)
            if not (stage / APP_EXE_NAME).is_file() or not (stage / "_internal").is_dir():
                raise ValueError("The staged payload is incomplete.")
            vault_marker = stage / "personal-vault.enabled"
            if personal_vault_enabled is True:
                vault_marker.write_text("enabled\n", encoding="ascii")
            elif personal_vault_enabled is False:
                vault_marker.unlink(missing_ok=True)
            elif (self.target / "personal-vault.enabled").is_file():
                vault_marker.write_text("enabled\n", encoding="ascii")
            moved_existing = False
            if self.target.exists():
                if self.target.is_symlink() or not self.target.is_dir():
                    raise ValueError("The existing install path is not a regular directory.")
                self.target.replace(backup)
                moved_existing = True
            try:
                stage.replace(self.target)
            except Exception:
                if moved_existing and backup.exists():
                    backup.replace(self.target)
                raise
            if moved_existing:
                shutil.rmtree(backup)
        finally:
            if stage.exists():
                shutil.rmtree(stage, ignore_errors=True)

    def _uninstall(self) -> None:
        expected = install_directory().resolve()
        if self.target.resolve() != expected or self.target.is_symlink():
            raise ValueError("Refusing to remove files outside the standard Ghost Surfer install folder.")
        if not self.target.exists():
            raise ValueError("Ghost Surfer is not installed in the standard per-user location.")
        if self.target.is_file():
            raise ValueError("The Ghost Surfer install path is not a directory.")
        self.progress.emit(20, "Removing program files")
        shutil.rmtree(self.target)
        self.progress.emit(80, "Removing Ghost Surfer shortcuts")
        _remove_shortcuts()
        self.progress.emit(100, "Ghost Surfer removed; browser data was kept")


class InstallManagerWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.target = install_directory()
        self.source: Path | None = None
        self.thread: QThread | None = None
        self.worker: OperationWorker | None = None
        self.setWindowTitle(APP_TITLE)
        icon_path = asset_path("ghost-surfer-icon.svg")
        if icon_path.is_file():
            self.setWindowIcon(QIcon(str(icon_path)))
        self.setMinimumSize(760, 620)
        self.resize(920, 760)
        self._build_ui()
        self._refresh_state()
        bundled_payload = self._discover_bundled_payload()
        if bundled_payload is not None:
            self.source = bundled_payload
            self.source_edit.setText(str(bundled_payload))
            self.progress_label.setText("Bundled Ghost Surfer payload found. Install or Update is ready.")
        self._refresh_checks()
        self._refresh_state()

    def _discover_bundled_payload(self) -> Path | None:
        manager_path = Path(sys.executable if getattr(sys, "frozen", False) else __file__).resolve().parent
        sibling_payload = manager_path / "Ghost Surfer"
        try:
            _find_payload(sibling_payload)
        except (OSError, ValueError):
            return None
        return sibling_payload

    def _build_ui(self) -> None:
        root = QWidget()
        layout = QVBoxLayout(root)
        layout.setContentsMargins(28, 26, 28, 24)
        layout.setSpacing(16)

        header = QHBoxLayout()
        header.setSpacing(14)
        brand_icon = QLabel()
        brand_icon.setFixedSize(58, 58)
        icon_path = asset_path("ghost-surfer-icon.svg")
        if icon_path.is_file():
            brand_icon.setPixmap(QIcon(str(icon_path)).pixmap(58, 58))
            brand_icon.setAccessibleName("Ghost Surfer logo")
        header.addWidget(brand_icon, 0, Qt.AlignmentFlag.AlignVCenter)
        title_stack = QVBoxLayout()
        title_stack.setSpacing(2)
        brand = QLabel("GS Install Manager")
        brand.setObjectName("title")
        subtitle = QLabel("Install, update, or remove Ghost Surfer for this Windows account.")
        subtitle.setObjectName("subtitle")
        title_stack.addWidget(brand)
        title_stack.addWidget(subtitle)
        header.addLayout(title_stack)
        header.addStretch(1)
        self.legal_button = QPushButton("Help / Legal")
        self.legal_button.clicked.connect(self._show_legal)
        header.addWidget(self.legal_button, 0, Qt.AlignmentFlag.AlignVCenter)
        layout.addLayout(header)

        status_card = QFrame()
        status_card.setObjectName("card")
        status_layout = QVBoxLayout(status_card)
        status_layout.setContentsMargins(18, 14, 18, 14)
        self.install_status = QLabel()
        self.install_status.setObjectName("installStatus")
        self.install_path_label = QLabel(str(self.target))
        self.install_path_label.setObjectName("pathLabel")
        self.profile_note = QLabel(f"Your bookmarks, browsing data, and web profile stay in {profile_directory()} and are never removed by updates or uninstall.")
        self.profile_note.setObjectName("profileNote")
        self.profile_note.setWordWrap(True)
        status_layout.addWidget(self.install_status)
        status_layout.addWidget(self.install_path_label)
        status_layout.addWidget(self.profile_note)
        layout.addWidget(status_card)

        check_card = QFrame()
        check_card.setObjectName("checkCard")
        check_layout = QVBoxLayout(check_card)
        check_layout.setContentsMargins(18, 14, 18, 14)
        check_layout.setSpacing(6)
        check_heading = QLabel("Target PC readiness")
        check_heading.setObjectName("sectionLabel")
        check_layout.addWidget(check_heading)
        check_scope = QLabel("Checks run on this PC. Run GS Install Manager on each target Windows PC to check it there.")
        check_scope.setObjectName("profileNote")
        check_scope.setWordWrap(True)
        check_layout.addWidget(check_scope)
        self.os_check_label = QLabel()
        self.vc_check_label = QLabel()
        self.location_check_label = QLabel()
        self.disk_check_label = QLabel()
        self.payload_check_label = QLabel()
        for label in (self.os_check_label, self.vc_check_label, self.location_check_label, self.disk_check_label, self.payload_check_label):
            label.setObjectName("checkLine")
            label.setWordWrap(True)
            check_layout.addWidget(label)
        layout.addWidget(check_card)

        package_label = QLabel("Ghost Surfer package")
        package_label.setObjectName("sectionLabel")
        layout.addWidget(package_label)
        source_row = QHBoxLayout()
        self.source_edit = QLineEdit()
        self.source_edit.setReadOnly(True)
        self.source_edit.setPlaceholderText("Choose an extracted payload folder or installer .zip")
        self.source_edit.setAccessibleName("Selected Ghost Surfer package")
        source_row.addWidget(self.source_edit, 1)
        self.folder_button = QPushButton("Browse folder")
        self.folder_button.clicked.connect(self._choose_folder)
        self.zip_button = QPushButton("Browse ZIP")
        self.zip_button.clicked.connect(self._choose_zip)
        source_row.addWidget(self.folder_button)
        source_row.addWidget(self.zip_button)
        layout.addLayout(source_row)

        self.desktop_check = QCheckBox("Create a desktop shortcut")
        self.desktop_check.setChecked(False)
        layout.addWidget(self.desktop_check)
        self.personal_vault_check = QCheckBox("Enable Personal Data Vault (names, addresses, phone numbers, usernames, passwords)")
        self.personal_vault_check.setChecked(True)
        self.personal_vault_check.setToolTip("Credit cards are not stored. You can turn the module off or on later in Ghost Control > Tabs & Data.")
        layout.addWidget(self.personal_vault_check)
        layout.addStretch(1)

        self.progress_label = QLabel("Ready")
        self.progress_label.setObjectName("progressLabel")
        self.progress = QProgressBar()
        self.progress.setRange(0, 100)
        self.progress.setValue(0)
        layout.addWidget(self.progress_label)
        layout.addWidget(self.progress)

        actions = QHBoxLayout()
        self.launch_button = QPushButton("Launch Ghost Surfer")
        self.launch_button.clicked.connect(self._launch)
        self.remove_button = QPushButton("Uninstall")
        self.remove_button.setObjectName("dangerButton")
        self.remove_button.clicked.connect(self._uninstall)
        self.install_button = QPushButton("Install")
        self.install_button.setObjectName("primaryButton")
        self.install_button.clicked.connect(self._start_install)
        self.update_button = QPushButton("Update")
        self.update_button.setObjectName("primaryButton")
        self.update_button.clicked.connect(self._start_update)
        self.cancel_button = QPushButton("Cancel queued")
        self.cancel_button.setObjectName("dangerButton")
        self.cancel_button.clicked.connect(self._cancel_queued)
        self.cancel_button.hide()
        actions.addWidget(self.launch_button)
        actions.addWidget(self.remove_button)
        actions.addStretch(1)
        actions.addWidget(self.install_button)
        actions.addWidget(self.update_button)
        actions.addWidget(self.cancel_button)
        layout.addLayout(actions)
        self.setCentralWidget(root)
        self.setStyleSheet("""
            QMainWindow { background: #07101b; color: #edf5ff; }
            QWidget { font-family: 'Segoe UI'; font-size: 10pt; }
            QLabel#title { color: #ffffff; font-size: 26pt; font-weight: 800; }
            QLabel#subtitle { color: #a8bfd7; font-size: 11pt; }
            QFrame#card { background: #101d2b; border: 1px solid #2d4864; border-radius: 12px; }
            QFrame#checkCard { background: #0c1723; border: 1px solid #253e56; border-radius: 12px; }
            QLabel#checkLine { color: #d2e1ef; font-size: 9pt; }
            QLabel#installStatus { color: #82d4ff; font-size: 12pt; font-weight: 700; }
            QLabel#pathLabel { color: #d5e5f4; font-family: Consolas; font-size: 9pt; }
            QLabel#profileNote { color: #9fb5ca; font-size: 9pt; }
            QLabel#sectionLabel { color: #8fd6ff; font-size: 10pt; font-weight: 700; }
            QLineEdit { background: #030a12; color: #ffffff; border: 1px solid #365470; border-radius: 8px; padding: 10px; min-height: 22px; }
            QPushButton { background: #172638; color: #f4f8fc; border: 1px solid #3b5875; border-radius: 8px; padding: 10px 16px; min-height: 24px; font-weight: 650; }
            QPushButton:hover { background: #21415e; border-color: #79cfff; }
            QPushButton:disabled { color: #718194; background: #101721; border-color: #202d3a; }
            QPushButton#primaryButton { background: #167bb0; border-color: #56c3ff; color: #ffffff; }
            QPushButton#primaryButton:hover { background: #1f91cd; }
            QPushButton#dangerButton { color: #ffbcbc; border-color: #8e4249; }
            QCheckBox { color: #dce8f5; spacing: 8px; }
            QProgressBar { background: #030a12; color: #ffffff; border: 1px solid #365470; border-radius: 7px; text-align: center; min-height: 18px; }
            QProgressBar::chunk { background: #1682ba; border-radius: 6px; }
            QLabel#progressLabel { color: #a8bfd7; }
        """)

    def _refresh_state(self) -> None:
        installed = (self.target / APP_EXE_NAME).is_file() and (self.target / "_internal").is_dir()
        self.install_status.setText("Ghost Surfer is installed" if installed else "Ghost Surfer is not installed yet")
        self.launch_button.setEnabled(installed)
        self.remove_button.setEnabled(installed)
        self.install_button.setEnabled(not installed)
        self.update_button.setEnabled(installed)
        self.personal_vault_check.setEnabled(not installed)

    def _refresh_checks(self) -> None:
        os_info = inspect_os()
        vc_info = inspect_vc_runtime()
        location = inspect_install_location(self.target)
        self.system_checks = {"os": os_info, "vc": vc_info, "location": location}
        os_mark = "READY" if os_info["supported"] else "UNSUPPORTED"
        self.os_check_label.setText(f"OS / architecture: {os_mark} — {os_info['label']} (needs Windows 10 1809+ or Windows 11, x64)")
        vc_mark = "READY" if vc_info["ok"] else "MISSING"
        self.vc_check_label.setText(f"Microsoft Visual C++ x64 runtime: {vc_mark} — {vc_info['version']} (required 14.28 or newer)")
        self.location_check_label.setText(f"Install location: {'WRITABLE' if location['writable'] else 'NOT WRITABLE'} — {self.target}")
        if self.source is None:
            self.disk_check_label.setText(f"Free space: {location['free'] / (1024**3):,.1f} GiB — choose a package to calculate required staging space")
            self.payload_check_label.setText("App payload / WebEngine: not checked — choose a ZIP or payload folder")
            self.system_checks.update({"payload": {"ok": False, "message": "No package selected", "size": 0}, "disk_ok": False})
            return
        package = inspect_package(self.source)
        factor = 2 if package.get("is_zip") else 1
        required = int(package.get("size", 0)) * factor + 512 * 1024 * 1024
        disk_ok = location["free"] >= required
        self.disk_check_label.setText(
            f"Free space: {location['free'] / (1024**3):,.1f} GiB — "
            f"{'READY' if disk_ok else 'LOW SPACE'}; about {required / (1024**3):,.1f} GiB needed for staging"
        )
        self.payload_check_label.setText(f"App payload / WebEngine: {'READY' if package['ok'] else 'INCOMPLETE'} — {package['message']}")
        self.system_checks.update({"payload": package, "disk_ok": disk_ok, "required_bytes": required})

    def _choose_folder(self) -> None:
        folder = QFileDialog.getExistingDirectory(self, "Select Ghost Surfer payload folder", str(Path.home()))
        if folder:
            self._set_source(Path(folder))

    def _choose_zip(self) -> None:
        filename, _filter = QFileDialog.getOpenFileName(self, "Select Ghost Surfer ZIP package", str(Path.home()), "ZIP packages (*.zip)")
        if filename:
            self._set_source(Path(filename))

    def _set_source(self, source: Path) -> None:
        self.source = source
        self.source_edit.setText(str(source))
        self.progress_label.setText("Package selected. Install or Update when ready.")
        self._refresh_checks()

    def _begin_operation(self, mode: str, install_vc: bool = False) -> None:
        if self.thread is not None:
            return
        self.install_button.setEnabled(False)
        self.update_button.setEnabled(False)
        self.remove_button.setEnabled(False)
        self.launch_button.setEnabled(False)
        self.folder_button.setEnabled(False)
        self.zip_button.setEnabled(False)
        self.desktop_check.setEnabled(False)
        self.personal_vault_check.setEnabled(False)
        self.cancel_button.hide()
        self.progress.setValue(0)
        self.thread = QThread(self)
        self.worker = OperationWorker(mode, self.source, self.target, self.desktop_check.isChecked(), install_vc, self.personal_vault_check.isChecked())
        self.worker.moveToThread(self.thread)
        self.thread.started.connect(self.worker.run)
        self.worker.progress.connect(self._on_progress)
        self.worker.queued.connect(self._on_queued)
        self.worker.finished.connect(self._on_finished)
        self.worker.finished.connect(self.thread.quit)
        self.worker.finished.connect(self.worker.deleteLater)
        self.thread.finished.connect(self._on_thread_finished)
        self.thread.finished.connect(self.thread.deleteLater)
        self.thread.start()

    @Slot(int, str)
    def _on_progress(self, percent: int, message: str) -> None:
        self.progress.setValue(percent)
        self.progress_label.setText(message)

    @Slot(bool, str)
    def _on_queued(self, is_queued: bool, message: str) -> None:
        self.progress_label.setText(message)
        self.cancel_button.setVisible(is_queued)
        self.cancel_button.setEnabled(is_queued)

    @Slot(bool, str)
    def _on_finished(self, success: bool, message: str) -> None:
        self.progress_label.setText(message)
        if success:
            self.progress.setValue(100)
            self._refresh_state()
        else:
            QMessageBox.critical(self, "Operation could not be completed", message)

    @Slot()
    def _on_thread_finished(self) -> None:
        self.thread = None
        self.worker = None
        self.personal_vault_check.setEnabled(not (self.target / APP_EXE_NAME).is_file())
        self.cancel_button.hide()
        self.folder_button.setEnabled(True)
        self.zip_button.setEnabled(True)
        self.desktop_check.setEnabled(True)
        self._refresh_state()
        self._refresh_checks()

    def _start_install(self) -> None:
        if self.install_button.isEnabled():
            self._install("install")

    def _start_update(self) -> None:
        if self.update_button.isEnabled():
            self._install("update")

    def _install(self, mode: str) -> None:
        # Re-detect immediately before acting so a changed installation state
        # cannot route an Install click into an update (or vice versa).
        self._refresh_state()
        installed = (self.target / APP_EXE_NAME).is_file() and (self.target / "_internal").is_dir()
        if mode == "install" and installed:
            self.progress_label.setText("Ghost Surfer is already installed. Use Update.")
            return
        if mode == "update" and not installed:
            self.progress_label.setText("Ghost Surfer is not installed. Use Install.")
            return
        if self.source is None:
            QMessageBox.information(self, "Choose a package", "Select an extracted Ghost Surfer payload folder or installer ZIP first.")
            return
        self._refresh_checks()
        checks = self.system_checks
        if not checks["os"]["supported"]:
            QMessageBox.critical(self, "Unsupported Windows machine", "This Ghost Surfer package requires Windows 10 version 1809 (build 17763) or newer, Windows 11, and x64 architecture.")
            return
        if not checks["location"]["writable"]:
            QMessageBox.critical(self, "Install folder is not writable", "Windows could not write to the per-user Programs folder. No files have been installed.")
            return
        if not checks["payload"]["ok"]:
            QMessageBox.critical(self, "Incomplete app package", checks["payload"]["message"])
            return
        if not checks["disk_ok"]:
            QMessageBox.critical(self, "Not enough disk space", "The selected package needs more free space for validation and staging. Free space and try again.")
            return
        install_vc = not checks["vc"]["ok"]
        if install_vc:
            answer = QMessageBox.question(
                self,
                "Install Microsoft Visual C++ runtime?",
                "This PC is missing the required Microsoft Visual C++ x64 runtime (14.28 or newer). If you continue, GS Install Manager will: (1) download the runtime from Microsoft's official HTTPS endpoint, (2) verify the download source, Microsoft Authenticode signature, and SHA-256, (3) ask Windows for UAC approval to install the runtime, then (4) validate and stage Ghost Surfer and swap its program files only after the prerequisite succeeds. Cancel here, decline UAC, or fail verification and the operation stops; Ghost Surfer program files will not be changed.",
                QMessageBox.StandardButton.Cancel | QMessageBox.StandardButton.Yes,
                QMessageBox.StandardButton.Cancel,
            )
            if answer != QMessageBox.StandardButton.Yes:
                return
            self.progress_label.setText("Runtime consent recorded. Downloading and verifying before installation.")
        self._begin_operation(mode, install_vc=install_vc)

    def _cancel_queued(self) -> None:
        if self.worker is not None:
            self.worker.cancel()
            self.cancel_button.setEnabled(False)
            self.progress_label.setText("Canceling queued operation…")

    def _uninstall(self) -> None:
        self._begin_operation("uninstall")

    def _launch(self) -> None:
        executable = self.target / APP_EXE_NAME
        if not executable.is_file():
            self._refresh_state()
            return
        try:
            subprocess.Popen([str(executable)], cwd=str(self.target))
        except OSError as exc:
            QMessageBox.critical(self, "Could not launch Ghost Surfer", str(exc))

    def _show_legal(self) -> None:
        LegalConsentDialog(self, require_accept=False).exec()

    def activate_window(self) -> None:
        if self.isMinimized():
            self.showNormal()
        else:
            self.show()
        self.raise_()
        self.activateWindow()


class LegalConsentDialog(QDialog):
    def __init__(self, parent=None, *, require_accept: bool):
        super().__init__(parent)
        self.setWindowTitle("Welcome to Ghost Surfer" if require_accept else "Ghost Surfer — Help & Legal")
        self.setMinimumSize(780, 580)
        self.resize(900, 700)
        self.setStyleSheet("""
            QDialog { background: #f5f8fc; color: #18283c; }
            QLabel#legalTitle { color: #10243b; font-size: 20pt; font-weight: 750; }
            QLabel#legalSubtitle { color: #50657d; font-size: 10pt; }
            QTabWidget::pane { background: #ffffff; border: 1px solid #d3dfeb; border-radius: 8px; }
            QTabBar::tab { background: #e8eef5; color: #34485f; padding: 9px 13px; border: 1px solid #d3dfeb; border-bottom: 0; }
            QTabBar::tab:selected { background: #ffffff; color: #0d5f98; font-weight: 700; }
            QCheckBox { color: #172d45; font-weight: 650; spacing: 9px; }
            QPushButton { background: #ffffff; color: #20364d; border: 1px solid #a9bbcd; border-radius: 7px; padding: 10px 18px; min-height: 22px; font-weight: 650; }
            QPushButton#acceptButton { background: #087ab7; color: #ffffff; border-color: #087ab7; min-width: 170px; }
            QPushButton#acceptButton:hover { background: #06699e; }
            QPushButton:disabled { color: #92a0ae; background: #e9eef3; border-color: #d2dbe4; }
        """)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(22, 20, 22, 18)
        layout.setSpacing(13)
        header = QHBoxLayout()
        header.setSpacing(14)
        logo = QLabel()
        logo.setFixedSize(58, 58)
        icon_path = asset_path("ghost-surfer-icon.svg")
        if icon_path.is_file():
            logo.setPixmap(QIcon(str(icon_path)).pixmap(58, 58))
        header.addWidget(logo, 0, Qt.AlignmentFlag.AlignTop)
        heading = QVBoxLayout()
        heading.setSpacing(3)
        title = QLabel("Welcome to Ghost Surfer" if require_accept else "Ghost Surfer Help & Legal")
        title.setObjectName("legalTitle")
        subtitle = QLabel(
            "Review the terms and notices before continuing. Accept the Terms and License to use GS Install Manager."
            if require_accept else "Browse the product terms, privacy details, support information, and notices."
        )
        subtitle.setObjectName("legalSubtitle")
        subtitle.setWordWrap(True)
        heading.addWidget(title)
        heading.addWidget(subtitle)
        header.addLayout(heading, 1)
        layout.addLayout(header)
        self.tabs = QTabWidget()
        self.tabs.addTab(self._source_group((
            ("Terms of Use", "terms.html"),
            ("License", "license.html"),
            ("Acceptable Use", "acceptable-use.html"),
            ("Refunds & Downloads", "refunds.html"),
        )), "Consent & Terms")

        self.tabs.addTab(self._source_group((
            ("Privacy", "privacy.html"),
            ("Cookies", "cookies.html"),
            ("Compliance Overview", "compliance.html"),
        ), notice=(
            "Ghost Surfer browser data stays on this PC. This manager does not send profile data or diagnostic/usage reports. A missing/outdated VC++ prerequisite is downloaded from Microsoft only after consent. This manager installs from a local package; if Ghost Surfer's GitHub update checker is active, its update requests contact GitHub."
        )), "Privacy")

        copyright_notice = (
            "For a rights-holder concern, email solidartentertainment@gmail.com with the work claimed to be infringed; the URL or file at issue; your contact information; a statement that you are the rights holder or authorized representative; and enough detail to evaluate the request. This is a contact route only; no statutory agent or DMCA legal service is claimed."
        )
        self.tabs.addTab(self._source_group((
            ("Copyright / DMCA Contact", "copyright.html"),
            ("Third-Party Notices", "notices.html"),
            ("Legal Overview", "legal.html"),
        ), notice=copyright_notice), "Copyright / DMCA")

        self.tabs.addTab(self._source_group((
            ("Support", "support.html"),
            ("Accessibility", "accessibility.html"),
        ), notice=(
            "For installation, download, privacy, accessibility, or security help, contact solidartentertainment@gmail.com. Do not email passwords, payment information, government IDs, or private files."
        )), "Support")

        self.tabs.addTab(self._source_group((
            ("Security", "security.html"),
            ("Manager & Download Disclosure", "manager.html"),
        ), notice=(
            "This manager supports the x64 package on Windows 10 version 1809 (build 17763) or newer, or Windows 11. Third-party software, websites, networks, and services are outside this manager's control."
        )), "Scope of Support")
        layout.addWidget(self.tabs, 1)
        self.acceptance = QCheckBox("I have read and agree to the Ghost Surfer Terms of Use and License.")
        self.acceptance.setVisible(require_accept)
        self.acceptance.setObjectName("acceptance")
        layout.addWidget(self.acceptance)
        buttons = QHBoxLayout()
        buttons.addStretch(1)
        self.close_button = QPushButton("Accept and Continue" if require_accept else "Close")
        self.close_button.setObjectName("acceptButton")
        self.close_button.setEnabled(not require_accept)
        self.close_button.clicked.connect(self.accept)
        buttons.addWidget(self.close_button)
        if require_accept:
            self.acceptance.toggled.connect(self.close_button.setEnabled)
        layout.addLayout(buttons)

    @staticmethod
    def _source_page(filename: str) -> QTextBrowser:
        browser = QTextBrowser()
        browser.setReadOnly(True)
        browser.setOpenExternalLinks(False)
        source_path = asset_path("legal/" + filename)
        if not source_path.is_file():
            browser.setPlainText(f"The bundled legal page {filename} could not be loaded.")
            return browser
        browser.setHtml(source_path.read_text(encoding="utf-8"))
        return browser

    @classmethod
    def _source_group(cls, pages: tuple[tuple[str, str], ...], notice: str = "") -> QWidget:
        page = QWidget()
        layout = QVBoxLayout(page)
        if notice:
            label = QLabel(notice)
            label.setWordWrap(True)
            layout.addWidget(label)
        inner_tabs = QTabWidget()
        for title, filename in pages:
            inner_tabs.addTab(cls._source_page(filename), title)
        layout.addWidget(inner_tabs, 1)
        return page


def _send_focus_to_existing(server_name: str) -> bool:
    socket = QLocalSocket()
    socket.connectToServer(server_name)
    if not socket.waitForConnected(900):
        return False
    socket.write(b"focus")
    socket.flush()
    socket.waitForBytesWritten(900)
    socket.disconnectFromServer()
    return True


def main() -> int:
    identity = os.environ.get("LOCALAPPDATA", str(Path.home())).casefold().encode("utf-8", errors="ignore")
    server_name = "GSInstallManager-" + hashlib.sha256(identity).hexdigest()[:24]
    lock_directory = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "GSInstallManager"
    lock_directory.mkdir(parents=True, exist_ok=True)
    lock_path = lock_directory / (hashlib.sha256(identity).hexdigest()[:24] + ".lock")
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateFileW.argtypes = [ctypes.c_wchar_p, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_void_p, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_void_p]
    kernel.CreateFileW.restype = ctypes.c_void_p
    kernel.CloseHandle.argtypes = [ctypes.c_void_p]
    lock_handle = kernel.CreateFileW(str(lock_path), 0xC0000000, 0, None, 4, 0x80, None)
    invalid_handle = ctypes.c_void_p(-1).value
    if lock_handle == invalid_handle:
        if ctypes.get_last_error() in (32, 33):  # sharing or lock violation: another user-session instance holds the file
            if not _send_focus_to_existing(server_name):
                time.sleep(0.35)
                _send_focus_to_existing(server_name)
            return 0
        return 2

    app = QApplication(sys.argv)
    app.setApplicationName(APP_TITLE)
    app.setOrganizationName("Solid Art Entertainment")
    server = QLocalServer()
    QLocalServer.removeServer(server_name)
    if not server.listen(server_name):
        kernel.CloseHandle(lock_handle)
        return 2
    settings = QSettings()
    if settings.value("legal/content-version", "") != LEGAL_CONTENT_VERSION:
        consent = LegalConsentDialog(require_accept=True)
        if consent.exec() != QDialog.DialogCode.Accepted:
            server.close()
            QLocalServer.removeServer(server_name)
            kernel.CloseHandle(lock_handle)
            return 0
        settings.setValue("legal/content-version", LEGAL_CONTENT_VERSION)
        settings.sync()
    window = InstallManagerWindow()

    def activate_existing() -> None:
        while server.hasPendingConnections():
            socket = server.nextPendingConnection()
            if socket is None:
                continue

            def read_request(current_socket=socket) -> None:
                current_socket.readAll()
                window.activate_window()
                current_socket.disconnectFromServer()
                current_socket.deleteLater()

            socket.readyRead.connect(read_request)
            if socket.bytesAvailable():
                read_request()

    server.newConnection.connect(activate_existing)
    window.show()
    result = app.exec()
    server.close()
    QLocalServer.removeServer(server_name)
    kernel.CloseHandle(lock_handle)
    return result


if __name__ == "__main__":
    raise SystemExit(main())
