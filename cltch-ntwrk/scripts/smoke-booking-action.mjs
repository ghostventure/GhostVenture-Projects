import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [functions, rules, page, helper, dashboard, matched, radar, host] = await Promise.all([
  readFile(new URL('../functions/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  readFile(new URL('../booking.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/booking-action.js', import.meta.url), 'utf8'),
  readFile(new URL('../musician-dashboard.html', import.meta.url), 'utf8'),
  readFile(new URL('../musician-matched-gigs.html', import.meta.url), 'utf8'),
  readFile(new URL('../gig-radar.html', import.meta.url), 'utf8'),
  readFile(new URL('../host.html', import.meta.url), 'utf8')
]);

for (const action of ['accept', 'cancel', 'reopen', 'checkin', 'proposeAmendment', 'acceptAmendment', 'declineAmendment', 'offerReplacement', 'acceptReplacement', 'declineReplacement']) {
  assert.ok(functions.includes(`'${action}'`), `server supports ${action}`);
}
assert.match(functions, /db\.runTransaction\(async \(tx\)/, 'booking actions use a Firestore transaction');
assert.match(functions, /receipt\.actorId !== uid \|\| receipt\.action !== action/, 'reused action ids are bound to actor and action');
assert.match(functions, /tx\.create\(auditRef\.doc\(\)/, 'state changes create server-time audit records');
assert.match(functions, /userBlocks'\)\.doc\(userA\)\.collection\('blocked'\)\.doc\(userB\)/, 'server reads the established user block path');
assert.match(functions, /await assertNotBlockedBetween\(tx, uid, gig\.hostId\)/, 'acceptance checks both directions of the block relationship');
assert.match(functions, /bookingAcceptanceCheck\(gig, musicianSnap\.exists \? musicianSnap\.data\(\) : null, uid, gigId\)/, 'server validates profile availability and recurring booking dates');
assert.match(functions, /bookedDates: normalizeBookingCache\(musician\.bookedDates, booking\)/, 'acceptance updates bookedDates atomically');
assert.match(functions, /normalizeBookingCache\(dates\.filter\(\(entry\) => entry\?\.gigId !== gigId\)\)/, 'cancellation removes the accepted booking from bookedDates atomically');
assert.match(rules, /match \/audit\/{entryId}[\s\S]*?allow write: if false;/, 'clients cannot forge audit records');
assert.match(rules, /match \/actionReceipts\/{actionId}[\s\S]*?allow read, write: if false;/, 'clients cannot forge idempotency receipts');
assert.match(page, /performBookingAction\(auth, bookingId, "checkin"\)/, 'booking page uses server check-in');
assert.match(page, /Share your arrival check-in with the host/, 'check-in asks for consent');
assert.match(page, /Propose booking changes/, 'participants can propose amendments');
assert.match(page, /acceptAmendmentBtn/, 'participants can respond to amendments');
assert.match(page, /Find a replacement performer/, 'hosts can browse available replacement profiles');
assert.match(page, /acceptReplacementBtn/, 'replacement performers can accept offers');
assert.match(page, /declineReplacementBtn/, 'replacement performers can decline offers');
assert.match(page, /Call host event-day contact/, 'assigned performer has a participant-only event-day contact action');
assert.match(functions, /declinedAt/, 'replacement offers can be declined and retried');
assert.match(helper, /Authorization.*Bearer/, 'API helper sends Firebase authentication');
assert.match(helper, /payloadKey/, 'network retries reuse an action id only for the same action payload');
for (const [name, source] of [['dashboard', dashboard], ['matched queue', matched], ['radar', radar]]) {
  assert.match(source, /performBookingAction\(auth, gigId, 'accept'\)/, `${name} acceptance uses the server transaction`);
  assert.match(source, /performBookingAction\(auth, gigId, 'cancel'\)/, `${name} cancellation uses the server transaction`);
  assert.match(source, /performBookingAction\(auth, gigId, 'checkin'\)/, `${name} check-in uses the server transaction`);
  assert.match(source, /Share your arrival check-in with the host/, `${name} check-in asks for consent`);
}
assert.match(host, /performBookingAction\(auth, gigId, 'cancel', \{ cancelReason \}\)/, 'host cancellation preserves its private reason');
assert.match(host, /performBookingAction\(auth, gigId, 'reopen'\)/, 'host reopen is server validated and audited');
assert.doesNotMatch(rules, /resource\.data\.status == 'open'\s*&&\s*request\.resource\.data\.status == 'accepted'/, 'clients cannot accept bookings by direct Firestore writes');
assert.doesNotMatch(rules, /resource\.data\.status == 'accepted'\s*&&\s*request\.resource\.data\.status == 'cancelled'/, 'clients cannot cancel accepted bookings by direct Firestore writes');

class SessionStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const savedFetch = globalThis.fetch;
const savedSession = globalThis.sessionStorage;
const sessionStorage = new SessionStorage();
const requestIds = [];
let networkAttempts = 0;
globalThis.sessionStorage = sessionStorage;
globalThis.fetch = async (_url, options) => {
  requestIds.push(JSON.parse(options.body).actionId);
  networkAttempts += 1;
  if (networkAttempts === 1) throw new Error('network unavailable');
  return { ok: true, status: 200, json: async () => ({ ok: true }) };
};
try {
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(helper).toString('base64')}`;
  const { performBookingAction } = await import(moduleUrl);
  const auth = { currentUser: { uid: 'performer-test', getIdToken: async () => 'token' } };
  await assert.rejects(performBookingAction(auth, 'gig-test', 'accept'), /network unavailable/);
  await performBookingAction(auth, 'gig-test', 'accept');
  assert.equal(requestIds[0], requestIds[1], 'a retry after transport failure reuses the same idempotency key');
} finally {
  globalThis.fetch = savedFetch;
  if (savedSession === undefined) delete globalThis.sessionStorage;
  else globalThis.sessionStorage = savedSession;
}
console.log('Booking action smoke passed.');
