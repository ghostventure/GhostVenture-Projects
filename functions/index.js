const { onRequest } = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret, defineString } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const Stripe = require('stripe')
const crypto = require('crypto')
const {
  PLAN_CENTS, CYLINDER_MONTHLY_CAP_CENTS, seatPriceCents,
} = require('./seat-pricing.cjs')

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
  const user = await getAuth().verifyIdToken(token)
  if (user.email_verified !== true) throw new Error('Verify your email before managing billing.')
  return user
}
async function ownerProfile(uid) {
  const profile = (await getFirestore().doc(`profiles/${uid}`).get()).data()
  if (!profile || profile.status !== 'Active' || profile.role !== 'Administrator' || typeof profile.workspace_id !== 'string' || !profile.workspace_id || profile.workspace_id.includes('/')) throw new Error('Only a workspace administrator can manage billing.')
  return profile
}
const normalizedEmail = (value) => String(value || '').trim().toLowerCase()
const seatKey = (email) => crypto.createHash('sha256').update(normalizedEmail(email)).digest('hex')
const tierBaseCents = (tier) => PLAN_CENTS[String(tier || '').toLowerCase()] || PLAN_CENTS.silver

async function seatProduct(stripe, workspaceId, billingRef, billingData = {}) {
  if (billingData.seat_product_id) return billingData.seat_product_id
  const product = await stripe.products.create({
    name: `OverHead Desktop additional seats (${workspaceId.slice(0, 8)})`,
    metadata: { overhead_kind: 'desktop_seat_overage', workspace_id: workspaceId },
  }, { idempotencyKey: `overhead-seat-product-${workspaceId}` })
  await billingRef.set({ seat_product_id: product.id, updated_at: FieldValue.serverTimestamp() }, { merge: true })
  return product.id
}

async function setStripeSeatOverage(stripe, billingRef, billingData, overageCents, operationId) {
  const subscriptionId = billingData.stripe_subscription_id
  if (!subscriptionId || !['active', 'trialing'].includes(billingData.status)) return null
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const existing = (subscription.items?.data || []).find(item => item.metadata?.overhead_kind === 'desktop_seat_overage')
  if (overageCents <= 0) {
    if (existing) await stripe.subscriptionItems.del(existing.id, { proration_behavior: 'none' }, { idempotencyKey: `overhead-seat-delete-${operationId}` })
    return null
  }
  if (existing && Number(existing.price?.unit_amount || 0) === Math.min(overageCents, CYLINDER_MONTHLY_CAP_CENTS)) return existing
  const product = await seatProduct(stripe, billingData.workspace_id, billingRef, billingData)
  const price = await stripe.prices.create({
    product, currency: 'usd', unit_amount: Math.min(overageCents, CYLINDER_MONTHLY_CAP_CENTS),
    recurring: { interval: 'month' }, metadata: { overhead_kind: 'desktop_seat_overage', workspace_id: billingData.workspace_id },
  }, { idempotencyKey: `overhead-seat-price-${operationId}` })
  const params = {
    price: price.id, quantity: 1, proration_behavior: 'none',
    metadata: { overhead_kind: 'desktop_seat_overage', workspace_id: billingData.workspace_id },
  }
  if (existing) return stripe.subscriptionItems.update(existing.id, params, { idempotencyKey: `overhead-seat-item-${operationId}` })
  return stripe.subscriptionItems.create({ subscription: subscriptionId, ...params }, { idempotencyKey: `overhead-seat-item-${operationId}` })
}

