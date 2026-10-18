"use client";

export function trackEvent(eventName, metadata = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const payload = JSON.stringify({
    eventName,
    path: `${window.location.pathname}${window.location.search}`,
    source: "browser",
    referrerPath: document.referrer ? new URL(document.referrer, window.location.origin).pathname : "",
    metadata
  });

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon("/api/events", new Blob([payload], { type: "application/json" }));
    if (sent) {
      return;
    }
  }

  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    credentials: "same-origin",
    keepalive: true
  }).catch(() => {});
}
