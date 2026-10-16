import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SAVED_GIG_SEARCH_KEY,
  matchesGigSearch,
  normalizeGigSearch,
  readGigSearch,
  saveGigSearch
} from "../app/gig-discovery-filters.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const storage = new MemoryStorage();
const search = normalizeGigSearch({
  phrase: "  Blue Note ", performerType: "dj", fromDate: "2026-11-01",
  toDate: "2026-11-30", minimumPay: "300.4"
});
assert.deepEqual(search, {
  phrase: "Blue Note", performerType: "dj", fromDate: "2026-11-01",
  toDate: "2026-11-30", minimumPay: 300
});
assert.equal(saveGigSearch(search, storage, "user-a"), true);
assert.equal(storage.getItem(`${SAVED_GIG_SEARCH_KEY}:user-a`) !== null, true);
assert.deepEqual(readGigSearch(storage, "user-a"), search);
assert.equal(readGigSearch(storage, "user-b"), null);
assert.equal(saveGigSearch(search, { setItem() { throw new Error("blocked"); } }, "user-a"), false);
assert.equal(normalizeGigSearch({ performerType: "injected", minimumPay: 999999 }).performerType, "any");
assert.equal(normalizeGigSearch({ minimumPay: 999999 }).minimumPay, 100000);

const matching = { venue: "Blue Note", location: "New York", genre: "Jazz", date: "2026-11-12", performerType: "dj", pay: "$500" };
assert.equal(matchesGigSearch(matching, search), true);
assert.equal(matchesGigSearch({ ...matching, date: "2026-12-01" }, search), false);
assert.equal(matchesGigSearch({ ...matching, performerType: "musician" }, search), false);
assert.equal(matchesGigSearch({ ...matching, pay: "Pay TBD" }, search), false);
assert.equal(matchesGigSearch({ ...matching, venue: "Other room" }, search), false);

const page = await readFile(new URL("../gig-discovery.html", import.meta.url), "utf8");
const app = await readFile(new URL("../app/gig-discovery.js", import.meta.url), "utf8");
assert.match(page, /id="saveSearch"/);
assert.match(page, /id="restoreSearch"/);
assert.match(page, /aria-live="polite"/);
assert.match(app, /gigs\.filter\(\(item\) => matchesGigSearch\(item\.data, readForm\(\)\)\)/);
assert.match(app, /readGigSearch\(undefined, currentUser\.uid\)/);
assert.match(app, /writeForm\(saved\)/);

console.log("Saved combined gig search smoke passed: account-scoped persistence, restore-to-live-filtering, combined criteria, and storage fallback.");
