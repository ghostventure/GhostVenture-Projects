import crypto from "node:crypto";
import {
  getAdminDb,
  hasServerManagementAccess,
  jsonResponse,
  sanitizeText,
  serverTimestamp,
  verifyFirebaseIdTokenFromRequest
} from "../../../_server/foxhub-server.js";

export const dynamic = "force-dynamic";

function toBase64Url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function isWindowsUserAgent(userAgent = "", platform = "") {
  return /win/i.test(`${platform} ${userAgent}`);
}

export async function POST(request) {
  const authResult = await verifyFirebaseIdTokenFromRequest(request);
  if (!authResult.ok) {
    return jsonResponse({ ok: false, error: "unauthorized", reason: authResult.reason }, 401);
  }
  if (!hasServerManagementAccess(authResult.decodedToken)) {
    return jsonResponse({ ok: false, error: "not_permitted", reason: "management_access_required" }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const userAgent = sanitizeText(request.headers.get("user-agent") || body.userAgent || "", 600);
  const platform = sanitizeText(body.platform || "", 120);
  if (!isWindowsUserAgent(userAgent, platform)) {
    return jsonResponse({ ok: false, error: "windows_browser_required", reason: "Android and iOS browser sessions are blocked." }, 403);
  }

  const challenge = toBase64Url(crypto.randomBytes(32));
  const challengeId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  const uid = authResult.decodedToken.uid;
  const email = sanitizeText(authResult.decodedToken.email || "", 160).toLowerCase();
  const origin = sanitizeText(request.headers.get("origin") || body.origin || "", 220);
  const db = getAdminDb();

  await db.collection("managementWebAuthnChallenges").doc(challengeId).set({
    challengeId,
    challenge,
    uid,
    email,
    origin,
    userAgent,
    platform,
    status: "issued",
    expiresAt,
    createdAt: serverTimestamp()
  });

  await db.collection("managementAccessEvents").add({
    uid,
    email,
    action: "management_webauthn_challenge_issued",
    status: "issued",
    platform,
    origin,
    createdAt: serverTimestamp()
  });

  return jsonResponse({
    ok: true,
    challengeId,
    challenge,
    expiresAt,
    rpName: "FoxHub",
    user: {
      id: toBase64Url(Buffer.from(uid || email || challengeId, "utf8")).slice(0, 86),
      name: email,
      displayName: sanitizeText(body.displayName || email || "FoxHub Staff", 120)
    },
    backend: "next-api"
  });
}

export async function GET() {
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
}
