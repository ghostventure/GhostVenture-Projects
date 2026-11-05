"use strict";

const crypto = require("crypto");
const { initializeApp } = require("firebase-admin/app");
const { FieldPath, FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const { HttpsError, onCall, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");

initializeApp();

const PRINTFUL_TOKEN = defineSecret("PRINTFUL_TOKEN");
const PRINTFUL_WEBHOOK_KEY = defineSecret("PRINTFUL_WEBHOOK_KEY");
const MANUAL_SYNC_KEY = defineSecret("MANUAL_SYNC_KEY");
const SQUARE_SANDBOX_ACCESS_TOKEN = defineSecret("SQUARE_SANDBOX_ACCESS_TOKEN");
const SQUARE_SANDBOX_APPLICATION_ID = defineSecret("SQUARE_SANDBOX_APPLICATION_ID");
const SQUARE_SANDBOX_LOCATION_ID = defineSecret("SQUARE_SANDBOX_LOCATION_ID");

const REGION = "us-east4";
const PROJECT_ID = "plugz-untd-gear";
const PRINTFUL_API = "https://api.printful.com";
const PRODUCT_EVENTS = new Set(["product_synced", "product_updated", "product_deleted"]);
const HEALTH_COLLECTION = "syncHealth";
const HEALTH_DOCUMENT = "printfulCatalog";
const AUDIT_COLLECTION = "auditLogs";
const SQUARE_SANDBOX_API = "https://connect.squareupsandbox.com/v2";

function safeEqual(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  // Secrets supplied through a CLI stdin pipe can retain a final newline.
  // Normalize that transport artifact without weakening the key comparison.
  expected = expected.trim();
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function requestKey(req, headerName) {
  const header = req.get(headerName);
  if (header) return header;
  const queryValue = req.query.key;
  return typeof queryValue === "string" ? queryValue : "";
}

function slugify(value, id) {
  const base = String(value || "plugz-product")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "plugz-product";
  return `${base}-${id}`;
}

function money(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

function normalizeProduct(detail, sourceUpdatedAt) {
  const syncProduct = detail.sync_product || detail;
  const variants = Array.isArray(detail.sync_variants) ? detail.sync_variants : [];
  const normalizedVariants = variants.map((variant) => {
    const files = Array.isArray(variant.files) ? variant.files : [];
    const preferredPreview = files.find((file) => file?.type === "preview")
      || files.find((file) => file?.type === "default")
      || files[0];
    return {
    id: variant.id ?? null,
    externalId: variant.external_id ?? null,
    catalogVariantId: variant.variant_id ?? null,
    name: variant.name || null,
    sku: variant.sku || null,
    retailPrice: money(variant.retail_price),
    size: variant.size || null,
    color: variant.color || null,
    availabilityStatus: variant.availability_status || null,
    synced: Boolean(variant.synced),
    previewUrl: variant.product_image || preferredPreview?.preview_url || preferredPreview?.thumbnail_url || null,
    };
  });
  const purchasable = normalizedVariants.filter((variant) => variant.synced && variant.availabilityStatus === "active");
  const prices = purchasable.map((variant) => variant.retailPrice).filter((price) => price !== null);
  const sizes = [...new Set(purchasable.map((variant) => variant.size).filter(Boolean))];
  const colors = [...new Set(purchasable.map((variant) => variant.color).filter(Boolean))];
  const thumbnail = syncProduct.thumbnail_url
    || syncProduct.thumbnail
    || purchasable.find((variant) => variant.previewUrl)?.previewUrl
    || normalizedVariants.find((variant) => variant.previewUrl)?.previewUrl
    || null;

  return {
    title: syncProduct.name || "Untitled Plugz product",
    slug: slugify(syncProduct.name, syncProduct.id),
    active: !syncProduct.is_ignored && purchasable.length > 0,
    archived: false,
    source: "printful",
    price: prices.length ? Math.min(...prices) : null,
    sizes,
    colors,
    images: thumbnail ? [thumbnail] : [],
    printful: {
      syncProductId: syncProduct.id,
      externalId: syncProduct.external_id || null,
      thumbnailUrl: thumbnail,
      isIgnored: Boolean(syncProduct.is_ignored),
      variants: normalizedVariants,
      sourceUpdatedAt,
    },
    syncedAt: FieldValue.serverTimestamp(),
  };
}

async function printfulFetch(path) {
  const response = await fetch(`${PRINTFUL_API}${path}`, {
    headers: { Authorization: `Bearer ${PRINTFUL_TOKEN.value()}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.code >= 400) {
    // Do not include a third-party response body in logs or Firestore. It can
    // contain customer or account information and is not needed to act on a failure.
    throw new Error(`printful_http_${response.status || "unknown"}`);
  }
  return body.result;
}

async function configurePrintfulWebhook() {
  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/printfulProductWebhook?key=${encodeURIComponent(PRINTFUL_WEBHOOK_KEY.value())}`;
  const response = await fetch(`${PRINTFUL_API}/webhooks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PRINTFUL_TOKEN.value()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, types: ["product_synced", "product_updated", "product_deleted"] }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.code >= 400) throw new Error(`printful_webhook_http_${response.status || "unknown"}`);
}

function failureCode(error) {
  const candidate = String(error?.message || "unknown_error").toLowerCase();
  // Only retain a short machine-safe code, never an upstream response body,
  // request URL, token, raw webhook, or customer information.
  return candidate.replace(/[^a-z0-9_:-]/g, "_").slice(0, 80) || "unknown_error";
}

async function reportSyncHealth({ source, status, synced = null, eventType = null, error = null }) {
  const db = getFirestore();
  const now = FieldValue.serverTimestamp();
  const current = db.collection(HEALTH_COLLECTION).doc(HEALTH_DOCUMENT);
  const event = current.collection("events").doc();
  const payload = {
    source,
    status,
    eventType,
    synced,
    errorCode: error ? failureCode(error) : null,
    recordedAt: now,
  };
  const currentPayload = {
    status,
    lastSource: source,
    lastEventType: eventType,
    lastSyncedCount: synced,
    updatedAt: now,
  };
  if (status === "healthy") {
    currentPayload.lastSuccessAt = now;
    currentPayload.lastFailureCode = null;
  } else {
    currentPayload.lastFailureAt = now;
    currentPayload.lastFailureCode = payload.errorCode;
  }

  try {
    await db.runTransaction(async (transaction) => {
      transaction.set(current, currentPayload, { merge: true });
      transaction.set(event, payload);
    });
  } catch (healthError) {
    // Catalog sync should not fail merely because observability is unavailable.
    logger.error("PLUGZ_SYNC_HEALTH_WRITE_FAILED", { source, errorCode: failureCode(healthError) });
  }
}

async function upsertProduct(productId, sourceUpdatedAt) {
  const detail = await printfulFetch(`/sync/products/${encodeURIComponent(productId)}`);
  const product = normalizeProduct(detail, sourceUpdatedAt);
  const ref = getFirestore().collection("products").doc(`printful_${product.printful.syncProductId}`);

  await getFirestore().runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    const existingTime = existing.exists ? existing.get("printful.sourceUpdatedAt") : 0;
    if (existingTime && existingTime > sourceUpdatedAt) return;
    transaction.set(ref, product, { merge: true });
  });
  return product.printful.syncProductId;
}

async function archiveProduct(productId, sourceUpdatedAt) {
  const ref = getFirestore().collection("products").doc(`printful_${productId}`);
  await getFirestore().runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    const existingTime = existing.exists ? existing.get("printful.sourceUpdatedAt") : 0;
    if (existingTime && existingTime > sourceUpdatedAt) return;
    transaction.set(ref, {
      active: false,
      archived: true,
      source: "printful",
      printful: { syncProductId: Number(productId), sourceUpdatedAt },
      syncedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

/**
 * Reconcile every currently synced Printful product without publishing, pricing,
 * or deleting anything in Printful. Products that no longer appear in this
 * endpoint are intentionally not archived: Printful can temporarily omit
 * products while an ecommerce integration is importing them.
 */
async function reconcileCatalog() {
  const ids = [];
  for (let offset = 0; ; offset += 100) {
    const page = await printfulFetch(`/sync/products?status=synced&limit=100&offset=${offset}`);
    const products = Array.isArray(page) ? page : [];
    ids.push(...products.map((product) => product.id).filter(Boolean));
    if (products.length < 100) break;
  }

  const sourceUpdatedAt = Math.floor(Date.now() / 1000);
  const results = await Promise.allSettled(ids.map((id) => upsertProduct(id, sourceUpdatedAt)));
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length) throw new Error(`${failed.length} of ${ids.length} products could not be synced`);
  return ids.length;
}

function getWebhookProductId(body) {
  return body?.data?.sync_product?.id ?? body?.data?.product_id ?? null;
}

async function requireOwner(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign-in required.");
  const profile = await getFirestore().collection("users").doc(request.auth.uid).get();
  if (profile.get("role") !== "owner") throw new HttpsError("permission-denied", "Owner access required.");
  return request.auth.uid;
}

function validProductId(value) {
  return typeof value === "string" && /^printful_\d+$/.test(value);
}

function validSavedPieceId(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9_-]{1,120}$/i.test(value);
}

// Public forms remain available without sign-in, so cap repeated submissions
// server-side. The key is a hash, never a raw email address, and Firestore
// rules do not expose these operational records to browsers.
async function enforceIntakeRateLimit({ email, uid, type }) {
  const day = new Date().toISOString().slice(0, 10);
  const identity = uid || email;
  const digest = crypto.createHash("sha256").update(`${type}:${identity}:${day}`).digest("hex");
  const ref = getFirestore().collection("intakeRateLimits").doc(digest);
  await getFirestore().runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    const count = existing.exists ? Number(existing.get("count") || 0) : 0;
    if (count >= 10) throw new HttpsError("resource-exhausted", "Too many requests today. Please try again tomorrow.");
    transaction.set(ref, { type, day, count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}

function signalCodeForUid(uid) {
  return `UNTD${crypto.createHash("sha256").update(uid).digest("hex").slice(0, 8).toUpperCase()}`;
}

function normalizeSignalCode(value) {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^UNTD[A-F0-9]{8}$/.test(code) ? code : null;
}

// Browser product controls never write Firestore directly. This server-side
// boundary authenticates the owner, validates a narrow command set, and stores
// a tamper-evident audit record alongside the catalog update.
exports.ownerProductAction = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: "256MiB",
}, async (request) => {
  const ownerUid = await requireOwner(request);
  const { productId, action, launchAt } = request.data || {};
  if (!validProductId(productId)) throw new HttpsError("invalid-argument", "Invalid product.");
  if (!["publish", "hide", "toggleFeature", "schedule"].includes(action)) {
    throw new HttpsError("invalid-argument", "Invalid operation.");
  }

  let launchAtTimestamp = null;
  if (action === "schedule") {
    if (!Number.isSafeInteger(launchAt)) throw new HttpsError("invalid-argument", "Invalid launch time.");
    const now = Date.now();
    if (launchAt < now - 5 * 60 * 1000 || launchAt > now + 366 * 24 * 60 * 60 * 1000) {
      throw new HttpsError("invalid-argument", "Launch time is outside the permitted range.");
    }
    launchAtTimestamp = Timestamp.fromMillis(launchAt);
  }

  const db = getFirestore();
  const productRef = db.collection("products").doc(productId);
  const auditRef = db.collection(AUDIT_COLLECTION).doc();
  await db.runTransaction(async (transaction) => {
    const product = await transaction.get(productRef);
    if (!product.exists) throw new HttpsError("not-found", "Product not found.");
    const current = product.data();
    const update = { updatedAt: FieldValue.serverTimestamp() };
    if (action === "publish") {
      if (!current.active) throw new HttpsError("failed-precondition", "This Printful product is not active.");
      update.approved = true;
      update.launchAt = Timestamp.now();
    } else if (action === "hide") {
      update.approved = false;
    } else if (action === "toggleFeature") {
      update.featured = !Boolean(current.featured);
    } else {
      update.approved = true;
      update.launchAt = launchAtTimestamp;
    }
    transaction.update(productRef, update);
    transaction.create(auditRef, {
      action,
      actorUid: ownerUid,
      productId,
      occurredAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});

// Creates the minimal customer profile after authenticated sign-in. Roles and
// profile metadata remain server-controlled; email verification is optional for
// customers and remains required for owner-only operations.
exports.initializeCustomerProfile = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: "256MiB",
}, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign-in required.");
  const email = typeof request.auth.token.email === "string" ? request.auth.token.email : null;
  const profileRef = getFirestore().collection("users").doc(request.auth.uid);
  const referralCode = signalCodeForUid(request.auth.uid);
  await getFirestore().runTransaction(async (transaction) => {
    const existing = await transaction.get(profileRef);
    if (existing.exists) {
      if (!existing.get("referralCode")) transaction.update(profileRef, { referralCode, updatedAt: FieldValue.serverTimestamp() });
      return;
    }
    transaction.create(profileRef, {
      role: "customer",
      email,
      referralCode,
      referralJoins: 0,
      accountActivatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true, referralCode };
});

// Customer-controlled presentation fields are written through this narrow
// callable boundary. Roles, order history, and launch access remain server-only.
exports.updateCustomerProfile = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: "256MiB",
}, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign-in required.");
  const clean = (value, max) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
  const displayName = clean(request.data?.displayName, 48);
  const city = clean(request.data?.city, 64);
  const favoriteSound = clean(request.data?.favoriteSound, 64);
  const bio = clean(request.data?.bio, 240);
  const socialHandle = clean(request.data?.socialHandle, 48).replace(/^@/, "");
  const preferredSize = clean(request.data?.preferredSize, 4).toUpperCase();
  const dropAlerts = request.data?.dropAlerts === true;
  const restockAlerts = request.data?.restockAlerts === true;
  const newsletterOptIn = request.data?.newsletterOptIn === true;
  const styleFocus = clean(request.data?.styleFocus, 20);
  const avatarPath = clean(request.data?.avatarPath, 180);
  const handle = clean(request.data?.handle, 28).toLowerCase().replace(/[^a-z0-9_.-]/g, "");
  if (handle && (handle.length < 3 || !/^[a-z0-9][a-z0-9_.-]*$/.test(handle))) throw new HttpsError("invalid-argument", "Use 3-28 letters, numbers, dots, dashes, or underscores for your handle.");
  if (socialHandle && !/^[a-zA-Z0-9_.-]{1,48}$/.test(socialHandle)) throw new HttpsError("invalid-argument", "Your social handle can use only letters, numbers, dots, dashes, and underscores.");
  if (preferredSize && !["XS", "S", "M", "L", "XL", "2XL", "3XL"].includes(preferredSize)) throw new HttpsError("invalid-argument", "Choose a valid preferred size.");
  if (styleFocus && !["Streetwear", "Music", "Skate", "Minimal", "Vintage", "Custom"].includes(styleFocus)) throw new HttpsError("invalid-argument", "Choose a valid style focus.");
  if (avatarPath && !avatarPath.startsWith(`profileAvatars/${request.auth.uid}/`)) throw new HttpsError("permission-denied", "Invalid avatar path.");
  const profileRef = getFirestore().collection("users").doc(request.auth.uid);
  const existing = await profileRef.get();
  const values = { displayName, handle, city, favoriteSound, bio, socialHandle, preferredSize, dropAlerts, restockAlerts, newsletterOptIn, styleFocus, avatarPath, updatedAt: FieldValue.serverTimestamp() };
  if (existing.exists) await profileRef.set(values, { merge: true });
  else await profileRef.set({ ...values, role: "customer", email: typeof request.auth.token.email === "string" ? request.auth.token.email : null, accountActivatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() });
  return { ok: true, profile: { displayName, handle, city, favoriteSound, bio, socialHandle, preferredSize, dropAlerts, restockAlerts, newsletterOptIn, styleFocus, avatarPath } };
});

// Saved pieces and delivery addresses are customer-owned account data. Keeping
// them behind a callable function prevents browser clients from modifying roles,
// orders, or any other profile fields. Addresses are optional and are not sent
// to a fulfillment provider until production checkout is intentionally enabled.
exports.updateCustomerAccountData = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: "256MiB",
}, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign-in required.");
  const clean = (value, max) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
  const savedPiecesInput = Array.isArray(request.data?.savedPieces) ? request.data.savedPieces : [];
  const savedPieces = [...new Set(savedPiecesInput.filter(validSavedPieceId))].slice(0, 80);
  const addressInput = Array.isArray(request.data?.addresses) ? request.data.addresses : [];
  if (addressInput.length > 5) throw new HttpsError("invalid-argument", "You can save up to five addresses.");
  const addresses = addressInput.map((entry, index) => {
    const label = clean(entry?.label, 30) || `Address ${index + 1}`;
    const recipient = clean(entry?.recipient, 80);
    const line1 = clean(entry?.line1, 100);
    const line2 = clean(entry?.line2, 100);
    const city = clean(entry?.city, 64);
    const region = clean(entry?.region, 64);
    const postalCode = clean(entry?.postalCode, 20);
    const country = clean(entry?.country, 2).toUpperCase() || "US";
    if (!recipient || !line1 || !city || !region || !postalCode || !/^[A-Z]{2}$/.test(country)) {
      throw new HttpsError("invalid-argument", "Each saved address needs a recipient, street, city, state or region, postal code, and two-letter country code.");
    }
    return { label, recipient, line1, line2: line2 || null, city, region, postalCode, country };
  });
  const db = getFirestore();
  const profileRef = db.collection("users").doc(request.auth.uid);
  const auditRef = db.collection(AUDIT_COLLECTION).doc();
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(profileRef);
    const update = { savedPieces, addresses, accountDataUpdatedAt: FieldValue.serverTimestamp() };
    if (existing.exists) transaction.set(profileRef, update, { merge: true });
    else transaction.create(profileRef, { ...update, role: "customer", email: typeof request.auth.token.email === "string" ? request.auth.token.email : null, referralCode: signalCodeForUid(request.auth.uid), referralJoins: 0, accountActivatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() });
    transaction.create(auditRef, { action: "customer_account_data_updated", actorUid: request.auth.uid, savedPieceCount: savedPieces.length, addressCount: addresses.length, occurredAt: FieldValue.serverTimestamp() });
  });
  return { ok: true, savedPieces, addresses };
});

// Account settings are saved as one authenticated transaction so profile,
// communication choices, and delivery addresses cannot partially diverge.
// This also avoids a separate callable round trip for each settings section.
exports.updateCustomerAccountSettings = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: "256MiB",
}, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign-in required.");
  const clean = (value, max) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
  const profileInput = request.data?.profile;
  const preferencesInput = request.data?.preferences;
  const addressInput = request.data?.addresses;
  if (!profileInput || typeof profileInput !== "object" || Array.isArray(profileInput) ||
      !preferencesInput || typeof preferencesInput !== "object" || Array.isArray(preferencesInput) ||
      !Array.isArray(addressInput)) {
    throw new HttpsError("invalid-argument", "Account settings are incomplete.");
  }
  const allowedProfileFields = new Set(["displayName", "handle", "city", "favoriteSound", "bio", "socialHandle", "preferredSize", "styleFocus"]);
  if (Object.keys(profileInput).some((key) => !allowedProfileFields.has(key)) ||
      Object.values(profileInput).some((value) => typeof value !== "string")) {
    throw new HttpsError("invalid-argument", "Unsupported profile setting.");
  }
  const profile = {
    displayName: clean(profileInput.displayName, 48),
    handle: clean(profileInput.handle, 28).toLowerCase().replace(/[^a-z0-9_.-]/g, ""),
    city: clean(profileInput.city, 64),
    favoriteSound: clean(profileInput.favoriteSound, 64),
    bio: clean(profileInput.bio, 240),
    socialHandle: clean(profileInput.socialHandle, 48).replace(/^@/, ""),
    preferredSize: clean(profileInput.preferredSize, 4).toUpperCase(),
    styleFocus: clean(profileInput.styleFocus, 20),
  };
  if (profile.handle && (profile.handle.length < 3 || !/^[a-z0-9][a-z0-9_.-]*$/.test(profile.handle))) {
    throw new HttpsError("invalid-argument", "Use 3-28 letters, numbers, dots, dashes, or underscores for your handle.");
  }
  if (profile.socialHandle && !/^[a-zA-Z0-9_.-]{1,48}$/.test(profile.socialHandle)) {
    throw new HttpsError("invalid-argument", "Your social handle can use only letters, numbers, dots, dashes, and underscores.");
  }
  if (profile.preferredSize && !["XS", "S", "M", "L", "XL", "2XL", "3XL"].includes(profile.preferredSize)) {
    throw new HttpsError("invalid-argument", "Choose a valid preferred size.");
  }
  if (profile.styleFocus && !["Streetwear", "Music", "Skate", "Minimal", "Vintage", "Custom"].includes(profile.styleFocus)) {
    throw new HttpsError("invalid-argument", "Choose a valid style focus.");
  }
  const preferenceKeys = new Set(["dropAlerts", "restockAlerts", "newsletterOptIn"]);
  if (Object.keys(preferencesInput).some((key) => !preferenceKeys.has(key)) ||
      [...preferenceKeys].some((key) => typeof preferencesInput[key] !== "boolean")) {
    throw new HttpsError("invalid-argument", "Choose valid communication preferences.");
  }
  const preferences = {
    dropAlerts: preferencesInput.dropAlerts,
    restockAlerts: preferencesInput.restockAlerts,
    newsletterOptIn: preferencesInput.newsletterOptIn,
  };
  if (addressInput.length > 5) throw new HttpsError("invalid-argument", "You can save up to five addresses.");
  const addresses = addressInput.map((entry, index) => {
    const label = clean(entry?.label, 30) || `Address ${index + 1}`;
    const recipient = clean(entry?.recipient, 80);
    const line1 = clean(entry?.line1, 100);
    const line2 = clean(entry?.line2, 100);
    const city = clean(entry?.city, 64);
    const region = clean(entry?.region, 64);
    const postalCode = clean(entry?.postalCode, 20);
    const country = clean(entry?.country, 2).toUpperCase() || "US";
    if (!recipient || !line1 || !city || !region || !postalCode || !/^[A-Z]{2}$/.test(country)) {
      throw new HttpsError("invalid-argument", "Each saved address needs a recipient, street, city, state or region, postal code, and two-letter country code.");
    }
    return { label, recipient, line1, line2: line2 || null, city, region, postalCode, country };
  });

  const db = getFirestore();
  const profileRef = db.collection("users").doc(request.auth.uid);
  const auditRef = db.collection(AUDIT_COLLECTION).doc();
  const updatedAt = FieldValue.serverTimestamp();
  const values = { ...profile, ...preferences, addresses, accountSettingsUpdatedAt: updatedAt };
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(profileRef);
    if (existing.exists) {
      transaction.set(profileRef, values, { merge: true });
    } else {
      transaction.create(profileRef, {
        ...values,
        role: "customer",
        email: typeof request.auth.token.email === "string" ? request.auth.token.email : null,
        referralCode: signalCodeForUid(request.auth.uid),
        referralJoins: 0,
        accountActivatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    transaction.create(auditRef, {
      action: "customer_account_settings_updated",
      actorUid: request.auth.uid,
      savedAddressCount: addresses.length,
      occurredAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true, profile, preferences, addresses };
});

// Pass the Signal is a customer-to-customer attribution loop. The browser never
// writes attribution itself: a verified account can claim one valid code once,
// cannot use its own code, and the immutable referral record is owner-visible.
exports.claimSignalInvite = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: "256MiB",
}, async (request) => {
  const customer = await requireVerifiedCustomer(request);
  const code = normalizeSignalCode(request.data?.code);
  if (!code) throw new HttpsError("invalid-argument", "This Signal link is invalid.");
  const db = getFirestore();
  const referrerQuery = await db.collection("users").where("referralCode", "==", code).limit(1).get();
  if (referrerQuery.empty) throw new HttpsError("not-found", "This Signal link is no longer available.");
  const referrerRef = referrerQuery.docs[0].ref;
  if (referrerRef.id === customer.uid) throw new HttpsError("failed-precondition", "You cannot claim your own Signal link.");
  const customerRef = db.collection("users").doc(customer.uid);
  const referralRef = db.collection("signalReferrals").doc(customer.uid);
  await db.runTransaction(async (transaction) => {
    const [customerProfile, referrerProfile, existingReferral] = await Promise.all([transaction.get(customerRef), transaction.get(referrerRef), transaction.get(referralRef)]);
    if (!customerProfile.exists) throw new HttpsError("failed-precondition", "Create your Plugz profile before claiming a Signal.");
    if (!referrerProfile.exists) throw new HttpsError("not-found", "This Signal link is no longer available.");
    if (customerProfile.get("referredByUid") || existingReferral.exists) throw new HttpsError("already-exists", "A Signal has already been claimed for this profile.");
    transaction.update(customerRef, { referredByUid: referrerRef.id, referredByCode: code, referredAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    transaction.update(referrerRef, { referralJoins: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    transaction.create(referralRef, { referrerUid: referrerRef.id, referredUid: customer.uid, code, status: "joined", rewardStatus: "early_access_pending", createdAt: FieldValue.serverTimestamp() });
  });
  return { ok: true, rewardStatus: "early_access_pending" };
});

// Public-facing forms write through this narrow server boundary instead of
// opening a browser write path to Firestore. Delivery integrations can consume
// these reviewed records later without changing the storefront forms.
exports.submitCommunityIntake = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: "256MiB",
}, async (request) => {
  const type = request.data?.type;
  const email = typeof request.data?.email === "string" ? request.data.email.trim().toLowerCase() : "";
  const name = typeof request.data?.name === "string" ? request.data.name.trim() : "";
  const message = typeof request.data?.message === "string" ? request.data.message.trim() : "";
  const handle = typeof request.data?.handle === "string" ? request.data.handle.trim() : "";
  const subject = typeof request.data?.subject === "string" ? request.data.subject.trim() : "";
  if (!["newsletter", "creator", "community", "support", "return", "privacy", "review"].includes(type)) throw new HttpsError("invalid-argument", "Invalid request type.");
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new HttpsError("invalid-argument", "Enter a valid email address.");
  if (name.length > 100 || handle.length > 120 || subject.length > 140 || message.length > 2000) throw new HttpsError("invalid-argument", "One or more fields are too long.");
  if (["creator", "community", "support", "return", "privacy", "review"].includes(type) && !message) throw new HttpsError("invalid-argument", "Add a short message before sending.");
  if (type === "creator" && (!name || !handle)) throw new HttpsError("invalid-argument", "Name and social handle are required.");
  await enforceIntakeRateLimit({ email, uid: request.auth?.uid || null, type });
  const db = getFirestore();
  const item = {
    type,
    email,
    name: name || null,
    handle: handle || null,
    subject: subject || null,
    message: message || null,
    customerUid: request.auth?.uid || null,
    status: "new",
    createdAt: FieldValue.serverTimestamp(),
  };
  if (type === "newsletter") {
    const digest = crypto.createHash("sha256").update(email).digest("hex");
    await db.collection("communityInbox").doc(`newsletter_${digest}`).set({ ...item, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  } else {
    await db.collection("communityInbox").add(item);
  }
  return { ok: true };
});

// Owners triage community requests through a callable boundary. Browser clients
// cannot alter inbox records or expose messages to other customers.
exports.ownerCommunityAction = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: "256MiB",
}, async (request) => {
  const ownerUid = await requireOwner(request);
  const intakeId = typeof request.data?.intakeId === "string" ? request.data.intakeId : "";
  const action = request.data?.action;
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(intakeId)) throw new HttpsError("invalid-argument", "Invalid workflow item.");
  const statusByAction = { review: "reviewing", resolve: "resolved", archive: "archived" };
  if (!statusByAction[action]) throw new HttpsError("invalid-argument", "Invalid workflow action.");
  const db = getFirestore();
  const intakeRef = db.collection("communityInbox").doc(intakeId);
  const auditRef = db.collection(AUDIT_COLLECTION).doc();
  await db.runTransaction(async (transaction) => {
    const intake = await transaction.get(intakeRef);
    if (!intake.exists) throw new HttpsError("not-found", "Workflow item not found.");
    transaction.update(intakeRef, { status: statusByAction[action], updatedAt: FieldValue.serverTimestamp(), updatedBy: ownerUid });
    transaction.create(auditRef, { action: `community_${action}`, actorUid: ownerUid, intakeId, occurredAt: FieldValue.serverTimestamp() });
  });
  return { ok: true, status: statusByAction[action] };
});

exports.ownerContentAction = onCall({ region: REGION, timeoutSeconds: 30, memory: "256MiB" }, async (request) => {
  const ownerUid = await requireOwner(request);
  const action = request.data?.action;
  const id = typeof request.data?.id === "string" ? request.data.id : "";
  if (action === "archive") {
    if (!/^[A-Za-z0-9_-]{1,180}$/.test(id)) throw new HttpsError("invalid-argument", "Invalid content item.");
    await getFirestore().collection("publicContent").doc(id).set({ published: false, archivedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: ownerUid }, { merge: true });
    return { ok: true };
  }
  if (action !== "publish") throw new HttpsError("invalid-argument", "Invalid content action.");
  const clean = (value, max) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
  const title = clean(request.data?.title, 110); const body = clean(request.data?.body, 700); const type = clean(request.data?.type, 32);
  if (!title || !body || !["story", "creator", "event", "release"].includes(type)) throw new HttpsError("invalid-argument", "Add a title, summary, and valid content type.");
  const ref = getFirestore().collection("publicContent").doc();
  await ref.set({ title, body, type, published: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), publishedBy: ownerUid });
  return { ok: true, id: ref.id };
});

async function requireVerifiedCustomer(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign-in required.");
  return { uid: request.auth.uid, email: typeof request.auth.token.email === "string" ? request.auth.token.email : null };
}

const CUSTOMER_ORDER_PAGE_SIZE = 20;

function decodeOrderCursor(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 256) {
    throw new HttpsError("invalid-argument", "Invalid order page cursor.");
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Number.isSafeInteger(parsed?.createdAt) || parsed.createdAt <= 0 ||
        typeof parsed.id !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(parsed.id)) {
      throw new Error("invalid_cursor");
    }
    return { createdAt: Timestamp.fromMillis(parsed.createdAt), id: parsed.id };
  } catch {
    throw new HttpsError("invalid-argument", "Invalid order page cursor.");
  }
}

function encodeOrderCursor(snapshot) {
  const createdAt = snapshot.get("createdAt");
  if (!createdAt || typeof createdAt.toMillis !== "function") return null;
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toMillis(), id: snapshot.id })).toString("base64url");
}

function customerOrderSummary(snapshot) {
  const order = snapshot.data();
  const trackingUrl = typeof order.trackingUrl === "string" && /^https:\/\//i.test(order.trackingUrl)
    ? order.trackingUrl.slice(0, 1000)
    : null;
  const items = Array.isArray(order.items) ? order.items.slice(0, 20).map((item) => ({
    title: typeof item?.title === "string" ? item.title.slice(0, 160) : "Plugz item",
    variant: typeof item?.variant === "string" ? item.variant.slice(0, 120) : null,
    quantity: Number.isSafeInteger(item?.quantity) && item.quantity > 0 ? item.quantity : 1,
  })) : [];
  const createdAt = order.createdAt;
  return {
    id: snapshot.id,
    status: typeof order.status === "string" ? order.status.slice(0, 40) : "recorded",
    environment: order.environment === "sandbox" ? "sandbox" : "production",
    amountCents: Number.isSafeInteger(order.amountCents) && order.amountCents >= 0 ? order.amountCents : null,
    currency: typeof order.currency === "string" ? order.currency.slice(0, 3).toUpperCase() : "USD",
    createdAt: createdAt && typeof createdAt.toMillis === "function" ? createdAt.toMillis() : null,
    fulfillmentStatus: typeof order.fulfillmentStatus === "string" ? order.fulfillmentStatus.slice(0, 60) : null,
    estimatedDelivery: typeof order.estimatedDelivery === "string" ? order.estimatedDelivery.slice(0, 80) : null,
    trackingUrl,
    items,
  };
}

// The customer dashboard loads orders in small pages instead of opening a
// real-time listener over a customer's entire order history. The callable
// scopes every query to the signed-in UID and returns only display-safe fields.
exports.getCustomerOrderPage = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: "256MiB",
}, async (request) => {
  const customer = await requireVerifiedCustomer(request);
  const cursor = decodeOrderCursor(request.data?.cursor);
  let query = getFirestore().collection("orders")
    .where("customerUid", "==", customer.uid)
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc");
  if (cursor) query = query.startAfter(cursor.createdAt, cursor.id);
  const snapshot = await query.limit(CUSTOMER_ORDER_PAGE_SIZE + 1).get();
  const hasMore = snapshot.docs.length > CUSTOMER_ORDER_PAGE_SIZE;
  const page = snapshot.docs.slice(0, CUSTOMER_ORDER_PAGE_SIZE);
  return {
    orders: page.map(customerOrderSummary),
    hasMore,
    nextCursor: hasMore && page.length ? encodeOrderCursor(page[page.length - 1]) : null,
  };
});

function orderLineItems(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new HttpsError("invalid-argument", "Your bag is invalid.");
  }
  const quantities = new Map();
  for (const line of value) {
    const variantId = typeof line?.variantId === "string" || typeof line?.variantId === "number" ? String(line.variantId) : "";
    if (!validProductId(line?.productId) || !/^\d+$/.test(variantId) || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10) {
      throw new HttpsError("invalid-argument", "Choose an available product variant before checkout.");
    }
    const key = `${line.productId}:${variantId}`;
    quantities.set(key, { productId: line.productId, variantId, quantity: (quantities.get(key)?.quantity || 0) + line.quantity });
  }
  if ([...quantities.values()].some((line) => line.quantity > 10)) throw new HttpsError("invalid-argument", "Quantity limit exceeded.");
  return [...quantities.values()];
}

exports.getSquareSandboxCheckoutConfig = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: "256MiB",
  secrets: [SQUARE_SANDBOX_APPLICATION_ID, SQUARE_SANDBOX_LOCATION_ID],
}, async (request) => {
  await requireVerifiedCustomer(request);
  return {
    applicationId: SQUARE_SANDBOX_APPLICATION_ID.value().trim(),
    locationId: SQUARE_SANDBOX_LOCATION_ID.value().trim(),
    environment: "sandbox",
  };
});

// Creates a Sandbox-only payment. Prices and products are always reloaded from
// Firestore, never trusted from the browser bag. Production checkout must use
// separate credentials, a webhook, fulfillment checks, and a real launch review.
exports.createSquareSandboxPayment = onCall({
  region: REGION,
  timeoutSeconds: 60,
  memory: "512MiB",
  secrets: [SQUARE_SANDBOX_ACCESS_TOKEN, SQUARE_SANDBOX_LOCATION_ID],
}, async (request) => {
  const customer = await requireVerifiedCustomer(request);
  const sourceId = request.data?.sourceId;
  const idempotencyKey = request.data?.idempotencyKey;
  if (typeof sourceId !== "string" || sourceId.length < 10 || sourceId.length > 512 || typeof idempotencyKey !== "string" || !/^[a-zA-Z0-9-]{16,128}$/.test(idempotencyKey)) {
    throw new HttpsError("invalid-argument", "Invalid payment request.");
  }
  const requestedLines = orderLineItems(request.data?.items);
  const db = getFirestore();
  const productSnapshots = await Promise.all(requestedLines.map(({ productId }) => db.collection("products").doc(productId).get()));
  const now = Timestamp.now();
  const items = [];
  let amountCents = 0;
  for (let index = 0; index < productSnapshots.length; index += 1) {
    const product = productSnapshots[index];
    const { quantity, productId, variantId } = requestedLines[index];
    const data = product.data();
    if (!product.exists || !data.active || !data.approved || !data.launchAt?.toMillis || data.launchAt.toMillis() > now.toMillis()) {
      throw new HttpsError("failed-precondition", "A product in your bag is no longer available.");
    }
    const variant = (data.printful?.variants || []).find((candidate) => String(candidate?.id) === variantId && candidate?.synced === true && candidate?.availabilityStatus === "active");
    if (!variant) throw new HttpsError("failed-precondition", "Your selected product variant is no longer available.");
    const unitCents = Math.round(Number(variant.retailPrice) * 100);
    if (!Number.isSafeInteger(unitCents) || unitCents < 50) throw new HttpsError("failed-precondition", "A product price is unavailable.");
    amountCents += unitCents * quantity;
    items.push({ productId, printfulVariantId: variantId, title: String(data.title || "Plugz product").slice(0, 160), variant: [variant.color, variant.size, variant.name].filter(Boolean).join(" / ") || null, quantity, unitCents });
  }
  if (amountCents < 50 || amountCents > 500000) throw new HttpsError("invalid-argument", "Order total is outside the Sandbox limit.");

  const response = await fetch(`${SQUARE_SANDBOX_API}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SQUARE_SANDBOX_ACCESS_TOKEN.value().trim()}`,
      "Content-Type": "application/json",
      "Square-Version": "2026-07-15",
    },
    body: JSON.stringify({
      source_id: sourceId,
      idempotency_key: idempotencyKey,
      amount_money: { amount: amountCents, currency: "USD" },
      location_id: SQUARE_SANDBOX_LOCATION_ID.value().trim(),
      buyer_email_address: customer.email,
      reference_id: `plugz_sandbox_${customer.uid.slice(0, 12)}_${idempotencyKey.slice(0, 12)}`,
      note: "Plugz Sandbox checkout",
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.payment?.id) {
    logger.warn("Square Sandbox payment rejected", { status: response.status });
    throw new HttpsError("failed-precondition", "Sandbox payment was not approved. Check the test card and try again.");
  }
  const payment = body.payment;
  await db.collection("orders").doc(payment.id).set({
    customerUid: customer.uid,
    customerEmail: customer.email,
    environment: "sandbox",
    provider: "square",
    squarePaymentId: payment.id,
    status: payment.status || "COMPLETED",
    amountCents,
    currency: "USD",
    items,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: false });
  return { ok: true, orderId: payment.id, status: payment.status || "COMPLETED", amountCents };
});

exports.printfulProductWebhook = onRequest({
  region: REGION,
  invoker: "public",
  timeoutSeconds: 60,
  memory: "256MiB",
  secrets: [PRINTFUL_TOKEN, PRINTFUL_WEBHOOK_KEY],
}, async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
  if (!safeEqual(requestKey(req, "x-plugz-webhook-key"), PRINTFUL_WEBHOOK_KEY.value())) {
    logger.warn("Rejected Printful webhook with invalid key");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const event = req.body?.type;
  if (!PRODUCT_EVENTS.has(event)) return res.status(204).send();
  const productId = getWebhookProductId(req.body);
  if (!productId) return res.status(400).json({ error: "Missing Printful product ID" });
  const sourceUpdatedAt = Number(req.body.created) || Math.floor(Date.now() / 1000);

  try {
    if (event === "product_deleted") {
      await archiveProduct(productId, sourceUpdatedAt);
    } else {
      await upsertProduct(productId, sourceUpdatedAt);
    }
    await reportSyncHealth({ source: "webhook", status: "healthy", synced: 1, eventType: event });
    return res.status(200).json({ ok: true });
  } catch (error) {
    await reportSyncHealth({ source: "webhook", status: "error", eventType: event, error });
    logger.error("PLUGZ_SYNC_ALERT webhook_failure", { event, errorCode: failureCode(error) });
    return res.status(500).json({ error: "Catalog sync failed" });
  }
});

exports.syncPrintfulCatalog = onRequest({
  region: REGION,
  invoker: "public",
  timeoutSeconds: 540,
  memory: "512MiB",
  secrets: [PRINTFUL_TOKEN, MANUAL_SYNC_KEY, PRINTFUL_WEBHOOK_KEY],
}, async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
  if (!safeEqual(requestKey(req, "x-plugz-sync-key"), MANUAL_SYNC_KEY.value())) {
    logger.warn("Rejected manual catalog sync with invalid key");
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (req.query.configureWebhook === "true") await configurePrintfulWebhook();
    const synced = await reconcileCatalog();
    await reportSyncHealth({ source: "manual", status: "healthy", synced });
    return res.status(200).json({ ok: true, synced });
  } catch (error) {
    await reportSyncHealth({ source: "manual", status: "error", error });
    logger.error("PLUGZ_SYNC_ALERT manual_sync_failure", { errorCode: failureCode(error) });
    return res.status(500).json({ error: "Catalog sync failed" });
  }
});

// Owner-only catalog refresh for the control room. This keeps third-party
// credentials server-side while allowing an operator to reconcile a newly
// published Printful product without waiting for a webhook or daily run.
exports.refreshPrintfulCatalog = onCall({
  region: REGION,
  timeoutSeconds: 540,
  memory: "512MiB",
  secrets: [PRINTFUL_TOKEN],
}, async (request) => {
  await requireOwner(request);
  try {
    const synced = await reconcileCatalog();
    await reportSyncHealth({ source: "owner_refresh", status: "healthy", synced });
    return { ok: true, synced };
  } catch (error) {
    await reportSyncHealth({ source: "owner_refresh", status: "error", error });
    logger.error("PLUGZ_SYNC_ALERT owner_refresh_failure", { errorCode: failureCode(error) });
    throw new HttpsError("internal", "Catalog refresh failed.");
  }
});

// A 15-minute reconciliation catches missed or delayed Printful webhook deliveries.
// The storefront's Firestore listener receives these image and catalog updates
// automatically; this job is intentionally read-only toward Printful.
exports.reconcilePrintfulCatalogDaily = onSchedule({
  region: REGION,
  schedule: "*/15 * * * *",
  timeZone: "America/New_York",
  retryCount: 3,
  timeoutSeconds: 540,
  memory: "512MiB",
  maxInstances: 1,
  secrets: [PRINTFUL_TOKEN],
}, async () => {
  try {
    const synced = await reconcileCatalog();
    await reportSyncHealth({ source: "scheduled", status: "healthy", synced });
    logger.info("Printful catalog reconciliation completed", { synced });
  } catch (error) {
    await reportSyncHealth({ source: "scheduled", status: "error", error });
    logger.error("PLUGZ_SYNC_ALERT scheduled_sync_failure", { errorCode: failureCode(error) });
    throw error;
  }
});
