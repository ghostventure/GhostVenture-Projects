const crypto = require('node:crypto');
const FORMATTERS = new Map();

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function validTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone || timeZone.length > 64) return false;
  try {
    if (!FORMATTERS.has(timeZone)) {
      if (FORMATTERS.size >= 32) FORMATTERS.delete(FORMATTERS.keys().next().value);
      FORMATTERS.set(timeZone, new Intl.DateTimeFormat('en-GB', {
        timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
      }));
    }
    return true;
  } catch { return false; }
}

function localParts(epochMs, timeZone) {
  validTimeZone(timeZone);
  const fields = FORMATTERS.get(timeZone).formatToParts(epochMs);
  return Object.fromEntries(fields.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function localDateTimeToUtc(date, time, timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !validTimeZone(timeZone)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (hour > 23 || minute > 59) return null;
  const nominal = Date.UTC(year, month - 1, day, hour, minute);
  const normalized = new Date(nominal);
  if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() + 1 !== month || normalized.getUTCDate() !== day) return null;
  const offsets = new Set();
  for (let span = -36; span <= 36; span += 3) {
    const sample = nominal + span * 3600000;
    const local = localParts(sample, timeZone);
    offsets.add(Date.UTC(+local.year, +local.month - 1, +local.day, +local.hour, +local.minute, +local.second) - Math.floor(sample / 1000) * 1000);
  }
  const matches = [];
  for (const offset of offsets) {
    const candidate = nominal - offset;
    const local = localParts(candidate, timeZone);
    if (+local.year === year && +local.month === month && +local.day === day && +local.hour === hour && +local.minute === minute) matches.push(candidate);
  }
  const distinct = [...new Set(matches)];
  return distinct.length === 1 ? distinct[0] : null;
}

function icsEscape(value) {
  return Array.from(String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')).slice(0, 500).join('')
    .replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function foldLine(line) {
  const parts = [];
  let current = '';
  let currentBytes = 0;
  for (const character of Array.from(String(line))) {
    const bytes = Buffer.byteLength(character, 'utf8');
    const limit = parts.length ? 74 : 75;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = ` ${character}`;
      currentBytes = 1 + bytes;
    } else {
      current += character;
      currentBytes += bytes;
    }
  }
  parts.push(current);
  return parts;
}

function utcStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function buildCalendarFeed(gigs, now = new Date()) {
  const dtstamp = utcStamp(now);
  const events = gigs.map((entry) => {
    const gig = entry.data || entry;
    const time = typeof gig.time === 'string' ? gig.time.slice(0, 5) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(gig.date || '') || !/^\d{2}:\d{2}$/.test(time)) return '';
    const startEpoch = validTimeZone(gig.timeZone) ? localDateTimeToUtc(gig.date, time, gig.timeZone) : null;
    const eventId = String(entry.id || gig.id || crypto.createHash('sha256').update(`${gig.hostId || ''}:${gig.date}:${gig.time}:${gig.venue || ''}`).digest('hex')).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100);
    const fallback = startEpoch === null;
    const dtstart = fallback
      ? `${gig.date.replace(/-/g, '')}T${time.replace(':', '')}00`
      : utcStamp(new Date(startEpoch));
    const dtend = fallback
      ? (() => {
          const local = new Date(`${gig.date}T${time}:00Z`);
          local.setUTCHours(local.getUTCHours() + 1);
          return utcStamp(local).replace(/Z$/, '');
        })()
      : utcStamp(new Date(startEpoch + 3600000));
    const description = [gig.genre ? `Style: ${gig.genre}` : '', fallback ? 'Event time is floating because its timezone or DST offset could not be confirmed; verify the local start time with the host.' : ''].filter(Boolean).join(' ');
    return [
      'BEGIN:VEVENT', `UID:${eventId}@cltch.network`, `DTSTAMP:${dtstamp}`,
      `DTSTART${fallback ? '' : ''}:${dtstart}`, `DTEND${fallback ? '' : ''}:${dtend}`,
      `SUMMARY:${icsEscape(`CLTCH.NTWRK: ${gig.venue || 'Booked event'}`)}`,
      ...(gig.location ? [`LOCATION:${icsEscape(gig.location)}`] : []),
      ...(description ? [`DESCRIPTION:${icsEscape(description)}`] : []),
      'STATUS:CONFIRMED', 'END:VEVENT'
    ].join('\r\n');
  }).filter(Boolean);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CLTCH.NTWRK//Private Booking Feed//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-PUBLISHED-TTL:PT5M',
    ...events, 'END:VCALENDAR', ''
  ].flatMap((line) => String(line).split(/\r?\n/).flatMap(foldLine)).join('\r\n');
}

module.exports = { buildCalendarFeed, hashToken, localDateTimeToUtc };
