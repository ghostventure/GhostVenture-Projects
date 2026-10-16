import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildHostAnalyticsCsv, downloadHostAnalyticsCsv, HOST_ANALYTICS_FEED_LIMIT } from '../app/host-analytics-export.js';

const hostId = 'host-uid-7';
const records = [
  { gigId: 'gig-1', g: { hostId, status: 'open', date: '2026-03-02', pay: '$100 USD', notes: 'private notes never exported' } },
  { gigId: 'gig-1', g: { hostId, status: 'accepted', date: '2026-03-02', pay: '$999' } },
  { gigId: 'gig-2', g: { hostId, status: 'accepted', date: '2026-03-25', pay: 'Pay TBD' } },
  { gigId: 'gig-3', g: { hostId, status: 'cancelled', date: 'yesterday', pay: '$50' } },
  { gigId: 'another-host', g: { hostId: 'other', status: 'accepted', date: '2026-03-10', pay: '$5000' } },
  { gigId: 'invalid-record', g: null }
];
const csv = buildHostAnalyticsCsv(records, hostId, '=bad,\"date\"');
assert.match(csv, /"'=bad,""date"""/i, 'CSV metadata must escape cell boundaries and spreadsheet formulas');
assert.match(csv, /"coverage","included_host_gigs","3","3","3"/);
assert.match(csv, /"status","open_gigs","1","1","3"/);
assert.match(csv, /"status","accepted_gigs","1","1","3"/);
assert.match(csv, /"status","cancelled_gigs","1","1","3"/);
assert.match(csv, /"event_month","2026-03","2","2","2"/);
assert.match(csv, /"pay","average_posted_performer_pay_usd","75","150\.00","2"/);
assert.match(csv, /"coverage","gigs_with_unavailable_event_date","1","1","3"/);
assert.match(csv, /"coverage","gigs_with_unavailable_pay","1","1","3"/);
assert.doesNotMatch(csv, /private notes never exported|other-host|5000|gig-1/);
assert.throws(() => buildHostAnalyticsCsv(records, ''), /signed-in host ID/);

const cappedRows = Array.from({ length: HOST_ANALYTICS_FEED_LIMIT + 5 }, (_, index) => ({
  gigId: `gig-${index}`,
  g: { hostId, status: 'open', date: '2026-04-01', pay: '$1' }
}));
const cappedCsv = buildHostAnalyticsCsv(cappedRows, hostId, '2026-10-16T00:00:00.000Z');
assert.match(cappedCsv, /"coverage","included_host_gigs","200","200","200"/);
assert.doesNotMatch(cappedCsv, /gig-204/);
assert.match(cappedCsv, /Older host gigs may be outside this loaded feed/);

let clicked = false;
let removed = false;
let revoked = false;
let downloadedBlob = null;
const fakeDocument = {
  body: { appendChild() {} },
  createElement() {
    return { click() { clicked = true; }, remove() { removed = true; } };
  }
};
class FakeBlob { constructor(parts, options) { this.parts = parts; this.options = options; downloadedBlob = this; } }
downloadHostAnalyticsCsv(csv, {
  documentRef: fakeDocument,
  BlobCtor: FakeBlob,
  urlApi: { createObjectURL: (blob) => { assert.equal(blob, downloadedBlob); return 'blob:analytics'; }, revokeObjectURL: (url) => { revoked = url === 'blob:analytics'; } }
});
assert.equal(downloadedBlob.options.type, 'text/csv;charset=utf-8');
assert.equal(clicked, true);
assert.equal(removed, true);
await new Promise((resolve) => setTimeout(resolve, 1100));
assert.equal(revoked, true);

const [host, queries, rules, checklist, packageJson] = await Promise.all([
  readFile(new URL('../host.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/gig-queries.js', import.meta.url), 'utf8'),
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  readFile(new URL('../docs/FEATURE_AUDIT_200.md', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8')
]);
assert.match(queries, /where\("hostId", "==", hostId\)/);
assert.match(queries, /HOST_GIG_QUERY_LIMIT = 200/);
assert.match(rules, /resource\.data\.hostId == request\.auth\.uid/);
assert.match(host, /buildHostAnalyticsCsv\(hostGigCache, HOST_ID\)/);
assert.match(host, /state === 'error'[\s\S]*?Analytics export is disabled until the feed reconnects/);
assert.match(host, /setHostAnalyticsFeedState\('ready'\)/);
assert.match(host, /setHostAnalyticsFeedState\('error'\)/);
assert.match(host, /up to the 200 newest gigs/);
assert.match(checklist, /\[x\] 037\.[\s\S]*200 newest host-owned feed records/);
assert.match(packageJson, /"smoke:host-analytics-export": "node scripts\/smoke-host-analytics-export\.mjs"/);
console.log('Host analytics export smoke passed: owner scope, 200-record bound, metric denominators, privacy, CSV safety, and download cleanup.');
