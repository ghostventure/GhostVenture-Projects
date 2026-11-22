const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore')
const crypto = require('crypto')

initializeApp()

const staffDomains = ['@overheadteam.com']
function normalizedStaffEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !staffDomains.some((domain) => email.endsWith(domain))) {
    throw new HttpsError('invalid-argument', 'Use an OverHead team email address ending in @overheadteam.com.')
  }
  return email
}
function staffInviteDigest(value) {
  const code = String(value || '').trim()
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(code)) throw new HttpsError('invalid-argument', 'Enter the invitation code from your OverHead email.')
  return crypto.createHash('sha256').update(code).digest('hex')
}

exports.checkStaffInvite = onCall({ region: 'us-central1', cors: true, enforceAppCheck: false }, async (request) => {
  const email = normalizedStaffEmail(request.data?.email)
  const digest = staffInviteDigest(request.data?.code)
  const snapshot = await getFirestore().doc(`overhead_staff_invites/${digest}`).get()
  const invite = snapshot.data()
  if (!snapshot.exists || invite.email !== email || invite.status !== 'pending' || !invite.expires_at || invite.expires_at.toMillis() <= Date.now()) {
    throw new HttpsError('not-found', 'That invitation is invalid or expired. Ask your OverHead administrator to send another.')
  }
  return { valid: true, email }
})

exports.acceptStaffInvite = onCall({ region: 'us-central1', cors: true, enforceAppCheck: false }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Create your account from the OverHead invitation screen first.')
  const email = String(request.auth.token.email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('permission-denied', 'Use a valid personal email address for your account.')
  const staffAlias = normalizedStaffEmail(request.data?.alias)
  const digest = staffInviteDigest(request.data?.code)
  const db = getFirestore()
  const inviteRef = db.doc(`overhead_staff_invites/${digest}`)
  const user = await getAuth().getUser(request.auth.uid)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(inviteRef)
    const invite = snapshot.data()
    const sameAcceptedUser = invite?.status === 'accepted' && invite.accepted_uid === request.auth.uid
    if (!snapshot.exists || invite.email !== staffAlias || (!sameAcceptedUser && (invite.status !== 'pending' || !invite.expires_at || invite.expires_at.toMillis() <= Date.now()))) {
      throw new HttpsError('not-found', 'That invitation is invalid, expired, or already used. Ask your OverHead administrator to send another.')
    }
    if (!sameAcceptedUser) transaction.update(inviteRef, { status: 'accepted', accepted_uid: request.auth.uid, accepted_at: FieldValue.serverTimestamp() })
  })
  await getAuth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), overhead_staff: true, overhead_staff_alias: staffAlias })
  await db.doc(`profiles/${user.uid}`).set({
    uid: user.uid,
    owner_name: String(request.data?.name || user.displayName || email.split('@')[0]).trim().slice(0, 100),
    business_name: 'OverHead Staff',
    email,
    staff_email_alias: staffAlias,
    workspace_id: 'overhead-staff',
    role: 'Staff',
    status: 'Active',
    email_verified: request.auth.token.email_verified === true,
    terms_accepted_at: FieldValue.serverTimestamp(),
    last_sign_in: FieldValue.serverTimestamp(),
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true })
  await db.collection('overhead_staff_audit').add({
    actor_uid: request.auth.uid,
    actor_email: email,
    action: 'staff.invitation_accepted',
    workspace_id: '',
    target: staffAlias,
    reason: 'OverHead staff account activated through an invitation.',
    changed_fields: ['overhead_staff'],
    created_at: FieldValue.serverTimestamp(),
  })
  return { accepted: true, email }
})

const staffFeatureCatalog = {
  customers: 'Customer management',
  tasks: 'Tasks and work queues',
  backups: 'Backups',
  support_bundle: 'Support bundles',
  workflow_jobs: 'Workflow automation',
  legal_acknowledgements: 'Legal acknowledgements',
  roles: 'Team roles',
  data_export: 'Data export',
  restore_validation: 'Restore validation',
  fraud_detection: 'Fraud detection',
  stripe: 'Stripe billing tools',
  server_deployment: 'Cylinder server deployment',
}

