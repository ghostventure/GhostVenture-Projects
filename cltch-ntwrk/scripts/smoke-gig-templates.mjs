import assert from 'node:assert/strict';
import { deleteGigTemplate, gigTemplateStorageKey, MAX_GIG_TEMPLATES, readGigTemplates, saveGigTemplate } from '../app/gig-templates.js';
import { readFile } from 'node:fs/promises';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const storage = new MemoryStorage();
const blockedStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
assert.deepEqual(readGigTemplates('host-A', blockedStorage), []);
assert.throws(() => saveGigTemplate('host-A', 'Blocked', {}, blockedStorage), /blocked/);
const fields = { venue: 'Blue Room', location: 'Brooklyn, NY', performerType: 'musician', genre: 'Jazz', pay: '$500', skillNeed: 'Trio', notes: 'Load in at 6' };
const first = saveGigTemplate('host-A', 'Friday jazz', fields, storage);
assert.deepEqual(readGigTemplates('host-A', storage), [first]);
assert.deepEqual(readGigTemplates('host-B', storage), []);
assert.match(gigTemplateStorageKey('host-A'), /host-A/);
assert.throws(() => gigTemplateStorageKey(''), TypeError);
for (let index = 1; index < MAX_GIG_TEMPLATES; index += 1) saveGigTemplate('host-A', `Template ${index}`, fields, storage);
assert.equal(readGigTemplates('host-A', storage).length, MAX_GIG_TEMPLATES);
assert.throws(() => saveGigTemplate('host-A', 'One too many', fields, storage), RangeError);
assert.throws(() => saveGigTemplate('host-A', 'Bad fields', { ...fields, notes: 'x'.repeat(1201) }, new MemoryStorage()), TypeError);
assert.equal(deleteGigTemplate('host-A', first.id, storage).length, MAX_GIG_TEMPLATES - 1);
storage.setItem(gigTemplateStorageKey('host-A'), '{bad json');
assert.deepEqual(readGigTemplates('host-A', storage), []);

const hostPage = await readFile(new URL('../host.html', import.meta.url), 'utf8');
assert.match(hostPage, /Your saved templates/);
assert.match(hostPage, /saved only in this browser/);
assert.match(hostPage, /refreshGigTemplateOptions\(\);\s*applyRebookDraftIfPresent\(\)/);

console.log('Gig template smoke passed: host scoping, storage bounds, malformed data recovery, and UI wiring.');
