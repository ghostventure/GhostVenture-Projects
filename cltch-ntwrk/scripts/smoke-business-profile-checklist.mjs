import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  BUSINESS_PROFILE_CHECKLIST_ITEMS,
  mountBusinessProfileChecklist,
  readBusinessProfileChecklist,
  writeBusinessProfileChecklist
} from '../app/business-profile-checklist.js';

class Element {
  children = [];
  listeners = {};
  attributes = {};
  checked = false;
  append(...items) { this.children.push(...items); }
  replaceChildren() { this.children = []; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  setAttribute(name, value) { this.attributes[name] = value; }
  set textContent(value) { this.text = value; }
  get textContent() { return this.text; }
}
class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}
const documentRef = { createElement: () => new Element() };
assert.equal(BUSINESS_PROFILE_CHECKLIST_ITEMS.length, 5);
const storage = new MemoryStorage();
const empty = readBusinessProfileChecklist(storage, 'host/one');
assert.equal(empty.persistent, true);
assert.deepEqual(Object.values(empty.checked), [false, false, false, false, false]);
assert.equal(writeBusinessProfileChecklist(storage, 'host/one', {
  identity: true,
  contact: true,
  privateNotes: 'should not persist',
  payoutHandle: 'sensitive'
}), true);
const key = [...storage.values.keys()][0];
assert.match(key, /host%2Fone$/);
const serialized = storage.values.get(key);
assert.doesNotMatch(serialized, /privateNotes|payoutHandle|sensitive|should not persist/);
const restored = readBusinessProfileChecklist(storage, 'host/one');
assert.equal(restored.checked.identity, true);
assert.equal(restored.checked.contact, true);
assert.equal(Object.hasOwn(restored.checked, 'privateNotes'), false);
assert.equal(readBusinessProfileChecklist(storage, 'host/two').checked.identity, false, 'states must be UID-scoped');

const container = new Element();
mountBusinessProfileChecklist(container, { storage, userId: 'host/one', documentRef });
assert.equal(container.children[0].text, 'Business profile readiness checklist');
assert.match(container.children[1].text, /Self-attested checklist only/);
assert.match(container.children[1].text, /does not verify or certify this business/);
assert.match(container.children[1].text, /does not create a verified status/);
const fieldset = container.children[2];
assert.equal(fieldset.children[0].text, 'Business details to review');
const rows = fieldset.children.slice(1);
assert.equal(rows.length, BUSINESS_PROFILE_CHECKLIST_ITEMS.length);
assert.equal(rows.every((row) => row.children[0].type === 'checkbox' && row.children[1].text), true);
assert.equal(rows[0].children[0].checked, true);
assert.deepEqual(container.children[3].attributes, { role: 'status', 'aria-live': 'polite' });
rows[0].children[0].checked = false;
rows[0].children[0].listeners.change();
assert.match(container.children[3].text, /saved only in this browser/);
assert.equal(readBusinessProfileChecklist(storage, 'host/one').checked.identity, false);

const blockedStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
const blocked = readBusinessProfileChecklist(blockedStorage, 'host-blocked');
assert.equal(blocked.persistent, false);
assert.match(blocked.message, /stay on this page/);
const blockedContainer = new Element();
mountBusinessProfileChecklist(blockedContainer, { storage: blockedStorage, userId: 'host-blocked', documentRef });
blockedContainer.children[2].children[1].children[0].checked = true;
blockedContainer.children[2].children[1].children[0].listeners.change();
assert.match(blockedContainer.children[3].text, /stay on this page/);
assert.equal(writeBusinessProfileChecklist(storage, '', { identity: true }), false);

const [page, module] = await Promise.all([
  readFile(new URL('../host-profile.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/business-profile-checklist.js', import.meta.url), 'utf8')
]);
assert.match(page, /id="businessProfileChecklist"[^>]*aria-label="Business profile readiness checklist"/);
assert.match(page, /import \{ mountBusinessProfileChecklist \} from "\.\/app\/business-profile-checklist\.js"/);
assert.match(page, /HOST_ID = freshUser\.uid;\s*mountBusinessProfileChecklist\(document\.getElementById\('businessProfileChecklist'\), \{ userId: HOST_ID \}\)/);
assert.doesNotMatch(module, /(?:getDoc|setDoc|updateDoc|addDoc|fetch\s*\()/);
assert.doesNotMatch(module, /innerHTML/);
console.log('Business profile checklist smoke passed (self-attested copy, UID-local bounded state, accessibility, storage fallback).');
