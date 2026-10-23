import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isValidTimeZone, recurringAvailabilityForGig, weekdayInTimeZone } from '../app/recurring-availability.js';

assert.equal(isValidTimeZone('America/New_York'), true);
assert.equal(isValidTimeZone('Not/A_Zone'), false);
assert.equal(weekdayInTimeZone('2026-03-07', 'America/Los_Angeles'), 6);

const satProfile = { availabilityDays: [6], availabilityTimeZone: 'America/Los_Angeles', blackoutDates: [] };
const crossMidnight = recurringAvailabilityForGig(satProfile, { date: '2026-03-08', time: '03:30', timeZone: 'America/New_York' });
assert.deepEqual({ eligible: crossMidnight.eligible, localDate: crossMidnight.localDate }, { eligible: true, localDate: '2026-03-07' });
assert.equal(recurringAvailabilityForGig({ ...satProfile, blackoutDates: ['2026-03-07'] }, { date: '2026-03-08', time: '03:30', timeZone: 'America/New_York' }).eligible, false);
assert.equal(recurringAvailabilityForGig({ ...satProfile, availabilityDays: [0] }, { date: '2026-03-08', time: '03:30', timeZone: 'America/New_York' }).eligible, false);

const springGap = recurringAvailabilityForGig({ ...satProfile, availabilityDays: [] }, { date: '2026-03-08', time: '02:30', timeZone: 'America/New_York' });
assert.equal(springGap.fallback, true);
assert.match(springGap.reason, /daylight-saving clock change/);
const fallOverlap = recurringAvailabilityForGig({ ...satProfile, availabilityDays: [] }, { date: '2026-11-01', time: '01:30', timeZone: 'America/New_York' });
assert.equal(fallOverlap.fallback, true);
assert.match(fallOverlap.reason, /ambiguous daylight-saving time/);
assert.equal(recurringAvailabilityForGig({ ...satProfile, availabilityDays: [] }, { date: '2026-03-08', time: '03:30' }).fallback, true);
assert.equal(recurringAvailabilityForGig({}, { date: '2026-03-08', time: '03:30', timeZone: 'America/New_York' }).eligible, true);

const profilePage = await readFile(new URL('../musician-profile.html', import.meta.url), 'utf8');
const gigRadar = await readFile(new URL('../gig-radar.html', import.meta.url), 'utf8');
const dashboard = await readFile(new URL('../musician-dashboard.html', import.meta.url), 'utf8');
const hostPage = await readFile(new URL('../host.html', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const bookingPolicy = await readFile(new URL('../functions/booking-policy.js', import.meta.url), 'utf8');
assert.match(profilePage, /data-availability-day="6"/);
assert.match(profilePage, /id="availabilityTimeZone"/);
assert.match(profilePage, /availabilityDays,/);
assert.match(profilePage, /availabilityTimeZone,/);
assert.match(profilePage, /id: 'availabilityWeekdays', read: \(\) => availabilityDays/);
assert.match(profilePage, /id: 'availabilityTimeZone', write:/);
assert.match(gigRadar, /recurringAvailabilityForGig\(musicianProfile, gig\)/);
assert.match(gigRadar, /if \(!recurringAvailability\.eligible\) return false/);
assert.match(gigRadar, /bookedDatesSet\.has\(performerLocalDate\)/);
assert.match(dashboard, /recurringAvailabilityForGig\(musicianProfile, g\)/);
assert.match(dashboard, /bookedDatesSet\.has\(performerLocalDate\)/);
assert.match(dashboard, /performBookingAction\(auth, gigId, 'accept'\)/);
assert.match(bookingPolicy, /const recurring = recurringAvailabilityForGig\(profile, gig\)/);
assert.match(bookingPolicy, /function bookingAcceptanceCheck\(/);
assert.match(hostPage, /id="eventTimeZone"/);
assert.match(hostPage, /timeZone: eventTimeZoneInput\.value\.trim\(\)/);
assert.match(rules, /'availabilityDays', 'availabilityTimeZone'/);
assert.match(rules, /validAvailabilityDays\(\)/);
assert.match(rules, /'timeZone'/);
console.log('PASS weekly availability, IANA conversion, DST fallback, exceptions, profile persistence, and matching integration');
