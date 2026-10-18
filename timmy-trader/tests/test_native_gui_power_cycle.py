from unittest.mock import Mock

from trend_trader import native_gui


def _power_cycle_app(home):
    app = object.__new__(native_gui.TimmyNativeApp)
    app.home = home
    app.status_bar = Mock()
    app.root = Mock()
    app.close = Mock()
    app._save_runtime_settings = Mock()
    app._write_crash_log = Mock()
    return app


def test_power_cycle_cancel_does_not_write_marker_or_close(monkeypatch, tmp_path):
    app = _power_cycle_app(tmp_path)
    monkeypatch.setattr(native_gui.messagebox, "askyesno", lambda *_args: False)

    app.power_cycle()

    assert not (tmp_path / native_gui.RESTART_REQUEST_MARKER).exists()
    app._save_runtime_settings.assert_not_called()
    app.root.after.assert_not_called()
    app.status_bar.configure.assert_called_once_with(text="Power cycle cancelled.")


def test_power_cycle_writes_private_request_and_closes_without_spawning(monkeypatch, tmp_path):
    app = _power_cycle_app(tmp_path)
    monkeypatch.setattr(native_gui.messagebox, "askyesno", lambda *_args: True)
    monkeypatch.setattr(native_gui.subprocess, "Popen", Mock(side_effect=AssertionError("must not spawn")))

    app.power_cycle()

    marker = tmp_path / native_gui.RESTART_REQUEST_MARKER
    assert marker.read_text(encoding="utf-8") == "restart\n"
    assert marker.stat().st_mode & 0o777 == 0o600
    app._save_runtime_settings.assert_called_once_with()
    app.root.after.assert_called_once_with(250, app.close)
    app.status_bar.configure.assert_called_once_with(text="Restart requested. Closing Timmy...")
    app._write_crash_log.assert_not_called()


def test_power_cycle_marker_failure_keeps_gui_open_and_reports_error(monkeypatch, tmp_path):
    app = _power_cycle_app(tmp_path)
    monkeypatch.setattr(native_gui.messagebox, "askyesno", lambda *_args: True)
    monkeypatch.setattr(native_gui.os, "open", Mock(side_effect=OSError("read only")))

    app.power_cycle()

    app._write_crash_log.assert_called_once()
    app.status_bar.configure.assert_called_once()
    assert "Power cycle failed: read only" in app.status_bar.configure.call_args.kwargs["text"]
    app.root.after.assert_not_called()
