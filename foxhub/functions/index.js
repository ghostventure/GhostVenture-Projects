import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";
import next from "next";

const functionsDir = path.dirname(fileURLToPath(import.meta.url));
const nextAppDir = path.join(functionsDir, "next-app");
let nextHandlerPromise;

if (!admin.apps.length) {
  admin.initializeApp();
}

setGlobalOptions({
  region: "us-central1",
  maxInstances: 10
});

function getNextHandler() {
  if (!nextHandlerPromise) {
    const app = next({
      dev: false,
      dir: nextAppDir,
      conf: {
        distDir: ".next",
        images: {
          unoptimized: true
        }
      }
    });
    nextHandlerPromise = app.prepare().then(() => app.getRequestHandler());
  }
  return nextHandlerPromise;
}

export const nextApp = onRequest(
  {
    cors: true,
    memory: "1GiB",
    timeoutSeconds: 60
  },
  async (req, res) => {
    try {
      const handler = await getNextHandler();
      return handler(req, res);
    } catch (error) {
      logger.error("Next app request failed", { error: error?.message, stack: error?.stack });
      res.status(500).json({ ok: false, error: "next_app_failed" });
    }
  }
);

function parseStripeSignature(headerValue = "") {
  const parts = String(headerValue)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const parsed = {};
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    if (!key || rest.length === 0) continue;
    parsed[key] = rest.join("=");
  }
  return parsed;
}

function verifyStripeSignature({ rawBodyBuffer, stripeSignature, webhookSecret }) {
  if (!rawBodyBuffer || !stripeSignature || !webhookSecret) {
    return {
      ok: false,
      reason: "missing_signature_inputs"
    };
  }

  const parsed = parseStripeSignature(stripeSignature);
  const timestamp = parsed.t;
  const signatureV1 = parsed.v1;
  if (!timestamp || !signatureV1) {
    return {
      ok: false,
      reason: "invalid_signature_header"
    };
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds) || Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > 300) {
    return { ok: false, reason: "signature_timestamp_outside_tolerance" };
  }

  const signedPayload = `${timestamp}.${rawBodyBuffer.toString("utf8")}`;
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(signedPayload, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const receivedBuffer = Buffer.from(signatureV1, "utf8");
  if (expectedBuffer.length !== receivedBuffer.length) {
    return {
      ok: false,
      reason: "signature_length_mismatch"
    };
  }

  const valid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  return {
    ok: valid,
    reason: valid ? "verified" : "signature_mismatch"
  };
}

function verifyOpsSecret(req) {
  const configuredSecret = process.env.FOXHUB_OPS_WEBHOOK_SECRET || "";
  if (!configuredSecret) {
    return { ok: false, reason: "secret_not_configured" };
  }
  const authorization = req.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : req.get("x-foxhub-ops-secret") || "";
  const expected = Buffer.from(configuredSecret, "utf8");
  const received = Buffer.from(token, "utf8");
  if (expected.length !== received.length) {
    return { ok: false, reason: "secret_length_mismatch" };
  }
  return {
    ok: crypto.timingSafeEqual(expected, received),
    reason: "secret_checked"
  };
}

function sanitizeText(value = "", max = 280) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}

