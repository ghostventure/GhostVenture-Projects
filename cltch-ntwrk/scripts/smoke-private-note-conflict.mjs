import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('./platform-components.js', import.meta.url), 'utf8');
const sandbox = {
  window: { localStorage: null, navigator: {}, addEventListener() {} },
  document: { getElementById() { return null; } },
  URL,
  console
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'scripts/platform-components.js' });

class FakeStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const helpers = sandbox.window.PlatformComponents.privateNoteConflicts;
const storage = new FakeStorage();
const saved = await helpers.compareAndSave(storage, 'private-note', { reason: 'Arrival', note: 'Saved copy' }, '');
assert.equal(saved.status, 'saved');
const draft = { reason: 'Payment', note: 'Unsaved second tab copy', baseRevision: '' };
assert.equal(helpers.saveDraft(storage, 'private-note:draft:tab-b', draft), true);
const conflict = await helpers.compareAndSave(storage, 'private-note', draft, draft.baseRevision);
assert.equal(conflict.status, 'conflict', 'stale tabs cannot overwrite a newer local note');
assert.equal(conflict.current.note, 'Saved copy');
assert.equal(helpers.read(storage, 'private-note:draft:tab-b').note, 'Unsaved second tab copy', 'the conflicting draft remains recoverable');
const resolution = await helpers.compareAndSave(storage, 'private-note', draft, conflict.current.revision);
assert.equal(resolution.status, 'saved', 'the user can save the draft after comparing against the latest version');
assert.equal(resolution.current.note, draft.note);

const raceStorage = new FakeStorage();
const first = await helpers.compareAndSave(raceStorage, 'race-note', { note: 'Base' }, '');
const [tabOne, tabTwo] = await Promise.all([
  helpers.compareAndSave(raceStorage, 'race-note', { note: 'Tab one' }, first.current.revision),
  helpers.compareAndSave(raceStorage, 'race-note', { note: 'Tab two' }, first.current.revision)
]);
assert.equal([tabOne, tabTwo].filter((result) => result.status === 'saved').length, 1, 'concurrent stale saves cannot both replace the same revision');
assert.equal([tabOne, tabTwo].filter((result) => result.status === 'conflict').length, 1, 'the losing tab receives an explicit conflict');

const page = await readFile(new URL('../booking.html', import.meta.url), 'utf8');
assert.match(page, /initDisputeFlow\('disputeFlowComponent', bookingId, freshUser\.uid\)/, 'private note storage is scoped to the signed-in account');
assert.match(source, /This browser has two private note versions/, 'the UI explains local conflicts');
assert.match(source, /Your unsaved draft in this tab/, 'both local versions are labeled for comparison');
assert.match(source, /not shared with support or the other participant/, 'private notes are not presented as synced messages');
assert.match(source, /addEventListener\("storage"/, 'another tab change is detected while the note is open');
assert.match(source, /draftStorage = window\.sessionStorage/, 'each tab keeps an isolated draft that survives reload');
assert.match(source, /baseRevision/, 'drafts remember the saved version they were based on');
console.log('Private booking note conflict smoke passed.');
