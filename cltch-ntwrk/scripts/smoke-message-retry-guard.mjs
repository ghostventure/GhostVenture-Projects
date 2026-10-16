import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMessageRetryGuard } from '../app/message-retry-guard.js';

const payload = { gigId: 'gig-a', senderId: 'user-a', senderRole: 'host', text: 'Doors open at 7.' };
const store = new Map();
let refCount = 0;
let createCount = 0;
const adapters = {
  createRef: () => ({ id: `message-${++refCount}` }),
  read: async (ref) => store.get(ref.id) || null,
  create: async (ref, message) => {
    createCount += 1;
    store.set(ref.id, { ...message });
  }
};

const guard = createMessageRetryGuard();
assert.deepEqual(await guard.send(payload, adapters), { status: 'sent' });
assert.deepEqual(await guard.send(payload, adapters), { status: 'sent' });
assert.equal(refCount, 2, 'a completed send starts a new intentional message on a later submit');
assert.equal(createCount, 2);

const retryGuard = createMessageRetryGuard();
const retryStore = new Map();
let retryRef;
const uncertainWrite = {
  createRef: () => (retryRef = { id: 'stable-retry-id' }),
  read: async (ref) => retryStore.get(ref.id) || null,
  create: async (ref, message) => {
    retryStore.set(ref.id, { ...message });
    throw new Error('response lost after create');
  }
};
assert.deepEqual(await retryGuard.send(payload, uncertainWrite), { status: 'unknown' });
assert.equal(retryGuard.hasPending(), true);
assert.deepEqual(await retryGuard.send(payload, uncertainWrite), { status: 'already-created' });
assert.equal(retryRef.id, 'stable-retry-id');
assert.equal(retryStore.size, 1, 'retry finds the committed message under the same ref');
assert.equal(retryGuard.hasPending(), false);

const blockedGuard = createMessageRetryGuard();
let blockedRefs = 0;
const readFailure = {
  createRef: () => ({ id: `unknown-${++blockedRefs}` }),
  read: async () => { throw new Error('permission/network failure'); },
  create: async () => assert.fail('unknown/read failure must not blind-create')
};
assert.deepEqual(await blockedGuard.send(payload, readFailure), { status: 'unknown' });
assert.deepEqual(await blockedGuard.send({ ...payload, text: 'Changed text' }, readFailure), { status: 'pending-different-payload' });
assert.deepEqual(await blockedGuard.send(payload, readFailure), { status: 'unknown' });
assert.equal(blockedRefs, 1, 'unknown retry keeps the same ref rather than creating another random ID');
assert.equal(blockedGuard.hasPending(), true);

const page = await readFile(new URL('../booking.html', import.meta.url), 'utf8');
assert.match(page, /createMessageRetryGuard/);
assert.match(page, /getDocFromServer\(ref\)/);
assert.match(page, /setDoc\(ref/);
assert.doesNotMatch(page, /addDoc\(collection\(db, "gigs", activeBooking\.id, "messages"\)/);
assert.match(page, /keep this page open/);
assert.match(page, /not durable idempotency/);

console.log('Message retry smoke passed: same pending message ID is reused, changed payload is blocked while delivery is unknown, and read failures never trigger blind create.');
