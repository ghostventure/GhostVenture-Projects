import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describeUpcomingSupply, summarizeUpcomingSupply } from '../app/marketplace-insights.js';

const listings = [
  ...['h-1', 'h-2', 'h-3', 'h-4', 'h-5'].map((hostId, index) => ({ hostId, date: `2026-10-${String(index + 1).padStart(2, '0')}`, venue: `Private venue ${index}` })),
  { hostId: 'h-1', date: '2026-11-15' },
  { hostId: 'h-6', date: '2027-01-05' },
  { hostId: 'h-6', date: '2027-02-05' },
  { hostId: 'h-7', date: '2027-03-05' },
  { hostId: '', date: '2026-11-16' },
  { hostId: 'h-bad', date: '2026-02-30' }
];
const summary = summarizeUpcomingSupply(listings);
assert.equal(summary.loadedListingCount, listings.length);
assert.equal(summary.datedListingCount, 9, 'invalid date and missing host records are excluded from the aggregate');
assert.deepEqual(summary.visibleQuarters, [{ key: '2026-Q4', label: 'Q4 2026', listingCount: 6 }], 'quarter is visible only with at least five distinct hosts');
assert.equal(summary.hasSuppressedQuarters, true, 'small host groups remain suppressed');
assert.equal(summary.feedLimitReached, false);
const serialized = JSON.stringify(summary);
for (const hostId of ['h-1', 'h-2', 'h-3', 'h-4', 'h-5', 'h-6', 'h-7']) assert.ok(!serialized.includes(hostId), 'host identifiers never leave the aggregation helper');
assert.ok(!serialized.includes('Private venue'), 'venue names never leave the aggregation helper');

const copy = describeUpcomingSupply(summary);
assert.match(copy.coverage, /9 of 11 loaded open listings/);
assert.match(copy.privacy, /fewer than 5 distinct hosts are hidden/);
assert.match(copy.limitations, /180-day/);
assert.match(copy.limitations, /120 listings/);
assert.match(copy.limitations, /not historical seasonality and is not a forecast/);
const suppressedCopy = describeUpcomingSupply(summarizeUpcomingSupply([{ hostId: 'only-host', date: '2026-10-12' }]));
assert.match(suppressedCopy.empty, /enough host diversity/);

const capped = summarizeUpcomingSupply(listings, { feedLimit: 5 });
assert.equal(capped.loadedListingCount, 5);
assert.equal(capped.feedLimitReached, true, 'reaching the source cap discloses possible truncation');
assert.match(describeUpcomingSupply(capped).limitations, /additional upcoming gigs may be omitted/);

const page = await readFile(new URL('../gig-radar.html', import.meta.url), 'utf8');
assert.match(page, /Upcoming supply snapshot/);
assert.match(page, /No host, performer, or venue details are shown/);
assert.match(page, /summarizeUpcomingSupply\(gigRecords\)/);
assert.match(page, /return \{ date: gig\.date, hostId: gig\.hostId \};/);
assert.match(page, /\$\{quarter\.label\}: \$\{quarter\.listingCount\} open listings/);
assert.match(page, /renderUpcomingSupplySnapshot\(docs\.map/);
assert.match(page, /renderUpcomingSupplySnapshot\(\[\], true\)/);
console.log('Marketplace insights smoke passed: current-feed coverage, calendar quarter math, five-distinct-host suppression, no identity output, and non-predictive disclosure.');
