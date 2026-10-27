"""Reusable page, download, and accessibility UX helpers for Ghost Surfer.

Create one ``PageUxFeatures(window)`` after BrowserWindow has built its UI.
The owning window remains responsible for adding the corresponding controls and
calling the small hooks documented in ``INTEGRATION_API`` below.
"""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

from PySide6.QtCore import QTimer, QUrl, Qt
from PySide6.QtGui import QFont, QDesktopServices
from PySide6.QtWidgets import QApplication, QFileDialog, QFrame, QHBoxLayout, QLabel, QPushButton


HIGH_CONTRAST_QSS = """
QWidget, QMainWindow, QFrame, QGroupBox, QMenu, QMenuBar, QStatusBar {
    background-color: #000000;
    color: #ffffff;
}
QLabel, QCheckBox, QRadioButton {
    color: #ffffff;
}
QLineEdit, QComboBox, QListWidget, QTreeWidget, QTableWidget, QPlainTextEdit, QTextEdit {
    background-color: #000000;
    color: #ffffff;
    border: 2px solid #ffffff;
    selection-background-color: #ffff00;
    selection-color: #000000;
}
QPushButton, QToolButton {
    background-color: #000000;
    color: #ffff00;
    border: 2px solid #ffffff;
}
QPushButton:focus, QToolButton:focus, QLineEdit:focus, QComboBox:focus {
    border: 3px solid #ffff00;
}
QTabBar::tab {
    background-color: #000000;
    color: #ffffff;
    border: 2px solid #ffffff;
    padding: 7px 10px;
}
QTabBar::tab:selected {
    background-color: #ffff00;
    color: #000000;
}
QCheckBox::indicator, QRadioButton::indicator {
    width: 16px;
    height: 16px;
    border: 2px solid #ffffff;
    background-color: #000000;
}
QCheckBox::indicator:checked, QRadioButton::indicator:checked {
    background-color: #ffff00;
}
"""


READER_ENTER_JS = r"""(() => {
  const key = "__ghostSurferReaderState";
  if (window[key]) return false;
  const candidates = [...document.querySelectorAll("article, main, [role='main']")]
    .filter(node => (node.innerText || "").trim().length > 180)
    .sort((a, b) => (b.innerText || "").length - (a.innerText || "").length);
  const source = candidates[0] || document.body;
  const text = (source?.innerText || document.body?.innerText || "").trim();
  if (!text) return false;
  const overlay = document.createElement("section");
  overlay.id = "ghost-surfer-reader-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Reader view");
  const style = document.createElement("style");
  style.id = "ghost-surfer-reader-style";
  style.textContent = `
    #ghost-surfer-reader-overlay { position:fixed; inset:0; z-index:2147483647; overflow:auto;
      background:#fffdf7; color:#202124; font:18px/1.75 Georgia,serif; }
    #ghost-surfer-reader-overlay .gs-reader-content { max-width:760px; margin:0 auto; padding:64px 30px 90px; }
    #ghost-surfer-reader-overlay h1 { font:700 36px/1.2 Georgia,serif; margin:0 0 30px; }
    #ghost-surfer-reader-overlay p { margin:0 0 1.3em; white-space:pre-wrap; }
    #ghost-surfer-reader-overlay .gs-reader-close { position:fixed; top:16px; right:20px; padding:10px 16px;
      border:1px solid #555; border-radius:6px; background:#202124; color:#fff; font:600 14px sans-serif; cursor:pointer; }
    @media (max-width:600px) { #ghost-surfer-reader-overlay .gs-reader-content { padding:70px 20px 50px; } }
  `;
  const content = document.createElement("div");
  content.className = "gs-reader-content";
  const title = document.createElement("h1");
  title.textContent = document.title || "Reader view";
  content.appendChild(title);
  const paragraphs = text.split(/\n\s*\n+/).map(part => part.trim()).filter(Boolean);
  for (const part of paragraphs) {
    const p = document.createElement("p");
    p.textContent = part;
    content.appendChild(p);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.className = "gs-reader-close";
  close.textContent = "Exit reader view";
  close.addEventListener("click", () => window[key]?.restore());
  overlay.append(content, close);
  const nodes = [...document.body.children].map(node => [node, node.hidden]);
  const oldOverflow = document.body.style.overflow;
  window[key] = {
    restore() {
      for (const [node, hidden] of nodes) node.hidden = hidden;
      overlay.remove(); style.remove(); document.body.style.overflow = oldOverflow;
      delete window[key];
    }
  };
  style.dataset.ghostSurferReader = "true";
  document.head.appendChild(style);
  for (const [node] of nodes) node.hidden = true;
  document.body.style.overflow = "hidden";
  document.body.appendChild(overlay);
  close.focus();
  return true;
})()"""

