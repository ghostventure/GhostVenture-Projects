import assert from 'node:assert/strict';
import { bindSensitiveFieldToggle } from '../app/sensitive-fields.js';

function control() {
  const node = new EventTarget();
  node.attributes = new Map();
  node.setAttribute = (name, value) => node.attributes.set(name, value);
  return node;
}

const input = { type: 'text' };
const button = control();
const windowRef = new EventTarget();
const documentRef = Object.assign(new EventTarget(), { visibilityState: 'visible' });
const cleanup = bindSensitiveFieldToggle(input, button, { windowRef, documentRef });
assert.equal(input.type, 'password');
assert.equal(button.textContent, 'Show payout details');
button.dispatchEvent(new Event('click'));
assert.equal(input.type, 'text');
assert.equal(button.attributes.get('aria-pressed'), 'true');
documentRef.visibilityState = 'hidden';
documentRef.dispatchEvent(new Event('visibilitychange'));
assert.equal(input.type, 'password');
button.dispatchEvent(new Event('click'));
windowRef.dispatchEvent(new Event('blur'));
assert.equal(input.type, 'password');
cleanup();

console.log('Sensitive field smoke passed: masked by default and re-masked on hide, blur, and cleanup.');
