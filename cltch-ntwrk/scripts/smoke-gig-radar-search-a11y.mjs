import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../gig-radar.html', import.meta.url), 'utf8');
assert.match(page, /id="gigSearchResultsStatus" role="status" aria-live="polite" aria-atomic="true"/);
assert.match(page, /function announceVisibleGigResults\(count\)/);
assert.match(page, /announceVisibleGigResults\(visibleMatches\.length\)/);
assert.match(page, /const visibleMatches = getVisibleMatches\(\);\s*announceVisibleGigResults\(visibleMatches\.length\);/);
assert.match(page, /if \(status\.textContent !== message\) status\.textContent = message;/);
assert.match(page, /role="group" aria-label="Filter gigs"/);
assert.match(page, /data-filter="all" aria-pressed="true"/);
assert.match(page, /data-filter="urgent" aria-pressed="false"/);
assert.match(page, /chip\.setAttribute\('aria-pressed', String\(selected\)\)/);
assert.match(page, /syncGigFilterButtons\(\);\s*renderQueues\(\);/);
assert.match(page, /newBadge" aria-live="off"/);
assert.match(page, /criteria\.push\(`search “\$\{searchText\}”`\)/);
assert.match(page, /criteria\.push\(`minimum pay \$\$\{minimumGigPay\}`\)/);

console.log('Gig Radar search accessibility smoke passed: dynamic visible-result count and current criteria are announced without redundant snapshot updates, and filter buttons expose synchronized pressed state.');
