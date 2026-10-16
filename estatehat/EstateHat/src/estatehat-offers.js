export const OFFER_BACKUP_VERSION = 1;
export const OFFER_FINANCING_TYPES = Object.freeze(["conventional", "cash", "fha", "va"]);
export const OFFER_STATUSES = Object.freeze(["draft", "ready", "withdrawn"]);

export function validateOfferDraft(draft, now = new Date()) {
  const price = Number(draft?.price);
  const earnest = Number(draft?.earnest);
  const inspectionDays = Number(draft?.inspectionDays);
  if (!draft?.listingId) return "Choose a property.";
  if (!Number.isFinite(price) || price <= 0) return "Offer price must be greater than zero.";
  if (!Number.isFinite(earnest) || earnest < 0 || earnest > price) return "Earnest money must be between zero and the offer price.";
  if (!OFFER_FINANCING_TYPES.includes(draft.financing)) return "Choose a supported financing type.";
  if (!Number.isInteger(inspectionDays) || inspectionDays < 0 || inspectionDays > 60) return "Inspection period must be from 0 to 60 days.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.closingDate || "")) return "Choose a valid closing date.";
  const calendarDate = new Date(`${draft.closingDate}T00:00:00Z`);
  const endOfDay = new Date(`${draft.closingDate}T23:59:59`);
  if (Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== draft.closingDate) return "Choose a valid closing date.";
  if (endOfDay <= now) return "Closing date must be in the future.";
  return "";
}

export function createOfferDraft(draft, listing, { id = `OFFER-${Date.now()}`, now = new Date() } = {}) {
  const error = validateOfferDraft(draft, now);
  if (error) throw new Error(error);
  if (!listing || String(listing.id) !== String(draft.listingId)) throw new Error("Selected property was not found.");
  return { id, listingId: String(listing.id), property: String(listing.title || "Property").slice(0, 160), address: String(listing.address || "").slice(0, 200), price: Number(draft.price), earnest: Number(draft.earnest), financing: draft.financing, inspectionDays: Number(draft.inspectionDays), appraisal: draft.appraisal === true, closingDate: draft.closingDate, createdAt: now.toISOString(), status: "draft" };
}

export function setOfferStatus(offers, id, status) {
  if (!OFFER_STATUSES.includes(status)) throw new Error("Choose a supported draft status.");
  if (!offers.some((item) => item.id === id)) throw new Error("Offer draft was not found.");
  return offers.map((item) => item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item);
}

export function deleteOfferDraft(offers, id) {
  return (Array.isArray(offers) ? offers : []).filter((item) => item.id !== id);
}

export function filterOfferDrafts(offers, { query = "", status = "all" } = {}) {
  const needle = String(query).trim().toLowerCase();
  return (Array.isArray(offers) ? offers : []).filter((item) =>
    (status === "all" || item.status === status) &&
    (!needle || `${item.property} ${item.address} ${item.id} ${item.financing}`.toLowerCase().includes(needle))
  );
}

export function calculateOfferMetrics(offer, askingPrice) {
  const price = Number(offer?.price) || 0;
  const asking = Number(askingPrice) || 0;
  return { earnestPercent: price > 0 ? Number(offer.earnest || 0) / price * 100 : null, askingDifference: asking > 0 ? price - asking : null, askingDifferencePercent: asking > 0 ? (price - asking) / asking * 100 : null };
}

export function exportOfferDrafts(offers) {
  if (!Array.isArray(offers) || offers.length > 100) throw new Error("Offer backup exceeds the supported limit.");
  return JSON.stringify({ schemaVersion: OFFER_BACKUP_VERSION, exportedAt: new Date().toISOString(), offers }, null, 2);
}

export function importOfferDrafts(text) {
  if (typeof text !== "string" || text.length > 500_000) throw new Error("Offer backup must be under 500 KB.");
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error("This file is not valid JSON."); }
  if (parsed?.schemaVersion !== OFFER_BACKUP_VERSION || !Array.isArray(parsed.offers) || parsed.offers.length > 100) throw new Error("Unsupported or oversized offer backup.");
  const ids = new Set();
  return parsed.offers.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row) || typeof row.id !== "string" || !row.id || ids.has(row.id)) throw new Error("Offer backup has duplicate or invalid draft IDs.");
    ids.add(row.id);
    if (!OFFER_STATUSES.includes(row.status) || !OFFER_FINANCING_TYPES.includes(row.financing) || !Number.isFinite(Number(row.price)) || Number(row.price) <= 0 || !Number.isFinite(Number(row.earnest)) || Number(row.earnest) < 0 || Number(row.earnest) > Number(row.price) || !Number.isInteger(Number(row.inspectionDays)) || Number(row.inspectionDays) < 0 || Number(row.inspectionDays) > 60 || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.closingDate || ""))) throw new Error("Offer backup contains invalid draft data.");
    return { id: row.id.slice(0, 100), listingId: String(row.listingId || "").slice(0, 160), property: String(row.property || "Property").slice(0, 160), address: String(row.address || "").slice(0, 200), price: Number(row.price), earnest: Number(row.earnest) || 0, financing: row.financing, inspectionDays: Math.max(0, Math.min(60, Number(row.inspectionDays) || 0)), appraisal: row.appraisal === true, closingDate: String(row.closingDate || "").slice(0, 10), createdAt: String(row.createdAt || parsed.exportedAt || "").slice(0, 40), status: row.status };
  });
}
