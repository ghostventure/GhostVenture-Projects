import { NextResponse } from "next/server";
import { enforceTrustedOrigin, getAuthenticatedUser } from "./auth";
import { isBookingManager } from "./booking-manager";

export function jsonOk(payload, init = {}) {
  return NextResponse.json(payload, init);
}

export function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function parseJsonWithSchema(request, schema, parseWithSchema) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { error: jsonError("Invalid JSON body.", 400) };
  }

  const parsed = parseWithSchema(schema, body);
  if (!parsed.ok) {
    return { error: jsonError(parsed.error, 400) };
  }

  return { data: parsed.data };
}

export async function requireAuthenticatedUser(request, message = "Please sign in first.") {
  const session = await getAuthenticatedUser(request);
  if (!session) {
    return { error: jsonError(message, 401) };
  }

  return { session };
}

export async function requireBookingManager(request) {
  const auth = await requireAuthenticatedUser(request);
  if (auth.error) {
    return auth;
  }

  if (!isBookingManager(auth.session.user)) {
    return { error: jsonError("Manager access required.", 403) };
  }

  return auth;
}

export async function enforceMutationRequest(request, rateLimit) {
  const untrusted = enforceTrustedOrigin(request);
  if (untrusted) {
    return { error: untrusted };
  }

  if (rateLimit) {
    const limited = await rateLimit(request);
    if (limited) {
      return { error: limited };
    }
  }

  return { ok: true };
}
