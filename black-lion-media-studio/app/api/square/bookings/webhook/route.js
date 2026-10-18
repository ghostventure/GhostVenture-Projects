import { jsonError, jsonOk } from "../../../../../lib/api-helpers";
import { upsertSquareAppointmentRequest } from "../../../../../lib/db";
import {
  parseSquareBookingWebhook,
  verifySquareWebhookSignature
} from "../../../../../lib/square-appointments";

export const runtime = "nodejs";

const supportedEvents = new Set(["booking.created", "booking.updated"]);
const maxWebhookBodyBytes = 256 * 1024;

async function readWebhookBody(request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > maxWebhookBodyBytes) {
    return { error: jsonError("Square webhook payload is too large.", 413) };
  }

  if (!request.body) {
    return { error: jsonError("Invalid Square webhook payload.", 400) };
  }

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxWebhookBodyBytes) {
        await reader.cancel().catch(() => {});
        return { error: jsonError("Square webhook payload is too large.", 413) };
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { rawBody: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { error: jsonError("Invalid Square webhook payload.", 400) };
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request) {
  const body = await readWebhookBody(request);
  if (body.error) return body.error;
  const rawBody = body.rawBody;
  const signature = verifySquareWebhookSignature({ request, rawBody });
  if (!signature.ok) {
    return jsonError("Invalid Square webhook signature.", 401);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonError("Invalid Square webhook payload.", 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonError("Invalid Square webhook payload.", 400);
  }

  if (!supportedEvents.has(payload.type)) {
    return jsonOk({ ok: true, ignored: true });
  }

  const appointment = parseSquareBookingWebhook(payload);
  if (!appointment) {
    return jsonOk({ ok: true, ignored: true });
  }

  const expectedLocationId = String(process.env.SQUARE_LOCATION_ID || "").trim();
  if (!expectedLocationId && process.env.NODE_ENV === "production") {
    return jsonError("Square webhook location is not configured.", 500);
  }

  if (expectedLocationId && appointment.squareLocationId !== expectedLocationId) {
    return jsonOk({ ok: true, ignored: true, reason: "location_mismatch" });
  }

  const requestId = await upsertSquareAppointmentRequest(appointment);
  return jsonOk({ ok: true, requestId });
}
