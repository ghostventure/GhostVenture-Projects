const DAY_MS = 24 * 60 * 60 * 1000;
const DETAIL_LIMIT = 20;

function parseIsoDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

/** Summarize only the already-loaded host-owned booking records. */
export function buildBookingHealth(records, todayValue = new Date().toISOString().slice(0, 10)) {
  const today = parseIsoDay(todayValue);
  if (!today) throw new TypeError('today must be a valid YYYY-MM-DD calendar date');
  const todayKey = today.toISOString().slice(0, 10);
  const nextWeek = new Date(today.getTime() + 7 * DAY_MS).toISOString().slice(0, 10);
  const counts = { acceptedPastNeedsReview: 0, openPastDate: 0, acceptedNext7Days: 0 };
  const flagged = [];

  for (const record of Array.isArray(records) ? records : []) {
    const gig = record?.g && typeof record.g === 'object' ? record.g : record;
    const gigId = typeof record?.gigId === 'string' ? record.gigId : '';
    const date = parseIsoDay(gig?.date);
    if (!date) continue;
    const day = date.toISOString().slice(0, 10);
    let reason = '';
    if (gig.status === 'accepted' && day < todayKey && !gig.reviewed) {
      counts.acceptedPastNeedsReview += 1;
      reason = 'Past event; review not marked complete';
    } else if (gig.status === 'open' && day < todayKey) {
      counts.openPastDate += 1;
      reason = 'Open listing has a past event date';
    } else if (gig.status === 'accepted' && day >= todayKey && day <= nextWeek) {
      counts.acceptedNext7Days += 1;
      reason = 'Accepted event is today or within 7 days';
    }
    if (reason && gigId) flagged.push({
      gigId,
      venue: typeof gig.venue === 'string' ? gig.venue.slice(0, 120) : 'Booking',
      date: day,
      status: gig.status,
      reason
    });
  }

  const priority = { 'Past event; review not marked complete': 0, 'Open listing has a past event date': 1, 'Accepted event is today or within 7 days': 2 };
  flagged.sort((a, b) => priority[a.reason] - priority[b.reason] || a.date.localeCompare(b.date) || a.gigId.localeCompare(b.gigId));
  return { counts, items: flagged.slice(0, DETAIL_LIMIT), totalFlagged: flagged.length, detailLimit: DETAIL_LIMIT };
}
