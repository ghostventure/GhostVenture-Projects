export const SAVED_GIG_SEARCH_KEY = "cltch_saved_combined_gig_search_v1";
const MAX_PAY = 100000;
const VALID_TYPES = new Set(["any", "musician", "dj", "photographer", "cinematographer", "model"]);

export function normalizeGigSearch(search = {}) {
  const pay = Number(search.minimumPay);
  const type = String(search.performerType || "any");
  return {
    phrase: String(search.phrase || "").trim().slice(0, 80),
    location: String(search.location || "").trim().slice(0, 80),
    performerType: VALID_TYPES.has(type) ? type : "any",
    fromDate: /^\d{4}-\d{2}-\d{2}$/.test(search.fromDate || "") ? search.fromDate : "",
    toDate: /^\d{4}-\d{2}-\d{2}$/.test(search.toDate || "") ? search.toDate : "",
    minimumPay: Number.isFinite(pay) ? Math.min(MAX_PAY, Math.max(0, Math.round(pay))) : 0
  };
}

export function saveGigSearch(search, storage, userId) {
  const normalized = normalizeGigSearch(search);
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    target?.setItem(`${SAVED_GIG_SEARCH_KEY}:${userId}`, JSON.stringify(normalized));
    return true;
  } catch { return false; }
}

export function readGigSearch(storage, userId) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    const value = target?.getItem(`${SAVED_GIG_SEARCH_KEY}:${userId}`);
    return value ? normalizeGigSearch(JSON.parse(value)) : null;
  } catch { return null; }
}

export function matchesGigSearch(gig, search) {
  const filters = normalizeGigSearch(search);
  const date = String(gig?.date || "");
  const pay = parsePay(gig?.pay);
  const haystack = [gig?.venue, gig?.location, gig?.genre, gig?.notes].filter(Boolean).join(" ").toLocaleLowerCase();
  if (filters.location && !String(gig?.location || "").toLocaleLowerCase().includes(filters.location.toLocaleLowerCase())) return false;
  if (filters.phrase && !haystack.includes(filters.phrase.toLocaleLowerCase())) return false;
  if (filters.performerType !== "any" && (gig?.performerType || "musician") !== filters.performerType) return false;
  if (filters.fromDate && date < filters.fromDate) return false;
  if (filters.toDate && date > filters.toDate) return false;
  if (filters.minimumPay > 0 && (pay === null || pay < filters.minimumPay)) return false;
  return true;
}

function parsePay(value) {
  const match = String(value || "").replace(/,/g, "").match(/\d+(?:\.\d{1,2})?/);
  return match ? Number(match[0]) : null;
}
