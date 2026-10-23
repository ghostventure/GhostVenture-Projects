import assert from 'node:assert/strict';
import { createAccountExport, downloadAccountExport } from '../app/account-export.js';

const reads = [];
const subcollectionReads = [];
const snapshot = await createAccountExport({
  user: {
    uid: 'account-123',
    email: 'user@example.com',
    emailVerified: true,
    displayName: 'CLTCH User',
    metadata: { creationTime: '2026-01-01T00:00:00Z' },
    providerData: [{ providerId: 'password' }]
  },
  readCollection: async (collection, uid) => {
    assert.equal(collection, 'gigs');
    assert.equal(uid, 'account-123');
    return [{ id: 'gig-1', status: 'accepted' }, { id: 'gig-2', status: 'open' }];
  },
  readSubcollection: async (collection, parentId, child) => {
    subcollectionReads.push([collection, parentId, child]);
    if (child === 'messages') return [{ id: 'm-1', text: 'confirmed', createdAt: { toDate: () => new Date('2026-03-01T00:00:00Z') } }];
    return [{ id: 'r-1', grade: 'A' }];
  },
  readCollectionGroup: async (name, field, value) => {
    assert.deepEqual([name, field, value], ['reviews', 'hostId', 'account-123']);
    return [{ id: 'r-2', grade: 'B' }];
  },
  readDocument: async (collection, uid) => {
    reads.push([collection, uid]);
    return collection === 'hosts' ? { venueName: 'Example Venue', updatedAt: { toDate: () => new Date('2026-02-01T00:00:00Z') } } : collection === 'musicians' ? { media: [{ url: 'https://example.com/photo' }] } : null;
  }
});
assert.deepEqual(reads.map(([collection]) => collection), ['users', 'userRoles', 'hosts', 'musicians']);
assert.ok(reads.every(([, uid]) => uid === 'account-123'), 'export reads must stay scoped to the signed-in UID');
assert.equal(snapshot.account.emailVerified, true);
assert.equal(snapshot.data.hosts.updatedAt, '2026-02-01T00:00:00.000Z');
assert.equal(snapshot.data.musicians.media[0].url, 'https://example.com/photo');
assert.equal(snapshot.data.bookings.length, 2);
assert.equal(snapshot.data.bookings[0].messages[0].text, 'confirmed');
assert.equal(snapshot.data.bookings[0].messages[0].createdAt, '2026-03-01T00:00:00.000Z');
assert.deepEqual(snapshot.data.bookings[1].messages, [], 'open gig messages must not be read');
assert.deepEqual(snapshot.data.reviews.map((review) => review.grade), ['A', 'B']);
assert.equal(snapshot.data.mediaMetadata.musicianPortfolio[0].url, 'https://example.com/photo');
assert.deepEqual(subcollectionReads, [['gigs', 'gig-1', 'messages'], ['musicians', 'account-123', 'reviews']]);

let clicked = false;
let removed = false;
let revoked = false;
const fakeDocument = {
  body: { appendChild() {} },
  createElement() {
    return { click() { clicked = true; }, remove() { removed = true; } };
  }
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
console.log('Account export smoke passed: self-scoped reads, timestamp serialization, download, and URL cleanup.');
