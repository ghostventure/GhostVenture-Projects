import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GIG_RADAR_PAY_FILTER_KEY,
  meetsMinimumGigPay,
  normalizeMinimumGigPay,
  readMinimumGigPay,
  saveMinimumGigPay,
} from '../app/gig-radar-filters.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const storage = new MemoryStorage();
assert.equal(normalizeMinimumGigPay('125.6'), 126);
assert.equal(normalizeMinimumGigPay('-10'), 0);
assert.equal(normalizeMinimumGigPay('not a number'), 0);
assert.equal(normalizeMinimumGigPay('999999'), 100000);
assert.equal(readMinimumGigPay(storage), 0);
assert.equal(saveMinimumGigPay(250, storage), 250);
assert.equal(storage.getItem(GIG_RADAR_PAY_FILTER_KEY), '250');
assert.equal(readMinimumGigPay(storage), 250);
assert.equal(readMinimumGigPay({ getItem() { throw new Error('blocked'); } }), 0);
assert.equal(saveMinimumGigPay(300, { setItem() { throw new Error('blocked'); } }), 300);
assert.equal(meetsMinimumGigPay({ payAmount: 250 }, 250), true);
assert.equal(meetsMinimumGigPay({ payAmount: 249 }, 250), false);
assert.equal(meetsMinimumGigPay({ payAmount: 0 }, 250), false);
assert.equal(meetsMinimumGigPay({ payAmount: 0 }, 0), true);

const page = await readFile(new URL('../gig-radar.html', import.meta.url), 'utf8');
assert.match(page, /id="gigMinimumPay" type="number"/);
assert.match(page, /id="resetGigFilters"/);
assert.match(page, /if \(!meetsMinimumGigPay\(item, minimumGigPay\)\) return false/);
assert.match(page, /newBadge\.textContent = '0 MATCH'/);

console.log('Gig Radar filter smoke passed: pay bounds, persistence fallback, hidden unknown pay, reset control, and accurate empty results.');
