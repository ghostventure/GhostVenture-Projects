import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createHostMuteButton,
  createHostMuteController,
  filterMutedHostMatches,
  MAX_HOST_MUTES,
  mountHostMutePanel,
  readHostMutes
} from '../app/host-mutes.js';

class Element {
  children = [];
  listeners = {};
  attributes = {};
  style = {};
  checked = false;
  disabled = false;
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  setAttribute(name, value) { this.attributes[name] = value; }
  set textContent(value) { this.text = String(value); }
  get textContent() { return this.text || ''; }
}
class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}
const documentRef = { createElement: (tagName) => { const element = new Element(); element.tagName = tagName; return element; } };
const storage = new MemoryStorage();
const performerA = createHostMuteController({ storage, userId: 'performer-A' });
assert.equal(performerA.getStatus().count, 0);
assert.equal(performerA.getStatus().persistent, true);
const hostUid = 'private-host-uid-123';
assert.equal(performerA.mute(hostUid).ok, true);
assert.equal(performerA.isMuted(hostUid), true);
assert.equal(performerA.getStatus().count, 1);
const scopedKey = [...storage.values.keys()][0];
assert.match(scopedKey, /performer-A$/);
assert.equal(JSON.parse(storage.values.get(scopedKey)).hostIds[0], hostUid);
assert.equal(createHostMuteController({ storage, userId: 'performer-B' }).isMuted(hostUid), false, 'mute state is isolated by signed-in UID');
assert.deepEqual(filterMutedHostMatches([
  { gigId: 'a', g: { hostId: hostUid } },
  { gigId: 'b', g: { hostId: 'other-host' } },
  { gigId: 'c', hostId: 'other-host' }
], performerA.getMutedHostIds()).map((item) => item.gigId), ['b', 'c']);

const panel = new Element();
mountHostMutePanel(panel, performerA, documentRef);
const visibleText = (node) => [node.textContent, ...node.children.map(visibleText)].join(' ');
assert.match(visibleText(panel), /Mute hosts from matching/);
assert.match(visibleText(panel), /only in this browser and on this device/);
assert.match(visibleText(panel), /Booking access is unchanged/);
assert.match(visibleText(panel), /not a safety block/);
assert.doesNotMatch(visibleText(panel), new RegExp(hostUid));
const muteButton = createHostMuteButton('second-host-secret', performerA, documentRef);
assert.equal(muteButton.textContent, 'Mute host');
assert.equal(muteButton.attributes['aria-label'], 'Mute this host from matching in this browser and device');
assert.doesNotMatch(visibleText(muteButton), /second-host-secret/);
muteButton.listeners.click();
assert.equal(performerA.isMuted('second-host-secret'), true);
assert.equal(visibleText(panel).includes('Muted host 2'), true);
assert.doesNotMatch(visibleText(panel), /second-host-secret/);
const list = panel.children.find((node) => node.tagName === 'ul');
assert.equal(list.children.length, 2);
const unmuteButton = list.children[0].children.find((node) => node.tagName === 'button');
assert.equal(unmuteButton.textContent, 'Unmute host 1');
unmuteButton.listeners.click();
assert.equal(performerA.isMuted(hostUid), false);
assert.equal(performerA.getStatus().count, 1);
const findText = (node, text) => node.textContent === text ? node : node.children.map((child) => findText(child, text)).find(Boolean);
findText(panel, 'Reset host mutes').listeners.click();
assert.equal(performerA.getStatus().count, 0);

const maxed = createHostMuteController({ storage: new MemoryStorage(), userId: 'large-list' });
for (let index = 0; index < MAX_HOST_MUTES; index += 1) assert.equal(maxed.mute(`host-${index}`).ok, true);
assert.equal(maxed.mute('host-over-limit').ok, false);
assert.equal(maxed.getStatus().count, MAX_HOST_MUTES);
assert.match(maxed.getStatus().message, /list is full/);

const blockedStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
const blockedState = readHostMutes(blockedStorage, 'performer-blocked');
assert.equal(blockedState.persistent, false);
assert.match(blockedState.message, /page session/);
const blocked = createHostMuteController({ storage: blockedStorage, userId: 'performer-blocked' });
assert.equal(blocked.mute('host-volatile').persistent, false);
assert.equal(blocked.isMuted('host-volatile'), true, 'storage failure keeps a session-only mute');
assert.match(blocked.getStatus().message, /only while this page is open/);

const [radarPage, matchedPage, rules, module] = await Promise.all([
  readFile(new URL('../gig-radar.html', import.meta.url), 'utf8'),
  readFile(new URL('../musician-matched-gigs.html', import.meta.url), 'utf8'),
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  readFile(new URL('../app/host-mutes.js', import.meta.url), 'utf8')
]);
for (const page of [radarPage, matchedPage]) {
  assert.match(page, /id="hostMutePanel"[^>]*aria-label="Mute hosts from matching"/);
  assert.match(page, /createHostMuteController\(\{ userId \}\)/);
  assert.match(page, /filterMutedHostMatches\(matchedGigFeed, hostMuteController\?\.getMutedHostIds\(\) \|\| \[\]\)/);
  assert.match(page, /createHostMuteButton\(hostId, hostMuteController, document\)/);
  assert.match(page, /appendHostMuteButton\(card\.querySelector\('\.actions'\), g\.hostId\)/);
}
assert.match(radarPage, /appendHostMuteButton\(listEl\.children\[index\]\?\.querySelector\('\.host-mute-actions'\), item\.g\.hostId\)/);
assert.match(matchedPage, /appendHostMuteButton\(listEl\.children\[index\]\?\.querySelector\('\.matched-gig-actions'\), item\.g\.hostId\)/);
assert.match(module, /HOST_MUTES_STORAGE_PREFIX = 'cltch:host-mutes:v1'/);
assert.match(module, /Booking access is unchanged/);
assert.match(module, /not a safety block/);
assert.doesNotMatch(module, /(?:setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction)\s*\(/);
assert.doesNotMatch(module, /textContent\s*=\s*[^;]*hostId/);
assert.doesNotMatch(rules, /hostMutes|blockedUsers|mutedHosts/i, 'feature must not introduce a Firestore block/mute contract');
console.log('Host mute smoke passed (UID-local bounded storage, queue-only filtering, unmute/reset, storage fallback, no UID UI or Firestore writes).');
