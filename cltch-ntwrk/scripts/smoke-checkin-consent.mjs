import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { confirmArrivalWithConsent } from '../app/checkin-consent.js';

let writes = 0;
const write = async () => { writes += 1; };
assert.equal(await confirmArrivalWithConsent({ allowed: false, consentChecked: true, write }), false);
assert.equal(await confirmArrivalWithConsent({ allowed: true, consentChecked: false, write }), false);
assert.equal(await confirmArrivalWithConsent({ allowed: true, consentChecked: true }), false);
assert.equal(writes, 0, 'ineligible, unchecked, or missing-write flows must not write');
assert.equal(await confirmArrivalWithConsent({ allowed: true, consentChecked: true, write }), true);
assert.equal(writes, 1, 'explicit eligible confirmation writes exactly once');

const [page, rules] = await Promise.all([
  readFile(new URL('../booking.html', import.meta.url), 'utf8'),
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8')
]);
assert.match(page, /import \{ confirmArrivalWithConsent \} from "\.\/app\/checkin-consent\.js"/);
assert.match(page, /checkInBtn\.addEventListener\("click", \(\) => \{/);
assert.match(page, /checkInPanel\.hidden = false/);
assert.match(page, /cancelCheckInBtn\.addEventListener\("click"/);
assert.match(page, /checkInPanel\.hidden = true/);
assert.match(page, /const currentCheckIn = activeBooking \? checkInState\(activeBooking\) : \{ allowed: false \}/);
assert.match(page, /const stillEligible = activeSummary\?\.role === "musician"\s*&& activeBooking\?\.acceptedBy === activeUser\?\.uid\s*&& activeUser\?\.uid === user\.uid\s*&& currentCheckIn\.allowed\s*&& checkInAllowed\s*&& !isBrowserOffline\(navigator\)/);
assert.match(page, /consentChecked: checkInConsent\.checked/);
assert.match(page, /write: \(\) => updateDoc\(doc\(db, "gigs", bookingId\), \{ checkedInAt: serverTimestamp\(\) \}\)/);
assert.match(page, /Check in only after you arrive\. This records an arrival timestamp that the host can see\./);
assert.match(rules, /request\.resource\.data\.checkedInAt is timestamp/);
assert.match(rules, /resource\.data\.acceptedBy == request\.auth\.uid/);
console.log('Check-in consent smoke passed.');
