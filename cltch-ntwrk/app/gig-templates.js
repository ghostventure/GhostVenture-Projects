export const MAX_GIG_TEMPLATES = 8;
const TEMPLATE_FIELDS = ['venue', 'location', 'genre', 'performerType', 'pay', 'skillNeed', 'notes', 'eventTimeZone'];
const FIELD_LIMITS = { venue: 120, location: 200, genre: 80, performerType: 40, pay: 40, skillNeed: 240, notes: 1200, eventTimeZone: 64 };
const PREFIX = 'cltch_host_gig_templates_v1:';

function resolveStorage(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage; } catch { return null; }
}

function normalizeTemplate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = String(value.id || '').trim().slice(0, 120);
  const name = String(value.name || '').trim().replace(/\s+/g, ' ').slice(0, 48);
  if (!id || !name) return null;
  const fields = {};
  for (const key of TEMPLATE_FIELDS) {
    const text = String(value.fields?.[key] ?? '').trim();
    if (text.length > FIELD_LIMITS[key]) return null;
    fields[key] = text;
  }
  if (fields.performerType && !['any', 'musician', 'dj', 'photographer', 'cinematographer', 'model'].includes(fields.performerType)) return null;
  return { id, name, fields };
}

export function gigTemplateStorageKey(ownerId) {
  const owner = String(ownerId || '').trim();
  if (!owner || owner.length > 256) throw new TypeError('A signed-in host is required.');
  return `${PREFIX}${encodeURIComponent(owner)}`;
}

export function readGigTemplates(ownerId, storage) {
  const key = gigTemplateStorageKey(ownerId);
  const store = resolveStorage(storage);
  if (!store) return [];
  try {
    const value = JSON.parse(store.getItem(key) || '[]');
    if (!Array.isArray(value)) return [];
    return value.map(normalizeTemplate).filter(Boolean).slice(0, MAX_GIG_TEMPLATES);
  } catch {
    return [];
  }
}

export function saveGigTemplate(ownerId, name, fields, storage) {
  const store = resolveStorage(storage);
  if (!store) throw new Error('Browser storage is unavailable.');
  const current = readGigTemplates(ownerId, store);
  if (current.length >= MAX_GIG_TEMPLATES) throw new RangeError(`Keep up to ${MAX_GIG_TEMPLATES} saved templates.`);
  const template = normalizeTemplate({ id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`, name, fields });
  if (!template) throw new TypeError('Enter a template name and check the saved field lengths.');
  current.push(template);
  store.setItem(gigTemplateStorageKey(ownerId), JSON.stringify(current));
  return template;
}

export function deleteGigTemplate(ownerId, templateId, storage) {
  const store = resolveStorage(storage);
  if (!store) throw new Error('Browser storage is unavailable.');
  const key = gigTemplateStorageKey(ownerId);
  const current = readGigTemplates(ownerId, store);
  const next = current.filter((template) => template.id !== String(templateId));
  store.setItem(key, JSON.stringify(next));
  return next;
}
