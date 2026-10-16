import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatUsd } from '../app/usd-format.js';

const amount = 1234.5;
assert.equal(formatUsd(amount, 'en-US'), new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount));
assert.equal(formatUsd(amount, 'de-DE'), new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD' }).format(amount));
assert.notEqual(formatUsd(amount, 'de-DE'), formatUsd(amount, 'en-US'));
assert.equal(formatUsd(amount, 'invalid_locale'), new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount));
assert.equal(formatUsd(Number.NaN, 'en-US'), '');

const host = await readFile(new URL('../host.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../app/usd-format.js', import.meta.url), 'utf8');
assert.match(host, /import \{ formatUsd \} from "\.\/app\/usd-format\.js"/);
assert.match(host, /formatUsd\(baseAmount\)/);
assert.match(host, /formatUsd\(calc\.baseAmount\)/);
assert.doesNotMatch(host, /function formatUsd\(/);
assert.match(app, /currency: 'USD'/);
assert.match(host, /pay:\s*document\.getElementById\('pay'\)\.value\.trim\(\)/);
assert.match(host, /parseCurrencyAmount\(gig\.pay\)/);

console.log('Host USD locale smoke passed: structured numeric USD is locale-formatted, invalid locale falls back to en-US, and raw pay/storage parsing remains unchanged.');
