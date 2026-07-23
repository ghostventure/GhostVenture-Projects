#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

from trend_trader.runtime_health import apply_safe_mode_environment, pre_market_system_check, runtime_home


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Timmy under a local watchdog contract.")
    parser.add_argument("--home", default=None, help="Runtime home. Defaults to TIMMY_HOME or the current directory.")
    parser.add_argument("--command", nargs="+", default=None, help="Command to supervise. Defaults to timmy-desktop.")
    parser.add_argument("--interval", type=float, default=5.0, help="Seconds between liveness checks.")
    parser.add_argument("--max-restarts", type=int, default=5, help="Maximum restarts before watchdog exits.")
    parser.add_argument("--safe-mode", action="store_true", help="Force paper mode and disable live automation.")
    parser.add_argument("--check-only", action="store_true", help="Run the health check and exit without launching Timmy.")
    args = parser.parse_args()

    home = runtime_home(args.home)
    home.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env["TIMMY_HOME"] = str(home)
    if args.safe_mode:
        apply_safe_mode_environment(env)

    check = pre_market_system_check(home=home)
    _append_event(home, {"event": "system_check", "passed": check.passed, "health": check.health.to_dict()})
    if args.check_only:
        print(json.dumps(check.health.to_dict(), indent=2, sort_keys=True))
        return 0 if check.passed else 2

    command = args.command or [sys.executable, "-m", "trend_trader.desktop"]
    restarts = 0
    stop = False

    def handle_stop(_signum, _frame) -> None:
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, handle_stop)
    signal.signal(signal.SIGINT, handle_stop)

    process: subprocess.Popen | None = None
    while not stop:
        process = subprocess.Popen(command, cwd=str(home), env=env)
        _append_event(home, {"event": "started", "pid": process.pid, "restart": restarts})
        while process.poll() is None and not stop:
            time.sleep(args.interval)
        if stop:
            break
        return_code = process.returncode
        _append_event(home, {"event": "stopped", "return_code": return_code})
        if return_code == 0:
            return 0
        restarts += 1
        if restarts > args.max_restarts:
            _append_event(home, {"event": "max_restarts_exceeded", "max_restarts": args.max_restarts})
            return 1
        time.sleep(min(args.interval * restarts, 30))

    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
    _append_event(home, {"event": "watchdog_stopped"})
    return 0


def _append_event(home: Path, payload: dict) -> None:
    payload = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **payload}
    path = home / "timmy-watchdog.jsonl"
    with path.open("a", encoding="utf-8") as file:
        file.write(json.dumps(payload, sort_keys=True) + "\n")
    path.chmod(0o600)


if __name__ == "__main__":
    raise SystemExit(main())
