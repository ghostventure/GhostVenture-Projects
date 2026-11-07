const { onRequest } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const crypto = require('crypto')

initializeApp()

function json(res, status, body) { res.status(status).json(body) }

async function verifyUser(req) {
  const token = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) throw new Error('Sign in is required for Cylinder team account management.')
  const user = await getAuth().verifyIdToken(token)
  if (user.email_verified !== true) throw new Error('Verify your email before managing Cylinder team accounts.')
  return user
}

async function cylinderAdministrator(req) {
  const user = await verifyUser(req)
  const profile = (await getFirestore().doc(`profiles/${user.uid}`).get()).data()
  if (!profile || profile.status !== 'Active' || profile.role !== 'Administrator' || typeof profile.workspace_id !== 'string' || !profile.workspace_id || profile.workspace_id.includes('/')) {
    throw new Error('Only an active workspace administrator can manage Cylinder team accounts.')
  }
  const workspace = await getFirestore().doc(`workspaces/${profile.workspace_id}`).get()
  if (workspace.data()?.deployment_mode !== 'cylinder') throw new Error('Cylinder member management is only available to Cylinder workspaces.')
  return { user, profile, workspaceId: profile.workspace_id }
}

async function provisionCylinderMember({ user, profile, workspaceId }, input) {
  const email = String(input.email || '').trim().toLowerCase()
  const ownerName = String(input.owner_name || '').trim()
  const role = String(input.role || '')
  const status = String(input.status || 'Active')
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid team member email address.')
  if (!ownerName) throw new Error('A team member name is required.')
  if (!['Manager', 'Staff'].includes(role)) throw new Error('Cylinder team members can be assigned Manager or Staff access.')
  if (!['Active', 'Suspended'].includes(status)) throw new Error('Choose a valid team account status.')
  if (email === String(user.email || '').toLowerCase()) throw new Error('Use the existing administrator profile for your own account.')

  const auth = getAuth()
  const db = getFirestore()
  const matchingProfiles = await db.collection('profiles').where('email', '==', email).limit(2).get()
  if (matchingProfiles.docs.some((item) => item.data().workspace_id !== workspaceId)) {
    throw new Error('This email is already managed by another OverHead workspace.')
  }

  let member
  try {
    member = await auth.getUserByEmail(email)
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
  }

  let verificationUrl = ''
  let passwordResetUrl = ''
  const profileRef = member ? db.doc(`profiles/${member.uid}`) : null
  if (member) {
    const existingProfile = (await profileRef.get()).data()
    if (!existingProfile || existingProfile.workspace_id !== workspaceId || existingProfile.role === 'Administrator') {
      throw new Error('An account with this email already exists and cannot be linked to this Cylinder workspace.')
    }
    member = await auth.updateUser(member.uid, { displayName: ownerName, disabled: status === 'Suspended' })
    await profileRef.set({
      owner_name: ownerName,
      business_name: profile.business_name || 'Cylinder workspace',
      role,
      status,
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true })
    if (!member.emailVerified) {
      verificationUrl = await auth.generateEmailVerificationLink(email)
      passwordResetUrl = await auth.generatePasswordResetLink(email)
    }
  } else {
    member = await auth.createUser({
      email,
      password: crypto.randomBytes(32).toString('base64url'),
      emailVerified: false,
      displayName: ownerName,
      disabled: status === 'Suspended',
    })
    const createdAt = FieldValue.serverTimestamp()
    const newProfileRef = db.doc(`profiles/${member.uid}`)
    const inviteRef = db.doc(`workspaces/${workspaceId}/invites/${email}`)
    try {
      verificationUrl = await auth.generateEmailVerificationLink(email)
      passwordResetUrl = await auth.generatePasswordResetLink(email)
      const batch = db.batch()
      batch.set(newProfileRef, {
        uid: member.uid,
        owner_name: ownerName,
        business_name: profile.business_name || 'Cylinder workspace',
        email,
        workspace_id: workspaceId,
        role,
        status,
        email_verified: false,
        terms_accepted_at: '',
        last_sign_in: '',
        created_at: createdAt,
        updated_at: createdAt,
      })
      batch.set(inviteRef, {
        email,
        role,
        workspace_id: workspaceId,
        owner_name: ownerName,
        business_name: profile.business_name || 'Cylinder workspace',
        created_by: user.uid,
        created_at: createdAt,
        updated_at: createdAt,
      }, { merge: true })
      await batch.commit()
    } catch (error) {
      await Promise.allSettled([newProfileRef.delete(), auth.deleteUser(member.uid)])
      throw error
    }
  }

  await db.collection('workspaces').doc(workspaceId).collection('audit_events').add({
    workspace_id: workspaceId,
    actor_uid: user.uid,
    event_type: 'cylinder.member_provisioned',
    summary: `Cylinder team access provisioned for ${email}`,
    target_uid: member.uid,
    created_at: FieldValue.serverTimestamp(),
  }).catch((error) => console.error('Cylinder account audit write failed', error.message))
  return { uid: member.uid, email, role, status, email_verified: member.emailVerified, verificationUrl, passwordResetUrl }
}

exports.cylinderMembersApi = onRequest({
  region: 'us-central1',
  cors: ['https://overhead-office.web.app', 'https://overhead-office.firebaseapp.com'],
}, async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' })
  try {
    const context = await cylinderAdministrator(req)
    const body = req.body || {}
    const db = getFirestore()
    if (body.action === 'provision_member') {
      return json(res, 200, await provisionCylinderMember(context, body))
    }
    if (body.action === 'set_member_status') {
      const uid = String(body.uid || '')
      const status = String(body.status || '')
      if (!uid || !['Active', 'Suspended'].includes(status)) return json(res, 400, { error: 'Choose a valid team member and account status.' })
      if (uid === context.user.uid) return json(res, 400, { error: 'You cannot suspend the administrator currently managing Cylinder.' })
      const profileRef = db.doc(`profiles/${uid}`)
      const memberProfile = (await profileRef.get()).data()
      if (!memberProfile || memberProfile.workspace_id !== context.workspaceId || memberProfile.role === 'Administrator') {
        return json(res, 404, { error: 'Cylinder team member was not found in this workspace.' })
      }
      if (status === 'Suspended') {
        await profileRef.set({ status, updated_at: FieldValue.serverTimestamp() }, { merge: true })
        await getAuth().updateUser(uid, { disabled: true })
      } else {
        await getAuth().updateUser(uid, { disabled: false })
        await profileRef.set({ status, updated_at: FieldValue.serverTimestamp() }, { merge: true })
      }
      await db.collection('workspaces').doc(context.workspaceId).collection('audit_events').add({
        workspace_id: context.workspaceId,
        actor_uid: context.user.uid,
        event_type: 'cylinder.member_status_updated',
        summary: `Cylinder team access ${status.toLowerCase()} for ${memberProfile.email || uid}`,
        target_uid: uid,
        created_at: FieldValue.serverTimestamp(),
      })
      return json(res, 200, { uid, status })
    }
    return json(res, 400, { error: 'Unknown Cylinder member action.' })
  } catch (error) {
    return json(res, 403, { error: error.message || 'Cylinder member action denied.' })
  }
})
