import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../musician-matched-gigs.html', import.meta.url), 'utf8');
const profile = await readFile(new URL('../musician-profile.html', import.meta.url), 'utf8');
const radar = await readFile(new URL('../gig-radar.html', import.meta.url), 'utf8');

const matchStart = page.indexOf('function matchScore(gig, profile, useFallback) {');
assert.notEqual(matchStart, -1, 'matched gigs must keep the expected match scorer');
const matchBody = page.slice(matchStart, page.indexOf('\n    }', matchStart));
assert.match(matchBody, /^function matchScore\(gig, profile, useFallback\) \{\s*if \(!profile \|\| profile\.available === false\) return null;/,
  'paused or missing profiles must be rejected before match scoring');
assert.match(matchBody, /if \(!performerTypeMatch\(gig, profile\)\) return null;/,
  'available profiles must continue through normal match scoring');

assert.match(profile, /available\s*,\s*performerType/,
  'the existing profile save must continue to persist the owner availability control');
assert.match(radar, /if \(!profile \|\| profile\.available === false\) return false;/,
  'Gig Radar must retain its existing unavailable-profile gate');
console.log('Matched Gigs availability smoke passed: owner pause state is persisted and both gig queues honor it.');
