import { NextResponse } from "next/server";
import {
  assertSessionConfiguration,
  enforceTrustedOrigin,
  getAuthenticatedUser,
  SessionConfigurationError
} from "./auth";
import { isBookingManager } from "./booking-manager";

const maxJsonBodyBytes = 64 * 1024;

function noStoreInit(init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return { ...init, headers };
}

export function jsonOk(payload, init = {}) {
  return NextResponse.json(payload, noStoreInit(init));
}

export function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, noStoreInit({ status }));
}

export function sessionConfigurationResponse() {
  try {
    assertSessionConfiguration();
    return null;
  } catch (error) {
    if (error instanceof SessionConfigurationError) {
      console.error("Session authentication configuration error:", error.message);
      return jsonError("Account access is temporarily unavailable. Please try again later.", 503);
    }
    throw error;
  }
}

export async function parseJsonWithSchema(request, schema, parseWithSchema) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { error: jsonError("Expected application/json request body.", 415) };
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > maxJsonBodyBytes) {
    return { error: jsonError("Request body is too large.", 413) };
  }

  if (!request.body) {
    return { error: jsonError("Invalid JSON body.", 400) };
  }

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  let body;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxJsonBodyBytes) {
        await reader.cancel().catch(() => {});
        return { error: jsonError("Request body is too large.", 413) };
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return { error: jsonError("Invalid JSON body.", 400) };
  } finally {
    reader.releaseLock();
  }

  const parsed = parseWithSchema(schema, body);
  if (!parsed.ok) {
    return { error: jsonError(parsed.error, 400) };
  }

  return { data: parsed.data };
}

export async function requireAuthenticatedUser(request, message = "Please sign in first.") {
  let session;
  try {
    session = await getAuthenticatedUser(request);
  } catch (error) {
    if (error instanceof SessionConfigurationError) {
      console.error("Session authentication configuration error:", error.message);
      return { error: jsonError("Account access is temporarily unavailable. Please try again later.", 503) };
    }
    throw error;
  }

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
