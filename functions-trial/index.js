const { onRequest } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const crypto = require('node:crypto')

initializeApp()

const region = 'us-central1'
const cors = ['https://overhead-office.web.app', 'https://overhead-office.firebaseapp.com']
const DUPLICATE_CHECK_WINDOW_MS = 15 * 60 * 1000
const DUPLICATE_CHECK_LIMIT = 12
const json = (res, status, body) => res.status(status).json(body)

function requestError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

async function verifyOwner(req) {
  const idToken = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!idToken) throw requestError(401, 'Sign in is required to manage a workspace trial.')
  const user = await getAuth().verifyIdToken(idToken)
  if (user.email_verified !== true) throw requestError(403, 'Verify your email before managing a workspace trial.')

  const profile = (await getFirestore().doc(`profiles/${user.uid}`).get()).data()
  if (!profile || profile.status !== 'Active' || profile.role !== 'Administrator' ||
      typeof profile.workspace_id !== 'string' || !profile.workspace_id || profile.workspace_id.includes('/')) {
    throw requestError(403, 'Only an active workspace administrator can manage a trial.')
  }
  return { user, profile }
}

function asIso(value) {
  return value?.toDate?.().toISOString?.() || ''
}

function licenseIds(workspaceID, userID) {
  const subscription = crypto.createHash('sha256').update(`${workspaceID}:gold`).digest('hex').slice(0, 12).toUpperCase()
  const license = crypto.createHash('sha256').update(`${workspaceID}:${userID}`).digest('hex').slice(0, 12).toUpperCase()
  return { subscriptionNumber: `OH-SUB-${subscription}`, licenseNumber: `OH-LIC-${license}` }
}

async function refreshWorkspaceLicenses(tx, db, workspaceID, status) {
  const people = await tx.get(db.collection('profiles').where('workspace_id', '==', workspaceID))
  if (people.size > 450) throw requestError(409, 'Workspace exceeds the atomic license update limit.')
  for (const person of people.docs) {
    const profile = person.data()
    const ids = licenseIds(workspaceID, person.id)
    tx.set(db.doc(`workspaces/${workspaceID}/licenses/${person.id}`), {
      workspace_id: workspaceID,
      user_uid: person.id,
      email: profile.email || '',
      holder_name: profile.owner_name || profile.email || '',
      tier: 'gold',
      status: profile.status === 'Active' ? status : 'Suspended',
      subscription_id: '',
      subscription_number: ids.subscriptionNumber,
      license_number: ids.licenseNumber,
      updated_at: FieldValue.serverTimestamp(),
      issued_at: FieldValue.serverTimestamp(),
    }, { merge: true })
  }
}

async function expireTrialIfNeeded(db, workspaceID, current) {
  const end = current.trial_ends_at?.toDate?.()
  if (current.status !== 'trialing' || !end || end.getTime() > Date.now()) return current

  const billing = db.doc(`workspaces/${workspaceID}/billing/current`)
  return db.runTransaction(async tx => {
    const stored = (await tx.get(billing)).data() || {}
    const storedEnd = stored.trial_ends_at?.toDate?.()
    if (stored.status !== 'trialing' || !storedEnd || storedEnd.getTime() > Date.now()) return stored
    const people = await tx.get(db.collection('profiles').where('workspace_id', '==', workspaceID))
    if (people.size > 450) throw requestError(409, 'Workspace exceeds the atomic license update limit.')
    tx.set(billing, {
      status: 'trial_expired',
      trial_expired_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      last_event: 'trial.expired',
    }, { merge: true })
    for (const person of people.docs) {
      const profile = person.data()
      const ids = licenseIds(workspaceID, person.id)
      tx.set(db.doc(`workspaces/${workspaceID}/licenses/${person.id}`), {
        workspace_id: workspaceID,
        user_uid: person.id,
        email: profile.email || '',
        holder_name: profile.owner_name || profile.email || '',
        tier: 'gold',
        status: 'Suspended',
        subscription_id: '',
        subscription_number: ids.subscriptionNumber,
        license_number: ids.licenseNumber,
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true })
    }
    return { ...stored, status: 'trial_expired' }
  })
}

