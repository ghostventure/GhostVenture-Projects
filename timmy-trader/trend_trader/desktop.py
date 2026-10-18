from __future__ import annotations

import argparse
import atexit
import fcntl
import os
import subprocess
import sys
import time
import traceback
from pathlib import Path

from trend_trader import native_gui


TimmyNativeApp = native_gui.TimmyNativeApp
RESTART_REQUEST = ".timmy-restart-request"


def _runtime_home() -> Path:
    return Path(os.getenv("TIMMY_HOME", Path.cwd())).expanduser().resolve()


def _load_runtime_env(home: Path) -> None:
    try:
        from dotenv import load_dotenv
    except Exception:
        return

    load_dotenv(home / ".env")
    load_dotenv(home / ".timmy-profile.env", override=True)
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
    lock_file = _claim_single_instance(home)
    if lock_file is None:
        _write_crash_log(home, "Timmy is already running; the existing process was left untouched.")
    return lock_file


def _restart_command(home: Path) -> list[str]:
    launcher = home / "scripts" / "launch_timmy.sh"
    if launcher.is_file():
        return [str(launcher)]
    if getattr(sys, "frozen", False):
        return [sys.executable]
    return [sys.executable, "-m", "trend_trader.desktop"]


def _consume_restart_request(home: Path) -> bool:
    marker = home / RESTART_REQUEST
    try:
        marker.unlink()
    except FileNotFoundError:
        return False
    except OSError as exc:
        _write_crash_log(home, f"Could not clear restart request: {exc}")
        return False
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

    # A marker left by a crash must never cause a restart loop. If it cannot be
    # cleared, fail closed and ignore any marker observed after this run.
    stale_marker_cleared = True
    try:
        (home / RESTART_REQUEST).unlink()
    except FileNotFoundError:
        pass
    except OSError as exc:
        stale_marker_cleared = False
        _write_crash_log(home, f"Could not clear stale restart request: {exc}")

    exit_code = 0
    restart_requested = False
    try:
        try:
            exit_code = TimmyNativeApp(home).run()
            restart_requested = _consume_restart_request(home) and stale_marker_cleared
        except Exception:
            _write_crash_log(home, traceback.format_exc())
            exit_code = 1
    finally:
        if lock_file is not None:
            lock_file.close()

    if restart_requested and exit_code == 0:
        try:
            subprocess.Popen(
                _restart_command(home),
                cwd=str(home),
                env=os.environ.copy(),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
                close_fds=True,
            )
        except Exception:
            _write_crash_log(home, f"Timmy restart failed\n{traceback.format_exc()}")
            return 1
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
