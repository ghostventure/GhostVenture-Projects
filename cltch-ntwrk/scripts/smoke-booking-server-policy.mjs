import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  bookingAcceptanceCheck,
  isBlockedBetween,
  isValidTimeZone,
  normalizeBookingCache,
  performerAvailabilityForGig,
  recurringAvailabilityForGig,
  validateBookingAcceptance,
  weekdayInTimeZone
} from '../functions/booking-policy.js';

const today = '2026-10-23';
const gig = { id: 'gig-a', hostId: 'host-a', status: 'open', date: '2026-10-25', venue: 'Room', time: '20:00', pay: '$200' };
const profile = { available: true, blackoutDates: [], bookedDates: [] };
assert.equal(validateBookingAcceptance(gig, profile, 'performer-a', gig.id, today), '', 'available performer can accept an eligible open booking');
assert.equal(isBlockedBetween(false, false), false);
assert.equal(isBlockedBetween(true, false), true, 'a one-way block prevents acceptance');
assert.equal(isBlockedBetween(false, true), true, 'a reverse-direction block also prevents acceptance');
assert.match(validateBookingAcceptance(gig, { ...profile, available: false }, 'performer-a', gig.id, today), /unavailable/);
assert.match(validateBookingAcceptance(gig, { ...profile, blackoutDates: [gig.date] }, 'performer-a', gig.id, today), /marked unavailable/);
assert.match(validateBookingAcceptance(gig, { ...profile, bookedDates: [{ gigId: 'gig-b', date: gig.date }] }, 'performer-a', gig.id, today), /another booking/);
assert.match(validateBookingAcceptance({ ...gig, hostId: 'performer-a' }, profile, 'performer-a', gig.id, today), /own booking/);
assert.match(validateBookingAcceptance({ ...gig, date: '2026-10-22' }, profile, 'performer-a', gig.id, today), /already passed/);
assert.match(validateBookingAcceptance({ ...gig, date: '2026-02-31' }, profile, 'performer-a', gig.id, today), /invalid/);

// These parity vectors mirror app/recurring-availability.js: a cross-zone
// instant, performer-local blackout, weekday exclusion, and DST fallbacks.
assert.equal(isValidTimeZone('America/New_York'), true);
assert.equal(isValidTimeZone('Not/A_Zone'), false);
assert.equal(weekdayInTimeZone('2026-03-07', 'America/Los_Angeles'), 6);
const saturdayPerformer = { ...profile, availabilityDays: [6], availabilityTimeZone: 'America/Los_Angeles', blackoutDates: [] };
const crossZoneGig = { ...gig, date: '2026-03-08', time: '03:30', timeZone: 'America/New_York' };
const recurring = performerAvailabilityForGig(saturdayPerformer, crossZoneGig, gig.id);
assert.deepEqual({ eligible: recurring.eligible, localDate: recurring.localDate }, { eligible: true, localDate: '2026-03-07' });
assert.deepEqual(bookingAcceptanceCheck({ ...crossZoneGig, status: 'open' }, saturdayPerformer, 'performer-a', gig.id, '2026-03-01'), { error: '', localDate: '2026-03-07', fallback: false });
assert.equal(validateBookingAcceptance(crossZoneGig, { ...saturdayPerformer, blackoutDates: ['2026-03-07'] }, 'performer-a', gig.id, '2026-03-01'), 'Blocked exception date in America/Los_Angeles.');
assert.match(validateBookingAcceptance(crossZoneGig, { ...saturdayPerformer, availabilityDays: [0] }, 'performer-a', gig.id, '2026-03-01'), /Outside regular availability/);
assert.match(validateBookingAcceptance(crossZoneGig, { ...saturdayPerformer, bookedDates: [{ gigId: 'other-gig', date: '2026-03-07' }] }, 'performer-a', gig.id, '2026-03-01'), /another booking/);
const springGap = performerAvailabilityForGig({ ...saturdayPerformer, availabilityDays: [] }, { ...crossZoneGig, date: '2026-03-08', time: '02:30' });
assert.equal(springGap.fallback, true);
assert.equal(springGap.eligible, true);
assert.match(springGap.reason, /a daylight-saving clock change/);
const fallOverlap = recurringAvailabilityForGig({ ...saturdayPerformer, availabilityDays: [] }, { ...crossZoneGig, date: '2026-11-01', time: '01:30' });
assert.equal(fallOverlap.fallback, true);
assert.equal(fallOverlap.eligible, true);
assert.match(fallOverlap.reason, /ambiguous daylight-saving time/);
assert.equal(recurringAvailabilityForGig({ ...saturdayPerformer, availabilityDays: [] }, { ...crossZoneGig, date: '2026-03-08', time: '03:30', timeZone: '' }).fallback, true);
assert.equal(recurringAvailabilityForGig({}, crossZoneGig).eligible, true);
assert.equal(performerAvailabilityForGig({ ...saturdayPerformer, availabilityTimeZone: 'Bad/Zone' }, crossZoneGig).localDate, crossZoneGig.date);
assert.equal(performerAvailabilityForGig({ ...saturdayPerformer, availabilityTimeZone: 'Bad/Zone', blackoutDates: [crossZoneGig.date] }, crossZoneGig).eligible, false, 'timezone fallback still enforces exact-date blocks');

const cache = normalizeBookingCache([
  { gigId: 'old', date: '2026-09-01', venue: 'Old' },
  { gigId: 'same', date: '2026-10-25', venue: 'Old copy' }
], { gigId: 'same', date: '2026-10-25', venue: 'Updated', time: '21:00' }, new Date(`${today}T12:00:00Z`));
assert.equal(cache.length, 1, 'expired cache entries are pruned and duplicate gigs merge');
assert.equal(cache[0].venue, 'Updated');
assert.equal(cache[0].time, '21:00');

const functions = await readFile(new URL('../functions/index.js', import.meta.url), 'utf8');
assert.match(functions, /tx\.get\(musicianRef\)[\s\S]*?profileWrites\.push\(\[musicianRef, \{ bookedDates:/, 'acceptance reads and updates the performer cache in its Firestore transaction');
assert.match(functions, /userBlocks'\)\.doc\(userA\)\.collection\('blocked'\)\.doc\(userB\)/, 'server uses the established one-way block document path');
assert.match(functions, /await assertNotBlockedBetween\(tx, uid, gig\.hostId\)/, 'acceptance checks both block directions in its transaction');
assert.match(functions, /profileWrites\.forEach\(\(\[ref, data\]\) => tx\.update\(ref, data\)\)/, 'gig and profile updates commit in the same transaction');
assert.match(functions, /bookingAcceptanceCheck\(gig, musicianSnap\.exists \? musicianSnap\.data\(\) : null, uid, gigId\)/, 'server validates profile availability, recurring schedule, and booking dates');
assert.match(functions, /const date = acceptance\.localDate/, 'acceptance cache uses the same performer-local date as recurring matching');
assert.match(functions, /bookingAcceptanceCheck\(replacementGig, newPerformerSnap\.data\(\), uid, gigId\)/, 'replacement acceptance enforces the same recurring schedule policy');
console.log('Booking server policy smoke passed.');
