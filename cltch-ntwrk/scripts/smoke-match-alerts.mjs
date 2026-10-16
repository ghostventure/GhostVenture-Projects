import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MATCH_ALERT_MAX_ITEMS,
  addNewMatchAlerts,
  clearMatchAlerts,
  isValidMatchAlertGigId,
  readMatchAlerts,
  renderMatchAlertPanel,
  setMatchAlertsEnabled
} from '../app/match-alerts.js';

class Element {
  children = [];
  listeners = {};
  attributes = {};
  checked = false;
  append(...items) { this.children.push(...items); }
  replaceChildren() { this.children = []; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  setAttribute(name, value) { this.attributes[name] = value; }
  set textContent(value) { this.text = value; }
}
const documentRef = { createElement: () => new Element() };
class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

assert.equal(isValidMatchAlertGigId('gig-1'), true);
assert.equal(isValidMatchAlertGigId('gig/1'), false);
assert.equal(isValidMatchAlertGigId('gig\n1'), false);
assert.equal(isValidMatchAlertGigId('x'.repeat(129)), false);

const storage = new MemoryStorage();
let loaded = readMatchAlerts(storage, 'performer/one');
assert.equal(loaded.state.enabled, false);
assert.equal(loaded.state.alerts.length, 0);
let state = setMatchAlertsEnabled(storage, 'performer/one', loaded.state, true);
assert.equal(state.enabled, true);
assert.equal(state.persisted, true);
state = addNewMatchAlerts(storage, 'performer/one', state, ['gig-1', 'gig-2'], 1000);
assert.deepEqual(state.alerts, [{ gigId: 'gig-1', at: 1000 }, { gigId: 'gig-2', at: 1000 }]);
assert.deepEqual(readMatchAlerts(storage, 'performer/two').state.alerts, []);
assert.equal(addNewMatchAlerts(storage, 'performer/one', { ...state, enabled: false }, ['gig-3'], 2000).alerts.length, 2);
state = addNewMatchAlerts(storage, 'performer/one', state, ['gig-2', 'bad/id'], 3000);
assert.deepEqual(state.alerts, [{ gigId: 'gig-1', at: 1000 }, { gigId: 'gig-2', at: 3000 }]);

for (let index = 0; index < MATCH_ALERT_MAX_ITEMS + 9; index += 1) {
  state = addNewMatchAlerts(storage, 'performer/bounded', { userId: 'performer/bounded', enabled: true, alerts: state.alerts }, [`gig-${index}`], index + 100);
}
assert.equal(state.alerts.length, MATCH_ALERT_MAX_ITEMS);
assert.equal(state.alerts[0].gigId, 'gig-9');
assert.equal(state.alerts.at(-1).gigId, 'gig-38');
state = clearMatchAlerts(storage, 'performer/one', state);
// Clear always respects the requested account; a mismatched state cannot leak its inbox.
assert.equal(readMatchAlerts(storage, 'performer/one').state.alerts.length, 0);

const renderState = addNewMatchAlerts(storage, 'performer/render', { userId: 'performer/render', enabled: true, alerts: [] }, ['gig with space'], 1700000000000);
const root = new Element();
let toggled;
let cleared = false;
renderMatchAlertPanel(root, renderState, {
  documentRef,
  onEnabledChange(value) { toggled = value; },
  onClear() { cleared = true; }
});
assert.equal(root.children[0].text, 'New match alerts');
assert.match(root.children[1].text, /no browser notification permission is requested/i);
const checkbox = root.children[2].children[0];
assert.equal(checkbox.type, 'checkbox');
checkbox.checked = false;
checkbox.listeners.change();
assert.equal(toggled, false);
assert.deepEqual(root.children[3].attributes, { role: 'status', 'aria-live': 'polite' });
const list = root.children[4];
const detailsLink = list.children[0].children[0];
assert.equal(detailsLink.href, 'booking.html?id=gig%20with%20space');
assert.equal(detailsLink.text, 'View new matching gig details');
root.children[5].listeners.click();
assert.equal(cleared, true);

const blockedStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
loaded = readMatchAlerts(blockedStorage, 'performer/blocked');
state = setMatchAlertsEnabled(blockedStorage, 'performer/blocked', loaded.state, true);
assert.equal(state.persisted, false);
assert.match(state.message, /page session/);
state = addNewMatchAlerts(blockedStorage, 'performer/blocked', state, ['gig-blocked'], 4000);
assert.equal(state.alerts.length, 1);
assert.equal(readMatchAlerts(blockedStorage, 'performer/blocked').state.alerts[0].gigId, 'gig-blocked');

const moduleSource = await readFile(new URL('../app/match-alerts.js', import.meta.url), 'utf8');
assert.doesNotMatch(moduleSource, /Notification\.requestPermission|new Notification|pushManager|firebase-firestore|updateDoc|setDoc/);
const page = await readFile(new URL('../gig-radar.html', import.meta.url), 'utf8');
assert.match(page, /id="matchAlertPanel"[^>]*aria-label="New match alerts"/);
assert.match(page, /previousMatchedIds !== null && matchAlertState\?\.enabled/);
assert.match(page, /newIds = \[\.\.\.currentMatchedIds\]\.filter\(\(gigId\) => !previousMatchedIds\.has\(gigId\)\)/);
assert.match(page, /matchAlertState = readMatchAlerts\(safeLocalStorage\(\), MUSICIAN_ID\)/);
assert.doesNotMatch(page, /match-alerts\.js[\s\S]{0,250}(?:Notification\.requestPermission|new Notification)/);

console.log('Match alerts smoke passed (explicit opt-in, snapshot baseline, bounded UID-local inbox, storage fallback, no notification permission).');
