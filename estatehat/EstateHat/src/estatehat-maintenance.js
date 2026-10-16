export const MAINTENANCE_CATEGORIES = Object.freeze(["HVAC", "Plumbing", "Electrical", "Roof", "Safety", "Appliances", "Exterior", "Other"]);
const PRIORITIES = ["low", "normal", "high"];
const id = () => globalThis.crypto?.randomUUID?.() || `maintenance-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function createMaintenanceTask(input, now = new Date()) {
  const title = String(input?.title || "").trim().slice(0, 120);
  const dueDate = String(input?.dueDate || "");
  if (title.length < 3) throw new Error("Enter a task name with at least three characters.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T00:00:00`))) throw new Error("Choose a valid due date.");
  const date = new Date(`${dueDate}T00:00:00`);
  if (date.toISOString().slice(0, 10) !== dueDate) throw new Error("Choose a valid due date.");
  const category = MAINTENANCE_CATEGORIES.includes(input.category) ? input.category : "Other";
  const priority = PRIORITIES.includes(input.priority) ? input.priority : "normal";
  return { id: id(), title, dueDate, category, priority, notes: String(input.notes || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 500), status: "open", createdAt: now.toISOString() };
}

export function updateMaintenanceTask(tasks, taskId, patch) {
  return tasks.map((task) => task.id === taskId ? { ...task, ...(patch.status === "done" ? { status: "done", completedAt: new Date().toISOString() } : patch.status === "open" ? { status: "open", completedAt: "" } : {}) } : task);
}

export function filterMaintenanceTasks(tasks, { query = "", status = "all", category = "all", today = new Date().toISOString().slice(0, 10) } = {}) {
  const needle = query.trim().toLowerCase();
  return tasks.filter((task) => (status === "all" || (status === "overdue" ? task.status === "open" && task.dueDate < today : task.status === status)) && (category === "all" || task.category === category) && (!needle || `${task.title} ${task.notes} ${task.category}`.toLowerCase().includes(needle))).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title));
}

export function summarizeMaintenance(tasks, today = new Date().toISOString().slice(0, 10)) {
  const open = tasks.filter((task) => task.status === "open");
  const horizon = new Date(`${today}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 7);
  const dueSoonThrough = horizon.toISOString().slice(0, 10);
  return { total: tasks.length, open: open.length, overdue: open.filter((task) => task.dueDate < today).length, dueSoon: open.filter((task) => task.dueDate >= today && task.dueDate <= dueSoonThrough).length, completed: tasks.length - open.length };
}

export function exportMaintenanceCsv(tasks) {
  const cell = (value) => { let text = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " "); if (/^[\s]*[=+@\-]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
  return ["Task,Category,Due date,Priority,Status,Notes", ...tasks.map((task) => [task.title, task.category, task.dueDate, task.priority, task.status, task.notes].map(cell).join(","))].join("\n");
}

export function restoreMaintenanceBackup(value) {
  if (!Array.isArray(value) || value.length > 500) throw new Error("Backup must contain at most 500 maintenance tasks.");
  const ids = new Set();
  return value.map((task) => {
    if (!task || typeof task.id !== "string" || !task.id || ids.has(task.id) || typeof task.title !== "string" || task.title.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) || !MAINTENANCE_CATEGORIES.includes(task.category) || !PRIORITIES.includes(task.priority) || !["open", "done"].includes(task.status)) throw new Error("Backup contains an invalid or duplicate task.");
    ids.add(task.id);
    return { id: task.id, title: task.title.slice(0, 120), dueDate: task.dueDate, category: task.category, priority: task.priority, notes: String(task.notes || "").slice(0, 500), status: task.status, createdAt: String(task.createdAt || "") };
  });
}
