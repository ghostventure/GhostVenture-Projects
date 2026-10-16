import assert from "node:assert/strict";
import test from "node:test";
import {
  completeOpenTasks,
  addLocalTaskTemplate,
  createLocalTask,
  deleteLocalTask,
  exportLocalTasksCalendar,
  exportLocalTasksCsv,
  exportLocalTasks,
  filterLocalTasks,
  importLocalTasks,
  sortLocalTasks,
  summarizeLocalTasks,
  updateLocalTask,
} from "../src/estatehat-local-tasks.js";

const sample = () => [
  createLocalTask({ title: "Review title report", notes: "Ask attorney", dueDate: "2026-10-15", priority: "high" }, { id: "a", now: "2026-10-10T00:00:00.000Z" }),
  createLocalTask({ title: "Schedule inspection", dueDate: "2026-10-20", priority: "normal" }, { id: "b", now: "2026-10-11T00:00:00.000Z" }),
  createLocalTask({ title: "Compare insurance quotes", priority: "low" }, { id: "c", now: "2026-10-12T00:00:00.000Z" }),
];

test("task creation trims text, constrains lengths, and validates calendar dates", () => {
  const task = createLocalTask({ title: "  Call lender  ", notes: "x".repeat(700), dueDate: "2026-10-20", priority: "high" }, { id: "x" });
  assert.equal(task.title, "Call lender");
  assert.equal(task.notes.length, 500);
  assert.equal(task.status, "todo");
  assert.throws(() => createLocalTask({ title: "x", dueDate: "2026-02-30" }), /two characters/);
  assert.throws(() => createLocalTask({ title: "Valid title", dueDate: "2026-02-30" }), /calendar date/);
});
test("task update supports title, notes, due date, priority, and status", () => {
  const rows = updateLocalTask(sample(), "a", { title: "Review title and lien report", status: "doing", priority: "normal" }, "2026-10-16T10:00:00.000Z");
  assert.equal(rows[0].title, "Review title and lien report");
  assert.equal(rows[0].status, "doing");
  assert.equal(rows[0].priority, "normal");
  assert.equal(rows[0].updatedAt, "2026-10-16T10:00:00.000Z");
});
test("task update rejects invalid status and unknown IDs", () => {
  assert.throws(() => updateLocalTask(sample(), "missing", { status: "done" }), /not found/);
  assert.throws(() => updateLocalTask(sample(), "a", { status: "blocked" }), /supported task status/);
});
test("task deletion does not mutate the original list", () => {
  const rows = sample();
  assert.deepEqual(deleteLocalTask(rows, "b").map((task) => task.id), ["a", "c"]);
  assert.equal(rows.length, 3);
});
test("task filters combine query, status, and priority", () => {
  const rows = filterLocalTasks(sample(), { query: "ATTORNEY", status: "todo", priority: "high" });
  assert.deepEqual(rows.map((task) => task.id), ["a"]);
});

test("task categories validate, persist in backup and provide an independent filter", () => {
  const tasks = [
    createLocalTask({ title: "Review offer", category: "paperwork" }, { id: "cat-1" }),
    createLocalTask({ title: "Tour house", category: "viewing" }, { id: "cat-2" }),
  ];
  assert.equal(filterLocalTasks(tasks, { category: "viewing" })[0].id, "cat-2");
  assert.equal(importLocalTasks(exportLocalTasks(tasks))[0].category, "paperwork");
  assert.throws(() => updateLocalTask(tasks, "cat-1", { category: "unknown" }), /category/i);
});

test("buyer, seller and homeowner templates generate categorized tasks with relative due dates", () => {
  const result = addLocalTaskTemplate([], "buyer", "2026-10-16", "2026-10-16T12:00:00Z");
  assert.equal(result.added, 5);
  assert.equal(result.tasks[0].dueDate, "2026-10-16");
  assert.equal(result.tasks.find((task) => task.title === "Confirm inspection schedule").dueDate, "2026-10-23");
  assert.equal(addLocalTaskTemplate([], "seller", "2026-10-16").added, 5);
  assert.equal(addLocalTaskTemplate([], "homeowner", "2026-10-16").added, 3);
  assert.throws(() => addLocalTaskTemplate([], "unknown"), /supported/i);
});

test("task templates skip existing open duplicates but can recreate completed work", () => {
  const existing = [createLocalTask({ title: "List purchase priorities", category: "general" }, { id: "existing" })];
  const result = addLocalTaskTemplate(existing, "buyer", "2026-10-16");
  assert.equal(result.added, 4);
  assert.equal(result.skipped, 1);
  const completed = updateLocalTask(existing, "existing", { status: "done" });
  assert.equal(addLocalTaskTemplate(completed, "buyer", "2026-10-16").added, 5);
});
test("task ordering prioritizes urgency and due date while undated tasks sort last", () => {
  assert.deepEqual(sortLocalTasks(sample()).map((task) => task.id), ["a", "b", "c"]);
});
test("task summary reports due today, overdue, completed, and priority totals", () => {
  const rows = updateLocalTask(sample(), "b", { status: "done" });
  assert.deepEqual(summarizeLocalTasks(rows, "2026-10-20"), { total: 3, open: 2, completed: 1, dueToday: 0, overdue: 1, highPriority: 1 });
});
test("bulk completion preserves completed tasks and updates open tasks", () => {
  const rows = sample();
  const completed = completeOpenTasks(rows, "2026-10-16T00:00:00.000Z");
  assert.equal(completed.every((task) => task.status === "done"), true);
  assert.equal(completed.every((task) => task.updatedAt === "2026-10-16T00:00:00.000Z"), true);
  assert.equal(rows.every((task) => task.status === "todo"), true);
});
test("task backup round-trips validated task records", () => {
  const rows = sample();
  assert.deepEqual(importLocalTasks(exportLocalTasks(rows, "2026-10-16T00:00:00.000Z")), rows);
});
test("task backup rejects unsupported schemas, duplicate IDs, invalid JSON, and oversized input", () => {
  assert.throws(() => importLocalTasks("not json"), /valid JSON/);
  assert.throws(() => importLocalTasks(JSON.stringify({ schemaVersion: 2, tasks: [] })), /Unsupported/);
  const duplicate = sample().slice(0, 1);
  assert.throws(() => importLocalTasks(exportLocalTasks([...duplicate, ...duplicate])), /duplicate IDs/);
  assert.throws(() => importLocalTasks("x".repeat(1_000_001)), /under 1 MB/);
});

test("calendar export includes only open dated tasks and safely escapes event text", () => {
  const rows = [
    createLocalTask({ title: "Review, disclosure", notes: "line 1\nline 2", dueDate: "2026-10-20" }, { id: "a" }),
    { ...createLocalTask({ title: "Done task", dueDate: "2026-10-21" }, { id: "b" }), status: "done" },
    createLocalTask({ title: "Undated" }, { id: "c" }),
  ];
  const calendar = exportLocalTasksCalendar(rows);
  assert.match(calendar, /Review\\, disclosure/);
  assert.match(calendar, /DTSTART;VALUE=DATE:20261020/);
  assert.equal(calendar.includes("Done task"), false);
  assert.equal(calendar.includes("Undated"), false);
});

test("CSV export quotes values and neutralizes spreadsheet formulas", () => {
  const csv = exportLocalTasksCsv([createLocalTask({ title: "=HYPERLINK(\"bad\")", notes: "safe, quoted" }, { id: "csv-1" })]);
  assert.match(csv, /'=HYPERLINK\(""bad""\)/);
  assert.match(csv, /"safe, quoted"/);
  assert.match(csv, /"Task","Status","Priority","Due date","Notes"/);
});
