from __future__ import annotations

from dataclasses import dataclass
import ipaddress
import re
from urllib.parse import unquote, urlsplit


@dataclass(frozen=True)
class IPLookupMatch:
    """A recognized client-side request that returns the visitor's public IP/location."""

    host: str
    category: str
    suggested_action: str
    detail: str


# These are explicit public-IP echo APIs. Exact provider hostnames keep false
# positives low; ordinary site connections are not classified here.
_IP_ECHO_HOSTS = {
    "api.ipify.org",
    "api64.ipify.org",
    "checkip.amazonaws.com",
    "icanhazip.com",
    "ipv4.icanhazip.com",
    "ipv6.icanhazip.com",
    "ident.me",
    "api.myip.com",
}
_IP_ECHO_PATHS = {
    "ifconfig.me": {"/", "/ip", "/json", "/all", "/all.json"},
    "myexternalip.com": {"/raw", "/json"},
    "wtfismyip.com": {"/text", "/json"},
}

# These providers expose client-IP geolocation endpoints. Each provider has a
# narrow path matcher below so its informational website is not blanket-blocked.
_GEO_API_HOSTS = {
    "ip-api.com",
    "ipapi.co",
    "ipinfo.io",
    "ipwho.is",
    "ipgeolocation.io",
    "ipdata.co",
    "ipregistry.co",
}

_IP_PATH_RE = re.compile(r"^/(?:json|ip|raw|all(?:\.json)?|csv|ipgeo)?/?$", re.IGNORECASE)
_JSON_OR_CSV_PREFIX_RE = re.compile(r"^/(?:json|csv)(?:/|$)", re.IGNORECASE)


def _canonical_host(url: str) -> tuple[str, str] | None:
    try:
        parsed = urlsplit(str(url))
        if parsed.scheme.casefold() not in {"http", "https"} or not parsed.hostname:
            return None
        host = parsed.hostname.rstrip(".").encode("idna").decode("ascii").casefold()
        path = unquote(parsed.path or "/")
        return host, path
    except (UnicodeError, ValueError):
        return None


def _host_matches(host: str, domain: str) -> bool:
    return host == domain or host.endswith("." + domain)


def _is_ip_literal(value: str) -> bool:
    try:
        ipaddress.ip_address(value.strip("[]"))
        return True
    except ValueError:
        return False


def _is_known_geo_endpoint(host: str, path: str) -> bool:
    normalized = path.casefold()
    if host == "ip-api.com":
        return _JSON_OR_CSV_PREFIX_RE.match(normalized) is not None
    if host == "ipapi.co":
        parts = [part for part in normalized.split("/") if part]
        return parts == ["json"] or (len(parts) == 2 and _is_ip_literal(parts[0]) and parts[1] == "json")
    if host == "ipinfo.io":
        parts = [part for part in normalized.split("/") if part]
        return parts == ["ip"] or parts == ["json"] or (len(parts) == 2 and _is_ip_literal(parts[0]) and parts[1] == "json")
    if host == "ipwho.is":
        parts = [part for part in normalized.split("/") if part]
        return not parts or (len(parts) == 1 and _is_ip_literal(parts[0]))
    if host == "ipgeolocation.io":
        return normalized == "/ipgeo" or normalized.startswith("/ipgeo/")
    if host in {"ipdata.co", "ipregistry.co"}:
        return _IP_PATH_RE.fullmatch(normalized) is not None
    return False


def inspect_ip_lookup_request(url: str) -> IPLookupMatch | None:
    """Identify a known public-IP echo or visitor-IP geolocation API request.

    This is a best-effort URL tripwire, not proof of intent. It does not detect
    a site using its own server logs, custom endpoints, DNS, or other means.
    Integrators should alert on matches and block recognized API subrequests;
    allow a user-initiated main-frame navigation to an IP-check site.
    """
    canonical = _canonical_host(url)
    if canonical is None:
        return None
    host, path = canonical

    if any(_host_matches(host, domain) for domain in _IP_ECHO_HOSTS):
        return IPLookupMatch(
            host=host,
            category="public_ip_lookup",
            suggested_action="block_subresource",
            detail=f"Known public-IP echo endpoint requested: {host}{path}",
        )

    for domain, paths in _IP_ECHO_PATHS.items():
        if _host_matches(host, domain) and path.casefold() in paths:
            return IPLookupMatch(
                host=host,
                category="public_ip_lookup",
                suggested_action="block_subresource",
                detail=f"Known public-IP echo endpoint requested: {host}{path}",
            )

    for domain in _GEO_API_HOSTS:
        if _host_matches(host, domain) and _is_known_geo_endpoint(domain, path):
            return IPLookupMatch(
                host=host,
                category="ip_geolocation_lookup",
                suggested_action="block_subresource",
                detail=f"Known visitor-IP geolocation API requested: {host}{path}",
            )
    return None
