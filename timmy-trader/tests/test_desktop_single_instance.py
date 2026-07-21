from __future__ import annotations

import signal
from pathlib import Path

from trend_trader import desktop


def test_replace_existing_instance_terminates_discovered_and_locked_pids(monkeypatch, tmp_path) -> None:
    (tmp_path / "timmy.lock").write_text("pid=200\nmode=native\n", encoding="utf-8")
    monkeypatch.setattr(desktop, "_discover_existing_timmy_pids", lambda: [100])
    existing = {100, 200}
    killed: list[tuple[int, signal.Signals]] = []

    def fake_kill(pid: int, sig: signal.Signals) -> None:
        if sig == 0:
            if pid not in existing:
                raise ProcessLookupError
            return
        killed.append((pid, sig))
        if sig == signal.SIGTERM:
            existing.discard(pid)

    monkeypatch.setattr(desktop.os, "getpid", lambda: 999)
    monkeypatch.setattr(desktop.os, "kill", fake_kill)

    desktop._replace_existing_instance(tmp_path)

    assert set(killed) == {(200, signal.SIGTERM), (100, signal.SIGTERM)}


def test_replace_existing_instance_uses_sigkill_after_timeout(monkeypatch, tmp_path) -> None:
    (tmp_path / "timmy.lock").write_text("pid=200\nmode=native\n", encoding="utf-8")
    monkeypatch.setattr(desktop, "_discover_existing_timmy_pids", lambda: [])
    monkeypatch.setattr(desktop.os, "getpid", lambda: 999)
    monkeypatch.setattr(desktop.time, "sleep", lambda _seconds: None)
    killed: list[tuple[int, signal.Signals]] = []

    def fake_kill(pid: int, sig: signal.Signals) -> None:
        if sig != 0:
            killed.append((pid, sig))

    monkeypatch.setattr(desktop.os, "kill", fake_kill)

    desktop._replace_existing_instance(tmp_path)

    assert killed[0] == (200, signal.SIGTERM)
    assert killed[-1] == (200, signal.SIGKILL)


def test_claim_or_replace_retries_with_force_when_lock_is_busy(monkeypatch, tmp_path) -> None:
    attempts = []
    replacements: list[bool] = []
    lock = object()

    def fake_claim(_home):
        attempts.append("claim")
        return lock if len(attempts) == 2 else None

    def fake_replace(_home, force=False):
        replacements.append(force)

    monkeypatch.setattr(desktop, "_claim_single_instance", fake_claim)
    monkeypatch.setattr(desktop, "_replace_existing_instance", fake_replace)

    assert desktop._claim_or_replace_single_instance(tmp_path) is lock
    assert replacements == [False, True]


def test_is_timmy_process_matches_only_known_command_shapes(monkeypatch) -> None:
    payloads = {
        "/proc/100/cmdline": b"python3\x00-m\x00trend_trader.desktop\x00",
        "/proc/101/cmdline": b"zsh\x00-c\x00/opt/timmy-trader/Timmy mentioned in shell text\x00",
    }

    class FakePath:
        def __init__(self, value: str) -> None:
            self.value = value

        def __truediv__(self, other: object):
            return FakePath(f"{self.value}/{other}")

        def joinpath(self, other: str):
            return FakePath(f"{self.value}/{other}")

        def resolve(self):
            raise FileNotFoundError

        def read_bytes(self) -> bytes:
            return payloads[self.value]

        @property
        def name(self) -> str:
            return Path(self.value).name

    monkeypatch.setattr(desktop, "Path", FakePath)

    assert desktop._is_timmy_process(100) is True
    assert desktop._is_timmy_process(101) is False


def test_write_crash_log_is_private_and_contains_details(tmp_path) -> None:
    desktop._write_crash_log(tmp_path, "boom traceback")

    log_path = tmp_path / "timmy-crash.log"
    assert "boom traceback" in log_path.read_text(encoding="utf-8")
    assert oct(log_path.stat().st_mode & 0o777) == "0o600"