async function createWorkspaceInvite(db, stripe, workspaceId, ownerUid, businessName, body) {
  const email = normalizedEmail(body.email)
  const name = String(body.name || '').trim().slice(0, 80) || email
  const role = String(body.role || 'Staff')
  const localOnly = body.localOnly === true
  const requestId = String(body.requestId || '')
  if (!/^\S+@\S+\.\S+$/.test(email) || !['Manager', 'Staff'].includes(role)) throw new Error('Enter a valid email and choose Manager or Staff.')
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(requestId)) throw new Error('Refresh and try the invitation again.')

  const billingRef = db.doc(`workspaces/${workspaceId}/billing/current`)
  await ensureSeatSummary(workspaceId, db, billingRef)
  const inviteRef = db.doc(`workspaces/${workspaceId}/invites/${email}`)
  const seatRef = db.doc(`workspaces/${workspaceId}/desktop_seats/${seatKey(email)}`)
  const operationRef = db.doc(`workspaces/${workspaceId}/seat_operations/${requestId}`)
  const profileQuery = db.collection('profiles').where('workspace_id', '==', workspaceId).where('email', '==', email)
  const reservation = await db.runTransaction(async tx => {
    const [billingSnap, inviteSnap, profileSnaps, localSeatSnap, operationSnap] = await Promise.all([
      tx.get(billingRef), tx.get(inviteRef), tx.get(profileQuery), tx.get(seatRef), tx.get(operationRef),
    ])
    const billing = billingSnap.data() || {}
    if (operationSnap.exists && operationSnap.data().status === 'complete') return { complete: true, seatCount: billing.seat_count || 0, overageCents: billing.seat_overage_cents || 0 }
    if (!localOnly && inviteSnap.exists) return { exists: true, seatCount: billing.seat_count || 0, overageCents: billing.seat_overage_cents || 0 }
    if (profileSnaps.size) throw new Error('That email already belongs to a workspace profile.')
      if (billing.checkout_pending) throw new Error('Plan checkout is processing. Retry the invitation after billing finishes.')
      if (billing.seat_update_pending_id && billing.seat_update_pending_id !== requestId) throw new Error('Another seat update is processing. Retry in a few seconds.')
    let seatCount = Number(billing.seat_count || 0), overageCents = Number(billing.seat_overage_cents || 0)
    const existingLocalSeat = localSeatSnap.exists && ['active', 'pending verification', 'invited'].includes(String(localSeatSnap.data().status || '').toLowerCase())
    const isNewSeat = !existingLocalSeat
    const tier = String(billing.tier || 'silver').toLowerCase()
    const base = tierBaseCents(tier)
    const seatChargeCents = isNewSeat
      ? Math.min(seatPriceCents(tier, seatCount + 1), Math.max(0, CYLINDER_MONTHLY_CAP_CENTS - base - overageCents))
      : Number(localSeatSnap.data().seat_charge_cents || 0)
    const seatNumber = isNewSeat ? seatCount + 1 : Number(localSeatSnap.data().seat_number || seatCount)
    if (operationSnap.exists && operationSnap.data().status === 'pending') {
      return { requestId, email, name, role, tier, seatCount: operationSnap.data().seat_count, overageCents: operationSnap.data().overage_cents, seatChargeCents: operationSnap.data().seat_charge_cents, seatNumber: operationSnap.data().seat_number, isNewSeat: operationSnap.data().is_new_seat }
    }
    if (billing.checkout_pending) throw new Error('Plan checkout is processing. Retry the invitation after billing finishes.')
    if (billing.seat_update_pending_id && billing.seat_update_pending_id !== requestId) throw new Error('Another seat update is processing. Retry in a few seconds.')
    const nextSeatCount = seatCount + (isNewSeat ? 1 : 0)
    const nextOverageCents = overageCents + (isNewSeat ? seatChargeCents : 0)
    tx.set(billingRef, { seat_update_pending_id: requestId, updated_at: FieldValue.serverTimestamp() }, { merge: true })
    tx.set(operationRef, {
      request_id: requestId, email, owner_uid: ownerUid, tier, is_new_seat: isNewSeat,
      seat_count: nextSeatCount, overage_cents: nextOverageCents, seat_number: seatNumber,
      seat_charge_cents: seatChargeCents, status: 'pending', created_at: FieldValue.serverTimestamp(),
    }, { merge: true })
    return { requestId, email, name, role, tier, seatCount: nextSeatCount, overageCents: nextOverageCents, seatChargeCents, seatNumber, isNewSeat }
  })
  if (reservation.complete || reservation.exists) return { invited: false, complete: reservation.complete === true, localSeatReserved: localOnly && reservation.complete === true, alreadyInvited: reservation.exists, seatCount: reservation.seatCount, monthlyTotalCents: tierBaseCents((await billingRef.get()).data()?.tier) + reservation.overageCents }

  const billing = (await billingRef.get()).data() || {}
  try {
    await setStripeSeatOverage(stripe, billingRef, { ...billing, workspace_id: workspaceId }, reservation.overageCents, requestId)
    const createdAt = new Date()
    const expiresAt = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000)
    await db.runTransaction(async tx => {
      const [latestBilling, operation] = await Promise.all([tx.get(billingRef), tx.get(operationRef)])
      if (!operation.exists || operation.data().status !== 'pending' || latestBilling.data()?.seat_update_pending_id !== requestId) throw new Error('This seat reservation changed. Refresh and try again.')
      if (localOnly) {
        tx.set(seatRef, { email, name, status: 'Pending verification', seat_charge_cents: reservation.seatChargeCents, seat_number: reservation.seatNumber, created_by: ownerUid, created_at: createdAt, updated_at: createdAt }, { merge: true })
      } else {
        const write = { email, name, business_name: businessName || 'OverHead workspace', role, created_by: ownerUid, created_at: createdAt, expires_at: expiresAt, seat_charge_cents: reservation.seatChargeCents, seat_number: reservation.seatNumber, seat_reserved: true }
        tx.set(inviteRef, write)
        if (reservation.isNewSeat) tx.set(seatRef, { email, name, status: 'Invited', seat_charge_cents: reservation.seatChargeCents, seat_number: reservation.seatNumber, invite_email: email, created_at: createdAt, updated_at: createdAt }, { merge: true })
      }
      tx.set(billingRef, { seat_update_pending_id: FieldValue.delete(), seat_count: reservation.seatCount, seat_overage_cents: reservation.overageCents, seat_summary_initialized: true, updated_at: FieldValue.serverTimestamp() }, { merge: true })
      tx.set(operationRef, { status: 'complete', completed_at: FieldValue.serverTimestamp() }, { merge: true })
    })
  } catch (error) {
    // Keep the reservation lock on ambiguous Stripe/network failures. Retrying
    // the same request id reuses Stripe's idempotency key and completes the invite.
    if (error.type && ['StripeInvalidRequestError', 'StripeAuthenticationError', 'StripePermissionError'].includes(error.type)) {
      await db.runTransaction(async tx => {
        const current = (await tx.get(billingRef)).data() || {}
        if (current.seat_update_pending_id === requestId) tx.set(billingRef, { seat_update_pending_id: FieldValue.delete() }, { merge: true })
        tx.set(operationRef, { status: 'failed', failure: error.message, updated_at: FieldValue.serverTimestamp() }, { merge: true })
      })
    }
    throw error
  }
  return { invited: !localOnly, localSeatReserved: localOnly, seatCount: reservation.seatCount, seatChargeCents: reservation.seatChargeCents, monthlyTotalCents: tierBaseCents(reservation.tier) + reservation.overageCents, cylinderRecommended: tierBaseCents(reservation.tier) + reservation.overageCents >= CYLINDER_MONTHLY_CAP_CENTS }
}

