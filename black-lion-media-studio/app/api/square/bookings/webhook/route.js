import { jsonError, jsonOk } from "../../../../../lib/api-helpers";
import { upsertSquareAppointmentRequest } from "../../../../../lib/db";
import {
  parseSquareBookingWebhook,
  verifySquareWebhookSignature
} from "../../../../../lib/square-appointments";

export const runtime = "nodejs";

const supportedEvents = new Set(["booking.created", "booking.updated"]);

export async function POST(request) {
  const rawBody = await request.text();
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
