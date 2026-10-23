import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { createUnreadMessageCountService } = require('./unread-message-count.js');

class FakeTime {
  constructor(value) { this.seconds = value; this.nanoseconds = 0; }
  toMillis() { return this.seconds * 1000; }
  isEqual(other) { return this.seconds === other?.seconds && this.nanoseconds === other?.nanoseconds; }
}

function makeDatabase({ gigs = [], messages = {}, states = {} } = {}) {
  const messageReads = [];
  let stateWriteCounter = 10000;
  function snapshot(id, data, ref, updateTime = new FakeTime(1)) {
    return { id, exists: !!data, ref, updateTime, data: () => data, get: (field) => data?.[field] };
  }
  function compare(a, b, field) {
    if (field === '__name__') return String(a.id).localeCompare(String(b.id));
    const av = a.data?.[field];
    const bv = b.data?.[field];
    if (av?.seconds != null && bv?.seconds != null) return av.seconds - bv.seconds;
    return String(av ?? '').localeCompare(String(bv ?? ''));
  }
  class FakeQuery {
    constructor(path, filters = [], orders = [], max = Infinity, cursor = null) {
      Object.assign(this, { path, filters, orders, max, cursor });
    }
    where(field, op, value) { return new FakeQuery(this.path, [...this.filters, [field, op, value]], this.orders, this.max, this.cursor); }
    orderBy(field, direction = 'asc') { return new FakeQuery(this.path, this.filters, [...this.orders, [field, direction]], this.max, this.cursor); }
    limit(max) { return new FakeQuery(this.path, this.filters, this.orders, Math.min(this.max, max), this.cursor); }
    startAfter(...values) { return new FakeQuery(this.path, this.filters, this.orders, this.max, values); }
    count() {
      return { get: async () => {
        messageReads.push(this.path);
        return { data: () => ({ count: Math.min(this.rows().length, this.max) }) };
      } };
    }
    rows() {
      const source = this.path === 'gigs'
        ? gigs.map((item) => ({ id: item.id, data: item.data, ref: gigRef(item.id) }))
        : (messages[this.path] || []).map((item) => ({ id: item.id, data: item, ref: messageRef(this.path, item.id) }));
      let rows = source.filter((row) => this.filters.every(([field, op, value]) => {
        const actual = field === '__name__' ? row.id : row.data[field];
        if (op === '==') return actual === value || (actual?.isEqual && actual.isEqual(value));
        if (op === '<') return (actual?.seconds ?? actual) < (value?.seconds ?? value);
        if (op === '>') return (actual?.seconds ?? actual) > (value?.seconds ?? value);
        return false;
      }));
      if (this.orders.length) rows.sort((a, b) => {
        for (const [field, direction] of this.orders) {
          const result = compare(a, b, field);
          if (result) return direction === 'desc' ? -result : result;
        }
        return 0;
      });
      if (this.cursor) rows = rows.filter((row) => {
        const result = compare(row, { id: this.cursor[1], data: { createdAt: this.cursor[0] } }, 'createdAt')
          || compare(row, { id: this.cursor[1], data: { createdAt: this.cursor[0] } }, '__name__');
        return result > 0;
      });
      return rows.slice(0, this.max);
    }
    async get() { return { docs: this.rows().map((row) => snapshot(row.id, row.data, row.ref)), empty: this.rows().length === 0 }; }
    doc(id) { return messageRef(this.path, id); }
  }
  function messageRef(path, id) {
    return { get: async () => snapshot(id, (messages[path] || []).find((item) => item.id === id) || null, messageRef(path, id)) };
  }
  function stateRef(gigId, uid) {
    const key = `${gigId}/${uid}`;
    return {
      get: async () => snapshot(uid, states[key] || null, stateRef(gigId, uid), states[key]?.updateTime),
      set: async (data) => { states[key] = { ...data, updateTime: new FakeTime(++stateWriteCounter) }; }
    };
  }
  function gigRef(id) {
    const data = gigs.find((item) => item.id === id)?.data || null;
    return {
      get: async () => snapshot(id, data, gigRef(id)),
      collection: (name) => name === 'messages'
        ? new FakeQuery(`${id}/messages`)
        : { doc: (uid) => stateRef(id, uid) }
    };
  }
  return {
    db: { collection: (name) => new FakeQuery(name) },
    messageReads,
    states
  };
}

