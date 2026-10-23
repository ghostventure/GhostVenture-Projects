import assert from 'node:assert/strict';
import { ensureMessageStored } from '../app/message-delivery.js';

const message = { id: 'retry-id', senderId: 'user-1', text: 'hello' };
let writes = 0;
const first = await ensureMessageStored({ message, lookup: async () => null, write: async () => { writes += 1; } });
assert.deepEqual(first, { stored: true, duplicate: false });
const retry = await ensureMessageStored({ message, lookup: async () => ({ senderId: 'user-1', text: 'hello' }), write: async () => { writes += 1; } });
assert.deepEqual(retry, { stored: true, duplicate: true });
assert.equal(writes, 1, 'a confirmed retry must not write a duplicate');
await assert.rejects(() => ensureMessageStored({ message, lookup: async () => ({ senderId: 'user-2', text: 'other' }), write: async () => {} }));
console.log('Message delivery smoke passed: stable retry ID, duplicate recognition, and collision rejection.');
