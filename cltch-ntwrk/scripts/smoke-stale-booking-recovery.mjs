import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderStaleBookingRecovery, selectPastAcceptedBookings } from "../app/stale-booking-recovery.js";

class FakeElement {
  constructor(tagName = "#text") { this.tagName = tagName; this.children = []; this.textContent = ""; this.href = ""; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
}
const fakeDocument = {
  createElement: (tag) => new FakeElement(tag),
  createTextNode: (text) => Object.assign(new FakeElement(), { textContent: text })
};

const rows = [
  { id: "old", status: "accepted", date: "2026-01-10", venue: "Old Hall" },
  { id: "newer", status: "accepted", date: "2026-10-01", venue: "The <script>" },
  { id: "future", status: "accepted", date: "2026-10-20", venue: "Future Hall" },
  { id: "cancelled", status: "cancelled", date: "2026-10-01", venue: "Cancelled Hall" },
  { id: "reviewed", status: "accepted", date: "2026-10-05", reviewed: true, venue: "Reviewed Hall" }
];
assert.deepEqual(
  selectPastAcceptedBookings(rows, { today: "2026-10-16" }).map((row) => row.id),
  ["reviewed", "newer", "old"]
);
assert.equal(selectPastAcceptedBookings(rows, { today: "2026-10-16", limit: 999 }).length, 3);
assert.throws(() => selectPastAcceptedBookings(rows, { today: "invalid" }), /valid current date/);

const container = new FakeElement("section");
renderStaleBookingRecovery(container, rows, { today: "2026-10-16", documentRef: fakeDocument });
assert.equal(container.children[0].textContent, "Past accepted bookings");
const list = container.children.find((node) => node.tagName === "ul");
assert.ok(list);
assert.equal(list.children.length, 3);
assert.match(list.children[1].children[0].textContent, /The <script>/);
assert.equal(list.children[1].children[2].href, "booking.html?id=newer");

const page = await readFile(new URL("../musician-dashboard.html", import.meta.url), "utf8");
const helper = await readFile(new URL("../app/stale-booking-recovery.js", import.meta.url), "utf8");
assert.match(page, /where\('acceptedBy', '==', MUSICIAN_ID\)[\s\S]{0,100}where\('status', '==', 'accepted'\)[\s\S]{0,100}where\('date', '<', todayStr\)[\s\S]{0,100}limit\(20\)/);
assert.ok(page.includes("Past bookings could not be loaded. Your upcoming bookings are still available."));
assert.ok(page.includes("retry.textContent = 'Retry past bookings'"));
assert.match(helper, /link\.href = `booking\.html\?id=\$\{encodeURIComponent\(String\(booking\.id\)\)\}`/);

console.log("Stale booking recovery smoke passed: ownership/status/date filtering, 20-record bound, safe details link, and isolated retry state.");