const staffEditableFields = {
  profiles: new Set([
    'owner_name', 'business_name', 'role', 'status', 'access_level', 'primary_workflow',
    'workflow_load_limit', 'approval_threshold', 'data_scope', 'customer_visibility',
    'risk_status', 'risk_notes', 'onboarding_stage', 'deactivation_reason',
  ]),
  customers: new Set(['name', 'phone', 'business_name', 'owner_name', 'email', 'website', 'industry', 'timezone', 'status', 'service_area', 'preferred_contact']),
  tasks: new Set(['title', 'done']),
  approvals: new Set(['status', 'decision_note']),
  support_tickets: new Set(['subject', 'priority', 'status', 'details', 'assigned_to']),
}

const staffReadCollections = ['customers', 'tasks', 'approvals', 'support_tickets', 'audit_events', 'licenses', 'invites', 'feature_flags', 'staff_feature_overrides']

function staffPlainValue(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(staffPlainValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, staffPlainValue(nested)]))
  }
  return value
}

function staffRedactSecrets(value) {
  if (Array.isArray(value)) return value.map(staffRedactSecrets)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
      key,
      /password|secret|credential|private.?key|api.?key|access.?token|refresh.?token|id.?token|auth.?token|cookie|verification.?code|recovery.?code|stripe.*_id|checkout.*session.*id/i.test(key)
        ? '[redacted]'
        : staffRedactSecrets(nested),
    ]))
  }
  return value
}

function staffRequireAccess(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in with an OverHead Staff account.')
  if (request.auth.token.email_verified !== true) throw new HttpsError('permission-denied', 'Verify your staff email before opening this portal.')
  const email = String(request.auth.token.email || '').trim().toLowerCase()
  const officialEmail = staffDomains.some((domain) => email.endsWith(domain) && email.length > domain.length)
  const staffAlias = String(request.auth.token.overhead_staff_alias || '').trim().toLowerCase()
  const hasStaffAlias = staffDomains.some((domain) => staffAlias.endsWith(domain) && staffAlias.length > domain.length)
  if (request.auth.token.overhead_staff !== true || (!officialEmail && !hasStaffAlias)) throw new HttpsError('permission-denied', 'This account is not authorized for the OverHead Staff portal.')
}

function staffReason(value) {
  const reason = String(value || '').trim()
  if (reason.length < 10 || reason.length > 500) throw new HttpsError('invalid-argument', 'Enter a support reason between 10 and 500 characters.')
  return reason
}

function staffJsonValue(value) {
  let encoded
  try { encoded = JSON.stringify(value) } catch { throw new HttpsError('invalid-argument', 'The edited value must be valid JSON data.') }
  if (encoded === undefined || encoded.length > 12000) throw new HttpsError('invalid-argument', 'Each edited field must be serializable and smaller than 12 KB.')
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of Object.keys(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new HttpsError('invalid-argument', 'That field name is not allowed.')
    }
  }
  return JSON.parse(encoded)
}

async function staffWorkspaceSearch(query) {
  const db = getFirestore()
  const term = String(query || '').trim()
  if (term.length < 2 || term.length > 180) throw new HttpsError('invalid-argument', 'Search using a workspace ID, email, or at least two characters of a business or owner name.')

  const profileQuery = db.collection('profiles')
  const lookups = [profileQuery.where('email', '==', term.toLowerCase()).limit(20)]
  const prefix = term.includes('@') ? term.toLowerCase() : term
  const upper = `${prefix}\uf8ff`
  lookups.push(profileQuery.where('email', '>=', prefix).where('email', '<=', upper).limit(20))
  if (!term.includes('@')) {
    lookups.push(profileQuery.where('business_name', '>=', term).where('business_name', '<=', `${term}\uf8ff`).limit(20))
    lookups.push(profileQuery.where('owner_name', '>=', term).where('owner_name', '<=', `${term}\uf8ff`).limit(20))
  }
  const workspaceIdLookup = /^[A-Za-z0-9_-]{4,128}$/.test(term) ? db.doc(`workspaces/${term}`).get() : Promise.resolve(null)
  const [workspaceDoc, ...snapshots] = await Promise.all([
    workspaceIdLookup,
    ...lookups.map((lookup) => lookup.get()),
  ])
  const profiles = snapshots.flatMap((snapshot) => snapshot.docs)
  const profileMap = new Map(profiles.map((profile) => [profile.id, { id: profile.id, ...staffPlainValue(profile.data()) }]))
  const matchedWorkspaceIds = new Set([...profileMap.values()].map((profile) => profile.workspace_id).filter(Boolean))
  if (workspaceDoc?.exists) matchedWorkspaceIds.add(workspaceDoc.id)

  const results = await Promise.all([...matchedWorkspaceIds].slice(0, 20).map(async (workspaceId) => {
    const [snapshot, members] = await Promise.all([
      workspaceDoc?.exists && workspaceId === workspaceDoc.id ? workspaceDoc : db.doc(`workspaces/${workspaceId}`).get(),
      db.collection('profiles').where('workspace_id', '==', workspaceId).limit(100).get(),
    ])
    if (!snapshot.exists) return null
    const memberRows = members.docs.map((profile) => ({ id: profile.id, ...staffPlainValue(profile.data()) }))
    const primary = memberRows.find((profile) => profile.role === 'Administrator') || memberRows[0] || {}
    const workspace = staffPlainValue(snapshot.data() || {})
    return {
      id: workspaceId,
      business_name: workspace.business_name || primary.business_name || 'Unnamed workspace',
      owner_name: primary.owner_name || '',
      email: primary.email || '',
      member_count: members.size,
      status: primary.status || 'Unknown',
      created_at: workspace.created_at || '',
    }
  }))
  return results.filter(Boolean)
}

