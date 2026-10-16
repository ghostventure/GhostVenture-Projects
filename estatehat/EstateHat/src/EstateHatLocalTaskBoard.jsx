"use client";

import { useEffect, useMemo, useState } from "react";
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
  TASK_CATEGORIES,
} from "./estatehat-local-tasks.js";

const styles = {
  input: { width: "100%", boxSizing: "border-box", border: "1px solid var(--s-border)", borderRadius: 7, padding: "8px 9px", background: "var(--s-input-bg)", color: "var(--s-dark)", font: "12px 'Plus Jakarta Sans', sans-serif" },
  button: { border: "1px solid var(--s-border)", borderRadius: 7, padding: "8px 10px", background: "var(--s-card)", color: "var(--s-dark)", font: "700 11px 'Plus Jakarta Sans', sans-serif", cursor: "pointer" },
};
const statusLabels = { todo: "To do", doing: "In progress", done: "Done" };
const priorityColors = { high: "var(--s-red)", normal: "var(--s-gold-deep)", low: "var(--s-muted)" };

function readTasks(key) {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return importLocalTasks(JSON.stringify({ schemaVersion: 1, tasks: Array.isArray(value) ? value : [] }));
  } catch { return []; }
}

function downloadTextFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function EstateHatLocalTaskBoard({ userKey = "guest" }) {
  const safeUserKey = String(userKey || "guest").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
  const storageKey = `estatehat-personal-tasks-v1-${safeUserKey}`;
  const [tasks, setTasks] = useState(() => readTasks(storageKey));
  const [draft, setDraft] = useState({ title: "", notes: "", dueDate: "", priority: "normal", category: "general" });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [category, setCategory] = useState("all");
  const [notice, setNotice] = useState("");
  const [editingTaskId, setEditingTaskId] = useState("");
  const [editDraft, setEditDraft] = useState({});
  const [templateBaseDate, setTemplateBaseDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(tasks.slice(0, 500))); }
    catch { setNotice("Browser storage is unavailable. Keep a downloaded backup before closing this tab."); }
  }, [storageKey, tasks]);

  const summary = useMemo(() => summarizeLocalTasks(tasks), [tasks]);
  const visible = useMemo(() => sortLocalTasks(filterLocalTasks(tasks, { query, status, priority, category })), [tasks, query, status, priority, category]);

  function addTask(event) {
    event.preventDefault();
    try {
      setTasks((current) => [createLocalTask(draft), ...current].slice(0, 500));
      setDraft({ title: "", notes: "", dueDate: "", priority: "normal", category: "general" });
      setNotice("Personal task saved in this browser.");
    } catch (error) { setNotice(error.message); }
  }

  function startEditing(task) {
    setEditingTaskId(task.id);
    setEditDraft({ title: task.title, notes: task.notes, dueDate: task.dueDate, priority: task.priority, category: task.category || "general" });
  }

  function saveEdit(event) {
    event.preventDefault();
    try {
      setTasks((current) => updateLocalTask(current, editingTaskId, editDraft));
      setEditingTaskId("");
      setNotice("Task changes saved.");
    } catch (error) { setNotice(error.message); }
  }

  function applyTemplate(templateId) {
    try {
      const result = addLocalTaskTemplate(tasks, templateId, templateBaseDate);
      setTasks(result.tasks);
      setNotice(`${result.added} checklist tasks added; ${result.skipped} existing open tasks skipped.`);
    } catch (error) { setNotice(error.message); }
  }

  function exportBackup() {
    downloadTextFile(`estatehat-personal-tasks-${new Date().toISOString().slice(0, 10)}.json`, exportLocalTasks(tasks), "application/json");
    setNotice("Task backup downloaded.");
  }

  function exportCalendar() {
    downloadTextFile("estatehat-task-due-dates.ics", exportLocalTasksCalendar(tasks), "text/calendar;charset=utf-8");
    setNotice("Open tasks with due dates exported to your calendar file.");
  }

  function exportSpreadsheet() {
    downloadTextFile("estatehat-personal-tasks.csv", exportLocalTasksCsv(tasks), "text/csv;charset=utf-8");
    setNotice("Task spreadsheet downloaded.");
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error("Task backup must be under 1 MB.");
      const imported = importLocalTasks(await file.text());
      if (tasks.length && !window.confirm(`Replace your current ${tasks.length} tasks with ${imported.length} tasks from this backup?`)) {
        setNotice("Task restore cancelled; your current tasks were kept.");
        return;
      }
      setTasks(imported);
      setNotice(`Restored ${imported.length} tasks from backup.`);
    } catch (error) { setNotice(error.message); }
    event.target.value = "";
  }

  return <div style={{ display: "grid", gap: 10 }}>
    <p style={{ margin: 0, color: "var(--s-muted)", font: "11px/1.5 'Plus Jakarta Sans', sans-serif" }}>Private planning list saved in this browser under this account profile. It is not shared with deal participants or uploaded to EstateHat. Download a backup before changing browsers.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} aria-label="Task summary">
      {[["Open", summary.open], ["Due today", summary.dueToday], ["Overdue", summary.overdue], ["High priority", summary.highPriority], ["Completed", summary.completed]].map(([label, value]) => <span key={label} style={{ borderRadius: 99, padding: "5px 8px", background: "var(--s-surface)", color: "var(--s-dark)", font: "700 10px 'Plus Jakarta Sans', sans-serif" }}>{label}: {value}</span>)}
    </div>
    <form onSubmit={addTask} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 7, alignItems: "end" }}>
      <label style={{ color: "var(--s-muted)", font: "700 10px 'Plus Jakarta Sans', sans-serif" }}>Task<input aria-label="New task title" required minLength={2} maxLength={120} value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Call lender" style={styles.input} /></label>
      <label style={{ color: "var(--s-muted)", font: "700 10px 'Plus Jakarta Sans', sans-serif" }}>Due date<input aria-label="Task due date" type="date" value={draft.dueDate} onChange={(event) => setDraft((value) => ({ ...value, dueDate: event.target.value }))} style={styles.input} /></label>
      <label style={{ color: "var(--s-muted)", font: "700 10px 'Plus Jakarta Sans', sans-serif" }}>Priority<select aria-label="Task priority" value={draft.priority} onChange={(event) => setDraft((value) => ({ ...value, priority: event.target.value }))} style={styles.input}><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label>
      <label style={{ color: "var(--s-muted)", font: "700 10px 'Plus Jakarta Sans', sans-serif" }}>Category<select aria-label="Task category" value={draft.category} onChange={(event) => setDraft((value) => ({ ...value, category: event.target.value }))} style={styles.input}>{TASK_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <button style={{ ...styles.button, background: "var(--s-gold)", fontWeight: 900 }}>Add task</button>
      <label style={{ gridColumn: "1 / -1", color: "var(--s-muted)", font: "700 10px 'Plus Jakarta Sans', sans-serif" }}>Notes<textarea aria-label="Task notes" maxLength={500} value={draft.notes} onChange={(event) => setDraft((value) => ({ ...value, notes: event.target.value }))} rows={2} style={styles.input} /></label>
    </form>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 7 }}>
      <input aria-label="Search tasks" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search task and notes" style={styles.input} />
      <select aria-label="Filter task status" value={status} onChange={(event) => setStatus(event.target.value)} style={styles.input}><option value="all">All statuses</option><option value="todo">To do</option><option value="doing">In progress</option><option value="done">Done</option></select>
      <select aria-label="Filter task priority" value={priority} onChange={(event) => setPriority(event.target.value)} style={styles.input}><option value="all">All priorities</option><option value="high">High priority</option><option value="normal">Normal priority</option><option value="low">Low priority</option></select>
      <select aria-label="Filter task category" value={category} onChange={(event) => setCategory(event.target.value)} style={styles.input}><option value="all">All categories</option>{TASK_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      <label style={{ display: "flex", gap: 5, alignItems: "center", color: "var(--s-muted)", font: "700 10px 'Plus Jakarta Sans', sans-serif" }}>Checklist start<input aria-label="Checklist start date" type="date" value={templateBaseDate} onChange={(event) => setTemplateBaseDate(event.target.value)} style={styles.input} /></label>
      <button type="button" style={styles.button} onClick={() => applyTemplate("buyer")}>Add buyer checklist</button>
      <button type="button" style={styles.button} onClick={() => applyTemplate("seller")}>Add seller checklist</button>
      <button type="button" style={styles.button} onClick={() => applyTemplate("homeowner")}>Add homeowner checklist</button>
      <button type="button" style={styles.button} onClick={() => { setTasks((current) => completeOpenTasks(current)); setNotice("All open tasks marked done."); }}>Complete open tasks</button>
      <button type="button" style={styles.button} onClick={exportBackup} disabled={!tasks.length}>Download backup</button>
      <button type="button" style={styles.button} onClick={exportCalendar} disabled={!tasks.some((task) => task.dueDate && task.status !== "done")}>Export due dates</button>
      <button type="button" style={styles.button} onClick={exportSpreadsheet} disabled={!tasks.length}>Export CSV</button>
      <label style={{ ...styles.button, display: "inline-flex", alignItems: "center", gap: 6 }}>Restore backup<input aria-label="Restore task backup" type="file" accept="application/json,.json" onChange={importBackup} style={{ maxWidth: 170, fontSize: 10 }} /></label>
      <button type="button" style={styles.button} onClick={() => { setTasks((current) => current.filter((task) => task.status !== "done")); setNotice("Completed tasks removed."); }} disabled={!summary.completed}>Clear completed</button>
    </div>
    {notice && <div role="status" aria-live="polite" style={{ color: "var(--s-muted)", font: "11px 'Plus Jakarta Sans', sans-serif" }}>{notice}</div>}
    <div style={{ display: "grid", gap: 7 }}>
      {visible.length ? visible.map((task) => <article key={task.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8, alignItems: "center", border: "1px solid var(--s-border)", borderRadius: 8, padding: 9 }}>
        {editingTaskId === task.id ? <form onSubmit={saveEdit} style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}><input aria-label="Edit task title" required minLength={2} maxLength={120} value={editDraft.title} onChange={(event) => setEditDraft((value) => ({ ...value, title: event.target.value }))} style={styles.input} /><textarea aria-label="Edit task notes" maxLength={500} value={editDraft.notes} onChange={(event) => setEditDraft((value) => ({ ...value, notes: event.target.value }))} style={styles.input} /><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><input aria-label="Edit task due date" type="date" value={editDraft.dueDate} onChange={(event) => setEditDraft((value) => ({ ...value, dueDate: event.target.value }))} style={styles.input} /><select aria-label="Edit task priority" value={editDraft.priority} onChange={(event) => setEditDraft((value) => ({ ...value, priority: event.target.value }))} style={styles.input}><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select><select aria-label="Edit task category" value={editDraft.category} onChange={(event) => setEditDraft((value) => ({ ...value, category: event.target.value }))} style={styles.input}>{TASK_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div style={{ display: "flex", gap: 6 }}><button type="submit" style={styles.button}>Save changes</button><button type="button" style={styles.button} onClick={() => setEditingTaskId("")}>Cancel</button></div></form> : <>
        <div style={{ minWidth: 0 }}><strong style={{ display: "block", color: "var(--s-dark)", font: "700 12px 'Plus Jakarta Sans', sans-serif", textDecoration: task.status === "done" ? "line-through" : "none", overflowWrap: "anywhere" }}>{task.title}</strong>
          {task.notes && <span style={{ display: "block", marginTop: 3, color: "var(--s-muted)", font: "10px/1.4 'Plus Jakarta Sans', sans-serif" }}>{task.notes}</span>}
          <span style={{ display: "block", marginTop: 3, color: priorityColors[task.priority], font: "700 9px 'Plus Jakarta Sans', sans-serif" }}>{task.priority.toUpperCase()} · {task.category || "general"} · {task.dueDate ? `Due ${task.dueDate}` : "No due date"}</span></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "flex-end" }}>
          <button type="button" aria-label={`Edit ${task.title}`} style={styles.button} onClick={() => startEditing(task)}>Edit</button>
          <select aria-label={`${task.title} status`} value={task.status} onChange={(event) => setTasks((current) => updateLocalTask(current, task.id, { status: event.target.value }))} style={{ ...styles.input, width: "auto", minWidth: 100 }}>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button type="button" aria-label={`Delete ${task.title}`} style={styles.button} onClick={() => setTasks((current) => deleteLocalTask(current, task.id))}>Delete</button>
        </div>
        </>}
      </article>) : <div style={{ color: "var(--s-muted)", font: "11px 'Plus Jakarta Sans', sans-serif" }}>{tasks.length ? "No tasks match these filters." : "No personal tasks yet. Add one above."}</div>}
    </div>
  </div>;
}
