import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [modeSwitch, hostProfile, musicianProfile, userDb, functions, rules] = await Promise.all([
  readFile(new URL('../app/mode-switch.js', import.meta.url), 'utf8'),
  readFile(new URL('../host-profile.html', import.meta.url), 'utf8'),
  readFile(new URL('../musician-profile.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/user-db.js', import.meta.url), 'utf8'),
  readFile(new URL('../functions/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8')
]);

const checks = [
  ['Mode switch checks host and musician profile documents independently', /mode === "host" \? "hosts" : "musicians"/.test(modeSwitch) && /hasProfile\(db, userId, safeMode\)/.test(modeSwitch)],
  ['Missing target profile routes to its own onboarding form', /hasProfile \? "host\.html" : "host-profile\.html"/.test(modeSwitch) && /hasProfile \? "musician-matched-gigs\.html" : "musician-profile\.html"/.test(modeSwitch)],
  ['Both profile forms write documents under the same authenticated UID', /doc\(db, 'hosts', HOST_ID\)/.test(hostProfile) && /doc\(db, 'musicians', MUSICIAN_ID\)/.test(musicianProfile)],
  ['Active role preference is persisted separately from profile documents', /setDoc\(doc\(db, "userRoles", uid\), \{ role: safeRole/.test(userDb)],
  ['Server role authorization accepts an existing matching profile even when the active role differs', /roleSnap\.exists && roleSnap\.data\(\)\.role === role/.test(functions) && functions.includes("role === 'host' ? db.collection('hosts').doc(uid) : db.collection('musicians').doc(uid)") && /if \(profileSnap\.exists\) return true/.test(functions)],
  ['Firestore permits owner-managed host and musician profile documents independently', /match \/hosts\/{userId}[\s\S]*?allow create: if isOwner\(userId\)/.test(rules) && /match \/musicians\/{userId}[\s\S]*?allow create: if isOwner\(userId\)/.test(rules)]
];

for (const [label, passed] of checks) {
  assert.ok(passed, label);
  console.log(`PASS ${label}`);
}
console.log(`Validated ${checks.length} multi-role profile contracts.`);
