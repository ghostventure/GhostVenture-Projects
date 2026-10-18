const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')
const { UPDATE_INTERVAL_MS, nextUpdateCheck } = require('../update-schedule.cjs')
const source = fs.readFileSync(path.join(__dirname, '../electron-main.cjs'), 'utf8')

function runtime(saved = {}, fail = false) {
  let requests = 0, written
  const context = { updatePreferences: { ...saved }, updateState: {}, updateCheckInFlight: false,
    app: { isPackaged: true, getVersion: () => '0.3.13' }, nextUpdateCheck, Date,
    saveUpdatePreferences: () => { written = { ...context.updatePreferences } },
    setUpdateState: (status, details) => { context.updateState = { status, ...details } },
    updaterStatus: () => context.updateState,
    verifyUpdateFeed: async () => { requests++; if (fail) throw Error('offline'); return '0.3.13' },
    autoUpdater: { setFeedURL: () => {}, checkForUpdates: async () => null },
    UPDATE_FEED_URL: 'https://example.test/updates', STARTUP_UPDATE_TIMEOUT_MS: 1,
    setTimeout, Promise,
  }
  vm.createContext(context)
  vm.runInContext(source.slice(source.indexOf('async function checkForUpdatesBeforeLaunch()'), source.indexOf("autoUpdater.on('update-available'")), context)
  return { context, run: () => context.checkForUpdatesBeforeLaunch(), count: () => requests, saved: () => written }
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

test('cooldown preserves an update ready to install', async () => {
  const r = runtime({ lastAttemptAt: new Date().toISOString() })
  r.context.updateState = { status: 'downloaded' }
  await r.run()
  assert.equal(r.context.updateState.status, 'downloaded')
  assert.equal(r.count(), 0)
})
