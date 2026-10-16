export const VENUE_SAFETY_STORAGE_PREFIX = 'cltch:venue-safety-checklist:v1';
export const VENUE_SAFETY_ITEMS = Object.freeze([
  Object.freeze({ id: 'exits', label: 'Emergency exits and an assembly area are identified.' }),
  Object.freeze({ id: 'arrival', label: 'Load-in route and accessible entry are clear; access codes are not recorded here.' }),
  Object.freeze({ id: 'weather', label: 'Outdoor weather or indoor relocation plan is ready, if applicable.' }),
  Object.freeze({ id: 'first-aid', label: 'First-aid supplies and emergency procedures are known to the team.' }),
  Object.freeze({ id: 'power', label: 'Power, cables, and equipment placement have been checked for trip hazards.' })
]);

function storageKey(userId) {
  if (typeof userId !== 'string' || !userId.trim()) return null;
  return `${VENUE_SAFETY_STORAGE_PREFIX}:${encodeURIComponent(userId.trim())}`;
}

function emptyChecks() {
  return Object.fromEntries(VENUE_SAFETY_ITEMS.map(({ id }) => [id, false]));
}

export function readVenueSafetyState(storage, userId) {
  const key = storageKey(userId);
  const checked = emptyChecks();
  if (!key || !storage) return { checked, persistent: false, message: 'Checklist ticks stay on this page because browser storage is unavailable.' };
  try {
    const raw = storage.getItem(key);
    if (!raw) return { checked, persistent: true, message: 'Checklist ticks are saved in this browser for this host account.' };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1 || parsed.userId !== userId || !parsed.checked || typeof parsed.checked !== 'object') {
      return { checked, persistent: true, message: 'Saved checklist data was invalid and has been reset.' };
    }
    VENUE_SAFETY_ITEMS.forEach(({ id }) => { checked[id] = parsed.checked[id] === true; });
    return { checked, persistent: true, message: 'Checklist ticks are saved in this browser for this host account.' };
  } catch {
    return { checked, persistent: false, message: 'Checklist ticks stay on this page because browser storage is blocked.' };
  }
}

export function writeVenueSafetyState(storage, userId, checked) {
  const key = storageKey(userId);
  if (!key || !storage) return false;
  const bounded = emptyChecks();
  VENUE_SAFETY_ITEMS.forEach(({ id }) => { bounded[id] = checked?.[id] === true; });
  try {
    storage.setItem(key, JSON.stringify({ version: 1, userId, checked: bounded }));
    return true;
  } catch {
    return false;
  }
}

export function mountVenueSafetyChecklist(container, { storage, userId, documentRef = globalThis.document } = {}) {
  if (!container || !documentRef) return null;
  let resolvedStorage = storage;
  if (resolvedStorage === undefined) {
    try { resolvedStorage = globalThis.localStorage; } catch { resolvedStorage = null; }
  }
  const state = readVenueSafetyState(resolvedStorage, userId);
  const checked = { ...state.checked };
  container.replaceChildren();

  const heading = documentRef.createElement('h2');
  heading.textContent = 'Venue safety checklist';
  container.append(heading);
  const description = documentRef.createElement('p');
  description.textContent = 'Use these reminders while planning the event. Ticks are saved only in this browser and are not sent to CLTCH. Do not enter names, phone numbers, access codes, or other private details.';
  container.append(description);

  const fieldset = documentRef.createElement('fieldset');
  const legend = documentRef.createElement('legend');
  legend.textContent = 'Safety topics to review';
  fieldset.append(legend);
  VENUE_SAFETY_ITEMS.forEach(({ id, label }) => {
    const row = documentRef.createElement('label');
    const checkbox = documentRef.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked[id];
    checkbox.addEventListener('change', () => {
      checked[id] = checkbox.checked === true;
      if (writeVenueSafetyState(resolvedStorage, userId, checked)) {
        status.textContent = 'Checklist ticks saved in this browser for this host account.';
      } else {
        status.textContent = 'Checklist ticks stay on this page because browser storage is blocked.';
      }
    });
    const text = documentRef.createElement('span');
    text.textContent = label;
    row.append(checkbox, text);
    fieldset.append(row);
  });
  container.append(fieldset);
  const status = documentRef.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = state.message;
  container.append(status);
  return { checked, persistent: state.persistent };
}
