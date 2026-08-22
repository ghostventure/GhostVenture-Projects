const { onRequest } = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret, defineString } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const Stripe = require('stripe')
const crypto = require('crypto')

initializeApp()

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY')
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET')
const stripePublishableKey = defineString('STRIPE_PUBLISHABLE_KEY')
const billingReturnUrl = defineString('BILLING_RETURN_URL')
const priceSilver = defineString('STRIPE_PRICE_SILVER')
const priceGold = defineString('STRIPE_PRICE_GOLD')
const priceBlack = defineString('STRIPE_PRICE_BLACK')
const prices = { silver: priceSilver, gold: priceGold, black: priceBlack }

function json(res, status, body) { res.status(status).json(body) }
async function verifyUser(req) {
  const token = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) throw new Error('Sign in is required for billing.')
  return getAuth().verifyIdToken(token)
}
async function ownerProfile(uid) {
  const profile = (await getFirestore().doc(`profiles/${uid}`).get()).data()
  if (!profile || profile.status !== 'Active' || profile.role !== 'Administrator') throw new Error('Only a workspace administrator can manage billing.')
  return profile
}
function tierFromEvent(event) {
  return String(event.data.object.metadata?.tier || event.data.object.subscription_details?.metadata?.tier || '').toLowerCase()
}
function workspaceFromEvent(event) {
  return String(event.data.object.metadata?.workspaceId || event.data.object.subscription_details?.metadata?.workspaceId || '')
}
function subscriptionPeriod(subscription) {
  const item = subscription.items?.data?.[0] || {}
  return {
    start: Number(subscription.current_period_start || item.current_period_start || 0),
    end: Number(subscription.current_period_end || item.current_period_end || 0),
  }
}
function unusedRefundAmount(invoice, paymentIntent, subscription) {
  const { start, end } = subscriptionPeriod(subscription)
  const now = Math.floor(Date.now() / 1000)
  if (!start || !end || end <= now || end <= start) return 0
  const paid = Number(invoice.amount_paid || paymentIntent.amount_received || 0)
  const refundable = Math.max(0, Number(paymentIntent.amount_received || 0) - Number(paymentIntent.amount_refunded || 0))
  return Math.min(refundable, Math.max(0, Math.floor(paid * ((end - now) / (end - start)))))
}
function timestampIso(value) {
  return value?.toDate?.().toISOString?.() || ''
}
async function expireTrialIfNeeded(workspaceId, billingData) {
  const endsAt = billingData?.trial_ends_at?.toDate?.() || null
  if (billingData?.status !== 'trialing' || !endsAt || endsAt.getTime() > Date.now()) return billingData
  const billing = getFirestore().doc(`workspaces/${workspaceId}/billing/current`)
  await billing.set({
    status: 'trial_expired',
    trial_expired_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    last_event: 'trial.expired',
  }, { merge: true })
  await syncWorkspaceLicenses(workspaceId, billingData.tier || 'gold', 'Suspended', '')
  return { ...billingData, status: 'trial_expired' }
}
async function syncWorkspaceLicenses(workspaceId, tier, status, subscriptionId) {
  if (!workspaceId || !['silver', 'gold', 'black'].includes(tier)) return
  const db = getFirestore()
  const people = await db.collection('profiles').where('workspace_id', '==', workspaceId).get()
  const batch = db.batch()
  people.forEach((person) => {
    if (person.data().status !== 'Active') return
    const ref = db.doc(`workspaces/${workspaceId}/licenses/${person.id}`)
    batch.set(ref, {
      workspace_id: workspaceId,
      user_uid: person.id,
      email: person.data().email || '',
      holder_name: person.data().owner_name || person.data().email || '',
      tier,
      status,
      subscription_id: subscriptionId || '',
      subscription_number: `OH-SUB-${crypto.createHash('sha256').update(`${workspaceId}:${subscriptionId || tier}`).digest('hex').slice(0, 12).toUpperCase()}`,
      license_number: `OH-LIC-${crypto.createHash('sha256').update(`${workspaceId}:${person.id}`).digest('hex').slice(0, 12).toUpperCase()}`,
      updated_at: FieldValue.serverTimestamp(),
      issued_at: FieldValue.serverTimestamp(),
    }, { merge: true })
  })
  await batch.commit()
}
async function applyStripeEvent(event) {
  const db = getFirestore()
  const seen = db.doc(`stripe_events/${event.id}`)
  await db.runTransaction(async (tx) => {
    if ((await tx.get(seen)).exists) return
    tx.create(seen, { type: event.type, received_at: FieldValue.serverTimestamp() })
    const workspaceId = workspaceFromEvent(event)
    if (!workspaceId) return
    const billing = db.doc(`workspaces/${workspaceId}/billing/current`)
    const object = event.data.object
    const tier = tierFromEvent(event)
    const active = event.type === 'checkout.session.completed' || event.type === 'invoice.paid' || event.type === 'customer.subscription.updated'
    const canceled = event.type === 'customer.subscription.deleted'
    const pastDue = event.type === 'invoice.payment_failed'
    tx.set(billing, {
      workspace_id: workspaceId,
      tier: tier || 'silver',
      status: canceled ? 'canceled' : pastDue ? 'past_due' : active ? 'active' : 'pending',
      stripe_customer_id: String(object.customer || ''),
      stripe_subscription_id: String(object.subscription || object.id || ''),
      last_event: event.type,
      checkout_pending: false,
      pending_tier: FieldValue.delete(),
      pending_checkout_started_at: FieldValue.delete(),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true })
  })
  const workspaceId = workspaceFromEvent(event)
  const tier = tierFromEvent(event)
  const status = event.type === 'customer.subscription.deleted' ? 'Suspended'
    : event.type === 'invoice.payment_failed' ? 'Past due' : 'Active'
  await syncWorkspaceLicenses(workspaceId, tier, status, String(event.data.object.subscription || event.data.object.id || ''))
}

