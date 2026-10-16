import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BOOKING_INCIDENT_NOTE_LIMIT, buildBookingIncidentReport } from '../app/booking-incident-report.js';

const report = buildBookingIncidentReport({
  bookingId: 'accepted-123',
  booking: { status: 'accepted', acceptedBy: 'performer-9', venue: 'Room A', date: '2026-10-20', time: '20:00', location: 'private-address', pay: '$500' },
  notes: 'Door\u0000 issue\nSecond line',
  createdAt: '2026-10-16T12:00:00.000Z'
});
assert.equal(report.reportType, 'private-booking-incident');
assert.equal(report.delivery, 'downloaded-on-device-only-not-sent-to-cltch-or-support');
assert.equal(report.notes, 'Door issue\nSecond line');
assert.equal(report.booking.performerId, 'performer-9');
assert.equal(report.booking.venue, 'Room A');
assert.equal(report.booking.date, '2026-10-20');
assert.equal('location' in report.booking, false);
assert.equal('pay' in report.booking, false);
assert.equal(report.notesTruncated, false);

const longNotes = 'x'.repeat(BOOKING_INCIDENT_NOTE_LIMIT + 25);
const bounded = buildBookingIncidentReport({
  bookingId: 'a', booking: { status: 'accepted', acceptedBy: 'p' }, notes: longNotes,
  createdAt: '2026-10-16T12:00:00.000Z'
});
assert.equal(bounded.notes.length, BOOKING_INCIDENT_NOTE_LIMIT);
assert.equal(bounded.notesTruncated, true);
assert.throws(() => buildBookingIncidentReport({ bookingId: 'b', booking: { status: 'open', acceptedBy: 'p' }, notes: '' }), /accepted bookings/);
assert.throws(() => buildBookingIncidentReport({ bookingId: 'b', booking: { status: 'accepted' }, notes: '' }), /assigned performer/);
assert.throws(() => buildBookingIncidentReport({ bookingId: 'b', booking: { status: 'accepted', acceptedBy: 'p' }, notes: '', createdAt: 'invalid' }), /Report time/);

const host = await readFile(new URL('../host.html', import.meta.url), 'utf8');
assert.match(host, /g\.status === 'accepted' && typeof g\.acceptedBy === 'string'[\s\S]*?Download Private Incident Report/);
assert.match(host, /button\[data-booking-incident\]/);
assert.match(host, /window\.prompt\([\s\S]*?not sent to CLTCH or Support/);
assert.match(host, /new Blob\(\[JSON\.stringify\(report, null, 2\)\][\s\S]*?link\.click\(\)/);
assert.match(host, /Private incident report downloaded on this device\. It was not sent to CLTCH or Support\./);
assert.doesNotMatch(host, /fetch\([^\n]*(?:incident|support)/i);
console.log('Booking incident report smoke passed.');
