export const COLLECTION_EXPORT_VERSION = 1;
const clean = (value, max) => typeof value === "string" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max) : "";
const newId = () => globalThis.crypto?.randomUUID?.() || `collection-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function createListingCollection(collections, name, id = newId()) {
  const label = clean(name, 60);
  if (label.length < 2) throw new Error("Collection name must contain at least two characters.");
  if (!Array.isArray(collections)) throw new Error("Collection data is invalid.");
  if (collections.length >= 100) throw new Error("You can keep up to 100 collections.");
  if (collections.some((row) => row.name.toLocaleLowerCase() === label.toLocaleLowerCase())) throw new Error("A collection with this name already exists.");
  return [...collections, { id, name: label, listingIds: [], createdAt: new Date().toISOString() }];
}

export function renameListingCollection(collections, id, name) {
  const label = clean(name, 60);
  if (label.length < 2) throw new Error("Collection name must contain at least two characters.");
  if (collections.some((row) => row.id !== id && row.name.toLocaleLowerCase() === label.toLocaleLowerCase())) throw new Error("A collection with this name already exists.");
  if (!collections.some((row) => row.id === id)) throw new Error("Collection was not found.");
  return collections.map((row) => row.id === id ? { ...row, name: label, updatedAt: new Date().toISOString() } : row);
}

export function deleteListingCollection(collections, id) {
  return collections.filter((row) => row.id !== id);
}

export function toggleListingInCollection(collections, collectionId, listingId) {
  const target = clean(listingId, 160);
  if (!target) throw new Error("Choose a saved listing.");
  if (!collections.some((row) => row.id === collectionId)) throw new Error("Collection was not found.");
  return collections.map((row) => row.id !== collectionId ? row : {
    ...row,
    listingIds: row.listingIds.includes(target) ? row.listingIds.filter((id) => id !== target) : [...row.listingIds, target],
  });
}

export function getCollectionListings(collection, savedListingIds) {
  const saved = new Set(Array.isArray(savedListingIds) ? savedListingIds.map(String) : []);
  return (collection?.listingIds || []).filter((id) => saved.has(String(id)));
}

export function filterListingCollections(collections, query) {
  const needle = clean(query, 100).toLocaleLowerCase();
  return (Array.isArray(collections) ? collections : []).filter((row) => !needle || row.name.toLocaleLowerCase().includes(needle));
}

export function filterCollectionListings(listings, collection, savedListingIds, { query = "", sort = "default" } = {}) {
  if (!collection) return [];
  const savedIds = new Set((Array.isArray(savedListingIds) ? savedListingIds : []).map(String));
  const needle = clean(query, 100).toLocaleLowerCase();
  const rows = (Array.isArray(listings) ? listings : []).filter((item) => savedIds.has(String(item.id)) && (!needle || `${item.title || ""} ${item.address || ""} ${item.city || ""}`.toLocaleLowerCase().includes(needle)));
  if (sort === "price-low") return rows.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  if (sort === "price-high") return rows.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  if (sort === "title") return rows.sort((a, b) => String(a.title || a.address || "").localeCompare(String(b.title || b.address || "")));
  return rows;
}

export function setListingsInCollection(collections, collectionId, listingIds, included, savedListingIds) {
  const saved = new Set(Array.isArray(savedListingIds) ? savedListingIds.map(String) : []);
  if (!collections.some((row) => row.id === collectionId)) throw new Error("Collection was not found.");
  const targets = [...new Set((Array.isArray(listingIds) ? listingIds : []).map(String))].filter((id) => saved.has(id));
  const targetSet = new Set(targets);
  return collections.map((row) => {
    if (row.id !== collectionId) return row;
    const existing = row.listingIds.filter((id) => saved.has(String(id)) && !(targetSet.has(String(id)) && !included));
    const next = included ? [...new Set([...existing, ...targets])] : existing;
    return { ...row, listingIds: next };
  });
}

export function exportCollectionListingsCsv(listings) {
  const quote = (value) => {
    let text = String(value ?? "").replace(/[\r\n]+/g, " ");
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [["Title", "Address", "City", "Price", "Type", "Beds", "Baths", "Square feet"], ...(Array.isArray(listings) ? listings : []).map((item) => [item.title, item.address, item.city, item.price, item.type, item.beds, item.baths, item.sqft])].map((row) => row.map(quote).join(",")).join("\r\n");
}

export function exportListingCollections(collections, savedListingIds) {
  const saved = new Set(Array.isArray(savedListingIds) ? savedListingIds.map(String) : []);
  return JSON.stringify({ schemaVersion: COLLECTION_EXPORT_VERSION, exportedAt: new Date().toISOString(), collections: (Array.isArray(collections) ? collections : []).map((row) => ({ ...row, listingIds: row.listingIds.filter((id) => saved.has(String(id))) })) }, null, 2);
}

export function importListingCollections(text, savedListingIds) {
  if (typeof text !== "string" || text.length > 500_000) throw new Error("Collection backup must be under 500 KB.");
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error("This file is not valid JSON."); }
  if (parsed?.schemaVersion !== COLLECTION_EXPORT_VERSION || !Array.isArray(parsed.collections) || parsed.collections.length > 100) throw new Error("Unsupported collection backup.");
  const saved = new Set(Array.isArray(savedListingIds) ? savedListingIds.map(String) : []);
  const ids = new Set();
  const names = new Set();
  return parsed.collections.map((row) => {
    const record = row && typeof row === "object" && !Array.isArray(row) ? row : {};
    const id = clean(record.id, 100);
    const name = clean(record.name, 60);
    const normalized = name.toLocaleLowerCase();
    if (!id || ids.has(id) || name.length < 2 || names.has(normalized)) throw new Error("Backup contains duplicate or invalid collection records.");
    ids.add(id);
    names.add(normalized);
    const listingIds = Array.isArray(record.listingIds) ? record.listingIds.slice(0, 1000) : [];
    return { id, name, listingIds: [...new Set(listingIds.map((item) => clean(String(item), 160)).filter((item) => item && saved.has(item)))], createdAt: typeof record.createdAt === "string" ? record.createdAt.slice(0, 40) : new Date().toISOString() };
  });
}
