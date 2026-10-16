export const BUSINESS_PROFILE_CHECKLIST_STORAGE_PREFIX = 'cltch:business-profile-checklist:v1';
export const BUSINESS_PROFILE_CHECKLIST_ITEMS = Object.freeze([
  Object.freeze({ id: 'identity', label: 'My business or venue name and profile details are accurate.' }),
  Object.freeze({ id: 'contact', label: 'The public contact route I use for booking questions is current.' }),
  Object.freeze({ id: 'online-presence', label: 'My website or public listing is current, if I use one.' }),
  Object.freeze({ id: 'booking-payment', label: 'I have reviewed the booking and performer payment expectations shown on my profile.' }),
  Object.freeze({ id: 'requirements', label: 'I have reviewed any permits, insurance, and compliance requirements that apply to my business.' })
]);

function emptyChecked() {
  return Object.fromEntries(BUSINESS_PROFILE_CHECKLIST_ITEMS.map(({ id }) => [id, false]));
}

function storageKey(userId) {
  if (typeof userId !== 'string' || !userId.trim()) return null;
  return `${BUSINESS_PROFILE_CHECKLIST_STORAGE_PREFIX}:${encodeURIComponent(userId.trim())}`;
}

export function readBusinessProfileChecklist(storage, userId) {
  const checked = emptyChecked();
  const key = storageKey(userId);
  if (!key || !storage) return { checked, persistent: false, message: 'Checklist ticks stay on this page because browser storage is unavailable.' };
  try {
    const raw = storage.getItem(key);
    if (!raw) return { checked, persistent: true, message: 'Checklist ticks are saved only in this browser for this host account.' };
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || parsed.userId !== userId || !parsed.checked || typeof parsed.checked !== 'object') {
      return { checked, persistent: true, message: 'Saved checklist data was invalid and has been reset.' };
    }
    BUSINESS_PROFILE_CHECKLIST_ITEMS.forEach(({ id }) => { checked[id] = parsed.checked[id] === true; });
    return { checked, persistent: true, message: 'Checklist ticks are saved only in this browser for this host account.' };
  } catch {
    return { checked, persistent: false, message: 'Checklist ticks stay on this page because browser storage is blocked.' };
  }
}

export function writeBusinessProfileChecklist(storage, userId, checked) {
  const key = storageKey(userId);
  if (!key || !storage) return false;
  const bounded = emptyChecked();
  BUSINESS_PROFILE_CHECKLIST_ITEMS.forEach(({ id }) => { bounded[id] = checked?.[id] === true; });
  try {
    storage.setItem(key, JSON.stringify({ version: 1, userId, checked: bounded }));
    return true;
  } catch {
    return false;
  }
}

export function mountBusinessProfileChecklist(container, { storage, userId, documentRef = globalThis.document } = {}) {
  if (!container || !documentRef) return null;
  let resolvedStorage = storage;
  if (resolvedStorage === undefined) {
    try { resolvedStorage = globalThis.localStorage; } catch { resolvedStorage = null; }
  }
  const state = readBusinessProfileChecklist(resolvedStorage, userId);
  const checked = { ...state.checked };
  container.replaceChildren();

  const heading = documentRef.createElement('h2');
  heading.textContent = 'Business profile readiness checklist';
  container.append(heading);
  const description = documentRef.createElement('p');
  description.textContent = 'Self-attested checklist only. CLTCH does not verify or certify this business. Checking items does not create a verified status. Ticks are stored only in this browser for this host account; do not add private evidence or notes.';
  container.append(description);

  const fieldset = documentRef.createElement('fieldset');
  const legend = documentRef.createElement('legend');
  legend.textContent = 'Business details to review';
  fieldset.append(legend);
  BUSINESS_PROFILE_CHECKLIST_ITEMS.forEach(({ id, label }) => {
    const row = documentRef.createElement('label');
    const checkbox = documentRef.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked[id];
    checkbox.addEventListener('change', () => {
      checked[id] = checkbox.checked === true;
      status.textContent = writeBusinessProfileChecklist(resolvedStorage, userId, checked)
        ? 'Checklist ticks saved only in this browser for this host account.'
        : 'Checklist ticks stay on this page because browser storage is blocked.';
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
