import test from "node:test";
import assert from "node:assert/strict";
import { createFinanceScenario, deleteFinanceScenario, exportFinanceScenarios, filterFinanceScenarios, importFinanceScenarios, renameFinanceScenario, saveFinanceScenario } from "../src/estatehat-finance-scenarios.js";

const input = { toolId: "cash-to-close", title: "Cash to Close", inputs: { price: 425000, down: 20 }, id: "one" };

test("scenario creation normalizes saved user inputs and rejects invalid records", () => {
  const scenario = createFinanceScenario(input);
  assert.deepEqual(scenario.inputs, { price: "425000", down: "20" });
  assert.throws(() => createFinanceScenario({ ...input, inputs: [] }), /invalid/i);
  assert.throws(() => createFinanceScenario({ ...input, title: "" }), /required/i);
});

test("saving enforces unique identities and a 50-scenario cap", () => {
  const saved = saveFinanceScenario([], input);
  assert.throws(() => saveFinanceScenario(saved, input), /unique/i);
  const full = Array.from({ length: 50 }, (_, index) => createFinanceScenario({ ...input, id: `id-${index}` }));
  assert.throws(() => saveFinanceScenario(full, input), /full/i);
});

test("scenario rename, deletion and search/filter preserve independent records", () => {
  const two = saveFinanceScenario(saveFinanceScenario([], input), { ...input, toolId: "equity", id: "two", title: "Equity" });
  const renamed = renameFinanceScenario(two, "one", " Buyer cash ");
  assert.equal(renamed.find((item) => item.id === "one").title, "Buyer cash");
  assert.equal(filterFinanceScenarios(renamed, { query: "425000", toolId: "cash-to-close" }).length, 1);
  assert.equal(deleteFinanceScenario(renamed, "two").length, 1);
  assert.throws(() => renameFinanceScenario(two, "one", "x"), /two characters/i);
});

test("scenario backups round trip and reject bad schema, duplicate IDs, and oversized data", () => {
  const saved = saveFinanceScenario([], input);
  assert.deepEqual(importFinanceScenarios(exportFinanceScenarios(saved)), saved);
  assert.throws(() => importFinanceScenarios('{"schemaVersion":9,"scenarios":[]}'), /unsupported/i);
  assert.throws(() => importFinanceScenarios(JSON.stringify({ schemaVersion: 1, scenarios: [input, input] })), /duplicate/i);
  assert.throws(() => importFinanceScenarios("x".repeat(500_001)), /500 KB/i);
});
