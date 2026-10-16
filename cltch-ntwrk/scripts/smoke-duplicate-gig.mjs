import assert from 'node:assert/strict';
import { findPotentialDuplicateGig } from '../app/duplicate-gig.js';

const candidate = {
  hostId: 'host-1', venue: 'Blue Note', location: '  1 Main   St ', date: '2026-11-14', time: '19:30'
};
const existing = [
  { hostId: 'host-2', venue: 'Blue Note', location: '1 Main St', date: '2026-11-14', time: '19:30', status: 'open' },
  { hostId: 'host-1', venue: ' Blue   Note ', location: '1 Main St', date: '2026-11-14', time: '19:30', status: 'accepted' }
];
assert.equal(findPotentialDuplicateGig(candidate, existing), existing[1]);
assert.equal(findPotentialDuplicateGig(candidate, [{ ...existing[1], status: 'cancelled' }]), null);
assert.equal(findPotentialDuplicateGig(candidate, [{ ...existing[1], date: '2026-11-15' }]), null);
assert.equal(findPotentialDuplicateGig({ ...candidate, time: '' }, existing), null);

console.log('Duplicate gig smoke passed: same-host venue/location/date/time detection and terminal-state exclusion.');
