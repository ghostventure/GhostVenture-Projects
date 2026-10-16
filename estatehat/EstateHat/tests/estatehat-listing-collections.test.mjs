import assert from "node:assert/strict";
import test from "node:test";
import {
  createListingCollection,
  deleteListingCollection,
  exportCollectionListingsCsv,
  exportListingCollections,
  filterCollectionListings,
  filterListingCollections,
  getCollectionListings,
  importListingCollections,
  renameListingCollection,
  setListingsInCollection,
  toggleListingInCollection,
} from "../src/estatehat-listing-collections.js";

function collections() {
  return createListingCollection(createListingCollection([], "First Look", "one"), "Needs Repair", "two");
}

test("collection creation trims names and rejects duplicates and empty names", () => {
  assert.equal(createListingCollection([], "  Lake Houses ", "x")[0].name, "Lake Houses");
  assert.throws(() => createListingCollection(collections(), " first look "), /already exists/);
  assert.throws(() => createListingCollection([], "x"), /two characters/);
});
test("collection rename enforces unique names and reports unknown folders", () => {
  assert.equal(renameListingCollection(collections(), "one", "Offer Candidates")[0].name, "Offer Candidates");
  assert.throws(() => renameListingCollection(collections(), "one", "Needs Repair"), /already exists/);
  assert.throws(() => renameListingCollection(collections(), "missing", "A valid name"), /not found/);
});
test("deleting a collection leaves the watchlist IDs outside the organization model", () => {
  const before = collections();
  assert.deepEqual(deleteListingCollection(before, "one").map((row) => row.id), ["two"]);
  assert.equal(before.length, 2);
});
test("a saved listing can be added to and removed from a collection", () => {
  const added = toggleListingInCollection(collections(), "one", "listing-1");
  assert.deepEqual(added[0].listingIds, ["listing-1"]);
  assert.deepEqual(toggleListingInCollection(added, "one", "listing-1")[0].listingIds, []);
});
test("collection membership is limited to IDs still in the watchlist", () => {
  const rows = toggleListingInCollection(collections(), "one", "listing-1");
  assert.deepEqual(getCollectionListings(rows[0], ["listing-1"]), ["listing-1"]);
  assert.deepEqual(getCollectionListings(rows[0], []), []);
});
test("collection search filters by its own name", () => {
  assert.deepEqual(filterListingCollections(collections(), "repair").map((row) => row.id), ["two"]);
});
test("collection export excludes listings no longer saved to the watchlist", () => {
  const rows = toggleListingInCollection(collections(), "one", "listing-1");
  const exported = JSON.parse(exportListingCollections(rows, []));
  assert.deepEqual(exported.collections[0].listingIds, []);
});
test("collection backup round-trips only valid saved listing IDs", () => {
  const rows = toggleListingInCollection(collections(), "one", "listing-1");
  const restored = importListingCollections(exportListingCollections(rows, ["listing-1"]), ["listing-1"]);
  assert.deepEqual(restored[0].listingIds, ["listing-1"]);
  assert.deepEqual(importListingCollections(exportListingCollections(rows, []), [] )[0].listingIds, []);
});
test("collection import rejects malformed versions and duplicate collection identities", () => {
  assert.throws(() => importListingCollections("bad", []), /valid JSON/);
  assert.throws(() => importListingCollections(JSON.stringify({ schemaVersion: 2, collections: [] }), []), /Unsupported/);
  const row = { id: "same", name: "One", listingIds: [] };
  assert.throws(() => importListingCollections(JSON.stringify({ schemaVersion: 1, collections: [row, row] }), []), /duplicate or invalid/);
});

test("watchlist search and sort stay within saved listings", () => {
  const collection = { id: "c1", listingIds: ["l1"] };
  const listings = [{ id: "l1", title: "Cedar", city: "Boston", price: 300 }, { id: "l2", title: "Alder", city: "Boston", price: 200 }, { id: "l3", title: "Other", city: "Boston", price: 100 }];
  assert.deepEqual(filterCollectionListings(listings, collection, ["l1", "l2"], { sort: "price-low" }).map((item) => item.id), ["l2", "l1"]);
  assert.deepEqual(filterCollectionListings(listings, collection, ["l1", "l2"], { query: "alder" }).map((item) => item.id), ["l2"]);
  assert.deepEqual(filterCollectionListings(listings, null, ["l1"]).length, 0);
});

test("bulk collection assignment adds/removes only currently saved listings", () => {
  let data = createListingCollection([], "Prospects", "c1");
  data = setListingsInCollection(data, "c1", ["l1", "l2"], true, ["l1"]);
  assert.deepEqual(data[0].listingIds, ["l1"]);
  assert.deepEqual(setListingsInCollection(data, "c1", ["l1"], false, ["l1"])[0].listingIds, []);
});

test("collection CSV quotes text and neutralizes spreadsheet formulas", () => {
  const csv = exportCollectionListingsCsv([{ title: "=cmd", address: "1 Main, Apt 2", price: 300 }]);
  assert.match(csv, /'=cmd/);
  assert.match(csv, /"1 Main, Apt 2"/);
});
