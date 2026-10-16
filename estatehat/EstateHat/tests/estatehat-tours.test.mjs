import test from "node:test";
import assert from "node:assert/strict";
import { cancelTour, filterTours, makeTour, toTourCalendar, updateTour, validateTourDraft } from "../src/estatehat-tours.js";

const now = new Date("2026-10-16T12:00:00");
const draft = { listingId: "home-1", date: "2026-10-17", time: "10:30", type: "showing", notes: "Call on arrival" };
const listing = { id: "home-1", title: "Maple House", address: "1 Maple St" };

test("tour validation rejects missing fields, past times, conflicts and oversized notes", () => {
  assert.match(validateTourDraft({ ...draft, listingId: "" }, [], now), /property/i);
  assert.match(validateTourDraft({ ...draft, date: "2026-10-16", time: "11:00" }, [], now), /future/i);
  assert.match(validateTourDraft(draft, [{ ...draft, status: "scheduled" }], now), /overlaps/i);
  assert.match(validateTourDraft({ ...draft, notes: "x".repeat(1001) }, [], now), /1,000/i);
  assert.equal(validateTourDraft(draft, [], now), "");
});

test("duration-aware scheduling rejects overlapping appointments but allows adjacent times", () => {
  const existing = [{ ...draft, date: "2026-10-17", time: "10:00", durationMinutes: 60, status: "scheduled" }];
  assert.match(validateTourDraft({ ...draft, time: "10:30", durationMinutes: 30 }, existing, now), /overlaps/i);
  assert.equal(validateTourDraft({ ...draft, time: "11:00", durationMinutes: 30 }, existing, now), "");
  assert.match(validateTourDraft({ ...draft, durationMinutes: 20 }, [], now), /duration/i);
});

test("tour creation retains listing identity and schedule metadata", () => {
  const tour = makeTour(draft, listing, "t-1");
  assert.equal(tour.id, "t-1");
  assert.equal(tour.listingId, "home-1");
  assert.equal(tour.property, "Maple House");
  assert.equal(tour.status, "scheduled");
});

test("cancellation preserves history and removes the appointment from upcoming results", () => {
  const tours = [makeTour(draft, listing, "t-1")];
  const changed = cancelTour(tours, "t-1");
  assert.equal(changed[0].status, "cancelled");
  assert.equal(tours[0].status, "scheduled");
  assert.equal(filterTours(changed, "", "upcoming", now).length, 0);
  assert.equal(filterTours(changed, "", "cancelled", now).length, 1);
});

test("rescheduling edits the existing record without creating duplicates", () => {
  const tour = makeTour(draft, listing, "t-1");
  const updated = updateTour([tour], "t-1", { date: "2026-10-18", time: "13:30" });
  assert.equal(updated.length, 1);
  assert.equal(updated[0].date, "2026-10-18");
  assert.equal(tour.date, draft.date);
});

test("appointment filtering searches notes and calendar export escapes fields", () => {
  const tour = makeTour(draft, listing, "t-1");
  assert.equal(filterTours([tour], "call on arrival", "all", now).length, 1);
  const ics = toTourCalendar([tour]);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /SUMMARY:showing: Maple House/);
  assert.match(ics, /DESCRIPTION:Call on arrival/);
  assert.match(ics, /DTEND:20261017T113000/);
});
