const NOTE_LIMIT = 2000;

function boundedText(value, limit) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '').slice(0, limit).trim();
}

/** Build an on-device incident report from a host-owned accepted booking. */
export function buildBookingIncidentReport({ bookingId, booking, notes, createdAt = new Date().toISOString() } = {}) {
  if (typeof bookingId !== 'string' || !bookingId.trim()) throw new TypeError('A booking ID is required');
  if (!booking || booking.status !== 'accepted' || typeof booking.acceptedBy !== 'string' || !booking.acceptedBy.trim()) {
    throw new TypeError('Incident reports are available only for accepted bookings with an assigned performer');
  }
  const cleanNotes = boundedText(typeof notes === 'string' ? notes.replace(/\r\n?/g, '\n') : '', NOTE_LIMIT);
  const noteInputLength = typeof notes === 'string' ? notes.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '').length : 0;
  const timestamp = new Date(createdAt);
  if (Number.isNaN(timestamp.getTime())) throw new TypeError('Report time must be valid');
  const parsedDate = typeof booking.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(booking.date)
    ? new Date(`${booking.date}T00:00:00.000Z`)
    : null;
  const isoDate = parsedDate && !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === booking.date ? booking.date : '';

  return {
    reportType: 'private-booking-incident',
    reportVersion: 1,
    createdAt: timestamp.toISOString(),
    delivery: 'downloaded-on-device-only-not-sent-to-cltch-or-support',
    booking: {
      id: boundedText(bookingId, 160),
      status: 'accepted',
      performerId: boundedText(booking.acceptedBy, 160),
      venue: boundedText(booking.venue, 160),
      date: isoDate,
      time: boundedText(booking.time, 80)
    },
    notes: cleanNotes,
    notesTruncated: noteInputLength > NOTE_LIMIT
  };
}

export const BOOKING_INCIDENT_NOTE_LIMIT = NOTE_LIMIT;
