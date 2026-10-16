import assert from 'node:assert/strict';
import { clearLocalCltchData } from '../app/local-data.js';

class MemoryStorage {
  constructor(entries) { this.values = new Map(entries); }
  get length() { return this.values.size; }
  key(index) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key) { this.values.delete(key); }
}

const localStorage = new MemoryStorage([
  ['cltch_theme_v1', 'dark'],
  ['cltch_profile_draft_v1:user-a', '{}'],
  ['firebase:authUser:app', '{}'],
  ['unrelated-preference', 'keep']
]);
const sessionStorage = new MemoryStorage([
  ['cltch:session-note', 'local'],
  ['other-app-session', 'keep']
]);
const caches = new Set(['cltch-static-v1', 'other-app-cache']);
const cacheStorage = {
  async keys() { return [...caches]; },
  async delete(name) { return caches.delete(name); }
};

const result = await clearLocalCltchData({ localStorage, sessionStorage, cacheStorage });
assert.deepEqual(result, { removed: 4, failures: 0 });
assert.deepEqual([...localStorage.values.keys()], ['firebase:authUser:app', 'unrelated-preference']);
assert.deepEqual([...sessionStorage.values.keys()], ['other-app-session']);
assert.deepEqual([...caches], ['other-app-cache']);

console.log('Local data smoke passed: only CLTCH local keys and named caches were removed.');
