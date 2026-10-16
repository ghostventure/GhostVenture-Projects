import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { approximateGigDistanceLabel } from '../app/gig-distance.js';

assert.equal(approximateGigDistanceLabel({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 'Approx. straight-line distance: under 1 mile');
assert.equal(approximateGigDistanceLabel({ lat: 0, lng: 0 }, { lat: 0, lng: 0.01 }), 'Approx. straight-line distance: 1 mile');
assert.equal(approximateGigDistanceLabel({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }), 'Approx. straight-line distance: 69 miles');
assert.equal(approximateGigDistanceLabel({ lat: 90, lng: 180 }, { lat: -90, lng: -180 }), 'Approx. straight-line distance: 12,437 miles');

for (const [gig, performer] of [
  [{ lat: null, lng: 0 }, { lat: 0, lng: 0 }],
  [{ lat: 91, lng: 0 }, { lat: 0, lng: 0 }],
  [{ lat: 0, lng: -181 }, { lat: 0, lng: 0 }],
  [{ lat: 0, lng: 0 }, { lat: 0, lng: undefined }]
]) {
  assert.equal(approximateGigDistanceLabel(gig, performer), null);
}

const page = await readFile(new URL('../gig-radar.html', import.meta.url), 'utf8');
assert.match(page, /import \{ approximateGigDistanceLabel \} from "\.\/app\/gig-distance\.js"/);
assert.match(page, /const distanceLabel = approximateGigDistanceLabel\(gig, profile\)/);
assert.match(page, /if \(distanceLabel\) reasons\.push\(distanceLabel\)/);
assert.match(page, /detail = 'Perfect distance'/);
assert.doesNotMatch(page, /Perfect distance · ' \+ Math\.round\(dist\)/);
assert.doesNotMatch(page, /navigator\.geolocation/);

console.log('Gig Radar approximate distance smoke passed: valid stored coordinate pairs get an explicit straight-line estimate; missing or invalid coordinates are omitted.');
