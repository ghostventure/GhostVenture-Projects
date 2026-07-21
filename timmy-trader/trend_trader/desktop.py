from __future__ import annotations

import argparse
import atexit
import fcntl
import os
import signal
import subprocess
import time
import traceback
from pathlib import Path

from trend_trader.native_gui import TimmyNativeApp


def _runtime_home() -> Path:
    return Path(os.getenv("TIMMY_HOME", Path.cwd())).expanduser().resolve()


def _load_runtime_env(home: Path) -> None:
    try:
        from dotenv import load_dotenv
    except Exception:
        return

    load_dotenv(home / ".env")
    load_dotenv(Path.home() / ".config" / "timmy-trader" / ".env", override=False)


def _claim_single_instance(home: Path) -> object | None:
    home.mkdir(parents=True, exist_ok=True)
    lock_file = (home / "timmy.lock").open("a+", encoding="utf-8")
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock_file.close()
        return None

    lock_file.seek(0)
    lock_file.truncate()
    lock_file.write(f"pid={os.getpid()}\nmode=native\n")
    lock_file.flush()

    def cleanup() -> None:
        try:
            (home / "runtime-url.txt").unlink()
        except FileNotFoundError:
            pass

    atexit.register(cleanup)
    return lock_file


def _claim_or_replace_single_instance(home: Path) -> object | None:
    _replace_existing_instance(home)
    lock_file = _claim_single_instance(home)
    if lock_file is not None:
        return lock_file

    _replace_existing_instance(home, force=True)
    for _ in range(10):
        lock_file = _claim_single_instance(home)
        if lock_file is not None:
            return lock_file
        time.sleep(0.1)
    _write_crash_log(home, "Timmy could not claim the single-instance lock after replacing prior instances.")
    return None


def _replace_existing_instance(home: Path, force: bool = False) -> None:
    pids = set(_discover_existing_timmy_pids())
    lock_path = home / "timmy.lock"
    pid = _read_lock_pid(lock_path)
    if pid is not None:
        pids.add(pid)
    pids.discard(os.getpid())
    if not pids:
        return
    live_pids = {pid for pid in pids if _process_exists(pid)}
    for pid in live_pids:
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass

    if not force:
        for _ in range(30):
            live_pids = {pid for pid in live_pids if _process_exists(pid)}
            if not live_pids:
                return
            time.sleep(0.1)

    for _ in range(5):
        live_pids = {pid for pid in live_pids if _process_exists(pid)}
        if not live_pids:
            return
        for pid in live_pids:
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        time.sleep(0.1)

    for pid in live_pids:
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def _discover_existing_timmy_pids() -> list[int]:
    try:
        result = subprocess.run(["pgrep", "-af", "Timmy|timmy-desktop|trend_trader.desktop"], check=False,
                                capture_output=True, text=True, timeout=2)
    except Exception:
        return []
    pids: list[int] = []
    for line in result.stdout.splitlines():
        parts = line.split(maxsplit=1)
        if len(parts) != 2:
            continue
        try:
            pid = int(parts[0])
        except ValueError:
            continue
        if pid == os.getpid():
            continue
        if _is_timmy_process(pid):
            pids.append(pid)
    return pids


def _is_timmy_process(pid: int) -> bool:
    proc = Path("/proc") / str(pid)
    try:
        exe = proc.joinpath("exe").resolve()
    except (FileNotFoundError, PermissionError, OSError):
        exe = None
    if exe and str(exe) == "/opt/timmy-trader/Timmy":
        return True

    try:
        cmdline = proc.joinpath("cmdline").read_bytes().decode("utf-8", errors="replace").split("\0")
    except (FileNotFoundError, PermissionError, OSError):
        return False
    args = [arg for arg in cmdline if arg]
    if not args:
        return False
    if Path(args[0]).name in {"timmy-desktop", "Timmy"}:
        return True
    return len(args) >= 3 and Path(args[0]).name.startswith("python") and args[1:3] == ["-m", "trend_trader.desktop"]


def _read_lock_pid(lock_path: Path) -> int | None:
    try:
        lines = lock_path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return None
    for line in lines:
        if not line.startswith("pid="):
            continue
        try:
            return int(line.removeprefix("pid=").strip())
        except ValueError:
            return None
    return None


def _process_exists(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def _write_crash_log(home: Path, details: str) -> None:
    try:
        home.mkdir(parents=True, exist_ok=True)
        path = home / "timmy-crash.log"
        with path.open("a", encoding="utf-8") as file:
            file.write(f"\n[{time.strftime('%Y-%m-%dT%H:%M:%S')}] Timmy fatal exception\n")
            file.write(details)
            file.write("\n")
        path.chmod(0o600)
    except OSError:
        pass


def main() -> int:
    parser = argparse.ArgumentParser(description="Launch Timmy as a native Linux desktop app.")
    parser.add_argument("--allow-second-instance", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()

    home = _runtime_home()
    _load_runtime_env(home)
    lock_file = None if args.allow_second_instance else _claim_or_replace_single_instance(home)
    if lock_file is None and not args.allow_second_instance:
        return 1

    try:
        try:
            return TimmyNativeApp(home).run()
        except Exception:
            _write_crash_log(home, traceback.format_exc())
            return 1
    finally:
        if lock_file is not None:
            lock_file.close()


if __name__ == "__main__":
    raise SystemExit(main())
