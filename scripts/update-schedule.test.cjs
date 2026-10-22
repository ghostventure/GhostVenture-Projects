const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')
const { UPDATE_INTERVAL_MS, nextUpdateCheck } = require('../update-schedule.cjs')
const { classifyReleaseUpdate, releaseInstaller } = require('../github-release.cjs')
const source = fs.readFileSync(path.join(__dirname, '../electron-main.cjs'), 'utf8')

function runtime(saved = {}, fail = false, options = {}) {
  let requests = 0, written
  const feeds = []
  const context = { updatePreferences: { ...saved }, updateState: {}, updateCheckInFlight: false,
    app: { isPackaged: true, getVersion: () => '0.3.13' }, nextUpdateCheck, Date,
    saveUpdatePreferences: () => { written = { ...context.updatePreferences } },
    setUpdateState: (status, details) => { context.updateState = { status, ...details } },
    updaterStatus: () => context.updateState,
    verifyGitHubRelease: async () => options.githubRelease || null,
    verifyUpdateFeed: async () => { requests++; if (fail) throw Error('offline'); return '0.3.13' },
    autoUpdater: {
      setFeedURL: (feed) => feeds.push(feed.url),
      checkForUpdates: async () => {
        if (feeds.at(-1)?.includes('github.com') && options.githubCheckFails) throw Error('GitHub offline')
        return null
      },
    },
    UPDATE_FEED_URL: 'https://example.test/updates', DEPLOYMENT_MODE: 'desktop', RELEASE_TARGET: 'desktop', STARTUP_UPDATE_TIMEOUT_MS: 1,
    releaseFeedUrl: (release) => `https://github.com/releases/download/${release.tag_name}`,
    releaseVersion: (release) => release.tag_name.replace(/^v/, ''),
    classifyReleaseUpdate,
    releaseInstaller,
    setTimeout, Promise,
  }
  vm.createContext(context)
  vm.runInContext(source.slice(source.indexOf('async function checkForUpdatesBeforeLaunch()'), source.indexOf("autoUpdater.on('update-available'")), context)
  return { context, run: () => context.checkForUpdatesBeforeLaunch(), count: () => requests, saved: () => written, feeds }
}

test('72-hour boundary and malformed timestamps', () => {
  assert.equal(UPDATE_INTERVAL_MS, 259200000)
  const start = Date.parse('2026-09-14T12:00:00Z')
  assert.equal(nextUpdateCheck(new Date(start).toISOString(), start), start + UPDATE_INTERVAL_MS)
  assert.equal(nextUpdateCheck('', start), start)
  assert.equal(nextUpdateCheck('invalid', start), start)
  assert.ok(nextUpdateCheck(new Date(start).toISOString(), start - 1000) > start - 1000)
})

test('concurrent checks and process restarts do not bypass persisted cooldown', async () => {
  const first = runtime()
  await Promise.all([first.run(), first.run()])
  assert.equal(first.count(), 1)
  const restarted = runtime(first.saved())
  await restarted.run()
  assert.equal(restarted.count(), 0)
  assert.equal(restarted.context.updateState.status, 'scheduled')
})

test('failed attempts count; checks resume only after the interval', async () => {
  const offline = runtime({}, true)
  await offline.run(); await offline.run()
  assert.equal(offline.count(), 1)
  const due = runtime({ lastAttemptAt: new Date(Date.now() - UPDATE_INTERVAL_MS - 100).toISOString() })
  await due.run()
  assert.equal(due.count(), 1)
})

test('a compatible GitHub release is used when Firebase feed verification fails', async () => {
  const r = runtime({}, true, { githubRelease: { tag_name: 'v0.3.19' } })
  await r.run()
  assert.deepEqual(r.feeds, ['https://github.com/releases/download/v0.3.19'])
  assert.equal(r.count(), 1)
  assert.match(r.context.updateState.message, /checking GitHub release v0.3.19/)
})

test('Firebase remains canonical when its feed verifies successfully', async () => {
  const r = runtime({}, false, { githubRelease: { tag_name: 'v0.3.19' } })
  await r.run()
  assert.deepEqual(r.feeds, ['https://example.test/updates'])
  assert.equal(r.context.updateState.status, 'checking')
  assert.equal(r.context.updateState.version, '0.3.13')
})

test('cooldown preserves an update ready to install', async () => {
  const r = runtime({ lastAttemptAt: new Date().toISOString() })
  r.context.updateState = { status: 'downloaded' }
  await r.run()
  assert.equal(r.context.updateState.status, 'downloaded')
  assert.equal(r.count(), 0)
})
