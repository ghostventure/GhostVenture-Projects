export const VENUE_DETAILS_STORAGE_PREFIX = 'cltch:venue-details:v1';
export const VENUE_EQUIPMENT_OPTIONS = Object.freeze([
  Object.freeze({ id: 'pa', label: 'PA system' }),
  Object.freeze({ id: 'mixer', label: 'Audio mixer' }),
  Object.freeze({ id: 'speakers', label: 'House speakers' }),
  Object.freeze({ id: 'microphones', label: 'Microphones' }),
  Object.freeze({ id: 'monitors', label: 'Stage monitors' }),
  Object.freeze({ id: 'di-boxes', label: 'DI boxes' }),
  Object.freeze({ id: 'drum-kit', label: 'Drum kit' }),
  Object.freeze({ id: 'guitar-amp', label: 'Guitar amplifier' }),
  Object.freeze({ id: 'bass-amp', label: 'Bass amplifier' }),
  Object.freeze({ id: 'keyboard', label: 'Keyboard' }),
  Object.freeze({ id: 'lighting', label: 'Stage lighting' }),
  Object.freeze({ id: 'projector', label: 'Projector or screen' }),
  Object.freeze({ id: 'stage-ramp', label: 'Portable stage ramp' }),
  Object.freeze({ id: 'dressing-room', label: 'Private preparation room' })
]);

function storageKey(userId) {
  if (typeof userId !== 'string' || !userId.trim()) return null;
  return `${VENUE_DETAILS_STORAGE_PREFIX}:${encodeURIComponent(userId.trim())}`;
}

function emptyVenueDetails() {
  return { standingCapacity: '', seatedCapacity: '', equipment: [] };
}

export function normalizeVenueDetails(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const capacity = (value) => {
    if (value === '' || value === null || value === undefined) return '';
    if (!Number.isInteger(value) || value < 1 || value > 50000) return null;
    return value;
  };
  const standingCapacity = capacity(input.standingCapacity);
  const seatedCapacity = capacity(input.seatedCapacity);
  if (standingCapacity === null || seatedCapacity === null) return null;
  if (!Array.isArray(input.equipment) || input.equipment.length > VENUE_EQUIPMENT_OPTIONS.length) return null;
  const allowed = new Set(VENUE_EQUIPMENT_OPTIONS.map(({ id }) => id));
  const equipment = [...new Set(input.equipment.filter((id) => typeof id === 'string' && allowed.has(id)))];
  if (equipment.length !== input.equipment.length) return null;
  return { standingCapacity, seatedCapacity, equipment };
}

export function readVenueDetails(storage, userId) {
  const key = storageKey(userId);
  if (!key || !storage) return { details: emptyVenueDetails(), persistent: false, recovered: false };
  try {
    const raw = storage.getItem(key);
    if (!raw) return { details: emptyVenueDetails(), persistent: true, recovered: false };
    const record = JSON.parse(raw);
    if (record?.version !== 1 || record.userId !== userId) return { details: emptyVenueDetails(), persistent: true, recovered: true };
    const details = normalizeVenueDetails(record.details);
    if (!details) return { details: emptyVenueDetails(), persistent: true, recovered: true };
    return { details, persistent: true, recovered: false };
  } catch {
    return { details: emptyVenueDetails(), persistent: false, recovered: true };
  }
}

export function saveVenueDetails(storage, userId, details) {
  const key = storageKey(userId);
  const normalized = normalizeVenueDetails(details);
  if (!key || !storage || !normalized) return false;
  try {
    storage.setItem(key, JSON.stringify({ version: 1, userId, details: normalized }));
    return true;
  } catch { return false; }
}

export function clearVenueDetails(storage, userId) {
  const key = storageKey(userId);
  if (!key || !storage) return false;
  try { storage.removeItem(key); return true; } catch { return false; }
}

