import { enforceTrustedOrigin, getAuthenticatedUser } from "../../../lib/auth";
import { jsonError, jsonOk, sessionConfigurationResponse } from "../../../lib/api-helpers";
import { recordAnalyticsEvent } from "../../../lib/analytics";
import { enforceWriteRateLimit } from "../../../lib/rate-limit";

export const runtime = "nodejs";

const maxEventBodyBytes = 16 * 1024;

async function readEventPayload(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { error: jsonError("Expected application/json request body.", 415) };
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > maxEventBodyBytes) {
    return { error: jsonError("Event payload is too large.", 413) };
  }

  if (!request.body) {
    return { error: jsonError("Invalid event payload.", 400) };
  }

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxEventBodyBytes) {
        await reader.cancel().catch(() => {});
        return { error: jsonError("Event payload is too large.", 413) };
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { error: jsonError("Invalid event payload.", 400) };
    }
    return { payload };
  } catch {
    return { error: jsonError("Invalid event payload.", 400) };
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request) {
  const sessionConfiguration = sessionConfigurationResponse();
  if (sessionConfiguration) return sessionConfiguration;

  const untrusted = enforceTrustedOrigin(request);
  if (untrusted) {
    return untrusted;
  }

  const rateLimit = await enforceWriteRateLimit(request, "analytics-events");
  if (rateLimit) return rateLimit;

  const parsed = await readEventPayload(request);
  if (parsed.error) return parsed.error;

  const session = await getAuthenticatedUser(request);
  const eventId = await recordAnalyticsEvent({
    event: parsed.payload,
    user: session?.user || null,
    request
  });

  if (!eventId) {
    return jsonError("Unsupported event.", 400);
  }

  return jsonOk({ ok: true });
}
