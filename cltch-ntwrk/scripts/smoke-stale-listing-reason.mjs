import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../gig-radar.html', import.meta.url), 'utf8');
const packageText = await readFile(new URL('../package.json', import.meta.url), 'utf8');
const packageJson = JSON.parse(packageText);
const indexes = JSON.parse(await readFile(new URL('../firestore.indexes.json', import.meta.url), 'utf8'));

assert.match(page, /const STALE_LISTING_LOOKBACK_DAYS = 30;/);
assert.match(page, /const STALE_LISTING_QUERY_LIMIT = 120;/);
const staleQuery = page.match(/const staleQuery = query\([\s\S]*?\n      \);/)?.[0];
assert.ok(staleQuery, 'recent stale listing query should be present');
assert.match(staleQuery, /where\('status', '==', 'open'\)/);
assert.match(staleQuery, /where\('date', '>=', staleFrom\)/);
assert.match(staleQuery, /where\('date', '<', today\)/);
assert.match(staleQuery, /orderBy\('date', 'asc'\)/);
assert.match(staleQuery, /limit\(STALE_LISTING_QUERY_LIMIT\)/);

const statusDateIndex = indexes.indexes.some((index) => index.collectionGroup === 'gigs'
  && index.fields.some((field) => field.fieldPath === 'status' && field.order === 'ASCENDING')
  && index.fields.some((field) => field.fieldPath === 'date' && field.order === 'ASCENDING'));
assert.equal(statusDateIndex, true, 'the bounded status/date query must use an existing composite index');

const relevance = page.match(/function countStaleRelevantListings\(\) \{[\s\S]*?\n    \}/)?.[0];
assert.ok(relevance, 'stale relevance filter should be isolated');
assert.match(relevance, /gig\.hostId === MUSICIAN_ID/);
assert.match(relevance, /gig\.passedBy \|\| \[\]/);
assert.match(relevance, /isGigActionable\([\s\S]*?blackouts, bookedGigIds, bookedDatesSet\)/);
assert.match(relevance, /matchScore\(gig, musicianProfile, false\)[\s\S]*?matchScore\(gig, musicianProfile, true\)/);

const notice = page.match(/<div id="staleListingNotice"[\s\S]*?<\/div>\s*<\/div>/)?.[0];
assert.ok(notice, 'stale notice should be reachable in the Gig Radar section');
assert.match(notice, /role="status" aria-live="polite"/);
assert.match(notice, /id="resetStaleLiveFilters"/);
assert.match(page, /Expired listings cannot be accepted/);
assert.match(page, /Reset live-gig filters to find current opportunities; expired listings stay hidden/);
assert.match(page, /resetStaleLiveFilters\?\.addEventListener\('click', \(\) => resetGigFilters\?\.click\(\)\)/);
assert.match(page, /staleListingState = 'error'/);
assert.match(page, /Recent expired listings could not be checked/);
assert.match(page, /staleListingLimitReached = snapshot\.size >= STALE_LISTING_QUERY_LIMIT/);
assert.match(page, /check reached its \$\{STALE_LISTING_QUERY_LIMIT\}-item cap/);
assert.doesNotMatch(notice, /accept|approve|href=/i, 'stale notice must not offer acceptance actions or stale listing links');
assert.equal(packageJson.scripts['smoke:stale-listing-reason'], 'node scripts/smoke-stale-listing-reason.mjs');
const scriptEntries = packageText.match(/"scripts"\s*:\s*\{([\s\S]*?)\n  \}/)?.[1] || '';
const scriptKeys = [...scriptEntries.matchAll(/^\s*"([^"]+)"\s*:/gm)].map((match) => match[1]);
assert.equal(new Set(scriptKeys).size, scriptKeys.length, 'package smoke-script names must be unique');

console.log('Stale listing reason smoke passed (bounded query, relevance guards, accessible explanation, reset path).');
