import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildSupportConversationContext, buildSupportTicketCopy } from '../app/support-ticket-context.js';

const messages = Array.from({ length: 30 }, (_, i) => ({
  senderRole: i % 2 ? 'host' : 'musician',
  text: `message ${i}\u0000${'x'.repeat(180)}`,
  createdAt: { toDate: () => new Date(`2026-01-${String((i % 28) + 1).padStart(2, '0')}T12:00:00Z`) }
}));
const context = buildSupportConversationContext({ booking: { id: 'booking-1', venue: 'Room A', status: 'accepted' }, messages, includeMessages: true });
const parsed = JSON.parse(context);
assert.ok(context.length <= 8000, 'conversation context must stay within the Firestore field bound');
assert.equal(parsed.messages.length, 20, 'at most the latest 20 messages are included');
assert.ok(parsed.messages.every((item) => !item.text.includes('\u0000')));
assert.equal(JSON.parse(buildSupportConversationContext({ booking: { id: 'booking-1' }, messages, includeMessages: false })).messages.length, 0);
const oversized = buildSupportConversationContext({
  booking: { id: 'booking-1' },
  messages: messages.map((message) => ({ ...message, text: 'x'.repeat(600) })),
  includeMessages: true
});
assert.ok(oversized.length <= 8000);
assert.ok(buildSupportTicketCopy({ id: 'ticket-1', bookingId: 'booking-1', description: 'help', context }).length <= 10000);
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const supportRules = rules.slice(rules.indexOf('match /supportTickets/{ticketId}'), rules.indexOf('// ─── Membership Grants'));
assert.match(supportRules, /allow read: if isVerifiedAuth\(\) && resource\.data\.uid == request\.auth\.uid/);
assert.match(supportRules, /request\.resource\.data\.uid == request\.auth\.uid/);
assert.match(supportRules, /request\.resource\.data\.conversationContext\.size\(\) <= 8000/);
assert.match(supportRules, /allow update, delete: if false/);
const bookingPage = await readFile(new URL('../booking.html', import.meta.url), 'utf8');
assert.match(bookingPage, /does not notify staff/);
assert.match(bookingPage, /latest 20 conversation messages/);
assert.match(bookingPage, /status: "saved"/);
console.log('Support ticket context smoke passed: 20-message cap, control-character removal, context opt-out, and size bound.');