async function updateLocalSeat(db, stripe, workspaceId, body) {
  const email = normalizedEmail(body.email)
  const status = String(body.status || '').toLowerCase()
  const requestId = String(body.requestId || '')
  const targetUid = String(body.uid || '')
  if (!/^\S+@\S+\.\S+$/.test(email) || !['active', 'suspended', 'released'].includes(status)) throw new Error('Choose a valid local user and seat status.')
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(requestId)) throw new Error('Refresh and try the seat update again.')
  if (targetUid && (!/^[A-Za-z0-9:_-]{1,128}$/.test(targetUid) || status === 'released')) throw new Error('The shared account seat update is invalid.')
  const sharedRole = String(body.role || '')
  if (targetUid && sharedRole && !['Administrator', 'Manager', 'Staff'].includes(sharedRole)) throw new Error('Choose a valid shared workspace role.')
  const billingRef = db.doc(`workspaces/${workspaceId}/billing/current`)
  const seatRef = db.doc(`workspaces/${workspaceId}/desktop_seats/${seatKey(email)}`)
  const targetProfileRef = targetUid ? db.doc(`profiles/${targetUid}`) : null
  await ensureSeatSummary(workspaceId, db, billingRef)
  const lock = await db.runTransaction(async tx => {
    const [billingSnap, seatSnap, targetProfileSnap] = await Promise.all([
      tx.get(billingRef), tx.get(seatRef), ...(targetProfileRef ? [tx.get(targetProfileRef)] : []),
    ])
    const billing = billingSnap.data() || {}
    const sharedProfile = targetProfileRef ? targetProfileSnap.data() : null
    if (targetProfileRef && (!sharedProfile || sharedProfile.workspace_id !== workspaceId || normalizedEmail(sharedProfile.email) !== email || sharedProfile.role === 'Customer')) throw new Error('That shared user is not an employee in this workspace.')
    if (!seatSnap.exists && !targetProfileRef) return { found: false }
    if (billing.checkout_pending) throw new Error('Plan checkout is processing. Retry the seat update after billing finishes.')
    if (billing.seat_update_pending_id && billing.seat_update_pending_id !== requestId) throw new Error('Another seat update is processing. Retry in a few seconds.')
    tx.set(billingRef, { seat_update_pending_id: requestId, updated_at: FieldValue.serverTimestamp() }, { merge: true })
    return { found: true, billing, seat: seatSnap.data(), sharedProfile }
  })
  if (!lock.found) return { updated: false, seatFound: false }

  try {
    const [profiles, invites, localSeats] = await Promise.all([
      db.collection('profiles').where('workspace_id', '==', workspaceId).get(),
      db.collection('workspaces').doc(workspaceId).collection('invites').get(),
      db.collection('workspaces').doc(workspaceId).collection('desktop_seats').get(),
    ])
    const people = new Map()
    profiles.forEach(snap => {
      const person = snap.data(), key = normalizedEmail(person.email)
      const isTarget = targetUid && snap.id === targetUid
      const nextStatus = isTarget ? status : person.status
      if (key && nextStatus === 'active' || key && nextStatus === 'Active') {
        if (person.role !== 'Customer' && person.cylinder_managed !== true) people.set(key, { email: key, uid: snap.id, created: person.created_at?.toDate?.()?.getTime?.() || Date.parse(person.created_at || '') || 0, profile: snap.ref, charge: 0, number: 0 })
      }
    })
    invites.forEach(snap => {
      const invite = snap.data(), key = normalizedEmail(invite.email)
      const expires = invite.expires_at?.toDate?.()?.getTime?.() || Date.parse(invite.expires_at || '') || Infinity
      if (key && expires > Date.now() && !people.has(key)) people.set(key, { email: key, created: invite.created_at?.toDate?.()?.getTime?.() || Date.parse(invite.created_at || '') || 0, invite: snap.ref, charge: 0, number: 0 })
    })
    localSeats.forEach(snap => {
      const seat = snap.data(), key = normalizedEmail(seat.email)
      if (!key) return
      const nextStatus = key === email ? status : String(seat.status || '').toLowerCase()
      if (!['active', 'pending verification', 'invited'].includes(nextStatus)) { if (key === email) people.delete(key); return }
      const existing = people.get(key)
      if (existing) existing.localSeat = snap.ref
      else people.set(key, { email: key, created: seat.created_at?.toDate?.()?.getTime?.() || Date.parse(seat.created_at || '') || 0, localSeat: snap.ref, charge: 0, number: 0 })
    })
    if (status === 'released') people.delete(email)

    const billing = (await billingRef.get()).data() || lock.billing || {}
    const tier = String(billing.tier || 'silver').toLowerCase()
    const ordered = [...people.values()].sort((a, b) => a.created - b.created || a.email.localeCompare(b.email))
    let overageCents = 0
    ordered.forEach((person, index) => {
      person.number = index + 1
      const wanted = index === 0 ? 0 : seatPriceCents(tier, index + 1)
      person.charge = Math.min(wanted, Math.max(0, CYLINDER_MONTHLY_CAP_CENTS - tierBaseCents(tier) - overageCents))
      overageCents += person.charge
    })
    await setStripeSeatOverage(stripe, billingRef, { ...billing, workspace_id: workspaceId }, overageCents, requestId)
    await db.runTransaction(async tx => {
      const latest = (await tx.get(billingRef)).data() || {}
      if (latest.seat_update_pending_id !== requestId) throw new Error('This seat update changed. Refresh and try again.')
      for (const person of ordered) {
        const fields = { seat_number: person.number, seat_charge_cents: person.charge, updated_at: FieldValue.serverTimestamp() }
        if (person.profile) tx.set(person.profile, person.uid === targetUid
          ? { ...fields, status: status === 'active' ? 'Active' : 'Suspended', ...(sharedRole ? { role: sharedRole } : {}), ...(body.ownerName ? { owner_name: String(body.ownerName).slice(0, 80) } : {}), ...(body.businessName ? { business_name: String(body.businessName).slice(0, 120) } : {}) }
          : fields, { merge: true })
        if (person.invite) tx.set(person.invite, fields, { merge: true })
        if (person.localSeat) tx.set(person.localSeat, person.email === email
          ? { ...fields, status: status === 'active' ? 'Active' : status === 'released' ? 'Released' : 'Suspended' }
          : fields, { merge: true })
      }
      if (targetProfileRef && !ordered.some(person => person.uid === targetUid)) tx.set(targetProfileRef, { status: 'Suspended', seat_number: 0, seat_charge_cents: 0, ...(sharedRole ? { role: sharedRole } : {}), ...(body.ownerName ? { owner_name: String(body.ownerName).slice(0, 80) } : {}), ...(body.businessName ? { business_name: String(body.businessName).slice(0, 120) } : {}), updated_at: FieldValue.serverTimestamp() }, { merge: true })
      if (!ordered.some(person => person.email === email)) tx.set(seatRef, { status: status === 'released' ? 'Released' : 'Suspended', seat_charge_cents: 0, updated_at: FieldValue.serverTimestamp() }, { merge: true })
      tx.set(billingRef, { seat_count: ordered.length, seat_overage_cents: overageCents, seat_summary_initialized: true, seat_update_pending_id: FieldValue.delete(), updated_at: FieldValue.serverTimestamp() }, { merge: true })
    })
    return { updated: true, seatFound: true, status, seatCount: ordered.length, monthlyTotalCents: tierBaseCents(tier) + overageCents, cylinderRecommended: tierBaseCents(tier) + overageCents >= CYLINDER_MONTHLY_CAP_CENTS }
  } catch (error) {
    // Keep the lock if Stripe may have accepted the idempotent update; retrying
    // with the same request id safely completes the local ledger update.
    if (error.type && ['StripeInvalidRequestError', 'StripeAuthenticationError', 'StripePermissionError'].includes(error.type)) {
      await db.runTransaction(async tx => {
        const current = (await tx.get(billingRef)).data() || {}
        if (current.seat_update_pending_id === requestId) tx.set(billingRef, { seat_update_pending_id: FieldValue.delete() }, { merge: true })
      })
    }
    throw error
  }
}