async function staffLoadWorkspace(workspaceId, actor) {
  const db = getFirestore()
  const id = String(workspaceId || '').trim()
  if (!/^[A-Za-z0-9_-]{4,128}$/.test(id)) throw new HttpsError('invalid-argument', 'Choose a valid workspace ID.')
  const workspaceRef = db.doc(`workspaces/${id}`)
  const workspaceSnapshot = await workspaceRef.get()
  if (!workspaceSnapshot.exists) throw new HttpsError('not-found', 'That workspace no longer exists.')

  const collectionRefs = await workspaceRef.listCollections()
  const collectionNames = [...new Set([...staffReadCollections, ...collectionRefs.map((collection) => collection.id)])]
    .filter((name) => name !== 'billing')
    .sort()
  const [profiles, ...collectionSnapshots] = await Promise.all([
    db.collection('profiles').where('workspace_id', '==', id).limit(100).get(),
    ...staffReadCollections.map((name) => workspaceRef.collection(name).limit(40).get()),
  ])
  const records = Object.fromEntries(staffReadCollections.map((name, index) => [
    name,
    collectionSnapshots[index].docs.map((item) => ({ id: item.id, ...staffPlainValue(item.data()) })),
  ]))
  const billingSnapshot = await workspaceRef.collection('billing').doc('current').get()
  const billing = billingSnapshot.exists ? staffPlainValue(billingSnapshot.data()) : null
  if (billing) {
    for (const key of ['stripe_customer_id', 'stripe_subscription_id', 'pending_checkout_session_id']) delete billing[key]
  }
  const auditSnapshot = await db.collection('overhead_staff_audit').where('workspace_id', '==', id).limit(50).get()
  const audit = auditSnapshot.docs.map((item) => ({ id: item.id, ...staffPlainValue(item.data()) }))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  await db.collection('overhead_staff_audit').add({
    actor_uid: actor.uid,
    actor_email: actor.email,
    action: 'workspace.opened',
    workspace_id: id,
    target: 'workspace',
    reason: 'Workspace opened in the staff portal.',
    changed_fields: [],
    created_at: FieldValue.serverTimestamp(),
  })
  return {
    workspace: staffRedactSecrets({ id, ...staffPlainValue(workspaceSnapshot.data()) }),
    profiles: profiles.docs.map((profile) => staffRedactSecrets({ id: profile.id, ...staffPlainValue(profile.data()) })),
    records: staffRedactSecrets(records),
    collectionNames,
    billing: staffRedactSecrets(billing),
    audit: staffRedactSecrets(audit),
  }
}

