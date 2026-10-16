import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../booking.html', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');

assert.match(page, /id="messageSyncStatus" role="status" aria-live="polite"/);
assert.match(page, /onSnapshot\(q, \{ includeMetadataChanges: true \},/);
assert.match(page, /snapshot\.metadata\.fromCache/);
assert.match(page, /snapshot\.metadata\.hasPendingWrites/);
assert.match(page, /Thread snapshot synced with the server/);
assert.match(page, /cache-only thread snapshot/);
assert.match(page, /includes your latest message/);
assert.match(page, /does not mean the recipient read/);
assert.match(page, /Unable to confirm whether the thread is synced/);
assert.match(page, /createMessageRetryGuard/);
assert.match(page, /getDocFromServer\(ref\)/);
assert.match(rules, /allow update, delete: if false;/);
assert.doesNotMatch(rules, /readAt|readBy|deliveredAt/);

console.log('Message sync status smoke passed: server/cache metadata is exposed accessibly, sender sync copy is bounded, recipient-read is never implied, and rules/retry guard remain unchanged.');
