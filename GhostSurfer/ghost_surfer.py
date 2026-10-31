import html
import json
import os
import shutil
import sys
import hashlib
import hmac
from datetime import datetime
from pathlib import Path
from urllib.parse import quote_plus
from network_routing import TOR_ENDPOINT

from PySide6.QtCore import QSize, QStandardPaths, Qt, QTimer, QUrl, Signal, Slot
from PySide6.QtGui import QAction, QColor, QDesktopServices, QFont, QIcon, QKeySequence, QPainter, QPainterPath, QPen, QPixmap, QShortcut
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QDialog,
    QDockWidget,
    QFileDialog,
    QFrame,
    QGridLayout,
    QGroupBox,
    QHBoxLayout,
    QInputDialog,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMenu,
    QMessageBox,
    QProgressDialog,
    QPushButton,
    QSplashScreen,
    QScrollArea,
    QSplitter,
    QStackedWidget,
    QStatusBar,
    QTabWidget,
    QToolButton,
    QVBoxLayout,
    QWidget,
)
from PySide6.QtWebEngineCore import (
    QWebEngineDownloadRequest,
    QWebEnginePage,
    QWebEngineProfile,
    QWebEngineSettings,
)
from PySide6.QtWebEngineWidgets import QWebEngineView
from find_in_page import FindInPageDialog
from save_as_pdf import save_current_page_as_pdf
from shortcuts_guide import show_shortcuts_guide
from tab_features import TabFeatures
from page_ux_features import PageUxFeatures
from library_features import LibraryFeatures
from browser_update import UpdateWorker
from github_updater import GitHubReleasesUpdater
from ghost_guard import (
    FirstPartyCookiePolicy,
    GhostGuardRequestInterceptor,
    apply_web_engine_security,
    handle_permission_request,
    registrable_domain,
)
from personal_data_vault import PersonalDataVaultDialog
from personal_data_guard import PersonalDataRequestDialog, SiteRecognitionStore, SiteVerificationWorker, install_personal_data_monitor
from extension_features import ExtensionFeatures
from chatgpt_bridge import ChatGPTBridgeSettings


APP_NAME = "Ghost Surfer"
APP_VERSION = "0.2.2"
GITHUB_REPOSITORY_URL = "https://github.com/ghostventure/GhostVenture-Projects"
GITHUB_RELEASES_URL = f"{GITHUB_REPOSITORY_URL}/releases"
HOME_URL = "https://duckduckgo.com/"
DASHBOARD_URL = "ghostsurfer://dashboard"
SEARCH_URL = "https://www.startpage.com/sp/search?query={query}"
TOR_CHECK_URL = "https://check.torproject.org/"
STORE_SEAL_KEY = b"GhostSurfer.BlackLionStudios.local-state.v2"


def personal_vault_install_default() -> bool:
    marker = Path(sys.executable).resolve().parent / "personal-vault.enabled"
    return marker.exists() if getattr(sys, "frozen", False) else True

THEMES = {
    "Ghost Blue": {"accent": "#38a9e6", "accent_soft": "#8fd6ff", "hover": "#1f7fb4"},
    "Phantom Purple": {"accent": "#8b5cf6", "accent_soft": "#c4b5fd", "hover": "#6d28d9"},
    "Neon Green": {"accent": "#22c55e", "accent_soft": "#86efac", "hover": "#15803d"},
    "Blood Red": {"accent": "#ef4444", "accent_soft": "#fca5a5", "hover": "#b91c1c"},
    "Gold Signal": {"accent": "#f59e0b", "accent_soft": "#fcd34d", "hover": "#b45309"},
    "Ice Cyan": {"accent": "#06b6d4", "accent_soft": "#67e8f9", "hover": "#0e7490"},
    "Hot Pink": {"accent": "#ec4899", "accent_soft": "#f9a8d4", "hover": "#be185d"},
    "Toxic Lime": {"accent": "#84cc16", "accent_soft": "#bef264", "hover": "#4d7c0f"},
    "Cyber Orange": {"accent": "#f97316", "accent_soft": "#fdba74", "hover": "#c2410c"},
    "Steel Gray": {"accent": "#94a3b8", "accent_soft": "#cbd5e1", "hover": "#64748b"},
    "Deep Violet": {"accent": "#a855f7", "accent_soft": "#d8b4fe", "hover": "#7e22ce"},
    "Sea Glass": {"accent": "#14b8a6", "accent_soft": "#5eead4", "hover": "#0f766e"},
}

def app_data_dir() -> Path:
    base = QStandardPaths.writableLocation(QStandardPaths.StandardLocation.AppLocalDataLocation)
    if not base:
        base = str(Path.home() / "AppData" / "Local" / "GhostSurfer")
    path = Path(base)
    path.mkdir(parents=True, exist_ok=True)
    return path


