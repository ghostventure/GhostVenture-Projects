const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_DRAFT_BYTES = 100_000;
const memoryDrafts = new Map();

function safeParse(value, fallback = {}) {
  try {
    const parsed = JSON.parse(value || "");
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function initProfileDrafts(options = {}) {
  const {
    form,
    key,
    ownerId,
    legacyKey,
    fields = [],
    onStatus = () => {},
    onRestore = () => {}
  } = options;

  if (!form || !key || !fields.length) return {
    clear() {},
    save() {}
  };
  // Profile drafts contain contact and payout identifiers. Keep them scoped to
  // the signed-in account and discard the old shared key so another account on
  // this browser cannot restore it.
  const scopedKey = ownerId ? `${key}:${encodeURIComponent(ownerId)}` : key;
  if (legacyKey) {
    try { localStorage.removeItem(legacyKey); } catch {}
  }
  let saveTimerId = null;
  let lastSavedPayload = "";
  const SAVE_DEBOUNCE_MS = 180;

  function readDraft() {
    let raw = memoryDrafts.get(scopedKey) || "";
    try { raw = localStorage.getItem(scopedKey) || raw; } catch {}
    const stored = safeParse(raw, {});
    if (stored && stored.__cltchDraft === 2) {
      const age = Date.now() - Number(stored.updatedAt);
      if (!Number.isFinite(age) || age < 0 || age > DRAFT_TTL_MS || !stored.payload || typeof stored.payload !== "object") {
        removeDraft();
        return {};
      }
      return stored.payload;
    }
    // A valid previous draft format can be restored once; future writes use
    // the expiring envelope.
    return stored;
  }

  function removeDraft() {
    memoryDrafts.delete(scopedKey);
    try { localStorage.removeItem(scopedKey); } catch {}
  }

  function saveDraft() {
    const payload = {};
    fields.forEach((field) => {
      const el = document.getElementById(field.id);
      if (!el) return;
      payload[field.id] = field.read ? field.read(el) : el.value;
    });
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedPayload) return;
    const envelope = JSON.stringify({ __cltchDraft: 2, updatedAt: Date.now(), payload });
    if (envelope.length > MAX_DRAFT_BYTES) {
      onStatus("Draft is too large to save locally. Keep this page open until you save your profile.");
      return;
    }
    memoryDrafts.set(scopedKey, envelope);
    try { localStorage.setItem(scopedKey, envelope); } catch {
      onStatus("Browser storage is unavailable. Your draft is kept only for this open page.");
      return;
    }
    lastSavedPayload = serialized;
    onStatus("Draft saved locally while you work.");
  }

  function scheduleSaveDraft() {
    if (saveTimerId) window.clearTimeout(saveTimerId);
    saveTimerId = window.setTimeout(() => {
      saveTimerId = null;
      saveDraft();
    }, SAVE_DEBOUNCE_MS);
  }

  function restoreDraft() {
    const draft = readDraft();
    let hasData = false;
    fields.forEach((field) => {
      const el = document.getElementById(field.id);
      if (!el || !(field.id in draft)) return;
      hasData = hasData || !!draft[field.id];
      if (field.write) field.write(el, draft[field.id]);
      else el.value = draft[field.id];
    });
    if (hasData) {
      lastSavedPayload = JSON.stringify(draft);
      onRestore(draft);
      onStatus("Recovered your last unfinished profile draft.");
    }
  }

  function clearDraft() {
    if (saveTimerId) {
      window.clearTimeout(saveTimerId);
      saveTimerId = null;
    }
    removeDraft();
    lastSavedPayload = "";
    onStatus("Draft cleared. New changes will save automatically.");
  }

  form.addEventListener("input", scheduleSaveDraft);
  form.addEventListener("change", scheduleSaveDraft);
  window.addEventListener("pagehide", saveDraft);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveDraft();
  });
  restoreDraft();

  return {
    clear: clearDraft,
    save: saveDraft
  };
}
