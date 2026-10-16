import assert from 'node:assert/strict';
import { createAccountExport, downloadAccountExport } from '../app/account-export.js';

const reads = [];
const snapshot = await createAccountExport({
  user: {
    uid: 'account-123',
    email: 'user@example.com',
    emailVerified: true,
    displayName: 'CLTCH User',
    metadata: { creationTime: '2026-01-01T00:00:00Z' },
    providerData: [{ providerId: 'password' }]
  },
  readDocument: async (collection, uid) => {
    reads.push([collection, uid]);
    return collection === 'hosts' ? { venueName: 'Example Venue', updatedAt: { toDate: () => new Date('2026-02-01T00:00:00Z') } } : null;
  }
});
assert.deepEqual(reads.map(([collection]) => collection), ['users', 'userRoles', 'hosts', 'musicians']);
assert.ok(reads.every(([, uid]) => uid === 'account-123'), 'export reads must stay scoped to the signed-in UID');
assert.equal(snapshot.account.emailVerified, true);
assert.equal(snapshot.data.hosts.updatedAt, '2026-02-01T00:00:00.000Z');
assert.equal(snapshot.data.musicians, null);

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
