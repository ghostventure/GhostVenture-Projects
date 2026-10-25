import {
  enforceMutationRequest,
  jsonOk,
  parseJsonWithSchema,
  requireAuthenticatedUser
} from "../../../lib/api-helpers";
import { createRequest, listRequests, markSquareBookingAttemptRequest } from "../../../lib/db";
import { enforceWriteRateLimit } from "../../../lib/rate-limit";
import { parseWithSchema, requestSchema } from "../../../lib/validation";
import { createSquareConsultationBooking } from "../../../lib/square-bookings-api";
import { parseSquareBookingWebhook } from "../../../lib/square-appointments";

export const runtime = "nodejs";

export async function POST(request) {
  const mutation = await enforceMutationRequest(request, (req) =>
    enforceWriteRateLimit(req, "orders")
  );
  if (mutation.error) {
    return mutation.error;
  }

  const auth = await requireAuthenticatedUser(request);
  if (auth.error) {
    return auth.error;
  }

  const parsed = await parseJsonWithSchema(request, requestSchema, parseWithSchema);
  if (parsed.error) {
    return parsed.error;
  }

  const { projectType, budget, timeline, consultationDate, consultationTime, startAt, bookingAttemptId, estimateAmountCents, depositAmountCents, details } =
    parsed.data;

  let squareBooking = null;
  let squareBookingAttempt = null;
  if (startAt) {
    try {
      squareBookingAttempt = await createSquareConsultationBooking({
        user: auth.session.user,
        startAt,
        bookingAttemptId,
        requestData: { projectType, budget, timeline, estimateAmountCents, depositAmountCents, details },
        customerNote: details
      });
      const booking = squareBookingAttempt.booking;
      squareBooking = parseSquareBookingWebhook({
        data: { object: { booking } },
        location_id: booking.location_id,
        created_at: booking.created_at
      });
      if (!squareBooking) throw new Error("Square did not return a valid appointment.");
    } catch (error) {
      if (error.code === "SQUARE_BOOKINGS_NOT_CONFIGURED") {
        return jsonError("Online appointment booking is temporarily unavailable. Please contact the studio.", 503);
      }
      if (error.code === "SQUARE_SLOT_UNAVAILABLE") {
        return jsonError(error.message, 409);
      }
      if (error.code === "SQUARE_BOOKING_ATTEMPT_CONFLICT") {
        return jsonError(error.message, 409);
      }
      console.error("Square appointment creation failed:", error.code || error.message);
      return jsonError("The appointment could not be booked. Please choose another time or try again.", 502);
    }
  }

  const requestValues = squareBookingAttempt?.requestData || {
    projectType, budget, timeline, estimateAmountCents, depositAmountCents, details
  };
  try {
    const requestId = await createRequest({
      userId: auth.session.user.id,
      projectType: requestValues.projectType,
      budget: requestValues.budget,
      timeline: requestValues.timeline,
      consultationDate: squareBooking?.consultationDate || "",
      consultationTime: squareBooking?.consultationTime || "",
      estimateAmountCents: requestValues.estimateAmountCents,
      depositAmountCents: requestValues.depositAmountCents,
      details: requestValues.details,
      squareBooking
    });
    if (squareBookingAttempt?.requestId && squareBookingAttempt.requestId !== requestId) {
      return jsonError("This booking is already linked to another request.", 409);
    }
    if (squareBookingAttempt?.attemptDocumentId) {
      const linked = await markSquareBookingAttemptRequest({
        userId: auth.session.user.id,
        attemptDocumentId: squareBookingAttempt.attemptDocumentId,
        requestId
      });
      if (!linked) return jsonError("The booking request could not be linked. Please retry the same submission.", 503);
    }
  } catch (error) {
    if (error.code === "SQUARE_BOOKING_OWNER_CONFLICT") return jsonError("That appointment could not be linked to this account.", 409);
    if (error.code === "SQUARE_BOOKING_REQUEST_CONFLICT") return jsonError("This booking is already linked to another request.", 409);
    if (!squareBookingAttempt) throw error;
    console.error("Request persistence failed after booking:", error.code || error.message);
    return jsonError("The appointment is held while the request is being saved. Retry this same submission to finish, or contact the studio if the problem continues.", 503);
  }

  return jsonOk({
    requests: await listRequests(auth.session.user.id)
  });
}
