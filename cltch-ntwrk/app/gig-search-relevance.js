const SEARCH_FIELDS = [
  ["venue", 8],
  ["genre", 6],
  ["location", 5],
  ["notes", 2]
];

function tokensFor(value) {
  return String(value || "").toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

function relevanceScore(gig, phrase) {
  const query = String(phrase || "").trim().toLocaleLowerCase();
  const tokens = tokensFor(query);
  if (!tokens.length) return 0;
  let score = 0;
  for (const [field, weight] of SEARCH_FIELDS) {
    const text = String(gig?.[field] || "").toLocaleLowerCase();
    const words = tokensFor(text);
    for (const token of tokens) {
      if (words.includes(token)) score += weight * 2;
      else if (words.some((word) => word.startsWith(token))) score += weight;
      else if (text.includes(token)) score += Math.max(1, weight - 2);
    }
    if (text.includes(query)) score += weight * 2;
  }
  return score;
}

function timestampValue(value) {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function soonestFirst(a, b) {
  const dateOrder = String(a.data?.date || "").localeCompare(String(b.data?.date || ""));
  if (dateOrder) return dateOrder;
  const createdOrder = timestampValue(b.data?.createdAt) - timestampValue(a.data?.createdAt);
  return createdOrder || String(a.id).localeCompare(String(b.id));
}

export function sortGigSearchResults(items, phrase, mode = "soonest") {
  const sorted = [...items];
  if (mode !== "best-match" || !String(phrase || "").trim()) return sorted.sort(soonestFirst);
  return sorted.sort((a, b) => relevanceScore(b.data, phrase) - relevanceScore(a.data, phrase) || soonestFirst(a, b));
}
