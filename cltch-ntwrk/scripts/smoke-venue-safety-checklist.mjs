import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mountVenueSafetyChecklist, readVenueSafetyState, VENUE_SAFETY_ITEMS, writeVenueSafetyState } from '../app/venue-safety-checklist.js';

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
const documentRef = { createElement: () => new Element() };
class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

assert.equal(VENUE_SAFETY_ITEMS.length, 5);
const storage = new MemoryStorage();
const initial = readVenueSafetyState(storage, 'host/one');
assert.equal(initial.persistent, true);
assert.deepEqual(Object.values(initial.checked), [false, false, false, false, false]);
assert.equal(writeVenueSafetyState(storage, 'host/one', { exits: true, arrival: true, privateContact: 'secret' }), true);
const restored = readVenueSafetyState(storage, 'host/one');
assert.equal(restored.checked.exits, true);
assert.equal(restored.checked.arrival, true);
assert.equal(Object.hasOwn(restored.checked, 'privateContact'), false);
assert.equal(readVenueSafetyState(storage, 'host/two').checked.exits, false);
assert.equal([...storage.values.keys()][0].includes(encodeURIComponent('host/one')), true);

const container = new Element();
mountVenueSafetyChecklist(container, { storage, userId: 'host/one', documentRef });
assert.equal(container.children[0].text, 'Venue safety checklist');
const fieldset = container.children[2];
assert.equal(fieldset.children[0].text, 'Safety topics to review');
const rows = fieldset.children.slice(1);
assert.equal(rows.length, VENUE_SAFETY_ITEMS.length);
assert.equal(rows.every((row) => row.children[0].type === 'checkbox' && row.children[1].text), true);
assert.match(container.children[1].text, /Do not enter names, phone numbers, access codes/);
rows[1].children[0].checked = true;
rows[1].children[0].listeners.change();
assert.match(container.children[3].text, /saved in this browser/);
assert.equal(readVenueSafetyState(storage, 'host/one').checked.arrival, true);
assert.deepEqual(container.children[3].attributes, { role: 'status', 'aria-live': 'polite' });

const blockedStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
const blockedState = readVenueSafetyState(blockedStorage, 'host-blocked');
assert.equal(blockedState.persistent, false);
assert.match(blockedState.message, /stay on this page/);
const blockedContainer = new Element();
mountVenueSafetyChecklist(blockedContainer, { storage: blockedStorage, userId: 'host-blocked', documentRef });
blockedContainer.children[2].children[1].children[0].checked = true;
blockedContainer.children[2].children[1].children[0].listeners.change();
assert.match(blockedContainer.children[3].text, /stay on this page/);
assert.equal(writeVenueSafetyState(storage, '', { exits: true }), false);

const hostPage = await readFile(new URL('../host.html', import.meta.url), 'utf8');
assert.match(hostPage, /id="venueSafetyChecklist"[^>]*aria-label="Venue safety checklist"/);
assert.match(hostPage, /import \{ mountVenueSafetyChecklist \} from "\.\/app\/venue-safety-checklist\.js"/);
assert.match(hostPage, /HOST_ID = freshUser\.uid;\s*mountVenueSafetyChecklist\([^\n]+userId: HOST_ID/);
assert.doesNotMatch(hostPage, /venueSafetyChecklist[\s\S]{0,200}(?:setDoc|updateDoc|addDoc)/);

console.log('Venue safety checklist smoke passed (host-scoped local state, accessible ticks, bounded data, storage fallback).');
