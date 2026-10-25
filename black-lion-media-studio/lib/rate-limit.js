import { RateLimiterMemory } from "rate-limiter-flexible";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getDb } from "./firebase-admin";

const authLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60
});

const writeLimiter = new RateLimiterMemory({
  points: 20,
  duration: 60
});


function getClientKey(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  return realIp || "unknown";
}

function rateLimitedResponse(error, message) {
  const msBeforeNext = Number(error?.msBeforeNext);
  const retryAfterSeconds = Number.isFinite(msBeforeNext) && msBeforeNext > 0
    ? Math.ceil(msBeforeNext / 1000)
    : 60;

  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfterSeconds)
      }
    }
  );
}

export async function enforceAuthRateLimit(request) {
  try {
    await authLimiter.consume(getClientKey(request));
    return null;
  } catch (error) {
    return rateLimitedResponse(error, "Too many authentication attempts. Please wait a minute and try again.");
  }
}

export async function enforceRecoveryEmailRateLimit(email) {
  const key = crypto.createHash("sha256").update(String(email || "").trim().toLowerCase()).digest("hex");
  const db = getDb();
  const ref = db.collection("account_recovery_rate_limits").doc(key);
  const now = Date.now();
  const limited = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const previous = snapshot.exists ? snapshot.data() : {};
    const windowStart = Number(previous.window_start_ms || 0);
    const count = windowStart > now - 60 * 60 * 1000 ? Number(previous.count || 0) : 0;
    if (count >= 3) return true;
    transaction.set(ref, { window_start_ms: count ? windowStart : now, count: count + 1 });
    return false;
  });
  return limited;
}

export async function enforceWriteRateLimit(request, suffix = "write") {
  try {
    await writeLimiter.consume(`${getClientKey(request)}:${suffix}`);
    return null;
  } catch (error) {
    return rateLimitedResponse(error, "Too many requests right now. Please wait a moment and try again.");
  }
}
