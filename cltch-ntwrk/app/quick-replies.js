export const MAX_QUICK_REPLIES = 12;
const MAX_NAME = 40;
const MAX_TEXT = 600;
const PREFIX = 'cltch_booking_quick_replies_v1:';

function resolveStorage(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage; } catch { return null; }
}

export function quickReplyStorageKey(ownerId) {
  const owner = String(ownerId || '').trim();
  if (!owner || owner.length > 256) throw new TypeError('A signed-in account is required.');
  return `${PREFIX}${encodeURIComponent(owner)}`;
}

function normalizeReply(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = String(value.id || '').trim().slice(0, 120);
  const name = String(value.name || '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
  const text = String(value.text || '').trim();
  if (!id || !name || !text || text.length > MAX_TEXT) return null;
  return { id, name, text };
}

export function readQuickReplies(ownerId, storage) {
  const key = quickReplyStorageKey(ownerId);
  const store = resolveStorage(storage);
  if (!store) return [];
  try {
    const parsed = JSON.parse(store.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeReply).filter(Boolean).slice(0, MAX_QUICK_REPLIES) : [];
  } catch {
    return [];
  }
}

export function saveQuickReply(ownerId, name, text, storage) {
  const store = resolveStorage(storage);
  if (!store) throw new Error('Browser storage is unavailable.');
  const replies = readQuickReplies(ownerId, store);
  if (replies.length >= MAX_QUICK_REPLIES) throw new RangeError(`Keep up to ${MAX_QUICK_REPLIES} saved replies.`);
  const reply = normalizeReply({
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    text
  });
  if (!reply) throw new TypeError('Add a name and a message of 600 characters or fewer.');
  store.setItem(quickReplyStorageKey(ownerId), JSON.stringify([...replies, reply]));
  return reply;
}

export function deleteQuickReply(ownerId, replyId, storage) {
  const store = resolveStorage(storage);
  if (!store) throw new Error('Browser storage is unavailable.');
  const key = quickReplyStorageKey(ownerId);
  const replies = readQuickReplies(ownerId, store).filter((reply) => reply.id !== String(replyId));
  store.setItem(key, JSON.stringify(replies));
  return replies;
}
