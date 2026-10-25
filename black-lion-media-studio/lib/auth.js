import { cookies } from "next/headers";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { findUserById, findUserBySession } from "./db";

const cookieName = "__session";
const legacyCookieName = "bls_session";
const signedTokenSeparator = ".";
const maxSessionTokenLength = 4096;
const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 7;
let developmentSessionSecret;

function originError(message) {
  return NextResponse.json(
    { error: message },
    {
      status: 403,
      headers: {
        "Cache-Control": "no-store",
        Vary: "Origin"
      }
    }
  );
}

export class SessionConfigurationError extends Error {
  constructor() {
    super("Authentication is temporarily unavailable because SESSION_SECRET is not configured. Set SESSION_SECRET to a random value of at least 32 characters.");
    this.name = "SessionConfigurationError";
  }
}

function getSessionSecret() {
  const configuredSecret = process.env.SESSION_SECRET;
  if (configuredSecret) {
    if (configuredSecret.length < 32) {
      throw new SessionConfigurationError();
    }
    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new SessionConfigurationError();
  }

  // Keep local development usable without a checked-in or predictable secret.
  // Sessions naturally expire on a dev-server restart, which is acceptable here.
  developmentSessionSecret ||= crypto.randomBytes(32).toString("base64url");
  return developmentSessionSecret;
}

export function assertSessionConfiguration() {
  getSessionSecret();
}

function signValue(value) {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

export function createSignedSessionToken(userId, request, authVersion = 0) {
  const payload = {
    userId,
    authVersion: Number(authVersion || 0),
    issuedAt: Date.now(),
    expiresAt: Date.now() + sessionLifetimeMs
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}${signedTokenSeparator}${signValue(encodedPayload)}`;
}

function verifySignedSessionToken(token) {
  if (!token || token.length > maxSessionTokenLength || !token.includes(signedTokenSeparator)) {
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
    if (!payload?.userId || !Number.isFinite(payload?.expiresAt)) {
      return null;
    }

    if (payload.expiresAt <= Date.now() || payload.issuedAt > Date.now() + 60_000) {
      return null;
    }

    if (!Number.isFinite(payload.issuedAt)) return null;
    return payload;
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
  try {
    return decodeURIComponent(sessionCookie.slice(separatorIndex + 1));
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser(request) {
  // Fail closed for API and server-rendered auth checks when the production
  // signing key is absent, even if the request does not yet carry a token.
  assertSessionConfiguration();

  const authorizationHeader = request.headers?.get?.("authorization") || "";
  const bearerMatch = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch?.[1] || (await getSessionToken(request));
  if (!token || token.length > maxSessionTokenLength || token.includes("/")) {
    return null;
  }

  const signedPayload = verifySignedSessionToken(token);
  if (signedPayload) {
    const user = await findUserById(signedPayload.userId);
    if (!user) {
      return null;
    }
    if (Number(signedPayload.authVersion || 0) !== Number(user.auth_version || 0)) {
      return null;
    }

    return { token, user };
  }

  const user = await findUserBySession(token);
  if (!user || Number(user.auth_version || 0) > 0) {
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
    return originError("Blocked cross-site request.");
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
      return originError("Blocked cross-origin request.");
    }
  } catch {
    return originError("Invalid request origin.");
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
