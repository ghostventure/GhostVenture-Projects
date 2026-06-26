import { cookies } from "next/headers";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { findUserById, findUserBySession } from "./db";

const cookieName = "__session";
const legacyCookieName = "bls_session";
const signedTokenSeparator = ".";
const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 7;

function getSessionSecret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.K_REVISION ||
    process.env.GCLOUD_PROJECT ||
    "black-lion-studios-session"
  );
}

function signValue(value) {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

export function createSignedSessionToken(userId, request) {
  const payload = {
    userId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + sessionLifetimeMs
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}${signedTokenSeparator}${signValue(encodedPayload)}`;
}

function verifySignedSessionToken(token, request) {
  if (!token || !token.includes(signedTokenSeparator)) {
    return null;
  }

  const separatorIndex = token.lastIndexOf(signedTokenSeparator);
  const encodedPayload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (!payload?.userId || !payload?.expiresAt) {
      return null;
    }

    if (payload.expiresAt < Date.now()) {
      return null;
    }

    return payload.userId;
  } catch {
    return null;
  }
}

export async function getSessionToken(request) {
  const directCookie = request.cookies?.get?.(cookieName)?.value;
  if (directCookie) {
    return directCookie;
  }

  const legacyDirectCookie = request.cookies?.get?.(legacyCookieName)?.value;
  if (legacyDirectCookie) {
    return legacyDirectCookie;
  }

  const cookieHeader = request.headers?.get?.("cookie");
  if (!cookieHeader) {
    return null;
  }

  const headerCookies = cookieHeader.split(";").map((part) => part.trim());
  const sessionCookie =
    headerCookies.find((part) => part.startsWith(`${cookieName}=`)) ||
    headerCookies.find((part) => part.startsWith(`${legacyCookieName}=`));
  if (!sessionCookie) {
    const cookieStore = await cookies();
    return cookieStore.get(cookieName)?.value || cookieStore.get(legacyCookieName)?.value || null;
  }

  const separatorIndex = sessionCookie.indexOf("=");
  return decodeURIComponent(sessionCookie.slice(separatorIndex + 1));
}

export async function getAuthenticatedUser(request) {
  const authorizationHeader = request.headers?.get?.("authorization") || "";
  const bearerMatch = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch?.[1] || (await getSessionToken(request));
  if (!token) {
    return null;
  }

  const signedUserId = verifySignedSessionToken(token, request);
  if (signedUserId) {
    const user = await findUserById(signedUserId);
    if (!user) {
      return null;
    }

    return { token, user };
  }

  const user = await findUserBySession(token);
  if (!user) {
    return null;
  }

  return { token, user };
}

export function enforceTrustedOrigin(request) {
  const method = request.method?.toUpperCase?.() || "GET";
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return null;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const secFetchSite = request.headers.get("sec-fetch-site");

  if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
    return NextResponse.json({ error: "Blocked cross-site request." }, { status: 403 });
  }

  if (!origin) {
    return null;
  }

  try {
    const originUrl = new URL(origin);
    const allowedHosts = new Set(
      [
        host,
        request.headers.get("x-forwarded-host"),
        request.headers.get("x-fh-requested-host"),
        request.nextUrl?.host
      ]
        .flatMap((value) => String(value || "").split(","))
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    );

    if (allowedHosts.size === 0) {
      return null;
    }

    if (!allowedHosts.has(originUrl.host.toLowerCase())) {
      return NextResponse.json({ error: "Blocked cross-origin request." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  return null;
}

export function withSessionCookie(response, token) {
  response.cookies.set(cookieName, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
  response.cookies.set(legacyCookieName, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}

export function clearSessionCookie(response = NextResponse.json({ ok: true })) {
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  response.cookies.set(legacyCookieName, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}
