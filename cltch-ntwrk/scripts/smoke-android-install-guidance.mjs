import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../android-app.html', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
assert.match(html, /<h1>Open CLTCH\.NTWRK on Android<\/h1>/);
assert.match(html, /A native Android package is not currently available/);
assert.match(html, /choose <strong>Install app<\/strong>, or choose <strong>Add to Home screen<\/strong>/);
assert.match(html, /An internet connection is required/);
assert.match(html, /id="nativePackageStatus" role="status">The native Android package download is unavailable/);
assert.match(html, /<a href="index\.html" id="openWebAppLink">Open CLTCH\.NTWRK<\/a>/);
assert.doesNotMatch(html, /CLTCH-NTWRK-Android-Debug-1\.0\.0\.apk\.zip/);
assert.equal(packageJson.scripts['smoke:android-install-guidance'], 'node scripts/smoke-android-install-guidance.mjs');

if (process.env.CLTCH_LIVE_SMOKE === '1') {
  const base = 'https://cltch-ntwrk-social.web.app';
  const targets = ['/', '/manifest.webmanifest', '/icons/cltch-icon.svg', '/android-app.html'];
  const results = await Promise.all(targets.map(async (target) => {
    const response = await fetch(new URL(target, base), { redirect: 'follow', signal: AbortSignal.timeout(12000) });
    assert.ok(response.ok, `${target} returned HTTP ${response.status}`);
    return [target, response];
  }));
  const manifestResponse = results.find(([target]) => target === '/manifest.webmanifest')[1];
  const manifest = await manifestResponse.json();
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.some((icon) => icon.src === '/icons/cltch-icon.svg'));
  console.log('Live Android install targets passed: home page, manifest, icon, and Android guide return success.');
}

console.log('Android install guidance smoke passed: dead APK link removed, unavailable-native status is clear, and accessible browser-install steps point to the live web app.');
