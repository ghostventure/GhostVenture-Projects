import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { reauthenticateSensitiveUser } from '../app/reauthenticate-sensitive.js';

const calls = [];
const passwordUser = { email: 'user@example.com', providerData: [{ providerId: 'password' }] };
await reauthenticateSensitiveUser(passwordUser, {
  action: 'payout update',
  promptPassword: async () => 'typed-only',
  makePasswordCredential: (email, password) => ({ email, password }),
  reauthenticateWithCredential: async (user, credential) => calls.push(['password', user, credential])
});
assert.deepEqual(calls[0], ['password', passwordUser, { email: 'user@example.com', password: 'typed-only' }]);

const googleUser = { providerData: [{ providerId: 'google.com' }] };
await reauthenticateSensitiveUser(googleUser, {
  makeGoogleProvider: () => 'google-provider',
  reauthenticateWithPopup: async (user, provider) => calls.push(['google', user, provider])
});
assert.deepEqual(calls[1], ['google', googleUser, 'google-provider']);
await assert.rejects(() => reauthenticateSensitiveUser(passwordUser, { promptPassword: async () => null }), /identity check was cancelled/);
await assert.rejects(() => reauthenticateSensitiveUser({ providerData: [{ providerId: 'apple.com' }] }), /cannot be rechecked/);
const musicianPage = await readFile(new URL('../musician-profile.html', import.meta.url), 'utf8');
const hostPage = await readFile(new URL('../host-profile.html', import.meta.url), 'utf8');
assert.ok((musicianPage.match(/reauthenticateForSensitiveChange\(/g) || []).length >= 7, 'performer sensitive actions must use the common reauthentication gate');
assert.ok((hostPage.match(/reauthenticateForSensitiveChange\(/g) || []).length >= 4, 'host sensitive actions must use the common reauthentication gate');
assert.match(musicianPage, /payoutMethod !== originalPayout\.method/);
assert.match(hostPage, /payMethod !== originalPayout\.method/);
console.log('Sensitive reauthentication smoke passed: password, Google popup, cancel, and unsupported provider paths.');
