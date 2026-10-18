import crypto from "node:crypto";
import { getDb } from "./firebase-admin";

const ANALYTICS_EVENTS = "analytics_events";
const allowedEventNames = new Set([
  "page_view",
  "cta_click",
  "signup_success",
  "login_success",
  "request_submitted",
  "message_sent",
  "profile_updated",
  "onboarding_step_click",
  "invoice_link_click",
  "logout"
]);

function isoNow() {
  return new Date().toISOString();
}

function timestampNow() {
  return Date.now();
}

function cleanText(value, max = 180) {
  return String(value || "").trim().slice(0, max);
}

function cleanMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata)
      .map(([key, value]) => [cleanText(key, 60), cleanText(value, 240)])
      .filter(([key, value]) => key && value)
      .slice(0, 12)
  );
}

function hashValue(value) {
  const source = cleanText(value, 400);
  if (!source) {
    return "";
  }

  return crypto.createHash("sha256").update(source).digest("hex").slice(0, 24);
}

export function sanitizeAnalyticsEvent(payload = {}) {
  const eventName = cleanText(payload.eventName || payload.name, 80);
  if (!allowedEventNames.has(eventName)) {
    return null;
  }

  return {
    event_name: eventName,
    path: cleanText(payload.path, 240),
    source: cleanText(payload.source, 120),
    referrer_path: cleanText(payload.referrerPath, 240),
    metadata: cleanMetadata(payload.metadata)
  };
}

export async function recordAnalyticsEvent({ event, user = null, request = null } = {}) {
  const cleanEvent = sanitizeAnalyticsEvent(event);
  if (!cleanEvent) {
    return null;
  }

  const userAgent = request?.headers?.get?.("user-agent") || "";
  const referrer = request?.headers?.get?.("referer") || "";
  const record = {
    ...cleanEvent,
    user_id: user?.id || "",
    user_role: user?.isBookingManager ? "manager" : user?.id ? "client" : "visitor",
    user_agent_hash: hashValue(userAgent),
    referrer_hash: hashValue(referrer),
    created_at: isoNow(),
    created_at_ms: timestampNow()
  };

  const db = getDb();
  const docRef = await db.collection(ANALYTICS_EVENTS).add(record);
  return docRef.id;
}
