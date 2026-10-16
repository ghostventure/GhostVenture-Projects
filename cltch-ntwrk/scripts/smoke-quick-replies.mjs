import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deleteQuickReply, MAX_QUICK_REPLIES, readQuickReplies, saveQuickReply } from '../app/quick-replies.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const storage = new MemoryStorage();
const blockedStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
assert.deepEqual(readQuickReplies('host-A', blockedStorage), []);
assert.throws(() => saveQuickReply('host-A', 'Blocked', 'Text', blockedStorage), /blocked/);
const first = saveQuickReply('host-A', 'Arrival', 'I will arrive 30 minutes before load-in.', storage);
assert.deepEqual(readQuickReplies('host-A', storage), [first]);
assert.deepEqual(readQuickReplies('host-B', storage), []);
for (let index = 1; index < MAX_QUICK_REPLIES; index += 1) saveQuickReply('host-A', `Reply ${index}`, 'A reusable message.', storage);
assert.equal(readQuickReplies('host-A', storage).length, MAX_QUICK_REPLIES);
assert.throws(() => saveQuickReply('host-A', 'Overflow', 'Another message.', storage), RangeError);
assert.throws(() => saveQuickReply('host-A', 'Too long', 'x'.repeat(601), new MemoryStorage()), TypeError);
assert.equal(deleteQuickReply('host-A', first.id, storage).length, MAX_QUICK_REPLIES - 1);

const page = await readFile(new URL('../booking.html', import.meta.url), 'utf8');
assert.match(page, /Inserted text is not sent until you press Send Message/);
assert.match(page, /orderBy\("createdAt", "desc"\), limit\(100\)/);
assert.match(page, /body\.textContent = String\(item\.text \|\| ''\)/);
assert.match(page, /latest 100 messages in chronological order/);

console.log('Quick replies smoke passed: UID isolation, 12-template bound, length limit, explicit insert-before-send, safe message rendering, and bounded history.');
