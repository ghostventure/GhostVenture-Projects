from __future__ import annotations

import sys
from pathlib import Path

from trend_trader import desktop
from trend_trader.native_gui import _restart_command


def test_runtime_home_lock_refuses_duplicate_instance(tmp_path) -> None:
    first_lock = desktop._claim_single_instance(tmp_path)
    assert first_lock is not None
    try:
        assert desktop._claim_single_instance(tmp_path) is None
    finally:
        first_lock.close()

    replacement_lock = desktop._claim_single_instance(tmp_path)
    assert replacement_lock is not None
    replacement_lock.close()


def test_main_reports_duplicate_runtime_home_without_launching(monkeypatch, tmp_path, capsys) -> None:
    monkeypatch.setattr(sys, "argv", ["timmy-desktop"])
    monkeypatch.setattr(desktop, "_runtime_home", lambda: tmp_path)
    monkeypatch.setattr(desktop, "_load_runtime_env", lambda _home: None)
    monkeypatch.setattr(desktop, "_claim_single_instance", lambda _home: None)

    assert desktop.main() == 1
    assert "already running for runtime home" in capsys.readouterr().err


def test_write_crash_log_is_private_and_contains_details(tmp_path) -> None:
    desktop._write_crash_log(tmp_path, "boom traceback")

    log_path = tmp_path / "timmy-crash.log"
    assert "boom traceback" in log_path.read_text(encoding="utf-8")
    assert oct(log_path.stat().st_mode & 0o777) == "0o600"


def test_restart_command_prefers_project_launcher(tmp_path) -> None:
    launcher = tmp_path / "scripts" / "launch_timmy.sh"
    launcher.parent.mkdir()
    launcher.write_text("#!/usr/bin/env bash\n", encoding="utf-8")

    assert _restart_command(tmp_path) == [str(launcher)]


def test_restart_command_falls_back_to_desktop_module(tmp_path) -> None:
    command = _restart_command(tmp_path)

    assert command[-2:] == ["-m", "trend_trader.desktop"]
