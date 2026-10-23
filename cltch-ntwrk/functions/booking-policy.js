const WEEKDAY_INDEX = Object.freeze({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 });
const FORMATTERS = new Map();

function formatterFor(timeZone) {
  if (FORMATTERS.has(timeZone)) return FORMATTERS.get(timeZone);
  let formatter = null;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23', weekday: 'short'
    });
  } catch {}
  if (FORMATTERS.size >= 32) FORMATTERS.delete(FORMATTERS.keys().next().value);
  FORMATTERS.set(timeZone, formatter);
  return formatter;
}

function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone.trim() || timeZone.length > 64) return false;
  return !!formatterFor(timeZone);
}

function partsAt(epochMs, timeZone) {
  const parts = formatterFor(timeZone).formatToParts(epochMs);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function localDateTimeToInstant(date, time, timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(time || '') || !isValidTimeZone(timeZone)) return { instant: null, reason: 'invalid' };
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const nominal = Date.UTC(year, month - 1, day, hour, minute);
  const checkDate = new Date(nominal);
  if (checkDate.getUTCFullYear() !== year || checkDate.getUTCMonth() + 1 !== month || checkDate.getUTCDate() !== day || hour > 23 || minute > 59) {
    return { instant: null, reason: 'invalid' };
  }

  const offsets = new Set();
  for (let hours = -36; hours <= 36; hours += 3) {
    const sample = nominal + hours * 60 * 60 * 1000;
    const local = partsAt(sample, timeZone);
    const localAsUtc = Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day), Number(local.hour), Number(local.minute), Number(local.second));
    offsets.add(localAsUtc - Math.floor(sample / 1000) * 1000);
  }

  const candidates = [];
  for (const offset of offsets) {
    const candidate = nominal - offset;
    const local = partsAt(candidate, timeZone);
    if (Number(local.year) === year && Number(local.month) === month && Number(local.day) === day
      && Number(local.hour) === hour && Number(local.minute) === minute) candidates.push(candidate);
  }
  const distinct = [...new Set(candidates)].sort((a, b) => a - b);
  if (distinct.length === 1) return { instant: distinct[0], reason: '' };
  return { instant: null, reason: distinct.length > 1 ? 'ambiguous' : 'nonexistent' };
}

function weekdayInTimeZone(date, timeZone) {
  const result = localDateTimeToInstant(date, '12:00', timeZone);
  if (result.instant === null) return null;
  return WEEKDAY_INDEX[partsAt(result.instant, timeZone).weekday] ?? null;
}

function recurringAvailabilityForGig(profile = {}, gig = {}) {
  if (!Array.isArray(profile.availabilityDays)) return { eligible: true, fallback: true, reason: 'No recurring schedule is set.' };
  const days = new Set(profile.availabilityDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6));
  const performerZone = profile.availabilityTimeZone;
  const eventZone = gig.timeZone;
  if (!isValidTimeZone(performerZone) || !isValidTimeZone(eventZone)) {
    return { eligible: true, fallback: true, reason: 'A valid performer and event timezone are needed; exact-date blocks still apply.' };
  }
  const result = localDateTimeToInstant(gig.date, gig.time, eventZone);
  if (result.instant === null) {
    const cause = result.reason === 'ambiguous' ? 'ambiguous daylight-saving time' : result.reason === 'nonexistent' ? 'a daylight-saving clock change' : 'invalid event date or time';
    return { eligible: true, fallback: true, reason: `Recurring availability was not applied because the event time has ${cause}.` };
  }
  const performerLocal = partsAt(result.instant, performerZone);
  const localDate = `${performerLocal.year}-${performerLocal.month}-${performerLocal.day}`;
  if (Array.isArray(profile.blackoutDates) && profile.blackoutDates.includes(localDate)) {
    return { eligible: false, fallback: false, localDate, reason: `Blocked exception date in ${performerZone}.` };
  }
  const weekday = WEEKDAY_INDEX[performerLocal.weekday];
  if (!Number.isInteger(weekday)) return { eligible: true, fallback: true, reason: 'The local weekday could not be resolved.' };
  return days.has(weekday)
    ? { eligible: true, fallback: false, localDate, reason: `Regularly available on this weekday in ${performerZone}.` }
    : { eligible: false, fallback: false, localDate, reason: `Outside regular availability in ${performerZone}.` };
}

