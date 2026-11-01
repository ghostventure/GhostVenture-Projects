const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')

test('Cylinder edition detection is centralized, bounded, and fails closed', () => {
  const { classifyWindowsProductName, detectCylinderHost } = require('../cylinder-platform.cjs')
  assert.equal(classifyWindowsProductName('Windows Server 2025 Datacenter'), 'server')
  assert.equal(classifyWindowsProductName('Windows 10 IoT Enterprise'), 'server')
  assert.equal(classifyWindowsProductName('Windows 11 Pro'), 'client')
  assert.equal(classifyWindowsProductName('Windows 10 Enterprise'), 'client')
  assert.equal(classifyWindowsProductName('Windows 8.1 Pro'), 'unsupported')
  assert.equal(classifyWindowsProductName(''), 'unsupported')

  let queryCount = 0
  const result = detectCylinderHost({
    platform: 'win32',
    query: (_exe, args, options) => {
      queryCount++
      assert.deepEqual(args, ['query', 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion', '/v', 'ProductName'])
      assert.equal(options.timeout, 5000)
      assert.equal(options.windowsHide, true)
      return 'HKEY_LOCAL_MACHINE\\...\r\n    ProductName    REG_SZ    Windows Server 2025 Datacenter\r\n'
    },
  })
  assert.deepEqual(result, { variant: 'server', productName: 'Windows Server 2025 Datacenter', reason: '' })
  assert.equal(queryCount, 1)
  assert.equal(detectCylinderHost({ platform: 'linux', query: () => { throw Error('must not query') } }).reason, 'unsupported-platform')
  assert.equal(detectCylinderHost({ platform: 'win32', query: () => { throw Error('registry inaccessible') } }).reason, 'edition-check-failed')
})

test('Cylinder server and client launchers accept only their matching editions', async () => {
  const cases = [
    ['electron-server-main.cjs', 'server', true],
    ['electron-server-main.cjs', 'client', false],
    ['electron-cylinder-client-main.cjs', 'client', true],
    ['electron-cylinder-client-main.cjs', 'server', false],
    ['electron-cylinder-client-main.cjs', 'unsupported', false],
  ]
  for (const [launcher, variant, expectedLaunch] of cases) {
    let launched = false, rejected = false
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../${launcher}`), 'utf8'), {
      process: { platform: 'win32', env: {} },
      require: id => id === 'electron' ? {
        app: { whenReady: () => Promise.resolve(), quit: () => {} },
        dialog: { showErrorBox: () => { rejected = true } },
      } : id === './cylinder-platform.cjs' ? {
        detectCylinderHost: () => ({ variant }),
      } : (() => { launched = true })(),
    })
    await Promise.resolve()
    assert.equal(launched, expectedLaunch, `${launcher} launch result for ${variant}`)
    assert.equal(rejected, !expectedLaunch, `${launcher} rejection result for ${variant}`)
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
