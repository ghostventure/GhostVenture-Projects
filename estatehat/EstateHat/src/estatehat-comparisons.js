export const COMPARISON_BACKUP_VERSION = 1;
const MAX_LISTINGS = 4;
const MAX_SETS = 30;

export function createComparisonSet(sets, name, listingIds, id = `comparison-${Date.now()}`) {
  const title = String(name || "").trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 80);
  const ids = [...new Set((Array.isArray(listingIds) ? listingIds : []).map(String).filter(Boolean))];
  if (title.length < 2) throw new Error("Comparison name must contain at least two characters.");
  if (ids.length < 2 || ids.length > MAX_LISTINGS) throw new Error("Choose two to four unique listings.");
  if (!Array.isArray(sets) || sets.length >= MAX_SETS) throw new Error("The saved comparison limit has been reached.");
  if (sets.some((item) => item.name.toLowerCase() === title.toLowerCase())) throw new Error("A comparison with this name already exists.");
  return [...sets, { id, name: title, listingIds: ids, createdAt: new Date().toISOString() }];
}

export function renameComparisonSet(sets, id, name) {
  const title = String(name || "").trim().slice(0, 80);
  if (title.length < 2) throw new Error("Comparison name must contain at least two characters.");
  if (!sets.some((item) => item.id === id)) throw new Error("Comparison was not found.");
  if (sets.some((item) => item.id !== id && item.name.toLowerCase() === title.toLowerCase())) throw new Error("A comparison with this name already exists.");
  return sets.map((item) => item.id === id ? { ...item, name: title } : item);
}

export function deleteComparisonSet(sets, id) {
  return (Array.isArray(sets) ? sets : []).filter((item) => item.id !== id);
}

export function exportComparisonSets(sets) {
  return JSON.stringify({ schemaVersion: COMPARISON_BACKUP_VERSION, exportedAt: new Date().toISOString(), sets }, null, 2);
}

export function importComparisonSets(text, availableListingIds) {
  if (typeof text !== "string" || text.length > 200_000) throw new Error("Comparison backup must be under 200 KB.");
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("This file is not valid JSON."); }
  if (data?.schemaVersion !== COMPARISON_BACKUP_VERSION || !Array.isArray(data.sets) || data.sets.length > MAX_SETS) throw new Error("Unsupported comparison backup.");
  const available = new Set((Array.isArray(availableListingIds) ? availableListingIds : []).map(String));
  const ids = new Set(); const names = new Set();
  return data.sets.map((item) => {
    const id = String(item?.id || "").slice(0, 100); const name = String(item?.name || "").trim().slice(0, 80); const normalized = name.toLowerCase();
    if (!id || ids.has(id) || name.length < 2 || names.has(normalized) || !Array.isArray(item.listingIds)) throw new Error("Comparison backup contains invalid sets.");
    ids.add(id); names.add(normalized);
    const listingIds = [...new Set(item.listingIds.map(String).filter((listingId) => available.has(listingId)))].slice(0, MAX_LISTINGS);
    if (listingIds.length < 2) throw new Error("A comparison backup has fewer than two currently available listings.");
    return { id, name, listingIds, createdAt: String(item.createdAt || data.exportedAt || "").slice(0, 40) };
  });
}
