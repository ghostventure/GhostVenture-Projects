import test from "node:test";
import assert from "node:assert/strict";
import { calculateOfferMetrics, createOfferDraft, deleteOfferDraft, exportOfferDrafts, filterOfferDrafts, importOfferDrafts, setOfferStatus, validateOfferDraft } from "../src/estatehat-offers.js";

const now = new Date("2026-10-16T12:00:00");
const draft = { listingId: "listing-1", price: 500000, earnest: 10000, financing: "conventional", inspectionDays: 10, appraisal: true, closingDate: "2026-11-15" };
const listing = { id: "listing-1", title: "Maple House", address: "1 Maple St", price: 525000 };

test("offer validation catches price, earnest money, financing, dates and inspection ranges", () => {
  assert.match(validateOfferDraft({ ...draft, price: 0 }, now), /greater than zero/i);
  assert.match(validateOfferDraft({ ...draft, earnest: 600000 }, now), /earnest/i);
  assert.match(validateOfferDraft({ ...draft, financing: "unknown" }, now), /financing/i);
  assert.match(validateOfferDraft({ ...draft, inspectionDays: 61 }, now), /0 to 60/i);
  assert.match(validateOfferDraft({ ...draft, closingDate: "2026-10-01" }, now), /future/i);
  assert.equal(validateOfferDraft(draft, now), "");
});

test("offer draft retains property snapshot and explicit local-only draft status", () => {
  const offer = createOfferDraft(draft, listing, { id: "o1", now });
  assert.equal(offer.listingId, "listing-1");
  assert.equal(offer.property, "Maple House");
  assert.equal(offer.status, "draft");
  assert.throws(() => createOfferDraft(draft, { ...listing, id: "other" }, { now }), /not found/i);
});

test("offer metrics compare earnest share and offer price against asking price", () => {
  const metrics = calculateOfferMetrics({ price: 500000, earnest: 10000 }, 525000);
  assert.equal(metrics.earnestPercent, 2);
  assert.equal(metrics.askingDifference, -25000);
});

test("draft status changes, filtering, deletion and backup validation work", () => {
  const offer = createOfferDraft(draft, listing, { id: "o1", now });
  const ready = setOfferStatus([offer], "o1", "ready");
  assert.equal(filterOfferDrafts(ready, { query: "maple", status: "ready" }).length, 1);
  assert.equal(deleteOfferDraft(ready, "o1").length, 0);
  assert.deepEqual(importOfferDrafts(exportOfferDrafts([offer])), [offer]);
  assert.throws(() => setOfferStatus([offer], "o1", "sent"), /status/i);
  assert.throws(() => importOfferDrafts(JSON.stringify({ schemaVersion: 1, offers: [offer, offer] })), /duplicate/i);
  assert.throws(() => importOfferDrafts('{"schemaVersion":2,"offers":[]}'), /unsupported/i);
});
