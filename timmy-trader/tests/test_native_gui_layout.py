import os

import pytest

from trend_trader import native_gui
from trend_trader.native_gui import TimmyNativeApp


def test_compact_layout_activates_below_1120_pixels():
    assert TimmyNativeApp._uses_compact_layout(1119)
    assert TimmyNativeApp._uses_compact_layout(900)


def test_full_navigation_layout_starts_at_1120_pixels():
    assert not TimmyNativeApp._uses_compact_layout(1120)
    assert not TimmyNativeApp._uses_compact_layout(1280)


@pytest.mark.skipif(not os.environ.get("DISPLAY"), reason="Tk layout test requires a display")
def test_window_collapses_and_restores_navigation_without_loading_user_config(monkeypatch, tmp_path):
    def no_config():
        raise RuntimeError("GUI layout test uses safe defaults")

    monkeypatch.setattr(native_gui, "load_config", no_config)
    app = TimmyNativeApp(tmp_path)
    try:
        app.root.deiconify()
        app.root.geometry("900x650")
        app.root.update()
        app._apply_responsive_layout()
        assert app._compact_layout
        assert app.nav_buttons["Overview"].cget("text") == "OVR"

        app.root.geometry("1280x840")
        app.root.update()
        app._apply_responsive_layout()
        assert not app._compact_layout
        assert app.nav_buttons["Overview"].cget("text") == "Overview"
    finally:
        app.close()
