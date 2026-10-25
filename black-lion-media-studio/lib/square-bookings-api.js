import crypto from "node:crypto";
import {
  getOrCreateSquareBookingAttempt,
  getSquareBookingAttempt,
  markSquareBookingAttemptCreated
} from "./db";

const productionBaseUrl = "https://connect.squareup.com";
const sandboxBaseUrl = "https://connect.squareupsandbox.com";
const squareApiVersion = process.env.SQUARE_API_VERSION || "2026-01-22";

function config() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const serviceVariationId = process.env.SQUARE_CONSULTATION_SERVICE_VARIATION_ID;
  if (!accessToken || !locationId || !serviceVariationId) {
    const error = new Error("Square consultation booking is not configured.");
    error.code = "SQUARE_BOOKINGS_NOT_CONFIGURED";
    throw error;
  }
  return {
    accessToken, locationId, serviceVariationId,
    baseUrl: String(process.env.SQUARE_ENVIRONMENT || "production").toLowerCase() === "sandbox"
      ? sandboxBaseUrl : productionBaseUrl
  };
}

async function squareRequest(path, { method = "POST", body } = {}) {
  const cfg = config();
  const response = await fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": squareApiVersion
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.errors?.map((item) => item.detail || item.code).filter(Boolean).join(" ") || "Square booking request failed.");
    error.code = data?.errors?.[0]?.code || "SQUARE_BOOKING_ERROR";
    error.status = response.status;
    throw error;
  }
  return data;
}

function safeAvailability(item) {
  return {
    startAt: item.start_at,
    locationId: item.location_id,
    appointmentSegments: (item.appointment_segments || []).map((segment) => ({
      durationMinutes: segment.duration_minutes,
      serviceVariationId: segment.service_variation_id,
      serviceVariationVersion: segment.service_variation_version,
      teamMemberId: segment.team_member_id
    }))
  };
}

export async function searchSquareConsultationAvailability(startAt, endAt, { bookingId = "" } = {}) {
  const cfg = config();
  if (Date.parse(endAt) - Date.parse(startAt) < 24 * 60 * 60 * 1000) {
    const error = new Error("Square availability searches must cover at least 24 hours.");
    error.code = "SQUARE_INVALID_AVAILABILITY_RANGE";
    throw error;
  }
  const data = await squareRequest("/v2/bookings/availability/search", {
    body: { query: { filter: bookingId
      ? { start_at_range: { start_at: startAt, end_at: endAt }, booking_id: bookingId }
      : {
        start_at_range: { start_at: startAt, end_at: endAt },
        location_id: cfg.locationId,
        segment_filters: [{ service_variation_id: cfg.serviceVariationId }]
      }
    } }
  });
  return (data.availabilities || []).map(safeAvailability);
}

function key(...parts) {
  return crypto.createHash("sha256").update(parts.join(":")).digest("hex").slice(0, 45);
}

async function createSquareBookingFromAttempt(attempt) {
  const response = await squareRequest("/v2/bookings", {
    body: { idempotency_key: attempt.idempotency_key, booking: attempt.booking }
  });
  if (!response.booking?.id) throw new Error("Square did not return a booking record.");
  if (attempt.user_id && attempt.attemptDocumentId) {
    await markSquareBookingAttemptCreated({
      userId: attempt.user_id,
      attemptDocumentId: attempt.attemptDocumentId,
      bookingId: response.booking.id
    });
  }
  return response.booking;
}

export async function getOrCreateSquareCustomer(user) {
  if (!user?.id || !user?.email) throw new Error("A signed-in account email is required to book.");
  const data = await squareRequest("/v2/customers/search", { body: {
    query: { filter: { reference_id: { exact: String(user.id) } } }, limit: 1
  } });
  if (data.customers?.[0]?.id) return data.customers[0].id;
  const nameParts = String(user.full_name || "Client").trim().split(/\s+/).filter(Boolean);
  const created = await squareRequest("/v2/customers", { body: {
    idempotency_key: key("customer", user.id),
    given_name: nameParts[0] || "Client",
    family_name: nameParts.slice(1).join(" "),
    email_address: user.email,
    reference_id: String(user.id)
  } });
  if (!created.customer?.id) throw new Error("Square did not return a customer record.");
  return created.customer.id;
}

