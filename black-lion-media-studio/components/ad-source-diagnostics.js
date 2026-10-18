"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

const STORAGE_KEY = "bls-ad-source-diagnostics";
const PRIVATE_PATH_PREFIXES = ["/api", "/dashboard", "/messages", "/profile", "/booking-manager"];
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];

function getDeviceSummary() {
  const userAgent = navigator.userAgent || "";
  const mobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(userAgent);
  const tablet = /iPad|Tablet|PlayBook|Silk/i.test(userAgent);
  const viewport = `${window.innerWidth}x${window.innerHeight}`;

  return {
    type: tablet ? "tablet" : mobile ? "mobile" : "desktop",
    viewport,
    platform: navigator.platform || "unknown",
    language: navigator.language || "unknown"
  };
}

function readStoredDiagnostics() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function buildUtmPayload(searchParams) {
  return UTM_KEYS.reduce((payload, key) => {
    const value = searchParams?.get(key);
    if (value) {
      payload[key] = value.slice(0, 180);
    }
    return payload;
  }, {});
}

function AdSourceDiagnosticsInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || PRIVATE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return;
    }

    try {
      const query = searchParams?.toString() || "";
      const path = query ? `${pathname}?${query}` : pathname;
      const visit = {
        capturedAt: new Date().toISOString(),
        path,
        referrer: document.referrer || "",
        utm: buildUtmPayload(searchParams),
        device: getDeviceSummary()
      };
      const existing = readStoredDiagnostics();
      const recentVisits = Array.isArray(existing.recentVisits) ? existing.recentVisits : [];
      const nextPayload = {
        firstVisit: existing.firstVisit || visit,
        latestVisit: visit,
        recentVisits: [visit, ...recentVisits].slice(0, 10)
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPayload));
    } catch {
      // Attribution capture should never interfere with page rendering.
    }
  }, [pathname, searchParams]);

  return null;
}

export function AdSourceDiagnostics() {
  return (
    <Suspense fallback={null}>
      <AdSourceDiagnosticsInner />
    </Suspense>
  );
}