READER_EXIT_JS = r"""(() => {
  const state = window.__ghostSurferReaderState;
  if (!state) return false;
  state.restore();
  return true;
})()"""


class PageUxFeatures:
    """Page UX controller bound to a Ghost Surfer BrowserWindow instance."""

    def __init__(self, window):
        self.window = window
        self._attached_tabs: set[int] = set()
        self._fullscreen_widgets: list[tuple[object, bool]] = []
        self._download_path: str | None = None
        self._contrast_stylesheet = ""
        self._base_stylesheet = window.styleSheet()
        app = QApplication.instance()
        self._base_font = app.font() if app else QFont("Segoe UI", 10)
        self._setup_download_toast()

        for index in range(window.tabs.count()):
            tab = window.tabs.widget(index)
            if tab is not None:
                self.attach_tab(tab)
        window.tabs.currentChanged.connect(lambda _index: self.apply_site_zoom())
        self.set_interface_text_size(int(window.settings_data.get("interface_text_size", 100)), persist=False)
        if bool(window.settings_data.get("high_contrast", False)):
            self.set_high_contrast(True, persist=False)
        self.apply_site_zoom()

    def _save_setting(self, key: str, value) -> None:
        self.window.settings_data[key] = value
        self.window.store.save()

    def _setup_download_toast(self) -> None:
        self.download_toast = QFrame(self.window.statusBar())
        self.download_toast.setObjectName("downloadCompletionToast")
        self.download_toast.setAccessibleName("Download completed notification")
        self.download_toast.setStyleSheet(
            "QFrame#downloadCompletionToast { background:#0b1725; border:1px solid #38a9e6; border-radius:6px; }"
            "QLabel { color:#fff; padding:2px 6px; }"
            "QPushButton { background:#122034; color:#fff; border:1px solid #38a9e6; border-radius:4px; padding:4px 10px; }"
        )
        layout = QHBoxLayout(self.download_toast)
        layout.setContentsMargins(8, 3, 8, 3)
        layout.setSpacing(6)
        self.download_toast_label = QLabel("Download complete")
        self.download_toast_label.setWordWrap(False)
        self.download_open_button = QPushButton("Open")
        self.download_open_button.setAccessibleName("Open completed download")
        self.download_open_button.clicked.connect(self.open_completed_download)
        dismiss = QPushButton("Dismiss")
        dismiss.setAccessibleName("Dismiss download notification")
        dismiss.clicked.connect(self.download_toast.hide)
        layout.addWidget(self.download_toast_label)
        layout.addWidget(self.download_open_button)
        layout.addWidget(dismiss)
        self.window.statusBar().addPermanentWidget(self.download_toast)
        self.download_toast.hide()
        self._download_timer = QTimer(self.window)
        self._download_timer.setSingleShot(True)
        self._download_timer.timeout.connect(self.download_toast.hide)

    def attach_tab(self, tab) -> None:
        """Attach per-site zoom updates to a newly created BrowserTab."""
        identity = id(tab)
        if identity in self._attached_tabs:
            return
        self._attached_tabs.add(identity)
        tab.urlChanged.connect(lambda _url, current=tab: self.apply_site_zoom(current))
        self.apply_site_zoom(tab)

    @staticmethod
    def _host_for_tab(tab) -> str:
        try:
            return tab.url().host().lower().strip(".")
        except (AttributeError, RuntimeError):
            return ""

    def apply_site_zoom(self, tab=None) -> int:
        """Apply host zooms to every tab, or to one supplied tab; return active percent."""
        if tab is None:
            active_percent = int(self.window.settings_data.get("zoom", 100))
            for index in range(self.window.tabs.count()):
                current = self.window.tabs.widget(index)
                if current is not None:
                    percent = self.apply_site_zoom(current)
                    if current is self.window.current_tab():
                        active_percent = percent
            return active_percent
        host = self._host_for_tab(tab)
        per_site = self.window.settings_data.setdefault("site_zoom", {})
        percent = per_site.get(host, self.window.settings_data.get("zoom", 100))
        try:
            percent = max(50, min(200, int(percent)))
            tab.setZoomFactor(percent / 100.0)
        except (TypeError, ValueError, RuntimeError):
            percent = 100
            tab.setZoomFactor(1.0)
        return percent

    def set_site_zoom(self, percent: int, tab=None) -> bool:
        """Set and persist zoom for the active host. Returns False on local pages."""
        tab = tab or self.window.current_tab()
        host = self._host_for_tab(tab) if tab is not None else ""
        if not host:
            if hasattr(self.window, "status"):
                self.window.status.showMessage("Per-site zoom is available on a website", 2500)
            return False
        percent = max(50, min(200, int(percent)))
        site_zoom = self.window.settings_data.setdefault("site_zoom", {})
        site_zoom[host] = percent
        self._save_setting("site_zoom", site_zoom)
        self.apply_site_zoom(tab)
        if hasattr(self.window, "status"):
            self.window.status.showMessage(f"{host} zoom set to {percent}%", 2200)
        return True

    def use_default_zoom_for_site(self, tab=None) -> bool:
        """Remove the active host override and restore global page zoom."""
        tab = tab or self.window.current_tab()
        host = self._host_for_tab(tab) if tab is not None else ""
        if not host:
            return False
        site_zoom = self.window.settings_data.setdefault("site_zoom", {})
        site_zoom.pop(host, None)
        self._save_setting("site_zoom", site_zoom)
        self.apply_site_zoom(tab)
        if hasattr(self.window, "status"):
            self.window.status.showMessage(f"Using default zoom for {host}", 2200)
        return True

    def toggle_reader_view(self, tab=None) -> None:
        """Enter or exit a clean, text-focused view on the selected page."""
        tab = tab or self.window.current_tab()
        if tab is None:
            return

        def entered(ok):
            if not ok and hasattr(self.window, "status"):
                self.window.status.showMessage("This page has no readable text to show", 3000)

        tab.page().runJavaScript(
            "window.__ghostSurferReaderState ? (window.__ghostSurferReaderState.restore(), true) : "
            + READER_ENTER_JS,
            entered,
        )

    def capture_page_screenshot(self, tab=None) -> str | None:
        """Save a PNG capture of the visible page viewport; return saved path."""
        tab = tab or self.window.current_tab()
        if tab is None:
            return None
        title = (tab.title() or "Ghost Surfer page").strip()
        safe_title = re.sub(r"[^A-Za-z0-9._ -]+", "_", title).strip(" ._")[:80] or "page"
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        downloads = Path.home() / "Downloads"
        downloads.mkdir(parents=True, exist_ok=True)
        suggested = downloads / f"{safe_title}-{stamp}.png"
        path, _filter = QFileDialog.getSaveFileName(self.window, "Capture page screenshot", str(suggested), "PNG image (*.png)")
        if not path:
            return None
        if not path.lower().endswith(".png"):
            path += ".png"
        if not tab.grab().save(path, "PNG"):
            if hasattr(self.window, "status"):
                self.window.status.showMessage("Could not save the page screenshot", 3500)
            return None
        if hasattr(self.window, "status"):
            self.window.status.showMessage(f"Screenshot saved: {path}", 4000)
        return path

    def set_distraction_free(self, enabled: bool) -> None:
        """Hide browser chrome and enter full screen; restore prior visibility on exit."""
        enabled = bool(enabled)
        if enabled:
            if self._fullscreen_widgets:
                return
            candidates = [
                self.window.findChild(QFrame, "rail"),
                self.window.findChild(QFrame, "addressDock"),
                self.window.statusBar(),
                getattr(self.window, "control_dock", None),
                getattr(getattr(self.window, "library_features", None), "bookmarks_toolbar", None),
            ]
            seen = set()
            for widget in candidates:
                if widget is None or id(widget) in seen:
                    continue
                seen.add(id(widget))
                self._fullscreen_widgets.append((widget, widget.isVisible()))
                widget.hide()
            self.window.showFullScreen()
            return
        if not self._fullscreen_widgets:
            if self.window.isFullScreen():
                self.window.showNormal()
            return
        self.window.showNormal()
        for widget, was_visible in self._fullscreen_widgets:
            try:
                widget.setVisible(was_visible)
            except RuntimeError:
                pass
        self._fullscreen_widgets.clear()

    def toggle_distraction_free(self) -> None:
        self.set_distraction_free(not bool(self._fullscreen_widgets))

    def set_interface_text_size(self, percent: int, persist: bool = True) -> int:
        """Scale native interface text while preserving the app's base font."""
        percent = max(80, min(180, int(percent)))
        app = QApplication.instance()
        if app is not None:
            font = QFont(self._base_font)
            base_points = self._base_font.pointSizeF()
            if base_points <= 0:
                base_points = 10.0
            font.setPointSizeF(max(7.0, base_points * percent / 100.0))
            app.setFont(font)
        if persist:
            self._save_setting("interface_text_size", percent)
        return percent

    def set_high_contrast(self, enabled: bool, persist: bool = True) -> None:
        """Apply a high contrast native interface palette/stylesheet."""
        enabled = bool(enabled)
        if enabled:
            # Capture the current theme stylesheet before appending the override.
            current = self.window.styleSheet()
            if current != self._contrast_stylesheet:
                self._base_stylesheet = current
                self._contrast_stylesheet = current + "\n" + HIGH_CONTRAST_QSS
            self.window.setStyleSheet(self._contrast_stylesheet)
        else:
            self.window.setStyleSheet(self._base_stylesheet)
            self._contrast_stylesheet = ""
        if persist:
            self._save_setting("high_contrast", enabled)

    def toggle_high_contrast(self) -> bool:
        enabled = not bool(self.window.settings_data.get("high_contrast", False))
        self.set_high_contrast(enabled)
        return enabled

    def download_completed(self, entry: dict) -> None:
        """Show the in-app Open notification after a download reaches Complete."""
        path = str(entry.get("path", ""))
        if not path or not Path(path).is_file():
            return
        self._download_path = path
        self.download_toast_label.setText(f"Downloaded: {Path(path).name}")
        self.download_toast.setToolTip(path)
        self.download_toast.show()
        self._download_timer.start(20000)

    def open_completed_download(self) -> None:
        path = Path(self._download_path) if self._download_path else None
        if path is None or not path.is_file():
            self.download_toast.hide()
            if hasattr(self.window, "status"):
                self.window.status.showMessage("The downloaded file is no longer available", 3500)
            return
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(path)))
        self.download_toast.hide()


INTEGRATION_API = {
    "create": "self.page_ux = PageUxFeatures(self) after build_shell/build_control_center/apply_style and before first tab navigation",
    "new_tab": "Call self.page_ux.attach_tab(tab) from BrowserWindow.add_tab immediately after constructing BrowserTab",
    "reader": "self.page_ux.toggle_reader_view(); expose as a View action or Quick access item",
    "screenshot": "self.page_ux.capture_page_screenshot(); expose as a View action or Quick access item",
    "site_zoom": "self.page_ux.set_site_zoom(percent), self.page_ux.use_default_zoom_for_site(), and self.page_ux.apply_site_zoom(tab) after global zoom changes",
    "fullscreen": "self.page_ux.toggle_distraction_free(); bind to F11 and a View action",
    "downloads": "Call self.page_ux.download_completed(entry) only when update_download_item transitions entry['state'] to 'Complete'",
    "accessibility": "self.page_ux.set_interface_text_size(percent); self.page_ux.set_high_contrast(enabled); call set_high_contrast again after apply_style if the theme changes while enabled",
}
