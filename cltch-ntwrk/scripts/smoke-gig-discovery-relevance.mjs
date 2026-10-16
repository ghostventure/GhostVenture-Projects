import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sortGigSearchResults } from "../app/gig-search-relevance.js";

const gigs = [
  { id: "later", data: { venue: "Blue Note Jazz Club", genre: "Jazz", date: "2026-12-15", createdAt: "2026-10-01" } },
  { id: "first", data: { venue: "Blue Room", genre: "Blues", date: "2026-11-01", createdAt: "2026-10-02" } },
  { id: "other", data: { venue: "Other Hall", genre: "Jazz", location: "Blue City", date: "2026-11-01", createdAt: "2026-10-01" } }
];
assert.deepEqual(sortGigSearchResults(gigs, "Blue Note", "best-match").map((gig) => gig.id), ["later", "first", "other"]);
assert.deepEqual(sortGigSearchResults(gigs, "Blue", "soonest").map((gig) => gig.id), ["first", "other", "later"]);
assert.deepEqual(sortGigSearchResults(gigs, "", "best-match").map((gig) => gig.id), ["first", "other", "later"]);
assert.deepEqual(sortGigSearchResults(gigs, "Blue", "best-match").map((gig) => gig.id), ["first", "later", "other"]);

const page = await readFile(new URL("../gig-discovery.html", import.meta.url), "utf8");
const app = await readFile(new URL("../app/gig-discovery.js", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
assert.match(page, /<option value="soonest">Soonest<\/option><option value="best-match">Best text match<\/option>/);
assert.match(page, /currently loaded/);
assert.match(app, /sortGigSearchResults\(gigs\.filter/);
assert.match(app, /resultOrder\.value = "soonest"/);
assert.match(app, /loadGigPage\(\{ reset: true \}\)/);
assert.equal(packageJson.scripts["smoke:gig-discovery-relevance"], "node scripts/smoke-gig-discovery-relevance.mjs");

console.log("Gig discovery relevance smoke passed: transient text ranking, soonest default, loaded-results disclosure, and full reset to first page.");
