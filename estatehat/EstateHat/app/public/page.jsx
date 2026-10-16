"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const PUBLIC_ROUTE_MAP = new Set(["about", "help", "faq", "invest", "press", "terms", "privacy", "accessibility", "dmca"]);

function PublicRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const page = searchParams.get("page") || "about";
    router.replace(PUBLIC_ROUTE_MAP.has(page) ? `/${page}` : "/about");
  }, [router, searchParams]);

  return <div className="app-loader">Redirecting to EstateHat&hellip;</div>;
}

export default function PublicPage() {
  return (
    <Suspense fallback={<div className="app-loader">Redirecting to EstateHat&hellip;</div>}>
      <PublicRedirect />
    </Suspense>
  );
}
