import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildBookingHealth } from '../app/booking-health.js';

const today = '2026-10-16';
const records = [
  { gigId: 'past-accepted', g: { status: 'accepted', date: '2026-10-15', venue: '<Venue>', reviewed: false } },
  { gigId: 'past-reviewed', g: { status: 'accepted', date: '2026-10-15', reviewed: true } },
  { gigId: 'open-past', g: { status: 'open', date: '2026-10-15' } },
  { gigId: 'today', g: { status: 'accepted', date: today } },
  { gigId: 'week-edge', g: { status: 'accepted', date: '2026-10-23' } },
  { gigId: 'outside', g: { status: 'accepted', date: '2026-10-24' } },
  { gigId: 'bad-date', g: { status: 'open', date: '2026-02-30' } },
  { gigId: 'unknown-status', g: { status: 'draft', date: '2026-10-17' } }
];
const summary = buildBookingHealth(records, today);
assert.deepEqual(summary.counts, { acceptedPastNeedsReview: 1, openPastDate: 1, acceptedNext7Days: 2 });
assert.deepEqual(summary.items.map((item) => item.gigId), ['past-accepted', 'open-past', 'today', 'week-edge']);
assert.equal(summary.items[0].venue, '<Venue>');
assert.equal(summary.items[0].reason, 'Past event; review not marked complete');
assert.throws(() => buildBookingHealth([], '2026-02-30'), /valid YYYY-MM-DD/);

const many = Array.from({ length: 25 }, (_, index) => ({
  gigId: `past-${String(index).padStart(2, '0')}`,
  g: { status: 'open', date: '2026-10-15', venue: `Venue ${index}` }
}));
const bounded = buildBookingHealth(many, today);
assert.equal(bounded.counts.openPastDate, 25);
assert.equal(bounded.totalFlagged, 25);
assert.equal(bounded.items.length, 20);
assert.equal(bounded.items[0].gigId, 'past-00');

const host = await readFile(new URL('../host.html', import.meta.url), 'utf8');
assert.match(host, /buildBookingHealth\(records\)/);
assert.match(host, /booking\.html\?id=\$\{encodeURIComponent\(item\.gigId\)\}/);
assert.match(host, /onSnapshot\(q, \(snapshot\) =>[\s\S]*?renderBookingHealth\(hostGigCache\);[\s\S]*?\}, \(\) => clearBookingHealthOnError\(\)\)\)/);
assert.match(host, /Counts use bookings already loaded for this host[\s\S]*?accepted events from today through the next 7 days/);
console.log('Booking health smoke passed.');
