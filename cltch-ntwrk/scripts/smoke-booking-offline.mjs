import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { installBookingOfflineStatus, isBrowserOffline } from '../app/booking-offline.js';

assert.equal(isBrowserOffline({ onLine: false }), true);
assert.equal(isBrowserOffline({ onLine: true }), false);
assert.equal(isBrowserOffline({}), false, 'unknown browser state is not treated as confirmed offline');

const listeners = new Map();
const windowRef = {
  addEventListener(type, listener) { listeners.set(type, listener); },
  removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); }
};
const copy = { textContent: '' };
const banner = { hidden: true, dataset: {}, querySelector: (selector) => selector === '[data-connection-copy]' ? copy : null };
let dismissed = null;
const dismissButton = {
  hidden: true,
  addEventListener(type, listener) { if (type === 'click') dismissed = listener; },
  removeEventListener(type, listener) { if (type === 'click' && dismissed === listener) dismissed = null; }
};
const changes = [];
const navigatorRef = { onLine: true };
const cleanup = installBookingOfflineStatus({ navigatorRef, windowRef, banner, dismissButton, onChange: (offline) => changes.push(offline) });
assert.equal(banner.hidden, true, 'online initial state stays quiet');
assert.deepEqual(changes, [false]);
navigatorRef.onLine = false;
listeners.get('offline')();
assert.equal(banner.hidden, false);
assert.equal(banner.dataset.connection, 'offline');
assert.match(copy.textContent, /booking details may be stale/);
assert.match(copy.textContent, /draft here/);
assert.equal(dismissButton.hidden, true);
assert.equal(changes.at(-1), true);
navigatorRef.onLine = true;
listeners.get('online')();
assert.equal(banner.hidden, false, 'reconnect guidance remains visible until dismissed');
assert.equal(banner.dataset.connection, 'online');
assert.match(copy.textContent, /no new action is sent automatically/);
assert.equal(dismissButton.hidden, false);
dismissed();
assert.equal(banner.hidden, true);
cleanup();
assert.equal(listeners.size, 0, 'connection listeners are removed at cleanup');
assert.equal(dismissed, null);

const [booking, rules, offlineModule, packageJson, checklist] = await Promise.all([
  readFile(new URL('../booking.html', import.meta.url), 'utf8'),
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  readFile(new URL('../app/booking-offline.js', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../docs/FEATURE_AUDIT_200.md', import.meta.url), 'utf8')
]);
assert.match(booking, /installBookingOfflineStatus\(/);
assert.match(booking, /messageSendBtn\.disabled = !enabled \|\| offline/);
assert.match(booking, /if \(isBrowserOffline\(navigator\)\) \{[\s\S]{0,220}Check-in was not started[\s\S]{0,300}await updateDoc/);
assert.match(booking, /if \(isBrowserOffline\(navigator\)\) \{[\s\S]{0,240}draft remains here[\s\S]{0,200}return;\s*\}\s*const text[\s\S]{0,300}await addDoc/);
assert.ok(booking.indexOf('await addDoc(') < booking.indexOf('messageInputEl.value = ""'), 'composer clears only after Firestore write resolves');
assert.match(rules, /get\([^\n]*gigs\/\$\(gigId\)[^\n]*\.data\.status == 'accepted'/);
assert.match(rules, /request\.resource\.data\.senderId == request\.auth\.uid/);
assert.match(rules, /resource\.data\.acceptedBy == request\.auth\.uid[\s\S]{0,200}request\.resource\.data\.checkedInAt is timestamp/);
assert.doesNotMatch(offlineModule, /localStorage|sessionStorage|setTimeout|retry\s*\(/i, 'offline helper must not persist, schedule, or replay actions');
assert.match(packageJson, /"smoke:booking-offline": "node scripts\/smoke-booking-offline\.mjs"/);
assert.match(checklist, /\[x\] 153\.[\s\S]*Booking-details offline guard/);
console.log('Booking offline smoke passed: connection transitions, disabled/guarded remote actions, draft retention, and no queue/replay.');
