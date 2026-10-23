import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { formatHostBookingReliability } from '../app/host-reliability.mjs';

const require = createRequire(import.meta.url);
const { nextHostReliability } = require('../functions/host-reliability.js');
const [functions, rules, radar, display] = await Promise.all([
  readFile(new URL('../functions/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  readFile(new URL('../gig-radar.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/host-reliability.mjs', import.meta.url), 'utf8')
]);

const serverTime = { serverTimestamp: true };
const accepted = nextHostReliability(null, { acceptance: true, serverTime });
assert.deepEqual(accepted, {
  acceptedTransitions: 1,
  hostCancellationsAfterAcceptance: 0,
  coverageStartedAt: serverTime,
  updatedAt: serverTime,
  schemaVersion: 1
});
const cancelled = nextHostReliability(accepted, { hostCancellationAfterAcceptance: true, serverTime: { later: true } });
assert.equal(cancelled.acceptedTransitions, 1, 'Host cancellation does not increase the accepted-transition denominator');
assert.equal(cancelled.hostCancellationsAfterAcceptance, 1, 'Tracked accepted host cancellation increments the numerator');
assert.equal(cancelled.coverageStartedAt, serverTime, 'Coverage start remains the first tracked acceptance');
assert.equal(nextHostReliability(accepted, { serverTime }), null, 'Unrelated actions do not create or change aggregates');
assert.equal(nextHostReliability(null, { hostCancellationAfterAcceptance: true, serverTime }), null, 'Cancellation without a tracked denominator is omitted');
assert.equal(nextHostReliability({ acceptedTransitions: 2, hostCancellationsAfterAcceptance: 2 }, { hostCancellationAfterAcceptance: true, serverTime }), null, 'Aggregate cannot report more cancellations than unmatched accepted transitions');

const label = formatHostBookingReliability({
  acceptedTransitions: 8,
  hostCancellationsAfterAcceptance: 2,
  coverageStartedAt: { toDate: () => new Date('2026-10-23T00:00:00.000Z') }
}, 'en-US');
assert.match(label, /2 host cancellations after acceptance out of 8 accepted booking transitions/);
assert.match(label, /Earlier bookings are not included/);
assert.equal(formatHostBookingReliability({ acceptedTransitions: 2, hostCancellationsAfterAcceptance: 3, coverageStartedAt: new Date() }), '');
assert.equal(formatHostBookingReliability({ acceptedTransitions: 0, hostCancellationsAfterAcceptance: 0, coverageStartedAt: new Date() }), '');

const checks = [
  ['Accept and tracked host cancellation counters update in booking transaction', /recordAcceptance = action === 'accept'/.test(functions) && /gig\.reliabilityAcceptanceTracked === true/.test(functions) && /tx\.set\(reliabilityRef, next\)/.test(functions)],
  ['Only server booking actions can set and clear the per-gig coverage marker', /reliabilityAcceptanceTracked: true/.test(functions) && /reliabilityAcceptanceTracked: admin\.firestore\.FieldValue\.delete\(\)/.test(functions) && /sameOrAbsent\('reliabilityAcceptanceTracked'\)/.test(rules)],
  ['Aggregate is isolated from profile and payout fields and clients cannot write', /match \/hostBookingReliability\/{hostId}[\s\S]*?allow read: if isVerifiedAuth\(\);\s*allow create, update, delete: if false/.test(rules)],
  ['Performer radar reads only matching host IDs in batches of at most 30', /where\(documentId\(\), 'in', batch\)/.test(radar) && /offset \+= 30/.test(radar)],
  ['Performer cards explain forward-only scope and explicit numerator/denominator', /Earlier bookings are not included/.test(display) && /hostBookingReliability/.test(radar) && /acceptedTransitions/.test(display) && /hostCancellationsAfterAcceptance/.test(display)]
];
for (const [name, passed] of checks) {
  assert.ok(passed, name);
  console.log(`PASS ${name}`);
}
console.log('PASS aggregate counters, coverage, formatter bounds, rules, and performer display');
