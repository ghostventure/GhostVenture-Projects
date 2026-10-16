export const MATCH_FEEDBACK_STORAGE_PREFIX = 'cltch:match-feedback:v1';
export const MATCH_FEEDBACK_MAX_ITEMS = 120;
export const MATCH_FEEDBACK_REASONS = Object.freeze([
  Object.freeze({ id: 'role_mismatch', label: 'Role mismatch' }),
  Object.freeze({ id: 'genre', label: 'Genre or style mismatch' }),
  Object.freeze({ id: 'skills', label: 'Skills or specialty mismatch' }),
  Object.freeze({ id: 'distance', label: 'Distance does not work' }),
  Object.freeze({ id: 'unavailable', label: 'I am unavailable' }),
  Object.freeze({ id: 'other', label: 'Other reason' })
]);

const VALID_REASONS = new Set(MATCH_FEEDBACK_REASONS.map(({ id }) => id));
const sessionState = new Map();

export function isValidMatchFeedbackGigId(gigId) {
  return typeof gigId === 'string'
    && gigId.length > 0
    && gigId.length <= 128
    && gigId.trim() === gigId
    && !/[\/\u0000-\u001f\u007f]/.test(gigId);
}

function storageKey(userId) {
  if (typeof userId !== 'string' || !userId.trim() || userId.length > 128) return null;
  return `${MATCH_FEEDBACK_STORAGE_PREFIX}:${encodeURIComponent(userId.trim())}`;
}

function normalizeFeedback(value) {
  const entries = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return entries;
  Object.entries(value).forEach(([gigId, reason], index) => {
    if (index >= MATCH_FEEDBACK_MAX_ITEMS) return;
    if (isValidMatchFeedbackGigId(gigId) && VALID_REASONS.has(reason)) entries[gigId] = reason;
  });
  return entries;
}

export function readMatchFeedback(storage, userId) {
  const key = storageKey(userId);
  if (!key) return { entries: {}, persisted: false, message: 'Feedback stays on this page because this account cannot be identified.' };
  try {
    const raw = storage?.getItem(key);
    if (!raw) return { entries: { ...(sessionState.get(key) || {}) }, persisted: !!storage, message: storage ? 'Reasons are stored only in this browser for this account.' : 'Reasons stay on this page because browser storage is unavailable.' };
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || parsed.userId !== userId) {
      return { entries: { ...(sessionState.get(key) || {}) }, persisted: true, message: 'Saved reasons could not be read and were reset.' };
    }
    const entries = normalizeFeedback(parsed.entries);
    sessionState.set(key, entries);
    return { entries: { ...entries }, persisted: true, message: 'Reasons are stored only in this browser for this account.' };
  } catch {
    return { entries: { ...(sessionState.get(key) || {}) }, persisted: false, message: 'Browser storage is blocked. Reasons are kept only for this page session.' };
  }
}

export function saveMatchFeedback(storage, userId, gigId, reason) {
  const key = storageKey(userId);
  if (!key || !isValidMatchFeedbackGigId(gigId) || !VALID_REASONS.has(reason)) {
    return { saved: false, persisted: false, message: 'Choose a valid reason for a match.' };
  }
  const current = readMatchFeedback(storage, userId);
  const entries = { ...current.entries };
  if (Object.hasOwn(entries, gigId)) delete entries[gigId];
  entries[gigId] = reason;
  const orderedEntries = Object.fromEntries(Object.entries(entries).slice(-MATCH_FEEDBACK_MAX_ITEMS));
  sessionState.set(key, orderedEntries);
  try {
    if (!storage) throw new Error('Storage unavailable');
    storage.setItem(key, JSON.stringify({ version: 1, userId, entries: orderedEntries }));
    return { saved: true, persisted: true, message: 'Reason stored only in this browser for this account.' };
  } catch {
    return { saved: true, persisted: false, message: 'Browser storage is blocked. Reason is kept only for this page session.' };
  }
}

export function clearMatchFeedback(storage, userId, gigId) {
  const key = storageKey(userId);
  if (!key || !isValidMatchFeedbackGigId(gigId)) return { saved: false, persisted: false, message: 'This match could not be identified.' };
  const current = readMatchFeedback(storage, userId);
  const entries = { ...current.entries };
  delete entries[gigId];
  sessionState.set(key, entries);
  try {
    if (!storage) throw new Error('Storage unavailable');
    storage.setItem(key, JSON.stringify({ version: 1, userId, entries }));
    return { saved: true, persisted: true, message: 'Saved reason cleared from this browser for this account.' };
  } catch {
    return { saved: true, persisted: false, message: 'Browser storage is blocked. The reason is cleared for this page session only.' };
  }
}

export function mountMatchFeedback(container, { storage, userId, gigId, documentRef = globalThis.document } = {}) {
  if (!container || !documentRef || !isValidMatchFeedbackGigId(gigId)) return null;
  let resolvedStorage = storage;
  if (resolvedStorage === undefined) {
    try { resolvedStorage = globalThis.localStorage; } catch { resolvedStorage = null; }
  }
  const initialState = readMatchFeedback(resolvedStorage, userId);
  const wrapper = documentRef.createElement('div');
  const label = documentRef.createElement('label');
  label.textContent = 'Why does this match not fit? (saved on this device only)';
  const select = documentRef.createElement('select');
  select.setAttribute('aria-label', 'Why does this match not fit? Saved only in this browser for this account.');
  const placeholder = documentRef.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Optional: choose a reason';
  select.append(placeholder);
  const clearOption = documentRef.createElement('option');
  clearOption.value = '__clear__';
  clearOption.textContent = 'Clear saved reason';
  select.append(clearOption);
  MATCH_FEEDBACK_REASONS.forEach(({ id, label: reasonLabel }) => {
    const option = documentRef.createElement('option');
    option.value = id;
    option.textContent = reasonLabel;
    select.append(option);
  });
  select.value = initialState.entries[gigId] || '';
  label.append(select);
  const status = documentRef.createElement('span');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = initialState.message;
  select.addEventListener('change', () => {
    if (!select.value) {
      status.textContent = 'No reason selected.';
      return;
    }
    if (select.value === '__clear__') {
      const result = clearMatchFeedback(resolvedStorage, userId, gigId);
      select.value = '';
      status.textContent = result.message;
      return;
    }
    const result = saveMatchFeedback(resolvedStorage, userId, gigId, select.value);
    status.textContent = result.message;
  });
  wrapper.append(label, status);
  container.append(wrapper);
  return { select, status };
}
