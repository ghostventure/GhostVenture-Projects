import crypto from "node:crypto";

const defaultBookingUrl = "https://app.squareup.com/appointments/book/op8hxs606oapok/5JEHPWFCRNH2S/start";
const defaultWebhookPath = "/api/square/bookings/webhook";

function asText(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value).trim();
}

function getSiteBaseUrl() {
  return asText(process.env.SITE_BASE_URL, "https://black-lion-media-studio.web.app").replace(/\/+$/, "");
}

function getBookingStartDate(booking) {
  const startAt = asText(booking?.start_at);
  if (!startAt) {
    return null;
  }

  const date = new Date(startAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatParts(date, timeZone = "America/New_York") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function formatSquareDate(date, timeZone) {
  const parts = formatParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatSquareTime(date, timeZone) {
  const parts = formatParts(date, timeZone);
  return `${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

function buildSignatureUrl(request) {
  const configuredUrl = asText(process.env.SQUARE_BOOKINGS_WEBHOOK_URL);
  if (configuredUrl) {
    return configuredUrl;
  }

  return `${getSiteBaseUrl()}${defaultWebhookPath}`;
}

export function getSquareAppointmentBookingUrl() {
  return asText(process.env.NEXT_PUBLIC_SQUARE_APPOINTMENTS_URL, defaultBookingUrl);
}

export function verifySquareWebhookSignature({ request, rawBody }) {
  const signatureKey = asText(process.env.SQUARE_WEBHOOK_SIGNATURE_KEY);
  if (!signatureKey) {
    return { ok: process.env.NODE_ENV !== "production", skipped: true };
  }

  const expectedSignature = request.headers.get("x-square-hmacsha256-signature") || "";
  if (!expectedSignature) {
    return { ok: false };
  }

  const signaturePayload = `${buildSignatureUrl(request)}${rawBody}`;
  const computedSignature = crypto
    .createHmac("sha256", signatureKey)
    .update(signaturePayload)
    .digest("base64");

  const expectedBuffer = Buffer.from(expectedSignature, "base64");
  const computedBuffer = Buffer.from(computedSignature, "base64");
  if (expectedBuffer.length !== computedBuffer.length) {
    return { ok: false };
  }

  return { ok: crypto.timingSafeEqual(expectedBuffer, computedBuffer) };
}

export function parseSquareBookingWebhook(payload = {}) {
  const booking = payload?.data?.object?.booking;
  const bookingId = asText(booking?.id || payload?.data?.id).split(":")[0];
  if (!booking || !bookingId) {
    return null;
  }

  const startedAt = getBookingStartDate(booking);
  const timeZone = asText(process.env.SQUARE_APPOINTMENTS_TIMEZONE, "America/New_York");
  const firstSegment = Array.isArray(booking.appointment_segments)
    ? booking.appointment_segments[0]
    : null;
  const durationMinutes = Number(firstSegment?.duration_minutes || 0);
  const status = asText(booking.status, "ACCEPTED").toUpperCase();
  const isCancelled = ["CANCELLED", "CANCELED", "DECLINED"].includes(status);
  const serviceVariationId = asText(firstSegment?.service_variation_id);
  const teamMemberId = asText(firstSegment?.team_member_id);
  const customerNote = asText(booking.customer_note);
  const sellerNote = asText(booking.seller_note);

  return {
    squareBookingId: bookingId,
    squareCustomerId: asText(booking.customer_id),
    squareLocationId: asText(booking.location_id || payload.location_id),
    squareBookingStatus: status,
    squareBookingVersion: Number(booking.version || 0),
    squareBookingUrl: getSquareAppointmentBookingUrl(),
    source: "Square Appointments",
    projectType: "Square Appointment",
    budget: "Booked in Square",
    timeline: startedAt
      ? `${formatSquareDate(startedAt, timeZone)} at ${formatSquareTime(startedAt, timeZone)}`
      : "Booked in Square",
    consultationDate: startedAt ? formatSquareDate(startedAt, timeZone) : "",
    consultationTime: startedAt ? formatSquareTime(startedAt, timeZone) : "",
    status: isCancelled ? "Cancelled" : status === "PENDING" ? "Pending" : "Booked",
    details: [
      "Imported from Square Appointments.",
      durationMinutes ? `Duration: ${durationMinutes} minutes.` : "",
      customerNote ? `Customer note: ${customerNote}` : "",
      sellerNote ? `Seller note: ${sellerNote}` : "",
      serviceVariationId ? `Service variation: ${serviceVariationId}.` : "",
      booking.customer_id ? `Square customer: ${booking.customer_id}.` : "",
      teamMemberId ? `Team member: ${teamMemberId}.` : ""
    ]
      .filter(Boolean)
      .join("\n"),
    updatedAt: asText(booking.updated_at || payload.created_at),
    createdAt: asText(booking.created_at || payload.created_at)
  };
}
