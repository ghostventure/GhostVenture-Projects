import { z } from "zod";
import {
  enforceMutationRequest,
  jsonError,
  jsonOk,
  parseJsonWithSchema,
  requireAuthenticatedUser
} from "../../../../lib/api-helpers";
import { getOwnedSquareBookingRequest, upsertSquareAppointmentRequest } from "../../../../lib/db";
import { enforceWriteRateLimit } from "../../../../lib/rate-limit";
import { parseSquareBookingWebhook } from "../../../../lib/square-appointments";
import { cancelSquareBooking, rescheduleSquareBooking } from "../../../../lib/square-bookings-api";
import { parseWithSchema } from "../../../../lib/validation";

export const runtime = "nodejs";

const rescheduleSchema = z.object({
  requestId: z.string().trim().min(1).max(180),
  startAt: z.string().max(40).refine((value) => Number.isFinite(Date.parse(value)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value), "Choose a valid appointment time.")
});
const cancelSchema = z.object({ requestId: z.string().trim().min(1).max(180) });

function mapBookingToAppointment(booking) {
  return parseSquareBookingWebhook({
    data: { object: { booking } },
    location_id: booking.location_id,
    created_at: booking.created_at
  });
}

async function getOwnedBooking(request, requestId) {
  const auth = await requireAuthenticatedUser(request);
  if (auth.error) return { error: auth.error };
  const record = await getOwnedSquareBookingRequest(requestId, auth.session.user.id);
  if (!record) return { error: jsonError("That appointment is not available in this account.", 404) };
  if (["Cancelled", "CANCELLED", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_SELLER"].includes(record.squareBookingStatus)) {
    return { error: jsonError("This appointment has already been cancelled.", 409) };
  }
  return { auth, record };
}

export async function PATCH(request) {
  const mutation = await enforceMutationRequest(request, (req) => enforceWriteRateLimit(req, "consultation-reschedule"));
  if (mutation.error) return mutation.error;
  const parsed = await parseJsonWithSchema(request, rescheduleSchema, parseWithSchema);
  if (parsed.error) return parsed.error;
  const owned = await getOwnedBooking(request, parsed.data.requestId);
  if (owned.error) return owned.error;
  try {
    const booking = await rescheduleSquareBooking(owned.record.squareBookingId, parsed.data.startAt);
    const appointment = mapBookingToAppointment(booking);
    if (!appointment) return jsonError("Square returned an invalid appointment update.", 502);
    await upsertSquareAppointmentRequest(appointment, owned.auth.session.user.id);
    return jsonOk({ ok: true, requestId: owned.record.id, appointment: {
      startAt: booking.start_at,
      status: booking.status,
      bookingId: booking.id
    } });
  } catch (error) {
    if (error.code === "SQUARE_SLOT_UNAVAILABLE") return jsonError(error.message, 409);
    if (error.code === "SQUARE_BOOKINGS_NOT_CONFIGURED") return jsonError("Online appointment management is temporarily unavailable.", 503);
    console.error("Square appointment reschedule failed:", error.code || error.message);
    return jsonError("The appointment could not be rescheduled. Please try again.", 502);
  }
}

export async function DELETE(request) {
  const mutation = await enforceMutationRequest(request, (req) => enforceWriteRateLimit(req, "consultation-cancel"));
  if (mutation.error) return mutation.error;
  const parsed = await parseJsonWithSchema(request, cancelSchema, parseWithSchema);
  if (parsed.error) return parsed.error;
  const owned = await getOwnedBooking(request, parsed.data.requestId);
  if (owned.error) return owned.error;
  try {
    const booking = await cancelSquareBooking(owned.record.squareBookingId);
    const appointment = mapBookingToAppointment(booking);
    if (!appointment) return jsonError("Square returned an invalid cancellation update.", 502);
    await upsertSquareAppointmentRequest(appointment, owned.auth.session.user.id);
    return jsonOk({ ok: true, requestId: owned.record.id, status: booking.status });
  } catch (error) {
    if (error.code === "SQUARE_BOOKINGS_NOT_CONFIGURED") return jsonError("Online appointment management is temporarily unavailable.", 503);
    console.error("Square appointment cancellation failed:", error.code || error.message);
    return jsonError("The appointment could not be cancelled. Please try again.", 502);
  }
}
