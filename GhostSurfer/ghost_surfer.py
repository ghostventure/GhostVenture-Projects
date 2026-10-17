import html
import json
import os
import socket
import sys
import hashlib
import hmac
from pathlib import Path
from urllib.parse import quote_plus

TOR_SOCKS_CANDIDATES = (("127.0.0.1", 9050), ("127.0.0.1", 9150))


def detect_tor_endpoint() -> tuple[str, int] | None:
    for host, port in TOR_SOCKS_CANDIDATES:
        try:
            with socket.create_connection((host, port), timeout=0.35):
                return host, port
        except OSError:
            continue
    return None


TOR_ENDPOINT = detect_tor_endpoint()
CHROMIUM_FLAGS = (
    "--disable-features=Translate "
    "--disable-background-networking "
    "--disable-sync "
    "--disable-default-apps "
    "--disable-component-update "
    "--disable-domain-reliability "
    "--disable-client-side-phishing-detection "
    "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"
)
if TOR_ENDPOINT:
    host, port = TOR_ENDPOINT
    CHROMIUM_FLAGS += (
        f" --proxy-server=socks5://{host}:{port}"
        " --host-resolver-rules=\"MAP * ~NOTFOUND , EXCLUDE 127.0.0.1\""
    )

os.environ.setdefault("QTWEBENGINE_CHROMIUM_FLAGS", CHROMIUM_FLAGS)

from PySide6.QtCore import QSize, QStandardPaths, Qt, QTimer, QUrl
from PySide6.QtGui import QAction, QColor, QDesktopServices, QFont, QIcon, QKeySequence, QPainter, QPainterPath, QPen, QPixmap, QShortcut
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QDockWidget,
    QFileDialog,
    QFrame,
    QGridLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMenu,
    QMessageBox,
    QPushButton,
    QSplashScreen,
    QScrollArea,
    QSplitter,
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
    QWebEngineUrlRequestInterceptor,
)
from PySide6.QtWebEngineWidgets import QWebEngineView


APP_NAME = "Ghost Surfer"
HOME_URL = "https://www.startpage.com/"
DASHBOARD_URL = "ghostsurfer://dashboard"
SEARCH_URL = "https://www.startpage.com/sp/search?query={query}"
TOR_CHECK_URL = "https://check.torproject.org/"
STORE_SEAL_KEY = b"GhostSurfer.BlackLionStudios.local-state.v2"

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

COMMON_SECOND_LEVEL_SUFFIXES = {
    "co.uk",
    "org.uk",
    "ac.uk",
    "com.au",
    "net.au",
    "org.au",
    "co.nz",
    "com.br",
    "com.mx",
    "co.jp",
}

TRACKER_HOST_PARTS = (
    "2mdn.net",
    "adform.net",
    "adsafeprotected.com",
    "adsrvr.org",
    "amazon-adsystem.com",
    "appsflyer.com",
    "bluekai.com",
    "chartbeat.com",
    "criteo.com",
    "doubleclick.net",
    "everesttech.net",
    "googleadservices.com",
    "googlesyndication.com",
    "google-analytics.com",
    "googletagmanager.com",
    "facebook.net",
    "connect.facebook.net",
    "analytics.twitter.com",
    "ads-twitter.com",
    "scorecardresearch.com",
    "quantserve.com",
    "hotjar.com",
    "segment.io",
    "mixpanel.com",
    "adnxs.com",
    "taboola.com",
    "outbrain.com",
)


def registrable_domain(host: str) -> str:
    host = (host or "").lower().strip(".")
    if not host:
        return ""
    parts = host.split(".")
    if len(parts) <= 2:
        return host
    suffix = ".".join(parts[-2:])
    if suffix in COMMON_SECOND_LEVEL_SUFFIXES and len(parts) >= 3:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def same_site(host: str, top_domain: str) -> bool:
    host = (host or "").lower()
    top_domain = (top_domain or "").lower()
    return bool(host and top_domain and (host == top_domain or host.endswith("." + top_domain)))


