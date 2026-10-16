import assert from 'node:assert/strict';
import { getMissingProfileRecommendations, renderProfileRecommendations } from '../app/profile-recommendations.js';
import { readFile } from 'node:fs/promises';

const missing = getMissingProfileRecommendations();
assert.deepEqual(missing.map(({ key }) => key), [
  'firstName', 'lastName', 'zipCode', 'genres', 'rate', 'bio', 'payoutMethod'
]);

const complete = {
  firstName: 'Ada', lastName: 'Lovelace', zipCode: '10001', genres: ['Jazz'],
  rate: '$100/hr', bio: 'Performer', payoutMethod: 'check', payoutHandle: ''
};
assert.deepEqual(getMissingProfileRecommendations(complete), []);
assert.deepEqual(getMissingProfileRecommendations({ ...complete, payoutMethod: 'cashapp', payoutHandle: '' }).map(({ key }) => key), ['payoutHandle']);
assert.deepEqual(getMissingProfileRecommendations({ ...complete, payoutMethod: 'plaid', payoutHandle: '' }), []);
assert.deepEqual(getMissingProfileRecommendations({ ...complete, payoutMethod: '', payoutHandle: '' }).map(({ key }) => key), ['payoutMethod']);

class Element {
  children = [];
  set textContent(value) { this.text = value; }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
}
globalThis.document = { createElement: () => new Element() };
const container = new Element();
const unsafe = { ...complete, firstName: '<img src=x>', lastName: '', payoutMethod: 'cashapp', payoutHandle: '' };
const rendered = renderProfileRecommendations(container, unsafe);
assert.deepEqual(rendered.map(({ key }) => key), ['lastName', 'payoutHandle']);
assert.equal(container.children[0].text, 'Profile recommendations');
assert.equal(container.children[1].text, '2 profile items still count toward profile completion.');
const links = container.children[2].children.map((item) => item.children[0]);
assert.deepEqual(links.map(({ href }) => href), ['#lastName', '#payoutHandle']);
assert.deepEqual(links.map(({ text }) => text), ['Add your last name', 'Add the details for your selected payout method']);
assert.equal(links.some(({ text }) => String(text).includes('<img')), false);

const page = await readFile(new URL('../musician-profile.html', import.meta.url), 'utf8');
assert.match(page, /id="profileRecommendations"[^>]*aria-live="polite"/);
assert.match(page, /renderProfileRecommendations\(document\.getElementById\('profileRecommendations'\)/);
assert.match(page, /function updateProfileCompletion\(\)[\s\S]*?renderProfileRecommendations/);
assert.match(page, /import \{ renderProfileRecommendations \} from "\.\/app\/profile-recommendations\.js"/);
assert.doesNotMatch(page, /profile-recommendations[\s\S]{0,200}(?:localStorage|setDoc|updateDoc)/);

console.log('Profile recommendations smoke passed (missing fields, payout conditions, bounded safe links, accessible updates).');
