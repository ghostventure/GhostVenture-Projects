import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.id, '/');
assert.equal(manifest.scope, '/');
assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 3);

const seen = new Set();
for (const shortcut of manifest.shortcuts) {
  assert.ok(shortcut.name && shortcut.short_name, 'shortcut needs a readable name');
  assert.ok(shortcut.url?.startsWith('/') && !shortcut.url.startsWith('//'), `${shortcut.name}: URL must be same-origin`);
  assert.ok(!seen.has(shortcut.url), `${shortcut.name}: duplicate shortcut URL`);
  seen.add(shortcut.url);
  const target = resolve(root, `.${shortcut.url}`);
  assert.ok(target.startsWith(`${root}/`) && existsSync(target), `${shortcut.name}: missing target ${shortcut.url}`);
}

console.log(`PWA manifest shortcuts passed (${seen.size} same-origin targets).`);