exports.staffPortalApi = onCall({
  region: 'us-central1',
  cors: ['https://overhead-office.web.app', 'https://overhead-office.firebaseapp.com'],
  enforceAppCheck: false,
}, async (request) => {
  staffRequireAccess(request)
  const actor = { uid: request.auth.uid, email: request.auth.token.email || '' }
  const data = request.data || {}
  try {
    if (data.action === 'access_check') return { authorized: true, email: actor.email }
    if (data.action === 'create_invite') {
      const email = normalizedStaffEmail(data.email)
      const code = crypto.randomBytes(24).toString('base64url')
      const digest = crypto.createHash('sha256').update(code).digest('hex')
      const db = getFirestore()
      const invites = db.collection('overhead_staff_invites')
      const existing = await invites.where('email', '==', email).get()
      const batch = db.batch()
      existing.docs.filter((doc) => doc.data().status === 'pending').forEach((doc) => batch.update(doc.ref, { status: 'revoked', revoked_at: FieldValue.serverTimestamp() }))
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      batch.create(invites.doc(digest), {
        email,
        status: 'pending',
        created_by_uid: actor.uid,
        created_by_email: actor.email,
        created_at: FieldValue.serverTimestamp(),
        expires_at: Timestamp.fromDate(expiresAt),
      })
      batch.set(db.doc(`overhead_staff_audit/${crypto.randomUUID()}`), {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'staff.invitation_created',
        workspace_id: '',
        target: email,
        reason: 'OverHead staff invitation created.',
        changed_fields: [],
        created_at: FieldValue.serverTimestamp(),
      })
      await batch.commit()
      return { email, code, expiresAt: expiresAt.toISOString() }
    }
    if (data.action === 'search') return { workspaces: await staffWorkspaceSearch(data.query) }
    if (data.action === 'load_workspace') return await staffLoadWorkspace(data.workspaceId, actor)
    if (data.action === 'read_collection') {
      const workspaceId = String(data.workspaceId || '').trim()
      const collectionName = String(data.collection || '').trim()
      if (!/^[A-Za-z0-9_-]{4,128}$/.test(workspaceId) || !/^[A-Za-z0-9_-]{1,100}$/.test(collectionName) || collectionName === 'billing') {
        throw new HttpsError('invalid-argument', 'That workspace collection cannot be opened in the portal.')
      }
      const workspace = getFirestore().doc(`workspaces/${workspaceId}`)
      if (!(await workspace.get()).exists) throw new HttpsError('not-found', 'That workspace no longer exists.')
      const snapshot = await workspace.collection(collectionName).limit(40).get()
      await getFirestore().collection('overhead_staff_audit').add({
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'database.collection_read',
        workspace_id: workspaceId,
        target: collectionName,
        reason: 'Workspace collection inspected in the staff portal.',
        changed_fields: [],
        created_at: FieldValue.serverTimestamp(),
      })
      return { records: snapshot.docs.map((item) => staffRedactSecrets({ id: item.id, ...staffPlainValue(item.data()) })) }
    }
    if (data.action === 'audit') {
      const snapshot = await getFirestore().collection('overhead_staff_audit').orderBy('created_at', 'desc').limit(100).get()
      return { events: snapshot.docs.map((item) => ({ id: item.id, ...staffPlainValue(item.data()) })).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))) }
    }
    if (data.action === 'update_document') {
      const workspaceId = String(data.workspaceId || '').trim()
      const collectionName = String(data.collection || '')
      const documentId = String(data.documentId || '').trim()
      const allowedFields = staffEditableFields[collectionName]
      if (!/^[A-Za-z0-9_-]{4,128}$/.test(workspaceId) || !/^[A-Za-z0-9_@.+-]{1,160}$/.test(documentId) || !allowedFields) {
        throw new HttpsError('invalid-argument', 'That database record cannot be edited through this portal.')
      }
      if (!data.changes || typeof data.changes !== 'object' || Array.isArray(data.changes)) throw new HttpsError('invalid-argument', 'Provide a JSON object with the fields to update.')
      const changedFields = Object.keys(data.changes)
      if (!changedFields.length || changedFields.length > 25 || changedFields.some((key) => !allowedFields.has(key))) {
        throw new HttpsError('invalid-argument', 'One or more fields are protected or not editable in this portal.')
      }
      const reason = staffReason(data.reason)
      const db = getFirestore()
      const ref = collectionName === 'profiles'
        ? db.doc(`profiles/${documentId}`)
        : db.doc(`workspaces/${workspaceId}/${collectionName}/${documentId}`)
      const before = await ref.get()
      if (!before.exists || (collectionName === 'profiles' && before.data().workspace_id !== workspaceId)) throw new HttpsError('not-found', 'That record was not found in the selected workspace.')
      const changes = Object.fromEntries(changedFields.map((key) => [key, staffJsonValue(data.changes[key])]))
      if (collectionName === 'profiles') {
        if (changes.role !== undefined && !['Administrator', 'Manager', 'Staff', 'Customer'].includes(changes.role)) throw new HttpsError('invalid-argument', 'Choose a valid workspace role.')
        if (changes.status !== undefined && !['Active', 'Suspended', 'Invited'].includes(changes.status)) throw new HttpsError('invalid-argument', 'Choose a valid account status.')
      }
      if (collectionName === 'approvals' && changes.status !== undefined && !['Pending', 'Approved', 'Rejected', 'Declined', 'Needs revision'].includes(changes.status)) throw new HttpsError('invalid-argument', 'Choose a valid approval status.')
      if (collectionName === 'support_tickets') {
        if (changes.status !== undefined && !['New', 'Open', 'Waiting', 'Resolved', 'Closed'].includes(changes.status)) throw new HttpsError('invalid-argument', 'Choose a valid support status.')
        if (changes.priority !== undefined && !['Low', 'Normal', 'High', 'Urgent'].includes(changes.priority)) throw new HttpsError('invalid-argument', 'Choose a valid priority.')
      }
      if (collectionName === 'approvals' && changes.status && changes.status !== 'Pending') {
        changes.decided_by = actor.uid
        changes.decided_at = FieldValue.serverTimestamp()
        changedFields.push('decided_by', 'decided_at')
      }
      const batch = db.batch()
      batch.update(ref, { ...changes, updated_at: FieldValue.serverTimestamp() })
      batch.set(db.collection('overhead_staff_audit').doc(), {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'database.record_updated',
        workspace_id: workspaceId,
        target: `${collectionName}/${documentId}`,
        reason,
        changed_fields: changedFields,
        created_at: FieldValue.serverTimestamp(),
      })
      await batch.commit()
      return { updated: true, document: { id: documentId, ...staffPlainValue((await ref.get()).data()) } }
    }
    if (data.action === 'set_feature_override') {
      const workspaceId = String(data.workspaceId || '').trim()
      const featureId = String(data.featureId || '')
      const mode = String(data.mode || '')
      const reason = staffReason(data.reason)
      if (!/^[A-Za-z0-9_-]{4,128}$/.test(workspaceId) || !Object.prototype.hasOwnProperty.call(staffFeatureCatalog, featureId) || !['enabled', 'disabled', 'inherit'].includes(mode)) {
        throw new HttpsError('invalid-argument', 'Choose a valid workspace, feature, and override mode.')
      }
      const db = getFirestore()
      const workspace = await db.doc(`workspaces/${workspaceId}`).get()
      if (!workspace.exists) throw new HttpsError('not-found', 'That workspace no longer exists.')
      const overrideRef = db.doc(`workspaces/${workspaceId}/staff_feature_overrides/${featureId}`)
      const publicRef = db.doc(`workspaces/${workspaceId}/feature_flags/${featureId}`)
      const batch = db.batch()
      if (mode === 'inherit') {
        batch.delete(overrideRef)
        batch.delete(publicRef)
      } else {
        let expiresAt = null
        if (data.expiresAt) {
          expiresAt = new Date(data.expiresAt)
          if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now() || expiresAt.getTime() > Date.now() + 366 * 86400000) {
            throw new HttpsError('invalid-argument', 'Choose an expiry within the next 366 days, or leave it blank.')
          }
        }
        const enabled = mode === 'enabled'
        batch.set(overrideRef, {
          feature_id: featureId,
          feature_name: staffFeatureCatalog[featureId],
          enabled,
          reason,
          set_by_uid: actor.uid,
          set_by_email: actor.email,
          expires_at: expiresAt,
          updated_at: FieldValue.serverTimestamp(),
        }, { merge: true })
        batch.set(publicRef, {
          feature_id: featureId,
          enabled,
          source: 'overhead_staff',
          expires_at: expiresAt,
          updated_at: FieldValue.serverTimestamp(),
        })
      }
      batch.set(db.collection('overhead_staff_audit').doc(), {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'feature.override_changed',
        workspace_id: workspaceId,
        target: `feature:${featureId}`,
        reason,
        changed_fields: ['enabled', 'expires_at'],
        created_at: FieldValue.serverTimestamp(),
      })
      await batch.commit()
      return { updated: true }
    }
    throw new HttpsError('invalid-argument', 'Unknown staff portal action.')
  } catch (error) {
    if (error instanceof HttpsError) throw error
    console.error('OverHead Staff portal action failed', { action: data.action, uid: actor.uid, code: error.code || '' })
    throw new HttpsError('internal', 'The staff action could not be completed. Review the audit record and escalate persistent technical failures to the development team.')
  }
})