const trialApiHandler = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' })
  try {
    const { user, profile } = await verifyOwner(req)
    const db = getFirestore()
    const workspaceID = profile.workspace_id
    const billing = db.doc(`workspaces/${workspaceID}/billing/current`)
    const action = req.body?.action

    if (action === 'start_free_gold_trial') {
      if (req.body?.acceptTrialPolicy !== true) {
        return json(res, 400, { error: 'Review and accept the Free Trial Policy before starting a trial.' })
      }
      const startsAt = new Date()
      const endsAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000)
      await db.runTransaction(async tx => {
        const current = (await tx.get(billing)).data() || {}
        if (current.trial_used) throw requestError(409, 'This workspace has already used its one free trial.')
        if (['active', 'trialing'].includes(current.status) || current.checkout_pending || current.cancellation_pending) {
          throw requestError(409, 'This workspace already has plan access or a billing operation in progress.')
        }
        const people = await tx.get(db.collection('profiles').where('workspace_id', '==', workspaceID))
        if (people.size > 450) throw requestError(409, 'Workspace exceeds the atomic license update limit.')
        await refreshWorkspaceLicenses(tx, db, workspaceID, 'Trial')
        tx.set(billing, {
          workspace_id: workspaceID,
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
      })
      return json(res, 200, {
        trialStarted: true,
        tier: 'gold',
        status: 'trialing',
        trialEndsAt: endsAt.toISOString(),
        message: 'Your free 30-day Gold trial is active. No card was charged.',
      })
    }

    if (action === 'entitlements') {
      let entitlement = (await billing.get()).data() || { tier: 'silver', status: 'inactive' }
      entitlement = await expireTrialIfNeeded(db, workspaceID, entitlement)
      const license = entitlement.tier
        ? (await db.doc(`workspaces/${workspaceID}/licenses/${user.uid}`).get()).data() || null
        : null
      return json(res, 200, {
        entitlement: { ...entitlement, trial_ends_at: asIso(entitlement.trial_ends_at) },
        license,
      })
    }

    if (action === 'billing_activity') {
      let current = (await billing.get()).data() || {}
      current = await expireTrialIfNeeded(db, workspaceID, current)
      const events = [
        { label: 'Free Gold trial started', at: asIso(current.trial_started_at), detail: 'No card charged' },
        { label: 'Free Gold trial ends', at: asIso(current.trial_ends_at), detail: current.status === 'trial_expired' ? 'Expired' : 'Scheduled' },
      ].filter(event => event.at)
      return json(res, 200, { events, currentStatus: current.status || 'inactive', tier: current.tier || 'silver' })
    }

    if (action === 'cancel_with_unused_time_refund') {
      const canceledAt = new Date()
      await db.runTransaction(async tx => {
        const current = (await tx.get(billing)).data() || {}
        if (current.stripe_subscription_id) {
          throw requestError(503, 'Paid cancellation is unavailable. No subscription or refund was changed.')
        }
        if (current.status !== 'trialing') throw requestError(409, 'No active free trial was found for this workspace.')
        await refreshWorkspaceLicenses(tx, db, workspaceID, 'Suspended')
        tx.set(billing, {
          status: 'canceled',
          cancellation_pending: false,
          canceled_at: canceledAt,
          last_event: 'trial.canceled',
          updated_at: FieldValue.serverTimestamp(),
        }, { merge: true })
      })
      return json(res, 200, {
        canceled: true,
        refundAmount: 0,
        currency: 'usd',
        refundStatus: 'not_applicable',
        message: 'Your free trial was canceled. No payment was collected, so no refund was needed.',
      })
    }

    if (action === 'checkout' || action === 'portal') {
      throw requestError(503, 'Paid billing is not enabled. No payment was started.')
    }

    return json(res, 400, { error: 'Unknown trial action.' })
  } catch (error) {
    return json(res, error.statusCode || 403, { error: error.message || 'Trial request denied.' })
  }
}