// The desktop app and the Firebase-hosted browser workspace use this one
// service. Keep the allow-list narrow: credentials and payment actions must
// never be callable from an arbitrary website.
exports.billingApi = onRequest({
  region: 'us-central1',
  secrets: [stripeSecretKey, stripeWebhookSecret],
  cors: ['https://overhead-office.web.app', 'https://overhead-office.firebaseapp.com'],
}, async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' })
  if (req.path === '/webhook') {
    try {
      const stripe = new Stripe(stripeSecretKey.value())
      const event = stripe.webhooks.constructEvent(req.rawBody, req.get('stripe-signature'), stripeWebhookSecret.value())
      await applyStripeEvent(event)
      return json(res, 200, { received: true })
    } catch (error) { return json(res, 400, { error: `Webhook rejected: ${error.message}` }) }
  }
  try {
    const user = await verifyUser(req)
    const profile = await ownerProfile(user.uid)
    const body = req.body || {}
    const db = getFirestore()
    const billing = db.doc(`workspaces/${profile.workspace_id}/billing/current`)
    if (body.action === 'entitlements') {
      const stored = (await billing.get()).data() || { tier: 'silver', status: 'inactive' }
      const entitlement = await expireTrialIfNeeded(profile.workspace_id, stored)
      const license = entitlement.tier ? (await db.doc(`workspaces/${profile.workspace_id}/licenses/${user.uid}`).get()).data() || null : null
      return json(res, 200, { entitlement: { ...entitlement, trial_ends_at: entitlement.trial_ends_at?.toDate?.().toISOString?.() || '' }, license })
    }
    if (body.action === 'billing_activity') {
      const stored = (await billing.get()).data() || {}
      const current = await expireTrialIfNeeded(profile.workspace_id, stored)
      const events = [
        ['Free Gold trial started', timestampIso(current.trial_started_at), 'No card charged'],
        ['Free Gold trial ends', timestampIso(current.trial_ends_at), current.status === 'trial_expired' ? 'Expired' : 'Scheduled'],
        ['Checkout started', timestampIso(current.pending_checkout_started_at), current.pending_tier || ''],
        ['Subscription canceled', timestampIso(current.canceled_at), current.last_event || ''],
        ['Unused-time refund', timestampIso(current.canceled_at), current.unused_time_refund_amount ? `${current.unused_time_refund_amount} ${String(current.unused_time_refund_currency || 'usd').toUpperCase()} · ${current.unused_time_refund_status || 'requested'}` : 'No refund recorded'],
      ].filter(([, at]) => at)
      return json(res, 200, { events, currentStatus: current.status || 'inactive', tier: current.tier || 'silver' })
    }
    const stripe = new Stripe(stripeSecretKey.value())
    if (body.action === 'start_free_gold_trial') {
      const current = (await billing.get()).data() || {}
      if (body.acceptTrialPolicy !== true) return json(res, 400, { error: 'Acknowledge the Free Trial Policy before starting a trial.' })
      if (current.trial_used) return json(res, 409, { error: 'This workspace has already used its one free trial.' })
      if (['active', 'trialing'].includes(current.status)) return json(res, 409, { error: 'This workspace already has active plan access.' })
      const startsAt = new Date()
      const endsAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000)
      await billing.set({
        workspace_id: profile.workspace_id,
        tier: 'gold',
        status: 'trialing',
        billing_provider: 'overhead_free_trial',
        trial_used: true,
        trial_policy_accepted_at: FieldValue.serverTimestamp(),
        trial_started_at: startsAt,
        trial_ends_at: endsAt,
        checkout_pending: false,
        last_event: 'trial.started',
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true })
      await syncWorkspaceLicenses(profile.workspace_id, 'gold', 'Trial', '')
      return json(res, 200, { trialStarted: true, tier: 'gold', status: 'trialing', trialEndsAt: endsAt.toISOString(), message: 'Your free 30-day Gold trial is active. No card was charged.' })
    }
    if (body.action === 'checkout') {
      const tier = String(body.tier || '').toLowerCase()
      if (!prices[tier]) return json(res, 400, { error: 'Choose Silver, Gold, or Black.' })
      if (body.acceptBillingPolicy !== true) return json(res, 400, { error: 'Acknowledge the Subscription Billing & Authorization Policy before checkout.' })
      const current = (await billing.get()).data() || {}
      if (current.status === 'active' && current.tier === tier) {
        return json(res, 200, { alreadySubscribed: true, entitlement: current, message: `You already have the ${tier[0].toUpperCase()}${tier.slice(1)} plan. No additional charge was created.` })
      }
      const pendingAt = current.pending_checkout_started_at?.toDate?.() || null
      if (current.checkout_pending && pendingAt && Date.now() - pendingAt.getTime() < 30 * 60 * 1000) {
        return json(res, 409, { error: `A ${current.pending_tier || 'plan'} checkout is already open. Finish or close it before starting another one.` })
      }
      await billing.set({ checkout_pending: true, pending_tier: tier, pending_checkout_started_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp() }, { merge: true })
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription', ui_mode: 'embedded', line_items: [{ price: prices[tier].value(), quantity: 1 }],
        customer: current.stripe_customer_id || undefined, customer_email: current.stripe_customer_id ? undefined : user.email,
        client_reference_id: profile.workspace_id,
        metadata: { workspaceId: profile.workspace_id, ownerUid: user.uid, tier },
        subscription_data: { metadata: { workspaceId: profile.workspace_id, ownerUid: user.uid, tier } },
        return_url: `${billingReturnUrl.value()}?session_id={CHECKOUT_SESSION_ID}`,
      })
      await billing.set({ pending_checkout_session_id: session.id }, { merge: true })
      return json(res, 200, { clientSecret: session.client_secret, publishableKey: stripePublishableKey.value(), alreadySubscribed: false })
    }
    if (body.action === 'portal') {
      const current = (await billing.get()).data() || {}
      if (!current.stripe_customer_id) return json(res, 400, { error: 'No Stripe billing account exists yet.' })
      const portal = await stripe.billingPortal.sessions.create({ customer: current.stripe_customer_id, return_url: billingReturnUrl.value() })
      return json(res, 200, { url: portal.url })
    }
    if (body.action === 'cancel_with_unused_time_refund') {
      const current = (await billing.get()).data() || {}
      if (current.status === 'trialing' && !current.stripe_subscription_id) {
        await billing.set({ status: 'canceled', cancellation_pending: false, canceled_at: FieldValue.serverTimestamp(), last_event: 'trial.canceled', updated_at: FieldValue.serverTimestamp() }, { merge: true })
        await syncWorkspaceLicenses(profile.workspace_id, current.tier || 'gold', 'Suspended', '')
        return json(res, 200, { canceled: true, refundAmount: 0, currency: 'usd', refundStatus: 'not_applicable', message: 'Your free trial was canceled. No payment was collected, so no refund was needed.' })
      }
      if (!current.stripe_subscription_id) return json(res, 400, { error: 'No active Stripe subscription was found for this workspace.' })
      if (current.cancellation_pending) return json(res, 409, { error: 'A cancellation and refund request is already being processed. Please wait for its result.' })
      if (current.status === 'canceled') return json(res, 409, { error: 'This subscription is already canceled.' })
      await billing.set({ cancellation_pending: true, cancellation_requested_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp() }, { merge: true })
      try {
        const subscription = await stripe.subscriptions.retrieve(current.stripe_subscription_id, { expand: ['latest_invoice.payment_intent'] })
        if (!['active', 'trialing'].includes(subscription.status)) throw new Error(`This subscription cannot be canceled automatically while its Stripe status is ${subscription.status}.`)
        const latestInvoice = subscription.latest_invoice && typeof subscription.latest_invoice === 'object' ? subscription.latest_invoice : null
        const paymentIntent = latestInvoice?.payment_intent && typeof latestInvoice.payment_intent === 'object' ? latestInvoice.payment_intent : null
        const refundAmount = latestInvoice && paymentIntent ? unusedRefundAmount(latestInvoice, paymentIntent, subscription) : 0
        const canceled = await stripe.subscriptions.cancel(subscription.id, { prorate: false, invoice_now: false })
        let refund = null
        if (refundAmount > 0 && paymentIntent?.id) {
          refund = await stripe.refunds.create({
            payment_intent: paymentIntent.id,
            amount: refundAmount,
            metadata: { workspaceId: profile.workspace_id, subscriptionId: subscription.id, reason: 'unused_subscription_time' },
          }, { idempotencyKey: `overhead-unused-time-refund-${subscription.id}` })
        }
        const period = subscriptionPeriod(subscription)
        await billing.set({
          status: 'canceled',
          stripe_customer_id: String(canceled.customer || current.stripe_customer_id || ''),
          stripe_subscription_id: subscription.id,
          checkout_pending: false,
          cancellation_pending: false,
          canceled_at: FieldValue.serverTimestamp(),
          unused_time_refund_status: refund ? refund.status : 'not_applicable',
          unused_time_refund_id: refund?.id || '',
          unused_time_refund_amount: refund?.amount || 0,
          unused_time_refund_currency: refund?.currency || latestInvoice?.currency || '',
          unused_time_refund_period_start: period.start || 0,
          unused_time_refund_period_end: period.end || 0,
          last_event: 'subscription.canceled_with_unused_time_refund',
          updated_at: FieldValue.serverTimestamp(),
        }, { merge: true })
        await syncWorkspaceLicenses(profile.workspace_id, current.tier || tierFromEvent({ data: { object: subscription } }) || 'silver', 'Suspended', subscription.id)
        return json(res, 200, {
          canceled: true,
          refundAmount: refund?.amount || 0,
          currency: refund?.currency || latestInvoice?.currency || 'usd',
          refundStatus: refund?.status || 'not_applicable',
          message: refund ? 'Your subscription was canceled and the unused portion was refunded to the original payment method.' : 'Your subscription was canceled. No unused paid time was available to refund.',
        })
      } catch (error) {
        await billing.set({ cancellation_pending: false, cancellation_error: error.message || 'Cancellation failed.', updated_at: FieldValue.serverTimestamp() }, { merge: true })
        throw error
      }
    }
    return json(res, 400, { error: 'Unknown billing action.' })
  } catch (error) { return json(res, 403, { error: error.message || 'Billing request denied.' }) }
})

exports.expireTrials = onSchedule({ region: 'us-central1', schedule: 'every 1 hours', timeZone: 'Etc/UTC' }, async () => {
  const db = getFirestore()
  const workspaces = await db.collection('workspaces').listDocuments()
  for (const workspace of workspaces) {
    const billing = (await workspace.collection('billing').doc('current').get()).data()
    await expireTrialIfNeeded(workspace.id, billing)
  }
})
