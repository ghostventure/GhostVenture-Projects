import {
  getAdminDb,
  jsonResponse,
  serverTimestamp,
  verifyStripeSignature
} from "../../_server/foxhub-server.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const rawBodyText = await request.text();
  const stripeSignature = request.headers.get("stripe-signature") || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const verification = verifyStripeSignature({
    rawBodyText,
    stripeSignature,
    webhookSecret
  });
  if (!verification.ok) {
    return jsonResponse({ ok: false, error: "invalid_signature", reason: verification.reason }, 400);
  }

  let eventPayload = {};
  try {
    eventPayload = JSON.parse(rawBodyText);
  } catch {
    return jsonResponse({ ok: false, error: "invalid_event_payload" }, 400);
  }
  if (!eventPayload || typeof eventPayload !== "object" || Array.isArray(eventPayload) || !eventPayload.id || !eventPayload.type) {
    return jsonResponse({ ok: false, error: "invalid_event_payload" }, 400);
  }

  const eventId = String(eventPayload.id);
  const eventType = String(eventPayload.type);
  const createdEpoch = Number(eventPayload?.created || 0);
  const customerId = String(eventPayload?.data?.object?.customer || "");
  const subscriptionId = String(eventPayload?.data?.object?.id || "");

  const db = getAdminDb();
  const eventRef = db.collection("stripeWebhookEvents").doc(eventId);
  const subscriptionEventRef = db.collection("billingSubscriptionEvents").doc(eventId);
  const wasRecorded = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(eventRef);
    if (existing.exists) return false;
    transaction.create(eventRef, {
      eventId,
      eventType,
      customerId,
      subscriptionId,
      livemode: Boolean(eventPayload?.livemode),
      createdEpoch,
      backend: "next-api",
      receivedAt: serverTimestamp()
    });
    if (eventType.startsWith("customer.subscription.")) {
      transaction.create(subscriptionEventRef, {
        source: "stripe",
        eventId,
        eventType,
        customerId,
        subscriptionId,
        backend: "next-api",
        createdAt: serverTimestamp()
      });
    }
    return true;
  });

  return jsonResponse({
    ok: true,
    received: true,
    eventId,
    eventType,
    verified: true,
    alreadyProcessed: !wasRecorded,
    backend: "next-api",
    webhookSecretConfigured: Boolean(webhookSecret)
  });
}

export async function GET() {
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
}
