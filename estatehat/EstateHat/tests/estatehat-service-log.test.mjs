import test from "node:test";
import assert from "node:assert/strict";
import { createServiceRecord, exportServiceRecordsCsv, filterServiceRecords, restoreServiceRecords, summarizeServiceRecords } from "../src/estatehat-service-log.js";

const add = (provider, serviceDate, amount, rest = {}) => createServiceRecord({ provider, serviceDate, amount, type: "HVAC", ...rest });

test("service records require valid provider, calendar date and bounded costs", () => {
  assert.throws(() => add("x", "2026-10-10", 50), /provider name/i);
  assert.throws(() => add("Air Co", "2026-02-30", 50), /valid service date/i);
  assert.throws(() => add("Air Co", "2026-10-10", -1), /between/i);
  assert.throws(() => add("Air Co", "2026-10-10", 10000001), /between/i);
  assert.equal(add("Air Co", "2026-10-10", 4.127).amount, 4.13);
});

test("service records bound provider and notes and use safe default categories", () => {
  const record = add("Vendor".repeat(30), "2026-10-10", 25, { type: "fake", notes: `visit\u0000${"n".repeat(600)}` });
  assert.equal(record.provider.length, 120);
  assert.equal(record.type, "Other");
  assert.equal(record.notes.length, 500);
  assert.equal(record.notes.includes("\u0000"), false);
});

test("service log filters by search, category and inclusive date range newest first", () => {
  const records = [add("A One", "2026-10-01", 10), add("B Two", "2026-10-07", 20, { type: "Plumbing" }), add("Air One", "2026-10-10", 30)];
  assert.deepEqual(filterServiceRecords(records, { query: "one", from: "2026-10-01", to: "2026-10-10" }).map((r) => r.provider), ["Air One", "A One"]);
  assert.equal(filterServiceRecords(records, { type: "Plumbing" }).length, 1);
  assert.equal(filterServiceRecords(records, { from: "2026-10-07", to: "2026-10-07" }).length, 1);
});

test("service summary totals, averages and newest date use the filtered records", () => {
  const records = [add("A Co", "2026-10-01", 10), add("B Co", "2026-10-02", 20)];
  assert.deepEqual(summarizeServiceRecords(records), { count: 2, total: 30, average: 15, newestDate: "2026-10-02" });
  assert.deepEqual(summarizeServiceRecords([]), { count: 0, total: 0, average: 0, newestDate: "" });
});

test("CSV quotes fields and neutralizes spreadsheet formulas and control characters", () => {
  const csv = exportServiceRecordsCsv([add("=BAD", "2026-10-01", 10, { notes: "line\nend" })]);
  assert.match(csv, /'=BAD/);
  assert.match(csv, /line end/);
});

test("service backup restores supported records and rejects duplicates and invalid rows", () => {
  const record = { id: "1", provider: "HVAC Co", serviceDate: "2026-10-10", amount: 12.25, type: "HVAC", notes: "Annual tune-up" };
  assert.deepEqual(restoreServiceRecords([record]), [record]);
  assert.throws(() => restoreServiceRecords([record, record]), /invalid or duplicate/i);
  assert.throws(() => restoreServiceRecords([{ ...record, type: "fake" }]), /invalid or duplicate/i);
  assert.throws(() => restoreServiceRecords(Array(1001).fill(record)), /1,000/);
});
