"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { trackEvent } from "../lib/client-analytics";

function AnalyticsTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams?.toString();
    trackEvent("page_view", {
      page: query ? `${pathname}?${query}` : pathname
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleClick(event) {
      const target = event.target?.closest?.("[data-analytics-event]");
      if (!target) {
        return;
      }

      trackEvent(target.dataset.analyticsEvent, {
        label: target.dataset.analyticsLabel || target.textContent || "",
        target: target.getAttribute("href") || target.dataset.analyticsTarget || ""
      });
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}

export function AnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <AnalyticsTrackerInner />
    </Suspense>
  );
}
