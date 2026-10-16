export const TASK_STATUSES = Object.freeze(["todo", "doing", "done"]);
export const TASK_PRIORITIES = Object.freeze(["low", "normal", "high"]);
export const TASK_CATEGORIES = Object.freeze(["general", "purchase", "sale", "finance", "viewing", "paperwork", "maintenance"]);
export const TASK_EXPORT_VERSION = 1;
const MAX_TASKS = 500;
export const LOCAL_TASK_TEMPLATES = Object.freeze({
  buyer: [
    ["List purchase priorities", "general", "normal", 0],
    ["Organize proof of funds", "finance", "high", 2],
    ["Confirm inspection schedule", "viewing", "high", 7],
    ["Review financing options", "finance", "normal", 10],
    ["Collect questions for the closing team", "paperwork", "normal", 14],
  ],
  seller: [
    ["Gather property records", "paperwork", "high", 0],
    ["List repairs to review", "maintenance", "normal", 3],
    ["Prepare property photos", "sale", "normal", 7],
    ["Review listing price assumptions", "sale", "high", 10],
    ["Organize showing availability", "viewing", "normal", 14],
  ],
  homeowner: [
    ["Record utility and service contacts", "maintenance", "low", 0],
    ["Schedule seasonal maintenance review", "maintenance", "normal", 7],
    ["Store appliance and repair notes", "maintenance", "low", 14],
  ],
});