export async function createSquareConsultationBooking({ user, startAt, bookingAttemptId, requestData, customerNote = "" }) {
  const cfg = config();
  const canonicalStartAt = new Date(Date.parse(startAt)).toISOString();
  const idempotencyKey = key("booking", user.id, bookingAttemptId, canonicalStartAt);
  const priorAttempt = await getSquareBookingAttempt({
    userId: user.id,
    attemptId: bookingAttemptId,
    startAt: canonicalStartAt
  });
  if (priorAttempt) {
    let booking;
    if (priorAttempt.booking_id) {
      try { booking = await retrieveSquareBooking(priorAttempt.booking_id); } catch { /* replay the persisted create request below */ }
    }
    if (!booking) booking = await createSquareBookingFromAttempt(priorAttempt);
    return {
      booking,
      requestData: priorAttempt.request_data || requestData,
      attemptDocumentId: priorAttempt.attemptDocumentId,
      requestId: priorAttempt.request_id || ""
    };
  }

  const candidates = await searchSquareConsultationAvailability(canonicalStartAt, new Date(Date.parse(canonicalStartAt) + 24 * 60 * 60 * 1000).toISOString());
  const match = candidates.find((item) => Date.parse(item.startAt) === Date.parse(canonicalStartAt));
  if (!match?.appointmentSegments?.length) {
    const error = new Error("That appointment time is no longer available.");
    error.code = "SQUARE_SLOT_UNAVAILABLE";
    throw error;
  }
  const customerId = await getOrCreateSquareCustomer(user);
  const booking = {
    location_id: cfg.locationId,
    start_at: match.startAt,
    customer_id: customerId,
    appointment_segments: match.appointmentSegments.map((segment) => ({
      duration_minutes: segment.durationMinutes,
      service_variation_id: segment.serviceVariationId,
      service_variation_version: segment.serviceVariationVersion,
      team_member_id: segment.teamMemberId
    })),
    customer_note: String(customerNote).slice(0, 500)
  };
  const attempt = await getOrCreateSquareBookingAttempt({
    userId: user.id,
    attemptId: bookingAttemptId,
    startAt: canonicalStartAt,
    booking,
    requestData,
    idempotencyKey
  });
  let createdBooking;
  if (attempt.booking_id) {
    try { createdBooking = await retrieveSquareBooking(attempt.booking_id); } catch { /* replay with the saved idempotency key and payload */ }
  }
  if (!createdBooking) createdBooking = await createSquareBookingFromAttempt(attempt);
  return {
    booking: createdBooking,
    requestData: attempt.request_data || requestData,
    attemptDocumentId: attempt.attemptDocumentId,
    requestId: attempt.request_id || ""
  };
}

export async function retrieveSquareBooking(bookingId) {
  const data = await squareRequest(`/v2/bookings/${encodeURIComponent(bookingId)}`, { method: "GET" });
  return data.booking;
}

export async function rescheduleSquareBooking(bookingId, startAt) {
  const current = await retrieveSquareBooking(bookingId);
  const segments = current.appointment_segments || [];
  if (!segments.length) throw new Error("This appointment cannot be rescheduled online.");
  const options = await searchSquareConsultationAvailability(
    startAt,
    new Date(Date.parse(startAt) + 24 * 60 * 60 * 1000).toISOString(),
    { bookingId }
  );
  const slot = options.find((item) => Date.parse(item.startAt) === Date.parse(startAt));
  const oldSegment = segments[0];
  const nextSegment = slot?.appointmentSegments?.find((item) => item.serviceVariationId === oldSegment.service_variation_id);
  if (!nextSegment) {
    const error = new Error("That appointment time is no longer available.");
    error.code = "SQUARE_SLOT_UNAVAILABLE";
    throw error;
  }
  const updated = await squareRequest(`/v2/bookings/${encodeURIComponent(bookingId)}`, { method: "PUT", body: {
    idempotency_key: key("reschedule", bookingId, current.version, startAt),
    booking: {
      version: current.version,
      start_at: slot.startAt,
      appointment_segments: [{
        duration_minutes: nextSegment.durationMinutes,
        team_member_id: nextSegment.teamMemberId,
        service_variation_id: nextSegment.serviceVariationId,
        service_variation_version: nextSegment.serviceVariationVersion
      }]
    }
  } });
  return updated.booking;
}

export async function cancelSquareBooking(bookingId) {
  const current = await retrieveSquareBooking(bookingId);
  const response = await squareRequest(`/v2/bookings/${encodeURIComponent(bookingId)}/cancel`, { body: {
    idempotency_key: key("cancel", bookingId, current.version),
    booking_version: current.version
  } });
  return response.booking;
}
