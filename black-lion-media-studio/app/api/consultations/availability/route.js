import { jsonError, jsonOk, requireAuthenticatedUser } from "../../../../lib/api-helpers";
import { getOwnedSquareBookingRequest } from "../../../../lib/db";
import { searchSquareConsultationAvailability } from "../../../../lib/square-bookings-api";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = await requireAuthenticatedUser(request);
  if (auth.error) return auth.error;
  const query = new URL(request.url).searchParams;
  const startAt = query.get("startAt") || "";
  const endAt = query.get("endAt") || "";
  const requestId = query.get("requestId") || "";
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 24 * 60 * 60 * 1000 || end - start > 31 * 24 * 60 * 60 * 1000) {
    return jsonError("Provide a valid availability date range between 1 and 31 days.", 400);
  }
  let bookingId = "";
  if (requestId) {
    const ownedBooking = await getOwnedSquareBookingRequest(requestId, auth.session.user.id);
    if (!ownedBooking) return jsonError("That appointment is not available in this account.", 404);
    if (["CANCELLED", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_SELLER", "CANCELED", "DECLINED", "DECLINED_BY_SELLER"].includes(ownedBooking.squareBookingStatus)) {
      return jsonError("This appointment has already been cancelled.", 409);
    }
    bookingId = ownedBooking.squareBookingId;
  }
  try {
    return jsonOk({ availability: await searchSquareConsultationAvailability(
      new Date(start).toISOString(), new Date(end).toISOString(), { bookingId }
    ) });
  } catch (error) {
    if (error.code === "SQUARE_BOOKINGS_NOT_CONFIGURED") return jsonError("Online appointment booking is temporarily unavailable.", 503);
    console.error("Square availability search failed:", error.code || error.message);
    return jsonError("Appointment availability could not be loaded. Please try again.", 502);
  }
}
