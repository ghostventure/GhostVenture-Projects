from __future__ import annotations

import sys

from trend_trader import desktop


def test_duplicate_launch_keeps_active_lock_and_does_not_signal_any_pid(monkeypatch, tmp_path) -> None:
    active_lock = desktop._claim_single_instance(tmp_path)
    assert active_lock is not None
    signals: list[tuple[int, int]] = []
    monkeypatch.setattr(desktop.os, "kill", lambda pid, sig: signals.append((pid, sig)))

    try:
        assert desktop._claim_or_replace_single_instance(tmp_path) is None
        assert desktop._claim_single_instance(tmp_path) is None
        assert signals == []
        assert "existing process was left untouched" in (tmp_path / "timmy-crash.log").read_text(encoding="utf-8")
    finally:
        active_lock.close()


def test_duplicate_launch_does_not_signal_stale_lock_pid(monkeypatch, tmp_path) -> None:
    (tmp_path / "timmy.lock").write_text("pid=42\nmode=native\n", encoding="utf-8")
    signals: list[tuple[int, int]] = []
    monkeypatch.setattr(desktop, "_claim_single_instance", lambda _home: None)
    monkeypatch.setattr(desktop.os, "kill", lambda pid, sig: signals.append((pid, sig)))

    assert desktop._claim_or_replace_single_instance(tmp_path) is None
    assert signals == []


def test_write_crash_log_is_private_and_contains_details(tmp_path) -> None:
    desktop._write_crash_log(tmp_path, "boom traceback")

    log_path = tmp_path / "timmy-crash.log"
    assert "boom traceback" in log_path.read_text(encoding="utf-8")
    assert oct(log_path.stat().st_mode & 0o777) == "0o600"


def test_restart_command_prefers_project_launcher(tmp_path) -> None:
    launcher = tmp_path / "scripts" / "launch_timmy.sh"
    launcher.parent.mkdir()
    launcher.write_text("#!/usr/bin/env bash\n", encoding="utf-8")

    assert desktop._restart_command(tmp_path) == [str(launcher)]


def test_restart_command_falls_back_to_desktop_module(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(desktop.sys, "frozen", False, raising=False)
    monkeypatch.setattr(desktop.sys, "executable", "/usr/bin/python3")
    command = desktop._restart_command(tmp_path)

    assert command == ["/usr/bin/python3", "-m", "trend_trader.desktop"]


def test_restart_command_uses_frozen_executable_without_python_module_args(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(desktop.sys, "frozen", True, raising=False)
    monkeypatch.setattr(desktop.sys, "executable", "/opt/timmy-trader/Timmy")

    assert desktop._restart_command(tmp_path) == ["/opt/timmy-trader/Timmy"]


def test_main_relaunches_only_after_normal_exit_and_lock_release(monkeypatch, tmp_path) -> None:
    events: list[str] = []

    class Lock:
        def close(self) -> None:
            events.append("lock-closed")

    class App:
        def __init__(self, home) -> None:
            self.home = home

        def run(self) -> int:
            (self.home / desktop.RESTART_REQUEST).write_text("restart\n", encoding="utf-8")
            events.append("ui-returned")
            return 0

    monkeypatch.setattr(sys, "argv", ["timmy"])
    monkeypatch.setattr(desktop, "_runtime_home", lambda: tmp_path)
    monkeypatch.setattr(desktop, "_load_runtime_env", lambda _home: None)
    monkeypatch.setattr(desktop, "_claim_or_replace_single_instance", lambda _home: Lock())
    monkeypatch.setattr(desktop, "TimmyNativeApp", App)
    monkeypatch.setattr(desktop, "_restart_command", lambda _home: ["/opt/timmy-trader/Timmy"])

    def fake_popen(command, **kwargs) -> None:
        assert events == ["ui-returned", "lock-closed"]
        assert command == ["/opt/timmy-trader/Timmy"]
        assert not (tmp_path / desktop.RESTART_REQUEST).exists()
        assert kwargs["start_new_session"] is True
        events.append("restarted")

    monkeypatch.setattr(desktop.subprocess, "Popen", fake_popen)

    assert desktop.main() == 0
    assert events == ["ui-returned", "lock-closed", "restarted"]


def test_main_clears_stale_restart_marker_without_relaunching(monkeypatch, tmp_path) -> None:
    marker = tmp_path / desktop.RESTART_REQUEST
    marker.write_text("stale\n", encoding="utf-8")

    class Lock:
        def close(self) -> None:
            pass

    class App:
        def __init__(self, home) -> None:
            assert not (home / desktop.RESTART_REQUEST).exists()

        def run(self) -> int:
            return 0

    monkeypatch.setattr(sys, "argv", ["timmy"])
    monkeypatch.setattr(desktop, "_runtime_home", lambda: tmp_path)
    monkeypatch.setattr(desktop, "_load_runtime_env", lambda _home: None)
    monkeypatch.setattr(desktop, "_claim_or_replace_single_instance", lambda _home: Lock())
    monkeypatch.setattr(desktop, "TimmyNativeApp", App)
    monkeypatch.setattr(desktop.subprocess, "Popen", lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("unexpected restart")))

    assert desktop.main() == 0
    assert not marker.exists()
