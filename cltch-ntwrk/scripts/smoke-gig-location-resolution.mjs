import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isValidGigCoordinatePoint, resolveGigLocationCandidate } from '../app/gig-location-resolution.js';

let requests = 0;
let requestUrl = '';
const fetchImpl = async (url) => {
  requests += 1;
  requestUrl = String(url);
  return { ok: true, json: async () => [{ lat: '33.7490', lon: '-84.3880', display_name: 'Atlanta, Georgia, United States' }] };
};
const noConsent = await resolveGigLocationCandidate({ location: 'Atlanta, GA', consentGiven: false, fetchImpl });
assert.equal(noConsent.ok, false);
assert.equal(requests, 0, 'override resolution must not contact Nominatim before consent');
const confirmedLookup = await resolveGigLocationCandidate({ location: '  Atlanta, GA  ', consentGiven: true, fetchImpl });
assert.equal(confirmedLookup.ok, true);
assert.equal(requests, 1);
assert.match(requestUrl, /^https:\/\/nominatim\.openstreetmap\.org\/search\?/);
assert.match(requestUrl, /q=Atlanta%2C%20GA/);
assert.match(requestUrl, /format=json&limit=1/);
assert.deepEqual(confirmedLookup.candidate, { lat: 33.749, lng: -84.388, label: 'Atlanta, Georgia, United States' });
assert.equal(isValidGigCoordinatePoint({ lat: -90, lng: 180 }), true);
assert.equal(isValidGigCoordinatePoint({ lat: 90.01, lng: 0 }), false);
assert.equal(isValidGigCoordinatePoint({ lat: 0, lng: -180.01 }), false);
assert.equal((await resolveGigLocationCandidate({ location: 'Atlanta', consentGiven: true, fetchImpl: async () => ({ ok: true, json: async () => [{ lat: '', lon: '4' }] }) })).ok, false);

const [page, rules] = await Promise.all([
  readFile(new URL('../host.html', import.meta.url), 'utf8'),
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8')
]);
assert.match(page, /id="location" placeholder="City, State" required/);
assert.match(page, /sends the text in Location to the public Nominatim service only after you check consent and click Resolve/);
assert.match(page, /id="gigLocationGeocodeConsent" type="checkbox"/);
assert.match(page, /resolveGigLocationBtn\.addEventListener\('click', async \(\) => \{[\s\S]*?if \(!gigLocationConsent\.checked \|\| !location\)[\s\S]*?resolveGigLocationCandidate\(\{ location, consentGiven: true \}\)/);
assert.match(page, /cancelGigLocationResolutionBtn\.addEventListener\('click'/);
assert.match(page, /useGigLocationCandidateBtn\.addEventListener\('click'/);
assert.match(page, /confirmedGigCoordinates = \{ lat: gigLocationCandidate\.lat, lng: gigLocationCandidate\.lng \}/);
assert.match(page, /const coords = confirmedGigCoordinates && isValidGigCoordinatePoint\(confirmedGigCoordinates\)[\s\S]*?: await geocode\(location\)/);
assert.match(page, /location\s*\n\s*\};[\s\S]*?\(coords && \{ lat: coords\.lat, lng: coords\.lng \}\)/);
assert.doesNotMatch(page, /navigator\.geolocation/);
assert.match(rules, /'lat', 'lng', 'payBaseAmount'/);
assert.match(rules, /isOptionalNumberInRange\('lat', -90, 90\)/);
assert.match(rules, /isOptionalNumberInRange\('lng', -180, 180\)/);
console.log('Gig location resolution smoke passed (consent gate, candidate confirmation, bounds, existing gig fields).');
