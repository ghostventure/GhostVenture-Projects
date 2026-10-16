import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GIG_PREP_BOOKING_LIMIT,
  GIG_PREP_STORAGE_PREFIX,
  GIG_PREP_TASKS,
  persistGigPrepState,
  readGigPrepState,
  renderGigPrepChecklists,
  selectUpcomingAcceptedBookings,
  updateGigPrepState
} from '../app/gig-prep-checklist.js';

class FakeStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

class FakeNode {
  constructor(tagName) { this.tagName = tagName; this.children = []; this.dataset = {}; this.listeners = {}; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
}

const userId = 'performer-A';
const today = '2026-10-16';
const candidates = [
  { id: 'today', acceptedBy: userId, status: 'accepted', date: today, time: '20:00', venue: '<Club>' },
  { id: 'future', acceptedBy: userId, status: 'accepted', date: '2026-10-17', time: '19:00' },
  { id: 'past', acceptedBy: userId, status: 'accepted', date: '2026-10-15' },
  { id: 'open', acceptedBy: userId, status: 'open', date: '2026-10-17' },
  { id: 'other-owner', acceptedBy: 'performer-B', status: 'accepted', date: '2026-10-17' },
  { id: 'invalid-date', acceptedBy: userId, status: 'accepted', date: '2026-02-30' },
  { acceptedBy: userId, status: 'accepted', date: '2026-10-18' }
];
const upcoming = selectUpcomingAcceptedBookings(candidates, userId, today);
assert.deepEqual(upcoming.map((booking) => booking.id), ['today', 'future']);
assert.equal(selectUpcomingAcceptedBookings(candidates, '', today).length, 0);
assert.equal(selectUpcomingAcceptedBookings(candidates, userId, 'invalid').length, 0);

const storage = new FakeStorage();
const key = `${GIG_PREP_STORAGE_PREFIX}:${encodeURIComponent(userId)}`;
let readState = readGigPrepState(userId, storage);
assert.equal(readState.persisted, true);
let checked = updateGigPrepState(readState.checkedByBooking, 'today', 'details', true);
assert.deepEqual(checked.today, ['details']);
assert.deepEqual(updateGigPrepState(checked, 'today', 'not-a-task', true), checked);
assert.equal(persistGigPrepState(userId, checked, storage), true);
assert.deepEqual(readGigPrepState(userId, storage).checkedByBooking.today, ['details']);
assert.deepEqual(readGigPrepState('performer-B', storage).checkedByBooking, Object.create(null));
assert.match(key, /performer-A/);
assert.doesNotMatch(storage.getItem(key), /Club|2026-10-16|20:00/, 'only booking IDs and checked task IDs should persist');
assert.equal(JSON.parse(storage.getItem(key)).userId, userId);

const capped = Object.fromEntries(Array.from({ length: GIG_PREP_BOOKING_LIMIT + 5 }, (_, index) => [`gig-${index}`, ['details']]));
assert.equal(persistGigPrepState(userId, capped, storage), true);
assert.equal(Object.keys(readGigPrepState(userId, storage).checkedByBooking).length, GIG_PREP_BOOKING_LIMIT);

const corruptStorage = new FakeStorage();
corruptStorage.setItem(key, '{bad json');
assert.equal(readGigPrepState(userId, corruptStorage).recovered, true);
const ownerMismatch = new FakeStorage();
ownerMismatch.setItem(key, JSON.stringify({ version: 1, userId: 'performer-B', checkedByBooking: { gig: ['details'] } }));
assert.equal(readGigPrepState(userId, ownerMismatch).recovered, true);
const deniedStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
assert.equal(readGigPrepState(userId, deniedStorage).persisted, false);
assert.equal(persistGigPrepState(userId, checked, deniedStorage), false);

const documentRef = { createElement: (tag) => new FakeNode(tag) };
const container = new FakeNode('div');
let changed = null;
renderGigPrepChecklists(container, upcoming, { today: ['details'] }, (...args) => { changed = args; }, documentRef);
assert.equal(container.children.length, 2);
const firstCard = container.children[0];
assert.equal(firstCard.tagName, 'article');
assert.equal(firstCard.children[0].textContent, '<Club>');
assert.equal(firstCard.children[2].href, 'booking.html?id=today');
const fieldset = firstCard.children[3];
assert.equal(fieldset.children[0].tagName, 'legend');
assert.equal(fieldset.children.length, GIG_PREP_TASKS.length + 1);
const firstLabel = fieldset.children[1];
assert.equal(firstLabel.tagName, 'label');
assert.equal(firstLabel.children[0].type, 'checkbox');
assert.equal(firstLabel.children[0].checked, true);
firstLabel.children[0].checked = false;
firstLabel.children[0].listeners.change();
assert.deepEqual(changed, ['today', 'details', false]);

const page = await readFile(new URL('../gig-prep.html', import.meta.url), 'utf8');
const dashboard = await readFile(new URL('../musician-dashboard.html', import.meta.url), 'utf8');
const queries = await readFile(new URL('../app/gig-queries.js', import.meta.url), 'utf8');
assert.match(page, /onAuthStateChanged\(auth/);
assert.match(page, /buildAcceptedGigQuery\(db, user\.uid, \{ today: isoToday\(\) \}\)/);
assert.match(page, /selectUpcomingAcceptedBookings\(records, user\.uid, isoToday\(\)\)/);
assert.match(page, /Sign in to view preparation checklists/);
assert.match(page, /Could not load your upcoming accepted bookings/);
assert.match(page, /Retry loading bookings/);
assert.match(page, /Checklist progress will last only until this page closes/);
assert.doesNotMatch(page, /\b(?:addDoc|setDoc|updateDoc|runTransaction|writeBatch)\s*\(/);
assert.match(dashboard, /href="gig-prep\.html">Prepare for gigs/);
assert.match(queries, /where\("acceptedBy", "==", musicianId\)/);
assert.match(queries, /where\("status", "==", "accepted"\)/);
assert.match(queries, /where\("date", ">=", today\)/);
assert.match(queries, /export const ACCEPTED_GIG_QUERY_LIMIT = 120/);
assert.match(queries, /function buildAcceptedGigQuery\([\s\S]*?limit\(limitCount\)/);
assert.equal(GIG_PREP_TASKS.length, 7);

console.log('Gig prep checklist smoke passed (owner gating, local persistence, bounds, storage fallback, accessible checklist).');
