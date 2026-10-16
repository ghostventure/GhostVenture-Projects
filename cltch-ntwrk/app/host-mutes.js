export const HOST_MUTES_STORAGE_PREFIX = 'cltch:host-mutes:v1';
export const MAX_HOST_MUTES = 100;

function storageKey(userId) {
  if (typeof userId !== 'string' || !userId.trim() || userId.trim().length > 128) return null;
  return `${HOST_MUTES_STORAGE_PREFIX}:${encodeURIComponent(userId.trim())}`;
}

function validHostId(value) {
  return typeof value === 'string' && value.trim().length > 0
    && value.trim().length <= 128 && !/[\u0000-\u001f\u007f]/.test(value);
}

function cleanHostIds(values) {
  if (!Array.isArray(values)) return [];
  const result = [];
  const seen = new Set();
  for (const value of values) {
    if (!validHostId(value)) continue;
    const id = value.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= MAX_HOST_MUTES) break;
  }
  return result;
}

export function readHostMutes(storage, userId) {
  const key = storageKey(userId);
  if (!key || !storage) return { hostIds: [], persistent: false, message: 'Host mutes stay only for this page session because browser storage is unavailable.' };
  try {
    const raw = storage.getItem(key);
    if (!raw) return { hostIds: [], persistent: true, message: 'No hosts are muted. Changes are local to this browser and device.' };
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || parsed.userId !== userId || !Array.isArray(parsed.hostIds)) {
      return { hostIds: [], persistent: true, message: 'Saved host mutes were invalid and have been reset.' };
    }
    return {
      hostIds: cleanHostIds(parsed.hostIds),
      persistent: true,
      message: 'Host mutes are saved only in this browser for this account.'
    };
  } catch {
    return { hostIds: [], persistent: false, message: 'Host mutes stay only for this page session because browser storage is blocked.' };
  }
}

export function filterMutedHostMatches(items, hostIds) {
  const muted = hostIds instanceof Set ? hostIds : new Set(cleanHostIds(hostIds));
  return (Array.isArray(items) ? items : []).filter((item) => {
    const hostId = item?.g?.hostId ?? item?.hostId;
    return !validHostId(hostId) || !muted.has(hostId.trim());
  });
}

export function createHostMuteController({ storage, userId } = {}) {
  let resolvedStorage = storage;
  if (resolvedStorage === undefined) {
    try { resolvedStorage = globalThis.localStorage; } catch { resolvedStorage = null; }
  }
  const initial = readHostMutes(resolvedStorage, userId);
  const muted = new Set(initial.hostIds);
  const listeners = new Set();
  let persistent = initial.persistent;
  let message = initial.message;
  const notify = () => listeners.forEach((listener) => listener(getStatus()));
  const getStatus = () => ({ count: muted.size, persistent, message });

  function save(nextMessage) {
    if (!storageKey(userId) || !resolvedStorage) {
      persistent = false;
      message = 'This browser cannot save host mutes. They last only while this page is open; booking access is unchanged.';
      notify();
      return false;
    }
    try {
      resolvedStorage.setItem(storageKey(userId), JSON.stringify({ version: 1, userId, hostIds: [...muted].slice(0, MAX_HOST_MUTES) }));
      persistent = true;
      message = nextMessage;
      notify();
      return true;
    } catch {
      persistent = false;
      message = 'Browser storage is blocked. Host mutes last only while this page is open; booking access is unchanged.';
      notify();
      return false;
    }
  }

  return {
    userId,
    isMuted(hostId) { return validHostId(hostId) && muted.has(hostId.trim()); },
    getMutedHostIds() { return new Set(muted); },
    getStatus,
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    mute(hostId) {
      if (!validHostId(hostId) || !storageKey(userId)) return { ok: false, message: 'This host could not be added to the local mute list.' };
      const id = hostId.trim();
      if (muted.has(id)) return { ok: true, message };
      if (muted.size >= MAX_HOST_MUTES) {
        message = `Your browser-local mute list is full (${MAX_HOST_MUTES}). Unmute one host before adding another.`;
        notify();
        return { ok: false, message };
      }
      muted.add(id);
      const saved = save('Host muted from matching in this browser and device. Booking access is unchanged; this is not a safety block.');
      return { ok: true, persistent: saved, message };
    },
    unmute(hostId) {
      if (!validHostId(hostId) || !muted.delete(hostId.trim())) return { ok: false, message };
      const saved = save('Host removed from your browser-local mute list.');
      return { ok: true, persistent: saved, message };
    },
    clear() {
      if (!muted.size) return { ok: true, persistent, message };
      muted.clear();
      const saved = save('All browser-local host mutes were reset. Booking access was never changed.');
      return { ok: true, persistent: saved, message };
    }
  };
}

export function createHostMuteButton(hostId, controller, documentRef = globalThis.document) {
  if (!documentRef || !controller || !validHostId(hostId)) return null;
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.textContent = 'Mute host';
  button.setAttribute('aria-label', 'Mute this host from matching in this browser and device');
  button.style.cssText = 'min-height:38px;padding:8px 12px;border:1px solid #6a5140;border-radius:9px;background:#211b18;color:#f0d6c4;font-size:12px;font-weight:700;cursor:pointer;';
  button.addEventListener('click', () => controller.mute(hostId));
  return button;
}

export function mountHostMutePanel(container, controller, documentRef = globalThis.document) {
  if (!container || !controller || !documentRef) return () => {};
  const make = (tag, text) => {
    const element = documentRef.createElement(tag);
    element.textContent = text;
    return element;
  };
  const render = (status = controller.getStatus()) => {
    container.replaceChildren();
    container.append(make('h2', 'Mute hosts from matching'));
    container.append(make('p', 'This hides a host’s gigs from matching queues only in this browser and on this device. Booking access is unchanged. This is not a safety block and does not prevent contact.'));
    const count = make('p', status.count ? `${status.count} host${status.count === 1 ? '' : 's'} muted on this device.` : 'No hosts are muted.');
    count.setAttribute('aria-live', 'polite');
    container.append(count);
    const hostIds = [...controller.getMutedHostIds()];
    if (hostIds.length) {
      const list = documentRef.createElement('ul');
      list.setAttribute('aria-label', 'Muted hosts');
      hostIds.forEach((hostId, index) => {
        const row = documentRef.createElement('li');
        row.style.cssText = 'display:flex;gap:10px;align-items:center;justify-content:space-between;margin:6px 0;';
        row.append(make('span', `Muted host ${index + 1}`));
        const unmuteButton = make('button', `Unmute host ${index + 1}`);
        unmuteButton.type = 'button';
        unmuteButton.setAttribute('aria-label', `Unmute muted host ${index + 1}`);
        unmuteButton.style.cssText = 'min-height:36px;padding:6px 10px;border:1px solid #425263;border-radius:8px;background:#13202d;color:#f4f7fb;font-weight:700;';
        unmuteButton.addEventListener('click', () => controller.unmute(hostId));
        row.append(unmuteButton);
        list.append(row);
      });
      container.append(list);
    }
    const reset = make('button', 'Reset host mutes');
    reset.type = 'button';
    reset.disabled = status.count === 0;
    reset.setAttribute('aria-label', 'Unmute all muted hosts');
    reset.style.cssText = 'min-height:38px;padding:8px 12px;border:1px solid #425263;border-radius:9px;background:#13202d;color:#f4f7fb;font-weight:700;';
    reset.addEventListener('click', () => controller.clear());
    container.append(reset);
    const statusEl = make('p', status.message);
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');
    container.append(statusEl);
  };
  render();
  return controller.subscribe(render);
}
