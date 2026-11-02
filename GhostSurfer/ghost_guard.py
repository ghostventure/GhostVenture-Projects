"""Modular request, cookie, and permission controls for Ghost Surfer.

The request and permission policies retain their existing enforcement behavior.
The public-IP lookup tripwire only records and reports recognized requests; it
does not block them.
"""

from __future__ import annotations

import ipaddress
from functools import lru_cache
from urllib.parse import urlsplit

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

# A small, deliberately conservative list for local lookalike checks. This is
# not a threat-intelligence feed; add entries only when the browser UI explains
# that the result is a heuristic warning.
_FAMILIAR_DOMAIN_LABELS = (
    "amazon", "apple", "facebook", "google", "instagram", "microsoft",
    "netflix", "paypal", "spotify", "whatsapp",
)
_OFFICIAL_DOMAIN_ROOTS = {
    "amazon": {"amazon.com", "amazon.co.uk", "amazon.ca", "amazon.de", "amazon.co.jp"},
    "apple": {"apple.com"},
    "facebook": {"facebook.com"},
    "google": {"google.com", "google.co.uk", "google.ca", "google.de", "google.fr", "google.co.jp"},
    "instagram": {"instagram.com"},
    "microsoft": {"microsoft.com"},
    "netflix": {"netflix.com"},
    "paypal": {"paypal.com", "paypal.co.uk", "paypal.ca", "paypal.de"},
    "spotify": {"spotify.com"},
    "whatsapp": {"whatsapp.com"},
}


def suspicious_url_reason(url: str) -> str:
    """Return one concise local URL-risk signal, or an empty string.

    This helper performs no network lookup and cannot determine whether a site
    is safe or malicious. It checks URL credentials, IP-literal hosts, IDN
    punycode labels, and close spellings of a short list of familiar domains.
    Examples: ``https://paypal.com`` returns ``""``; ``https://paypa1.com``
    reports a possible lookalike; ``https://user@example.com`` reports embedded
    credentials. Treat a returned reason as a prompt for user review only.
    """
    try:
        parsed = urlsplit((url or "").strip())
        host = (parsed.hostname or "").rstrip(".").lower()
        if not host:
            return ""
        if parsed.username is not None or parsed.password is not None:
            return "This URL contains embedded login information"
        return _suspicious_host_reason(host)
    except (TypeError, ValueError):
        return ""


def _one_typo_apart(candidate: str, expected: str) -> bool:
    """Match a single insertion, deletion, substitution, or adjacent swap."""
    if candidate == expected or abs(len(candidate) - len(expected)) > 1:
        return False
    if len(candidate) == len(expected):
        differences = [index for index, (left, right) in enumerate(zip(candidate, expected)) if left != right]
        if len(differences) == 1:
            return True
        return (
            len(differences) == 2
            and differences[1] == differences[0] + 1
            and candidate[differences[0]] == expected[differences[1]]
            and candidate[differences[1]] == expected[differences[0]]
        )
    longer, shorter = (candidate, expected) if len(candidate) > len(expected) else (expected, candidate)
    left = right = skipped = 0
    while left < len(longer) and right < len(shorter):
        if longer[left] == shorter[right]:
            left += 1
            right += 1
        elif skipped:
            return False
        else:
            skipped = 1
            left += 1
    return True


@lru_cache(maxsize=512)
def _suspicious_host_reason(host: str) -> str:
    """Cache the small offline host-only check without retaining full URLs."""
    try:
        ipaddress.ip_address(host.strip("[]"))
        return "This site uses an IP address instead of a domain name"
    except ValueError:
        pass
    if any(label.startswith("xn--") for label in host.split(".")):
        return "This domain contains an encoded internationalized name (punycode)"

    root = registrable_domain(host)
    root_label = root.split(".", 1)[0]
    for familiar in _FAMILIAR_DOMAIN_LABELS:
        if root in _OFFICIAL_DOMAIN_ROOTS[familiar]:
            continue
        if root_label == familiar:
            return f"This domain uses the familiar name {familiar.title()} with a different ending"
        if len(familiar) >= 6 and _one_typo_apart(root_label, familiar):
            return f"This domain spelling resembles {familiar.title()}"
    return ""


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
