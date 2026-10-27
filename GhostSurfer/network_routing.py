"""Startup network route detection and Chromium privacy flags."""

from __future__ import annotations

import os
import socket


TOR_SOCKS_CANDIDATES = (("127.0.0.1", 9050), ("127.0.0.1", 9150))


def detect_tor_endpoint() -> tuple[str, int] | None:
    for host, port in TOR_SOCKS_CANDIDATES:
        try:
            with socket.create_connection((host, port), timeout=0.35):
                return host, port
        except OSError:
            continue
    return None


def build_chromium_flags(tor_endpoint: tuple[str, int] | None) -> str:
    flags = (
        "--disable-features=Translate "
        "--disable-background-networking "
        "--disable-sync "
        "--disable-default-apps "
        "--disable-component-update "
        "--disable-domain-reliability "
        "--disable-client-side-phishing-detection "
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"
    )
    if tor_endpoint:
        host, port = tor_endpoint
        flags += (
            f" --proxy-server=socks5://{host}:{port}"
            ' --host-resolver-rules="MAP * ~NOTFOUND , EXCLUDE 127.0.0.1"'
        )
    return flags


TOR_ENDPOINT = detect_tor_endpoint()
CHROMIUM_FLAGS = build_chromium_flags(TOR_ENDPOINT)
os.environ.setdefault("QTWEBENGINE_CHROMIUM_FLAGS", CHROMIUM_FLAGS)
