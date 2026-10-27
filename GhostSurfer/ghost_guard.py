"""Modular request, cookie, and permission controls for Ghost Surfer.

The request and permission policies retain their existing enforcement behavior.
The public-IP lookup tripwire only records and reports recognized requests; it
does not block them.
"""

from __future__ import annotations

from PySide6.QtCore import QUrl
from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineSettings, QWebEngineUrlRequestInterceptor

from ip_tripwire import inspect_ip_lookup_request


COMMON_SECOND_LEVEL_SUFFIXES = {
    "co.uk", "org.uk", "ac.uk", "com.au", "net.au", "org.au", "co.nz",
    "com.br", "com.mx", "co.jp",
}

TRACKER_HOST_PARTS = (
    "2mdn.net", "adform.net", "adsafeprotected.com", "adsrvr.org",
    "amazon-adsystem.com", "appsflyer.com", "bluekai.com", "chartbeat.com",
    "criteo.com", "doubleclick.net", "everesttech.net", "googleadservices.com",
    "googlesyndication.com", "google-analytics.com", "googletagmanager.com",
    "facebook.net", "connect.facebook.net", "analytics.twitter.com",
    "ads-twitter.com", "scorecardresearch.com", "quantserve.com", "hotjar.com",
    "segment.io", "mixpanel.com", "adnxs.com", "taboola.com", "outbrain.com",
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


class GhostGuardRequestInterceptor(QWebEngineUrlRequestInterceptor):
    """Enforce existing request rules and emit alert-only IP lookup signals."""

    def __init__(self, window) -> None:
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

        tracker_blocked = any(host == part or host.endswith("." + part) for part in TRACKER_HOST_PARTS)
        if tracker_blocked:
            info.block(True)
            self.window.blocked_request_event.emit(host, url.toString(), True)
            return

        ip_lookup = inspect_ip_lookup_request(url.toString())
        if ip_lookup is not None:
            first_party = info.firstPartyUrl().host().lower()
            if not first_party:
                first_party = info.initiator().host().lower()
            if not first_party:
                first_party = host or ip_lookup.host
            self.window.ip_lookup_event.emit(
                first_party,
                ip_lookup.host,
                ip_lookup.category,
                ip_lookup.detail,
            )

        if self.window.speed_mode and info.resourceType().name in {"ResourceTypeMedia", "ResourceTypePing"}:
            info.block(True)
            self.window.blocked_request_event.emit(host, url.toString(), False)
            return

        info.setHttpHeader(b"DNT", b"1")
        info.setHttpHeader(b"Sec-GPC", b"1")
        info.setHttpHeader(b"Upgrade-Insecure-Requests", b"1")


class FirstPartyCookiePolicy:
    """Apply Ghost Surfer's saved per-site cookie choices."""

    def __init__(self, window) -> None:
        self.window = window

    def filter(self, request) -> bool:
        origin_host = request.origin.host().lower()
        first_party_host = request.firstPartyUrl.host().lower()
        top_domain = registrable_domain(first_party_host or origin_host)

        if request.thirdParty:
            self.window.cookie_filter_event.emit(registrable_domain(origin_host) or origin_host, "third-party")
            return False

        policy = self.window.settings_data.get("cookie_policy", "ask")
        if policy == "allow":
            return True
        if policy == "deny":
            return False

        if not top_domain or not same_site(origin_host, top_domain):
            return False

        decision = self.window.store.data.get("cookie_permissions", {}).get(top_domain)
        if decision == "allow":
            return True
        if decision == "deny":
            return False

        self.window.cookie_filter_event.emit(top_domain, "prompt")
        return False


def handle_permission_request(window, page: QWebEnginePage, origin: QUrl, feature: QWebEnginePage.Feature) -> None:
    """Keep sensitive WebEngine permissions denied and report blocked prompts."""
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
    page.setFeaturePermission(origin, feature, QWebEnginePage.PermissionPolicy.PermissionDeniedByUser)
    if feature in denied_features:
        window.notify_spy_attempt(origin.host().lower(), f"Permission request blocked: {feature.name}")


def apply_web_engine_security(settings: QWebEngineSettings, preferences: dict, speed_mode: bool) -> None:
    """Apply Ghost Surfer's existing privacy and performance settings to a page."""
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
    settings.setAttribute(QWebEngineSettings.WebAttribute.AutoLoadImages, not bool(preferences.get("block_images", False)))
    settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, bool(preferences.get("allow_javascript", True)))
    settings.setAttribute(QWebEngineSettings.WebAttribute.WebGLEnabled, bool(preferences.get("allow_webgl", False)))
    settings.setAttribute(QWebEngineSettings.WebAttribute.ReadingFromCanvasEnabled, not speed_mode)
    settings.setAttribute(QWebEngineSettings.WebAttribute.ScrollAnimatorEnabled, not speed_mode)