async function initialSeatSummary(workspaceId, db) {
  const [profiles, invites, desktopSeats] = await Promise.all([
    db.collection('profiles').where('workspace_id', '==', workspaceId).get(),
    db.collection('workspaces').doc(workspaceId).collection('invites').get(),
    db.collection('workspaces').doc(workspaceId).collection('desktop_seats').get(),
  ])
  const seats = new Map()
  profiles.forEach(snap => {
    const person = snap.data(), email = normalizedEmail(person.email)
    if (email && person.status === 'Active' && person.role !== 'Customer' && person.cylinder_managed !== true) seats.set(email, Number(person.seat_charge_cents) || 0)
  })
  invites.forEach(snap => {
    const data = snap.data(), email = normalizedEmail(data.email)
    const expires = data.expires_at?.toDate?.()?.getTime?.() || Date.parse(data.expires_at || '') || Infinity
    if (email && expires > Date.now()) seats.set(email, Math.max(seats.get(email) || 0, Number(data.seat_charge_cents) || 0))
  })
  desktopSeats.forEach(snap => {
    const data = snap.data(), email = normalizedEmail(data.email)
    if (email && ['active', 'pending verification', 'invited'].includes(String(data.status || '').toLowerCase())) seats.set(email, Math.max(seats.get(email) || 0, Number(data.seat_charge_cents) || 0))
  })
  return { user_count: seats.size, initialized: true }
}

