export const MATCH_ALERT_STORAGE_PREFIX = 'cltch:match-alerts:v1';
export const MATCH_ALERT_MAX_ITEMS = 30;

const sessionState = new Map();

function validUserId(userId) {
  return typeof userId === 'string' && userId.trim().length > 0 && userId.length <= 128;
}

export function isValidMatchAlertGigId(gigId) {
  return typeof gigId === 'string'
    && gigId.length > 0
    && gigId.length <= 128
    && gigId.trim() === gigId
    && !/[\/\u0000-\u001f\u007f]/.test(gigId);
}

function getStorageKey(userId) {
  return validUserId(userId) ? `${MATCH_ALERT_STORAGE_PREFIX}:${encodeURIComponent(userId.trim())}` : null;
}

function normalizeAlerts(value) {
  if (!Array.isArray(value)) return [];
  const unique = new Map();
  value.slice(0, 300).forEach((item) => {
    if (!item || !isValidMatchAlertGigId(item.gigId)) return;
    const at = Number(item.at);
    if (!Number.isFinite(at) || at < 0) return;
    unique.set(item.gigId, { gigId: item.gigId, at: Math.floor(at) });
  });
  return [...unique.values()].slice(-MATCH_ALERT_MAX_ITEMS);
}

function baseState(userId, enabled = false, alerts = []) {
  return { userId, enabled: enabled === true, alerts: normalizeAlerts(alerts) };
}

function tryRead(storage, userId) {
  const key = getStorageKey(userId);
  if (!key) return { state: baseState(userId), persisted: false, message: 'Alerts are unavailable until your account is identified.' };
  try {
    const raw = storage?.getItem(key);
    if (!raw) return { state: baseState(userId), persisted: !!storage, message: storage ? 'Alerts are off. Turn them on to save new matches in this browser.' : 'Browser storage is unavailable; alerts last only for this page session.' };
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || parsed.userId !== userId) {
      return { state: baseState(userId), persisted: true, message: 'Saved alert settings could not be read. Alerts are off.' };
    }
    return {
      state: baseState(userId, parsed.enabled, parsed.alerts),
      persisted: true,
      message: 'Alert settings and recent match links are saved only in this browser for this account.'
    };
  } catch {
    const cached = sessionState.get(key);
    return {
      state: baseState(userId, cached?.enabled, cached?.alerts),
      persisted: false,
      message: 'Browser storage is blocked. Alert settings and links last only for this page session.'
    };
  }
}

export function readMatchAlerts(storage, userId) {
  return tryRead(storage, userId);
}

function persistState(storage, userId, state) {
  const key = getStorageKey(userId);
  if (!key) return { ...state, persisted: false, message: 'Alerts are unavailable until your account is identified.' };
  const safeState = baseState(userId, state.enabled, state.alerts);
  sessionState.set(key, safeState);
  try {
    if (!storage) throw new Error('Storage unavailable');
    storage.setItem(key, JSON.stringify({ version: 1, userId, enabled: safeState.enabled, alerts: safeState.alerts }));
    return { ...safeState, persisted: true, message: 'Alert settings and recent match links are saved only in this browser for this account.' };
  } catch {
    return { ...safeState, persisted: false, message: 'Browser storage is blocked. Alert settings and links last only for this page session.' };
  }
}

export function setMatchAlertsEnabled(storage, userId, state, enabled) {
  const current = state?.userId === userId ? state : tryRead(storage, userId).state;
  return persistState(storage, userId, baseState(userId, enabled, current.alerts));
}

export function addNewMatchAlerts(storage, userId, state, gigIds, at = Date.now()) {
  const current = state?.userId === userId ? state : tryRead(storage, userId).state;
  if (!current.enabled || !Array.isArray(gigIds)) return current;
  const time = Number(at);
  if (!Number.isFinite(time) || time < 0) return current;
  const nextAlerts = [...current.alerts];
  gigIds.forEach((gigId) => {
    if (!isValidMatchAlertGigId(gigId)) return;
    const existingIndex = nextAlerts.findIndex((item) => item.gigId === gigId);
    if (existingIndex >= 0) nextAlerts.splice(existingIndex, 1);
    nextAlerts.push({ gigId, at: Math.floor(time) });
  });
  return persistState(storage, userId, baseState(userId, true, nextAlerts.slice(-MATCH_ALERT_MAX_ITEMS)));
}

export function clearMatchAlerts(storage, userId, state) {
  const current = state?.userId === userId ? state : tryRead(storage, userId).state;
  return persistState(storage, userId, baseState(userId, current.enabled, []));
}

export function renderMatchAlertPanel(container, state, { onEnabledChange, onClear, documentRef = globalThis.document } = {}) {
  if (!container || !documentRef) return;
  container.replaceChildren();

  const heading = documentRef.createElement('h2');
  heading.textContent = 'New match alerts';
  container.append(heading);

  const explanation = documentRef.createElement('p');
  explanation.textContent = 'Opt in to save links when new gigs enter your matching feed. Alerts stay in this browser for your account; no browser notification permission is requested.';
  container.append(explanation);

  const label = documentRef.createElement('label');
  const checkbox = documentRef.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = state?.enabled === true;
  checkbox.addEventListener('change', () => onEnabledChange?.(checkbox.checked));
  const labelText = documentRef.createElement('span');
  labelText.textContent = 'Enable in-app alerts for new matching gigs';
  label.append(checkbox, labelText);
  container.append(label);

  const status = documentRef.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = state?.message || (state?.enabled ? 'Alerts are on.' : 'Alerts are off.');
  container.append(status);

  const alerts = normalizeAlerts(state?.alerts);
  if (!alerts.length) {
    const empty = documentRef.createElement('p');
    empty.textContent = 'No new match links saved yet.';
    container.append(empty);
  } else {
    const list = documentRef.createElement('ul');
    alerts.slice().reverse().forEach(({ gigId, at }) => {
      const row = documentRef.createElement('li');
      const link = documentRef.createElement('a');
      link.href = `booking.html?id=${encodeURIComponent(gigId)}`;
      link.textContent = 'View new matching gig details';
      const time = documentRef.createElement('span');
      time.textContent = ` · ${new Date(at).toLocaleString()}`;
      row.append(link, time);
      list.append(row);
    });
    container.append(list);
    const clearButton = documentRef.createElement('button');
    clearButton.type = 'button';
    clearButton.textContent = 'Clear saved alerts';
    clearButton.addEventListener('click', () => onClear?.());
    container.append(clearButton);
  }
}
