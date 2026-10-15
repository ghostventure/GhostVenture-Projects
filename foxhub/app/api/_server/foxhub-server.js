import crypto from "node:crypto";
import admin from "firebase-admin";

function getServiceAccountCredential() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  if (rawJson) {
    try {
      return admin.credential.cert(JSON.parse(rawJson));
    } catch {
      return null;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "";
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return admin.credential.cert({ projectId, clientEmail, privateKey });
  }

  return null;
}

export function getAdminApp() {
  if (admin.apps.length) return admin.app();

  const credential = getServiceAccountCredential();
  if (credential) {
    return admin.initializeApp({
      credential,
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    });
  }

  return admin.initializeApp();
}

export function getAdminDb() {
  return getAdminApp().firestore();
}

export function getAdminAuth() {
  return getAdminApp().auth();
}

export function sanitizeText(value = "", max = 280) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}

export function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export function timingSafeEqualText(expectedText = "", receivedText = "") {
  const expected = Buffer.from(expectedText, "utf8");
  const received = Buffer.from(receivedText, "utf8");
  if (!expected.length || expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

export function verifyOpsSecretFromRequest(request) {
  const configuredSecret = process.env.FOXHUB_OPS_WEBHOOK_SECRET || "";
  if (!configuredSecret) {
    return { ok: false, reason: "secret_not_configured" };
  }

  const authorization = request.headers.get("authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const token = bearerToken || request.headers.get("x-foxhub-ops-secret") || "";
  return {
    ok: timingSafeEqualText(configuredSecret, token),
    reason: "secret_checked"
  };
}

export async function verifyFirebaseIdTokenFromRequest(request) {
  const authorization = request.headers.get("authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!bearerToken) {
    return { ok: false, reason: "missing_bearer_token" };
  }
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(bearerToken);
    return { ok: true, decodedToken };
  } catch (error) {
    return { ok: false, reason: sanitizeText(error?.message || "invalid_id_token", 160) };
  }
}

export function hasServerManagementAccess(decodedToken = {}) {
  const email = sanitizeText(decodedToken.email || "", 160).toLowerCase();
  const domain = email.includes("@") ? email.split("@").pop() : "";
  return Boolean(
    decodedToken.platformOperator === true ||
      decodedToken.managementAccess === true ||
      decodedToken.staffAccess === true ||
      ["solidartentertainment@gmail.com", "founder@foxhubapp.com"].includes(email) ||
      domain.includes("foxhub")
  );
}

export function parseStripeSignature(headerValue = "") {
  const parsed = {};
  String(headerValue)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((part) => {
      const [key, ...rest] = part.split("=");
      if (key && rest.length) parsed[key] = rest.join("=");
    });
  return parsed;
}

export function verifyStripeSignature({ rawBodyText, stripeSignature, webhookSecret }) {
  if (!rawBodyText || !stripeSignature || !webhookSecret) {
    return { ok: false, reason: "missing_signature_inputs" };
  }

  const parsed = parseStripeSignature(stripeSignature);
  const timestamp = parsed.t;
  const signatureV1 = parsed.v1;
  if (!timestamp || !signatureV1) {
    return { ok: false, reason: "invalid_signature_header" };
  }
  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds) || Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > 300) {
    return { ok: false, reason: "signature_timestamp_outside_tolerance" };
  }

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBodyText}`, "utf8")
    .digest("hex");

  const valid = timingSafeEqualText(expectedSignature, signatureV1);
  return { ok: valid, reason: valid ? "verified" : "signature_mismatch" };
}

export function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}
