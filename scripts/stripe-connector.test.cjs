const { test } = require('node:test')
const assert = require('node:assert/strict')
const { paymentStatusFor, connectionReadiness, billingErrorMessage } = require('../stripe-connector.cjs')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')

function fixture(fetch) {
  const filename = path.resolve(__dirname, '../electron-backend.cjs')
  const context = { require: createRequire(filename), module: { exports: {} }, process, console, Buffer, AbortSignal, fetch }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8') + `
    persist = () => {}; recordAudit = () => {};
    state = defaultState();
    state.userProfiles = [{id:'user1', email:'staff@example.test', workspace_id:'workspace1', firebase_uid:'uid1', status:'Active'}];
    state.subscriptions = [{manager_email:'other@example.test', tier:'black', payment_status:'paid'}];
    activeSession = {id:'session1', email:'staff@example.test', role:'Owner', firebaseIdToken:'test-token', firebaseUid:'uid1'};
    module.exports.testState = state;
    module.exports.currentSubscription = currentSubscription;
    module.exports.changeSession = () => { activeSession = { ...activeSession, id:'session2' } };
    module.exports.validateConnection = (input) => stripeConfigSchema.parse(input);
  `, context, { filename })
  return context.module.exports
}

test('only confirmed active status or an unexpired trial grants access', () => {
  const now = Date.parse('2026-09-07T12:00:00Z')
  assert.equal(paymentStatusFor({ status: 'active' }, now), 'paid')
  assert.equal(paymentStatusFor({ status: 'trialing', trial_ends_at: '2026-09-08T12:00:00Z' }, now), 'trial')
  for (const status of ['incomplete', 'incomplete_expired', 'unpaid', 'paused', 'trial_expired', 'canceled', 'unknown', undefined]) {
    assert.equal(paymentStatusFor({ status }, now), 'canceled')
  }
  for (const end of ['', 'invalid', '2026-09-07T12:00:00Z', '2026-09-06T12:00:00Z']) {
    assert.equal(paymentStatusFor({ status: 'trialing', trial_ends_at: end }, now), 'canceled')
  }
  assert.equal(paymentStatusFor({ status: 'past_due' }, now), 'past_due')
})

test('saved account references cannot be mistaken for authorization', () => {
  assert.equal(connectionReadiness({ account_id: 'sk_test_secret' }).accountRecorded, false)
  assert.equal(connectionReadiness({ account_id: 'acct_example' }).accountRecorded, true)
  assert.match(connectionReadiness({ account_id: 'acct_example' }).message, /not proof/)
  assert.match(billingErrorMessage(401), /sign-in expired/)
  assert.match(billingErrorMessage(404), /not deployed/)
})

test('desktop never borrows another account subscription', () => {
  assert.equal(fixture().currentSubscription(), null)
})

test('desktop rejects secret keys and invalid account identifiers before saving', () => {
  const backend = fixture()
  assert.throws(() => backend.validateConnection({ publishableKey: 'sk_test_secret' }))
  assert.throws(() => backend.validateConnection({ accountId: 'not-an-account' }))
  assert.equal(backend.validateConnection({ accountId: 'acct_example', publishableKey: 'pk_test_example' }).mode, 'test')
})

test('shared sync reads billing and license without calling payment APIs', async () => {
  const urls = []
  const backend = fixture(async (url) => {
    urls.push(url)
    return { status: 200, ok: true, json: async () => ({ fields: url.endsWith('billing/current') ? { tier: {stringValue:'gold'}, status: {stringValue:'active'} } : {} }) }
  })
  const result = await backend.syncStripeBilling()
  assert.equal(result.status, 'Synced')
  assert.equal(backend.currentSubscription().tier, 'gold')
  assert.equal(urls.length, 2)
  assert.ok(urls.every((url) => url.startsWith('https://firestore.googleapis.com/')))
})

test('failed or stale sync cannot apply a plan to another session', async () => {
  let backend
  backend = fixture(async () => {
    backend.changeSession()
    return { status: 200, ok: true, json: async () => ({ fields: {tier: {stringValue:'black'}, status: {stringValue:'active'}} }) }
  })
  await assert.rejects(backend.syncStripeBilling(), /account changed/)
  assert.equal(backend.currentSubscription(), null)
  const denied = fixture(async () => ({status:401, ok:false}))
  await assert.rejects(denied.syncStripeBilling(), /sign-in expired/)
  assert.equal(denied.getStripeConnectorStatus().status, 'Needs attention')
})

test('missing shared billing revokes this user cached paid subscription', async () => {
  const backend = fixture(async () => ({status:404, ok:false}))
  backend.testState.subscriptions.push({manager_email:'staff@example.test', tier:'gold', payment_status:'paid'})
  await backend.syncStripeBilling()
  assert.equal(backend.currentSubscription(), null)
  assert.equal(backend.testState.subscriptions[0].payment_status, 'paid')
})
