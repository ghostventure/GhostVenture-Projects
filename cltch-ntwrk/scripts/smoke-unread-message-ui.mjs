import assert from 'node:assert/strict';
import { fetchUnreadMessageCount } from '../app/unread-message-count.js';

let request;
const user = { getIdToken: async () => 'id-token' };
const exact = await fetchUnreadMessageCount(user, async (url, options) => {
  request = { url, options };
  return { ok: true, json: async () => ({ available: true, exact: true, unreadCount: 3, bookingThreads: 2, checkedAt: '2026-10-23T15:00:00.000Z' }) };
});
assert.equal(exact.unreadCount, 3);
assert.equal(request.options.headers.Authorization, 'Bearer id-token');
assert.equal(request.options.cache, 'no-store');

const capped = await fetchUnreadMessageCount(user, async () => ({
  ok: true,
  json: async () => ({ available: false, exact: false, unreadCount: null, reason: 'booking_limit' })
}));
assert.equal(capped.available, false);
await assert.rejects(() => fetchUnreadMessageCount(user, async () => ({
  ok: true,
  json: async () => ({ available: true, exact: false, unreadCount: 999, bookingThreads: 1 })
})), /verifiable unread count/);
console.log('Unread count UI smoke passed: authenticated no-cache request and fail-closed response validation.');
