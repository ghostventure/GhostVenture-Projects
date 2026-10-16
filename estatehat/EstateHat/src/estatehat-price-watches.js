export const PRICE_WATCH_BACKUP_VERSION = 1;

export function createPriceWatch(watches, listing, targetPrice, id = `price-watch-${Date.now()}`) {
  const target = Number(targetPrice);
  if (!listing?.id) throw new Error("Choose a saved listing.");
  if (!Number.isFinite(target) || target <= 0) throw new Error("Target price must be greater than zero.");
  if (!Array.isArray(watches)) throw new Error("Price watch data is invalid.");
  if (watches.some((watch) => String(watch.listingId) === String(listing.id))) throw new Error("A price target already exists for this listing.");
  return [...watches, { id, listingId: String(listing.id), title: String(listing.title || "Property").slice(0, 160), address: String(listing.address || "").slice(0, 200), targetPrice: target, createdAt: new Date().toISOString() }];
}

export function getPriceWatchStatus(watch, currentPrice) {
  const price = Number(currentPrice);
  if (!Number.isFinite(price) || price <= 0) return { status: "unavailable", difference: null, differencePercent: null };
  const difference = price - watch.targetPrice;
  return { status: difference <= 0 ? "target-reached" : "watching", difference, differencePercent: difference / watch.targetPrice * 100 };
}

export function filterPriceWatches(watches, listings, { query = "", status = "all" } = {}) {
  const needle = String(query).trim().toLowerCase();
  return (Array.isArray(watches) ? watches : []).map((watch) => {
    const listing = listings.find((item) => String(item.id) === watch.listingId);
    return { ...watch, currentPrice: Number(listing?.price) || null, ...getPriceWatchStatus(watch, listing?.price) };
  }).filter((watch) => (status === "all" || watch.status === status) && (!needle || `${watch.title} ${watch.address}`.toLowerCase().includes(needle)));
}

export function deletePriceWatch(watches, id) {
  return (Array.isArray(watches) ? watches : []).filter((watch) => watch.id !== id);
}

export function exportPriceWatches(watches) {
  return JSON.stringify({ schemaVersion: PRICE_WATCH_BACKUP_VERSION, exportedAt: new Date().toISOString(), watches }, null, 2);
}

export function importPriceWatches(text, savedListingIds) {
  if (typeof text !== "string" || text.length > 200_000) throw new Error("Price watch backup must be under 200 KB.");
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("This file is not valid JSON."); }
  if (data?.schemaVersion !== PRICE_WATCH_BACKUP_VERSION || !Array.isArray(data.watches) || data.watches.length > 100) throw new Error("Unsupported price watch backup.");
  const saved = new Set((Array.isArray(savedListingIds) ? savedListingIds : []).map(String));
  const ids = new Set(); const listings = new Set();
  return data.watches.map((row) => {
    const id = String(row?.id || "").slice(0, 100); const listingId = String(row?.listingId || "").slice(0, 160); const price = Number(row?.targetPrice);
    if (!id || ids.has(id) || !listingId || listings.has(listingId) || !saved.has(listingId) || !Number.isFinite(price) || price <= 0) throw new Error("Price watch backup contains an invalid or unsaved listing.");
    ids.add(id); listings.add(listingId);
    return { id, listingId, title: String(row.title || "Property").slice(0, 160), address: String(row.address || "").slice(0, 200), targetPrice: price, createdAt: String(row.createdAt || "").slice(0, 40) };
  });
}
