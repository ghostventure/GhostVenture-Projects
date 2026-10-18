const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')

test('Cylinder launcher accepts Server and IoT, rejects standard Windows and failed checks', async () => {
  for (const name of ['Windows Server 2022', 'Windows 10 IoT Enterprise', 'Windows 11 Pro', null]) {
    let launched = false, rejected = false
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../electron-server-main.cjs'), 'utf8'), {
      process: { platform: 'win32', env: {} },
      require: id => id === 'electron' ? {
        app: { whenReady: () => Promise.resolve(), quit: () => {} },
        dialog: { showErrorBox: () => { rejected = true } },
      } : id === 'node:child_process' ? {
        execFileSync: (_exe, _args, options) => {
          assert.equal(options.timeout, 5000)
          assert.equal(options.windowsHide, true)
          if (!name) throw Error('registry inaccessible')
          return name
        },
      } : (() => { launched = true })(),
    })
    await Promise.resolve()
    assert.equal(launched, Boolean(name && /Server|IoT/.test(name)))
    assert.equal(rejected, !launched)
  }
})

function backend() {
  const filename = path.join(__dirname, '../electron-backend.cjs'), module = { exports: {} }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8') + `
    state=defaultState(); activeSession={email:'owner@example.test',role:'Owner'};
    module.exports.inspect={state,currentSubscription};
  `, { require: createRequire(filename), module, console, Buffer, AbortSignal,
    process: { env: { OVERHEAD_DEPLOYMENT_MODE: 'cylinder' } },
    fetch: () => { throw Error('Unexpected billing network request') },
  }, { filename })
  return module.exports
}

test('Cylinder rejects desktop checkout, trial, and cancellation before a network call', async () => {
  const b = backend()
  await assert.rejects(b.createEmbeddedCheckout({ tier: 'gold' }), /deployment agreement/)
  await assert.rejects(b.startFreeGoldTrial(), /deployment agreement/)
  await assert.rejects(b.cancelSubscriptionWithUnusedTimeRefund(), /deployment agreement/)
})

test('Missing, invalid, or expired trial dates cannot retain Cylinder access', () => {
  const b = backend().inspect
  for (const expiry of ['', 'invalid', '2000-01-01', new Date(Date.now() + 86400000).toISOString()]) {
    b.state.subscriptions = [{ manager_email: 'owner@example.test', tier: 'cylinder', payment_status: 'trial', trial_ends_at: expiry }]
    assert.equal(Boolean(b.currentSubscription()), Date.parse(expiry) > Date.now())
  }
  b.state.subscriptions = [{ manager_email: 'owner@example.test', tier: 'cylinder', payment_status: 'paid' }]
  assert.equal(b.currentSubscription().tier, 'cylinder')
})
