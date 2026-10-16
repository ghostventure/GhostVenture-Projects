import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MAX_CANCELLATION_REASON_LENGTH, normalizeCancellationReason } from '../app/cancellation-reason.js';

assert.equal(normalizeCancellationReason('  Schedule changed  '), 'Schedule changed');
assert.equal(normalizeCancellationReason(null), '');
assert.equal(normalizeCancellationReason('x'.repeat(200)).length, MAX_CANCELLATION_REASON_LENGTH);
const host = await readFile(new URL('../host.html', import.meta.url), 'utf8');
const booking = await readFile(new URL('../booking.html', import.meta.url), 'utf8');
assert.match(host, /Optional reason for your private booking record/);
assert.match(host, /normalizeCancellationReason\(reasonInput\)/);
assert.match(host, /No performer notification was sent/);
assert.match(booking, /host-only reason is recorded privately/);
assert.match(booking, /isHostOwner && gig\.status === "cancelled" && gig\.cancelReason/);
assert.match(booking, /escapeHtml\(gig\.genre\)/);
assert.match(booking, /performer-view\.html\?id=\$\{encodeURIComponent\(gig\.acceptedBy\)\}/);
console.log('Cancellation reason smoke passed: bounded host-private reason and explicit no-notification status.');
