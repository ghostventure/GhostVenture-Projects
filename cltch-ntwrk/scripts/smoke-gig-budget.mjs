import assert from 'node:assert/strict';
import { calculateGigSeriesBudget } from '../app/gig-budget.js';
import { readFile } from 'node:fs/promises';

assert.deepEqual(calculateGigSeriesBudget(250.25, 3, 0.02), {
  count: 3,
  perEventPay: 250.25,
  perEventFee: 5.01,
  perEventTotal: 255.26,
  totalPay: 750.75,
  totalFees: 15.03,
  totalHostCost: 765.78
});
assert.deepEqual(calculateGigSeriesBudget(100, 1), {
  count: 1,
  perEventPay: 100,
  perEventFee: 2,
  perEventTotal: 102,
  totalPay: 100,
  totalFees: 2,
  totalHostCost: 102
});
for (const args of [[0, 1], [-1, 1], [100, 0], [100, 13], [100, 2, -0.1], [100, 2, 0.3]]) {
  assert.throws(() => calculateGigSeriesBudget(...args), RangeError);
}
const hostPage = await readFile(new URL('../host.html', import.meta.url), 'utf8');
assert.match(hostPage, /calculateGigSeriesBudget\(parsed, dates, PROCESSING_FEE_RATE\)/);
assert.match(hostPage, /-event estimate/);

console.log('Gig budget smoke passed: per-event rounding, multi-date totals, bounds, and host preview wiring.');
