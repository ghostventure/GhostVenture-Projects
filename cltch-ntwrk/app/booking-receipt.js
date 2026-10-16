const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;

function receiptValue(value, fallback = "Not provided") {
  const normalized = String(value ?? "")
    .replace(CONTROL_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

export function buildBookingReceiptText(gig, { generatedAt = new Date() } = {}) {
  if (!gig || gig.status !== "accepted") {
    throw new Error("A receipt is available only for an accepted booking.");
  }

  const id = receiptValue(gig.id, "");
  if (!id) throw new Error("A booking ID is required to create a receipt.");

  const timestamp = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  if (Number.isNaN(timestamp.getTime())) throw new Error("A valid receipt date is required.");

  return [
    "CLTCH.NTWRK BOOKING RECEIPT",
    "",
    `Booking ID: ${id}`,
    "Current booking status: ACCEPTED",
    `Venue: ${receiptValue(gig.venue)}`,
    `Date: ${receiptValue(gig.date)}`,
    `Time: ${receiptValue(gig.time)}`,
    `Location: ${receiptValue(gig.location)}`,
    `Genre: ${receiptValue(gig.genre)}`,
    `Performer type: ${receiptValue(gig.performerType, "Any performer")}`,
    `Advertised pay (as listed): ${receiptValue(gig.pay)}`,
    `Receipt generated: ${timestamp.toISOString()}`,
    "",
    "This receipt reflects booking details currently recorded in CLTCH.NTWRK. It is not proof of payment, a contract, or confirmation that the event took place. Check the booking page for the latest status."
  ].join("\n");
}

export function downloadBookingReceipt(gig, options = {}) {
  const text = buildBookingReceiptText(gig, options);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cltch-booking-${receiptValue(gig.id, "receipt").replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
