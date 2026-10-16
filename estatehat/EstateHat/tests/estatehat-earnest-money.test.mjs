import test from "node:test";
import assert from "node:assert/strict";
import { addDepositRecord, createDepositRecord, exportDepositRecords, exportDepositRecordsCsv, filterDepositRecords, importDepositRecords, removeDepositRecord, summarizeDepositRecords, updateDepositStatus } from "../src/estatehat-earnest-money.js";

const input = { listingId: "home-1", amount: 12000, dueDate: "2026-10-20", reference: "Receipt 22", note: "Planning only" };

test("deposit note validates amount, property identity and calendar date", () => {
  assert.throws(() => createDepositRecord({ ...input, amount: 0 }), /greater than zero/i);
  assert.throws(() => createDepositRecord({ ...input, listingId: "" }), /property/i);
  assert.throws(() => createDepositRecord({ ...input, dueDate: "2026-02-31" }), /valid due date/i);
  assert.equal(createDepositRecord(input, { id: "d1" }).status, "planned");
});

test("status summary, overdue count and listing isolation use entered data", () => {
  let rows = [createDepositRecord(input, { id: "d1" }), createDepositRecord({ ...input, amount: 3000, dueDate: "2026-10-10" }, { id: "d2" }), createDepositRecord({ ...input, listingId: "home-2", amount: 800 }, { id: "d3" })];
  rows = updateDepositStatus(rows, "d1", "deposited");
  const totals = summarizeDepositRecords(rows, "home-1", "2026-10-16");
  assert.equal(totals.deposited, 12000);
  assert.equal(totals.outstanding, 3000);
  assert.equal(totals.overdueCount, 1);
  assert.equal(filterDepositRecords(rows, "home-1", "overdue", "2026-10-16")[0].id, "d2");
  assert.throws(() => updateDepositStatus(rows, "d1", "sent"), /supported/i);
});

test("deposit records can be deleted and exported with spreadsheet-safe CSV", () => {
  const row = createDepositRecord({ ...input, reference: "=cmd" }, { id: "d1" });
  assert.equal(removeDepositRecord([row], "d1").length, 0);
  assert.match(exportDepositRecordsCsv([row]), /'=cmd/);
  assert.match(exportDepositRecordsCsv([row]), /"Planning only"/);
});

test("deposit backup round trips and rejects duplicate IDs or unsupported versions", () => {
  const rows = [createDepositRecord(input, { id: "d1" })];
  assert.deepEqual(importDepositRecords(exportDepositRecords(rows)), rows);
  assert.throws(() => importDepositRecords(JSON.stringify({ schemaVersion: 1, records: [rows[0], rows[0]] })), /invalid records/i);
  assert.throws(() => importDepositRecords('{"schemaVersion":2,"records":[]}'), /unsupported/i);
});