class PrivacyInterceptor(QWebEngineUrlRequestInterceptor):
    def __init__(self, window: "BrowserWindow") -> None:
        super().__init__(window)
        self.window = window

    def interceptRequest(self, info) -> None:
        url = info.requestUrl()
        scheme = url.scheme().lower()
        host = url.host().lower()

        if scheme == "http":
            upgraded = QUrl(url)
            upgraded.setScheme("https")
            info.redirect(upgraded)
            return

        if any(part in host for part in TRACKER_HOST_PARTS):
            self.window.blocked_count += 1
            self.window.notify_spy_attempt(host, url.toString())
            self.window.update_security_chips()
            info.block(True)
            return

        if self.window.speed_mode and info.resourceType().name in {"ResourceTypeMedia", "ResourceTypePing"}:
            self.window.blocked_count += 1
            self.window.update_security_chips()
            info.block(True)
            return

        info.setHttpHeader(b"DNT", b"1")
        info.setHttpHeader(b"Sec-GPC", b"1")
        info.setHttpHeader(b"Upgrade-Insecure-Requests", b"1")


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
    painter.drawText(224, 190, "Loading Ghost Guard, Speed Mode, Tor check, and Startpage...")
    painter.setPen(QPen(QColor("#38a9e6"), 5, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
    painter.drawLine(224, 230, 540, 230)
    painter.end()
    splash = QSplashScreen(pixmap)
    splash.setWindowFlag(Qt.WindowType.WindowStaysOnTopHint)
    return splash


class BrowserStore:
    def __init__(self) -> None:
        self.path = app_data_dir() / "browser-data.json"
        self.tamper_detected = False
        self.tamper_message = ""
        self.data = {
            "bookmarks": [],
            "history": [],
            "cookie_permissions": {},
            "spy_alerts": [],
            "settings": {
                "speed_mode": True,
                "block_images": False,
                "ghost_cleanup_on_close": False,
                "allow_javascript": True,
                "allow_webgl": False,
                "cookie_policy": "ask",
                "theme": "Ghost Blue",
                "zoom": 100,
            },
        }
        self.load()
        self.save()

    def load(self) -> None:
        if not self.path.exists():
            return
        try:
            loaded = json.loads(self.path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                if loaded.get("_seal") and not self.verify_seal(loaded):
                    self.tamper_detected = True
                    self.tamper_message = "Ghost Surfer detected that local browser settings were changed outside the app. Review privacy settings before browsing."
                    backup = self.path.with_suffix(".tamper-backup.json")
                    try:
                        backup.write_text(json.dumps(loaded, indent=2), encoding="utf-8")
                    except OSError:
                        pass
                    loaded.pop("_seal", None)
                self.data.update(loaded)
                self.data.setdefault("settings", {})
                self.data.setdefault("cookie_permissions", {})
                self.data.setdefault("spy_alerts", [])
                for key, value in {
                    "speed_mode": True,
                    "block_images": False,
                    "ghost_cleanup_on_close": False,
                    "allow_javascript": True,
                    "allow_webgl": False,
                    "cookie_policy": "ask",
                    "theme": "Ghost Blue",
                    "zoom": 100,
                }.items():
                    self.data["settings"].setdefault(key, value)
        except (OSError, json.JSONDecodeError):
            pass

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

    def save(self) -> None:
        self.data["_seal"] = self.seal_for()
        self.path.write_text(json.dumps(self.data, indent=2), encoding="utf-8")

    def add_history(self, title: str, url: str) -> None:
        if not url.startswith(("http://", "https://")):
            return
        entry = {"title": title or url, "url": url}
        history = [item for item in self.data["history"] if item.get("url") != url]
        history.insert(0, entry)
        self.data["history"] = history[:100]
        self.save()

    def add_bookmark(self, title: str, url: str) -> None:
        if not url.startswith(("http://", "https://")):
            return
        if any(item.get("url") == url for item in self.data["bookmarks"]):
            return
        self.data["bookmarks"].insert(0, {"title": title or url, "url": url})
        self.data["bookmarks"] = self.data["bookmarks"][:100]
        self.save()


class BrowserPage(QWebEnginePage):
    def __init__(self, window: "BrowserWindow", profile: QWebEngineProfile) -> None:
        super().__init__(profile, window)
        self.window = window
        self.featurePermissionRequested.connect(self.handle_permission_request)

    def createWindow(self, _type: QWebEnginePage.WebWindowType) -> "BrowserPage":
        tab = self.window.add_tab("about:blank", switch=True)
        return tab.page()

    def handle_permission_request(self, origin: QUrl, feature: QWebEnginePage.Feature) -> None:
        denied_features = {
            QWebEnginePage.Feature.Geolocation,
            QWebEnginePage.Feature.MediaAudioCapture,
            QWebEnginePage.Feature.MediaVideoCapture,
            QWebEnginePage.Feature.MediaAudioVideoCapture,
            QWebEnginePage.Feature.DesktopVideoCapture,
            QWebEnginePage.Feature.DesktopAudioVideoCapture,
            QWebEnginePage.Feature.Notifications,
            QWebEnginePage.Feature.LocalFontsAccess,
            QWebEnginePage.Feature.ClipboardReadWrite,
        }
        if feature in denied_features:
            self.setFeaturePermission(origin, feature, QWebEnginePage.PermissionPolicy.PermissionDeniedByUser)
            self.window.notify_spy_attempt(origin.host().lower(), f"Permission request blocked: {feature.name}")
            return
        self.setFeaturePermission(origin, feature, QWebEnginePage.PermissionPolicy.PermissionDeniedByUser)


class BrowserTab(QWebEngineView):
    def __init__(self, window: "BrowserWindow") -> None:
        super().__init__(window)
        self.window = window
        self.setPage(BrowserPage(window, window.profile))
        self.settings().setAttribute(QWebEngineSettings.WebAttribute.FullScreenSupportEnabled, True)
        self.loadStarted.connect(window.on_load_started)
        self.loadProgress.connect(window.on_load_progress)
        self.loadFinished.connect(window.on_load_finished)
        self.urlChanged.connect(window.on_url_changed)
        self.titleChanged.connect(window.on_title_changed)

    def contextMenuEvent(self, event) -> None:
        menu = QMenu(self)
        menu.addAction("Back", self.back).setEnabled(self.history().canGoBack())
        menu.addAction("Forward", self.forward).setEnabled(self.history().canGoForward())
        menu.addAction("Reload", self.reload)
        menu.addSeparator()
        menu.addAction("Open developer tools externally", lambda: QDesktopServices.openUrl(self.url()))
        menu.exec(event.globalPos())


class BrowserWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.store = BrowserStore()
        self.blocked_count = 0
        self.downloads = []
        self.closed_tabs = []
        self.settings_data = self.store.data["settings"]
        self.speed_mode = bool(self.settings_data.get("speed_mode", True))
        self.zoom_level = int(self.settings_data.get("zoom", 100))
        self.pending_cookie_prompts = set()
        self.cookie_prompt_queue = []
        self.active_cookie_prompt = None
        self.notified_spy_hosts = set()
        self.profile = QWebEngineProfile.defaultProfile()
        self.profile.setPersistentStoragePath(str(app_data_dir() / "web-profile"))
        self.profile.setCachePath(str(app_data_dir() / "web-cache"))
        self.profile.setPersistentCookiesPolicy(QWebEngineProfile.PersistentCookiesPolicy.AllowPersistentCookies)
        self.profile.cookieStore().setCookieFilter(self.cookie_filter)
        self.privacy_interceptor = PrivacyInterceptor(self)
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
        self.tabs.setDocumentMode(True)
        self.tabs.setMovable(True)
        self.tabs.setTabsClosable(True)
        self.tabs.currentChanged.connect(self.sync_current_tab)
        self.tabs.tabCloseRequested.connect(self.close_tab)

        self.address = QLineEdit()
        self.address.setPlaceholderText("Type a site, search, or paste a URL")
        self.address.setClearButtonEnabled(True)
        self.address.returnPressed.connect(self.navigate_from_address)

        self.progress_label = QLabel("Ready")
        self.progress_label.setObjectName("progressLabel")
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
        self.home_chip = QLabel("Home: Startpage")
        self.home_chip.setObjectName("homeChip")

        self.status = QStatusBar()
        self.build_privacy_notice()
        self.status.addWidget(self.privacy_notice, 1)
        self.status.addPermanentWidget(self.progress_label)
        self.setStatusBar(self.status)

        self.build_shell()
        self.build_control_center()
        self.add_tab(HOME_URL, switch=True)
        self.apply_engine_settings()
        self.apply_style()
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
        self.home_btn = self.rail_button("Home", self.style().standardIcon(self.style().StandardPixmap.SP_DesktopIcon), self.go_home)
        self.new_btn = self.rail_button("New tab", self.style().standardIcon(self.style().StandardPixmap.SP_FileDialogNewFolder), lambda: self.add_tab(HOME_URL, True))
        self.bookmark_btn = self.rail_button("Bookmark", self.style().standardIcon(self.style().StandardPixmap.SP_DialogSaveButton), self.bookmark_current)
        self.library_btn = self.rail_button("Library", self.style().standardIcon(self.style().StandardPixmap.SP_DirOpenIcon), self.open_library_menu)
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
            self.library_btn,
            self.clear_btn,
            self.tor_btn,
            self.dashboard_btn,
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
            ("Ctrl+L", self.focus_address),
            ("Ctrl+T", lambda: self.add_tab(HOME_URL, switch=True)),
            ("Ctrl+W", lambda: self.close_tab(self.tabs.currentIndex())),
            ("Ctrl+Shift+T", self.reopen_closed_tab),
            ("Ctrl+R", self.reload_page),
            ("Ctrl+D", self.bookmark_current),
            ("Ctrl+J", self.open_download_manager),
            ("Escape", self.stop_loading),
        )
        for sequence, callback in shortcuts:
            shortcut = QShortcut(QKeySequence(sequence), self)
            shortcut.activated.connect(callback)

    def rail_button(self, tip: str, icon: QIcon, callback) -> QToolButton:
        button = QToolButton()
        button.setIcon(icon)
        labels = {
            "Back": "Back", "Forward": "Next", "Reload": "Reload", "Home": "Home",
            "New tab": "New tab", "Bookmark": "Save", "Library": "Library",
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
        scroll = QScrollArea()
        scroll.setObjectName("controlScroll")
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(14, 14, 14, 14)
        layout.setSpacing(10)

        status_group = QGroupBox("Privacy Status")
        status_layout = QGridLayout(status_group)
        self.location_status = QLabel("Location: blocked")
        self.cookie_status = QLabel("Cookies: ask per site")
        self.tracker_status = QLabel("Trackers blocked: 0")
        self.spy_status = QLabel("Spy alerts: 0")
        self.tor_status = QLabel(f"Tor: {TOR_ENDPOINT[0]}:{TOR_ENDPOINT[1]}" if TOR_ENDPOINT else "Tor: standby")
        status_layout.addWidget(self.location_status, 0, 0)
        status_layout.addWidget(self.cookie_status, 1, 0)
        status_layout.addWidget(self.tracker_status, 2, 0)
        status_layout.addWidget(self.spy_status, 3, 0)
        status_layout.addWidget(self.tor_status, 4, 0)
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
        layout.addWidget(cookie_policy_group)

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
        layout.addWidget(perf_group)

        tabs_group = QGroupBox("Tab Actions")
        tabs_layout = QVBoxLayout(tabs_group)
        duplicate_btn = QPushButton("Duplicate tab")
        duplicate_btn.clicked.connect(self.duplicate_current_tab)
        close_others_btn = QPushButton("Close other tabs")
        close_others_btn.clicked.connect(self.close_other_tabs)
        reopen_btn = QPushButton("Reopen closed tab")
        reopen_btn.clicked.connect(self.reopen_closed_tab)
        suspend_btn = QPushButton("Suspend inactive tabs")
        suspend_btn.clicked.connect(self.suspend_inactive_tabs)
        for widget in (duplicate_btn, close_others_btn, reopen_btn, suspend_btn):
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
        self.cookie_list = QListWidget()
        self.bookmark_list.itemDoubleClicked.connect(lambda item: self.navigate(self.current_tab(), item.data(Qt.ItemDataRole.UserRole)))
        self.history_list.itemDoubleClicked.connect(lambda item: self.navigate(self.current_tab(), item.data(Qt.ItemDataRole.UserRole)))
        layout.addWidget(self.panel_list("Recent Spy Alerts", self.spy_list))
        layout.addWidget(self.panel_list("Cookie Decisions", self.cookie_list))
        forget_cookie_btn = QPushButton("Forget selected cookie decision")
        forget_cookie_btn.setObjectName("panelButton")
        forget_cookie_btn.clicked.connect(self.forget_selected_cookie_decision)
        forget_all_cookies_btn = QPushButton("Forget all cookie decisions")
        forget_all_cookies_btn.setObjectName("panelButton")
        forget_all_cookies_btn.clicked.connect(self.forget_all_cookie_decisions)
        layout.addWidget(forget_cookie_btn)
        layout.addWidget(forget_all_cookies_btn)
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
        for position, button in enumerate((self.open_download_btn, self.show_download_btn, self.cancel_download_btn, self.clear_downloads_btn)):
            download_actions.addWidget(button, position // 2, position % 2)
        downloads_group.layout().addLayout(download_actions)
        layout.addWidget(downloads_group)
        layout.addWidget(self.panel_list("Bookmarks", self.bookmark_list))
        layout.addWidget(self.panel_list("History", self.history_list))

        clear_btn = QPushButton("Clear cookies, cache, history")
        clear_btn.setObjectName("panelButton")
        clear_btn.clicked.connect(self.clear_ghost_data)
        layout.addWidget(clear_btn)
        layout.addStretch(1)
        scroll.setWidget(panel)
        self.control_dock.setWidget(scroll)
        self.addDockWidget(Qt.DockWidgetArea.RightDockWidgetArea, self.control_dock)
        self.control_dock.hide()
        self.refresh_lists()

    def panel_list(self, title: str, list_widget: QListWidget) -> QGroupBox:
        group = QGroupBox(title)
        layout = QVBoxLayout(group)
        layout.setContentsMargins(10, 12, 10, 10)
        layout.setSpacing(8)
        list_widget.setMaximumHeight(124)
        layout.addWidget(list_widget)
        return group

    def cookie_filter(self, request) -> bool:
        origin_host = request.origin.host().lower()
        first_party_host = request.firstPartyUrl.host().lower()
        top_domain = registrable_domain(first_party_host or origin_host)

        if request.thirdParty:
            self.status.showMessage(f"Blocked outside tracking cookie from {registrable_domain(origin_host) or origin_host}", 4500)
            return False

        policy = self.settings_data.get("cookie_policy", "ask")
        if policy == "allow":
            return True
        if policy == "deny":
            return False

        if not top_domain or not same_site(origin_host, top_domain):
            return False

        decision = self.store.data.setdefault("cookie_permissions", {}).get(top_domain)
        if decision == "allow":
            return True
        if decision == "deny":
            return False

        if top_domain not in self.pending_cookie_prompts:
            self.pending_cookie_prompts.add(top_domain)
            QTimer.singleShot(0, lambda domain=top_domain: self.prompt_cookie_decision(domain))
        return False

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
        self.status.showMessage(f"Page zoom set to {zoom}%", 2200)

    def update_setting(self, key: str, value: bool) -> None:
        self.settings_data[key] = bool(value)
        self.store.save()
        self.apply_engine_settings()
        self.update_security_chips()

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
        settings.setAttribute(QWebEngineSettings.WebAttribute.PlaybackRequiresUserGesture, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.DnsPrefetchEnabled, False)
        settings.setAttribute(QWebEngineSettings.WebAttribute.HyperlinkAuditingEnabled, False)
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanOpenWindows, False)
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanAccessClipboard, False)
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanPaste, False)
        settings.setAttribute(QWebEngineSettings.WebAttribute.AllowGeolocationOnInsecureOrigins, False)
        settings.setAttribute(QWebEngineSettings.WebAttribute.AllowRunningInsecureContent, False)
        settings.setAttribute(QWebEngineSettings.WebAttribute.ScreenCaptureEnabled, False)
        settings.setAttribute(QWebEngineSettings.WebAttribute.WebRTCPublicInterfacesOnly, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.BackForwardCacheEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.AutoLoadImages, not bool(self.settings_data.get("block_images", False)))
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, bool(self.settings_data.get("allow_javascript", True)))
        settings.setAttribute(QWebEngineSettings.WebAttribute.WebGLEnabled, bool(self.settings_data.get("allow_webgl", False)))
        settings.setAttribute(QWebEngineSettings.WebAttribute.ReadingFromCanvasEnabled, not self.speed_mode)
        settings.setAttribute(QWebEngineSettings.WebAttribute.ScrollAnimatorEnabled, not self.speed_mode)
        tab.setZoomFactor(self.zoom_level / 100)

    def update_security_chips(self) -> None:
        self.speed_chip.setText("Speed: On" if self.speed_mode else "Speed: Off")
        self.blocked_chip.setText(f"Blocked: {self.blocked_count}")
        self.spy_chip.setText(f"Spy alerts: {len(self.store.data.get('spy_alerts', []))}")
        self.tracker_status.setText(f"Trackers blocked: {self.blocked_count}")
        self.spy_status.setText(f"Spy alerts: {len(self.store.data.get('spy_alerts', []))}")
        self.tor_status.setText(f"Tor: {TOR_ENDPOINT[0]}:{TOR_ENDPOINT[1]}" if TOR_ENDPOINT else "Tor: standby")
        permissions = self.store.data.get("cookie_permissions", {})
        allowed = sum(1 for value in permissions.values() if value == "allow")
        denied = sum(1 for value in permissions.values() if value == "deny")
        policy = self.settings_data.get("cookie_policy", "ask")
        policy_label = {"ask": "ask per site", "allow": "allow first-party", "deny": "block all"}.get(policy, "ask per site")
        self.cookie_status.setText(f"Cookies: {policy_label} ({allowed} approved, {denied} declined)")

    def notify_spy_attempt(self, host: str, detail: str) -> None:
        domain = registrable_domain(host) or host or "unknown site"
        message = f"Ghost Guard blocked a spying attempt from {domain}"
        self.status.showMessage(message, 8000)
        self.privacy_chip.setText("Ghost Guard: Spy blocked")
        alerts = self.store.data.setdefault("spy_alerts", [])
        entry = {"site": domain, "detail": detail[:180]}
        if not alerts or alerts[0] != entry:
            alerts.insert(0, entry)
            self.store.data["spy_alerts"] = alerts[:50]
            self.store.save()
            self.refresh_lists()
        self.update_security_chips()
        if domain not in self.notified_spy_hosts:
            self.notified_spy_hosts.add(domain)
            QTimer.singleShot(0, lambda d=domain: self.show_privacy_notice(
                f"Privacy alert: Ghost Guard blocked a tracking or permission request from {d}. Access remains denied."
            ))

    def update_session_ui(self) -> None:
        if hasattr(self, "tabs_chip"):
            self.tabs_chip.setText(f"Tabs: {self.tabs.count()}")

    def add_tab(self, url: str, switch: bool = True) -> BrowserTab:
        tab = BrowserTab(self)
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
        self.store.save()
        self.refresh_lists()
        self.update_security_chips()
        self.status.showMessage("Cookies, cache, history, cookie choices, and alerts cleared", 4200)

    def open_dashboard(self) -> None:
        tab = self.current_tab()
        if tab:
            self.navigate(tab, DASHBOARD_URL)

    def toggle_control_center(self) -> None:
        self.control_dock.setVisible(not self.control_dock.isVisible())

    def open_download_manager(self) -> None:
        self.control_dock.show()
        self.control_dock.raise_()
        self.download_list.setFocus()
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
                state = QWebEnginePage.LifecycleState.Frozen if self.speed_mode and i != self.tabs.currentIndex() else QWebEnginePage.LifecycleState.Active
                try:
                    tab.page().setLifecycleState(state)
                except RuntimeError:
                    pass

    def refresh_lists(self) -> None:
        if not hasattr(self, "bookmark_list"):
            return
        self.bookmark_list.clear()
        for item in self.store.data.get("bookmarks", [])[:30]:
            list_item = QListWidgetItem(item.get("title") or item.get("url", "Bookmark"))
            list_item.setData(Qt.ItemDataRole.UserRole, item.get("url", ""))
            self.bookmark_list.addItem(list_item)
        self.history_list.clear()
        for item in self.store.data.get("history", [])[:30]:
            list_item = QListWidgetItem(item.get("title") or item.get("url", "History"))
            list_item.setData(Qt.ItemDataRole.UserRole, item.get("url", ""))
            self.history_list.addItem(list_item)
        if hasattr(self, "cookie_list"):
            self.cookie_list.clear()
            for domain, decision in sorted(self.store.data.get("cookie_permissions", {}).items()):
                item = QListWidgetItem(f"{domain} — {decision.title()}")
                item.setData(Qt.ItemDataRole.UserRole, domain)
                self.cookie_list.addItem(item)
        self.download_list.clear()
        for entry in self.downloads[-30:]:
            item = QListWidgetItem()
            item.setData(Qt.ItemDataRole.UserRole, id(entry))
            entry["item"] = item
            self.download_list.addItem(item)
            self.update_download_item(entry)
        self.update_download_actions()
        if hasattr(self, "spy_list"):
            self.spy_list.clear()
            for item in self.store.data.get("spy_alerts", [])[:30]:
                site = item.get("site", "unknown site")
                detail = item.get("detail", "Blocked tracking or permission attempt")
                self.spy_list.addItem(f"{site}: {detail}")

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
        entry = {"request": download, "path": target, "state": "Queued", "item": None}
        self.downloads.append(entry)
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

    def update_download_item(self, entry: dict) -> None:
        item = entry.get("item")
        if item is None:
            return
        request = entry.get("request")
        state_text = entry.get("state", "Queued")
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
                    progress_text = f" · {self.format_download_size(received)}"
                    entry["request"] = None
                elif state == QWebEngineDownloadRequest.DownloadState.DownloadCancelled:
                    state_text = "Canceled"
                    entry["request"] = None
                elif state == QWebEngineDownloadRequest.DownloadState.DownloadInterrupted:
                    state_text = "Interrupted"
                    entry["request"] = None
                elif state == QWebEngineDownloadRequest.DownloadState.DownloadRequested:
                    state_text = "Queued"
            except RuntimeError:
                entry["request"] = None
        entry["state"] = state_text
        item.setText(f"{Path(entry['path']).name}  —  {state_text}{progress_text}")
        item.setToolTip(entry["path"])
        self.update_download_actions()

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
        self.clear_downloads_btn.setEnabled(any(item.get("state") not in {"Queued", "Downloading"} for item in self.downloads))

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
        self.store.add_history(tab.title(), self.display_url(tab.url()))
        self.refresh_lists()
        if tab is self.current_tab():
            self.progress_label.setText("Ready" if ok else "Load failed")
            self.privacy_chip.setText("Ghost Guard: On" if ok else "Ghost Guard: Check page")
            self.progress_timer.start(2500)

    def on_url_changed(self, url: QUrl) -> None:
        tab = self.sender()
        index = self.tabs.indexOf(tab)
        if index >= 0:
            self.tabs.setTabToolTip(index, self.display_url(url))
        if tab == self.current_tab():
            self.address.setText(self.display_url(url))
            self.update_navigation_state(tab)
            self.update_page_security_state(url)

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
        if bool(self.settings_data.get("ghost_cleanup_on_close", False)):
            self.clear_ghost_data(confirm=False)
        super().closeEvent(event)

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
            #privacyChip, #torChip, #speedChip, #blockedChip, #spyChip, #tabsChip, #homeChip {
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
            QPushButton, QToolButton, QComboBox, QLineEdit {
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