export const stripeWebhook = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const rawBodyBuffer = Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : Buffer.from(typeof req.rawBody === "string" ? req.rawBody : JSON.stringify(req.body || {}), "utf8");

  const stripeSignature = req.get("stripe-signature") || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const verification = verifyStripeSignature({
    rawBodyBuffer,
    stripeSignature,
    webhookSecret
  });
  if (!verification.ok) {
    res.status(400).json({ ok: false, error: "invalid_signature", reason: verification.reason });
    return;
  }

  let eventPayload = req.body;
  if (!eventPayload || typeof eventPayload !== "object") {
    try {
      eventPayload = JSON.parse(rawBodyBuffer.toString("utf8"));
    } catch {
      res.status(400).json({ ok: false, error: "invalid_event_payload" });
      return;
    }
  }
  if (!eventPayload || typeof eventPayload !== "object" || Array.isArray(eventPayload) || !eventPayload.id || !eventPayload.type) {
    res.status(400).json({ ok: false, error: "invalid_event_payload" });
    return;
  }

  const eventId = String(eventPayload.id);
  const eventType = String(eventPayload.type);
  const createdEpoch = Number(eventPayload?.created || 0);
  const customerId = String(eventPayload?.data?.object?.customer || "");
  const subscriptionId = String(eventPayload?.data?.object?.id || "");

  const db = admin.firestore();
  const webhookDocRef = db.collection("stripeWebhookEvents").doc(eventId);

  const subscriptionEventRef = db.collection("billingSubscriptionEvents").doc(eventId);
  const wasRecorded = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(webhookDocRef);
    if (existing.exists) return false;
    transaction.create(webhookDocRef, {
      eventId,
      eventType,
      customerId,
      subscriptionId,
      livemode: Boolean(eventPayload?.livemode),
      createdEpoch,
      backend: "firebase-functions",
      receivedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    if (eventType.startsWith("customer.subscription.")) {
      transaction.create(subscriptionEventRef, {
        source: "stripe",
        eventId,
        eventType,
        customerId,
        subscriptionId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    return true;
  });

  logger.info("Stripe webhook received", {
    eventId,
    eventType,
    verified: true,
    alreadyProcessed: !wasRecorded
  });

  res.status(200).json({
    ok: true,
    received: true,
    eventId,
    eventType,
    verified: true,
    alreadyProcessed: !wasRecorded,
    webhookSecretConfigured: Boolean(webhookSecret)
  });
});

export const productionOpsWebhook = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const authResult = verifyOpsSecret(req);
  if (!authResult.ok) {
    res.status(401).json({ ok: false, error: "unauthorized", reason: authResult.reason });
    return;
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const componentKey = sanitizeText(body.componentKey || "server-backend", 80);
  const action = sanitizeText(body.action || "run", 80);
  const targetUid = sanitizeText(body.uid || "", 160);
  const event = {
    componentKey,
    action,
    surface: sanitizeText(body.surface || "backend", 80),
    detail: sanitizeText(body.detail || "Production operation accepted by server.", 500),
    status: sanitizeText(body.status || "accepted", 40),
    targetUid,
    payload: body.payload && typeof body.payload === "object" ? body.payload : {},
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const db = admin.firestore();
  const eventRef = await db.collection("productionOpsEvents").add(event);
  if (targetUid) {
    await db.collection("users").doc(targetUid).collection("productionOpsEvents").doc(eventRef.id).set(event, { merge: true });
  }

  logger.info("Production operation accepted", { eventId: eventRef.id, componentKey, action, targetUid });
  res.status(200).json({
    ok: true,
    eventId: eventRef.id,
    componentKey,
    action,
    secretConfigured: Boolean(process.env.FOXHUB_OPS_WEBHOOK_SECRET)
  });
});

export const pushDeliveryRequest = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const authResult = verifyOpsSecret(req);
  if (!authResult.ok) {
    res.status(401).json({ ok: false, error: "unauthorized", reason: authResult.reason });
    return;
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const token = sanitizeText(body.token || "", 500);
  const title = sanitizeText(body.title || "FoxHub update", 120);
  const messageBody = sanitizeText(body.body || "A FoxHub event is ready.", 240);
  const requestRecord = {
    uid: sanitizeText(body.uid || "", 160),
    channel: "fcm",
    tokenPreview: token ? `${token.slice(0, 8)}...${token.slice(-6)}` : "",
    title,
    body: messageBody,
    status: token ? "queued" : "missing_token",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const db = admin.firestore();
  const requestRef = await db.collection("pushDeliveryRequests").add(requestRecord);
  let messageId = "";
  if (token) {
    try {
      messageId = await admin.messaging().send({
        token,
        notification: {
          title,
          body: messageBody
        },
        data: {
          requestId: requestRef.id,
          source: "foxhub"
        }
      });
      await requestRef.set({ status: "sent", messageId, sentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } catch (error) {
      await requestRef.set({ status: "failed", error: sanitizeText(error?.message || "send_failed", 240) }, { merge: true });
      logger.warn("Push delivery failed", { requestId: requestRef.id, error: error?.message });
    }
  }

  res.status(200).json({
    ok: true,
    requestId: requestRef.id,
    status: token && messageId ? "sent" : requestRecord.status,
    messageId,
    secretConfigured: Boolean(process.env.FOXHUB_OPS_WEBHOOK_SECRET)
  });
});
