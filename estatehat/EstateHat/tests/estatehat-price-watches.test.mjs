import test from "node:test";
import assert from "node:assert/strict";
import { createPriceWatch, deletePriceWatch, exportPriceWatches, filterPriceWatches, getPriceWatchStatus, importPriceWatches } from "../src/estatehat-price-watches.js";

const listing = { id: "listing-1", title: "Maple House", address: "1 Maple St", price: 500000 };

test("price watch requires a saved listing and a positive target", () => {
  const row = createPriceWatch([], listing, 475000, "w1");
  assert.equal(row[0].targetPrice, 475000);
  assert.throws(() => createPriceWatch(row, listing, 450000), /already exists/i);
  assert.throws(() => createPriceWatch([], null, 450000), /saved listing/i);
  assert.throws(() => createPriceWatch([], listing, 0), /greater than zero/i);
});

test("price watch status handles target reached, still watching, and missing live data", () => {
  const watch = { targetPrice: 475000 };
  assert.equal(getPriceWatchStatus(watch, 450000).status, "target-reached");
  assert.equal(getPriceWatchStatus(watch, 500000).difference, 25000);
  assert.equal(getPriceWatchStatus(watch, null).status, "unavailable");
});

test("watch filters include live listing price and search/status criteria", () => {
  const watches = createPriceWatch([], listing, 510000, "w1");
  const result = filterPriceWatches(watches, [listing], { query: "maple", status: "target-reached" });
  assert.equal(result.length, 1);
  assert.equal(result[0].currentPrice, 500000);
});

test("backup restore is limited to saved listings and validates duplicate IDs", () => {
  const watches = createPriceWatch([], listing, 475000, "w1");
  assert.deepEqual(importPriceWatches(exportPriceWatches(watches), [listing.id]), watches);
  assert.throws(() => importPriceWatches(exportPriceWatches(watches), []), /unsaved listing/i);
  assert.throws(() => importPriceWatches(JSON.stringify({ schemaVersion: 1, watches: [watches[0], watches[0]] }), [listing.id]), /invalid or unsaved/i);
  assert.throws(() => importPriceWatches('{"schemaVersion":2,"watches":[]}'), /unsupported/i);
});

test("a saved price alert can be deleted without changing other watch records", () => {
  const [first] = createPriceWatch([], listing, 475000, "w1");
  assert.deepEqual(deletePriceWatch([first, { ...first, id: "w2", listingId: "listing-2" }], "w1").map((item) => item.id), ["w2"]);
});
