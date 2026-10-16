import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../performer-view.html', import.meta.url), 'utf8');
const checks = [
  ['Firestore profile fields are escaped before HTML rendering', /function escapeHtml\(value\)/.test(html) && /escapeHtml\(d\.bio\)/.test(html) && /escapeHtml\(d\.experience \|\| '—'\)/.test(html) && /escapeHtml\(r\.feedback\)/.test(html)],
  ['Review reads are bounded to 50 newest records', /orderBy\('createdAt', 'desc'\), limit\(50\)/.test(html)],
  ['Review loading failures have a user-visible recovery message', /reviewLoadFailed/.test(html) && /Reviews could not be loaded right now/.test(html)],
  ['Profile fetch failures show a recovery state', /Profile unavailable/.test(html) && /Check your connection and try again/.test(html)],
  ['Share action supports Web Share and clipboard with live status', /navigator\.share\(shareData\)/.test(html) && /navigator\.clipboard\.writeText/.test(html) && /aria-live="polite"/.test(html)],
  ['Booking return target safely encodes performer id', /performer=\$\{encodeURIComponent\(id\)\}/.test(html)],
];
for (const [label, passed] of checks) {
  assert.ok(passed, label);
  console.log(`PASS ${label}`);
}
console.log(`Validated ${checks.length} performer profile capabilities.`);