const messages = {
  'gig-a/messages': [
    { id: 'm-1', senderId: 'host-a', text: 'one', createdAt: new FakeTime(1) },
    { id: 'm-2', senderId: 'performer-a', text: 'reply', createdAt: new FakeTime(2) },
    { id: 'm-3', senderId: 'host-a', text: 'two', createdAt: new FakeTime(3) }
  ]
};
const fixture = makeDatabase({
  gigs: [{ id: 'gig-a', data: { hostId: 'host-a', acceptedBy: 'performer-a', status: 'accepted' } }],
  messages
});
const countUnread = createUnreadMessageCountService({ db: fixture.db, documentIdField: '__name__' });
const exact = await countUnread('performer-a');
assert.equal(exact.available, true);
assert.equal(exact.exact, true);
assert.equal(exact.unreadCount, 2, 'only peer-authored messages count');
assert.equal(exact.bookingThreads, 1);

const readPointerFixture = makeDatabase({
  gigs: [{ id: 'gig-a', data: { hostId: 'host-a', acceptedBy: 'performer-a', status: 'accepted' } }],
  messages,
  states: { 'gig-a/performer-a': {
    readModelVersion: 2,
    lastReadAt: new FakeTime(4),
    lastReadMessageId: 'm-2',
    lastReadMessageCreatedAt: new FakeTime(2)
  } }
});
const afterReceipt = await createUnreadMessageCountService({ db: readPointerFixture.db, documentIdField: '__name__' })('performer-a');
assert.equal(afterReceipt.unreadCount, 1, 'message cursor must move the unread boundary past the last-read message');

const legacyFixture = makeDatabase({
  gigs: [{ id: 'gig-a', data: { hostId: 'host-a', acceptedBy: 'performer-a', status: 'accepted' } }],
  messages: { 'gig-a/messages': [...messages['gig-a/messages'], { id: 'm-4', senderId: 'host-a', text: 'later', createdAt: new FakeTime(5) }] },
  states: { 'gig-a/performer-a': { lastReadAt: new FakeTime(4) } }
});
const migrated = await createUnreadMessageCountService({ db: legacyFixture.db, documentIdField: '__name__' })('performer-a');
assert.equal(migrated.unreadCount, 1, 'legacy receipts without timestamp ties should migrate to an exact message cursor');
assert.equal(legacyFixture.states['gig-a/performer-a'].readModelVersion, 2);

const ambiguousLegacy = makeDatabase({
  gigs: [{ id: 'gig-a', data: { hostId: 'host-a', acceptedBy: 'performer-a', status: 'accepted' } }],
  messages,
  states: { 'gig-a/performer-a': { lastReadAt: new FakeTime(3) } }
});
const ambiguous = await createUnreadMessageCountService({ db: ambiguousLegacy.db, documentIdField: '__name__' })('performer-a');
assert.equal(ambiguous.available, false, 'timestamp ties in legacy state cannot be resolved safely');
assert.equal(ambiguous.reason, 'read_state_refresh_required');

const tooMany = makeDatabase({
  gigs: Array.from({ length: 26 }, (_, i) => ({ id: `g-${i}`, data: { hostId: 'host-a', acceptedBy: 'performer-a', status: 'accepted' } }))
});
const capped = await createUnreadMessageCountService({ db: tooMany.db, documentIdField: '__name__' })('performer-a');
assert.equal(capped.available, false);
assert.equal(capped.unreadCount, null, 'the service must withhold an inexact partial total');
assert.equal(capped.reason, 'booking_limit');

const oversizedMessages = makeDatabase({
  gigs: [{ id: 'gig-a', data: { hostId: 'host-a', acceptedBy: 'performer-a', status: 'accepted' } }],
  messages: { 'gig-a/messages': Array.from({ length: 1001 }, (_, i) => ({ id: `m-${i}`, senderId: 'host-a', createdAt: new FakeTime(i + 1) })) }
});
const messageCap = await createUnreadMessageCountService({ db: oversizedMessages.db, documentIdField: '__name__' })('performer-a');
assert.equal(messageCap.available, false);
assert.equal(messageCap.unreadCount, null);
assert.equal(messageCap.reason, 'message_limit');

const nonParticipant = makeDatabase({
  gigs: [{ id: 'gig-a', data: { hostId: 'host-a', acceptedBy: 'performer-a', status: 'accepted' } }],
  messages
});
const unrelated = await createUnreadMessageCountService({ db: nonParticipant.db, documentIdField: '__name__' })('unrelated-user');
assert.equal(unrelated.unreadCount, 0, 'a user outside both booking roles sees no booking threads or messages');
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
assert.match(rules, /request\.resource\.data\.readModelVersion == 2/);
assert.match(rules, /get\(\/databases\/\$\(database\)\/documents\/gigs\/\$\(gigId\)\/messages\/\$\(request\.resource\.data\.lastReadMessageId\)\)\.data\.createdAt == request\.resource\.data\.lastReadMessageCreatedAt/);
console.log('Unread message count smoke passed: participant-only messages, exact summary, and fail-closed limits.');
