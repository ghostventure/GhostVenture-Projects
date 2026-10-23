export const VENUE_PREFERENCES_STORAGE_PREFIX = 'cltch:venue-repeat-preferences:v1';
export const MAX_VENUE_REPEAT_PREFERENCES = 20;

export function normalizeVenuePreferenceName(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, 100).toLocaleLowerCase();
}

function keyFor(userId) {
  if (typeof userId !== 'string' || !userId.trim()) return null;
  return `${VENUE_PREFERENCES_STORAGE_PREFIX}:${encodeURIComponent(userId.trim())}`;
}

function normalizeRecord(record) {
  const venue = typeof record?.venue === 'string' ? record.venue.trim().replace(/\s+/g, ' ').slice(0, 100) : '';
  const cadenceDays = Number(record?.cadenceDays);
  const repeatCount = Number(record?.repeatCount);
  if (!venue || ![7, 14].includes(cadenceDays) || !Number.isInteger(repeatCount) || repeatCount < 2 || repeatCount > 12) return null;
  return { venue, key: normalizeVenuePreferenceName(venue), cadenceDays, repeatCount, updatedAt: Number.isFinite(record.updatedAt) ? record.updatedAt : 0 };
}

export function readVenuePreferences(storage, userId) {
  const key = keyFor(userId);
  if (!key || !storage) return { items: [], persistent: false, recovered: false };
  try {
    const raw = storage.getItem(key);
    if (!raw) return { items: [], persistent: true, recovered: false };
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || saved.userId !== userId || !Array.isArray(saved.items)) return { items: [], persistent: true, recovered: true };
    const seen = new Set();
    const items = saved.items.slice(0, MAX_VENUE_REPEAT_PREFERENCES).map(normalizeRecord).filter((item) => {
      if (!item || seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });
    return { items, persistent: true, recovered: items.length !== saved.items.length, };
  } catch { return { items: [], persistent: false, recovered: true }; }
}

export function findVenuePreference(items, venue) {
  const key = normalizeVenuePreferenceName(venue);
  if (!key || !Array.isArray(items)) return null;
  return items.find((item) => item?.key === key) || null;
}

export function saveVenuePreference(storage, userId, venue, cadenceDays, repeatCount) {
  const key = keyFor(userId);
  const record = normalizeRecord({ venue, cadenceDays, repeatCount, updatedAt: Date.now() });
  if (!key || !storage || !record) return { saved: false, reason: 'invalid' };
  const loaded = readVenuePreferences(storage, userId);
  if (!loaded.persistent) return { saved: false, reason: 'storage' };
  const existing = loaded.items.find((item) => item.key === record.key);
  if (!existing && loaded.items.length >= MAX_VENUE_REPEAT_PREFERENCES) return { saved: false, reason: 'limit' };
  const items = [record, ...loaded.items.filter((item) => item.key !== record.key)].slice(0, MAX_VENUE_REPEAT_PREFERENCES);
  try {
    storage.setItem(key, JSON.stringify({ version: 1, userId, items }));
    return { saved: true, preference: record };
  } catch { return { saved: false, reason: 'storage' }; }
}

export function deleteVenuePreference(storage, userId, venue) {
  const key = keyFor(userId);
  const venueKey = normalizeVenuePreferenceName(venue);
  if (!key || !storage || !venueKey) return false;
  const loaded = readVenuePreferences(storage, userId);
  if (!loaded.persistent) return false;
  const items = loaded.items.filter((item) => item.key !== venueKey);
  if (items.length === loaded.items.length) return false;
  try {
    storage.setItem(key, JSON.stringify({ version: 1, userId, items }));
    return true;
  } catch { return false; }
}
