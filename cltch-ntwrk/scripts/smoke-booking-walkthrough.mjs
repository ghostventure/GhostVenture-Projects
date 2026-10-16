import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBookingWalkthrough } from '../app/booking-walkthrough.js';

const memory = new Map();
const storage = {
  getItem(key) { return memory.get(key) ?? null; },
  setItem(key, value) { memory.set(key, value); }
};
const steps = [
  { title: 'Profile', href: 'musician-profile.html' },
  { title: 'Matches', href: '#matchedQueueList' },
  { title: 'Booking', href: '#upcomingSection' }
];
const key = 'cltch.booking-walkthrough.v1.user-a';
const flow = createBookingWalkthrough(steps, { storage, storageKey: key, suggestedIndex: 1 });
assert.equal(flow.getView().status, 'not-started');
assert.equal(flow.dispatch('start').step.title, 'Matches', 'start uses the context-derived recommended step');
assert.equal(flow.dispatch('back').step.title, 'Profile', 'Back permits revisiting earlier instructions');
assert.equal(flow.dispatch('next').step.title, 'Matches');
assert.equal(flow.dispatch('skip').status, 'skipped', 'skip pauses without deleting progress');
const resumed = createBookingWalkthrough(steps, { storage, storageKey: key, suggestedIndex: 0 });
assert.equal(resumed.dispatch('resume').step.title, 'Matches', 'resume restores the saved step instead of the new suggestion');
assert.equal(resumed.dispatch('next').step.title, 'Booking');
assert.equal(resumed.dispatch('next').status, 'complete', 'last step can finish the tutorial');
assert.equal(resumed.dispatch('restart').step.title, 'Profile', 'restart returns to the current context recommendation');

const dashboard = await readFile(new URL('../musician-dashboard.html', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../app/booking-walkthrough.js', import.meta.url), 'utf8');
assert.match(dashboard, /createBookingWalkthrough, renderBookingWalkthrough/);
assert.match(dashboard, /storageKey: `cltch\.booking-walkthrough\.v1\.\$\{MUSICIAN_ID\}`/);
assert.match(dashboard, /aria-label="First booking tutorial" aria-live="polite"/);
assert.match(dashboard, /href: 'musician-profile\.html'/);
assert.match(dashboard, /href: '#matchedQueueList'/);
assert.match(dashboard, /href: '#upcomingSection'/);
assert.match(dashboard, /suggestedIndex: profileReady \?/);
assert.match(moduleSource, /data-walkthrough-action="skip"/);
assert.match(moduleSource, /data-walkthrough-action="restart"/);
assert.match(moduleSource, /data-walkthrough-action="resume"/);
console.log('Booking walkthrough smoke passed.');
