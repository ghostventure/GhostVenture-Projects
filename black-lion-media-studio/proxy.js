import { NextResponse } from "next/server";

function applySecurityHeaders(response) {
  response.headers.set(
    "content-security-policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.googleapis.com https://*.google.com https://*.run.app",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests"
    ].join("; ")
  );
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains; preload");
  response.headers.set("cross-origin-opener-policy", "same-origin");
  response.headers.set("cross-origin-resource-policy", "same-origin");
  response.headers.set("origin-agent-cluster", "?1");
  response.headers.set("x-dns-prefetch-control", "off");
  return response;
}

export function proxy(request) {
  const response = NextResponse.next();

  if (
    request.nextUrl.pathname.startsWith("/api/") ||
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/booking-manager") ||
    request.nextUrl.pathname.startsWith("/profile") ||
    request.nextUrl.pathname.startsWith("/messages")
  ) {
    response.headers.set("cache-control", "no-store, no-cache, must-revalidate, private");
  }

  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/booking-manager/:path*",
    "/profile/:path*",
    "/messages/:path*",
    "/portal",
    "/api/:path*"
  ]
};