export function mountVenueDetailsForm(container, { storage, userId, documentRef = globalThis.document } = {}) {
  if (!container || !documentRef) return null;
  let resolvedStorage = storage;
  if (resolvedStorage === undefined) {
    try { resolvedStorage = globalThis.localStorage; } catch { resolvedStorage = null; }
  }
  const loaded = readVenueDetails(resolvedStorage, userId);
  const details = { ...loaded.details, equipment: [...loaded.details.equipment] };
  container.replaceChildren();

  const form = documentRef.createElement('form');
  form.noValidate = true;
  const capacityGroup = documentRef.createElement('fieldset');
  const capacityLegend = documentRef.createElement('legend');
  capacityLegend.textContent = 'Venue capacity';
  capacityGroup.append(capacityLegend);
  const makeCapacityInput = (id, labelText, value) => {
    const label = documentRef.createElement('label');
    label.htmlFor = id;
    label.textContent = labelText;
    const input = documentRef.createElement('input');
    input.id = id;
    input.name = id;
    input.type = 'number';
    input.min = '1';
    input.max = '50000';
    input.step = '1';
    input.inputMode = 'numeric';
    input.value = value === '' ? '' : String(value);
    label.append(input);
    capacityGroup.append(label);
    return input;
  };
  const standing = makeCapacityInput('standingCapacity', 'Maximum standing capacity', details.standingCapacity);
  const seated = makeCapacityInput('seatedCapacity', 'Maximum seated capacity', details.seatedCapacity);
  const equipmentGroup = documentRef.createElement('fieldset');
  const equipmentLegend = documentRef.createElement('legend');
  equipmentLegend.textContent = 'Available equipment and facilities';
  equipmentGroup.append(equipmentLegend);
  const selected = new Set(details.equipment);
  const checkboxes = [];
  VENUE_EQUIPMENT_OPTIONS.forEach(({ id, label: text }) => {
    const label = documentRef.createElement('label');
    const input = documentRef.createElement('input');
    input.type = 'checkbox';
    input.name = 'equipment';
    input.value = id;
    input.checked = selected.has(id);
    const description = documentRef.createElement('span');
    description.textContent = text;
    label.append(input, description);
    equipmentGroup.append(label);
    checkboxes.push(input);
  });
  const save = documentRef.createElement('button');
  save.type = 'submit';
  save.textContent = 'Save venue details';
  const clear = documentRef.createElement('button');
  clear.type = 'button';
  clear.textContent = 'Clear saved details';
  const status = documentRef.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = !loaded.persistent
    ? 'Browser storage is unavailable. Changes will remain only while this page is open.'
    : loaded.recovered
      ? 'Saved data was invalid or unavailable and has been reset.'
      : 'Venue details are saved only in this browser for this host account.';
  form.append(capacityGroup, equipmentGroup, save, clear, status);
  container.append(form);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const readNumber = (input) => input.value === '' ? '' : Number(input.value);
    const next = {
      standingCapacity: readNumber(standing),
      seatedCapacity: readNumber(seated),
      equipment: checkboxes.filter((input) => input.checked).map((input) => input.value)
    };
    const normalized = normalizeVenueDetails(next);
    if (!normalized) {
      status.textContent = 'Enter whole-number capacities from 1 to 50,000, or leave them blank.';
      (standing.value && !Number.isInteger(Number(standing.value)) || Number(standing.value) > 50000 || Number(standing.value) < 1 ? standing : seated).focus();
      return;
    }
    if (saveVenueDetails(resolvedStorage, userId, normalized)) {
      details.standingCapacity = normalized.standingCapacity;
      details.seatedCapacity = normalized.seatedCapacity;
      details.equipment = normalized.equipment;
      status.textContent = 'Venue details saved only in this browser for this host account.';
    } else {
      status.textContent = 'Could not save venue details. They remain in the form until you leave this page.';
    }
  });
  clear.addEventListener('click', () => {
    const confirmed = typeof globalThis.confirm === 'function' && globalThis.confirm('Clear the venue capacity and equipment details saved in this browser for this host account?');
    if (!confirmed) return;
    const cleared = clearVenueDetails(resolvedStorage, userId);
    standing.value = '';
    seated.value = '';
    checkboxes.forEach((input) => { input.checked = false; });
    status.textContent = cleared
      ? 'Saved venue details were cleared from this browser for this host account.'
      : 'Could not clear browser storage. The form is empty, but saved details may remain.';
  });
  return { details, persistent: loaded.persistent, recovered: loaded.recovered };
}