function businessTokens(value) {
  const ignored = new Set(['and', 'the', 'llc', 'inc', 'incorporated', 'company', 'co', 'limited', 'ltd', 'corp', 'corporation'])
  return new Set(String(value || '').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(token => token.length > 1 && !ignored.has(token)))
}

function similarity(left, right) {
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared += 1
  return shared / new Set([...left, ...right]).size
}

const duplicateCheckHandler = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' })
  try {
    const origin = String(req.get('origin') || '')
    if (origin && !cors.includes(origin)) throw requestError(403, 'This app is not allowed to check workspace availability.')
    const businessName = String(req.body?.businessName || '').trim().slice(0, 160)
    const ownerName = String(req.body?.ownerName || '').trim().slice(0, 120)
    if (businessName.length < 2) throw requestError(400, 'Enter a business name before checking for existing workspaces.')
    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown')
    const ipHash = crypto.createHash('sha256').update(`overhead-duplicate-check:${ip}`).digest('hex')
    const db = getFirestore()
    const limiter = db.doc(`publicRateLimits/workspaceDuplicate_${ipHash}`)
    const now = Date.now()
    await db.runTransaction(async tx => {
      const record = (await tx.get(limiter)).data() || {}
      const start = Number(record.window_started_at || 0)
      const count = start > now - DUPLICATE_CHECK_WINDOW_MS ? Number(record.count || 0) : 0
      if (count >= DUPLICATE_CHECK_LIMIT) throw requestError(429, 'Too many workspace checks were made. Wait 15 minutes and try again.')
      tx.set(limiter, {
        window_started_at: count ? start : now,
        count: count + 1,
        expires_at: new Date(now + DUPLICATE_CHECK_WINDOW_MS),
      }, { merge: true })
    })

    const businessKey = businessTokens(businessName)
    const ownerKey = businessTokens(ownerName)
    let cursor = null
    let scanned = 0
    let possibleDuplicate = false
    while (scanned < 10000) {
      let query = db.collection('profiles').select('business_name', 'owner_name').orderBy('__name__').limit(500)
      if (cursor) query = query.startAfter(cursor)
      const page = await query.get()
      if (page.empty) break
      for (const profile of page.docs) {
        const data = profile.data()
        const existingBusiness = businessTokens(data.business_name)
        const businessSimilarity = similarity(businessKey, existingBusiness)
        const ownerSimilarity = ownerKey.size > 0 ? similarity(ownerKey, businessTokens(data.owner_name)) : 0
        const businessMatch = businessSimilarity >= 0.65 || (businessSimilarity >= 0.4 && ownerSimilarity >= 0.75)
        if (businessMatch) {
          possibleDuplicate = true
          break
        }
      }
      scanned += page.size
      cursor = page.docs[page.docs.length - 1]
      if (possibleDuplicate || page.size < 500) break
    }
    if (scanned >= 10000 && !possibleDuplicate) throw requestError(503, 'Workspace duplicate checking could not finish. Try again later.')
    return json(res, 200, { possibleDuplicate })
  } catch (error) {
    return json(res, error.statusCode || 503, { error: error.message || 'Workspace duplicate checking failed.' })
  }
}

exports.overheadTrialApi = onRequest({ region, cors, maxInstances: 5 }, trialApiHandler)
// Keep the current Windows desktop binary's endpoint working for free trials,
// entitlement reads, and trial cancellation. Paid actions return HTTP 503.
exports.billingApi = onRequest({ region, cors, maxInstances: 5 }, trialApiHandler)
exports.checkWorkspaceDuplicate = onRequest({ region, cors, maxInstances: 5 }, duplicateCheckHandler)
