import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import test from "node:test";

import admin from "firebase-admin";
import { verifyStripeSignature } from "../app/api/_server/foxhub-server.js";

const secret = "whsec_test_foxhub";
const payload = JSON.stringify({
  id: "evt_test_foxhub",
  type: "customer.subscription.updated",
  created: 1_800_000_000,
  data: { object: { id: "sub_test", customer: "cus_test" } }
});

function signatureFor(rawBodyText, timestampSeconds) {
  const digest = crypto.createHmac("sha256", secret).update(`${timestampSeconds}.${rawBodyText}`).digest("hex");
  return `t=${timestampSeconds},v1=${digest}`;
}

async function responseBody(response) {
  return response.json();
}

test("Stripe signature verification accepts signed current payloads and rejects stale or altered payloads", () => {
  const now = Math.floor(Date.now() / 1000);
  const signature = signatureFor(payload, now);
  assert.deepEqual(verifyStripeSignature({ rawBodyText: payload, stripeSignature: signature, webhookSecret: secret }), {
    ok: true,
    reason: "verified"
  });
  assert.equal(verifyStripeSignature({
    rawBodyText: payload,
    stripeSignature: signatureFor(payload, now - 301),
    webhookSecret: secret
  }).reason, "signature_timestamp_outside_tolerance");
  assert.equal(verifyStripeSignature({
    rawBodyText: `${payload} `,
    stripeSignature: signature,
    webhookSecret: secret
  }).reason, "signature_mismatch");
});

test("Stripe API rejects a stale signature before any Firestore write and records a valid event only once", async () => {
  const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  const app = admin.apps[0] || admin.initializeApp({ projectId: "foxhub-webhook-test" });
  const db = app.firestore();
  const originalCollection = db.collection;
  const originalRunTransaction = db.runTransaction;
  const writes = [];
  const recorded = new Set();

  db.collection = (collectionName) => ({
    doc: (id) => ({ collectionName, id })
  });
  db.runTransaction = async (callback) => callback({
    get: async (ref) => ({ exists: recorded.has(`${ref.collectionName}/${ref.id}`) }),
    create: (ref, value) => {
      writes.push({ ref, value });
      recorded.add(`${ref.collectionName}/${ref.id}`);
    }
  });

  try {
    const { POST } = await import(`../app/api/stripe/webhook/route.js?test=${Date.now()}`);
    const stale = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": signatureFor(payload, Math.floor(Date.now() / 1000) - 301) },
      body: payload
    });
    const staleResponse = await POST(stale);
    assert.equal(staleResponse.status, 400);
    assert.equal((await responseBody(staleResponse)).reason, "signature_timestamp_outside_tolerance");
    assert.equal(writes.length, 0, "rejected request must not write to Firestore");

    const makeRequest = () => new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": signatureFor(payload, Math.floor(Date.now() / 1000)) },
      body: payload
    });
    const firstResponse = await POST(makeRequest());
    const firstBody = await responseBody(firstResponse);
    assert.equal(firstResponse.status, 200);
    assert.equal(firstBody.alreadyProcessed, false);

    const duplicateResponse = await POST(makeRequest());
    const duplicateBody = await responseBody(duplicateResponse);
    assert.equal(duplicateResponse.status, 200);
    assert.equal(duplicateBody.alreadyProcessed, true);
    assert.deepEqual(writes.map(({ ref }) => `${ref.collectionName}/${ref.id}`).sort(), [
      "billingSubscriptionEvents/evt_test_foxhub",
      "stripeWebhookEvents/evt_test_foxhub"
    ]);
    assert.ok(writes.every(({ value }) => !("payload" in value)), "event records must not retain the raw Stripe payload");
  } finally {
    db.collection = originalCollection;
    db.runTransaction = originalRunTransaction;
    if (previousSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
  }
});

test("member shell announces offline and reconnect states and clears network listeners", async () => {
  const shell = await fs.readFile(new URL("../src/FoxHubShell.jsx", import.meta.url), "utf8");
  assert.match(shell, /window\.navigator\.onLine/);
  assert.match(shell, /window\.addEventListener\("online", updateNetworkStatus\)/);
  assert.match(shell, /window\.addEventListener\("offline", updateNetworkStatus\)/);
  assert.match(shell, /window\.removeEventListener\("online", updateNetworkStatus\)/);
  assert.match(shell, /window\.removeEventListener\("offline", updateNetworkStatus\)/);
  assert.match(shell, /role="status" aria-live="polite"/);
  assert.match(shell, /Connection restored\. FoxHub is syncing again\./);
  assert.match(shell, /You’re offline\. FoxHub will reconnect when your connection returns\./);
});