async function ensureSeatSummary(workspaceId, db, billingRef) {
  const current = (await billingRef.get()).data() || {}
  if (current.seat_summary_initialized) return current
  const summary = await initialSeatSummary(workspaceId, db)
  await db.runTransaction(async tx => {
    const latest = (await tx.get(billingRef)).data() || {}
    if (latest.seat_summary_initialized) return
    const tier = String(latest.tier || 'silver').toLowerCase()
    let overageCents = 0
    for (let seat = 2; seat <= summary.user_count; seat += 1) {
      overageCents += Math.min(seatPriceCents(tier, seat), Math.max(0, CYLINDER_MONTHLY_CAP_CENTS - tierBaseCents(tier) - overageCents))
    }
    tx.set(billingRef, { seat_summary_initialized: true, seat_count: summary.user_count, seat_overage_cents: overageCents, updated_at: FieldValue.serverTimestamp() }, { merge: true })
  })
  return (await billingRef.get()).data() || current
}
function tierFromEvent(event) {
  return String(event.data.object.metadata?.tier || event.data.object.subscription_details?.metadata?.tier || event.data.object.parent?.subscription_details?.metadata?.tier || '').toLowerCase()
}
function workspaceFromEvent(event) {
  return String(event.data.object.metadata?.workspaceId || event.data.object.subscription_details?.metadata?.workspaceId || event.data.object.parent?.subscription_details?.metadata?.workspaceId || '')
}
function subscriptionMetadataFromEvent(event) {
  const object = event.data.object
  return [object.metadata, object.subscription_details?.metadata, object.parent?.subscription_details?.metadata]
    .find(metadata => metadata?.seatCount !== undefined || metadata?.seatOverageCents !== undefined)
    || object.metadata || object.subscription_details?.metadata || object.parent?.subscription_details?.metadata || {}
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
  // Extend legacy free trials from their original start, never restart a trial.
  if (billingData?.billing_provider === 'overhead_free_trial' && ['trialing', 'trial_expired'].includes(billingData.status)) {
    const billing = getFirestore().doc(`workspaces/${workspaceId}/billing/current`)
    billingData = await getFirestore().runTransaction(async tx => {
      const stored = (await tx.get(billing)).data() || {}
      const start = stored.trial_started_at?.toDate?.()
      const end = stored.trial_ends_at?.toDate?.()
      if (stored.billing_provider !== 'overhead_free_trial' || !['trialing', 'trial_expired'].includes(stored.status) || !start || !end) return stored
      const extended = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000)
      if (end.getTime() >= extended.getTime()) return stored
      const status = extended.getTime() > Date.now() ? 'trialing' : 'trial_expired'
      tx.set(billing, { trial_ends_at: extended, status, trial_duration_days: 90, updated_at: FieldValue.serverTimestamp() }, { merge: true })
      return { ...stored, trial_ends_at: { toDate: () => extended }, status }
    })
    await syncWorkspaceLicenses(workspaceId)
  }
  const endsAt = billingData?.trial_ends_at?.toDate?.() || null
  if (billingData?.status !== 'trialing' || !endsAt || endsAt.getTime() > Date.now()) return billingData
  const billing = getFirestore().doc(`workspaces/${workspaceId}/billing/current`)
  const current = await getFirestore().runTransaction(async tx => {
    const stored = (await tx.get(billing)).data() || {}
    const end = stored.trial_ends_at?.toDate?.()
    if (stored.status !== 'trialing' || !end || end.getTime() > Date.now()) return stored
    tx.set(billing, { status: 'trial_expired', trial_expired_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(), last_event: 'trial.expired' }, { merge: true })
    return { ...stored, status: 'trial_expired' }
  })
  await syncWorkspaceLicenses(workspaceId)
  return current
}
async function syncWorkspaceLicenses(workspaceId) {
  if (!workspaceId) return
  const db = getFirestore()
  await db.runTransaction(async batch => {
  const billing = (await batch.get(db.doc(`workspaces/${workspaceId}/billing/current`))).data() || {}
  const tier = billing.tier, subscriptionId = billing.stripe_subscription_id || ''
  if (!['silver', 'gold', 'black'].includes(tier)) return
  const status = billing.status === 'active' ? 'Active' : billing.status === 'trialing' ? 'Trial' : billing.status === 'past_due' ? 'Past due' : 'Suspended'
  const people = await batch.get(db.collection('profiles').where('workspace_id', '==', workspaceId))
  if (people.size > 450) throw new Error('Workspace exceeds the atomic license update limit.')
  people.forEach((person) => {
    const ref = db.doc(`workspaces/${workspaceId}/licenses/${person.id}`)
    batch.set(ref, {
      workspace_id: workspaceId,
      user_uid: person.id,
      email: person.data().email || '',
      holder_name: person.data().owner_name || person.data().email || '',
      tier,
      status: person.data().status === 'Active' ? status : 'Suspended',
      subscription_id: subscriptionId || '',
      subscription_number: `OH-SUB-${crypto.createHash('sha256').update(`${workspaceId}:${subscriptionId || tier}`).digest('hex').slice(0, 12).toUpperCase()}`,
      license_number: `OH-LIC-${crypto.createHash('sha256').update(`${workspaceId}:${person.id}`).digest('hex').slice(0, 12).toUpperCase()}`,
      updated_at: FieldValue.serverTimestamp(),
      issued_at: FieldValue.serverTimestamp(),
    }, { merge: true })
  })
  })
}
async function applyStripeEvent(event) {
  const supported = ['checkout.session.completed', 'invoice.paid', 'invoice.payment_failed', 'customer.subscription.updated', 'customer.subscription.deleted']
  if (!supported.includes(event.type)) return
  const workspaceId = workspaceFromEvent(event), tier = tierFromEvent(event)
  if (!workspaceId || workspaceId.includes('/') || !['silver', 'gold', 'black'].includes(tier)) return
  const object = event.data.object
  const subscriptionMetadata = subscriptionMetadataFromEvent(event)
  const eventSeatCount = Number(subscriptionMetadata.seatCount)
  const eventSeatOverageCents = Number(subscriptionMetadata.seatOverageCents)
  const subscriptionId = String(object.subscription?.id || object.subscription || object.parent?.subscription_details?.subscription || (event.type.startsWith('customer.subscription.') ? object.id : '') || '')
  if (!subscriptionId.startsWith('sub_')) return
  // A subscription update is not proof of payment: retain Stripe's actual status.
  const status = event.type === 'customer.subscription.deleted' ? 'canceled'
    : event.type === 'customer.subscription.updated' ? String(object.status || 'incomplete')
    : event.type === 'invoice.payment_failed' ? 'past_due'
    : event.type === 'checkout.session.completed' && object.payment_status === 'no_payment_required' ? 'trialing'
    : event.type === 'invoice.paid' || ['paid', 'no_payment_required'].includes(object.payment_status) ? 'active' : 'pending'
  const licenseStatus = status === 'active' ? 'Active' : status === 'trialing' ? 'Trial' : status === 'past_due' ? 'Past due' : 'Suspended'
  const db = getFirestore()
  const seen = db.doc(`stripe_events/${event.id}`)
  await db.runTransaction(async (tx) => {
    if ((await tx.get(seen)).exists) return
    const billing = db.doc(`workspaces/${workspaceId}/billing/current`)
    const current = (await tx.get(billing)).data() || {}
    if ((current.stripe_event_created || 0) > event.created || (current.stripe_subscription_id === subscriptionId && current.status === 'canceled' && status !== 'canceled')) {
      tx.create(seen, { type: event.type, ignored: true, received_at: FieldValue.serverTimestamp() })
      return
    }
    const people = await tx.get(db.collection('profiles').where('workspace_id', '==', workspaceId))
    if (people.size > 450) throw new Error('Workspace exceeds the atomic license update limit.')
    tx.create(seen, { type: event.type, received_at: FieldValue.serverTimestamp() })
    tx.set(billing, {
      workspace_id: workspaceId,
      tier,
      status,
      stripe_event_created: event.created,
      stripe_customer_id: String(object.customer?.id || object.customer || current.stripe_customer_id || ''),
      stripe_subscription_id: subscriptionId,
      last_event: event.type,
      first_paid_month_free_used: event.type === 'checkout.session.completed' && current.pending_first_month_free === true
        ? true : current.first_paid_month_free_used === true,
      ...(event.type === 'checkout.session.completed' && Number.isInteger(eventSeatCount) && eventSeatCount >= 1 && Number.isFinite(eventSeatOverageCents) && eventSeatOverageCents >= 0
        ? { seat_count: eventSeatCount, seat_overage_cents: eventSeatOverageCents, seat_summary_initialized: true }
        : {}),
      ...(event.type === 'checkout.session.completed' || event.type.startsWith('invoice.') || event.type === 'customer.subscription.deleted'
        ? { checkout_pending: false, pending_first_month_free: FieldValue.delete(), pending_tier: FieldValue.delete(), pending_checkout_started_at: FieldValue.delete() }
        : {}),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true })
    people.forEach(person => {
      const profile = person.data()
      tx.set(db.doc(`workspaces/${workspaceId}/licenses/${person.id}`), {
        workspace_id: workspaceId, user_uid: person.id, email: profile.email || '',
        holder_name: profile.owner_name || profile.email || '', tier,
        status: profile.status === 'Active' ? licenseStatus : 'Suspended',
        subscription_id: subscriptionId,
        subscription_number: `OH-SUB-${crypto.createHash('sha256').update(`${workspaceId}:${subscriptionId}`).digest('hex').slice(0,12).toUpperCase()}`,
        license_number: `OH-LIC-${crypto.createHash('sha256').update(`${workspaceId}:${person.id}`).digest('hex').slice(0,12).toUpperCase()}`,
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true })
    })
  })
}