def ghost_icon_pixmap(size: int = 256) -> QPixmap:
    pixmap = QPixmap(size, size)
    pixmap.fill(Qt.GlobalColor.transparent)
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing)
    painter.setBrush(QColor("#03060b"))
    painter.setPen(QPen(QColor("#38a9e6"), max(3, size // 32)))
    painter.drawRoundedRect(8, 8, size - 16, size - 16, 30, 30)
    body = [
        (0.25, 0.82),
        (0.25, 0.36),
        (0.26, 0.20),
        (0.38, 0.09),
        (0.50, 0.08),
        (0.64, 0.09),
        (0.76, 0.22),
        (0.76, 0.82),
        (0.69, 0.77),
        (0.62, 0.84),
        (0.55, 0.77),
        (0.48, 0.84),
        (0.41, 0.77),
        (0.34, 0.84),
    ]
    path = QPainterPath()
    path.moveTo(size * body[0][0], size * body[0][1])
    path.lineTo(size * body[1][0], size * body[1][1])
    path.cubicTo(size * body[2][0], size * body[2][1], size * body[3][0], size * body[3][1], size * body[4][0], size * body[4][1])
    path.cubicTo(size * body[5][0], size * body[5][1], size * body[6][0], size * body[6][1], size * body[7][0], size * body[7][1])
    for x, y in body[8:]:
        path.lineTo(size * x, size * y)
    path.closeSubpath()
    painter.setBrush(QColor("#f7fbff"))
    painter.setPen(QPen(QColor("#ffffff"), max(2, size // 80)))
    painter.drawPath(path)
    painter.setBrush(QColor("#07111c"))
    painter.drawEllipse(int(size * 0.40), int(size * 0.38), int(size * 0.08), int(size * 0.12))
    painter.drawEllipse(int(size * 0.56), int(size * 0.38), int(size * 0.08), int(size * 0.12))
    painter.setPen(QPen(QColor("#8fd6ff"), max(4, size // 30), Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
    painter.drawArc(int(size * 0.19), int(size * 0.66), int(size * 0.62), int(size * 0.24), 10 * 16, 160 * 16)
    painter.end()
    return pixmap


def make_splash() -> QSplashScreen:
    pixmap = QPixmap(620, 340)
    pixmap.fill(QColor("#05080d"))
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing)
    painter.fillRect(pixmap.rect(), QColor("#05080d"))
    painter.setPen(QPen(QColor("#243244"), 1))
    painter.drawRoundedRect(10, 10, 600, 320, 18, 18)
    painter.drawPixmap(48, 66, ghost_icon_pixmap(142))
    painter.setPen(QColor("#ffffff"))
    painter.setFont(QFont("Segoe UI", 34, QFont.Weight.Black))
    painter.drawText(220, 112, "Ghost Surfer")
    painter.setPen(QColor("#8fd6ff"))
    painter.setFont(QFont("Segoe UI", 12, QFont.Weight.Bold))
    painter.drawText(224, 148, "Private-first browser shell")
    painter.setPen(QColor("#dce8f5"))
    painter.setFont(QFont("Segoe UI", 10))
    painter.drawText(224, 190, "Loading Ghost Guard, Speed Mode, Tor check, and DuckDuckGo...")
    painter.setPen(QPen(QColor("#38a9e6"), 5, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
    painter.drawLine(224, 230, 540, 230)
    painter.end()
    splash = QSplashScreen(pixmap)
    splash.setWindowFlag(Qt.WindowType.WindowStaysOnTopHint)
    return splash


class BrowserStore:
    BACKUP_FORMAT = "ghost-surfer-browser-data"
    BACKUP_VERSION = 1
    BACKUP_KEYS = ("bookmarks", "history", "cookie_permissions", "spy_alerts", "download_history")

    def __init__(self) -> None:
        self.path = app_data_dir() / "browser-data.json"
        self.tamper_detected = False
        self.tamper_message = ""
        self.last_error = ""
        self.recovery_backup: Path | None = None
        self.write_protected = False
        self.previous_session_was_clean = True
        self.data = {
            "schema_version": 2,
            "clean_shutdown": True,
            "bookmarks": [],
            "history": [],
            "cookie_permissions": {},
            "spy_alerts": [],
            "download_history": [],
            "settings": {
                "speed_mode": True,
                "block_images": False,
                "ghost_cleanup_on_close": False,
                "allow_javascript": True,
                "allow_webgl": False,
                "cookie_policy": "ask",
                "theme": "Ghost Blue",
                "zoom": 100,
                "home_page_url": "https://duckduckgo.com/",
                "home_page_default_migrated": True,
                "reduce_motion": False,
                "personal_vault_enabled": personal_vault_install_default(),
                "data_request_guard_enabled": True,
                "site_verification_enabled": True,
                "extensions_profile_enabled": False,
                "enabled_extensions": {},
                "chatgpt_bridge_enabled": False,
            },
        }
        self.load()
        self.previous_session_was_clean = self.data.get("clean_shutdown") is True
        self.data["clean_shutdown"] = False
        self.save()

    def load(self) -> None:
        if not self.path.exists():
            return
        try:
            loaded = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(loaded, dict):
                raise ValueError("Browser data must be a JSON object")
            if loaded.get("_seal") and not self.verify_seal(loaded):
                self.tamper_detected = True
                self._preserve_recovery_copy("tampered")
                self.tamper_message = "Ghost Surfer detected that local browser data changed outside the app. Review the recovery copy and privacy settings before browsing."
                loaded.pop("_seal", None)
            self.data.update(loaded)
            self.data["schema_version"] = 2
            for key in ("bookmarks", "history", "spy_alerts"):
                if not isinstance(self.data.get(key), list):
                    self.data[key] = []
            self.data["bookmarks"] = [
                {"title": str(row.get("title") or row["url"]), "url": str(row["url"]), "folder": str(row.get("folder", ""))}
                for row in self.data["bookmarks"]
                if isinstance(row, dict) and str(row.get("url", "")).startswith(("http://", "https://"))
            ]
            self.data["history"] = [
                {"title": str(row.get("title") or row["url"]), "url": str(row["url"]), "visited_at": str(row.get("visited_at", ""))}
                for row in self.data["history"]
                if isinstance(row, dict) and str(row.get("url", "")).startswith(("http://", "https://"))
            ]
            self.data["spy_alerts"] = [row for row in self.data["spy_alerts"] if isinstance(row, dict)]
            if not isinstance(self.data.get("download_history"), list):
                self.data["download_history"] = []
            self.data["download_history"] = [
                {"path": str(row.get("path", "")), "state": str(row.get("state", "Interrupted")),
                 "url": str(row.get("url", "")), "started_at": str(row.get("started_at", "")),
                 "finished_at": str(row.get("finished_at", ""))}
                for row in self.data["download_history"] if isinstance(row, dict) and row.get("path")
            ]
            if not isinstance(self.data.get("cookie_permissions"), dict):
                self.data["cookie_permissions"] = {}
            self.data["cookie_permissions"] = {
                str(domain): choice for domain, choice in list(self.data["cookie_permissions"].items())[:5000]
                if isinstance(choice, str) and choice in {"allow", "deny"}
            }
            if not isinstance(self.data.get("settings"), dict):
                self.data["settings"] = {}
            for key, value in {
                "speed_mode": True,
                "block_images": False,
                "ghost_cleanup_on_close": False,
                "allow_javascript": True,
                "allow_webgl": False,
                "cookie_policy": "ask",
                "theme": "Ghost Blue",
                "zoom": 100,
                "history_retention_days": 0,
                "home_page_url": "https://duckduckgo.com/",
                "reduce_motion": False,
                "personal_vault_enabled": personal_vault_install_default(),
                "data_request_guard_enabled": True,
                "site_verification_enabled": True,
                "extensions_profile_enabled": False,
                "enabled_extensions": {},
                "chatgpt_bridge_enabled": False,
            }.items():
                self.data["settings"].setdefault(key, value)
            settings = self.data["settings"]
            if not settings.get("home_page_default_migrated", False):
                legacy_home = settings.get("home_page_url")
                if legacy_home is None or legacy_home == "https://www.startpage.com/":
                    settings["home_page_url"] = "https://duckduckgo.com/"
                settings["home_page_default_migrated"] = True
            for key in ("speed_mode", "block_images", "ghost_cleanup_on_close", "allow_javascript", "allow_webgl", "high_contrast", "reduce_motion", "personal_vault_enabled", "data_request_guard_enabled", "site_verification_enabled"):
                settings[key] = bool(settings.get(key, key == "speed_mode"))
            settings["extensions_profile_enabled"] = bool(settings.get("extensions_profile_enabled", False))
            settings["chatgpt_bridge_enabled"] = bool(settings.get("chatgpt_bridge_enabled", False))
            if not isinstance(settings.get("enabled_extensions"), dict):
                settings["enabled_extensions"] = {}
            settings["enabled_extensions"] = {
                str(extension_id): bool(enabled)
                for extension_id, enabled in list(settings["enabled_extensions"].items())[:500]
                if isinstance(extension_id, str) and isinstance(enabled, bool)
            }
            if not isinstance(settings.get("cookie_policy"), str) or settings["cookie_policy"] not in {"ask", "allow", "deny"}:
                settings["cookie_policy"] = "ask"
            if not isinstance(settings.get("theme"), str) or settings["theme"] not in THEMES:
                settings["theme"] = "Ghost Blue"
            try:
                settings["zoom"] = int(settings.get("zoom", 100))
            except (TypeError, ValueError):
                settings["zoom"] = 100
            if settings["zoom"] not in {80, 90, 100, 110, 125, 150}:
                settings["zoom"] = 100
            try:
                settings["interface_text_size"] = max(80, min(180, int(settings.get("interface_text_size", 100))))
            except (TypeError, ValueError):
                settings["interface_text_size"] = 100
            if not isinstance(settings.get("site_zoom"), dict):
                settings["site_zoom"] = {}
            else:
                normalized_zoom = {}
                for host, percent in list(settings["site_zoom"].items())[:500]:
                    try:
                        normalized_zoom[str(host).lower()[:253]] = max(50, min(200, int(percent)))
                    except (TypeError, ValueError):
                        continue
                settings["site_zoom"] = normalized_zoom
            if not isinstance(settings.get("search_engine"), str) or settings["search_engine"] not in {"Startpage", "DuckDuckGo", "Brave Search", "Bing"}:
                settings["search_engine"] = "Startpage"
            if not isinstance(settings.get("home_page_url"), str):
                settings["home_page_url"] = "https://duckduckgo.com/"
            if not isinstance(settings.get("startup_page"), str) or settings["startup_page"] not in {"restore_session", "start_page", "home_page", "blank"}:
                settings["startup_page"] = "restore_session"
            try:
                settings["history_retention_days"] = max(0, min(3650, int(settings.get("history_retention_days", 0))))
            except (TypeError, ValueError):
                settings["history_retention_days"] = 0
            tab_state = self.data.get("ghost_surfer_tab_features")
            if not isinstance(tab_state, dict):
                tab_state = {}
            for key in ("previous_session", "recently_closed"):
                rows = tab_state.get(key, [])
                if not isinstance(rows, list):
                    rows = []
                tab_state[key] = [
                    row for row in rows
                    if isinstance(row, dict) and isinstance(row.get("url"), str)
                    and row["url"].startswith(("http://", "https://", "ghostsurfer://", "about:blank"))
                ][:30]
            try:
                tab_state["previous_session_active_index"] = max(0, int(tab_state.get("previous_session_active_index", 0)))
            except (TypeError, ValueError):
                tab_state["previous_session_active_index"] = 0
            sessions = tab_state.get("named_sessions", {})
            if not isinstance(sessions, dict):
                sessions = {}
            tab_state["named_sessions"] = {
                str(name)[:80]: [
                    row for row in rows[:50]
                    if isinstance(row, dict) and isinstance(row.get("url"), str)
                    and row["url"].startswith(("http://", "https://", "ghostsurfer://", "about:blank"))
                ]
                for name, rows in list(sessions.items())[:100]
                if isinstance(rows, list)
            }
            self.data["ghost_surfer_tab_features"] = tab_state
        except (OSError, json.JSONDecodeError, TypeError, ValueError) as exc:
            self.tamper_detected = True
            self.last_error = str(exc)
            self._preserve_recovery_copy("corrupt")
            self.tamper_message = "Ghost Surfer could not read its local browser data. The original file was preserved for recovery."

    def _preserve_recovery_copy(self, reason: str) -> None:
        if not self.path.exists():
            return
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup = self.path.with_name(f"browser-data-{reason}-{stamp}.json")
        try:
            shutil.copy2(self.path, backup)
            self.recovery_backup = backup
        except OSError as exc:
            self.last_error = f"Could not preserve the previous browser data: {exc}"
            self.write_protected = True

    def sealed_payload(self, data: dict | None = None) -> dict:
        payload = dict(data if data is not None else self.data)
        payload.pop("_seal", None)
        return payload

    def seal_for(self, data: dict | None = None) -> str:
        raw = json.dumps(self.sealed_payload(data), sort_keys=True, separators=(",", ":")).encode("utf-8")
        return hmac.new(STORE_SEAL_KEY, raw, hashlib.sha256).hexdigest()

    def verify_seal(self, data: dict) -> bool:
        expected = data.get("_seal", "")
        return bool(expected) and hmac.compare_digest(str(expected), self.seal_for(data))

    def save(self) -> bool:
        if self.write_protected:
            return False
        temporary = self.path.with_name(f".{self.path.name}.{os.getpid()}.tmp")
        try:
            self.data["schema_version"] = 2
            self.data["_seal"] = self.seal_for()
            with temporary.open("w", encoding="utf-8", newline="\n") as handle:
                handle.write(json.dumps(self.data, indent=2, ensure_ascii=False))
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, self.path)
            self.last_error = ""
            return True
        except (OSError, TypeError, ValueError) as exc:
            self.last_error = str(exc)
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass
            return False

    def export_backup(self, destination: Path) -> None:
        payload = {
            "format": self.BACKUP_FORMAT,
            "version": self.BACKUP_VERSION,
            "exported_at": datetime.now().astimezone().isoformat(timespec="seconds"),
            "data": {key: self.data.get(key) for key in self.BACKUP_KEYS},
        }
        temporary = destination.with_name(f".{destination.name}.{os.getpid()}.tmp")
        try:
            with temporary.open("w", encoding="utf-8", newline="\n") as handle:
                handle.write(json.dumps(payload, indent=2, ensure_ascii=False))
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, destination)
        except (OSError, TypeError, ValueError):
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass
            raise

    def restore_backup(self, source: Path) -> None:
        if source.stat().st_size > 10 * 1024 * 1024:
            raise ValueError("The selected backup is larger than the 10 MB import limit.")
        payload = json.loads(source.read_text(encoding="utf-8"))
        if not isinstance(payload, dict) or payload.get("format") != self.BACKUP_FORMAT or payload.get("version") != self.BACKUP_VERSION:
            raise ValueError("This file is not a supported Ghost Surfer browser-data backup.")
        incoming = payload.get("data")
        if not isinstance(incoming, dict):
            raise ValueError("The backup does not contain a browser-data object.")
        bookmarks = incoming.get("bookmarks")
        history = incoming.get("history")
        permissions = incoming.get("cookie_permissions")
        alerts = incoming.get("spy_alerts")
        downloads = incoming.get("download_history", [])
        if not all(isinstance(value, list) for value in (bookmarks, history, alerts, downloads)) or not isinstance(permissions, dict):
            raise ValueError("The backup is incomplete or has invalid data types.")
        cleaned_bookmarks = [
            {"title": str(row.get("title") or row["url"]), "url": str(row["url"]), "folder": str(row.get("folder", ""))}
            for row in bookmarks
            if isinstance(row, dict) and str(row.get("url", "")).startswith(("http://", "https://"))
        ]
        cleaned_history = [
            {"title": str(row.get("title") or row["url"]), "url": str(row["url"]), "visited_at": str(row.get("visited_at", ""))}
            for row in history
            if isinstance(row, dict) and str(row.get("url", "")).startswith(("http://", "https://"))
        ]
        cleaned_permissions = {
            str(domain): choice for domain, choice in list(permissions.items())[:5000]
            if isinstance(choice, str) and choice in {"allow", "deny"}
        }
        cleaned_alerts = [
            {
                "site": str(row.get("site", "unknown site")),
                "detail": str(row.get("detail", ""))[:180],
                "category": str(row.get("category", "tracker")),
                "seen_at": str(row.get("seen_at", "")),
            }
            for row in alerts if isinstance(row, dict)
        ]
        cleaned_downloads = [
            {"path": str(row.get("path", "")), "state": str(row.get("state", "Interrupted")),
             "url": str(row.get("url", "")), "started_at": str(row.get("started_at", "")),
             "finished_at": str(row.get("finished_at", ""))}
            for row in downloads if isinstance(row, dict) and row.get("path")
        ]
        previous = {key: self.data.get(key) for key in self.BACKUP_KEYS}
        self.data["bookmarks"] = cleaned_bookmarks
        self.data["history"] = cleaned_history
        self.data["cookie_permissions"] = cleaned_permissions
        self.data["spy_alerts"] = cleaned_alerts
        self.data["download_history"] = cleaned_downloads
        if not self.save():
            self.data.update(previous)
            raise OSError(f"Could not save restored browser data: {self.last_error}")

    def storage_summary(self) -> str:
        try:
            size = self.path.stat().st_size if self.path.exists() else 0
        except OSError:
            size = 0
        return f"{len(self.data.get('bookmarks', []))} bookmarks  ·  {len(self.data.get('history', []))} history entries  ·  {size / 1024:.1f} KB stored"

    def add_history(self, title: str, url: str, *, persist: bool = True) -> bool:
        if not url.startswith(("http://", "https://")):
            return False
        entry = {"title": title or url, "url": url, "visited_at": datetime.now().astimezone().isoformat(timespec="seconds")}
        history = [item for item in self.data["history"] if item.get("url") != url]
        history.insert(0, entry)
        retention = int(self.data.get("settings", {}).get("history_retention_days", 0) or 0)
        if retention:
            cutoff = datetime.now().astimezone().timestamp() - retention * 86400
            kept = []
            for row in history:
                try:
                    if datetime.fromisoformat(row.get("visited_at", "")).timestamp() >= cutoff:
                        kept.append(row)
                except (ValueError, TypeError):
                    kept.append(row)
            history = kept
        self.data["history"] = history
        if persist:
            return self.save()
        return True

    def add_bookmark(self, title: str, url: str) -> None:
        if not url.startswith(("http://", "https://")):
            return
        if any(item.get("url") == url for item in self.data["bookmarks"]):
            return
        self.data["bookmarks"].insert(0, {"title": title or url, "url": url})
        self.save()


class BrowserPage(QWebEnginePage):
    def __init__(self, window: "BrowserWindow", profile: QWebEngineProfile) -> None:
        super().__init__(profile, window)
        self.window = window
        self.featurePermissionRequested.connect(self.handle_permission_request)
        self.personal_data_consent_bridge = install_personal_data_monitor(self, window.handle_personal_data_request)

    def createWindow(self, _type: QWebEnginePage.WebWindowType) -> "BrowserPage":
        tab = self.window.add_tab("about:blank", switch=True)
        return tab.page()

    def handle_permission_request(self, origin: QUrl, feature: QWebEnginePage.Feature) -> None:
        handle_permission_request(self.window, self, origin, feature)


class BrowserTab(QWebEngineView):
    def __init__(self, window: "BrowserWindow") -> None:
        super().__init__(window)
        self.window = window
        self.setAcceptDrops(True)
        self.setPage(BrowserPage(window, window.profile))
        self.settings().setAttribute(QWebEngineSettings.WebAttribute.FullScreenSupportEnabled, True)
        self.loadStarted.connect(window.on_load_started)
        self.loadProgress.connect(window.on_load_progress)
        self.loadFinished.connect(window.on_load_finished)
        self.urlChanged.connect(window.on_url_changed)
        self.titleChanged.connect(window.on_title_changed)

    def contextMenuEvent(self, event) -> None:
        page = self.page()
        data = page.contextMenuData()
        menu = QMenu(self)
        link = data.linkUrl()
        media = data.mediaUrl()
        selected = data.selectedText().strip()
        if link.isValid() and not link.isEmpty():
            menu.addAction("Open link in new tab", lambda: self.window.add_tab(link.toString(), True))
            menu.addAction("Copy link address", lambda: QApplication.clipboard().setText(link.toString()))
            menu.addAction("Open link in this tab", lambda: self.window.navigate(self, link.toString()))
            menu.addSeparator()
        if not media.isEmpty():
            menu.addAction("Copy image", lambda: page.action(QWebEnginePage.WebAction.CopyImageToClipboard).trigger())
            menu.addAction("Save image…", lambda: page.action(QWebEnginePage.WebAction.SaveImageToDisk).trigger())
            menu.addSeparator()
        if selected:
            menu.addAction("Copy selection", lambda: page.action(QWebEnginePage.WebAction.Copy).trigger())
            menu.addAction("Search Startpage for selection", lambda: self.window.search_selected_text(selected))
            menu.addSeparator()
        if page.isContentEditable():
            for label, action_name in (("Undo", "Undo"), ("Redo", "Redo"), ("Cut", "Cut"),
                                       ("Copy", "Copy"), ("Paste", "Paste"), ("Select all", "SelectAll")):
                action_enum = getattr(QWebEnginePage.WebAction, action_name, None)
                if action_enum is not None:
                    action = page.action(action_enum)
                    action.setText(label)
                    menu.addAction(action)
            menu.addSeparator()
        page_url = self.url()
        host = page_url.host().lower()
        if host and page_url.scheme().lower() in {"http", "https"}:
            menu.addSection(f"Temporary controls for {host}")
            javascript_action = menu.addAction("Allow JavaScript for this site until Ghost Surfer closes")
            javascript_action.setCheckable(True)
            javascript_action.setChecked(page.settings().testAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled))
            javascript_action.toggled.connect(lambda enabled: self.window.set_temporary_site_control(self, "javascript", enabled))
            images_action = menu.addAction("Load images for this site until Ghost Surfer closes")
            images_action.setCheckable(True)
            images_action.setChecked(page.settings().testAttribute(QWebEngineSettings.WebAttribute.AutoLoadImages))
            images_action.toggled.connect(lambda enabled: self.window.set_temporary_site_control(self, "images", enabled))
            menu.addSeparator()
        menu.addAction("Back", self.back).setEnabled(self.history().canGoBack())
        menu.addAction("Forward", self.forward).setEnabled(self.history().canGoForward())
        menu.addAction("Reload", self.reload)
        menu.addSeparator()
        menu.addAction("Copy page address", lambda: QApplication.clipboard().setText(self.url().toString()))
        menu.addAction("Translate this page…", lambda: self.window.translate_current_page(self))
        menu.addAction("Picture in picture", lambda: self.window.toggle_picture_in_picture(self))
        menu.exec(event.globalPos())

    def dragEnterEvent(self, event) -> None:
        mime = event.mimeData()
        if mime.hasUrls() or (mime.hasText() and mime.text().strip()):
            event.acceptProposedAction()
        else:
            event.ignore()

    def dropEvent(self, event) -> None:
        mime = event.mimeData()
        if mime.hasUrls() and mime.urls():
            url = mime.urls()[0]
            if url.isLocalFile():
                extension = Path(url.toLocalFile()).suffix.lower()
                if extension not in {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}:
                    self.window.status.showMessage("Dropped files are limited to PDF and image formats", 4000)
                    event.ignore()
                    return
            elif url.scheme().lower() not in {"http", "https"}:
                event.ignore()
                return
            self.window.navigate(self, url.toString())
            event.acceptProposedAction()
            return
        if mime.hasText() and mime.text().strip():
            self.window.navigate(self, mime.text().strip())
            event.acceptProposedAction()
            return
        event.ignore()


class BrowserWindow(QMainWindow):
    blocked_request_event = Signal(str, str, bool)
    cookie_filter_event = Signal(str, str)
    ip_lookup_event = Signal(str, str, str, str)

    def __init__(self) -> None:
        super().__init__()
        self.store = BrowserStore()
        self._store_save_timer = QTimer(self)
        self._store_save_timer.setSingleShot(True)
        self._store_save_timer.setInterval(450)
        self._store_save_timer.timeout.connect(self.flush_store_save)
        self._store_save_pending = False
        self._download_save_timer = QTimer(self)
        self._download_save_timer.setSingleShot(True)
        self._download_save_timer.setInterval(800)
        self._download_save_timer.timeout.connect(self.persist_download_history)
        self._temporary_site_overrides: dict[str, dict[str, bool]] = {}
        self._update_worker: UpdateWorker | None = None
        self._update_candidate = None
        self._staged_update = None
        self._update_progress_dialog: QProgressDialog | None = None
        self.blocked_count = 0
        self.tracker_blocked_count = 0
        self.downloads = [
            {**row, "request": None, "item": None,
             "state": "Interrupted" if row.get("state") in {"Queued", "Downloading"} else row.get("state", "Interrupted")}
            for row in self.store.data.get("download_history", [])
        ]
        self.closed_tabs = []
        self.settings_data = self.store.data["settings"]
        self.speed_mode = bool(self.settings_data.get("speed_mode", True))
        self.zoom_level = int(self.settings_data.get("zoom", 100))
        self.pending_cookie_prompts = set()
        self.cookie_prompt_queue = []
        self.active_cookie_prompt = None
        self.notified_spy_hosts = set()
        self.notified_ip_lookup_sites = set()
        self.recorded_ip_lookup_keys = set()
        self.notified_third_party_cookie_hosts = set()
        self.blocked_request_event.connect(self.queue_blocked_request, Qt.ConnectionType.QueuedConnection)
        self.cookie_filter_event.connect(self.handle_cookie_filter_event, Qt.ConnectionType.QueuedConnection)
        self.ip_lookup_event.connect(self.queue_ip_lookup_alert, Qt.ConnectionType.QueuedConnection)
        self._pending_blocked_count = 0
        self._pending_tracker_count = 0
        self._pending_spy_hosts = {}
        self._pending_ip_lookup_events = {}
        self._privacy_flush_timer = QTimer(self)
        self._privacy_flush_timer.setSingleShot(True)
        self._privacy_flush_timer.setInterval(250)
        self._privacy_flush_timer.timeout.connect(self.flush_privacy_events)
        self.extensions_profile_enabled = bool(self.settings_data.get("extensions_profile_enabled", False))
        if self.extensions_profile_enabled:
            self.profile = QWebEngineProfile("GhostSurferExtensions", self)
            self.profile.setPersistentStoragePath(str(app_data_dir() / "extensions-profile"))
            self.profile.setCachePath(str(app_data_dir() / "extensions-cache"))
        else:
            self.profile = QWebEngineProfile.defaultProfile()
        self.profile.setPersistentCookiesPolicy(QWebEngineProfile.PersistentCookiesPolicy.AllowPersistentCookies)
        self.cookie_policy = FirstPartyCookiePolicy(self)
        self.profile.cookieStore().setCookieFilter(self.cookie_policy.filter)
        self.privacy_interceptor = GhostGuardRequestInterceptor(self)
        self.profile.setUrlRequestInterceptor(self.privacy_interceptor)
        self.profile.downloadRequested.connect(self.handle_download)

        self.setWindowTitle(APP_NAME)
        self.setWindowIcon(QIcon(ghost_icon_pixmap(128)))
        self.setMinimumSize(920, 640)
        self.resize(1220, 820)
        self.progress_timer = QTimer(self)
        self.progress_timer.setSingleShot(True)
        self.progress_timer.timeout.connect(lambda: self.progress_label.setText("Ready"))

        self.tabs = QTabWidget()
        self.tabs.setAccessibleName("Open browser tabs")
        self.tabs.setAccessibleDescription("Use Control and Tab to move between open pages. Right-click a tab for tab actions.")
        self.tabs.setDocumentMode(True)
        self.tabs.setMovable(True)
        self.tabs.setTabsClosable(True)
        self.tabs.currentChanged.connect(self.sync_current_tab)
        self.tabs.tabCloseRequested.connect(self.close_tab)
        self.find_dialog = FindInPageDialog(self, self.current_tab)

        self.address = QLineEdit()
        self.address.setPlaceholderText("Type a site, search, or paste a URL")
        self.address.setClearButtonEnabled(True)
        self.address.setAccessibleName("Address and search bar")
        self.address.setAccessibleDescription("Enter a website address or search phrase, then press Enter.")
        self.address.returnPressed.connect(self.navigate_from_address)

        self.progress_label = QLabel("Ready")
        self.progress_label.setObjectName("progressLabel")
        self.progress_label.setAccessibleName("Page loading status")
        self.privacy_chip = QLabel("Ghost Guard: On")
        self.privacy_chip.setObjectName("privacyChip")
        tor_text = f"Tor: {TOR_ENDPOINT[1]}" if TOR_ENDPOINT else "Tor: Standby"
        self.tor_chip = QLabel(tor_text)
        self.tor_chip.setObjectName("torChip")
        self.speed_chip = QLabel("Speed: On" if self.speed_mode else "Speed: Off")
        self.speed_chip.setObjectName("speedChip")
        self.blocked_chip = QLabel("Blocked: 0")
        self.blocked_chip.setObjectName("blockedChip")
        self.spy_chip = QLabel("Spy alerts: 0")
        self.spy_chip.setObjectName("spyChip")
        self.tabs_chip = QLabel("Tabs: 0")
        self.tabs_chip.setObjectName("tabsChip")
        self.home_chip = QLabel("Home: DuckDuckGo")
        self.home_chip.setObjectName("homeChip")
        self.site_controls_chip = QLabel("Site controls: defaults")
        self.site_controls_chip.setObjectName("siteControlsChip")
        self.site_controls_chip.setToolTip("Temporary JavaScript or image overrides last until Ghost Surfer closes")
        self.site_controls_chip.setAccessibleName("Temporary site compatibility controls")

        self.status = QStatusBar()
        self.build_privacy_notice()
        self.status.addWidget(self.privacy_notice, 1)
        self.status.addPermanentWidget(self.progress_label)
        self.setStatusBar(self.status)

        self.build_shell()
        self.build_control_center()
        self.extension_features = ExtensionFeatures(self)
        self.extension_features.add_settings(self.control_page_layouts["Extensions"])
        self.chatgpt_bridge_settings = ChatGPTBridgeSettings(self)
        self.chatgpt_bridge_settings.add_settings(self.control_page_layouts["Extensions"])
        self.library_features = LibraryFeatures(self)
        self.library_features.install()
        self.apply_style()
        self.page_ux = PageUxFeatures(self)
        self.add_tab(HOME_URL, switch=True)
        self.tab_features = TabFeatures(self)
        self.tab_features.attach()
        self.apply_engine_settings()
        if self.store.tamper_detected:
            QTimer.singleShot(650, lambda: self.show_privacy_notice(self.store.tamper_message))

    def build_privacy_notice(self) -> None:
        self.privacy_notice = QFrame()
        self.privacy_notice.setObjectName("privacyNotice")
        notice_layout = QHBoxLayout(self.privacy_notice)
        notice_layout.setContentsMargins(10, 4, 8, 4)
        notice_layout.setSpacing(8)
        self.privacy_notice_label = QLabel()
        self.privacy_notice_label.setWordWrap(True)
        notice_layout.addWidget(self.privacy_notice_label, 1)
        self.cookie_allow_btn = QPushButton("Allow this site")
        self.cookie_allow_btn.setObjectName("noticeAllowButton")
        self.cookie_allow_btn.clicked.connect(lambda: self.resolve_cookie_notice(True))
        notice_layout.addWidget(self.cookie_allow_btn)
        self.cookie_deny_btn = QPushButton("Block this site")
        self.cookie_deny_btn.setObjectName("noticeDenyButton")
        self.cookie_deny_btn.clicked.connect(lambda: self.resolve_cookie_notice(False))
        notice_layout.addWidget(self.cookie_deny_btn)
        self.cookie_allow_all_btn = QPushButton("Allow all sites")
        self.cookie_allow_all_btn.setObjectName("noticeDismissButton")
        self.cookie_allow_all_btn.clicked.connect(self.allow_all_first_party_cookies)
        notice_layout.addWidget(self.cookie_allow_all_btn)
        self.notice_dismiss_btn = QPushButton("Dismiss")
        self.notice_dismiss_btn.setObjectName("noticeDismissButton")
        self.notice_dismiss_btn.clicked.connect(self.hide_privacy_notice)
        notice_layout.addWidget(self.notice_dismiss_btn)
        self.privacy_notice.hide()

    def build_shell(self) -> None:
        root = QWidget()
        shell = QHBoxLayout(root)
        shell.setContentsMargins(0, 0, 0, 0)
        shell.setSpacing(0)

        rail = QFrame()
        rail.setObjectName("rail")
        rail_layout = QVBoxLayout(rail)
        rail_layout.setContentsMargins(12, 14, 12, 14)
        rail_layout.setSpacing(10)

        title = QLabel()
        title.setObjectName("railMark")
        title.setPixmap(ghost_icon_pixmap(48))
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        rail_layout.addWidget(title)
        rail_caption = QLabel("GHOST")
        rail_caption.setObjectName("railCaption")
        rail_caption.setAlignment(Qt.AlignmentFlag.AlignCenter)
        rail_layout.addWidget(rail_caption)

        self.back_btn = self.rail_button("Back", self.style().standardIcon(self.style().StandardPixmap.SP_ArrowBack), self.go_back)
        self.forward_btn = self.rail_button("Forward", self.style().standardIcon(self.style().StandardPixmap.SP_ArrowForward), self.go_forward)
        self.reload_btn = self.rail_button("Reload", self.style().standardIcon(self.style().StandardPixmap.SP_BrowserReload), self.reload_page)
        self.home_btn = self.rail_button("Home", self.style().standardIcon(self.style().StandardPixmap.SP_DesktopIcon), lambda: self.go_home())
        self.new_btn = self.rail_button("New tab", self.style().standardIcon(self.style().StandardPixmap.SP_FileDialogNewFolder), lambda: self.add_tab(HOME_URL, True))
        self.bookmark_btn = self.rail_button("Bookmark", self.style().standardIcon(self.style().StandardPixmap.SP_DialogSaveButton), self.bookmark_current)
        self.clear_cache_btn = self.rail_button("Clear cookies & cache", self.style().standardIcon(self.style().StandardPixmap.SP_DialogResetButton), self.clear_cookies_and_cache)
        self.library_btn = self.rail_button("Library", self.style().standardIcon(self.style().StandardPixmap.SP_DirOpenIcon), self.open_library_menu)
        self.personal_vault_btn = self.rail_button("Personal Vault", self.style().standardIcon(self.style().StandardPixmap.SP_DialogSaveButton), self.open_personal_vault)
        self.personal_vault_btn.setEnabled(bool(self.settings_data.get("personal_vault_enabled", False)))
        self.clear_btn = self.rail_button("Clear ghost data", self.style().standardIcon(self.style().StandardPixmap.SP_DialogResetButton), self.clear_ghost_data)
        self.tor_btn = self.rail_button("Tor check", self.style().standardIcon(self.style().StandardPixmap.SP_DriveNetIcon), self.open_tor_check)
        self.dashboard_btn = self.rail_button("Dashboard", self.style().standardIcon(self.style().StandardPixmap.SP_ComputerIcon), self.open_dashboard)
        self.control_btn = self.rail_button("Control center", self.style().standardIcon(self.style().StandardPixmap.SP_FileDialogDetailedView), self.toggle_control_center)

        for button in (
            self.back_btn,
            self.forward_btn,
            self.reload_btn,
            self.home_btn,
            self.new_btn,
            self.bookmark_btn,
            self.clear_cache_btn,
            self.library_btn,
            self.personal_vault_btn,
            self.control_btn,
        ):
            rail_layout.addWidget(button)
        rail_layout.addStretch(1)

        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setContentsMargins(20, 18, 20, 14)
        content_layout.setSpacing(12)

        dock = QFrame()
        dock.setObjectName("addressDock")
        dock_layout = QVBoxLayout(dock)
        dock_layout.setContentsMargins(14, 10, 14, 10)
        dock_layout.setSpacing(7)

        command_top = QHBoxLayout()
        command_top.setSpacing(10)
        brand_icon = QLabel()
        brand_icon.setObjectName("brandIcon")
        brand_icon.setPixmap(ghost_icon_pixmap(44))
        command_top.addWidget(brand_icon, 0)
        brand_stack = QVBoxLayout()
        brand_stack.setSpacing(1)
        brand_lockup = QLabel("Ghost Surfer")
        brand_lockup.setObjectName("brandLockup")
        brand_subtitle = QLabel("Private browsing  |  Ghost Guard")
        brand_subtitle.setObjectName("brandSubtitle")
        brand_stack.addWidget(brand_lockup)
        brand_stack.addWidget(brand_subtitle)
        command_top.addLayout(brand_stack, 0)
        command_top.addWidget(self.privacy_chip, 0)
        command_top.addWidget(self.tor_chip, 0)
        command_top.addWidget(self.speed_chip, 0)
        command_top.addStretch(1)
        dock_layout.addLayout(command_top)

        command_row = QHBoxLayout()
        command_row.setSpacing(10)
        ghost_label = QLabel("ADDRESS")
        ghost_label.setObjectName("urlLabel")
        command_row.addWidget(ghost_label, 0)
        command_row.addWidget(self.address, 1)
        launch = QPushButton("Go")
        launch.setObjectName("openButton")
        launch.clicked.connect(self.navigate_from_address)
        command_row.addWidget(launch, 0)
        dock_layout.addLayout(command_row)

        status_deck = QFrame()
        status_deck.setObjectName("statusDeck")
        status_deck_layout = QHBoxLayout(status_deck)
        status_deck_layout.setContentsMargins(8, 5, 8, 5)
        status_deck_layout.setSpacing(8)
        status_deck_layout.addWidget(self.tabs_chip, 0)
        status_deck_layout.addWidget(self.home_chip, 0)
        status_deck_layout.addWidget(self.site_controls_chip, 0)
        status_deck_layout.addWidget(self.blocked_chip, 0)
        status_deck_layout.addWidget(self.spy_chip, 0)
        session_note = QLabel("Per-site cookies  |  Tracker blocking  |  HTTPS preferred")
        session_note.setObjectName("sessionNote")
        status_deck_layout.addWidget(session_note, 1)
        dock_layout.addWidget(status_deck)

        content_layout.addWidget(dock)
        content_layout.addWidget(self.tabs, 1)

        split = QSplitter()
        split.setChildrenCollapsible(False)
        split.addWidget(rail)
        split.addWidget(content)
        split.setSizes([76, 1144])

        shell.addWidget(split)
        self.setCentralWidget(root)
        self.install_shortcuts()

    def install_shortcuts(self) -> None:
        shortcuts = (
            ("Ctrl+K", self.open_command_palette),
            ("Ctrl+,", self.toggle_control_center),
            ("Ctrl+F", self.find_dialog.open_find),
            ("Ctrl+P", self.save_current_page_as_pdf),
            ("F1", self.show_shortcuts_guide),
            ("F11", self.toggle_distraction_free),
            ("Ctrl+L", self.focus_address),
            ("Ctrl+T", lambda: self.add_tab(HOME_URL, switch=True)),
            ("Ctrl+W", lambda: self.close_tab(self.tabs.currentIndex())),
            ("Ctrl+Shift+T", self.reopen_closed_tab),
            ("Ctrl+R", self.reload_page),
            ("Ctrl+D", self.bookmark_current),
            ("Ctrl+J", self.open_download_manager),
            ("Escape", self.stop_loading),
            ("Alt+P", self.toggle_picture_in_picture),
        )
        for sequence, callback in shortcuts:
            shortcut = QShortcut(QKeySequence(sequence), self)
            shortcut.activated.connect(callback)

    def open_command_palette(self) -> None:
        dialog = QDialog(self)
        dialog.setWindowTitle("Ghost Surfer quick access")
        dialog.setObjectName("commandPalette")
        dialog.setMinimumWidth(560)
        dialog.resize(620, 520)
        layout = QVBoxLayout(dialog)
        layout.setContentsMargins(18, 18, 18, 16)
        layout.setSpacing(10)

        heading = QLabel("Quick access")
        heading.setObjectName("paletteHeading")
        layout.addWidget(heading)
        hint = QLabel("Run an action, switch tabs, or open a bookmark or recent page. Press Esc to close.")
        hint.setWordWrap(True)
        hint.setObjectName("paletteHint")
        layout.addWidget(hint)

        search = QLineEdit()
        search.setPlaceholderText("Search actions, tabs, bookmarks, and history…")
        search.setClearButtonEnabled(True)
        search.setAccessibleName("Search quick access")
        layout.addWidget(search)

        results = QListWidget()
        results.setObjectName("paletteResults")
        results.setAlternatingRowColors(True)
        layout.addWidget(results, 1)
        footer = QLabel("Enter to open  ·  Ctrl+K to reopen")
        footer.setObjectName("paletteHint")
        layout.addWidget(footer)

        actions = [
            ("New tab", "action", "new_tab", "create blank start page"),
            ("Focus address bar", "action", "address", "type a URL or search"),
            ("Reload current page", "action", "reload", "refresh"),
            ("Save bookmark", "action", "bookmark", "favorites current page"),
            ("Open downloads", "action", "downloads", "download manager"),
            ("Open Ghost Control", "action", "control", "settings privacy appearance"),
            ("Show start page", "action", "home", "dashboard"),
            ("Run Tor connection check", "action", "tor", "check tor status"),
            ("Reopen closed tab", "action", "reopen", "undo close"),
            ("Close other tabs", "action", "close_others", "keep current tab"),
            ("Find in page", "action", "find", "search text on current page"),
            ("Save current page as PDF", "action", "save_pdf", "print export"),
            ("Keyboard shortcuts guide", "action", "shortcuts", "help hotkeys"),
            ("Recently closed tabs", "action", "recent_tabs", "reopen recently closed pages"),
            ("Save named tab session", "action", "save_session", "save workspace tabs"),
            ("Manage tab sessions", "action", "manage_sessions", "restore saved workspace"),
            ("Restore previous session", "action", "restore_session", "restore last browsing session"),
            ("Pin or unpin current tab", "action", "pin_tab", "protect tab from closing"),
            ("Set current tab group", "action", "group_tab", "color group organize"),
            ("Mute or unmute current tab", "action", "mute_tab", "silence audio"),
            ("Open split view", "action", "split_view", "two pages side by side"),
            ("Reader view", "action", "reader", "simplified text view"),
            ("Capture page screenshot", "action", "screenshot", "save visible page as png"),
            ("Toggle distraction-free view", "action", "fullscreen", "full screen hide browser controls"),
            ("Toggle high contrast", "action", "high_contrast", "accessibility contrast"),
            ("Manage bookmarks", "action", "manage_bookmarks", "search rename delete folders"),
            ("Import bookmarks from HTML", "action", "import_bookmarks", "restore bookmarks"),
            ("Export bookmarks to HTML", "action", "export_bookmarks", "backup bookmarks"),
            ("Remove selected history", "action", "remove_history", "delete selected visits"),
            ("Export browser-data backup", "action", "export_data", "backup bookmarks history privacy choices"),
            ("Restore browser-data backup", "action", "restore_data", "import saved browser data"),
            ("Clear cookies and cache", "action", "clear_site_data", "remove website cookies and cached files keep history"),
            ("Clear browsing data…", "action", "clear_data", "cookies cache history"),
            ("Translate current page…", "action", "translate", "language external"),
            ("Picture in picture", "action", "pip", "video floating player"),
            ("Recover browser data…", "action", "recover_data", "restore recovery copy"),
            ("Select tabs for bulk actions…", "action", "bulk_tabs", "multi select close group mute pin"),
        ]
        entries = [(label, kind, value, keywords) for label, kind, value, keywords in actions]

        for index in range(self.tabs.count()):
            tab = self.tabs.widget(index)
            if isinstance(tab, BrowserTab):
                title = tab.title().strip() or "Loading page"
                entries.append((f"Tab {index + 1}  ·  {title}", "tab", index, tab.url().toString()))
        for item in self.store.data.get("bookmarks", []):
            url = item.get("url", "")
            if url:
                title = item.get("title") or url
                entries.append((f"Bookmark  ·  {title}", "url", url, url))
        for item in self.store.data.get("history", []):
            url = item.get("url", "")
            if url:
                title = item.get("title") or url
                entries.append((f"Recent  ·  {title}", "url", url, url))

        def populate(query: str = "") -> None:
            needle = query.strip().casefold()
            matches = [entry for entry in entries if not needle or needle in " ".join((entry[0], entry[3])).casefold()]
            if needle and not matches:
                matches = [(f"Search Startpage for  ‘{query.strip()}’", "search", query.strip(), query.strip())]
            results.clear()
            for label, kind, value, _keywords in matches:
                item = QListWidgetItem(label)
                item.setData(Qt.ItemDataRole.UserRole, (kind, value))
                results.addItem(item)
            if results.count():
                results.setCurrentRow(0)

        def activate(item: QListWidgetItem | None = None) -> None:
            item = item or results.currentItem()
            if not item:
                return
            kind, value = item.data(Qt.ItemDataRole.UserRole)
            if kind == "action":
                callbacks = {
                    "new_tab": lambda: self.add_tab(HOME_URL, True),
                    "address": self.focus_address,
                    "reload": self.reload_page,
                    "bookmark": self.bookmark_current,
                    "downloads": self.open_download_manager,
                    "control": self.toggle_control_center,
                    "home": self.open_dashboard,
                    "tor": self.open_tor_check,
                    "reopen": self.reopen_closed_tab,
                    "close_others": self.close_other_tabs,
                    "find": self.find_dialog.open_find,
                    "save_pdf": self.save_current_page_as_pdf,
                    "shortcuts": self.show_shortcuts_guide,
                    "recent_tabs": self.tab_features.show_recently_closed,
                    "save_session": self.tab_features.save_named_session,
                    "manage_sessions": self.tab_features.manage_sessions,
                    "restore_session": self.tab_features.restore_previous_session_now,
                    "pin_tab": self.tab_features.toggle_pin_current,
                    "group_tab": self.tab_features.set_tab_group,
                    "mute_tab": self.tab_features.toggle_mute_current,
                    "split_view": self.tab_features.show_split_view,
                    "reader": self.toggle_reader_view,
                    "screenshot": self.capture_page_screenshot,
                    "fullscreen": self.toggle_distraction_free,
                    "high_contrast": self.toggle_high_contrast,
                    "manage_bookmarks": self.library_features.show_bookmark_manager,
                    "import_bookmarks": self.library_features.import_bookmarks,
                    "export_bookmarks": self.library_features.export_bookmarks,
                    "remove_history": self.library_features.remove_selected_history,
                    "export_data": self.export_browser_data,
                    "restore_data": self.restore_browser_data,
                    "clear_site_data": self.clear_cookies_and_cache,
                    "clear_data": self.clear_ghost_data,
                    "translate": self.translate_current_page,
                    "pip": self.toggle_picture_in_picture,
                    "recover_data": self.show_recovery_center,
                    "bulk_tabs": self.tab_features.show_bulk_tab_actions,
                }
                callbacks[value]()
            elif kind == "tab":
                if 0 <= value < self.tabs.count():
                    self.tabs.setCurrentIndex(value)
            elif kind in {"url", "search"}:
                tab = self.current_tab()
                if tab:
                    self.navigate(tab, value)
                else:
                    self.add_tab(value, True)
            dialog.accept()

        search.textChanged.connect(populate)
        search.returnPressed.connect(lambda: activate())
        results.itemActivated.connect(activate)
        populate()
        dialog.show()
        search.setFocus()
        dialog.exec()

    def save_current_page_as_pdf(self) -> None:
        save_current_page_as_pdf(self, self.current_tab())

    def show_shortcuts_guide(self) -> None:
        show_shortcuts_guide(self)

    def toggle_reader_view(self) -> None:
        self.page_ux.toggle_reader_view()

    def capture_page_screenshot(self) -> None:
        self.page_ux.capture_page_screenshot()

    def toggle_distraction_free(self) -> None:
        self.page_ux.toggle_distraction_free()

    def toggle_high_contrast(self) -> None:
        enabled = not bool(self.settings_data.get("high_contrast", False))
        if hasattr(self, "high_contrast_check"):
            self.high_contrast_check.setChecked(enabled)
        else:
            self.page_ux.set_high_contrast(enabled)

    def rail_button(self, tip: str, icon: QIcon, callback) -> QToolButton:
        button = QToolButton()
        button.setIcon(icon)
        labels = {
            "Back": "Back", "Forward": "Next", "Reload": "Reload", "Home": "Home",
            "New tab": "New tab", "Bookmark": "Save", "Library": "Library",
            "Clear cookies & cache": "Clear cache",
            "Clear ghost data": "Clear data", "Tor check": "Tor", "Dashboard": "Start", "Control center": "Control",
        }
        button.setText(labels.get(tip, tip))
        button.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextUnderIcon)
        button.setToolTip(tip)
        button.setStatusTip(tip)
        button.setAccessibleName(tip)
        button.setIconSize(QSize(18, 18))
        button.setAutoRaise(False)
        button.clicked.connect(callback)
        return button

    def build_control_center(self) -> None:
        self.control_dock = QDockWidget("Ghost Control", self)
        self.control_dock.setObjectName("controlDock")
        self.control_dock.setAllowedAreas(Qt.DockWidgetArea.RightDockWidgetArea)
        self.control_category = QComboBox()
        self.control_category.setObjectName("controlCategory")
        self.control_category.setAccessibleName("Ghost Control section")
        category_row = QHBoxLayout()
        category_row.setContentsMargins(0, 0, 0, 0)
        category_row.setSpacing(8)
        category_label = QLabel("SECTION")
        category_label.setObjectName("controlSectionLabel")
        category_row.addWidget(category_label)
        category_row.addWidget(self.control_category, 1)
        self.control_pages = QStackedWidget()
        self.control_pages.setObjectName("controlPages")
        self.control_search = QLineEdit()
        self.control_search.setObjectName("controlSearch")
        self.control_search.setPlaceholderText("Search settings and tools…")
        self.control_search.setClearButtonEnabled(True)
        self.control_search.setAccessibleName("Search Ghost Control settings and tools")
        self.control_search.setToolTip("Filter settings and tools by name. Matching sections are grouped by page.")
        self.control_search_feedback = QLabel()
        self.control_search_feedback.setObjectName("controlSearchFeedback")
        self.control_search_feedback.setWordWrap(True)
        self.control_search_feedback.hide()
        control_panel = QWidget()
        control_panel_layout = QVBoxLayout(control_panel)
        control_panel_layout.setContentsMargins(8, 8, 8, 8)
        control_panel_layout.setSpacing(6)
        control_panel_layout.addWidget(self.control_search)
        control_panel_layout.addWidget(self.control_search_feedback)
        control_panel_layout.addLayout(category_row)
        control_panel_layout.addWidget(self.control_pages, 1)

        def make_control_page(title: str):
            scroll = QScrollArea()
            scroll.setObjectName("controlScroll")
            scroll.setWidgetResizable(True)
            scroll.setFrameShape(QFrame.Shape.NoFrame)
            panel = QWidget()
            page_layout = QVBoxLayout(panel)
            page_layout.setContentsMargins(12, 12, 12, 12)
            page_layout.setSpacing(10)
            scroll.setWidget(panel)
            self.control_category.addItem(title)
            self.control_pages.addWidget(scroll)
            return page_layout

        general_layout = make_control_page("General")
        privacy_layout = make_control_page("Privacy")
        appearance_layout = make_control_page("Display")
        performance_layout = make_control_page("Performance")
        workspace_layout = make_control_page("Tabs & Data")
        extensions_layout = make_control_page("Extensions")
        self.control_page_layouts = {
            "General": general_layout,
            "Privacy": privacy_layout,
            "Display": appearance_layout,
            "Performance": performance_layout,
            "Tabs & Data": workspace_layout,
            "Extensions": extensions_layout,
        }
        saved_page = str(self.settings_data.get("control_last_page", "General"))
        saved_page_index = 0
        for page_index in range(self.control_category.count()):
            if self.control_category.itemText(page_index) == saved_page:
                saved_page_index = page_index
                break
        self.control_category.setCurrentIndex(saved_page_index)
        self.control_pages.setCurrentIndex(saved_page_index)
        self.control_category.currentIndexChanged.connect(self.control_pages.setCurrentIndex)
        self.control_category.currentIndexChanged.connect(self.save_control_page_selection)
        self.control_search.textChanged.connect(self.filter_control_pages)
        update_group = QGroupBox("Ghost Surfer Updates")
        update_layout = QVBoxLayout(update_group)
        update_source = QLabel(f"Installed version: {APP_VERSION}\nUpdate source: GitHub releases for ghostventure/GhostVenture-Projects")
        update_source.setWordWrap(True)
        update_layout.addWidget(update_source)
        self.update_status_label = QLabel("Updates are checked only when you ask.")
        self.update_status_label.setWordWrap(True)
        self.update_status_label.setAccessibleName("Update status")
        update_layout.addWidget(self.update_status_label)
        self.check_updates_btn = QPushButton("Check for updates")
        self.check_updates_btn.setObjectName("panelButton")
        self.check_updates_btn.setAccessibleName("Check Ghost Surfer updates on GitHub")
        self.check_updates_btn.clicked.connect(self.check_for_updates)
        update_layout.addWidget(self.check_updates_btn)
        general_layout.addWidget(update_group)
        layout = privacy_layout

        request_guard_group = QGroupBox("Personal Data Requests & Site Checks")
        request_guard_layout = QVBoxLayout(request_guard_group)
        self.data_request_guard_check = QCheckBox("Pause form submissions that request personal or payment information")
        self.data_request_guard_check.setChecked(bool(self.settings_data.get("data_request_guard_enabled", True)))
        self.data_request_guard_check.toggled.connect(lambda enabled: self.update_setting("data_request_guard_enabled", enabled))
        request_guard_layout.addWidget(self.data_request_guard_check)
        self.site_verification_check = QCheckBox("Refresh public domain registration details at most every 30 days")
        self.site_verification_check.setChecked(bool(self.settings_data.get("site_verification_enabled", True)))
        self.site_verification_check.toggled.connect(lambda enabled: self.update_setting("site_verification_enabled", enabled))
        request_guard_layout.addWidget(self.site_verification_check)
        request_guard_layout.addWidget(QLabel("Ghost Surfer lists requested fields and sends only fields you select. Registration age and registrar data are risk signals, not proof of company identity or honesty. Domain checks send the destination domain to IANA and its authoritative registry."))
        forget_recognized_btn = QPushButton("Forget recognized sites")
        forget_recognized_btn.setObjectName("panelButton")
        forget_recognized_btn.clicked.connect(self.forget_recognized_sites)
        request_guard_layout.addWidget(forget_recognized_btn)
        layout.addWidget(request_guard_group)

        status_group = QGroupBox("Privacy Status")
        status_layout = QGridLayout(status_group)
        self.location_status = QLabel("Location: blocked")
        self.cookie_status = QLabel("Cookies: ask per site")
        self.tracker_status = QLabel("Trackers blocked: 0")
        self.spy_status = QLabel("Spy alerts: 0")
        self.ip_tripwire_status = QLabel("IP tripwire: watching (alerts only)")
        self.tor_status = QLabel(f"Tor: {TOR_ENDPOINT[0]}:{TOR_ENDPOINT[1]}" if TOR_ENDPOINT else "Tor: standby")
        status_layout.addWidget(self.location_status, 0, 0)
        status_layout.addWidget(self.cookie_status, 1, 0)
        status_layout.addWidget(self.tracker_status, 2, 0)
        status_layout.addWidget(self.spy_status, 3, 0)
        status_layout.addWidget(self.tor_status, 4, 0)
        status_layout.addWidget(self.ip_tripwire_status, 5, 0)
        layout.addWidget(status_group)

        cookie_policy_group = QGroupBox("Cookies & Consent")
        cookie_policy_layout = QVBoxLayout(cookie_policy_group)
        self.cookie_policy_combo = QComboBox()
        self.cookie_policy_options = [
            ("Ask once per site", "ask"),
            ("Allow first-party cookies", "allow"),
            ("Block all cookies", "deny"),
        ]
        for label, value in self.cookie_policy_options:
            self.cookie_policy_combo.addItem(label, value)
        policy_index = self.cookie_policy_combo.findData(self.settings_data.get("cookie_policy", "ask"))
        self.cookie_policy_combo.setCurrentIndex(max(0, policy_index))
        self.cookie_policy_combo.currentIndexChanged.connect(self.set_cookie_policy)
        cookie_policy_layout.addWidget(self.cookie_policy_combo)
        cookie_policy_layout.addWidget(QLabel("Third-party tracking cookies stay blocked. Site permissions such as camera and location stay blocked."))
        cookie_effect_note = QLabel("Blocking cookies can sign you out or break carts and preferences. Disabling JavaScript or images can make sites unusable. These controls reduce some tracking; they do not hide your network address or make browsing anonymous.")
        cookie_effect_note.setWordWrap(True)
        cookie_effect_note.setObjectName("mutedHelpText")
        cookie_policy_layout.addWidget(cookie_effect_note)
        layout.addWidget(cookie_policy_group)

        layout = appearance_layout

        theme_group = QGroupBox("Theme Color")
        theme_layout = QVBoxLayout(theme_group)
        self.theme_combo = QComboBox()
        self.theme_combo.addItems(THEMES.keys())
        theme_name = self.settings_data.get("theme", "Ghost Blue")
        self.theme_combo.setCurrentText(theme_name if theme_name in THEMES else "Ghost Blue")
        self.theme_combo.currentTextChanged.connect(self.set_theme)
        theme_layout.addWidget(self.theme_combo)
        layout.addWidget(theme_group)

        zoom_group = QGroupBox("Page Zoom")
        zoom_layout = QVBoxLayout(zoom_group)
        self.zoom_combo = QComboBox()
        self.zoom_combo.addItems(["80%", "90%", "100%", "110%", "125%", "150%"])
        self.zoom_combo.setCurrentText(f"{self.zoom_level}%" if self.zoom_level in {80, 90, 100, 110, 125, 150} else "100%")
        self.zoom_combo.currentTextChanged.connect(self.set_zoom)
        zoom_layout.addWidget(self.zoom_combo)
        layout.addWidget(zoom_group)

        accessibility_group = QGroupBox("Page & Accessibility")
        accessibility_layout = QVBoxLayout(accessibility_group)
        self.site_zoom_combo = QComboBox()
        self.site_zoom_combo.addItems([f"{value}%" for value in (50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200)])
        self.site_zoom_combo.setCurrentText(f"{self.zoom_level}%")
        self.site_zoom_combo.setToolTip("Set a saved zoom level for the current website")
        self.site_zoom_combo.currentTextChanged.connect(lambda value: self.page_ux.set_site_zoom(int(value.rstrip("%"))))
        self.reset_site_zoom_btn = QPushButton("Use default zoom for this site")
        self.reset_site_zoom_btn.setObjectName("panelButton")
        self.reset_site_zoom_btn.clicked.connect(self.use_default_site_zoom)
        accessibility_layout.addWidget(QLabel("Current site zoom"))
        accessibility_layout.addWidget(self.site_zoom_combo)
        accessibility_layout.addWidget(self.reset_site_zoom_btn)
        self.interface_size_combo = QComboBox()
        self.interface_size_combo.addItems([f"{value}%" for value in (80, 90, 100, 110, 125, 150, 175, 180)])
        self.interface_size_combo.setCurrentText(f"{self.settings_data.get('interface_text_size', 100)}%")
        self.interface_size_combo.currentTextChanged.connect(lambda value: self.page_ux.set_interface_text_size(int(value.rstrip("%"))))
        accessibility_layout.addWidget(QLabel("Interface text size"))
        accessibility_layout.addWidget(self.interface_size_combo)
        self.high_contrast_check = QCheckBox("High contrast colors")
        self.high_contrast_check.setChecked(bool(self.settings_data.get("high_contrast", False)))
        self.high_contrast_check.toggled.connect(self.set_high_contrast)
        accessibility_layout.addWidget(self.high_contrast_check)
        self.reduce_motion_check = QCheckBox("Reduce interface motion")
        self.reduce_motion_check.setToolTip("Disables animated page scrolling where supported; does not change website animations.")
        self.reduce_motion_check.setAccessibleName("Reduce interface motion")
        self.reduce_motion_check.setChecked(bool(self.settings_data.get("reduce_motion", False)))
        self.reduce_motion_check.toggled.connect(self.set_reduce_motion)
        accessibility_layout.addWidget(self.reduce_motion_check)
        reader_btn = QPushButton("Toggle reader view")
        screenshot_btn = QPushButton("Capture page screenshot")
        fullscreen_btn = QPushButton("Toggle distraction-free view")
        for button in (reader_btn, screenshot_btn, fullscreen_btn):
            button.setObjectName("panelButton")
            accessibility_layout.addWidget(button)
        reader_btn.clicked.connect(self.toggle_reader_view)
        screenshot_btn.clicked.connect(self.capture_page_screenshot)
        fullscreen_btn.clicked.connect(self.toggle_distraction_free)
        layout.addWidget(accessibility_group)

        layout = performance_layout
        perf_group = QGroupBox("Performance")
        perf_layout = QVBoxLayout(perf_group)
        self.speed_check = QCheckBox("Speed mode")
        self.speed_check.setChecked(self.speed_mode)
        self.speed_check.toggled.connect(self.set_speed_mode)
        self.image_check = QCheckBox("Block images")
        self.image_check.setChecked(bool(self.settings_data.get("block_images", False)))
        self.image_check.toggled.connect(lambda value: self.update_setting("block_images", value))
        self.cleanup_check = QCheckBox("Clear data on close")
        self.cleanup_check.setChecked(bool(self.settings_data.get("ghost_cleanup_on_close", False)))
        self.cleanup_check.toggled.connect(lambda value: self.update_setting("ghost_cleanup_on_close", value))
        self.js_check = QCheckBox("Allow JavaScript")
        self.js_check.setChecked(bool(self.settings_data.get("allow_javascript", True)))
        self.js_check.toggled.connect(lambda value: self.update_setting("allow_javascript", value))
        self.webgl_check = QCheckBox("Allow WebGL")
        self.webgl_check.setChecked(bool(self.settings_data.get("allow_webgl", False)))
        self.webgl_check.toggled.connect(lambda value: self.update_setting("allow_webgl", value))
        for widget in (self.speed_check, self.image_check, self.cleanup_check, self.js_check, self.webgl_check):
            perf_layout.addWidget(widget)
        privacy_effect_note = QLabel("JavaScript and image settings affect every site. A site may need JavaScript for sign-in, video, or interactive controls. Use a temporary site override from the page context menu when needed.")
        privacy_effect_note.setWordWrap(True)
        privacy_effect_note.setObjectName("mutedHelpText")
        perf_layout.addWidget(privacy_effect_note)
        layout.addWidget(perf_group)

        layout = workspace_layout
        vault_group = QGroupBox("Personal Data Vault")
        vault_layout = QVBoxLayout(vault_group)
        self.personal_vault_check = QCheckBox("Enable names, addresses, phone numbers, usernames, and passwords")
        self.personal_vault_check.setChecked(bool(self.settings_data.get("personal_vault_enabled", False)))
        self.personal_vault_check.toggled.connect(self.set_personal_vault_enabled)
        vault_layout.addWidget(self.personal_vault_check)
        vault_layout.addWidget(QLabel("Saved information is encrypted for this Windows account and kept outside browser history and backups. Credit cards are not stored. Login autofill is manual and limited to the exact HTTPS site."))
        open_vault_btn = QPushButton("Open Personal Vault")
        open_vault_btn.setObjectName("panelButton")
        open_vault_btn.setEnabled(bool(self.settings_data.get("personal_vault_enabled", False)))
        open_vault_btn.clicked.connect(self.open_personal_vault)
        self.personal_vault_open_btn = open_vault_btn
        self.personal_vault_check.toggled.connect(open_vault_btn.setEnabled)
        vault_layout.addWidget(open_vault_btn)
        layout.addWidget(vault_group)
        tabs_group = QGroupBox("Tab Actions")
        tabs_layout = QVBoxLayout(tabs_group)
        session_checkpoint_note = QLabel(
            "Open tabs, the selected tab, groups, pinned tabs, and mute state are checkpointed in the background. "
            "Choose Restore previous session in General to reopen that set on launch."
        )
        session_checkpoint_note.setWordWrap(True)
        tabs_layout.addWidget(session_checkpoint_note)
        duplicate_btn = QPushButton("Duplicate tab")
        duplicate_btn.clicked.connect(self.duplicate_current_tab)
        close_others_btn = QPushButton("Close other tabs")
        close_others_btn.clicked.connect(self.close_other_tabs)
        reopen_btn = QPushButton("Reopen closed tab")
        reopen_btn.clicked.connect(self.reopen_closed_tab)
        suspend_btn = QPushButton("Suspend inactive tabs")
        suspend_btn.clicked.connect(self.suspend_inactive_tabs)
        recent_tabs_btn = QPushButton("Recently closed tabs")
        recent_tabs_btn.clicked.connect(lambda: self.tab_features.show_recently_closed())
        save_session_btn = QPushButton("Save current tab session")
        save_session_btn.clicked.connect(lambda: self.tab_features.save_named_session())
        manage_sessions_btn = QPushButton("Manage saved sessions")
        manage_sessions_btn.clicked.connect(lambda: self.tab_features.manage_sessions())
        pin_tab_btn = QPushButton("Pin / unpin current tab")
        pin_tab_btn.clicked.connect(lambda: self.tab_features.toggle_pin_current())
        group_tab_btn = QPushButton("Set tab group")
        group_tab_btn.clicked.connect(lambda: self.tab_features.set_tab_group())
        mute_tab_btn = QPushButton("Mute / unmute current tab")
        mute_tab_btn.clicked.connect(lambda: self.tab_features.toggle_mute_current())
        split_view_btn = QPushButton("Open split view")
        split_view_btn.clicked.connect(lambda: self.tab_features.show_split_view())
        bulk_tabs_btn = QPushButton("Select tabs for bulk actions")
        bulk_tabs_btn.clicked.connect(self.tab_features.show_bulk_tab_actions)
        for widget in (duplicate_btn, close_others_btn, reopen_btn, suspend_btn, recent_tabs_btn,
                       save_session_btn, manage_sessions_btn, pin_tab_btn, group_tab_btn, mute_tab_btn, split_view_btn, bulk_tabs_btn):
            widget.setObjectName("panelButton")
            tabs_layout.addWidget(widget)
        layout.addWidget(tabs_group)

        self.download_list = QListWidget()
        self.download_list.setToolTip("Live download progress and recent download outcomes")
        self.download_list.itemDoubleClicked.connect(lambda _item: self.open_selected_download())
        self.download_list.currentItemChanged.connect(lambda *_args: self.update_download_actions())
        self.bookmark_list = QListWidget()
        self.history_list = QListWidget()
        self.spy_list = QListWidget()
        self.spy_list.setSelectionMode(QListWidget.SelectionMode.ExtendedSelection)
        self.cookie_list = QListWidget()
        self.bookmark_list.itemDoubleClicked.connect(lambda item: self.navigate(self.current_tab(), item.data(Qt.ItemDataRole.UserRole)))
        self.history_list.itemDoubleClicked.connect(lambda item: self.navigate(self.current_tab(), item.data(Qt.ItemDataRole.UserRole)))
        layout = privacy_layout
        self.spy_filter_combo = QComboBox()
        self.spy_filter_combo.addItem("All alerts", "all")
        self.spy_filter_combo.addItem("Trackers", "tracker")
        self.spy_filter_combo.addItem("Permissions", "permission")
        self.spy_filter_combo.addItem("IP tripwire", "ip_lookup")
        self.spy_filter_combo.currentIndexChanged.connect(self.refresh_lists)
        layout.addWidget(self.spy_filter_combo)
        layout.addWidget(self.panel_list("Privacy Alerts", self.spy_list))
        dismiss_alerts_btn = QPushButton("Dismiss selected alerts")
        dismiss_alerts_btn.setObjectName("panelButton")
        dismiss_alerts_btn.clicked.connect(self.dismiss_selected_alerts)
        layout.addWidget(dismiss_alerts_btn)
        layout.addWidget(self.panel_list("Cookie Decisions", self.cookie_list))
        forget_cookie_btn = QPushButton("Forget selected cookie decision")
        forget_cookie_btn.setObjectName("panelButton")
        forget_cookie_btn.clicked.connect(self.forget_selected_cookie_decision)
        forget_all_cookies_btn = QPushButton("Forget all cookie decisions")
        forget_all_cookies_btn.setObjectName("panelButton")
        forget_all_cookies_btn.clicked.connect(self.forget_all_cookie_decisions)
        permission_actions = QGroupBox("Site Decisions")
        permission_actions_layout = QVBoxLayout(permission_actions)
        permission_actions_layout.setContentsMargins(10, 12, 10, 10)
        permission_actions_layout.setSpacing(8)
        permission_actions_layout.addWidget(forget_cookie_btn)
        permission_actions_layout.addWidget(forget_all_cookies_btn)
        layout.addWidget(permission_actions)
        layout = workspace_layout
        downloads_group = self.panel_list("Downloads", self.download_list)
        download_actions = QGridLayout()
        download_actions.setHorizontalSpacing(8)
        download_actions.setVerticalSpacing(8)
        self.open_download_btn = QPushButton("Open")
        self.open_download_btn.setObjectName("panelButton")
        self.open_download_btn.clicked.connect(self.open_selected_download)
        self.show_download_btn = QPushButton("Show folder")
        self.show_download_btn.setObjectName("panelButton")
        self.show_download_btn.clicked.connect(self.show_selected_download)
        self.cancel_download_btn = QPushButton("Cancel")
        self.cancel_download_btn.setObjectName("panelButton")
        self.cancel_download_btn.clicked.connect(self.cancel_selected_download)
        self.clear_downloads_btn = QPushButton("Clear finished")
        self.clear_downloads_btn.setObjectName("panelButton")
        self.clear_downloads_btn.clicked.connect(self.clear_finished_downloads)
        self.delete_download_btn = QPushButton("Delete file & record")
        self.delete_download_btn.setObjectName("panelButton")
        self.delete_download_btn.setToolTip("Permanently delete the selected completed file and remove its history entry")
        self.delete_download_btn.clicked.connect(self.delete_selected_download)
        for position, button in enumerate((self.open_download_btn, self.show_download_btn, self.cancel_download_btn, self.clear_downloads_btn, self.delete_download_btn)):
            download_actions.addWidget(button, position // 2, position % 2)
        downloads_group.layout().addLayout(download_actions)
        layout.addWidget(downloads_group)
        layout.addWidget(self.panel_list("Bookmarks", self.bookmark_list))
        layout.addWidget(self.panel_list("History", self.history_list))

        data_group = QGroupBox("Browser Data")
        data_layout = QVBoxLayout(data_group)
        self.storage_summary_label = QLabel()
        self.storage_summary_label.setWordWrap(True)
        data_layout.addWidget(self.storage_summary_label)
        backup_row = QHBoxLayout()
        export_data_btn = QPushButton("Export backup")
        restore_data_btn = QPushButton("Restore backup")
        for button in (export_data_btn, restore_data_btn):
            button.setObjectName("panelButton")
            backup_row.addWidget(button)
        export_data_btn.clicked.connect(self.export_browser_data)
        restore_data_btn.clicked.connect(self.restore_browser_data)
        data_layout.addLayout(backup_row)
        retention_row = QHBoxLayout()
        retention_row.addWidget(QLabel("Keep history"))
        self.history_retention_combo = QComboBox()
        for label, days in (("Forever", 0), ("30 days", 30), ("90 days", 90), ("1 year", 365)):
            self.history_retention_combo.addItem(label, days)
        current_retention = int(self.settings_data.get("history_retention_days", 0) or 0)
        retention_index = self.history_retention_combo.findData(current_retention)
        self.history_retention_combo.setCurrentIndex(max(0, retention_index))
        self.history_retention_combo.currentIndexChanged.connect(self.set_history_retention)
        retention_row.addWidget(self.history_retention_combo, 1)
        data_layout.addLayout(retention_row)
        recovery_btn = QPushButton("Recover from a saved copy…")
        recovery_btn.setObjectName("panelButton")
        recovery_btn.clicked.connect(self.show_recovery_center)
        data_layout.addWidget(recovery_btn)
        data_layout.addWidget(QLabel("Backup includes bookmarks, history, cookie choices, privacy alerts, and download history. It excludes website cookies/cache and is readable JSON; store it somewhere private."))
        layout.addWidget(data_group)

        maintenance_group = QGroupBox("Maintenance")
        maintenance_layout = QVBoxLayout(maintenance_group)
        clear_site_data_btn = QPushButton("Clear cookies & cache")
        clear_site_data_btn.setObjectName("panelButton")
        clear_site_data_btn.clicked.connect(self.clear_cookies_and_cache)
        maintenance_layout.addWidget(clear_site_data_btn)
        clear_btn = QPushButton("Clear cookies, cache, history")
        clear_btn.setObjectName("panelButton")
        clear_btn.clicked.connect(self.clear_ghost_data)
        maintenance_layout.addWidget(clear_btn)
        reset_profile_btn = QPushButton("Reset browser profile…")
        reset_profile_btn.setObjectName("panelButton")
        reset_profile_btn.setToolTip("Back up browser data, then reset settings, site decisions, history, and tab sessions")
        reset_profile_btn.clicked.connect(self.reset_browser_profile)
        maintenance_layout.addWidget(reset_profile_btn)
        layout.addWidget(maintenance_group)
        for page_layout in (general_layout, privacy_layout, appearance_layout, performance_layout, workspace_layout):
            page_layout.addStretch(1)
        self.control_dock.setWidget(control_panel)
        self.control_dock.setMinimumWidth(320)
        self.control_dock.setMaximumWidth(440)
        self.addDockWidget(Qt.DockWidgetArea.RightDockWidgetArea, self.control_dock)
        self.resizeDocks([self.control_dock], [370], Qt.Orientation.Horizontal)
        self.control_dock.hide()
        self.refresh_lists()
        self.update_storage_summary()

    def panel_list(self, title: str, list_widget: QListWidget) -> QGroupBox:
        group = QGroupBox(title)
        layout = QVBoxLayout(group)
        layout.setContentsMargins(10, 12, 10, 10)
        layout.setSpacing(8)
        list_widget.setMaximumHeight(124)
        layout.addWidget(list_widget)
        return group

    def save_control_page_selection(self, index: int) -> None:
        if not 0 <= index < self.control_category.count():
            return
        page = self.control_category.itemText(index)
        if self.settings_data.get("control_last_page") == page:
            return
        self.settings_data["control_last_page"] = page
        self.store.save()

    def filter_control_pages(self, query: str) -> None:
        needle = query.strip().casefold()
        matching_sections = 0
        matching_pages: list[int] = []
        for page_index in range(self.control_pages.count()):
            page_scroll = self.control_pages.widget(page_index)
            panel = page_scroll.widget() if isinstance(page_scroll, QScrollArea) else None
            groups = panel.findChildren(QGroupBox) if panel is not None else []
            page_matches = bool(needle and needle in self.control_category.itemText(page_index).casefold())
            has_match = False
            for group in groups:
                terms = [group.title(), group.toolTip(), group.accessibleName()]
                for child in group.findChildren(QWidget):
                    for attribute in ("text", "toolTip", "accessibleName", "placeholderText", "currentText"):
                        value = getattr(child, attribute, None)
                        if callable(value):
                            try:
                                value = value()
                            except RuntimeError:
                                continue
                        if isinstance(value, str) and value:
                            terms.append(value)
                    if isinstance(child, QComboBox):
                        terms.extend(child.itemText(i) for i in range(child.count()))
                matched = not needle or page_matches or needle in " ".join(terms).casefold()
                group.setVisible(matched)
                if matched:
                    matching_sections += 1
                    has_match = True
            if has_match:
                matching_pages.append(page_index)

        if not needle:
            self.control_search_feedback.hide()
            return
        if matching_sections:
            page_count = len(matching_pages)
            self.control_search_feedback.setText(
                f"{matching_sections} matching sections across {page_count} "
                f"{'page' if page_count == 1 else 'pages'}"
            )
            if self.control_category.currentIndex() not in matching_pages:
                self.control_category.setCurrentIndex(matching_pages[0])
        else:
            self.control_search_feedback.setText("No matching settings or tools. Clear the search to show everything.")
        self.control_search_feedback.show()

    @Slot(str, str)
    def handle_cookie_filter_event(self, domain: str, event_kind: str) -> None:
        if event_kind == "third-party":
            if domain not in self.notified_third_party_cookie_hosts:
                self.notified_third_party_cookie_hosts.add(domain)
                self.status.showMessage(f"Blocked outside tracking cookie from {domain}", 3500)
            return
        if event_kind == "prompt":
            QTimer.singleShot(0, lambda value=domain: self.prompt_cookie_decision(value))

    def prompt_cookie_decision(self, domain: str) -> None:
        self.pending_cookie_prompts.discard(domain)
        permissions = self.store.data.setdefault("cookie_permissions", {})
        if permissions.get(domain) in {"allow", "deny"}:
            return
        if domain == self.active_cookie_prompt or domain in self.cookie_prompt_queue:
            return
        self.cookie_prompt_queue.append(domain)
        self.show_next_cookie_notice()

    def show_next_cookie_notice(self) -> None:
        if self.active_cookie_prompt or not self.cookie_prompt_queue:
            return
        self.active_cookie_prompt = self.cookie_prompt_queue.pop(0)
        self.show_privacy_notice(
            f"{self.active_cookie_prompt} wants to store first-party cookies. Choose whether to allow or block cookies for this site. Other privacy alerts will appear here too.",
            cookie_decision=True,
        )

    def resolve_cookie_notice(self, allow: bool) -> None:
        domain = self.active_cookie_prompt
        if not domain:
            self.hide_privacy_notice()
            return
        permissions = self.store.data.setdefault("cookie_permissions", {})
        permissions[domain] = "allow" if allow else "deny"
        self.store.save()
        self.update_security_chips()
        if allow:
            self.status.showMessage(f"Cookies approved for {domain}. Reload the page if login or cart features need cookies.", 7000)
        else:
            self.status.showMessage(f"Cookies declined for {domain}", 4500)
        self.active_cookie_prompt = None
        self.hide_privacy_notice()
        QTimer.singleShot(0, self.show_next_cookie_notice)

    def show_privacy_notice(self, message: str, cookie_decision: bool = False) -> None:
        if cookie_decision is False and self.active_cookie_prompt:
            current = self.privacy_notice_label.text()
            if message not in current:
                self.privacy_notice_label.setText(f"{current}\n{message}" if current else message)
            self.cookie_allow_btn.setVisible(True)
            self.cookie_deny_btn.setVisible(True)
            self.cookie_allow_all_btn.setVisible(True)
            self.notice_dismiss_btn.setVisible(False)
            self.privacy_notice.show()
            return
        self.privacy_notice_label.setText(message)
        self.cookie_allow_btn.setVisible(cookie_decision)
        self.cookie_deny_btn.setVisible(cookie_decision)
        self.cookie_allow_all_btn.setVisible(cookie_decision)
        self.notice_dismiss_btn.setVisible(not cookie_decision)
        self.privacy_notice.show()

    def set_cookie_policy(self, _index: int = -1) -> None:
        if not hasattr(self, "cookie_policy_combo"):
            return
        policy = self.cookie_policy_combo.currentData()
        self.settings_data["cookie_policy"] = policy if policy in {"ask", "allow", "deny"} else "ask"
        self.store.save()
        self.update_security_chips()
        self.status.showMessage("Cookie preference updated for all sites. Third-party cookies remain blocked.", 3500)

    def set_history_retention(self, _index: int = -1) -> None:
        if not hasattr(self, "history_retention_combo"):
            return
        days = int(self.history_retention_combo.currentData() or 0)
        self.settings_data["history_retention_days"] = days
        if days:
            cutoff = datetime.now().astimezone().timestamp() - days * 86400
            kept = []
            for row in self.store.data.get("history", []):
                try:
                    if datetime.fromisoformat(row.get("visited_at", "")).timestamp() >= cutoff:
                        kept.append(row)
                except (TypeError, ValueError):
                    kept.append(row)
            self.store.data["history"] = kept
        self.store.save()
        self.refresh_history_list()
        self.status.showMessage("History retention updated", 2500)

    def allow_all_first_party_cookies(self) -> None:
        self.settings_data["cookie_policy"] = "allow"
        if hasattr(self, "cookie_policy_combo"):
            index = self.cookie_policy_combo.findData("allow")
            self.cookie_policy_combo.setCurrentIndex(index)
        else:
            self.store.save()
        domain = self.active_cookie_prompt
        if domain:
            self.store.data.setdefault("cookie_permissions", {})[domain] = "allow"
        self.store.save()
        self.active_cookie_prompt = None
        self.hide_privacy_notice()
        self.update_security_chips()
        QTimer.singleShot(0, self.show_next_cookie_notice)

    def hide_privacy_notice(self) -> None:
        self.privacy_notice.hide()

    def set_theme(self, theme_name: str) -> None:
        if theme_name not in THEMES:
            theme_name = "Ghost Blue"
        self.settings_data["theme"] = theme_name
        self.store.save()
        self.apply_style()
        if hasattr(self, "page_ux") and bool(self.settings_data.get("high_contrast", False)):
            self.page_ux.set_high_contrast(True, persist=False)
        tab = self.current_tab()
        if tab and self.display_url(tab.url()) == DASHBOARD_URL:
            self.open_dashboard()
        self.status.showMessage(f"Theme color changed to {theme_name}", 2200)

    def set_zoom(self, label: str) -> None:
        try:
            zoom = int(label.rstrip("%"))
        except ValueError:
            zoom = 100
        self.zoom_level = zoom
        self.settings_data["zoom"] = zoom
        self.store.save()
        self.apply_engine_settings()
        if hasattr(self, "page_ux"):
            self.page_ux.apply_site_zoom()
        self.status.showMessage(f"Page zoom set to {zoom}%", 2200)

    def use_default_site_zoom(self) -> None:
        if hasattr(self, "page_ux"):
            self.page_ux.use_default_zoom_for_site()
            tab = self.current_tab()
            if tab and hasattr(self, "site_zoom_combo"):
                self.site_zoom_combo.blockSignals(True)
                self.site_zoom_combo.setCurrentText(f"{int(self.settings_data.get('zoom', 100))}%")
                self.site_zoom_combo.blockSignals(False)

    def set_high_contrast(self, enabled: bool) -> None:
        if hasattr(self, "page_ux"):
            self.page_ux.set_high_contrast(enabled)

    def set_reduce_motion(self, enabled: bool) -> None:
        self.settings_data["reduce_motion"] = bool(enabled)
        self.store.save()
        self.apply_engine_settings()

    def set_temporary_site_control(self, tab: BrowserTab, feature: str, enabled: bool) -> None:
        host = tab.url().host().lower()
        if not host or feature not in {"javascript", "images"}:
            return
        overrides = self._temporary_site_overrides.setdefault(host, {})
        overrides[feature] = bool(enabled)
        self.apply_tab_settings(tab)
        self.update_site_controls_chip(tab)
        self.status.showMessage(f"Temporary {feature} setting changed for {host}; reload the page if needed", 4500)

    def update_site_controls_chip(self, tab: BrowserTab | None = None) -> None:
        if not hasattr(self, "site_controls_chip"):
            return
        tab = tab or self.current_tab()
        host = tab.url().host().lower() if tab else ""
        overrides = self._temporary_site_overrides.get(host, {}) if host else {}
        labels = []
        if "javascript" in overrides:
            labels.append("JS on" if overrides["javascript"] else "JS off")
        if "images" in overrides:
            labels.append("Images on" if overrides["images"] else "Images off")
        self.site_controls_chip.setText("Site controls: " + (", ".join(labels) if labels else "defaults"))
        self.site_controls_chip.setToolTip(
            f"Temporary controls for {host}: {', '.join(labels)}. They last until Ghost Surfer closes."
            if labels else "No temporary overrides for this site. Site overrides last until Ghost Surfer closes."
        )

    def update_setting(self, key: str, value: bool) -> None:
        self.settings_data[key] = bool(value)
        self.store.save()
        self.apply_engine_settings()
        self.update_security_chips()

    def set_personal_vault_enabled(self, enabled: bool) -> None:
        self.settings_data["personal_vault_enabled"] = bool(enabled)
        self.store.save()
        if hasattr(self, "personal_vault_btn"):
            self.personal_vault_btn.setEnabled(bool(enabled))
        if hasattr(self, "personal_vault_open_btn"):
            self.personal_vault_open_btn.setEnabled(bool(enabled))

    def open_personal_vault(self) -> None:
        if not bool(self.settings_data.get("personal_vault_enabled", False)):
            return
        try:
            PersonalDataVaultDialog(self, app_data_dir() / "personal-vault.dpapi").exec()
        except (OSError, ValueError) as exc:
            QMessageBox.critical(self, "Personal Vault unavailable", str(exc))

    def handle_personal_data_request(self, page: BrowserPage, request: dict) -> None:
        bridge = getattr(page, "personal_data_consent_bridge", None)
        if bridge is None:
            return
        decision = {"allow": False, "fields": []}
        token = request.get("token", "")
        if not bool(self.settings_data.get("data_request_guard_enabled", True)):
            decision = {"allow": True, "fields": [field["id"] for field in request["fields"]]}
            bridge.submissionResolved.emit(token, json.dumps(decision))
            return
        if getattr(self, "_personal_data_prompt_open", False):
            bridge.submissionResolved.emit(token, json.dumps(decision))
            return
        if page.url().host().lower() != request.get("page_host"):
            bridge.submissionResolved.emit(token, json.dumps(decision))
            return
        self._personal_data_prompt_open = True
        trust_path = app_data_dir() / "site-recognition.json"
        trust = SiteRecognitionStore(trust_path)
        dialog = PersonalDataRequestDialog(
            request,
            app_data_dir() / "domain-registration-cache.json",
            trust.recognized(request["action_host"]),
            bool(self.settings_data.get("site_verification_enabled", True)),
            self,
        )
        try:
            if dialog.exec() == QDialog.DialogCode.Accepted and page.url().host().lower() == request.get("page_host"):
                decision = {"allow": True, "fields": dialog.allowed_field_ids}
                if dialog.remember_recognition:
                    try:
                        trust.remember(request["action_host"])
                    except OSError as exc:
                        self.status.showMessage(f"Recognition was not saved: {exc}", 6000)
                self.status.showMessage("Only the selected personal data fields were allowed for this submission.", 5000)
            else:
                self.status.showMessage("Submission stopped. No selected form fields were released by Ghost Surfer.", 5000)
        finally:
            self._personal_data_prompt_open = False
            try:
                bridge.submissionResolved.emit(token, json.dumps(decision))
            except RuntimeError:
                pass

    def forget_recognized_sites(self) -> None:
        path = app_data_dir() / "site-recognition.json"
        if not path.exists():
            self.status.showMessage("No recognized sites are saved.", 3000)
            return
        answer = QMessageBox.question(
            self, "Forget recognized sites?", "Remove all sites you previously marked as recognized?",
            QMessageBox.StandardButton.Cancel | QMessageBox.StandardButton.Yes,
            QMessageBox.StandardButton.Cancel,
        )
        if answer != QMessageBox.StandardButton.Yes:
            return
        try:
            path.unlink(missing_ok=True)
            self.status.showMessage("Saved site recognitions were cleared.", 3500)
        except OSError as exc:
            QMessageBox.warning(self, "Could not clear site recognitions", str(exc))

    def set_speed_mode(self, value: bool) -> None:
        self.speed_mode = bool(value)
        self.settings_data["speed_mode"] = self.speed_mode
        self.store.save()
        self.apply_engine_settings()
        self.update_security_chips()
        self.suspend_inactive_tabs()

    def toggle_speed_mode(self) -> None:
        self.speed_check.setChecked(not self.speed_check.isChecked())

    def apply_engine_settings(self) -> None:
        for i in range(self.tabs.count()):
            tab = self.tabs.widget(i)
            if isinstance(tab, BrowserTab):
                self.apply_tab_settings(tab)

    def apply_tab_settings(self, tab: BrowserTab) -> None:
        settings = tab.settings()
        apply_web_engine_security(settings, self.settings_data, self.speed_mode)
        host_overrides = self._temporary_site_overrides.get(tab.url().host().lower(), {})
        if "javascript" in host_overrides:
            settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, host_overrides["javascript"])
        if "images" in host_overrides:
            settings.setAttribute(QWebEngineSettings.WebAttribute.AutoLoadImages, host_overrides["images"])
        scroll_animator = getattr(QWebEngineSettings.WebAttribute, "ScrollAnimatorEnabled", None)
        if scroll_animator is not None:
            settings.setAttribute(scroll_animator, not bool(self.settings_data.get("reduce_motion", False)))
        if hasattr(self, "page_ux"):
            self.page_ux.apply_site_zoom(tab)
        else:
            tab.setZoomFactor(self.zoom_level / 100)
        if tab is self.current_tab():
            self.update_site_controls_chip(tab)

    def update_security_chips(self) -> None:
        frozen = sum(1 for i in range(self.tabs.count()) if bool(getattr(self.tabs.widget(i), "property", lambda _key: False)("ghost_frozen"))) if hasattr(self, "tabs") else 0
        self.speed_chip.setText(f"Speed: On · {frozen} paused" if self.speed_mode else "Speed: Off")
        self.blocked_chip.setText(f"Blocked: {self.blocked_count}")
        self.spy_chip.setText(f"Spy alerts: {len(self.store.data.get('spy_alerts', []))}")
        self.tracker_status.setText(f"Trackers blocked: {self.tracker_blocked_count}")
        self.spy_status.setText(f"Spy alerts: {len(self.store.data.get('spy_alerts', []))}")
        ip_alerts = sum(1 for row in self.store.data.get("spy_alerts", []) if row.get("category") == "ip_lookup")
        self.ip_tripwire_status.setText(
            f"IP tripwire: {ip_alerts} observed" if ip_alerts else "IP tripwire: watching (alerts only)"
        )
        self.tor_status.setText(f"Tor: {TOR_ENDPOINT[0]}:{TOR_ENDPOINT[1]}" if TOR_ENDPOINT else "Tor: standby")
        permissions = self.store.data.get("cookie_permissions", {})
        allowed = sum(1 for value in permissions.values() if value == "allow")
        denied = sum(1 for value in permissions.values() if value == "deny")
        policy = self.settings_data.get("cookie_policy", "ask")
        policy_label = {"ask": "ask per site", "allow": "allow first-party", "deny": "block all"}.get(policy, "ask per site")
        self.cookie_status.setText(f"Cookies: {policy_label} ({allowed} approved, {denied} declined)")

    @Slot(str, str, bool)
    def queue_blocked_request(self, host: str, detail: str, is_tracker: bool) -> None:
        """Coalesce interceptor callbacks onto the UI thread before updating widgets or disk."""
        self._pending_blocked_count += 1
        if is_tracker:
            self._pending_tracker_count += 1
            domain = registrable_domain(host) or host or "unknown site"
            self._pending_spy_hosts.setdefault(domain, "Tracker request blocked")
        if not self._privacy_flush_timer.isActive():
            self._privacy_flush_timer.start()

    def notify_spy_attempt(self, host: str, detail: str) -> None:
        """Queue a permission alert; this method also stays safe for non-UI callers."""
        domain = registrable_domain(host) or host or "unknown site"
        self._pending_spy_hosts.setdefault(domain, detail[:180])
        if not self._privacy_flush_timer.isActive():
            self._privacy_flush_timer.start()

    @Slot(str, str, str, str)
    def queue_ip_lookup_alert(self, page_host: str, endpoint_host: str, category: str, detail: str) -> None:
        """Record a recognized IP lookup request as an alert without blocking it."""
        site = registrable_domain(page_host) or page_host or "unknown site"
        endpoint = endpoint_host or "unknown endpoint"
        key = (site, endpoint)
        if key in self.recorded_ip_lookup_keys:
            return
        self.recorded_ip_lookup_keys.add(key)
        kind = "geolocation API" if category == "ip_geolocation_lookup" else "public-IP lookup"
        message = f"IP lookup tripwire observed a {kind} request to {endpoint}. Request was allowed."
        self._pending_ip_lookup_events.setdefault(key, message[:180])
        if not self._privacy_flush_timer.isActive():
            self._privacy_flush_timer.start()

    def flush_privacy_events(self) -> None:
        blocked = self._pending_blocked_count
        trackers = self._pending_tracker_count
        hosts = self._pending_spy_hosts
        ip_lookup_events = self._pending_ip_lookup_events
        self._pending_blocked_count = 0
        self._pending_tracker_count = 0
        self._pending_spy_hosts = {}
        self._pending_ip_lookup_events = {}
        self.blocked_count += blocked
        self.tracker_blocked_count += trackers

        alerts = self.store.data.setdefault("spy_alerts", [])
        added = False
        new_notices = []
        for domain, detail in hosts.items():
            category = "permission" if detail.startswith("Permission request blocked") else "tracker"
            existing = next((row for row in alerts if row.get("site") == domain and row.get("category", "tracker") == category), None)
            if existing is None:
                alerts.insert(0, {
                    "site": domain,
                    "detail": detail[:180],
                    "category": category,
                    "seen_at": datetime.now().astimezone().isoformat(timespec="seconds"),
                })
                added = True
        for (site, endpoint), detail in ip_lookup_events.items():
            existing = next((row for row in alerts if row.get("site") == site and row.get("category") == "ip_lookup"), None)
            timestamp = datetime.now().astimezone().isoformat(timespec="seconds")
            if existing is None:
                alerts.insert(0, {
                    "site": site,
                    "detail": detail,
                    "category": "ip_lookup",
                    "endpoint": endpoint,
                    "seen_at": timestamp,
                })
            else:
                existing.update({"detail": detail, "endpoint": endpoint, "seen_at": timestamp})
            added = True
            if site not in self.notified_ip_lookup_sites:
                self.notified_ip_lookup_sites.add(site)
                new_notices.append(
                    f"IP lookup tripwire: {site} requested a known IP lookup service ({endpoint}). "
                    "The request was allowed. Direct connections still reveal your public IP to the site."
                )
        if added:
            self.store.data["spy_alerts"] = alerts
            self.store.save()
            self.refresh_lists()
        if blocked:
            self.status.showMessage(f"Ghost Guard blocked {blocked} request{'s' if blocked != 1 else ''}", 3500)
        self.update_security_chips()
        if ip_lookup_events and not hosts:
            self.privacy_chip.setText("Ghost Guard: IP lookup noticed")
        if hosts:
            self.privacy_chip.setText("Ghost Guard: Spy blocked")
            for domain in hosts:
                if domain not in self.notified_spy_hosts:
                    self.notified_spy_hosts.add(domain)
                    new_notices.append(
                        f"Privacy alert: Ghost Guard blocked tracking or a permission request from {domain}. Access remains denied."
                    )
                    break
        if new_notices:
            if ip_lookup_events:
                self.status.showMessage("IP lookup tripwire noticed a request; it was allowed", 6500)
            self.show_privacy_notice("\n".join(new_notices))

    def update_session_ui(self) -> None:
        if hasattr(self, "tabs_chip"):
            self.tabs_chip.setText(f"Tabs: {self.tabs.count()}")

    def add_tab(self, url: str, switch: bool = True) -> BrowserTab:
        tab = BrowserTab(self)
        if hasattr(self, "page_ux"):
            self.page_ux.attach_tab(tab)
        index = self.tabs.addTab(tab, "New")
        self.tabs.setTabToolTip(index, url)
        if switch:
            self.tabs.setCurrentIndex(index)
        self.navigate(tab, url)
        self.apply_engine_settings()
        self.update_session_ui()
        return tab

    def current_tab(self) -> BrowserTab | None:
        widget = self.tabs.currentWidget()
        return widget if isinstance(widget, BrowserTab) else None

    def close_tab(self, index: int) -> None:
        if self.tabs.count() == 1:
            self.add_tab(HOME_URL, switch=True)
        widget = self.tabs.widget(index)
        if isinstance(widget, BrowserTab):
            url = self.display_url(widget.url())
            if url.startswith(("http://", "https://")):
                self.closed_tabs.append(url)
                self.closed_tabs = self.closed_tabs[-20:]
        self.tabs.removeTab(index)
        if widget:
            widget.deleteLater()
        self.update_session_ui()

    def sync_current_tab(self) -> None:
        tab = self.current_tab()
        if not tab:
            return
        self.address.setText(self.display_url(tab.url()))
        if hasattr(self, "page_ux"):
            percent = self.page_ux.apply_site_zoom(tab)
            if hasattr(self, "site_zoom_combo"):
                self.site_zoom_combo.blockSignals(True)
                self.site_zoom_combo.setCurrentText(f"{percent}%")
                self.site_zoom_combo.blockSignals(False)
        self.update_navigation_state(tab)
        self.update_session_ui()
        if self.speed_mode:
            self.suspend_inactive_tabs()

    def navigate_from_address(self) -> None:
        tab = self.current_tab()
        if not tab:
            return
        self.navigate(tab, self.address.text().strip())

    def focus_address(self) -> None:
        self.address.setFocus()
        self.address.selectAll()

    def stop_loading(self) -> None:
        if hasattr(self, "page_ux"):
            self.page_ux.set_distraction_free(False)
        tab = self.current_tab()
        if tab:
            tab.stop()
            self.progress_label.setText("Stopped")
            self.status.showMessage("Loading stopped", 1800)

    def navigate(self, tab: BrowserTab, text: str) -> None:
        if text == DASHBOARD_URL:
            tab.setHtml(self.home_html(), QUrl("https://ghostsurfer.local/"))
            return
        if text.startswith("ghostsurfer://"):
            tab.setHtml(self.home_html(), QUrl("https://ghostsurfer.local/"))
            return
        if not text:
            text = HOME_URL
        url = self.normalized_url(text)
        tab.setUrl(QUrl(url))

    def normalized_url(self, text: str) -> str:
        if text.startswith(("http://", "https://", "file://")):
            return text
        if "." in text and " " not in text:
            return "https://" + text
        return SEARCH_URL.format(query=quote_plus(text))

    def display_url(self, url: QUrl) -> str:
        text = url.toString()
        if text.startswith("https://ghostsurfer.local/"):
            return DASHBOARD_URL
        return text

    def go_back(self) -> None:
        tab = self.current_tab()
        if tab:
            tab.back()

    def go_forward(self) -> None:
        tab = self.current_tab()
        if tab:
            tab.forward()

    def reload_page(self) -> None:
        tab = self.current_tab()
        if tab:
            tab.reload()

    def go_home(self) -> None:
        tab = self.current_tab()
        if tab:
            self.navigate(tab, HOME_URL)

    def bookmark_current(self) -> None:
        tab = self.current_tab()
        if not tab:
            return
        self.store.add_bookmark(tab.title(), self.display_url(tab.url()))
        self.refresh_lists()
        self.status.showMessage("Bookmark saved", 2200)

    def clear_cookies_and_cache(self, confirm: bool = True) -> None:
        if confirm:
            answer = QMessageBox.question(
                self,
                "Clear cookies and cache?",
                "This removes website cookies and cached web files. You may be signed out of sites and pages may reload assets. History, bookmarks, and saved per-site cookie choices stay in place.",
                QMessageBox.StandardButton.Cancel | QMessageBox.StandardButton.Yes,
                QMessageBox.StandardButton.Cancel,
            )
            if answer != QMessageBox.StandardButton.Yes:
                return
        self.profile.cookieStore().deleteAllCookies()
        self.profile.clearHttpCache()
        self.update_security_chips()
        self.status.showMessage("Website cookies and cache cleared; history and bookmarks were kept", 5000)

    def clear_ghost_data(self, confirm: bool = True) -> None:
        if confirm:
            answer = QMessageBox.question(
                self,
                "Clear browsing data?",
                "This clears cookies, cache, history, saved cookie choices, and Ghost Guard alerts. Bookmarks stay saved.",
                QMessageBox.StandardButton.Cancel | QMessageBox.StandardButton.Yes,
                QMessageBox.StandardButton.Cancel,
            )
            if answer != QMessageBox.StandardButton.Yes:
                return
        self.profile.cookieStore().deleteAllCookies()
        self.profile.clearHttpCache()
        self.store.data["history"] = []
        self.store.data["cookie_permissions"] = {}
        self.store.data["spy_alerts"] = []
        self.pending_cookie_prompts.clear()
        self.cookie_prompt_queue.clear()
        self.active_cookie_prompt = None
        self.hide_privacy_notice()
        self.notified_spy_hosts.clear()
        self.notified_ip_lookup_sites.clear()
        self.recorded_ip_lookup_keys.clear()
        self.store.save()
        self.refresh_lists()
        self.update_security_chips()
        self.status.showMessage("Cookies, cache, history, cookie choices, and alerts cleared", 4200)

    def update_storage_summary(self) -> None:
        if hasattr(self, "storage_summary_label"):
            summary = self.store.storage_summary()
            if self.store.last_error:
                summary += f"\nStorage warning: {self.store.last_error}"
            self.storage_summary_label.setText(summary)

    def export_browser_data(self) -> None:
        documents = QStandardPaths.writableLocation(QStandardPaths.StandardLocation.DocumentsLocation)
        default_path = Path(documents or str(Path.home())) / "Ghost Surfer Browser Data.json"
        target, _filter = QFileDialog.getSaveFileName(self, "Export Ghost Surfer browser data", str(default_path), "JSON backup (*.json)")
        if not target:
            return
        if not target.lower().endswith(".json"):
            target += ".json"
        try:
            self.store.export_backup(Path(target))
        except (OSError, TypeError, ValueError) as exc:
            QMessageBox.warning(self, "Backup export failed", str(exc))
            return
        self.status.showMessage(f"Browser-data backup saved: {Path(target).name}", 4500)

    def restore_browser_data(self) -> None:
        target, _filter = QFileDialog.getOpenFileName(self, "Restore Ghost Surfer browser data", str(Path.home()), "JSON backup (*.json)")
        if not target:
            return
        answer = QMessageBox.question(
            self,
            "Restore browser data?",
            "This replaces bookmarks, history, cookie choices, and privacy alerts. A safety backup of the current data will be saved first. Website cookies and cache are not part of this restore.",
            QMessageBox.StandardButton.Cancel | QMessageBox.StandardButton.Yes,
            QMessageBox.StandardButton.Cancel,
        )
        if answer != QMessageBox.StandardButton.Yes:
            return
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        safety_copy = self.store.path.with_name(f"browser-data-before-restore-{stamp}.json")
        try:
            self.store.export_backup(safety_copy)
            self.store.restore_backup(Path(target))
        except (OSError, json.JSONDecodeError, TypeError, ValueError) as exc:
            QMessageBox.warning(self, "Backup restore failed", str(exc))
            return
        self.refresh_lists()
        self.update_security_chips()
        self.update_storage_summary()
        self.status.showMessage("Browser data restored; your previous data is in the safety backup", 5000)

    def show_recovery_center(self) -> None:
        dialog = QDialog(self)
        dialog.setWindowTitle("Browser data recovery")
        dialog.resize(720, 500)
        layout = QVBoxLayout(dialog)
        layout.addWidget(QLabel("Saved recovery copies are listed by date. Select one to preview it before restoring."))
        listing = QListWidget(dialog)
        preview = QLabel("Select a recovery copy.")
        preview.setWordWrap(True)
        layout.addWidget(listing, 1)
        layout.addWidget(preview)
        for path in sorted(app_data_dir().glob("browser-data-*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
                data = raw.get("data", {}) if raw.get("format") == BrowserStore.BACKUP_FORMAT else raw
                if not isinstance(data, dict) or not any(key in data for key in ("bookmarks", "history", "settings", "spy_alerts")):
                    raise ValueError("No browser data fields found")
                counts = f"{len(data.get('bookmarks', []))} bookmarks, {len(data.get('history', []))} history entries"
                item = QListWidgetItem(f"{path.name}  ·  {datetime.fromtimestamp(path.stat().st_mtime).strftime('%Y-%m-%d %H:%M')}  ·  {counts}")
                item.setData(Qt.ItemDataRole.UserRole, str(path))
                item.setData(Qt.ItemDataRole.UserRole + 1, True)
                listing.addItem(item)
            except (OSError, json.JSONDecodeError, AttributeError, TypeError, ValueError) as exc:
                item = QListWidgetItem(f"{path.name}  ·  Could not preview: {exc}")
                item.setData(Qt.ItemDataRole.UserRole, str(path))
                item.setData(Qt.ItemDataRole.UserRole + 1, False)
                listing.addItem(item)
        def show_preview(item=None):
            item = item or listing.currentItem()
            if item is None:
                return
            try:
                raw = json.loads(Path(item.data(Qt.ItemDataRole.UserRole)).read_text(encoding="utf-8"))
                data = raw.get("data", {}) if raw.get("format") == BrowserStore.BACKUP_FORMAT else raw
                preview.setText("\n".join((f"File: {Path(item.data(Qt.ItemDataRole.UserRole)).name}",
                    f"Bookmarks: {len(data.get('bookmarks', []))}", f"History entries: {len(data.get('history', []))}",
                    f"Cookie choices: {len(data.get('cookie_permissions', {}))}", f"Privacy alerts: {len(data.get('spy_alerts', []))}",
                    "This restore saves a safety copy of current data first.")))
            except (OSError, json.JSONDecodeError, TypeError, AttributeError):
                preview.setText("This file cannot be previewed and will not be restored.")
        listing.currentItemChanged.connect(show_preview)
        row = QHBoxLayout()
        restore = QPushButton("Restore selected copy", dialog)
        close = QPushButton("Close", dialog)
        row.addStretch(1); row.addWidget(restore); row.addWidget(close)
        layout.addLayout(row)
        def restore_copy():
            item = listing.currentItem()
            if not item or not item.data(Qt.ItemDataRole.UserRole + 1):
                return
            path = Path(item.data(Qt.ItemDataRole.UserRole))
            answer = QMessageBox.question(dialog, "Restore this recovery copy?",
                "Current browser data will be copied to a safety file before this restore.",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No, QMessageBox.StandardButton.No)
            if answer != QMessageBox.StandardButton.Yes:
                return
            safety = self.store.path.with_name(f"browser-data-before-recovery-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json")
            try:
                shutil.copy2(self.store.path, safety)
                raw = json.loads(path.read_text(encoding="utf-8"))
                if raw.get("format") == BrowserStore.BACKUP_FORMAT:
                    self.store.restore_backup(path)
                else:
                    incoming = raw
                    if not isinstance(incoming, dict):
                        raise ValueError("Recovery file is not an object")
                    updates = {}
                    for key in ("bookmarks", "history"):
                        rows = incoming.get(key, [])
                        if not isinstance(rows, list):
                            raise ValueError(f"Recovery file has invalid {key} data")
                        updates[key] = [row for row in rows if isinstance(row, dict) and str(row.get("url", "")).startswith(("http://", "https://"))]
                    for key in ("cookie_permissions", "settings", "ghost_surfer_tab_features", "download_history"):
                        if key in incoming:
                            value = incoming[key]
                            if key in {"settings", "cookie_permissions", "ghost_surfer_tab_features"} and not isinstance(value, dict):
                                raise ValueError(f"Recovery file has invalid {key} data")
                            if key == "download_history" and not isinstance(value, list):
                                raise ValueError("Recovery file has invalid download history")
                            if key == "cookie_permissions":
                                updates[key] = {str(domain): choice for domain, choice in value.items() if choice in {"allow", "deny"}}
                            elif key == "download_history":
                                updates[key] = [{"path": str(row.get("path", "")), "state": str(row.get("state", "Interrupted")),
                                    "url": str(row.get("url", "")), "started_at": str(row.get("started_at", "")),
                                    "finished_at": str(row.get("finished_at", ""))}
                                    for row in value if isinstance(row, dict) and row.get("path")]
                            else:
                                updates[key] = value
                    alerts = incoming.get("spy_alerts", [])
                    if not isinstance(alerts, list):
                        raise ValueError("Recovery file has invalid privacy alerts")
                    updates["spy_alerts"] = [row for row in alerts if isinstance(row, dict)]
                    previous = dict(self.store.data)
                    self.store.data.update(updates)
                    if not self.store.save():
                        self.store.data = previous
                        raise OSError(self.store.last_error)
                self.refresh_lists()
                self.update_security_chips()
                self.update_storage_summary()
                self.status.showMessage(f"Recovered browser data. Safety copy: {safety.name}", 6000)
                dialog.accept()
            except (OSError, json.JSONDecodeError, TypeError, ValueError) as exc:
                QMessageBox.warning(dialog, "Recovery failed", str(exc))
        restore.clicked.connect(restore_copy)
        close.clicked.connect(dialog.reject)
        if listing.count():
            listing.setCurrentRow(0)
        dialog.exec()

    def open_dashboard(self) -> None:
        tab = self.current_tab()
        if tab:
            self.navigate(tab, DASHBOARD_URL)

    def toggle_control_center(self) -> None:
        visible = not self.control_dock.isVisible()
        self.control_dock.setVisible(visible)
        if visible:
            self.control_search.clear()
            self.control_search.setFocus(Qt.FocusReason.ShortcutFocusReason)

    def open_control_page(self, title: str, focus_widget=None) -> None:
        self.control_search.clear()
        index = self.control_category.findText(title)
        if index >= 0:
            self.control_category.setCurrentIndex(index)
        self.control_dock.show()
        self.control_dock.raise_()
        target = focus_widget if focus_widget is not None else self.control_search
        target.setFocus(Qt.FocusReason.ShortcutFocusReason)

    def open_download_manager(self) -> None:
        self.open_control_page("Tabs & Data", self.download_list)
        self.status.showMessage("Downloads", 1800)

    def duplicate_current_tab(self) -> None:
        tab = self.current_tab()
        if tab:
            self.add_tab(self.display_url(tab.url()), switch=True)

    def close_other_tabs(self) -> None:
        current = self.tabs.currentIndex()
        for index in reversed(range(self.tabs.count())):
            if index != current:
                self.close_tab(index)

    def reopen_closed_tab(self) -> None:
        if self.closed_tabs:
            self.add_tab(self.closed_tabs.pop(), switch=True)
        else:
            self.status.showMessage("No closed tabs to reopen", 2500)

    def suspend_inactive_tabs(self) -> None:
        for i in range(self.tabs.count()):
            tab = self.tabs.widget(i)
            if isinstance(tab, BrowserTab):
                should_freeze = self.speed_mode and i != self.tabs.currentIndex() and not bool(tab.property("ghost_keep_active"))
                state = QWebEnginePage.LifecycleState.Frozen if should_freeze else QWebEnginePage.LifecycleState.Active
                try:
                    tab.page().setLifecycleState(state)
                    tab.setProperty("ghost_frozen", should_freeze)
                    if hasattr(self, "tab_features"):
                        self.tab_features.refresh_tab_presentation(tab)
                except RuntimeError:
                    pass
        self.update_security_chips()

    def toggle_tab_keep_active(self, tab=None) -> None:
        tab = tab or self.current_tab()
        if tab is None:
            return
        enabled = not bool(tab.property("ghost_keep_active"))
        tab.setProperty("ghost_keep_active", enabled)
        self.suspend_inactive_tabs()
        self.status.showMessage("This tab stays active in Speed Mode" if enabled else "This tab follows Speed Mode again", 3000)

    def refresh_lists(self) -> None:
        if not hasattr(self, "bookmark_list"):
            return
        self.bookmark_list.clear()
        for item in self.store.data.get("bookmarks", []):
            list_item = QListWidgetItem(item.get("title") or item.get("url", "Bookmark"))
            list_item.setData(Qt.ItemDataRole.UserRole, item.get("url", ""))
            self.bookmark_list.addItem(list_item)
        self.refresh_history_list()
        if hasattr(self, "cookie_list"):
            self.cookie_list.clear()
            for domain, decision in sorted(self.store.data.get("cookie_permissions", {}).items()):
                item = QListWidgetItem(f"{domain} — {decision.title()}")
                item.setData(Qt.ItemDataRole.UserRole, domain)
                self.cookie_list.addItem(item)
        self.download_list.clear()
        for entry in self.downloads:
            entry["item"] = None
        for entry in self.downloads[-30:]:
            item = QListWidgetItem()
            item.setData(Qt.ItemDataRole.UserRole, id(entry))
            entry["item"] = item
            self.download_list.addItem(item)
            self.update_download_item(entry, persist=False)
        self.persist_download_history()
        self.update_download_actions()
        if hasattr(self, "spy_list"):
            self.spy_list.clear()
            category_filter = self.spy_filter_combo.currentData() if hasattr(self, "spy_filter_combo") else "all"
            for item in self.store.data.get("spy_alerts", []):
                if category_filter != "all" and item.get("category", "tracker") != category_filter:
                    continue
                site = item.get("site", "unknown site")
                detail = item.get("detail", "Blocked tracking or permission attempt")
                listing_item = QListWidgetItem(f"{site}: {detail}")
                listing_item.setData(Qt.ItemDataRole.UserRole, item)
                listing_item.setToolTip(f"{item.get('category', 'tracker')} · {item.get('seen_at', '')}")
                self.spy_list.addItem(listing_item)
        self.update_storage_summary()

    def refresh_history_list(self) -> None:
        if hasattr(self, "library_features"):
            self.library_features.refresh_history()
            return
        listing = getattr(self, "history_list", None)
        if listing is None:
            return
        listing.clear()
        for entry in self.store.data.get("history", []):
            item = QListWidgetItem(entry.get("title") or entry.get("url", "History"))
            item.setData(Qt.ItemDataRole.UserRole, entry.get("url", ""))
            listing.addItem(item)

    def dismiss_selected_alerts(self) -> None:
        selected = [item.data(Qt.ItemDataRole.UserRole) for item in self.spy_list.selectedItems()]
        if not selected:
            self.status.showMessage("Select the privacy alerts to dismiss", 2500)
            return
        kept = list(self.store.data.get("spy_alerts", []))
        for entry in selected:
            try:
                kept.remove(entry)
            except ValueError:
                pass
        self.store.data["spy_alerts"] = kept
        self.store.save()
        self.refresh_lists()
        self.update_security_chips()
        self.status.showMessage(f"Dismissed {len(selected)} privacy alert{'s' if len(selected) != 1 else ''}", 2500)

    def queue_store_save(self, delay_ms: int = 450) -> None:
        self._store_save_pending = True
        self._store_save_timer.start(max(0, int(delay_ms)))

    def flush_store_save(self) -> None:
        if not self._store_save_pending:
            return
        if self.store.save():
            self._store_save_pending = False
        self.update_storage_summary()

    def forget_selected_cookie_decision(self) -> None:
        item = self.cookie_list.currentItem() if hasattr(self, "cookie_list") else None
        if not item:
            self.status.showMessage("Select a cookie decision to forget", 2600)
            return
        domain = item.data(Qt.ItemDataRole.UserRole)
        self.store.data.setdefault("cookie_permissions", {}).pop(domain, None)
        self.store.save()
        self.refresh_lists()
        self.update_security_chips()
        self.status.showMessage(f"Cookie decision forgotten for {domain}", 3500)

    def forget_all_cookie_decisions(self) -> None:
        self.store.data["cookie_permissions"] = {}
        self.store.save()
        self.refresh_lists()
        self.update_security_chips()
        self.status.showMessage("All saved cookie decisions forgotten", 3500)

    def open_tor_check(self) -> None:
        tab = self.current_tab()
        if not tab:
            tab = self.add_tab(HOME_URL, switch=True)
        self.navigate(tab, TOR_CHECK_URL)
        if TOR_ENDPOINT:
            self.tor_chip.setText(f"Tor: {TOR_ENDPOINT[1]}")
            self.status.showMessage(f"Tor route active through {TOR_ENDPOINT[0]}:{TOR_ENDPOINT[1]}", 5000)
        else:
            self.tor_chip.setText("Tor: Standby")
            self.status.showMessage("Tor route inactive: start Tor Browser or a Tor service, then reopen Ghost Surfer", 6500)

    def search_selected_text(self, text: str) -> None:
        query = " ".join(str(text or "").split())[:500]
        if query:
            self.add_tab(self.normalized_url(query), True)

    def translate_current_page(self, tab=None) -> None:
        tab = tab or self.current_tab()
        if tab is None or tab.url().scheme().lower() not in {"http", "https"}:
            self.status.showMessage("Translate is available on regular web pages", 3000)
            return
        languages = {"English": "en", "Spanish": "es", "French": "fr", "German": "de", "Italian": "it",
                     "Portuguese": "pt", "Japanese": "ja", "Korean": "ko", "Chinese (Simplified)": "zh-CN",
                     "Arabic": "ar", "Russian": "ru"}
        language, accepted = QInputDialog.getItem(self, "Translate page", "Translate into:", list(languages), 0, False)
        if not accepted or language not in languages:
            return
        source_url = tab.url().toString()
        disclosure = ("Google Translate will receive this page URL and the target language. The page will open in a new tab. "
                      "Do not continue with private or sensitive URLs.\n\nPage: " + source_url)
        if QMessageBox.question(self, "Send page to Google Translate?", disclosure,
                                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                                QMessageBox.StandardButton.No) != QMessageBox.StandardButton.Yes:
            return
        target = "https://translate.google.com/translate?sl=auto&tl=" + languages[language] + "&u=" + quote_plus(source_url)
        self.add_tab(target, True)

    def toggle_picture_in_picture(self, tab=None) -> None:
        tab = tab or self.current_tab()
        if tab is None:
            return
        script = """(async()=>{try{if(document.pictureInPictureElement){await document.exitPictureInPicture();return 'closed'}const v=[...document.querySelectorAll('video')].find(x=>x.readyState>=1);if(!v)return 'no-video';await v.requestPictureInPicture();return 'opened'}catch(e){return 'unavailable'}})()"""
        def finished(result):
            messages = {"opened": "Picture in picture opened", "closed": "Picture in picture closed",
                        "no-video": "No video is available on this page", "unavailable": "This page does not allow picture in picture"}
            self.status.showMessage(messages.get(result, "Picture in picture could not start"), 3500)
        tab.page().runJavaScript(script, finished)

    def open_library_menu(self) -> None:
        menu = QMenu(self)
        bookmarks = self.store.data.get("bookmarks", [])
        history = self.store.data.get("history", [])
        if bookmarks:
            bookmark_menu = menu.addMenu("Bookmarks")
            for item in bookmarks[:20]:
                action = QAction(item.get("title", item.get("url", "Bookmark")), self)
                action.triggered.connect(lambda _checked=False, u=item.get("url", ""): self.navigate(self.current_tab(), u))
                bookmark_menu.addAction(action)
        else:
            menu.addAction("No bookmarks yet").setEnabled(False)
        if history:
            history_menu = menu.addMenu("Recent")
            for item in history[:20]:
                action = QAction(item.get("title", item.get("url", "History")), self)
                action.triggered.connect(lambda _checked=False, u=item.get("url", ""): self.navigate(self.current_tab(), u))
                history_menu.addAction(action)
        else:
            menu.addAction("No history yet").setEnabled(False)
        menu.addSeparator()
        menu.addAction("Manage bookmarks", self.library_features.show_bookmark_manager)
        menu.addAction("Open downloads", self.open_download_manager)
        menu.addAction("Start page", self.open_dashboard)
        menu.addAction("Tor connection check", self.open_tor_check)
        menu.addAction("Ghost Control", self.toggle_control_center)
        menu.addSeparator()
        menu.addAction("Clear browsing data…", self.clear_ghost_data)
        menu.exec(self.library_btn.mapToGlobal(self.library_btn.rect().bottomLeft()))

    def handle_download(self, download: QWebEngineDownloadRequest) -> None:
        default_path = Path(QStandardPaths.writableLocation(QStandardPaths.StandardLocation.DownloadLocation))
        suggested = default_path / download.suggestedFileName()
        target, _ = QFileDialog.getSaveFileName(self, "Save download", str(suggested))
        if not target:
            download.cancel()
            return
        download.setDownloadDirectory(str(Path(target).parent))
        download.setDownloadFileName(Path(target).name)
        entry = {"request": download, "path": target, "state": "Queued", "item": None,
                 "url": download.url().toString(), "started_at": datetime.now().astimezone().isoformat(timespec="seconds"),
                 "finished_at": ""}
        self.downloads.append(entry)
        self.persist_download_history()
        self.refresh_lists()
        download.stateChanged.connect(lambda *_args, record=entry: self.update_download_item(record))
        download.receivedBytesChanged.connect(lambda *_args, record=entry: self.update_download_item(record))
        download.totalBytesChanged.connect(lambda *_args, record=entry: self.update_download_item(record))
        download.isFinishedChanged.connect(lambda *_args, record=entry: self.update_download_item(record))
        download.accept()
        self.update_download_item(entry)
        self.status.showMessage(f"Downloading {Path(target).name}", 4000)

    @staticmethod
    def format_download_size(byte_count: int) -> str:
        value = max(0, int(byte_count))
        for unit in ("B", "KB", "MB", "GB"):
            if value < 1024 or unit == "GB":
                return f"{value:.0f} B" if unit == "B" else f"{value:.1f} {unit}"
            value /= 1024
        return f"{value:.1f} GB"

    def update_download_item(self, entry: dict, persist: bool = True) -> None:
        item = entry.get("item")
        if item is None:
            if persist:
                self._download_save_timer.start()
            return
        request = entry.get("request")
        previous_state = entry.get("state", "Queued")
        state_text = previous_state
        progress_text = ""
        if request is not None:
            try:
                state = request.state()
                received = max(0, int(request.receivedBytes()))
                total = max(0, int(request.totalBytes()))
                if state == QWebEngineDownloadRequest.DownloadState.DownloadInProgress:
                    state_text = "Downloading"
                    progress_text = f" · {received / total:.0%}" if total else f" · {self.format_download_size(received)}"
                elif state == QWebEngineDownloadRequest.DownloadState.DownloadCompleted:
                    state_text = "Complete"
                    entry["finished_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
                    progress_text = f" · {self.format_download_size(received)}"
                    entry["request"] = None
                elif state == QWebEngineDownloadRequest.DownloadState.DownloadCancelled:
                    state_text = "Canceled"
                    entry["finished_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
                    entry["request"] = None
                elif state == QWebEngineDownloadRequest.DownloadState.DownloadInterrupted:
                    state_text = "Interrupted"
                    entry["finished_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
                    entry["request"] = None
                elif state == QWebEngineDownloadRequest.DownloadState.DownloadRequested:
                    state_text = "Queued"
            except RuntimeError:
                entry["request"] = None
        entry["state"] = state_text
        if state_text == "Complete" and previous_state != "Complete" and hasattr(self, "page_ux"):
            self.page_ux.download_completed(entry)
        missing = state_text == "Complete" and not Path(entry["path"]).is_file()
        item.setText(f"{Path(entry['path']).name}  —  {'File missing' if missing else state_text}{progress_text}")
        item.setToolTip("\n".join(part for part in (entry["path"], entry.get("url", ""), entry.get("started_at", "")) if part))
        if persist:
            self._download_save_timer.start()
        self.update_download_actions()

    def persist_download_history(self) -> None:
        if hasattr(self, "_download_save_timer"):
            self._download_save_timer.stop()
        rows = []
        for entry in self.downloads:
            path = str(entry.get("path", ""))
            if not path:
                continue
            state = str(entry.get("state", "Interrupted"))
            if state in {"Queued", "Downloading"} and entry.get("request") is None:
                state = "Interrupted"
            rows.append({"path": path, "state": state, "url": str(entry.get("url", "")),
                         "started_at": str(entry.get("started_at", "")), "finished_at": str(entry.get("finished_at", ""))})
        self.store.data["download_history"] = rows[-500:]
        self.store.save()

    def selected_download(self) -> dict | None:
        item = self.download_list.currentItem()
        entry_id = item.data(Qt.ItemDataRole.UserRole) if item else None
        return next((entry for entry in self.downloads if id(entry) == entry_id), None)

    def update_download_actions(self) -> None:
        if not hasattr(self, "open_download_btn"):
            return
        entry = self.selected_download()
        exists = bool(entry and Path(entry["path"]).is_file())
        active = bool(entry and entry.get("request") is not None and entry.get("state") in {"Queued", "Downloading"})
        self.open_download_btn.setEnabled(bool(exists and not active))
        self.show_download_btn.setEnabled(bool(entry and Path(entry["path"]).parent.exists()))
        self.cancel_download_btn.setEnabled(active)
        self.delete_download_btn.setEnabled(bool(entry and not active))
        self.clear_downloads_btn.setEnabled(any(item.get("state") not in {"Queued", "Downloading"} for item in self.downloads))

    def delete_selected_download(self) -> None:
        entry = self.selected_download()
        if not entry or (entry.get("request") is not None and entry.get("state") in {"Queued", "Downloading"}):
            return
        path = Path(entry["path"])
        file_existed = path.is_file()
        if file_existed:
            answer = QMessageBox.question(
                self, "Delete downloaded file?",
                f"Permanently delete this downloaded file and remove its record?\n\n{path}",
                QMessageBox.StandardButton.Cancel | QMessageBox.StandardButton.Yes,
                QMessageBox.StandardButton.Cancel,
            )
            if answer != QMessageBox.StandardButton.Yes:
                return
            try:
                path.unlink()
            except OSError as exc:
                QMessageBox.warning(self, "Could not delete download", f"The file was kept. Windows reported: {exc}")
                return
        else:
            answer = QMessageBox.question(
                self, "Remove missing download record?",
                f"The file is missing. Remove only its record?\n\n{path}",
                QMessageBox.StandardButton.Cancel | QMessageBox.StandardButton.Yes,
                QMessageBox.StandardButton.Cancel,
            )
            if answer != QMessageBox.StandardButton.Yes:
                return
        self.downloads.remove(entry)
        self.persist_download_history()
        self.refresh_lists()
        self.status.showMessage("Download file and record removed" if file_existed else "Download record removed", 3500)

    def reset_browser_profile(self) -> None:
        dialog = QDialog(self)
        dialog.setWindowTitle("Reset browser profile")
        dialog.setMinimumWidth(460)
        layout = QVBoxLayout(dialog)
        explanation = QLabel(
            "Ghost Surfer will first make a dated backup of browser-data.json. Reset removes settings, history, site cookie decisions, privacy alerts, download records, and saved tab sessions. Website cookies and cache will also be cleared. Installed extension files and the separate extension-profile data are retained; extension mode and enabled-extension choices are preserved."
        )
        explanation.setWordWrap(True)
        layout.addWidget(explanation)
        preserve = QCheckBox("Keep bookmarks")
        preserve.setChecked(True)
        layout.addWidget(preserve)
        actions = QHBoxLayout()
        reset = QPushButton("Back up and reset")
        cancel = QPushButton("Cancel")
        actions.addStretch(1)
        actions.addWidget(cancel)
        actions.addWidget(reset)
        layout.addLayout(actions)
        cancel.clicked.connect(dialog.reject)
        reset.clicked.connect(dialog.accept)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup = self.store.path.with_name(f"browser-data-before-reset-{stamp}.json")
        try:
            if self.store.path.exists():
                shutil.copy2(self.store.path, backup)
        except OSError as exc:
            QMessageBox.warning(self, "Profile reset stopped", f"Could not create the safety backup. No profile data was changed.\n\n{exc}")
            return
        bookmarks = list(self.store.data.get("bookmarks", [])) if preserve.isChecked() else []
        self._download_save_timer.stop()
        for entry in self.downloads:
            request = entry.get("request")
            if request is not None and entry.get("state") in {"Queued", "Downloading"}:
                request.cancel()
        self.downloads = []
        self.store.data["bookmarks"] = bookmarks
        self.store.data["history"] = []
        self.store.data["cookie_permissions"] = {}
        self.store.data["spy_alerts"] = []
        self.store.data["download_history"] = []
        tab_state = self.store.data.setdefault("ghost_surfer_tab_features", {})
        tab_state.clear()
        tab_state.update({
            "previous_session": [], "previous_session_active_index": 0,
            "recently_closed": [], "named_sessions": {},
        })
        extension_enabled_states = self.settings_data.get("enabled_extensions", {})
        if not isinstance(extension_enabled_states, dict):
            extension_enabled_states = {}
        chatgpt_bridge_enabled = bool(self.settings_data.get("chatgpt_bridge_enabled", False))
        self.store.data["settings"] = {
            "speed_mode": True, "block_images": False, "ghost_cleanup_on_close": False,
            "allow_javascript": True, "allow_webgl": False, "cookie_policy": "ask",
            "theme": "Ghost Blue", "zoom": 100, "home_page_url": "https://duckduckgo.com/",
            "home_page_default_migrated": True, "reduce_motion": False,
            "history_retention_days": 0, "interface_text_size": 100,
            "startup_page": "restore_session", "search_engine": "DuckDuckGo",
            "personal_vault_enabled": personal_vault_install_default(),
            "data_request_guard_enabled": True, "site_verification_enabled": True,
            "extensions_profile_enabled": self.extensions_profile_enabled,
            "enabled_extensions": dict(extension_enabled_states),
            "chatgpt_bridge_enabled": chatgpt_bridge_enabled,
        }
        self.settings_data = self.store.data["settings"]
        self.speed_mode = True
        self.zoom_level = 100
        self._temporary_site_overrides.clear()
        self.closed_tabs.clear()
        while self.tabs.count():
            old_tab = self.tabs.widget(self.tabs.count() - 1)
            self.tabs.removeTab(self.tabs.count() - 1)
            if old_tab is not None:
                old_tab.deleteLater()
        self.add_tab(HOME_URL, switch=True)
        self.profile.cookieStore().deleteAllCookies()
        self.profile.clearHttpCache()
        self.store.save()
        self.theme_combo.setCurrentText("Ghost Blue")
        self.zoom_combo.setCurrentText("100%")
        self.interface_size_combo.setCurrentText("100%")
        for widget, value in ((self.high_contrast_check, False), (self.reduce_motion_check, False),
                              (self.speed_check, True), (self.image_check, False),
                              (self.cleanup_check, False), (self.js_check, True), (self.webgl_check, False)):
            widget.blockSignals(True)
            widget.setChecked(value)
            widget.blockSignals(False)
        self.cookie_policy_combo.setCurrentIndex(self.cookie_policy_combo.findData("ask"))
        self.personal_vault_check.blockSignals(True)
        self.personal_vault_check.setChecked(bool(self.settings_data["personal_vault_enabled"]))
        self.personal_vault_check.blockSignals(False)
        self.set_personal_vault_enabled(bool(self.settings_data["personal_vault_enabled"]))
        for control, value in ((self.data_request_guard_check, True), (self.site_verification_check, True)):
            control.blockSignals(True)
            control.setChecked(value)
            control.blockSignals(False)
        self.apply_style()
        self.page_ux.set_high_contrast(False)
        self.site_zoom_combo.setCurrentText("100%")
        self.apply_engine_settings()
        self.refresh_lists()
        self.update_storage_summary()
        self.update_security_chips()
        self.status.showMessage(f"Profile reset complete. Safety copy: {backup}", 8000)

    def _updater_install_directory(self) -> Path | None:
        running_exe = Path(sys.executable)
        if getattr(sys, "frozen", False) and (running_exe.parent / "Ghost Surfer.exe").is_file():
            return running_exe.parent
        local = os.environ.get("LOCALAPPDATA")
        target = Path(local) / "Programs" / "Ghost Surfer" if local else None
        return target if target and (target / "Ghost Surfer.exe").is_file() else None

    def check_for_updates(self) -> None:
        if self._update_worker and self._update_worker.isRunning():
            return
        self._update_candidate = None
        self._staged_update = None
        self.check_updates_btn.setEnabled(False)
        self.check_updates_btn.setText("Checking GitHub…")
        self.update_status_label.setText("Checking compatible Ghost Surfer packages on GitHub. Other products in the shared release list are ignored.")
        updater = GitHubReleasesUpdater("ghostventure", "GhostVenture-Projects", APP_VERSION,
                                        self._updater_install_directory())
        self._start_update_worker(updater, "check")

    def _start_update_worker(self, updater, operation: str, candidate=None) -> None:
        self._update_worker = UpdateWorker(updater, operation, candidate, self)
        self._update_worker.completed.connect(self._update_worker_completed)
        self._update_worker.progress.connect(self._update_progress)
        self._update_worker.start()

    def _update_progress(self, done, total) -> None:
        dialog = self._update_progress_dialog
        if dialog is None:
            dialog = QProgressDialog("Downloading and verifying the GitHub package…", "", 0, 100, self)
            dialog.setCancelButton(None)
            dialog.setWindowTitle("Ghost Surfer Update")
            dialog.setMinimumDuration(250)
            self._update_progress_dialog = dialog
        if total:
            dialog.setMaximum(100)
            dialog.setValue(min(100, int(done * 100 / total)))
        else:
            dialog.setMaximum(0)
            dialog.setValue(0)
        dialog.show()

    def _update_worker_completed(self, result, error: str) -> None:
        worker = self.sender()
        operation = getattr(worker, "operation", "")
        self.check_updates_btn.setEnabled(True)
        if self._update_progress_dialog:
            self._update_progress_dialog.close()
            self._update_progress_dialog = None
        if error:
            self.update_status_label.setText(f"Update check failed: {error}")
            if operation == "download":
                self.check_updates_btn.setText("Retry download")
            else:
                self.check_updates_btn.setText("Check for updates")
                try:
                    self.check_updates_btn.clicked.disconnect()
                except (RuntimeError, TypeError):
                    pass
                self.check_updates_btn.clicked.connect(self.check_for_updates)
        elif operation == "check" and result is None:
            self.update_status_label.setText("No newer compatible Ghost Surfer release package was found on GitHub.")
            self.check_updates_btn.setText("Check again")
        elif operation == "check":
            self._update_candidate = result
            self.update_status_label.setText(f"Version {result.version} is available: {result.release_name or result.tag}")
            self.check_updates_btn.setText("Download and verify update")
            try:
                self.check_updates_btn.clicked.disconnect()
            except (RuntimeError, TypeError):
                pass
            self.check_updates_btn.clicked.connect(self.download_update)
            if result.release_notes:
                QMessageBox.information(self, f"Ghost Surfer {result.version} release notes", result.release_notes[:12000])
        elif operation == "download":
            self._staged_update = result
            if not self._updater_install_directory():
                self.update_status_label.setText("The package is verified and staged. Install Ghost Surfer first with GS Install Manager, then check again to apply updates.")
                self.check_updates_btn.setText("Check for updates")
                try:
                    self.check_updates_btn.clicked.disconnect()
                except (RuntimeError, TypeError):
                    pass
                self.check_updates_btn.clicked.connect(self.check_for_updates)
                return
            answer = QMessageBox.question(
                self, "Install Ghost Surfer update?",
                f"Ghost Surfer {result.version} is downloaded and verified. Applying it closes Ghost Surfer, updates its files, and restarts it. Your browser data is stored separately. Continue?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            if answer == QMessageBox.StandardButton.Yes:
                try:
                    updater = GitHubReleasesUpdater("ghostventure", "GhostVenture-Projects", APP_VERSION,
                                                    self._updater_install_directory())
                    updater.launch_apply(result, current_pid=os.getpid(), install_directory=self._updater_install_directory())
                    self.close()
                except Exception as exc:
                    QMessageBox.warning(self, "Could not start update", str(exc))
            self.check_updates_btn.setText("Check for updates")
            try:
                self.check_updates_btn.clicked.disconnect()
            except (RuntimeError, TypeError):
                pass
            self.check_updates_btn.clicked.connect(self.check_for_updates)

    def download_update(self) -> None:
        if not self._update_candidate or (self._update_worker and self._update_worker.isRunning()):
            return
        self.check_updates_btn.setEnabled(False)
        self.check_updates_btn.setText("Downloading…")
        self.update_status_label.setText("Downloading and checking GitHub-provided package integrity data.")
        updater = GitHubReleasesUpdater("ghostventure", "GhostVenture-Projects", APP_VERSION,
                                        self._updater_install_directory())
        self._start_update_worker(updater, "download", self._update_candidate)

    def open_selected_download(self) -> None:
        entry = self.selected_download()
        if not entry:
            return
        path = Path(entry["path"])
        if not path.is_file():
            self.status.showMessage("That download is not complete or the file has moved", 3500)
            return
        if not QDesktopServices.openUrl(QUrl.fromLocalFile(str(path))):
            self.status.showMessage("Windows could not open this downloaded file", 3500)

    def show_selected_download(self) -> None:
        entry = self.selected_download()
        if not entry:
            return
        folder = Path(entry["path"]).parent
        if not folder.is_dir() or not QDesktopServices.openUrl(QUrl.fromLocalFile(str(folder))):
            self.status.showMessage("Could not open the download folder", 3500)

    def cancel_selected_download(self) -> None:
        entry = self.selected_download()
        request = entry.get("request") if entry else None
        if request is None:
            return
        request.cancel()
        self.status.showMessage(f"Canceled {Path(entry['path']).name}", 3000)

    def clear_finished_downloads(self) -> None:
        self.downloads = [entry for entry in self.downloads if entry.get("state") in {"Queued", "Downloading"}]
        self.persist_download_history()
        self.refresh_lists()
        self.status.showMessage("Finished downloads cleared from this list", 3000)

    def on_load_started(self) -> None:
        if self.sender() is not self.current_tab():
            return
        self.progress_label.setText("Loading")

    def on_load_progress(self, progress: int) -> None:
        if self.sender() is not self.current_tab():
            return
        self.progress_label.setText(f"{progress}%")
        self.privacy_chip.setText("Ghost Guard: Working")

    def on_load_finished(self, ok: bool) -> None:
        tab = self.sender()
        if not isinstance(tab, BrowserTab):
            return
        if tab is self.current_tab():
            self.update_navigation_state(tab)
        if self.store.add_history(tab.title(), self.display_url(tab.url()), persist=False):
            self.queue_store_save()
            self.refresh_history_list()
        if tab is self.current_tab():
            self.progress_label.setText("Ready" if ok else "Load failed")
            self.privacy_chip.setText("Ghost Guard: On" if ok else "Ghost Guard: Check page")
            self.progress_timer.start(2500)

    def on_url_changed(self, url: QUrl) -> None:
        tab = self.sender()
        index = self.tabs.indexOf(tab)
        if index >= 0:
            self.tabs.setTabToolTip(index, self.display_url(url))
            if isinstance(tab, BrowserTab):
                self.apply_tab_settings(tab)
        if tab == self.current_tab():
            self.address.setText(self.display_url(url))
            self.update_navigation_state(tab)
            self.update_page_security_state(url)
            self.update_site_controls_chip(tab if isinstance(tab, BrowserTab) else None)
        tab = self.current_tab()
        if tab and hasattr(self, "page_ux"):
            percent = self.page_ux.apply_site_zoom(tab)
            if hasattr(self, "site_zoom_combo"):
                self.site_zoom_combo.blockSignals(True)
                self.site_zoom_combo.setCurrentText(f"{percent}%")
                self.site_zoom_combo.blockSignals(False)

    def on_title_changed(self, title: str) -> None:
        tab = self.sender()
        index = self.tabs.indexOf(tab)
        if index >= 0:
            self.tabs.setTabText(index, (title or "New")[:28])
        if tab == self.current_tab():
            self.setWindowTitle(f"{title or APP_NAME} - {APP_NAME}")

    def update_navigation_state(self, tab: BrowserTab) -> None:
        self.back_btn.setEnabled(tab.history().canGoBack())
        self.forward_btn.setEnabled(tab.history().canGoForward())

    def update_page_security_state(self, url: QUrl) -> None:
        scheme = url.scheme().lower()
        if scheme == "https":
            self.privacy_chip.setText("Ghost Guard: Secure page")
        elif scheme == "http":
            self.privacy_chip.setText("Ghost Guard: Upgrading page")
        elif scheme in {"ghostsurfer", "about"}:
            self.privacy_chip.setText("Ghost Guard: Local page")

    def closeEvent(self, event) -> None:
        for worker in self.findChildren(SiteVerificationWorker):
            if worker.isRunning():
                worker.wait(9000)
        self._store_save_timer.stop()
        self.flush_store_save()
        self._download_save_timer.stop()
        self.persist_download_history()
        if hasattr(self, "tab_features"):
            self.tab_features.save_previous_session()
        if bool(self.settings_data.get("ghost_cleanup_on_close", False)):
            self.clear_ghost_data(confirm=False)
        super().closeEvent(event)
        if event.isAccepted():
            if hasattr(self, "chatgpt_bridge_settings"):
                self.chatgpt_bridge_settings.close()
            self.store.data["clean_shutdown"] = True
            self.store.save()

    def home_html(self) -> str:
        theme = THEMES.get(self.settings_data.get("theme", "Ghost Blue"), THEMES["Ghost Blue"])
        accent = theme["accent"]
        accent_soft = theme["accent_soft"]
        cards = ""
        for item in self.store.data.get("bookmarks", [])[:6]:
            title = item.get("title") or item.get("url", "Bookmark")
            url = item.get("url", "")
            safe_title = html.escape(str(title))
            safe_url = html.escape(str(url), quote=True)
            cards += f'<a class="card" href="{safe_url}"><strong>{safe_title}</strong><span>{html.escape(str(url))}</span></a>'
        if not cards:
            tor_status = (
                f"Tor route active through {TOR_ENDPOINT[0]}:{TOR_ENDPOINT[1]}"
                if TOR_ENDPOINT
                else "Tor route inactive. Start Tor Browser or a Tor service, then reopen Ghost Surfer."
            )
            cards = """
            <div class="card"><b>01</b><strong>Location shield</strong><span>Geolocation, camera, microphone, notifications, and local-font access are denied by default.</span></div>
            <div class="card"><b>02</b><strong>Cookie clearance</strong><span>Every top-level site must ask before cookies are stored. Declined sites stay blocked.</span></div>
            <div class="card"><b>03</b><strong>Spy intercepts</strong><span>Known trackers and blocked permission attempts trigger immediate Ghost Guard alerts.</span></div>
            """ + f"""
            <a class="card active" href="{TOR_CHECK_URL}"><b>04</b><strong>Stealth route</strong><span>{tor_status}</span></a>
            """
        return f"""
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Ghost Surfer</title>
          <style>
            body {{
              margin: 0;
              min-height: 100vh;
              font-family: Inter, Segoe UI, Arial, sans-serif;
              color: #f7fbff;
              background:
                radial-gradient(circle at top right, {accent}55, transparent 32%),
                radial-gradient(circle at 18% 78%, {accent_soft}22, transparent 28%),
                linear-gradient(135deg, rgba(3,7,14,.98), rgba(10,18,28,.94)),
                repeating-linear-gradient(90deg, rgba(125,156,188,.13) 0, rgba(125,156,188,.13) 1px, transparent 1px, transparent 74px),
                repeating-linear-gradient(0deg, rgba(125,156,188,.08) 0, rgba(125,156,188,.08) 1px, transparent 1px, transparent 74px),
                #090d13;
            }}
            main {{
              max-width: 1080px;
              margin: 0 auto;
              padding: 62px 38px;
            }}
            .mast {{
              position: relative;
              overflow: hidden;
              border: 1px solid {accent}88;
              border-left: 5px solid {accent};
              border-radius: 18px;
              background: linear-gradient(135deg, rgba(13, 20, 30, .84), rgba(5, 9, 16, .92));
              padding: 32px;
              margin-bottom: 24px;
              box-shadow: 0 24px 80px rgba(0, 0, 0, .42), 0 0 46px {accent}24;
            }}
            .mast:after {{
              content: "";
              position: absolute;
              inset: 0;
              pointer-events: none;
              background: linear-gradient(120deg, transparent, {accent_soft}1f, transparent);
              transform: translateX(-48%);
            }}
            .kicker {{
              color: {accent_soft};
              font-size: 13px;
              font-weight: 800;
              letter-spacing: .08em;
              text-transform: uppercase;
            }}
            h1 {{
              font-size: 56px;
              line-height: 1;
              margin: 12px 0;
              font-weight: 900;
              text-shadow: 0 0 28px {accent}55;
            }}
            p {{
              font-size: 18px;
              line-height: 1.55;
              max-width: 820px;
              color: #dce8f5;
            }}
            .grid {{
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
              gap: 16px;
            }}
            .card {{
              display: block;
              text-decoration: none;
              color: inherit;
              background: linear-gradient(180deg, rgba(18,29,43,.9), rgba(7,13,22,.96));
              border: 1px solid rgba(125, 156, 188, .36);
              border-top-color: {accent}66;
              border-radius: 14px;
              padding: 20px;
              min-height: 120px;
              box-shadow: 0 18px 46px rgba(0, 0, 0, .32), inset 0 1px 0 rgba(255,255,255,.04);
            }}
            .card.active {{
              border-color: {accent};
              box-shadow: 0 20px 52px {accent}30;
            }}
            .card b {{
              color: {accent_soft};
              font-size: 12px;
              letter-spacing: .08em;
            }}
            .card strong {{
              display: block;
              font-size: 19px;
              margin: 10px 0 9px;
            }}
            .card span {{
              display: block;
              color: #c8d5e3;
              line-height: 1.45;
              overflow-wrap: anywhere;
            }}
          </style>
        </head>
        <body>
          <main>
            <section class="mast">
              <div class="kicker">Privacy-first browsing for Windows</div>
              <h1>Ghost Surfer</h1>
              <p>A compact browser that blocks location prompts, rejects common trackers, asks before storing site cookies, auto-upgrades HTTP to HTTPS, and uses a local Tor route when one is available.</p>
            </section>
            <section class="grid">{cards}</section>
          </main>
        </body>
        </html>
        """

    def apply_style(self) -> None:
        QApplication.instance().setFont(QFont("Segoe UI", 10))
        theme = THEMES.get(self.settings_data.get("theme", "Ghost Blue"), THEMES["Ghost Blue"])
        stylesheet = (
            """
            QMainWindow {
                background: #02060b;
                color: #f8fbff;
            }
            #rail {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #02050a, stop:.55 #07101c, stop:1 #03060b);
                border-right: 1px solid #26384e;
                min-width: 76px;
                max-width: 92px;
            }
            #railMark {
                color: #ffffff;
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #0b1725, stop:1 #03070d);
                border: 1px solid #43b9f4;
                border-radius: 10px;
                min-height: 58px;
                font-weight: 900;
                font-size: 16px;
                margin-bottom: 2px;
            }
            #railCaption {
                color: #8fd6ff;
                font-size: 10px;
                font-weight: 900;
                letter-spacing: 2px;
                padding-bottom: 4px;
            }
            QToolButton {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #111d2d, stop:1 #07101a);
                color: #ffffff;
                border: 1px solid #2f4964;
                border-radius: 6px;
                min-width: 48px;
                min-height: 44px;
                padding: 4px;
            }
            QToolButton:hover {
                background: #155d86;
                border-color: #8fd6ff;
                color: #ffffff;
            }
            QToolButton:disabled {
                background: #0a1019;
                border-color: #182230;
            }
            #addressDock {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #111b2a, stop:.5 #07111d, stop:1 #03070d);
                color: #ffffff;
                border: 1px solid #34506c;
                border-left: 8px solid #38a9e6;
                border-radius: 4px;
            }
            #brandIcon {
                background: #02060b;
                border: 1px solid #38a9e6;
                border-radius: 7px;
                padding: 3px;
            }
            #brandLockup {
                color: #ffffff;
                font-size: 19px;
                font-weight: 900;
            }
            #brandSubtitle {
                color: #8fd6ff;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1.6px;
                text-transform: uppercase;
            }
            #urlLabel {
                color: #8fd6ff;
                font-weight: 800;
                min-width: 58px;
                letter-spacing: 1.4px;
            }
            #privacyChip, #torChip, #speedChip, #blockedChip, #spyChip, #tabsChip, #homeChip, #siteControlsChip {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #122034, stop:1 #07111d);
                color: #dff4ff;
                border: 1px solid #33506b;
                border-radius: 4px;
                padding: 5px 10px;
                font-weight: 700;
            }
            #blockedChip {
                border-color: #38a9e6;
                color: #ffffff;
            }
            #spyChip {
                border-color: #38a9e6;
                color: #ffffff;
            }
            #statusDeck {
                background: #050b13;
                border: 1px solid #2b4057;
                border-radius: 4px;
            }
            #sessionNote {
                color: #b8cfe5;
                font-size: 10px;
                font-weight: 700;
                letter-spacing: .6px;
            }
            QLineEdit {
                background: #02060b;
                color: #ffffff;
                border: 1px solid #3b5874;
                border-radius: 4px;
                padding: 8px 12px;
                font-size: 14px;
                selection-background-color: #1f7fb4;
                selection-color: #ffffff;
            }
            QLineEdit:focus {
                border: 1px solid #8fd6ff;
                background: #080f18;
            }
            QLabel {
                color: #ffffff;
            }
            QPushButton#openButton {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #1f7fb4, stop:1 #38a9e6);
                color: #ffffff;
                border: 0;
                border-radius: 4px;
                padding: 8px 16px;
                font-weight: 900;
            }
            QPushButton#openButton:hover {
                background: #38a9e6;
            }
            QPushButton#modeButton, QPushButton#panelButton {
                background: #0d1725;
                color: #ffffff;
                border: 1px solid #33506b;
                border-radius: 4px;
                padding: 8px 12px;
                font-weight: 800;
            }
            QPushButton#modeButton:hover, QPushButton#panelButton:hover {
                background: #1f7fb4;
                border-color: #8fd6ff;
            }
            QTabWidget::pane {
                border: 1px solid #314a64;
                background: #03070d;
                border-radius: 4px;
            }
            QTabBar::tab {
                background: #0d1725;
                color: #dce7f2;
                border: 1px solid #2a3b50;
                border-bottom: 0;
                padding: 10px 18px;
                min-width: 138px;
                max-width: 260px;
                border-top-left-radius: 2px;
                border-top-right-radius: 12px;
            }
            QTabBar::tab:selected {
                background: #02060b;
                color: #ffffff;
                border-top: 3px solid #38a9e6;
            }
            QTabBar::tab:hover {
                background: #17253a;
            }
            QStatusBar {
                background: #03060b;
                color: #ffffff;
                border-top: 1px solid #182536;
            }
            #privacyNotice {
                background: #091826;
                border: 1px solid #38a9e6;
                border-radius: 4px;
                margin: 3px 8px;
            }
            #privacyNotice QLabel {
                color: #e6f6ff;
                font-weight: 700;
                padding: 2px 0;
            }
            QPushButton#noticeAllowButton, QPushButton#noticeDenyButton, QPushButton#noticeDismissButton {
                border-radius: 3px;
                padding: 6px 10px;
                font-weight: 800;
            }
            QPushButton#noticeAllowButton {
                background: #1f7fb4;
                color: #ffffff;
                border: 1px solid #8fd6ff;
            }
            QPushButton#noticeDenyButton, QPushButton#noticeDismissButton {
                background: #142334;
                color: #dff4ff;
                border: 1px solid #54728f;
            }
            QPushButton#noticeAllowButton:hover { background: #38a9e6; }
            QPushButton#noticeDenyButton:hover, QPushButton#noticeDismissButton:hover { background: #243c55; }
            #progressLabel {
                color: #dff4ff;
                padding-right: 10px;
                font-weight: 700;
            }
            QMenu {
                background: #0d1420;
                color: #ffffff;
                border: 1px solid #2f4056;
            }
            QMenu::item {
                padding: 9px 26px;
            }
            QMenu::item:selected {
                background: #1f7fb4;
            }
            QDockWidget#controlDock {
                background: #03070d;
                color: #ffffff;
                border-left: 1px solid #26384e;
                titlebar-close-icon: none;
                titlebar-normal-icon: none;
            }
            QDockWidget#controlDock::title {
                background: #0a1320;
                color: #ffffff;
                padding: 10px;
                font-weight: 900;
                letter-spacing: 1px;
            }
            QGroupBox {
                color: #ffffff;
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #101b2a, stop:1 #06101a);
                border: 1px solid #34506c;
                border-radius: 4px;
                margin-top: 16px;
                padding: 12px;
                font-weight: 900;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 6px;
                color: #8fd6ff;
            }
            QCheckBox {
                color: #dce8f5;
                spacing: 8px;
                padding: 3px;
            }
            QCheckBox::indicator {
                width: 16px;
                height: 16px;
                border-radius: 3px;
                border: 1px solid #33506b;
                background: #050910;
            }
            QCheckBox::indicator:checked {
                background: #38a9e6;
                border: 1px solid #8fd6ff;
            }
            QComboBox {
                background: #02060b;
                color: #ffffff;
                border: 1px solid #38a9e6;
                border-radius: 4px;
                padding: 8px 11px;
                font-weight: 800;
            }
            QComboBox:hover, QComboBox:focus {
                border-color: #8fd6ff;
            }
            QComboBox QAbstractItemView {
                background: #07111d;
                color: #ffffff;
                border: 1px solid #38a9e6;
                selection-background-color: #1f7fb4;
            }
            QListWidget {
                background: #03070d;
                color: #ffffff;
                border: 1px solid #314a64;
                border-radius: 4px;
                padding: 4px;
            }
            QListWidget::item {
                padding: 6px;
            }
            QListWidget::item:selected {
                background: #1f7fb4;
            }
            """
        )
        stylesheet += """
            QPushButton:focus, QToolButton:focus, QComboBox:focus, QLineEdit:focus, QListWidget:focus, QTabBar::tab:focus {
                border: 2px solid #ffd166;
            }
            QPushButton, QToolButton, QComboBox, QLineEdit {
                border-radius: 10px;
            }
            QGroupBox, QTabWidget::pane, QListWidget, #statusDeck, #addressDock, #privacyNotice {
                border-radius: 10px;
            }
            QPushButton, QComboBox {
                min-height: 40px;
            }
            QLineEdit {
                min-height: 40px;
            }
            QToolButton {
                min-height: 48px;
                padding: 3px 2px;
                font-size: 9px;
            }
            #controlSectionLabel {
                color: #8fd6ff;
                font-size: 9px;
                font-weight: 900;
                letter-spacing: 1.2px;
                min-width: 56px;
            }
            #controlPages {
                background: #03070d;
                border: 1px solid #26384e;
                border-radius: 10px;
            }
            QPushButton:focus, QToolButton:focus, QLineEdit:focus, QComboBox:focus {
                border: 1px solid #8fd6ff;
            }
            QPushButton:disabled {
                color: #748399;
                background: #101824;
                border-color: #263447;
            }
            QGroupBox {
                border-radius: 12px;
            }
            QCheckBox::indicator {
                border-radius: 4px;
            }
            #controlScroll {
                background: #03070d;
                border: 0;
            }
            QTabWidget#controlPages::pane {
                border: 0;
                border-top: 1px solid #26384e;
                background: #03070d;
            }
            QTabWidget#controlPages QTabBar::tab {
                min-width: 0;
                max-width: 110px;
                padding: 8px 7px;
                font-size: 10px;
            }
            #controlSearchFeedback {
                color: #8fd6ff;
                font-size: 10px;
                padding: 2px 4px;
            }
            QMenu {
                border-radius: 10px;
                padding: 4px;
            }
            QScrollBar:vertical {
                background: #07111d;
                width: 12px;
                margin: 2px;
                border-radius: 6px;
            }
            QScrollBar::handle:vertical {
                background: #34506b;
                min-height: 30px;
                border-radius: 5px;
            }
            QScrollBar::handle:vertical:hover { background: #38a9e6; }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0; }
        """
        stylesheet = stylesheet.replace("border-radius: 4px;", "border-radius: 10px;")
        stylesheet = stylesheet.replace("border-radius: 3px;", "border-radius: 8px;")
        stylesheet = stylesheet.replace("border-radius: 6px;", "border-radius: 10px;")
        stylesheet = stylesheet.replace("border-radius: 7px;", "border-radius: 10px;")
        stylesheet = stylesheet.replace("border-top-left-radius: 2px;", "border-top-left-radius: 9px;")
        stylesheet = stylesheet.replace("#38a9e6", theme["accent"])
        stylesheet = stylesheet.replace("#8fd6ff", theme["accent_soft"])
        stylesheet = stylesheet.replace("#1f7fb4", theme["hover"])
        stylesheet = stylesheet.replace("#43b9f4", theme["accent"])
        stylesheet = stylesheet.replace("#155d86", theme["hover"])
        stylesheet += "QCheckBox::indicator { border-radius: 4px; }"
        self.setStyleSheet(stylesheet)


def main() -> int:
    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    app.setOrganizationName("GhostSurferLocal")
    app.setWindowIcon(QIcon(ghost_icon_pixmap(128)))
    splash = make_splash()
    splash.show()
    app.processEvents()
    window = BrowserWindow()
    window.show()
    splash.finish(window)
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
