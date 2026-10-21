from __future__ import annotations

import argparse
import atexit
import fcntl
import os
import sys
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
    load_dotenv(home / ".timmy-profile.env", override=True)
    load_dotenv(Path.home() / ".config" / "timmy-trader" / ".env", override=False)


def _claim_single_instance(home: Path) -> object | None:
    home.mkdir(parents=True, exist_ok=True)
    lock_dir = Path.home() / ".config" / "timmy-trader"
    lock_dir.mkdir(parents=True, exist_ok=True)
    lock_file = (lock_dir / "timmy-instance.lock").open("a+", encoding="utf-8")
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock_file.close()
        return None

    lock_file.seek(0)
    lock_file.truncate()
    lock_file.write(f"pid={os.getpid()}\nmode=native\nruntime_home={home}\n")
    lock_file.flush()

    def cleanup() -> None:
        try:
            (home / "runtime-url.txt").unlink()
        except FileNotFoundError:
            pass

    atexit.register(cleanup)
    return lock_file


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
    parser.parse_args()

    home = _runtime_home()
    _load_runtime_env(home)
    try:
        lock_file = _claim_single_instance(home)
    except OSError as exc:
        print(f"Unable to secure Timmy's single-instance lock: {exc}", file=sys.stderr)
        return 1
    if lock_file is None:
        print("Timmy is already running for this user; close it before starting another copy.", file=sys.stderr)
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
