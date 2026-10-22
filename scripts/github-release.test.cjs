const { test } = require('node:test')
const assert = require('node:assert/strict')
const { GITHUB_RELEASES_API_URL, isCompatibleRelease, latestCompatibleRelease, releaseFeedUrl, releaseVersion, classifyReleaseUpdate, releaseInstaller } = require('../github-release.cjs')

const release = (tag_name, ...names) => ({ tag_name, published_at: '2026-10-01T00:00:00Z', draft: false, prerelease: false, assets: names.map((name) => ({ name })) })

test('GitHub updater uses the public release list', () => {
  assert.equal(GITHUB_RELEASES_API_URL, 'https://api.github.com/repos/ghostventure/GhostVenture-Projects/releases?per_page=100')
})

test('a stable release needs the manifest and the correct desktop installer', () => {
  assert.equal(isCompatibleRelease(release('overhead-v0.3.19', 'latest.yml', 'OverHead-Setup-0.3.19-win-x64.exe')), true)
  assert.equal(isCompatibleRelease(release('overhead-v0.3.19', 'latest.yml')), false)
  assert.equal(isCompatibleRelease(release('overhead-v0.3.19', 'OverHead-Setup-0.3.19-win-x64.exe')), false)
})

test('Cylinder release checks require the Cylinder installer', () => {
  assert.equal(isCompatibleRelease(release('overhead-cylinder-v0.3.19', 'latest.yml', 'OverHead-Cylinder-Setup-0.3.19-win-x64.exe'), 'cylinder'), true)
  assert.equal(isCompatibleRelease(release('overhead-cylinder-v0.3.19', 'latest.yml', 'OverHead-Setup-0.3.19-win-x64.exe'), 'cylinder'), false)
})

test('drafts, previews, and malformed responses are ignored', () => {
  assert.equal(isCompatibleRelease({ ...release('overhead-v0.3.19', 'latest.yml', 'OverHead-Setup-0.3.19-win-x64.exe'), draft: true }), false)
  assert.equal(isCompatibleRelease({ ...release('overhead-v0.3.19', 'latest.yml', 'OverHead-Setup-0.3.19-win-x64.exe'), prerelease: true }), false)
  assert.equal(isCompatibleRelease(null), false)
})

test('the newest compatible OverHead release wins even when another project released later', () => {
  const older = { ...release('overhead-v0.3.19', 'latest.yml', 'OverHead-Setup-0.3.19-win-x64.exe'), published_at: '2026-10-01T00:00:00Z' }
  const newer = { ...release('overhead-v0.3.20', 'latest.yml', 'OverHead-Setup-0.3.20-win-x64.exe'), published_at: '2026-10-10T00:00:00Z' }
  const unrelated = { ...release('timmy-v0.1.4', 'latest.yml', 'Timmy-Setup-win-x64.exe'), published_at: '2026-10-20T00:00:00Z' }
  assert.equal(latestCompatibleRelease([unrelated, older, newer]), newer)
  assert.equal(releaseFeedUrl(newer), 'https://github.com/ghostventure/GhostVenture-Projects/releases/download/overhead-v0.3.20')
  assert.equal(releaseVersion(newer), '0.3.20')
})

test('GitHub releases classify same-major updates as incremental and major changes separately', () => {
  assert.deepEqual(classifyReleaseUpdate('0.3.19', release('overhead-v0.3.20')), {
    installedVersion: '0.3.19', availableVersion: '0.3.20', newer: true, kind: 'incremental',
  })
  assert.equal(classifyReleaseUpdate('0.3.19', release('overhead-v1.0.0')).kind, 'major')
  assert.equal(classifyReleaseUpdate('0.3.19', release('overhead-v0.3.19')).kind, 'current')
  assert.equal(classifyReleaseUpdate('0.3.19', release('overhead-v0.3.18')).newer, false)
})

test('the regular installer URL is product-specific and restricted to GitHub HTTPS', () => {
  const desktop = release('overhead-v0.3.20', 'OverHead-Setup-0.3.20-win-x64.exe')
  desktop.assets[0].browser_download_url = 'https://github.com/ghostventure/GhostVenture-Projects/releases/download/v0.3.20/OverHead-Setup-0.3.20-win-x64.exe'
  assert.equal(releaseInstaller(desktop), desktop.assets[0].browser_download_url)
  assert.equal(releaseInstaller(desktop, 'cylinder'), null)
  desktop.assets[0].browser_download_url = 'https://attacker.example/OverHead-Setup-0.3.20-win-x64.exe'
  assert.equal(releaseInstaller(desktop), null)
})
