import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf8'));
const firebaseRc = JSON.parse(await readFile(new URL('../.firebaserc', import.meta.url), 'utf8'));
assert.equal(config.hosting.site, 'cltch-ntwrk-social', 'Hosting must target the existing CLTCH site');
assert.equal(firebaseRc.projects.default, 'cltch-ntwrk-social', 'default Firebase project must remain CLTCH');

const headers = config.hosting.headers;
const assetIndex = headers.findIndex((entry) => entry.source === '**/*.@(js|css|svg|webmanifest)');
assert.ok(assetIndex >= 0, 'unversioned web assets need an explicit cache policy');
const cache = headers[assetIndex].headers.find((entry) => entry.key.toLowerCase() === 'cache-control')?.value || '';
assert.match(cache, /max-age=300(?:,|$)/, 'unversioned assets should have a short bounded cache lifetime');
assert.doesNotMatch(cache, /immutable/i, 'unhashed asset URLs must not be marked immutable');

for (const source of ['**/*.html', '/site-init.js', '/cltch-boilerplate.css', '/sw.js', '/app/**']) {
  const index = headers.findIndex((entry) => entry.source === source);
  assert.ok(index > assetIndex, `${source} no-store override must follow the broad asset rule`);
  const value = headers[index].headers.find((entry) => entry.key.toLowerCase() === 'cache-control')?.value || '';
  assert.match(value, /no-store/i, `${source} must not be cached`);
}

console.log('Hosting policy smoke passed: correct project and cache rule precedence for mutable assets.');
