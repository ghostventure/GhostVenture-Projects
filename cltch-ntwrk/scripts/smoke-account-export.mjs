import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAccountExport, downloadAccountExport } from '../app/account-export.js';

const uid = 'account-123';
const reads = [];
const gigs = [
  { id: 'host-booking', data: { hostId: uid, acceptedBy: 'performer-9', status: 'completed', amount: 50 } },
  { id: 'performer-booking', data: { hostId: 'host-9', acceptedBy: uid, status: 'accepted' } },
  { id: 'other-account', data: { hostId: 'other', acceptedBy: 'other', status: 'open' } },
  { id: 'forged-row', data: { hostId: 'other', acceptedBy: 'other', status: 'accepted' } }
];
let messageCalls = [];
const snapshot = await createAccountExport({
  user: {
    uid, email: 'user@example.com', emailVerified: true, displayName: 'CLTCH User',
    metadata: { creationTime: '2026-01-01T00:00:00Z' }, providerData: [{ providerId: 'password' }]
  },
  readDocument: async (collection, readUid) => {
    reads.push([collection, readUid]);
    return collection === 'hosts' ? { venueName: 'Example Venue', updatedAt: { toDate: () => new Date('2026-02-01T00:00:00Z') } } : null;
  },
  readGigsByHost: async (readUid) => { assert.equal(readUid, uid); return [gigs[0], gigs[2], gigs[3]]; },
  readGigsByPerformer: async (readUid) => { assert.equal(readUid, uid); return [gigs[1], gigs[3]]; },
  readBookingMessages: async (readUid, gigId) => {
    assert.equal(readUid, uid);
    messageCalls.push(gigId);
    return [
      { id: `${gigId}-host-msg`, data: { senderId: gigId === 'host-booking' ? uid : 'host-9', senderRole: 'host', text: 'hello' } },
      { id: `${gigId}-other-msg`, data: { senderId: 'unrelated', senderRole: 'host', text: 'nope' } }
    ];
  },
  readPerformerReviews: async (readUid) => {
    assert.equal(readUid, uid);
    return [{ id: 'received-1', data: { grade: 'A', hostId: 'host-9' } }];
  },
  readReviewsForBooking: async (readUid, gigId, performerId) => {
    assert.equal(readUid, uid);
    assert.equal(performerId, 'performer-9');
    return [
      { id: 'own-authored', data: { gigId, hostId: uid, grade: 'A' } },
      { id: 'forged-authored', data: { gigId, hostId: 'other', grade: 'F' } }
    ];
  }
});
assert.deepEqual(reads.map(([collection]) => collection), ['users', 'userRoles', 'hosts', 'musicians']);
assert.ok(reads.every(([, readUid]) => readUid === uid), 'profile docs must stay scoped to the signed-in UID');
assert.equal(snapshot.account.emailVerified, true);
assert.equal(snapshot.data.hosts.updatedAt, '2026-02-01T00:00:00.000Z');
assert.equal(snapshot.data.musicians, null);
assert.deepEqual(snapshot.data.bookingHistory.items.map(({ id }) => id).sort(), ['host-booking', 'performer-booking']);
assert.equal(snapshot.data.bookingHistory.items.find(({ id }) => id === 'host-booking').relationship[0], 'host');
assert.equal(snapshot.data.bookingHistory.items.some(({ id }) => id === 'other-account' || id === 'forged-row'), false, 'unowned gig rows are rejected');
assert.deepEqual(messageCalls.sort(), ['performer-booking'], 'only currently accepted bookings should read messages');
assert.equal(snapshot.data.messages.count, 1, 'messages from unrelated senders must be excluded');
assert.equal(snapshot.data.reviews.received.length, 1);
assert.equal(snapshot.data.reviews.authored.length, 1, 'only reviews authored by the exporting host should be included');
assert.equal(snapshot.data.mediaMetadata.availability, 'unavailable');
assert.equal(snapshot.data.mediaMetadata.fileContentsIncluded, false);
assert.match(snapshot.data.mediaMetadata.note, /ownership cannot be verified/);
assert.equal(snapshot.completeness.status, 'available-records-exported');

const [rules, hostPage, performerPage] = await Promise.all([
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  readFile(new URL('../host-profile.html', import.meta.url), 'utf8'),
  readFile(new URL('../musician-profile.html', import.meta.url), 'utf8')
]);
assert.match(rules, /resource\.data\.hostId == request\.auth\.uid/);
assert.match(rules, /resource\.data\.acceptedBy == request\.auth\.uid/);
assert.match(rules, /get\([^\n]*gigs\/\$\(gigId\)[^\n]*\.data\.status == 'accepted'/);
assert.match(hostPage, /where\('hostId', '==', uid\)/);
assert.match(hostPage, /where\('acceptedBy', '==', uid\)/);
assert.match(performerPage, /where\('hostId', '==', uid\)/);
assert.match(performerPage, /where\('acceptedBy', '==', uid\)/);
for (const page of [hostPage, performerPage]) {
  assert.match(page, /orderBy\(documentId\(\)\)/, 'record queries must have a stable cursor order');
  assert.match(page, /startAfter\(cursor\)/, 'record queries must paginate by cursor');
  assert.match(page, /limit\(100\)/, 'each query page must be bounded');
  assert.match(page, /current\.data\(\)[\s\S]{0,180}latest\.status !== 'accepted'/, 'nested messages must recheck accepted participant access');
}

const failedSnapshot = await createAccountExport({
  user: { uid },
  readDocument: async () => null,
  readGigsByHost: async () => { throw new Error('permission denied'); },
  readGigsByPerformer: async () => [],
  readBookingMessages: async () => [],
  readPerformerReviews: async () => [],
  readReviewsForBooking: async () => []
});
assert.equal(failedSnapshot.completeness.status, 'incomplete');
assert.equal(failedSnapshot.completeness.allAccessibleRecordsIncluded, false);
assert.equal(failedSnapshot.completeness.inaccessible[0].group, 'bookingHistory');
assert.doesNotMatch(JSON.stringify(failedSnapshot.completeness), /permission denied/, 'raw backend errors must not leak into export');

const docFailure = await createAccountExport({
  user: { uid },
  readDocument: async (collection) => { if (collection === 'hosts') throw new Error('denied'); return null; },
  readGigsByHost: async () => [], readGigsByPerformer: async () => [],
  readBookingMessages: async () => [], readPerformerReviews: async () => [], readReviewsForBooking: async () => []
});
assert.equal(docFailure.completeness.status, 'incomplete', 'failed profile reads must be reported');
assert.ok(docFailure.completeness.inaccessible.some(({ group }) => group === 'hosts'));

let clicked = false;
let removed = false;
let revoked = false;
const fakeDocument = {
  body: { appendChild() {} },
  createElement() { return { click() { clicked = true; }, remove() { removed = true; } }; }
};
downloadAccountExport(snapshot, {
  documentRef: fakeDocument,
  urlApi: { createObjectURL: () => 'blob:account-copy', revokeObjectURL: (url) => { revoked = url === 'blob:account-copy'; } }
});
await new Promise((resolve) => setTimeout(resolve, 1100));
assert.equal(clicked, true);
assert.equal(removed, true);
assert.equal(revoked, true, 'temporary object URL must be revoked');
await assert.rejects(() => createAccountExport({ user: null, readDocument: async () => null }));
console.log('Account export smoke passed: UID ownership, participant messages, review attribution, pagination inputs, failure reporting, media exclusions, download, and URL cleanup.');