// The desktop app and the Firebase-hosted browser workspace use this one
// service. Keep the allow-list narrow: credentials and payment actions must
// never be callable from an arbitrary website.
async function handleBillingRequest(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' })
  if (req.path === '/webhook') {
    let event
    try {
      const stripe = new Stripe(stripeSecretKey.value())
      event = stripe.webhooks.constructEvent(req.rawBody, req.get('stripe-signature'), stripeWebhookSecret.value())
    } catch { return json(res, 400, { error: 'Invalid webhook signature.' }) }
    try {
      await applyStripeEvent(event)
      return json(res, 200, { received: true })
    } catch (error) { console.error('Billing webhook processing failed', event.id, error.message); return json(res, 500, { error: 'Webhook processing failed. Retry delivery.' }) }
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
    if (body.action === 'start_free_gold_trial') {
      if (body.acceptTrialPolicy !== true) return json(res, 400, { error: 'Acknowledge the Free Trial Policy before starting a trial.' })
      const startsAt = new Date()
      const endsAt = new Date(startsAt.getTime() + 90 * 24 * 60 * 60 * 1000)
      await db.runTransaction(async tx => {
        const current = (await tx.get(billing)).data() || {}
        if (current.trial_used) throw new Error('This workspace has already used its one free trial.')
        if (['active', 'trialing'].includes(current.status) || current.checkout_pending || current.cancellation_pending) throw new Error('This workspace already has plan access or a billing operation in progress.')
        tx.set(billing, {
        workspace_id: profile.workspace_id,
        tier: 'gold',
        status: 'trialing',
        billing_provider: 'overhead_free_trial',
        trial_used: true,
        trial_duration_days: 90,
        trial_policy_accepted_at: FieldValue.serverTimestamp(),
        trial_started_at: startsAt,
        trial_ends_at: endsAt,
        checkout_pending: false,
        last_event: 'trial.started',
        updated_at: FieldValue.serverTimestamp(),
        }, { merge: true })
      })
      await syncWorkspaceLicenses(profile.workspace_id, 'gold', 'Trial', '')
      return json(res, 200, { trialStarted: true, tier: 'gold', status: 'trialing', trialEndsAt: endsAt.toISOString(), message: 'Your free 90-day Gold trial is active. No card was charged.' })
    }
    const stripe = new Stripe(stripeSecretKey.value())
    if (body.action === 'create_invite' || body.action === 'reserve_local_seat') {
      const result = await createWorkspaceInvite(db, stripe, profile.workspace_id, user.uid, profile.business_name, { ...body, localOnly: body.action === 'reserve_local_seat' })
      return json(res, 200, result)
    }
    if (body.action === 'update_local_seat') {
      return json(res, 200, await updateLocalSeat(db, stripe, profile.workspace_id, body))
    }
    if (body.action === 'checkout') {
      const tier = String(body.tier || '').toLowerCase()
      if (!prices[tier]) return json(res, 400, { error: 'Choose Silver, Gold, or Black.' })
      if (body.acceptBillingPolicy !== true) return json(res, 400, { error: 'Acknowledge the Subscription Billing & Authorization Policy before checkout.' })
      const attempt = crypto.randomUUID()
      const seatSummary = await ensureSeatSummary(profile.workspace_id, db, billing)
      // Reprice the existing seat count against the selected tier. Stored seat
      // charges may have been created under an older tier's price schedule.
      let scheduledSeatOverageCents = 0
      for (let seat = 2; seat <= Math.max(1, Number(seatSummary.seat_count || 1)); seat += 1) {
        scheduledSeatOverageCents += seatPriceCents(tier, seat)
      }
      const seatOverageCents = Math.max(0, Math.min(CYLINDER_MONTHLY_CAP_CENTS - tierBaseCents(tier), scheduledSeatOverageCents))
      const current = await db.runTransaction(async tx => {
        const stored = (await tx.get(billing)).data() || {}
        if (stored.status === 'active' && stored.tier === tier) return stored
        if (stored.status === 'trialing' && stored.billing_provider === 'overhead_free_trial') throw new Error('Finish the active 90-day Gold trial before starting paid billing. The free first month does not stack with that trial.')
        if (stored.cancellation_pending || (stored.stripe_subscription_id && stored.status !== 'canceled')) throw new Error('Manage the existing subscription in the billing portal before starting another plan.')
        if (stored.seat_update_pending_id) throw new Error('A user seat is being added. Wait for that update before starting checkout.')
        const pendingAt = stored.pending_checkout_started_at?.toDate?.()
        if (stored.checkout_pending && (!pendingAt || Date.now() - pendingAt.getTime() < 31 * 60 * 1000)) throw new Error('A checkout is already open. Finish it or wait for it to expire.')
        tx.set(billing, { checkout_pending: true, pending_attempt: attempt, pending_tier: tier, pending_first_month_free: stored.trial_used !== true && stored.first_paid_month_free_used !== true, pending_checkout_started_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp() }, { merge: true })
        return stored
      })
      if (current.status === 'active' && current.tier === tier) return json(res, 200, { alreadySubscribed: true, entitlement: current, message: 'This plan is already active. No additional charge was created.' })
      let session
      try {
        const lines = [{ price: prices[tier].value(), quantity: 1 }]
        if (seatOverageCents > 0) {
          const product = await seatProduct(stripe, profile.workspace_id, billing, { ...current, workspace_id: profile.workspace_id })
          const seatPrice = await stripe.prices.create({ product, currency: 'usd', unit_amount: seatOverageCents, recurring: { interval: 'month' }, metadata: { overhead_kind: 'desktop_seat_overage', workspace_id: profile.workspace_id } }, { idempotencyKey: `overhead-seat-checkout-price-${profile.workspace_id}-${tier}-${seatSummary.seat_count}-${seatOverageCents}` })
          lines.push({ price: seatPrice.id, quantity: 1 })
        }
        session = await stripe.checkout.sessions.create({
        mode: 'subscription', ui_mode: 'embedded', line_items: lines,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        customer: current.stripe_customer_id || undefined, customer_email: current.stripe_customer_id ? undefined : user.email,
        client_reference_id: profile.workspace_id,
        metadata: { workspaceId: profile.workspace_id, ownerUid: user.uid, tier, seatCount: String(seatSummary.seat_count || 1), seatOverageCents: String(seatOverageCents) },
        subscription_data: { ...(current.trial_used !== true && current.first_paid_month_free_used !== true ? { trial_period_days: 30 } : {}), metadata: { workspaceId: profile.workspace_id, ownerUid: user.uid, tier, seatCount: String(seatSummary.seat_count || 1), seatOverageCents: String(seatOverageCents) } },
        return_url: `${billingReturnUrl.value()}?session_id={CHECKOUT_SESSION_ID}`,
        }, { idempotencyKey: `overhead-checkout-${profile.workspace_id}-${attempt}` })
      } catch (error) {
        // Leave ambiguous network failures locked until expiry: a session may exist.
        if (error.type && ['StripeInvalidRequestError', 'StripeAuthenticationError', 'StripePermissionError'].includes(error.type)) await db.runTransaction(async tx => {
          const stored = (await tx.get(billing)).data() || {}
          if (stored.pending_attempt === attempt) tx.set(billing, { checkout_pending: false, pending_attempt: FieldValue.delete() }, { merge: true })
        })
        throw error
      }
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
      if (current.status === 'canceled' && !current.refund_retry_required) return json(res, 409, { error: 'This subscription is already canceled.' })
      await db.runTransaction(async tx => {
        const stored = (await tx.get(billing)).data() || {}
        if (stored.cancellation_pending || stored.stripe_subscription_id !== current.stripe_subscription_id) throw new Error('Billing changed or cancellation is already running. Refresh before retrying.')
        if (stored.status === 'canceled' && !stored.refund_retry_required) throw new Error('This subscription is already canceled.')
        tx.set(billing, { cancellation_pending: true, cancellation_requested_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp() }, { merge: true })
      })
      try {
        const subscription = await stripe.subscriptions.retrieve(current.stripe_subscription_id, { expand: ['latest_invoice.payment_intent'] })
        if (!['active', 'trialing'].includes(subscription.status) && !(subscription.status === 'canceled' && current.refund_plan)) throw new Error(`This subscription cannot be canceled automatically while its Stripe status is ${subscription.status}.`)
        const latestInvoice = subscription.latest_invoice && typeof subscription.latest_invoice === 'object' ? subscription.latest_invoice : null
        const paymentIntent = latestInvoice?.payment_intent && typeof latestInvoice.payment_intent === 'object' ? latestInvoice.payment_intent : null
        const refundPlan = current.refund_plan || { amount: latestInvoice && paymentIntent ? unusedRefundAmount(latestInvoice, paymentIntent, subscription) : 0, payment_intent: paymentIntent?.id || '', currency: latestInvoice?.currency || 'usd' }
        // Persist the original amount before either external side effect. A retry
        // reuses the same refund parameters and Stripe idempotency key.
        await billing.set({ refund_plan: refundPlan, refund_retry_required: true }, { merge: true })
        const refundAmount = refundPlan.amount
        const canceled = subscription.status === 'canceled' ? subscription : await stripe.subscriptions.cancel(subscription.id, { prorate: false, invoice_now: false })
        await billing.set({ status: 'canceled', canceled_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp() }, { merge: true })
        await syncWorkspaceLicenses(profile.workspace_id)
        let refund = null
        if (refundAmount > 0 && refundPlan.payment_intent) {
          refund = await stripe.refunds.create({
            payment_intent: refundPlan.payment_intent,
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
          refund_retry_required: false,
          canceled_at: FieldValue.serverTimestamp(),
          unused_time_refund_status: refund ? refund.status : 'not_applicable',
          unused_time_refund_id: refund?.id || '',
          unused_time_refund_amount: refund?.amount || 0,
          unused_time_refund_currency: refund?.currency || refundPlan.currency,
          unused_time_refund_period_start: period.start || 0,
          unused_time_refund_period_end: period.end || 0,
          last_event: 'subscription.canceled_with_unused_time_refund',
          updated_at: FieldValue.serverTimestamp(),
        }, { merge: true })
        await syncWorkspaceLicenses(profile.workspace_id, current.tier || tierFromEvent({ data: { object: subscription } }) || 'silver', 'Suspended', subscription.id)
        return json(res, 200, {
          canceled: true,
          refundAmount: refund?.amount || 0,
          currency: refund?.currency || refundPlan.currency,
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
}

const accountCors = ['https://overhead-office.web.app', 'https://overhead-office.firebaseapp.com']
exports.billingApi = onRequest({ region: 'us-central1', secrets: [stripeSecretKey, stripeWebhookSecret], cors: accountCors }, handleBillingRequest)
// No payment secrets are needed to start a no-card trial or read its status.
exports.trialApi = onRequest({ region: 'us-central1', cors: accountCors }, (req, res) => {
  if (req.path === '/webhook' || !['start_free_gold_trial', 'entitlements', 'billing_activity'].includes(req.body?.action)) return json(res, 400, { error: 'Unknown trial action.' })
  return handleBillingRequest(req, res)
})

exports.expireTrials = onSchedule({ region: 'us-central1', schedule: 'every 1 hours', timeZone: 'Etc/UTC' }, async () => {
  const db = getFirestore()
  const workspaces = await db.collection('workspaces').listDocuments()
  for (const workspace of workspaces) {
    const billing = (await workspace.collection('billing').doc('current').get()).data()
    await expireTrialIfNeeded(workspace.id, billing)
  }
})