function performerAvailabilityForGig(profile = {}, gig = {}, currentGigId = '') {
  const recurring = recurringAvailabilityForGig(profile, gig);
  const localDate = recurring.localDate || gig.date;
  if (!recurring.eligible) return { ...recurring, localDate };
  if (Array.isArray(profile.blackoutDates) && profile.blackoutDates.includes(localDate)) {
    return { eligible: false, fallback: recurring.fallback, localDate, reason: 'This booking falls on a date you have marked unavailable.' };
  }
  const bookings = Array.isArray(profile.bookedDates) ? profile.bookedDates : [];
  if (bookings.some((entry) => entry?.date === localDate && entry?.gigId !== currentGigId)) {
    return { eligible: false, fallback: recurring.fallback, localDate, reason: 'You already have another booking on this date. Resolve the date conflict before accepting.' };
  }
  return { ...recurring, eligible: true, localDate };
}

function bookingAcceptanceCheck(gig, musician, uid, currentGigId = '', today = new Date().toISOString().slice(0, 10)) {
  if (!gig || gig.hostId === uid) return { error: 'You cannot accept your own booking.', localDate: '' };
  if (gig.status !== 'open') return { error: 'This booking is no longer available.', localDate: '' };
  if (!musician) return { error: 'Complete your performer profile before accepting a booking.', localDate: '' };
  if (musician.available !== true) return { error: 'Your performer profile is currently unavailable.', localDate: '' };
  const date = typeof gig.date === 'string' ? gig.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
    || Number.isNaN(Date.parse(`${date}T00:00:00Z`))
    || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
    || date < today) return { error: 'This booking date is invalid or has already passed.', localDate: '' };
  const schedule = performerAvailabilityForGig(musician, gig, currentGigId);
  if (!schedule.eligible) return { error: schedule.reason, localDate: schedule.localDate || date };
  return { error: '', localDate: schedule.localDate || date, fallback: schedule.fallback };
}

function validateBookingAcceptance(gig, musician, uid, currentGigId = '', today = new Date().toISOString().slice(0, 10)) {
  return bookingAcceptanceCheck(gig, musician, uid, currentGigId, today).error;
}

function isBlockedBetween(userABlockedUserB, userBBlockedUserA) {
  return userABlockedUserB === true || userBBlockedUserA === true;
}

function normalizeBookingCache(bookings = [], nextBooking = null, today = new Date()) {
  const cutoff = new Date(today);
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const byGig = new Map();
  [...bookings, ...(nextBooking ? [nextBooking] : [])].forEach((booking) => {
    if (!booking || typeof booking !== 'object') return;
    const gigId = String(booking.gigId || booking.id || '').trim().slice(0, 150);
    const date = typeof booking.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(booking.date) ? booking.date : '';
    if (!gigId || !date || date < cutoffKey) return;
    byGig.set(gigId, {
      gigId, id: gigId, date,
      venue: String(booking.venue || '').slice(0, 100),
      time: String(booking.time || '').slice(0, 20),
      pay: String(booking.pay || '').slice(0, 100),
      location: String(booking.location || '').slice(0, 100),
      genre: String(booking.genre || '').slice(0, 50)
    });
  });
  return [...byGig.values()]
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(-120);
}

module.exports = { bookingAcceptanceCheck, isBlockedBetween, isValidTimeZone, normalizeBookingCache, performerAvailabilityForGig, recurringAvailabilityForGig, validateBookingAcceptance, weekdayInTimeZone };
