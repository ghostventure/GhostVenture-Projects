import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatListedPay } from '../app/gig-discovery-pay.js';

assert.deepEqual(formatListedPay('$500', 'en-US'), {
  text: '500 US dollars', formatted: true, locale: 'en-US'
});
assert.deepEqual(formatListedPay('$1,250.50 flat', 'en-US'), {
  text: '1,250.50 US dollars flat', formatted: true, locale: 'en-US'
});
assert.deepEqual(formatListedPay('$1,250.50 flat', 'de-DE'), {
  text: '1.250,50 US-Dollar flat', formatted: true, locale: 'de-DE'
});
assert.equal(formatListedPay('$150/hour', 'en-US').text, '150 US dollars/hour');
for (const raw of ['Negotiable', 'Pay TBD', '150 flat', '$1,23 flat', '$150.123 flat', '  negotiable  ']) {
  assert.equal(formatListedPay(raw, 'en-US').text, raw, `ambiguous or unstructured pay remains unchanged: ${raw}`);
  assert.equal(formatListedPay(raw, 'en-US').formatted, false);
}
assert.equal(formatListedPay('$500', 'invalid_locale').text, '$500');

const app = await readFile(new URL('../app/gig-discovery.js', import.meta.url), 'utf8');
const page = await readFile(new URL('../gig-discovery.html', import.meta.url), 'utf8');
assert.match(app, /import \{ formatListedPay \} from "\.\/gig-discovery-pay\.js"/);
assert.match(app, /payText\.textContent = pay\.text/);
assert.match(app, /if \(pay\.locale\) payText\.lang = pay\.locale/);
assert.doesNotMatch(app, /payText\.innerHTML|aria-label=.*US dollars/);
assert.match(page, /\.pay-amount \{[^}]*font-weight:750/);

console.log('Gig Discovery currency smoke passed: locale-formatted USD, spoken currency name in visible text, preserved descriptors, and unchanged ambiguous pay.');
