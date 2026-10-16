import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../site-init.js', import.meta.url), 'utf8');
assert.match(source, /cltch-exp-title">Posting Readiness/);
assert.match(source, /Advisory checklist only\. It does not block publishing or grant account access\./);
assert.doesNotMatch(source, /Delegate access \(MVP\)/);
assert.doesNotMatch(source, /cltchDelegateEmail|cltchDelegateAdd|cltch_host_delegates_v1/);
assert.doesNotMatch(source, /initHostPostingGateAndDelegates/);

console.log('Host readiness smoke passed: advisory-only copy and no fake team access flow.');
