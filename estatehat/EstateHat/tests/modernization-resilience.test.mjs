import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("profile persistence failures propagate when strict initialization is requested", () => {
  const backend = source("src/backend.js");
  assert.match(backend, /ensureUserProfile\(firebaseUser, overrides = \{\}, \{ throwOnError = false \} = \{\}\)/);
  assert.match(backend, /if \(throwOnError\) throw error/);
});

test("auth bootstrap ignores stale callbacks and offers a recovery retry", () => {
  const page = source("app/home/page.jsx");
  assert.match(page, /authCallbackVersion/);
  assert.match(page, /callbackVersion !== authCallbackVersion\.current/);
  assert.match(page, /authRetry/);
  assert.match(page, /Retry/);
});

test("featured listing attribution requires explicit listing or submission ids", () => {
  const app = source("src/estatehat-platform-alpha.jsx");
  assert.match(app, /targets\.has\(String\(listing\?\.id \|\| ""\)\)/);
  assert.match(app, /targets\.has\(String\(listing\?\.reviewSubmissionId \|\| ""\)\)/);
  assert.doesNotMatch(app, /activeListingPlacements\.some\(\(placement\) => featuredPlacementMatchesListing/);
});

test("the documented capability inventory contains exactly 200 numbered items", () => {
  const inventory = source("docs/IMPLEMENTED_FEATURE_INVENTORY_2026-10-16.md");
  const entries = inventory.match(/^\d+\. /gm) || [];
  assert.equal(entries.length, 200);
  assert.match(inventory, /not 200 newly implemented capabilities/);
});
