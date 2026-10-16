const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function filterUpcomingBookings(bookings, days, today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = Number.isFinite(days) ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + days) : null;
  return (Array.isArray(bookings) ? bookings : [])
    .filter((booking) => {
      if (!booking || !DATE_ONLY.test(String(booking.date || ''))) return false;
      if (!TIME_ONLY.test(String(booking.time || ''))) return false;
      const [year, month, day] = booking.date.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return false;
      return date >= start && (!end || date < end);
    })
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.time || '').localeCompare(String(b.time || '')));
}

function icsEscape(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function foldIcsLine(line) {
  const encoder = new TextEncoder();
  let folded = '';
  let segment = '';
  let bytes = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 73 && segment) {
      folded += `${segment}\r\n `;
      segment = '';
      bytes = 0;
    }
    segment += character;
    bytes += length;
  }
  return folded + segment;
}

function compactDate(date, time) {
  if (!DATE_ONLY.test(String(date || '')) || !TIME_ONLY.test(String(time || ''))) return null;
  const [year, month, day] = date.split('-');
  const [hour, minute] = time.split(':');
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (parsed.getFullYear() !== Number(year) || parsed.getMonth() !== Number(month) - 1 || parsed.getDate() !== Number(day)) return null;
  return `${year}${month}${day}T${hour}${minute}00`;
}

export function bookingsToCalendar(bookings) {
  const events = (Array.isArray(bookings) ? bookings : []).flatMap((gig, index) => {
    const startsAt = compactDate(gig?.date, gig?.time);
    if (!startsAt) return [];
    const venue = gig.venue || 'Booked gig';
    const details = [gig.genre && `Genre: ${gig.genre}`, gig.pay && `Pay: ${gig.pay}`, gig.location && `Location: ${gig.location}`]
      .filter(Boolean).join('\n');
    return [
      'BEGIN:VEVENT',
      `UID:${icsEscape(gig.id || gig.gigId || `cltch-${gig.date}-${index}`)}@cltch.ntwrk`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
      `DTSTART:${startsAt}`,
      'DURATION:PT1H',
      `SUMMARY:${icsEscape(venue)}`,
      `LOCATION:${icsEscape(gig.location || '')}`,
      `DESCRIPTION:${icsEscape(details)}`,
      'END:VEVENT'
    ].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CLTCH.NTWRK//Performer Agenda//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR', ''].map(foldIcsLine).join('\r\n');
}

export function formatAgendaText(bookings) {
  const text = (value, fallback) => String(value || fallback).replace(/[\r\n\t]/g, ' ');
  return bookings.map((gig) => `${text(gig.date, '')} ${text(gig.time, 'Time TBD')} | ${text(gig.venue, 'Booked gig')} | ${text(gig.location, 'Location TBD')} | ${text(gig.pay, 'Pay TBD')}`).join('\n');
}
