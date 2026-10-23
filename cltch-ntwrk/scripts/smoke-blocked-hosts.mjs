import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../gig-radar.html', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const checks = [
  ['Block state loads from the signed-in user private path', /collection\(db, 'userBlocks', MUSICIAN_ID, 'blocked'\)/.test(html)],
  ['Blocked hosts are filtered before match scoring', /if \(blockedHostIds\.has\(g\.hostId\)\) return false/.test(html)],
  ['Gig cards provide a block action and an unblock control', /blockHostForGig\('\$\{gigId\}'\)/.test(html) && /button\.textContent = 'Unblock'/.test(html)],
  ['Block action writes a server timestamp and refreshes the feed', /setDoc\(doc\(db, 'userBlocks', MUSICIAN_ID, 'blocked', hostId\), \{ blockedAt: serverTimestamp\(\) \}\)/.test(html) && /matchedGigFeed = matchedGigFeed\.filter/.test(html)],
  ['Unblocking deletes the private record and reloads matching', /deleteDoc\(doc\(db, 'userBlocks', MUSICIAN_ID, 'blocked', hostId\)\)/.test(html) && /blockedHostIds\.delete\(hostId\)/.test(html) && /startListening\(\)/.test(html)],
  ['Rules restrict block records to the owner and make updates immutable', /match \/userBlocks\/{userId}\/blocked\/{blockedUserId}/.test(rules) && /allow read: if isOwner\(userId\)/.test(rules) && /allow update: if false/.test(rules)],
  ['Rules prevent a blocked relationship from being accepted', /function isBlockedBetween\(userA, userB\)/.test(rules) && /!isBlockedBetween\(request\.auth\.uid, resource\.data\.hostId\)/.test(rules)],
];
for (const [label, passed] of checks) {
  assert.ok(passed, label);
  console.log(`PASS ${label}`);
}
console.log(`Validated ${checks.length} blocked host safeguards.`);
