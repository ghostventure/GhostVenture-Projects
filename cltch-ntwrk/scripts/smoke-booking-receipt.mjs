import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildBookingReceiptText } from "../app/booking-receipt.js";

const acceptedGig = {
  id: "booking-123",
  status: "accepted",
  venue: "The Room\nStatus: PAID",
  date: "2026-10-20",
  time: "7:30 PM",
  location: "Albany, NY",
  genre: "Jazz",
  performerType: "Band",
  pay: "$250"
};
const generatedAt = new Date("2026-10-16T18:00:00.000Z");
const receipt = buildBookingReceiptText(acceptedGig, { generatedAt });

assert.match(receipt, /^CLTCH\.NTWRK BOOKING RECEIPT/m);
assert.match(receipt, /Booking ID: booking-123/);
assert.match(receipt, /Current booking status: ACCEPTED/);
assert.match(receipt, /Venue: The Room Status: PAID/);
assert.match(receipt, /Advertised pay \(as listed\): \$250/);
assert.match(receipt, /Receipt generated: 2026-10-16T18:00:00\.000Z/);
assert.match(receipt, /not proof of payment, a contract, or confirmation that the event took place/);
assert.doesNotMatch(receipt, /\r|\u0000/);

assert.throws(() => buildBookingReceiptText({ ...acceptedGig, status: "open" }), /only for an accepted booking/);
assert.throws(() => buildBookingReceiptText({ ...acceptedGig, status: "cancelled" }), /only for an accepted booking/);
assert.throws(() => buildBookingReceiptText({ ...acceptedGig, id: "\n\t" }), /booking ID is required/);
assert.throws(() => buildBookingReceiptText(acceptedGig, { generatedAt: "not a date" }), /valid receipt date/);

const bookingPage = await readFile(new URL("../booking.html", import.meta.url), "utf8");
assert.match(bookingPage, /gig\.status === "accepted" && \(isHostOwner \|\| isAcceptedPerformer\)[\s\S]{0,120}downloadBookingReceiptBtn/);
assert.match(bookingPage, /receiptBtn\.addEventListener\("click"[\s\S]{0,200}downloadBookingReceipt\(gig\)/);

console.log("Booking receipt smoke passed: accepted participant gate, field handling, timestamp, and payment/event disclaimer.");
