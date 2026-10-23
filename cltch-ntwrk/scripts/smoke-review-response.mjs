import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../performer-view.html', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const checks = [
  ['Only the signed-in performer sees response controls', /const isOwnProfile = auth\.currentUser\?\.uid === id/.test(page) && /isOwnProfile && r\.id/.test(page)],
  ['Response and correction request are explicit choices', /value="response">Public response/.test(page) && /value="correction">Request a correction/.test(page)],
  ['Text is escaped and bounded in the interface', /maxlength="500"/.test(page) && /escapeHtml\(response\.message\)/.test(page)],
  ['Writes use a stable per-performer document id', /reviews', form\.dataset\.reviewId, 'responses', id/.test(page)],
  ['Rules permit only the performer to create one immutable response', /match \/responses\/{performerId}/.test(rules) && /allow update, delete: if false/.test(rules) && /performerId == userId/.test(rules)],
  ['Rules enforce kind and message length', /request\.resource\.data\.kind in \['response', 'correction'\]/.test(rules) && /request\.resource\.data\.message\.size\(\) <= 500/.test(rules)],
];
for (const [label, passed] of checks) {
  assert.ok(passed, label);
  console.log(`PASS ${label}`);
}
console.log(`Validated ${checks.length} review response safeguards.`);
