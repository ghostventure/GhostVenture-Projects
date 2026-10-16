import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildOpenStreetMapEmbedUrl, isValidGigMapPoint } from '../app/gig-radar-map.js';

assert.equal(isValidGigMapPoint({ lat: 40.71, lng: -74.01 }), true);
assert.equal(isValidGigMapPoint({ lat: 91, lng: 0 }), false);
assert.equal(isValidGigMapPoint({ lat: 0, lng: Infinity }), false);
assert.equal(buildOpenStreetMapEmbedUrl({ lat: 91, lng: 0 }), null);
const mapUrl = new URL(buildOpenStreetMapEmbedUrl({ lat: 40.71, lng: -74.01 }));
assert.equal(mapUrl.origin, 'https://www.openstreetmap.org');
assert.equal(mapUrl.pathname, '/export/embed.html');
assert.equal(mapUrl.searchParams.get('marker'), '40.71,-74.01');
assert.equal(mapUrl.searchParams.get('layer'), 'mapnik');

const page = await readFile(new URL('../gig-radar.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../app/gig-radar-map.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const featureAudit = await readFile(new URL('../docs/FEATURE_AUDIT_200.md', import.meta.url), 'utf8');
assert.match(page, /id="gigListMode" aria-pressed="true"/);
assert.match(page, /id="gigMapMode" aria-pressed="false"/);
assert.match(page, /id="gigMapView"[^>]*hidden/);
assert.match(page, /sends the selected gig’s coordinates and your network address to OpenStreetMap/);
assert.match(page, /id="loadGigMap" disabled/);
assert.match(page, /© OpenStreetMap contributors/);
assert.match(page, /Tile use and privacy policy/);
assert.doesNotMatch(page, /<iframe[^>]+src=/i);
assert.match(page, /loadGigMap\.addEventListener\('click'/);
assert.match(page, /frame\.src = mapUrl/);
assert.match(page, /buildOpenStreetMapEmbedUrl\(selected\.g\)/);
assert.match(page, /document\.getElementById\('gigList'\)\.hidden = showingMap/);
assert.match(page, /if \(!showingMap && gigMapFrameHost\.childElementCount\)/);
assert.match(app, /return `https:\/\/www\.openstreetmap\.org\/export\/embed\.html\?/);
assert.equal(packageJson.scripts['smoke:gig-radar-map-list'], 'node scripts/smoke-gig-radar-map-list.mjs');
assert.match(featureAudit, /\[x\] 065\. Accessible map and list view/);

console.log('Gig Radar map/list smoke passed: list is the default, invalid points are omitted, OSM is explicit-consent only, and the original list remains available.');
