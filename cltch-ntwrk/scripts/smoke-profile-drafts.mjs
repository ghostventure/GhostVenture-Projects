import assert from 'node:assert/strict';

const values = new Map();
let storageBlocked = false;
globalThis.localStorage = {
  getItem(key) { if (storageBlocked) throw new Error('blocked'); return values.get(key) ?? null; },
  setItem(key, value) { if (storageBlocked) throw new Error('blocked'); values.set(key, String(value)); },
  removeItem(key) { if (storageBlocked) throw new Error('blocked'); values.delete(key); }
};
globalThis.document = {
  visibilityState: 'visible',
  listeners: {},
  addEventListener(name, callback) { this.listeners[name] = callback; }
};
globalThis.window = {
  listeners: {},
  addEventListener(name, callback) { this.listeners[name] = callback; },
  setTimeout,
  clearTimeout
};

const { initProfileDrafts } = await import('../app/profile-drafts.js');

function makeForm(value) {
  const form = { listeners: {}, addEventListener(name, callback) { this.listeners[name] = callback; } };
  const input = { value };
  globalThis.document.getElementById = () => input;
  return { form, input };
}

const first = makeForm('host A');
const firstStatuses = [];
const a = initProfileDrafts({
  form: first.form,
  key: 'profile-draft-smoke',
  ownerId: 'user-A',
  fields: [{ id: 'field' }],
  onStatus: (value) => firstStatuses.push(value)
});
first.form.listeners.input();
await new Promise((resolve) => setTimeout(resolve, 220));
const scopedKey = 'profile-draft-smoke:user-A';
const envelope = JSON.parse(values.get(scopedKey));
assert.equal(envelope.__cltchDraft, 2);
assert.equal(envelope.payload.field, 'host A');
assert.ok(envelope.updatedAt > 0);

const second = makeForm('host B');
let restoredB = false;
initProfileDrafts({
  form: second.form,
  key: 'profile-draft-smoke',
  ownerId: 'user-B',
  fields: [{ id: 'field' }],
  onRestore: () => { restoredB = true; }
});
assert.equal(restoredB, false, 'a second account must not restore the first account draft');

values.set('profile-draft-smoke:user-C', JSON.stringify({
  __cltchDraft: 2,
  updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
  payload: { field: 'stale' }
}));
const third = makeForm('host C');
initProfileDrafts({
  form: third.form,
  key: 'profile-draft-smoke',
  ownerId: 'user-C',
  fields: [{ id: 'field' }]
});
assert.equal(values.has('profile-draft-smoke:user-C'), false, 'expired drafts must be cleared');

storageBlocked = true;
const fourth = makeForm('host D');
const fourthStatuses = [];
initProfileDrafts({
  form: fourth.form,
  key: 'profile-draft-smoke',
  ownerId: 'user-D',
  fields: [{ id: 'field' }],
  onStatus: (value) => fourthStatuses.push(value)
});
fourth.form.listeners.input();
await new Promise((resolve) => setTimeout(resolve, 220));
assert.ok(fourthStatuses.some((value) => value.includes('only for this open page')));
storageBlocked = false;
a.clear();

console.log('Profile draft smoke passed: account isolation, seven-day expiry, and blocked-storage recovery.');
