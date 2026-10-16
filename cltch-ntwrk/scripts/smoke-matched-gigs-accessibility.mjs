import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../musician-matched-gigs.html', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../app/matched-gigs-accessibility.js', import.meta.url), 'utf8');

assert.match(page, /app\/matched-gigs-accessibility\.js/);
assert.match(page, /min-height:\s*44px/);
assert.match(page, /:focus-visible/);
assert.match(moduleSource, /aria-label', 'Search gigs by venue, location, genre, or pay'/);
assert.match(moduleSource, /aria-live', 'polite'/);
assert.match(moduleSource, /aria-pressed/);
assert.match(moduleSource, /Clear gig search/);
assert.match(moduleSource, /event\.key === '\/'/);
assert.match(moduleSource, /event\.key === 'Escape'/);
assert.match(moduleSource, /new MutationObserver/);
assert.match(moduleSource, /search\.focus\(\)/);

console.log('Matched gigs accessibility smoke passed: labels, live results, filter state, clear/search shortcuts, focus, and mobile target size.');
