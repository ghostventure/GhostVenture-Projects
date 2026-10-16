import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPerformerComparison, PERFORMER_COMPARISON_FEED_LIMIT, PERFORMER_COMPARISON_ROW_LIMIT } from '../app/performer-comparison.js';

const candidates = Array.from({ length: 7 }, (_, index) => ({
  id: `profile-${index + 1}`,
  profile: {
    available: true,
    stageName: index === 6 ? '<script>alert(1)</script>' : `Artist ${index + 1}`,
    performerType: index === 6 ? 'dj' : 'musician',
    genres: ['Jazz', 'Rock', '<img src=x>'],
    instruments: 'Guitar\n keys',
    experience: index === 2 ? '7' : 4,
    bio: 'PRIVATE BIO',
    firstName: 'PRIVATE FIRST',
    lastName: 'PRIVATE LAST',
    email: 'private@example.invalid',
    zipCode: '99999',
    rate: '$900',
    payoutHandle: 'private-payout',
    lat: 44,
    lng: -72
  },
  distanceMiles: 12 - index
}));
candidates.push({ id: 'unavailable', profile: { available: false, stageName: 'Hidden' }, distanceMiles: 1 });
candidates.push({ id: 'too-far', profile: { available: true, stageName: 'Far' }, distanceMiles: 90 });
candidates.push({ id: 'invalid-distance', profile: { available: true, stageName: 'Invalid' }, distanceMiles: Infinity });
candidates.push({ ...candidates[0], distanceMiles: 1 });

const model = buildPerformerComparison(candidates, { loadedCount: 250, feedLimit: 250, radius: 40 });
assert.equal(PERFORMER_COMPARISON_FEED_LIMIT, 250);
assert.equal(PERFORMER_COMPARISON_ROW_LIMIT, 5);
assert.equal(model.loadedCount, 250);
assert.equal(model.feedLimitReached, true);
assert.equal(model.matchedCount, 7, 'only unique available records inside the established radius are compared');
assert.equal(model.rows.length, 5);
assert.equal(model.omittedMatchCount, 2);
assert.deepEqual(model.rows.map((row) => row.distanceMiles), [6, 7, 8, 9, 10], 'rows sort by approximate distance only');
assert.equal(model.rows[0].name, '<script>alert(1)</script>', 'strings remain data for textContent rendering, never HTML');
assert.equal(model.rows[0].type, 'DJ');
assert.equal(model.rows[1].type, 'Musician / band');
assert.equal(model.rows[4].type, 'Musician / band');
assert.equal(model.rows[4].experience, '7 years (self-reported)');

const serialized = JSON.stringify(model);
for (const privateValue of ['PRIVATE BIO', 'PRIVATE FIRST', 'PRIVATE LAST', 'private@example.invalid', '99999', '$900', 'private-payout', '44', '-72', 'profile-1']) {
  assert.ok(!serialized.includes(privateValue), `private/unneeded value ${privateValue} is excluded`);
}

const source = await readFile(new URL('../host.html', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../app/performer-comparison.js', import.meta.url), 'utf8');
assert.match(source, /buildAvailableMusiciansQuery\(db, performerType\)/);
assert.match(source, /renderPerformerComparison\(performerComparisonEl, match\.comparison\)/);
assert.match(source, /if \(dist <= 40\) count40\+\+;/);
assert.match(source, /else if \(dist <= 65\) count65\+\+;/);
assert.match(source, /return \{\s*count,\s*radius,\s*comparison: buildPerformerComparison/);
assert.match(source, /aria-labelledby="performerComparisonTitle"/);
assert.match(source, /Available profile matches/);
assert.match(moduleSource, /not applications/);
assert.match(moduleSource, /not date-specific confirmation/);
assert.match(moduleSource, /query reached its \$\{model\.feedLimit\}-profile limit/);
assert.match(moduleSource, /at most \$\{model\.displayLimit\}/);
assert.match(moduleSource, /scroll\.tabIndex = 0/);
assert.match(moduleSource, /scope = 'col'/);
assert.match(moduleSource, /cell\.scope = 'row'/);
assert.match(moduleSource, /cell\.textContent = value/);
for (const privateField of ['profile.email', 'profile.firstName', 'profile.lastName', 'profile.zipCode', 'profile.rate', 'profile.payoutHandle', 'profile.bio', 'profile.lat', 'profile.lng']) {
  assert.ok(!moduleSource.includes(privateField), `renderer never reads ${privateField}`);
}
console.log('Performer comparison smoke passed: same query/radius, available-only allowlist, 250/5-row sample disclosure, and keyboard-scrollable semantic table.');
