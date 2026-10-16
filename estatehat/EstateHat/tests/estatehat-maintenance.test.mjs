import test from "node:test";
import assert from "node:assert/strict";
import { createMaintenanceTask, exportMaintenanceCsv, filterMaintenanceTasks, restoreMaintenanceBackup, summarizeMaintenance, updateMaintenanceTask } from "../src/estatehat-maintenance.js";

const fixedNow = new Date("2026-10-16T12:00:00Z");
const make = (title, dueDate, extra = {}) => createMaintenanceTask({ title, dueDate, category: "HVAC", priority: "normal", ...extra }, fixedNow);

test("maintenance tasks validate title and real calendar due dates", () => {
  assert.throws(() => make("no", "2026-10-20"), /three characters/i);
  assert.throws(() => make("Filter", "2026-02-30"), /valid due date/i);
  assert.throws(() => make("Filter", "later"), /valid due date/i);
  assert.equal(make("Replace air filter", "2026-10-20").status, "open");
});

test("maintenance task fields are bounded and notes sanitized", () => {
  const task = make("x".repeat(140), "2026-10-20", { category: "unknown", priority: "urgent", notes: `note\u0000${"z".repeat(600)}` });
  assert.equal(task.title.length, 120);
  assert.equal(task.category, "Other");
  assert.equal(task.priority, "normal");
  assert.equal(task.notes.length, 500);
  assert.equal(task.notes.includes("\u0000"), false);
});

test("complete and reopen actions preserve separate tasks", () => {
  const first = make("Replace air filter", "2026-10-20");
  const second = make("Test smoke alarms", "2026-10-22", { category: "Safety" });
  const done = updateMaintenanceTask([first, second], first.id, { status: "done" });
  assert.equal(done[0].status, "done");
  assert.ok(done[0].completedAt);
  assert.equal(done[1].status, "open");
  const reopened = updateMaintenanceTask(done, first.id, { status: "open" });
  assert.equal(reopened[0].status, "open");
  assert.equal(reopened[0].completedAt, "");
});

test("search, status, overdue and category filters sort by due date", () => {
  const tasks = [make("Later filter replacement", "2026-10-25"), make("Old filter replacement", "2026-10-15"), make("Test smoke alarm", "2026-10-17", { category: "Safety" })];
  assert.deepEqual(filterMaintenanceTasks(tasks, { query: "FILTER" }).map((task) => task.title), ["Old filter replacement", "Later filter replacement"]);
  assert.equal(filterMaintenanceTasks(tasks, { status: "overdue", today: "2026-10-16" }).length, 1);
  assert.equal(filterMaintenanceTasks(tasks, { category: "Safety" }).length, 1);
  assert.equal(filterMaintenanceTasks(tasks, { status: "open" }).length, 3);
});

test("maintenance summary reports overdue, next-seven-day, open and done counts", () => {
  const tasks = [make("Past task", "2026-10-15"), make("Tomorrow task", "2026-10-17"), make("Future task", "2026-10-30")];
  const done = updateMaintenanceTask(tasks, tasks[2].id, { status: "done" });
  assert.deepEqual(summarizeMaintenance(done, "2026-10-16"), { total: 3, open: 2, overdue: 1, dueSoon: 1, completed: 1 });
});

test("CSV escapes quotes, line breaks and spreadsheet formulas", () => {
  const task = make("=HYPERLINK(\"bad\")", "2026-10-20", { notes: "line one\nline two" });
  const csv = exportMaintenanceCsv([task]);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /line one line two/);
  assert.match(csv, /""bad""/);
});

test("backup restore validates shape, unique IDs, enum values and capacity", () => {
  const task = { id: "a", title: "Replace air filter", dueDate: "2026-10-20", category: "HVAC", priority: "normal", status: "open", notes: "", createdAt: fixedNow.toISOString() };
  assert.deepEqual(restoreMaintenanceBackup([task]), [task]);
  assert.throws(() => restoreMaintenanceBackup([task, task]), /invalid or duplicate/i);
  assert.throws(() => restoreMaintenanceBackup([{ ...task, category: "Fake" }]), /invalid or duplicate/i);
  assert.throws(() => restoreMaintenanceBackup(Array(501).fill(task)), /at most 500/i);
});
