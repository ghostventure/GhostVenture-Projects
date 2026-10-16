import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MATCH_FEEDBACK_MAX_ITEMS,
  MATCH_FEEDBACK_REASONS,
  isValidMatchFeedbackGigId,
  readMatchFeedback,
  saveMatchFeedback,
  clearMatchFeedback,
  mountMatchFeedback
} from '../app/match-feedback.js';

class Element {
  children = [];
  listeners = {};
  attributes = {};
  value = '';
  append(...items) { this.children.push(...items); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  set textContent(value) { this.text = value; }
}
const documentRef = { createElement: () => new Element() };
class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

assert.equal(MATCH_FEEDBACK_REASONS.length, 6);
assert.equal(isValidMatchFeedbackGigId('gig-1'), true);
assert.equal(isValidMatchFeedbackGigId('gig/1'), false);
assert.equal(isValidMatchFeedbackGigId('gig\n1'), false);
assert.equal(isValidMatchFeedbackGigId('x'.repeat(129)), false);

const storage = new MemoryStorage();
assert.deepEqual(readMatchFeedback(storage, 'musician/one').entries, {});
assert.equal(saveMatchFeedback(storage, 'musician/one', 'gig-1', 'genre').persisted, true);
assert.equal(readMatchFeedback(storage, 'musician/one').entries['gig-1'], 'genre');
assert.equal(readMatchFeedback(storage, 'musician/two').entries['gig-1'], undefined);
assert.equal(saveMatchFeedback(storage, 'musician/one', 'gig/invalid', 'genre').saved, false);
assert.equal(saveMatchFeedback(storage, 'musician/one', 'gig-1', 'free-text').saved, false);
assert.equal(clearMatchFeedback(storage, 'musician/one', 'gig-1').persisted, true);
assert.equal(readMatchFeedback(storage, 'musician/one').entries['gig-1'], undefined);

for (let index = 0; index < MATCH_FEEDBACK_MAX_ITEMS + 8; index += 1) {
  saveMatchFeedback(storage, 'musician/bounded', `gig-${index}`, 'other');
}
const bounded = readMatchFeedback(storage, 'musician/bounded').entries;
assert.equal(Object.keys(bounded).length, MATCH_FEEDBACK_MAX_ITEMS);
assert.equal(Object.hasOwn(bounded, 'gig-0'), false);
assert.equal(Object.hasOwn(bounded, 'gig-127'), true);

const container = new Element();
const mounted = mountMatchFeedback(container, { storage, userId: 'musician/ui', gigId: 'gig-ui', documentRef });
assert.equal(container.children.length, 1);
assert.match(mounted.select.attributes['aria-label'], /Saved only in this browser/);
assert.equal(mounted.select.children.length, MATCH_FEEDBACK_REASONS.length + 2);
assert.match(mounted.status.text, /stored only in this browser/);
mounted.select.value = 'skills';
mounted.select.listeners.change();
assert.match(mounted.status.text, /stored only in this browser/);
assert.equal(readMatchFeedback(storage, 'musician/ui').entries['gig-ui'], 'skills');
mounted.select.value = '__clear__';
mounted.select.listeners.change();
assert.equal(mounted.select.value, '');
assert.match(mounted.status.text, /cleared/);

const blockedStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
const blocked = mountMatchFeedback(new Element(), { storage: blockedStorage, userId: 'musician/blocked', gigId: 'gig-blocked', documentRef });
assert.match(blocked.status.text, /page session/);
blocked.select.value = 'distance';
blocked.select.listeners.change();
assert.match(blocked.status.text, /kept only for this page session/);
assert.equal(readMatchFeedback(blockedStorage, 'musician/blocked').entries['gig-blocked'], 'distance');

const page = await readFile(new URL('../gig-radar.html', import.meta.url), 'utf8');
assert.match(page, /import \{ mountMatchFeedback \} from "\.\/app\/match-feedback\.js"/);
assert.match(page, /mountMatchFeedback\(feedbackContainer, \{ userId: MUSICIAN_ID, gigId, documentRef: document \}\)/);
assert.match(page, /respond\('\$\{gigId\}','pass'\)/);
assert.match(page, /respond\('\$\{gigId\}','accept'\)/);
assert.doesNotMatch(page, /match-feedback[\s\S]{0,250}(?:updateDoc|runTransaction|collection\(db)/);

console.log('Match feedback smoke passed (reason codes, UID isolation, bounds, session fallback, existing action semantics).');
