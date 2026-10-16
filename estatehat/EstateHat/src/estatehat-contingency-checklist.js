export const CONTINGENCY_CHECKLIST_VERSION = 1;
export const DEFAULT_CONTINGENCIES = Object.freeze([
  "Inspection completed",
  "Financing approved",
  "Appraisal reviewed",
  "Title search cleared",
]);

export function createContingencyChecklist(listingId, { id = `contingency-${listingId}`, title = "Property contingency checklist" } = {}) {
  const safeListingId = String(listingId || "").trim().slice(0, 160);
  if (!safeListingId) throw new Error("Choose a listing before creating a checklist.");
  return { id: String(id).slice(0, 120), listingId: safeListingId, title: String(title).slice(0, 100), items: DEFAULT_CONTINGENCIES.map((label, index) => ({ id: `${id}-${index + 1}`, label, done: false, source: "default" })), updatedAt: new Date().toISOString() };
}

export function toggleContingency(checklist, itemId) {
  if (!checklist?.items?.some((item) => item.id === itemId)) throw new Error("Checklist item was not found.");
  return { ...checklist, items: checklist.items.map((item) => item.id === itemId ? { ...item, done: !item.done } : item), updatedAt: new Date().toISOString() };
}

export function addContingency(checklist, label) {
  const text = String(label || "").trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 100);
  if (text.length < 2) throw new Error("Checklist item must contain at least two characters.");
  if (!checklist || !Array.isArray(checklist.items) || checklist.items.length >= 50) throw new Error("Checklist is full or invalid.");
  if (checklist.items.some((item) => item.label.toLowerCase() === text.toLowerCase())) throw new Error("That checklist item already exists.");
  return { ...checklist, items: [...checklist.items, { id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: text, done: false, source: "custom" }], updatedAt: new Date().toISOString() };
}

export function removeCustomContingency(checklist, itemId) {
  return { ...checklist, items: checklist.items.filter((item) => !(item.id === itemId && item.source === "custom")), updatedAt: new Date().toISOString() };
}

export function filterContingencies(checklist, filter = "all") {
  return (checklist?.items || []).filter((item) => filter === "all" || (filter === "done" ? item.done : !item.done));
}

export function summarizeContingencies(checklist) {
  const items = checklist?.items || [];
  const done = items.filter((item) => item.done).length;
  return { total: items.length, done, remaining: items.length - done, percent: items.length ? Math.round(done / items.length * 100) : 0 };
}

export function exportContingencyChecklist(checklist) {
  return JSON.stringify({ schemaVersion: CONTINGENCY_CHECKLIST_VERSION, checklist }, null, 2);
}

export function importContingencyChecklist(text) {
  if (typeof text !== "string" || text.length > 100_000) throw new Error("Checklist backup must be under 100 KB.");
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error("This file is not valid JSON."); }
  const record = parsed?.checklist;
  if (parsed?.schemaVersion !== CONTINGENCY_CHECKLIST_VERSION || !record || !Array.isArray(record.items) || record.items.length > 50) throw new Error("Unsupported checklist backup.");
  if (typeof record.id !== "string" || !record.id || typeof record.listingId !== "string" || !record.listingId) throw new Error("Checklist backup is missing its property identity.");
  const ids = new Set();
  const labels = new Set();
  const items = record.items.map((item) => {
    const id = String(item?.id || "").slice(0, 120);
    const label = String(item?.label || "").trim().slice(0, 100);
    const normalized = label.toLowerCase();
    if (!id || ids.has(id) || label.length < 2 || labels.has(normalized)) throw new Error("Checklist backup has duplicate or invalid items.");
    ids.add(id); labels.add(normalized);
    return { id, label, done: item.done === true, source: item.source === "custom" ? "custom" : "default" };
  });
  return { id: String(record.id || "").slice(0, 120), listingId: String(record.listingId || "").slice(0, 160), title: String(record.title || "Checklist").slice(0, 100), items, updatedAt: new Date().toISOString() };
}
