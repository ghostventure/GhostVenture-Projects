import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { buildCalendarFeed, hashToken } = require('../functions/calendar-subscription.js');
const functions = await readFile(new URL('../functions/index.js', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const ui = await readFile(new URL('../app/calendar-subscription.js', import.meta.url), 'utf8');

assert.equal(hashToken('first-private-token').length, 64);
assert.notEqual(hashToken('first-private-token'), hashToken('second-private-token'));
const feed = buildCalendarFeed([{
  id: 'safeGig-123',
  data: { date: '2026-06-01', time: '20:00', timeZone: 'America/New_York', venue: 'Club, North', location: 'Brooklyn; NY', genre: 'Jazz', pay: '$900', payoutHandle: 'must-not-leak', hostId: 'other-user' }
}], new Date('2026-01-01T00:00:00Z'));
assert.match(feed, /DTSTART:20260602T000000Z/);
assert.match(feed, /SUMMARY:CLTCH\.NTWRK: Club\\, North/);
assert.match(feed, /LOCATION:Brooklyn\\; NY/);
assert.doesNotMatch(feed, /900|payoutHandle|other-user/);
const fallback = buildCalendarFeed([{ id: 'dstGig', data: { date: '2026-11-01', time: '01:30', timeZone: 'America/New_York', venue: 'DST Show' } }]);
assert.match(fallback, /DTSTART:20261101T013000/);
const unfoldedFallback = fallback.replace(/\r\n[ \t]/g, '');
assert.match(unfoldedFallback, /timezone or DST offset could not be confirmed/);
assert.ok(fallback.split('\r\n').every((line) => Buffer.byteLength(line, 'utf8') <= 75));
const longFeed = buildCalendarFeed([{ id: 'longGig', data: { date: '2026-06-01', time: '20:00', timeZone: 'America/New_York', venue: '🎸'.repeat(60) } }]);
assert.ok(longFeed.split('\r\n').every((line) => Buffer.byteLength(line, 'utf8') <= 75));

assert.match(functions, /decoded\.email_verified !== true/);
assert.match(functions, /crypto\.randomBytes\(32\)/);
assert.match(functions, /calendarSubscriptionTokens/);
assert.match(functions, /calendarSubscriptionOwners/);
assert.match(functions, /where\('acceptedBy', '==', uid\)/);
assert.match(functions, /where\('status', '==', 'accepted'\)/);
assert.match(functions, /\.limit\(200\)/);
assert.match(functions, /hashToken\(rawToken\)/);
assert.match(functions, /no-store, no-cache/);
assert.match(rules, /match \/calendarSubscriptionOwners\/{userId}[\s\S]*?allow read, write: if false/);
assert.match(rules, /match \/calendarSubscriptionTokens\/{tokenHash}[\s\S]*?allow read, write: if false/);
assert.match(ui, /requestAction\(auth, 'revoke'\)/);
assert.match(ui, /shown only now/);
assert.match(ui, /cached calendar entries may remain/);
assert.match(ui, /if \(BACKEND_DISABLED\)/);
assert.match(ui, /Online calendar links are unavailable while the backend is disabled/);
console.log('PASS private token lifecycle, bounded owner-only feed, timezone conversion, and revocation safeguards');
