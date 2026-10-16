export function isValidGigCoordinatePoint(point) {
  return Number.isFinite(point?.lat) && point.lat >= -90 && point.lat <= 90
    && Number.isFinite(point?.lng) && point.lng >= -180 && point.lng <= 180;
}

/** Resolve only after the host has explicitly consented and clicked the location control. */
export async function resolveGigLocationCandidate({ location, consentGiven, fetchImpl = globalThis.fetch } = {}) {
  const query = typeof location === 'string' ? location.trim() : '';
  if (consentGiven !== true || !query) return { ok: false, reason: 'consent-or-location' };
  if (typeof fetchImpl !== 'function') return { ok: false, reason: 'unavailable' };
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const response = await fetchImpl(url, { headers: { 'Accept-Language': 'en' } });
    if (!response?.ok) return { ok: false, reason: 'request' };
    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (row?.lat === undefined || row?.lat === null || row.lat === '' || row?.lon === undefined || row.lon === null || row.lon === '') {
      return { ok: false, reason: 'invalid-result' };
    }
    const point = { lat: Number(row.lat), lng: Number(row.lon) };
    if (!isValidGigCoordinatePoint(point)) return { ok: false, reason: 'invalid-result' };
    return { ok: true, candidate: { ...point, label: String(row?.display_name || query).slice(0, 240) } };
  } catch {
    return { ok: false, reason: 'request' };
  }
}
