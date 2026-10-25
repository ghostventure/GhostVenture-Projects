import { jsonError, jsonOk } from "../../../../../lib/api-helpers";
import { recordSquarePaymentEvent, recordSquareRefundEvent } from "../../../../../lib/db";
import { verifySquareWebhookSignature } from "../../../../../lib/square-appointments";

export const runtime = "nodejs";

const paymentEvents = new Set(["payment.created", "payment.updated"]);
const refundEvents = new Set(["refund.created", "refund.updated"]);
const maxBodyBytes = 256 * 1024;

async function readBody(request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > maxBodyBytes) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBodyBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request) {
  const rawBody = await readBody(request);
  if (rawBody === null) return jsonError("Invalid or oversized Square webhook payload.", 413);
  if (!verifySquareWebhookSignature({ request, rawBody }).ok) return jsonError("Invalid Square webhook signature.", 401);

  let payload;
  try { payload = JSON.parse(rawBody); } catch { return jsonError("Invalid Square webhook payload.", 400); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return jsonError("Invalid Square webhook payload.", 400);
  if (!paymentEvents.has(payload.type) && !refundEvents.has(payload.type)) return jsonOk({ ok: true, ignored: true });

  const isRefund = refundEvents.has(payload.type);
  const payment = payload?.data?.object?.payment;
  const refund = payload?.data?.object?.refund;
  const resource = isRefund ? refund : payment;
  const expectedLocationId = String(process.env.SQUARE_LOCATION_ID || "").trim();
  if (!expectedLocationId && process.env.NODE_ENV === "production") return jsonError("Square webhook location is not configured.", 500);
  if (expectedLocationId && resource?.location_id !== expectedLocationId) return jsonOk({ ok: true, ignored: true, reason: "location_mismatch" });
  if (!payload.event_id || !resource?.id) return jsonError("Square payment or refund event is missing its event or resource id.", 400);

  const result = isRefund
    ? await recordSquareRefundEvent({ eventId: payload.event_id, refund, eventCreatedAt: payload.created_at })
    : await recordSquarePaymentEvent({ eventId: payload.event_id, payment });
  if (result.reason === "request_not_found") return jsonOk({ ok: true, ignored: true, reason: result.reason });
  return jsonOk({ ok: true, ...result });
}
