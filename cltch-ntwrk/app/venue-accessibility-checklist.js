export const VENUE_ACCESSIBILITY_STORAGE_PREFIX = 'cltch:venue-accessibility:v1';
export const VENUE_ACCESSIBILITY_ITEMS = Object.freeze([
  Object.freeze({ id: 'step-free-entry', label: 'Confirm whether a step-free entrance is available.' }),
  Object.freeze({ id: 'accessible-restroom', label: 'Confirm accessible restroom availability.' }),
  Object.freeze({ id: 'seating', label: 'Check seating options and clear paths through the room.' }),
  Object.freeze({ id: 'sensory', label: 'Ask whether a quieter area or reduced-sensory option is available.' }),
  Object.freeze({ id: 'communication', label: 'Share practical access details with performers before event day.' })
]);

function keyFor(userId) {
  if (typeof userId !== 'string' || !userId.trim()) return null;
  return `${VENUE_ACCESSIBILITY_STORAGE_PREFIX}:${encodeURIComponent(userId.trim())}`;
}

function emptyChecks() {
  return Object.fromEntries(VENUE_ACCESSIBILITY_ITEMS.map(({ id }) => [id, false]));
}

export function readVenueAccessibilityState(storage, userId) {
  const key = keyFor(userId);
  const checked = emptyChecks();
  if (!key || !storage) return { checked, persistent: false, message: 'Checklist ticks stay on this page because browser storage is unavailable.' };
  try {
    const raw = storage.getItem(key);
    if (!raw) return { checked, persistent: true, message: 'Checklist ticks are saved only in this browser for this host account.' };
    const saved = JSON.parse(raw);
    if (!saved || saved.version !== 1 || saved.userId !== userId || !saved.checked || typeof saved.checked !== 'object') {
      return { checked, persistent: true, message: 'Saved checklist data was invalid and has been reset.' };
    }
    VENUE_ACCESSIBILITY_ITEMS.forEach(({ id }) => { checked[id] = saved.checked[id] === true; });
    return { checked, persistent: true, message: 'Checklist ticks are saved only in this browser for this host account.' };
  } catch {
    return { checked, persistent: false, message: 'Checklist ticks stay on this page because browser storage is blocked.' };
  }
}

export function writeVenueAccessibilityState(storage, userId, values) {
  const key = keyFor(userId);
  if (!key || !storage) return false;
  const checked = emptyChecks();
  VENUE_ACCESSIBILITY_ITEMS.forEach(({ id }) => { checked[id] = values?.[id] === true; });
  try {
    storage.setItem(key, JSON.stringify({ version: 1, userId, checked }));
    return true;
  } catch { return false; }
}

export function mountVenueAccessibilityChecklist(container, { storage, userId, documentRef = globalThis.document } = {}) {
  if (!container || !documentRef) return null;
  let resolvedStorage = storage;
  if (resolvedStorage === undefined) {
    try { resolvedStorage = globalThis.localStorage; } catch { resolvedStorage = null; }
  }
  const state = readVenueAccessibilityState(resolvedStorage, userId);
  const checked = { ...state.checked };
  container.replaceChildren();
  const heading = documentRef.createElement('h2');
  heading.textContent = 'Venue accessibility checklist';
  container.append(heading);
  const description = documentRef.createElement('p');
  description.textContent = 'Use these prompts to confirm practical access details with the venue. Ticks stay in this browser only; do not record a person’s diagnosis or private accommodation details here.';
  container.append(description);
  const fieldset = documentRef.createElement('fieldset');
  const legend = documentRef.createElement('legend');
  legend.textContent = 'Access details to confirm';
  fieldset.append(legend);
  const status = documentRef.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = state.message;
  VENUE_ACCESSIBILITY_ITEMS.forEach(({ id, label }) => {
    const row = documentRef.createElement('label');
    const checkbox = documentRef.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked[id];
    checkbox.addEventListener('change', () => {
      checked[id] = checkbox.checked === true;
      status.textContent = writeVenueAccessibilityState(resolvedStorage, userId, checked)
        ? 'Checklist ticks saved only in this browser for this host account.'
        : 'Checklist ticks stay on this page because browser storage is unavailable.';
    });
    const text = documentRef.createElement('span');
    text.textContent = label;
    row.append(checkbox, text);
    fieldset.append(row);
  });
  container.append(fieldset, status);
  return { checked, persistent: state.persistent };
}
