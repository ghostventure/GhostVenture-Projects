import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { activeGigSearchCriteria, clearOneGigSearchCriterion } from "../app/gig-discovery-recovery.js";

const search = {
  phrase: "Blue Note",
  performerType: "dj",
  fromDate: "2026-11-01",
  toDate: "2026-11-30",
  minimumPay: 300
};
const criteria = activeGigSearchCriteria(search);
assert.deepEqual(criteria.map(({ key }) => key), ["phrase", "performerType", "fromDate", "toDate", "minimumPay"]);
assert.equal(criteria.find(({ key }) => key === "phrase").value, "“Blue Note”");
assert.equal(criteria.find(({ key }) => key === "performerType").value, "DJ");
assert.equal(criteria.find(({ key }) => key === "minimumPay").label, "Minimum pay");
assert.deepEqual(activeGigSearchCriteria({ phrase: "", performerType: "any", minimumPay: 0 }), []);

for (const key of criteria.map(({ key }) => key)) {
  const relaxed = clearOneGigSearchCriterion(search, key);
  assert.notEqual(relaxed, search, `${key} recovery returns a fresh search object`);
  for (const otherKey of Object.keys(search)) {
    if (otherKey !== key) assert.equal(relaxed[otherKey], search[otherKey], `${key} recovery preserves ${otherKey}`);
  }
}
assert.equal(clearOneGigSearchCriterion(search, "unknown"), null);
assert.equal(clearOneGigSearchCriterion(search, "phrase").phrase, "");
assert.equal(clearOneGigSearchCriterion(search, "performerType").performerType, "any");
assert.equal(clearOneGigSearchCriterion(search, "fromDate").fromDate, "");
assert.equal(clearOneGigSearchCriterion(search, "toDate").toDate, "");
assert.equal(clearOneGigSearchCriterion(search, "minimumPay").minimumPay, 0);

const app = await readFile(new URL("../app/gig-discovery.js", import.meta.url), "utf8");
assert.match(app, /activeGigSearchCriteria\(filters\)/);
assert.match(app, /clearOneGigSearchCriterion\(readForm\(\), criterion\.key\)/);
assert.match(app, /button\.type = "button"/);
assert.match(app, /setAttribute\("aria-label", `Remove \$\{criterion\.label\} filter/);
assert.match(app, /fields\[criterion\.key\]\.focus\(\)/);

console.log("Gig discovery empty-state recovery smoke passed: active criteria are actionable, one filter is removed at a time, and other search choices are preserved.");
