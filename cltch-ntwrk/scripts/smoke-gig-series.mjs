import assert from 'node:assert/strict';
import { generateGigDates } from '../app/gig-series.js';

assert.deepEqual(generateGigDates('2026-12-25', 1, 0), ['2026-12-25']);
assert.deepEqual(generateGigDates('2026-12-25', 3, 7), ['2026-12-25', '2027-01-01', '2027-01-08']);
assert.deepEqual(generateGigDates('2028-02-29', 2, 14), ['2028-02-29', '2028-03-14']);
for (const args of [['2026-02-30', 2, 7], ['2026-12-01', 13, 7], ['2026-12-01', 2, 0], ['2026-12-01', 2, 30]]) {
  assert.throws(() => generateGigDates(...args), RangeError);
}

console.log('Gig series smoke passed: weekly/biweekly date math, year/leap boundaries, and limits.');
