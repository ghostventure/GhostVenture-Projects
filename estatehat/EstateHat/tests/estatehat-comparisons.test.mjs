import test from "node:test";
import assert from "node:assert/strict";
import { createComparisonSet, deleteComparisonSet, exportComparisonSets, importComparisonSets, renameComparisonSet } from "../src/estatehat-comparisons.js";

test("comparison sets require a name and two to four unique listing identities", () => {
  const set = createComparisonSet([], "Starter homes", ["a", "b"], "set-1");
  assert.deepEqual(set[0].listingIds, ["a", "b"]);
  assert.throws(() => createComparisonSet([], "x", ["a", "b"]), /two characters/i);
  assert.throws(() => createComparisonSet([], "Too few", ["a"]), /two to four/i);
  assert.throws(() => createComparisonSet([], "Too many", ["a", "b", "c", "d", "e"]), /two to four/i);
});

test("comparison rename, delete, duplicate names and count limits are checked", () => {
  const sets = createComparisonSet([], "Starter homes", ["a", "b"], "set-1");
  assert.equal(renameComparisonSet(sets, "set-1", "My finalists")[0].name, "My finalists");
  assert.equal(deleteComparisonSet(sets, "set-1").length, 0);
  assert.throws(() => createComparisonSet(sets, "starter HOMES", ["c", "d"]), /already exists/i);
});

test("comparison backup round trips only currently available listing IDs", () => {
  const sets = createComparisonSet([], "Short list", ["a", "b", "c"], "set-1");
  assert.deepEqual(importComparisonSets(exportComparisonSets(sets), ["a", "b"])[0].listingIds, ["a", "b"]);
  assert.throws(() => importComparisonSets(exportComparisonSets(sets), ["a"]), /fewer than two/i);
  assert.throws(() => importComparisonSets('{"schemaVersion":2,"sets":[]}'), /unsupported/i);
});

test("comparison imports reject duplicate identities and oversized backups", () => {
  const set = { id: "one", name: "One", listingIds: ["a", "b"] };
  assert.throws(() => importComparisonSets(JSON.stringify({ schemaVersion: 1, sets: [set, set] }), ["a", "b"]), /invalid/i);
  assert.throws(() => importComparisonSets("x".repeat(200_001), ["a", "b"]), /200 KB/i);
});
