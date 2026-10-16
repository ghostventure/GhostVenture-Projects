import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../app/gig-discovery.js', import.meta.url), 'utf8');
const page = await readFile(new URL('../gig-discovery.html', import.meta.url), 'utf8');
const indexConfig = JSON.parse(await readFile(new URL('../firestore.indexes.json', import.meta.url), 'utf8'));

assert.match(app, /getDocs, query, where, orderBy, startAfter, limit/);
assert.doesNotMatch(app, /onSnapshot/);
assert.match(app, /orderBy\("date", "asc"\)[\s\S]*orderBy\("createdAt", "desc"\)/);
assert.match(app, /if \(pageCursor\) constraints\.push\(startAfter\(pageCursor\)\)/);
assert.match(app, /constraints\.push\(limit\(PAGE_SIZE\)\)/);
assert.match(app, /lastDoc = snapshot\.docs\.at\(-1\) \|\| pageCursor/);
assert.match(app, /hasMore = snapshot\.docs\.length === PAGE_SIZE/);
assert.match(app, /if \(reset\) gigs = page/);
assert.match(app, /gigs\.push\(\.\.\.page\.filter\(\(item\) => !knownIds\.has\(item\.id\)\)\)/);
assert.match(app, /matchesGigSearch\(item\.data, readForm\(\)\)/);
assert.match(app, /feedErrorMode = reset \? "refresh" : "more"/);
assert.match(app, /Retry loading more gigs/);
assert.match(app, /Retry loading gigs/);
assert.match(app, /Refresh gigs/);
assert.match(app, /paginationStatus\.dataset\.state = feedErrorMode \? "error" : feedLoading \? "loading"/);
const pagingFlow = app.slice(app.indexOf('async function loadGigPage'), app.indexOf('\nonAuthStateChanged'));
assert.ok(pagingFlow.length > 0);
assert.doesNotMatch(pagingFlow, /writeForm\(/, 'paging and refresh do not overwrite current filter values');

assert.match(page, /id="refreshGigs"/);
assert.match(page, /id="loadMoreGigs"[^>]*hidden/);
assert.match(page, /id="paginationStatus" role="status" aria-live="polite"/);
assert.match(page, /id="feedStatus" role="status" aria-live="polite"/);

const openGigIndex = indexConfig.indexes.find((index) => index.collectionGroup === 'gigs'
  && index.fields.map(({ fieldPath }) => fieldPath).join(',') === 'status,date,createdAt');
assert.ok(openGigIndex, 'existing composite index supports the paginated feed query');
assert.deepEqual(openGigIndex.fields.map(({ fieldPath, order }) => [fieldPath, order]), [
  ['status', 'ASCENDING'],
  ['date', 'ASCENDING'],
  ['createdAt', 'DESCENDING']
]);

console.log('Gig Discovery pagination smoke passed: stable snapshot cursor, supported composite index, preserved client filters, and explicit retry/refresh/loading states.');
