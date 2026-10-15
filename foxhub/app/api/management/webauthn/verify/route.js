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

function fromBase64Url(value = "") {
  return Buffer.from(String(value || ""), "base64url");
}

function parseClientDataJSON(encoded = "") {
  try {
    return JSON.parse(fromBase64Url(encoded).toString("utf8"));
  } catch {
    return null;
  }
}

function timingSafeEqualBase64Url(expected = "", received = "") {
  const expectedBuffer = Buffer.from(String(expected || ""), "utf8");
  const receivedBuffer = Buffer.from(String(received || ""), "utf8");
  if (!expectedBuffer.length || expectedBuffer.length !== receivedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
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
  const challengeId = sanitizeText(body.challengeId || "", 80);
  const credential = body.credential && typeof body.credential === "object" ? body.credential : {};
  const response = credential.response && typeof credential.response === "object" ? credential.response : {};
  if (!challengeId || !response.clientDataJSON || !credential.id) {
    return jsonResponse({ ok: false, error: "missing_webauthn_response" }, 400);
  }

  const db = getAdminDb();
  const challengeRef = db.collection("managementWebAuthnChallenges").doc(challengeId);
  const challengeSnap = await challengeRef.get();
  if (!challengeSnap.exists) {
    return jsonResponse({ ok: false, error: "challenge_not_found" }, 404);
  }
  const challengeRecord = challengeSnap.data() || {};
  if (challengeRecord.status !== "issued") {
    return jsonResponse({ ok: false, error: "challenge_already_used" }, 409);
  }
  if (new Date(challengeRecord.expiresAt || 0).getTime() < Date.now()) {
    await challengeRef.set({ status: "expired", expiredAt: serverTimestamp() }, { merge: true });
    return jsonResponse({ ok: false, error: "challenge_expired" }, 410);
  }
  if (challengeRecord.uid !== authResult.decodedToken.uid) {
    return jsonResponse({ ok: false, error: "challenge_user_mismatch" }, 403);
  }

  const clientData = parseClientDataJSON(response.clientDataJSON);
  const origin = sanitizeText(request.headers.get("origin") || "", 220);
  if (!clientData || clientData.type !== "webauthn.create") {
    return jsonResponse({ ok: false, error: "invalid_webauthn_type" }, 400);
  }
  if (!timingSafeEqualBase64Url(challengeRecord.challenge, clientData.challenge || "")) {
    return jsonResponse({ ok: false, error: "challenge_mismatch" }, 400);
  }
  if (challengeRecord.origin && clientData.origin && challengeRecord.origin !== clientData.origin) {
    return jsonResponse({ ok: false, error: "origin_mismatch" }, 400);
  }

  const sessionId = crypto.randomUUID();
  const uid = authResult.decodedToken.uid;
  const email = sanitizeText(authResult.decodedToken.email || "", 160).toLowerCase();
  const verifiedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const credentialRecord = {
    credentialId: sanitizeText(credential.id || "", 240),
    credentialType: sanitizeText(credential.type || "public-key", 40),
    clientOrigin: sanitizeText(clientData.origin || origin || "", 220),
    authenticatorAttachment: sanitizeText(credential.authenticatorAttachment || "platform", 40),
    transports: Array.isArray(response.transports) ? response.transports.map((item) => sanitizeText(item, 40)).slice(0, 8) : [],
    verifiedAt
  };

  await challengeRef.set({
    status: "verified",
    credentialId: credentialRecord.credentialId,
    verifiedAt: serverTimestamp()
  }, { merge: true });

  await db.collection("managementAccessSessions").doc(sessionId).set({
    sessionId,
    uid,
    email,
    challengeId,
    status: "active",
    source: "windows_webauthn",
    credential: credentialRecord,
    expiresAt,
    createdAt: serverTimestamp()
  });

  await db.collection("managementAccessEvents").add({
    uid,
    email,
    action: "management_webauthn_verified",
    status: "verified",
    challengeId,
    sessionId,
    origin: credentialRecord.clientOrigin,
    createdAt: serverTimestamp()
  });

  return jsonResponse({
    ok: true,
    sessionId,
    expiresAt,
    backend: "next-api",
    serverVerified: true
  });
}

export async function GET() {
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
}
