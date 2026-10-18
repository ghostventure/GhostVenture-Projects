import { NextResponse } from "next/server";
import { applySecurityHeaders } from "./lib/security-headers.mjs";

const blockedProbePattern =
  /(?:^|\/)(?:\.env|\.git|\.svn|\.hg|wp-admin|wp-login\.php|xmlrpc\.php|phpmyadmin|adminer|composer\.(?:json|lock)|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)(?:\/|$)/i;

function isSensitivePath(pathname) {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/booking-manager") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/portal")
  );
}

export function proxy(request) {
  if (blockedProbePattern.test(request.nextUrl.pathname)) {
    const response = new NextResponse(null, { status: 404 });
    applySecurityHeaders(response.headers);
    response.headers.set("cache-control", "no-store, no-cache, must-revalidate, private");
    return response;
  }

  const response = NextResponse.next();

  if (isSensitivePath(request.nextUrl.pathname)) {
    response.headers.set("cache-control", "no-store, no-cache, must-revalidate, private");
  }

  applySecurityHeaders(response.headers);
  return response;
}

export const config = {
  matcher: ["/:path*"]
};
