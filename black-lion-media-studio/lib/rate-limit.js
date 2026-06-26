import { RateLimiterMemory } from "rate-limiter-flexible";
import { NextResponse } from "next/server";

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

export async function enforceAuthRateLimit(request) {
  try {
    await authLimiter.consume(getClientKey(request));
    return null;
  } catch {
    return NextResponse.json(
      { error: "Too many authentication attempts. Please wait a minute and try again." },
      { status: 429 }
    );
  }
}

export async function enforceWriteRateLimit(request, suffix = "write") {
  try {
    await writeLimiter.consume(`${getClientKey(request)}:${suffix}`);
    return null;
  } catch {
    return NextResponse.json(
      { error: "Too many requests right now. Please wait a moment and try again." },
      { status: 429 }
    );
  }
}
