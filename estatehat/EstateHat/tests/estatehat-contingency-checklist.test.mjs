import test from "node:test";
import assert from "node:assert/strict";
import { addContingency, createContingencyChecklist, exportContingencyChecklist, filterContingencies, importContingencyChecklist, removeCustomContingency, summarizeContingencies, toggleContingency } from "../src/estatehat-contingency-checklist.js";

test("checklist initializes distinct core contingencies for the selected property", () => {
  const checklist = createContingencyChecklist("listing-1", { id: "c1" });
  assert.equal(checklist.listingId, "listing-1");
  assert.deepEqual(checklist.items.map((item) => item.label), ["Inspection completed", "Financing approved", "Appraisal reviewed", "Title search cleared"]);
  assert.throws(() => createContingencyChecklist(""), /listing/i);
});

test("item status updates are immutable and summary/filter stay consistent", () => {
  const checklist = createContingencyChecklist("listing-1", { id: "c1" });
  const changed = toggleContingency(checklist, checklist.items[0].id);
  assert.equal(checklist.items[0].done, false);
  assert.equal(summarizeContingencies(changed).percent, 25);
  assert.equal(filterContingencies(changed, "done").length, 1);
  assert.equal(filterContingencies(changed, "open").length, 3);
  assert.throws(() => toggleContingency(checklist, "missing"), /not found/i);
});

test("custom items enforce nonempty unique labels, can be removed, and do not remove core items", () => {
  let checklist = createContingencyChecklist("listing-1", { id: "c1" });
  assert.throws(() => addContingency(checklist, " "), /two characters/i);
  checklist = addContingency(checklist, "Order survey");
  assert.throws(() => addContingency(checklist, "order survey"), /already exists/i);
  const custom = checklist.items.at(-1);
  assert.equal(removeCustomContingency(checklist, custom.id).items.length, 4);
  assert.equal(removeCustomContingency(checklist, checklist.items[0].id).items.length, 5);
});

test("property checklist backup round trips and validates item identity", () => {
  const checklist = addContingency(createContingencyChecklist("listing-1", { id: "c1" }), "Order survey");
  assert.deepEqual(importContingencyChecklist(exportContingencyChecklist(checklist)).items, checklist.items);
  assert.throws(() => importContingencyChecklist('{"schemaVersion":2}'), /unsupported/i);
  assert.throws(() => importContingencyChecklist(JSON.stringify({ schemaVersion: 1, checklist: { ...checklist, items: [checklist.items[0], checklist.items[0]] } })), /duplicate/i);
});
