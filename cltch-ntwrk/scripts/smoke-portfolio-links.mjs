import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('./platform-components.js', import.meta.url), 'utf8');
const sandbox = { window: {}, URL };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'scripts/platform-components.js' });
const normalize = sandbox.window.PlatformComponents.normalizeExternalUrl;
assert.equal(normalize('https://example.com/epk'), 'https://example.com/epk');
assert.equal(normalize('http://example.com'), 'http://example.com/');
assert.equal(normalize('javascript:alert(1)'), '');
assert.equal(normalize('data:text/html,<script>alert(1)</script>'), '');
assert.equal(normalize('//example.com/epk'), '');
assert.equal(normalize('https://user:password@example.com'), '');
assert.equal(normalize('https://' + 'a'.repeat(500)), '');
assert.equal(normalize(''), '');
console.log('Portfolio link smoke passed: only bounded HTTP(S) URLs without embedded credentials are accepted.');
