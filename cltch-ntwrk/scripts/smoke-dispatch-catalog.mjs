import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../site-init.js', import.meta.url), 'utf8');
assert.match(source, /CLTCH Feature Concepts/);
assert.match(source, /proposed concepts · 0 active integrations/);
assert.match(source, /These entries describe ideas for future work/);
assert.match(source, /Open related page/);
assert.doesNotMatch(source, /function enableCltchComponent\s*\(/);
assert.doesNotMatch(source, /function runCltchComponent\s*\(/);
assert.doesNotMatch(source, /on-demand tools installed/);
assert.doesNotMatch(source, /data-component-(?:enable|run)/);

console.log('Dispatch catalog smoke passed: proposal copy only, no fake enable or run actions.');
