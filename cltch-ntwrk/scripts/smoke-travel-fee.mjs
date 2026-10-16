import assert from 'node:assert/strict';
import { estimateTravelFee } from '../app/travel-fee.js';

assert.equal(estimateTravelFee(10, 0.5), 10);
assert.equal(estimateTravelFee(12.3, 0.75), 18.45);
assert.equal(estimateTravelFee(0, 10), 0);
for (const [miles, rate] of [['', 5], [10, ''], [-1, 5], [5001, 5], [10, -1], [10, 1001], ['NaN', 5]]) {
  assert.throws(() => estimateTravelFee(miles, rate), RangeError);
}

console.log('Travel fee smoke passed: round-trip math, cents rounding, and input bounds.');
