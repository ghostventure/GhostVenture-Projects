import assert from 'node:assert/strict';
import { bookingsToCalendar, filterUpcomingBookings, formatAgendaText } from '../app/performer-agenda.js';
import { readFile } from 'node:fs/promises';

const today = new Date(2026, 9, 16);
const bookings = [
  { id: 'later', date: '2026-11-10', time: '20:30', venue: 'Late Room', location: 'Austin, TX', genre: 'Jazz; fusion', pay: '$500' },
  { id: 'today', date: '2026-10-16', time: '19:00', venue: 'Tonight' },
  { id: 'soon', date: '2026-10-22', time: '18:00', venue: 'Soon' },
  { id: 'past', date: '2026-10-15', time: '19:00', venue: 'Past' },
  { id: 'bad-date', date: '2026-02-30', time: '19:00', venue: 'Invalid' },
  { id: 'bad-time', date: '2026-10-17', time: '25:00', venue: 'Invalid time' }
];

assert.deepEqual(filterUpcomingBookings(bookings, 7, today).map((gig) => gig.id), ['today', 'soon']);
assert.deepEqual(filterUpcomingBookings(bookings, 30, today).map((gig) => gig.id), ['today', 'soon', 'later']);
assert.deepEqual(filterUpcomingBookings(bookings, Infinity, today).map((gig) => gig.id), ['today', 'soon', 'later']);
assert.deepEqual(filterUpcomingBookings([{ id: 'dst-edge', date: '2026-11-07', time: '20:00' }, { id: 'past-window', date: '2026-11-08', time: '20:00' }], 7, new Date(2026, 10, 1)).map((gig) => gig.id), ['dst-edge']);

const calendar = bookingsToCalendar(bookings);
const unfoldedCalendar = calendar.replace(/\r\n[ \t]/g, '');
assert.equal((calendar.match(/BEGIN:VEVENT/g) || []).length, 4, 'only bookings with valid date and time become events');
assert.match(unfoldedCalendar, /SUMMARY:Late Room/);
assert.match(unfoldedCalendar, /LOCATION:Austin\\, TX/);
assert.match(unfoldedCalendar, /DESCRIPTION:Genre: Jazz\\; fusion\\nPay: \$500\\nLocation: Austin\\, TX/);
assert.match(unfoldedCalendar, /DTSTART:20261110T203000/);
assert.match(unfoldedCalendar, /DURATION:PT1H/);
assert.match(unfoldedCalendar, /END:VCALENDAR/);
assert.match(formatAgendaText([bookings[0]]), /2026-11-10 20:30 \| Late Room \| Austin, TX \| \$500/);
assert.match(formatAgendaText([{ date: '2026-11-10', time: '20:30', venue: 'Room\nFake entry', location: 'Austin', pay: '$500' }]), /Room Fake entry/);
const folded = bookingsToCalendar([{ id: 'long', date: '2026-11-10', time: '20:30', venue: 'A'.repeat(120) }]);
assert.ok(folded.includes('\r\n '), 'long ICS lines are folded');
assert.ok(folded.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75), 'ICS physical lines stay within 75 octets');
const dashboard = await readFile(new URL('../musician-dashboard.html', import.meta.url), 'utf8');
assert.match(dashboard, /app\/performer-agenda\.js/);
assert.match(dashboard, /data-agenda-days="7"/);
assert.match(dashboard, /id="agendaExport"/);
assert.match(dashboard, /id="agendaCopy"/);
assert.match(dashboard, /role="status" aria-live="polite"/);
assert.match(dashboard, /one-hour default block/);
console.log('Performer agenda smoke passed.');