function cleanText(value, maximum) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maximum) : "";
}
function validDate(value) {
  if (!value) return "";
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Use a valid YYYY-MM-DD due date.");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error("Use a valid calendar date.");
  return value;
}
function idForTask() {
  return globalThis.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createLocalTask(input, { id = idForTask(), now = new Date().toISOString() } = {}) {
  const title = cleanText(input?.title, 120);
  if (title.length < 2) throw new Error("Task title must contain at least two characters.");
  const priority = TASK_PRIORITIES.includes(input?.priority) ? input.priority : "normal";
  const category = TASK_CATEGORIES.includes(input?.category) ? input.category : "general";
  return {
    id: cleanText(id, 80),
    title,
    notes: cleanText(input?.notes, 500),
    dueDate: validDate(input?.dueDate || ""),
    priority,
    category,
    status: "todo",
    createdAt: now,
    updatedAt: now,
  };
}

export function addLocalTaskTemplate(tasks, templateId, baseDate = new Date().toISOString().slice(0, 10), now = new Date().toISOString()) {
  const template = LOCAL_TASK_TEMPLATES[templateId];
  if (!template) throw new Error("Choose a supported personal checklist template.");
  if (!Array.isArray(tasks) || tasks.length + template.length > MAX_TASKS) throw new Error("This template exceeds the task list limit.");
  const base = new Date(`${validDate(baseDate)}T00:00:00Z`);
  const titles = new Set(tasks.filter((task) => task.status !== "done").map((task) => task.title.toLowerCase()));
  const additions = template.filter(([title]) => !titles.has(title.toLowerCase())).map(([title, category, priority, offset]) => {
    const due = new Date(base);
    due.setUTCDate(due.getUTCDate() + offset);
    return createLocalTask({ title, category, priority, dueDate: due.toISOString().slice(0, 10) }, { now });
  });
  return { tasks: [...tasks, ...additions], added: additions.length, skipped: template.length - additions.length };
}

export function updateLocalTask(tasks, taskId, patch, now = new Date().toISOString()) {
  if (!Array.isArray(tasks)) throw new Error("Task collection is invalid.");
  const index = tasks.findIndex((task) => task.id === taskId);
  if (index < 0) throw new Error("Task was not found.");
  const current = tasks[index];
  const updated = { ...current };
  if (Object.hasOwn(patch, "title")) {
    const title = cleanText(patch.title, 120);
    if (title.length < 2) throw new Error("Task title must contain at least two characters.");
    updated.title = title;
  }
  if (Object.hasOwn(patch, "notes")) updated.notes = cleanText(patch.notes, 500);
  if (Object.hasOwn(patch, "dueDate")) updated.dueDate = validDate(patch.dueDate || "");
  if (Object.hasOwn(patch, "priority")) {
    if (!TASK_PRIORITIES.includes(patch.priority)) throw new Error("Choose a supported task priority.");
    updated.priority = patch.priority;
  }
  if (Object.hasOwn(patch, "category")) {
    if (!TASK_CATEGORIES.includes(patch.category)) throw new Error("Choose a supported task category.");
    updated.category = patch.category;
  }
  if (Object.hasOwn(patch, "status")) {
    if (!TASK_STATUSES.includes(patch.status)) throw new Error("Choose a supported task status.");
    updated.status = patch.status;
  }
  updated.updatedAt = now;
  return tasks.map((task, row) => row === index ? updated : task);
}

export function deleteLocalTask(tasks, taskId) {
  return Array.isArray(tasks) ? tasks.filter((task) => task.id !== taskId) : [];
}

export function filterLocalTasks(tasks, { query = "", status = "all", priority = "all", category = "all" } = {}) {
  const needle = cleanText(query, 120).toLocaleLowerCase();
  return (Array.isArray(tasks) ? tasks : []).filter((task) =>
    (status === "all" || task.status === status) &&
    (priority === "all" || task.priority === priority) &&
    (category === "all" || (task.category || "general") === category) &&
    (!needle || `${task.title} ${task.notes}`.toLocaleLowerCase().includes(needle))
  );
}

export function sortLocalTasks(tasks) {
  const rank = { high: 0, normal: 1, low: 2 };
  return [...(Array.isArray(tasks) ? tasks : [])].sort((a, b) =>
    (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) ||
    (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31") ||
    a.createdAt.localeCompare(b.createdAt)
  );
}

export function summarizeLocalTasks(tasks, today = new Date().toISOString().slice(0, 10)) {
  const rows = Array.isArray(tasks) ? tasks : [];
  return {
    total: rows.length,
    open: rows.filter((task) => task.status !== "done").length,
    completed: rows.filter((task) => task.status === "done").length,
    dueToday: rows.filter((task) => task.status !== "done" && task.dueDate === today).length,
    overdue: rows.filter((task) => task.status !== "done" && task.dueDate && task.dueDate < today).length,
    highPriority: rows.filter((task) => task.status !== "done" && task.priority === "high").length,
  };
}

export function completeOpenTasks(tasks, now = new Date().toISOString()) {
  return (Array.isArray(tasks) ? tasks : []).map((task) => task.status === "done" ? task : { ...task, status: "done", updatedAt: now });
}

export function exportLocalTasks(tasks, exportedAt = new Date().toISOString()) {
  const rows = Array.isArray(tasks) ? tasks : [];
  if (rows.length > MAX_TASKS) throw new Error("Task export exceeds the supported limit.");
  return JSON.stringify({ schemaVersion: TASK_EXPORT_VERSION, exportedAt, tasks: rows }, null, 2);
}

export function exportLocalTasksCsv(tasks) {
  const quote = (value) => {
    let safe = String(value ?? "").replace(/[\r\n]+/g, " ");
    if (/^[=+\-@]/.test(safe)) safe = `'${safe}`;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows = (Array.isArray(tasks) ? tasks : []).map((task) => [task.title, task.status, task.priority, task.dueDate, task.notes]);
  return [["Task", "Status", "Priority", "Due date", "Notes"], ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
}

export function exportLocalTasksCalendar(tasks) {
  const escape = (value = "") => String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const events = (Array.isArray(tasks) ? tasks : []).filter((task) => task.status !== "done" && task.dueDate).map((task) => [
    "BEGIN:VEVENT", `UID:${escape(task.id)}@estatehat.local`, `DTSTART;VALUE=DATE:${task.dueDate.replaceAll("-", "")}`,
    `SUMMARY:${escape(task.title)}`, `DESCRIPTION:${escape(task.notes || `${task.priority} priority`)}`, "END:VEVENT",
  ].join("\r\n"));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EstateHat//Personal Tasks//EN", ...events, "END:VCALENDAR", ""].join("\r\n");
}

export function importLocalTasks(jsonText) {
  if (typeof jsonText !== "string" || jsonText.length > 1_000_000) throw new Error("Task backup must be under 1 MB.");
  let parsed;
  try { parsed = JSON.parse(jsonText); } catch { throw new Error("This file is not valid JSON."); }
  if (parsed?.schemaVersion !== TASK_EXPORT_VERSION || !Array.isArray(parsed.tasks) || parsed.tasks.length > MAX_TASKS) throw new Error("Unsupported or oversized task backup.");
  const ids = new Set();
  return parsed.tasks.map((rawRecord) => {
    const record = rawRecord && typeof rawRecord === "object" && !Array.isArray(rawRecord) ? rawRecord : {};
    const task = createLocalTask(record, { id: record.id, now: record.createdAt || parsed.exportedAt || new Date().toISOString() });
    if (ids.has(task.id)) throw new Error("Task backup contains duplicate IDs.");
    ids.add(task.id);
    const status = TASK_STATUSES.includes(record.status) ? record.status : "todo";
    return { ...task, status, updatedAt: typeof record.updatedAt === "string" ? record.updatedAt.slice(0, 40) : task.createdAt };
  });
}
