"use client";
import { useEffect, useMemo, useState } from "react";
import { createMaintenanceTask, exportMaintenanceCsv, filterMaintenanceTasks, MAINTENANCE_CATEGORIES, restoreMaintenanceBackup, summarizeMaintenance, updateMaintenanceTask } from "./estatehat-maintenance.js";

const keyFor = (userKey) => `estatehat:maintenance:v1:${encodeURIComponent(userKey || "guest")}`;
const field = { width: "100%", boxSizing: "border-box", padding: 9, border: "1px solid var(--s-border)", borderRadius: 7, background: "var(--s-surface)", color: "var(--s-dark)" };
const button = { padding: "8px 10px", borderRadius: 7, border: "1px solid var(--s-border)", background: "var(--s-card)", color: "var(--s-dark)", cursor: "pointer", fontWeight: 700 };

export default function EstateHatMaintenancePlanner({ userKey = "guest" }) {
  const storageKey = keyFor(userKey);
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("HVAC");
  const [priority, setPriority] = useState("normal");
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    try { const value = JSON.parse(localStorage.getItem(storageKey) || "[]"); setTasks(restoreMaintenanceBackup(value)); }
    catch { setTasks([]); setNotice("Saved maintenance list could not be read; the current browser list starts empty."); }
    setLoaded(true);
  }, [storageKey]);
  useEffect(() => { if (loaded) localStorage.setItem(storageKey, JSON.stringify(tasks)); }, [loaded, storageKey, tasks]);
  const visible = useMemo(() => filterMaintenanceTasks(tasks, { query, status, category: filterCategory }), [tasks, query, status, filterCategory]);
  const summary = summarizeMaintenance(tasks);
  function addTask(event) {
    event.preventDefault();
    try { setTasks((current) => [...current, createMaintenanceTask({ title, dueDate, category, priority, notes })]); setTitle(""); setDueDate(""); setNotes(""); setNotice("Maintenance task added to this browser profile."); }
    catch (error) { setNotice(error.message); }
  }
  function download(name, content, type) { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.click(); URL.revokeObjectURL(link.href); }
  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { const imported = restoreMaintenanceBackup(JSON.parse(String(reader.result))); setTasks(imported); setNotice(`Restored ${imported.length} tasks.`); } catch (error) { setNotice(error.message || "Could not restore that backup."); } };
    reader.readAsText(file);
  }
  return <div style={{ display: "grid", gap: 11, color: "var(--s-dark)" }}>
    <p style={{ margin: 0, fontSize: 12, color: "var(--s-muted)" }}>Private household planning stored in this browser profile. This is not a contractor dispatch or inspection record.</p>
    <div aria-label="Maintenance summary" style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12 }}>{[["Open", summary.open], ["Overdue", summary.overdue], ["Due in 7 days", summary.dueSoon], ["Done", summary.completed]].map(([label, value]) => <span key={label} style={{ padding: "7px 9px", background: "var(--s-surface-alt)", borderRadius: 7 }}>{label}: <strong>{value}</strong></span>)}</div>
    <form onSubmit={addTask} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
      <input aria-label="Maintenance task name" required minLength={3} maxLength={120} placeholder="e.g. Replace HVAC filter" value={title} onChange={(event) => setTitle(event.target.value)} style={field} />
      <input aria-label="Maintenance due date" type="date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} style={field} />
      <select aria-label="Maintenance category" value={category} onChange={(event) => setCategory(event.target.value)} style={field}>{MAINTENANCE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
      <select aria-label="Maintenance priority" value={priority} onChange={(event) => setPriority(event.target.value)} style={field}>{["low", "normal", "high"].map((item) => <option key={item}>{item}</option>)}</select>
      <input aria-label="Maintenance notes" maxLength={500} placeholder="Optional notes" value={notes} onChange={(event) => setNotes(event.target.value)} style={field} />
      <button style={button} type="submit">Add task</button>
    </form>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
      <input aria-label="Search maintenance tasks" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks" style={field} />
      <select aria-label="Filter maintenance status" value={status} onChange={(event) => setStatus(event.target.value)} style={field}><option value="all">All statuses</option><option value="open">Open</option><option value="overdue">Overdue</option><option value="done">Completed</option></select>
      <select aria-label="Filter maintenance category" value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)} style={field}><option value="all">All categories</option>{MAINTENANCE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
    </div>
    <div style={{ display: "grid", gap: 7 }}>{visible.map((task) => <article key={task.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 9, border: "1px solid var(--s-border)", borderRadius: 8, padding: 9, flexWrap: "wrap" }}><div><strong>{task.title}</strong><div style={{ fontSize: 11, color: "var(--s-muted)" }}>{task.category} · {task.priority} priority · due {task.dueDate}{task.notes && ` · ${task.notes}`}</div></div><div style={{ display: "flex", gap: 6 }}><button style={button} onClick={() => setTasks((current) => updateMaintenanceTask(current, task.id, { status: task.status === "done" ? "open" : "done" }))}>{task.status === "done" ? "Reopen" : "Complete"}</button><button style={button} onClick={() => setTasks((current) => current.filter((entry) => entry.id !== task.id))}>Delete</button></div></article>)}{!visible.length && <p style={{ fontSize: 12, color: "var(--s-muted)" }}>No tasks match these filters.</p>}</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}><button style={button} onClick={() => download("estatehat-maintenance.csv", exportMaintenanceCsv(tasks), "text/csv")}>Export CSV</button><button style={button} onClick={() => download("estatehat-maintenance.json", JSON.stringify(tasks, null, 2), "application/json")}>Download backup</button><label style={{ ...button, display: "inline-flex", alignItems: "center", gap: 6 }}>Restore backup<input aria-label="Restore maintenance backup" type="file" accept="application/json,.json" onChange={(event) => { importBackup(event.target.files?.[0]); event.target.value = ""; }} /></label><button style={button} onClick={() => { if (window.confirm("Delete all maintenance tasks from this browser profile?")) { setTasks([]); setNotice("All maintenance tasks cleared."); } }}>Clear all</button></div>
    {notice && <p role="status" aria-live="polite" style={{ margin: 0, fontSize: 12 }}>{notice}</p>}
  </div>;
}
