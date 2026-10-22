const crypto = require('node:crypto')

const RANKS = Object.freeze({ regular: 1, management: 2, administrator: 3, owner: 4 })
const RANK_NAMES = Object.freeze({ 1: 'Regular User', 2: 'Management', 3: 'Administrator', 4: 'Owner' })
const JOB_FUNCTIONS = new Set(['Support', 'Front Desk', 'Bookkeeper'])

function fail(message, status = 403) {
  const error = new Error(message)
  error.status = status
  throw error
}

function cleanText(value, max = 120) { return String(value || '').trim().slice(0, max) }
function safeId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value) }
function sameIds(left, right) {
  const a = [...new Set(Array.isArray(left) ? left : [])].sort()
  const b = [...new Set(Array.isArray(right) ? right : [])].sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}
function compareVersion(left, right) {
  const a = String(left || '0').split('.').map(Number), b = String(right || '0').split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const difference = (a[i] || 0) - (b[i] || 0)
    if (difference) return difference
  }
  return 0
}

function createCylinderHandler({ auth, db, fieldValue, onRequest, logger = console }) {
  const timestamp = () => fieldValue.serverTimestamp()
  const workspaceDoc = (workspaceId) => db.doc(`workspaces/${workspaceId}`)
  const memberCollection = (workspaceId) => workspaceDoc(workspaceId).collection('cylinder_members')
  const departmentCollection = (workspaceId) => workspaceDoc(workspaceId).collection('cylinder_departments')
  const deviceCollection = (workspaceId) => workspaceDoc(workspaceId).collection('cylinder_devices')
  const policyDoc = (workspaceId) => workspaceDoc(workspaceId).collection('cylinder_policies').doc('current')
  const auditCollection = (workspaceId) => workspaceDoc(workspaceId).collection('cylinder_audit')

  async function actorFor(req) {
    const token = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) fail('Sign in with a verified Cylinder account.', 401)
    let identity
    try { identity = await auth.verifyIdToken(token, true) } catch { fail('Your sign-in expired. Sign in again.', 401) }
    if (identity.email_verified !== true) fail('Verify your email before using Cylinder management.', 403)
    const profileRef = db.doc(`profiles/${identity.uid}`)
    const profileSnap = await profileRef.get()
    const profile = profileSnap.data()
    if (!profile || profile.status !== 'Active' || !profile.workspace_id || !safeId(profile.workspace_id)) fail('This account is not active in an OverHead workspace.')
    const workspaceId = profile.workspace_id
    const memberRef = memberCollection(workspaceId).doc(identity.uid)
    let memberSnap = await memberRef.get()
    if (!memberSnap.exists && profile.status === 'Active' && profile.role === 'Administrator' && workspaceId === identity.uid) {
      const workspaceSnap = await workspaceDoc(workspaceId).get()
      if (workspaceSnap.data()?.owner_uid === identity.uid) {
        const generalRef = departmentCollection(workspaceId).doc('general')
        await db.runTransaction(async (tx) => {
          const current = await tx.get(memberRef)
          if (current.exists) return
          tx.set(generalRef, { id: 'general', name: 'General', status: 'Active', created_at: timestamp(), created_by: identity.uid })
          tx.set(memberRef, {
            uid: identity.uid, email: identity.email || profile.email || '', name: profile.owner_name || identity.name || '',
            rank: 4, rank_name: RANK_NAMES[4], account_type: 'employee', department_ids: ['general'],
            job_function: 'Front Desk', status: 'Active', created_at: timestamp(), updated_at: timestamp(), created_by: identity.uid,
          })
          tx.create(auditCollection(workspaceId).doc(), { action: 'owner_bootstrapped', actor_uid: identity.uid, target_uid: identity.uid, workspace_id: workspaceId, rank: 4, created_at: timestamp() })
        })
        memberSnap = await memberRef.get()
      }
    }
    if (!memberSnap.exists) fail('Cylinder access has not been provisioned for this workspace member.')
    const member = memberSnap.data()
    if (![1, 2, 3, 4].includes(member.rank)) fail('Your Cylinder Rank is invalid. Contact the workspace Owner.', 403)
    member.rank_name = RANK_NAMES[member.rank]
    return { uid: identity.uid, email: identity.email || profile.email || '', workspaceId, profileRef, profile, memberRef, member, token: identity }
  }

  function requireActive(actor) {
    if (actor.member.status !== 'Active') fail('Your Cylinder membership is suspended or pending.')
  }
  function requireRank(actor, minimum) {
    requireActive(actor)
    if (![1, 2, 3, 4].includes(actor.member.rank) || actor.member.rank < minimum) fail(`Rank ${minimum} or higher is required for this action.`)
  }
  function scopedDepartments(actor, requested) {
    const ids = [...new Set((Array.isArray(requested) ? requested : []).filter(safeId))]
    if (!ids.length) fail('Assign at least one department.', 400)
    if (actor.member.rank === 4) return ids
    const allowed = new Set(actor.member.department_ids || [])
    if (ids.some((id) => !allowed.has(id))) fail('You can only manage members in your assigned departments.')
    return ids
  }
  async function activeDepartments(actor, requested) {
    const ids = scopedDepartments(actor, requested)
    const docs = await Promise.all(ids.map((id) => departmentCollection(actor.workspaceId).doc(id).get()))
    if (docs.some((doc) => !doc.exists || doc.data().status !== 'Active')) fail('Choose active departments.', 400)
    return ids
  }
  async function writeAudit(actor, action, targetUid, details = {}) {
    await auditCollection(actor.workspaceId).add({
      action, actor_uid: actor.uid, actor_email: actor.email, target_uid: targetUid || '',
      workspace_id: actor.workspaceId, details, created_at: timestamp(),
    })
  }
  async function listFor(actor) {
    requireActive(actor)
    const assigned = new Set(actor.member.department_ids || [])
    const departmentQuery = actor.member.rank === 4
      ? departmentCollection(actor.workspaceId).where('status', '==', 'Active').get()
      : Promise.all([...assigned].map((id) => departmentCollection(actor.workspaceId).doc(id).get()))
    const departmentResults = await departmentQuery
    const visibleDepartments = (Array.isArray(departmentResults)
      ? departmentResults.filter((doc) => doc.exists && doc.data().status === 'Active')
      : departmentResults.docs).map((doc) => ({ id: doc.id, ...doc.data() }))

    // Rank 4 is the only workspace-wide directory reader. Department-scoped
    // ranks query only their assigned departments; de-duplicate employees who
    // belong to more than one department before applying rank visibility.
    const memberBase = memberCollection(actor.workspaceId)
    const memberQueries = actor.member.rank === 4
      ? [memberBase.where('status', 'in', ['Active', 'Pending', 'Suspended']).get()]
      : [...assigned].map((id) => memberBase.where('department_ids', 'array-contains', id)
        .where('status', 'in', ['Active', 'Pending', 'Suspended']).get())
    const memberSnapshots = await Promise.all(memberQueries)
    const membersByUid = new Map()
    for (const snapshot of memberSnapshots) {
      for (const doc of snapshot.docs) membersByUid.set(doc.id, { uid: doc.id, ...doc.data() })
    }
    const visibleMembers = [...membersByUid.values()].filter((member) =>
      member.account_type !== 'customer' && (actor.member.rank === 4 ||
        (member.uid === actor.uid || member.rank < actor.member.rank)))
    let devices = []
    if (actor.member.rank >= 3) {
      const deviceBase = deviceCollection(actor.workspaceId)
      const deviceQueries = actor.member.rank === 4
        ? [deviceBase.get()]
        : [...assigned].map((id) => deviceBase.where('department_ids', 'array-contains', id).get())
      const deviceSnapshots = await Promise.all(deviceQueries)
      const devicesById = new Map()
      for (const snapshot of deviceSnapshots) {
        for (const doc of snapshot.docs) devicesById.set(doc.id, { id: doc.id, ...doc.data() })
      }
      devices = [...devicesById.values()].map((device) => {
        const safeDevice = { ...device }
        delete safeDevice.credential_hash
        return safeDevice
      })
    }
    let auditQuery = null
    if (actor.member.rank >= 3) {
      const auditBase = auditCollection(actor.workspaceId).orderBy('created_at', 'desc').limit(200)
      auditQuery = actor.member.rank === 4
        ? auditBase.get()
        : Promise.all([...assigned].map((id) => auditCollection(actor.workspaceId)
          .where('details.department_ids', 'array-contains', id)
          .orderBy('created_at', 'desc').limit(200).get()))
    }
    const [policySnap, auditSnap] = await Promise.all([
      policyDoc(actor.workspaceId).get(),
      auditQuery || Promise.resolve(null),
    ])
    const auditEvents = auditSnap ? (Array.isArray(auditSnap)
      ? [...new Map(auditSnap.flatMap((snapshot) => snapshot.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]))).values()]
      : auditSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))) : []
    auditEvents.sort((left, right) => (right.created_at?.toMillis?.() || 0) - (left.created_at?.toMillis?.() || 0))
    return {
      workspaceId: actor.workspaceId,
      actor: { uid: actor.uid, email: actor.email, rank: actor.member.rank, rankName: actor.member.rank_name, departmentIds: actor.member.department_ids || [] },
      departments: visibleDepartments,
      members: visibleMembers,
      devices,
      policy: policySnap.data() || { minimum_app_version: '0.3.19', offline_grace_hours: 4, block_unenrolled_devices: true },
      audit: auditEvents.slice(0, 200),
    }
  }

  async function heartbeat(actor, body) {
    requireActive(actor)
    const deviceId = String(body.deviceId || '')
    if (!safeId(deviceId)) fail('A valid installation ID is required.', 400)
    const deviceSecret = String(body.deviceSecret || '')
    if (deviceSecret.length < 40 || deviceSecret.length > 200) fail('This installation must be enrolled again.', 403)
    const secretHash = crypto.createHash('sha256').update(deviceSecret).digest('hex')
    const deviceRef = deviceCollection(actor.workspaceId).doc(deviceId)
    const currentSnap = await deviceRef.get()
    let device = currentSnap.data()
    if (!currentSnap.exists && actor.member.rank === 4) {
      const existingAllowed = await deviceCollection(actor.workspaceId).where('status', '==', 'Allowed').limit(1).get()
      const firstOwnerInstallation = existingAllowed.empty
      const data = {
        id: deviceId, name: cleanText(body.deviceName, 120) || 'Cylinder owner device',
        hostname: cleanText(body.hostname, 120), platform: cleanText(body.platform, 80),
        app_version: cleanText(body.appVersion, 30), workspace_id: actor.workspaceId,
        department_ids: actor.member.department_ids || [], allowed_uids: [], status: firstOwnerInstallation ? 'Allowed' : 'Pending',
        credential_hash: secretHash,
        enrolled_by: actor.uid, created_at: timestamp(), last_seen_at: timestamp(),
      }
      await deviceRef.create(data)
      device = data
    } else if (!currentSnap.exists) {
      const data = {
        id: deviceId, name: cleanText(body.deviceName, 120) || cleanText(body.hostname, 120) || 'New Cylinder device',
        hostname: cleanText(body.hostname, 120), platform: cleanText(body.platform, 80),
        app_version: cleanText(body.appVersion, 30), workspace_id: actor.workspaceId,
        department_ids: actor.member.department_ids || [], allowed_uids: [actor.uid], status: 'Pending',
        credential_hash: secretHash,
        enrolled_by: actor.uid, created_at: timestamp(), last_seen_at: timestamp(),
      }
      await deviceRef.create(data)
      device = data
    }
    if (device.credential_hash) {
      const expected = Buffer.from(String(device.credential_hash), 'hex'), supplied = Buffer.from(secretHash, 'hex')
      if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) fail('This installation credential is not recognized. Reinstall or ask an Administrator to enroll this device.')
    } else {
      await deviceRef.set({ credential_hash: secretHash }, { merge: true })
    }
    if (device.status !== 'Allowed') return { allowed: false, reason: device.status === 'Blocked' ? 'This device is blocked by Cylinder management.' : 'This device is waiting for an Administrator or Owner to allow it.', deviceStatus: device.status }
    const appVersion = cleanText(body.appVersion, 30)
    if (!/^\d+\.\d+\.\d+$/.test(appVersion)) fail('This Cylinder version cannot be verified.', 400)
    const policy = (await policyDoc(actor.workspaceId).get()).data() || {}
    const minimumAppVersion = policy.minimum_app_version || '0.3.19'
    if (actor.member.rank < 4 && compareVersion(appVersion, minimumAppVersion) < 0) return { allowed: false, reason: `Update Cylinder to version ${minimumAppVersion} or later.`, deviceStatus: device.status }
    const assigned = new Set(actor.member.department_ids || [])
    if (!actor.member.department_ids?.length || !(device.department_ids || []).some((id) => assigned.has(id))) return { allowed: false, reason: 'Your account and this device do not share an assigned department.', deviceStatus: device.status }
    if ((device.allowed_uids || []).length && !device.allowed_uids.includes(actor.uid)) return { allowed: false, reason: 'Your account is not assigned to this device.', deviceStatus: device.status }
    if (policy.disabled === true && actor.member.rank < 4) return { allowed: false, reason: 'Cylinder access is paused by the workspace Owner.', deviceStatus: device.status }
    await deviceRef.set({ last_seen_at: timestamp(), last_user_uid: actor.uid, app_version: appVersion, platform: cleanText(body.platform, 80) }, { merge: true })
    const graceHours = Math.max(0, Math.min(24, Number(policy.offline_grace_hours ?? 4)))
    return {
      allowed: true, deviceStatus: device.status, rank: actor.member.rank,
      rankName: actor.member.rank_name || RANK_NAMES[actor.member.rank],
      departmentIds: actor.member.department_ids || [], jobFunction: actor.member.job_function || 'Support',
      policy: { minimumAppVersion, disabled: policy.disabled === true },
      checkedAt: Date.now(), expiresAt: Date.now() + graceHours * 60 * 60 * 1000,
    }
  }

  async function inviteMember(actor, body) {
    requireRank(actor, 2)
    const email = cleanText(body.email, 254).toLowerCase()
    const name = cleanText(body.name, 120)
    const rank = Number(body.rank)
    const jobFunction = JOB_FUNCTIONS.has(body.jobFunction) ? body.jobFunction : 'Support'
    const departmentIds = await activeDepartments(actor, body.departmentIds)
    if (!/^\S+@\S+\.\S+$/.test(email) || !name) fail('Enter the employee name and a valid email address.', 400)
    if (![1, 2, 3].includes(rank) || rank >= actor.member.rank) fail('You can only assign a Rank below your own.', 403)
    if (actor.member.rank === 2 && rank !== 1) fail('Management can invite Regular Users only.')
    const departmentSnaps = await Promise.all(departmentIds.map((id) => departmentCollection(actor.workspaceId).doc(id).get()))
    if (departmentSnaps.some((snap) => !snap.exists || snap.data().status !== 'Active')) fail('Choose active departments.', 400)
    let account, isNewAccount = false, passwordSetupLink = ''
    try { account = await auth.getUserByEmail(email) } catch (error) { if (error.code !== 'auth/user-not-found') throw error }
    if (account) {
      const existingProfile = (await db.doc(`profiles/${account.uid}`).get()).data()
      if (!existingProfile || existingProfile.workspace_id !== actor.workspaceId || existingProfile.role === 'Customer' || existingProfile.status !== 'Active') {
        fail('That Firebase account is already associated with another workspace or account type.')
      }
      if (account.uid === actor.workspaceId) fail('The workspace Owner is already enrolled as Rank 4.')
      if (account.disabled) fail('That Firebase account is disabled. Restore it before inviting it to Cylinder.')
      const existingMember = await memberCollection(actor.workspaceId).doc(account.uid).get()
      if (existingMember.exists && existingMember.data().status !== 'Removed') fail('That account is already enrolled in Cylinder.')
    } else {
      account = await auth.createUser({ email, displayName: name, password: crypto.randomBytes(36).toString('base64url'), emailVerified: false, disabled: false })
      isNewAccount = true
    }
    const memberRef = memberCollection(actor.workspaceId).doc(account.uid)
    const invitedProfileRef = db.doc(`profiles/${account.uid}`)
    try {
      const now = timestamp()
      if (isNewAccount) {
        passwordSetupLink = await auth.generatePasswordResetLink(email, { url: 'https://overhead-office.web.app/' })
        await db.doc(`profiles/${account.uid}`).create({
          uid: account.uid, owner_name: name, business_name: actor.profile.business_name || 'OverHead workspace',
          email, workspace_id: actor.workspaceId, role: 'Staff', status: 'Pending', email_verified: false,
          cylinder_managed: true, created_at: now, updated_at: now,
        })
      }
      await db.runTransaction(async (tx) => {
        const [latestActorSnap, latestMemberSnap, ...latestDepartmentSnaps] = await Promise.all([
          tx.get(actor.memberRef), tx.get(memberRef), tx.get(invitedProfileRef), ...departmentIds.map((id) => tx.get(departmentCollection(actor.workspaceId).doc(id))),
        ])
        const latestActor = latestActorSnap.data()
        if (!latestActorSnap.exists || latestActor.status !== 'Active' || latestActor.rank !== actor.member.rank || !sameIds(latestActor.department_ids, actor.member.department_ids)) fail('Your access changed while you were creating the invitation.', 409)
        if (![1, 2, 3].includes(rank) || rank >= latestActor.rank || (latestActor.rank === 2 && rank !== 1)) fail('Your current Rank cannot assign this employee Rank.')
        if (latestActor.rank !== 4 && departmentIds.some((id) => !(latestActor.department_ids || []).includes(id))) fail('The requested department is outside your current scope.')
        const latestProfileSnap = latestDepartmentSnaps.shift()
        const expectedProfileStatus = isNewAccount ? 'Pending' : 'Active'
        if (!latestProfileSnap.exists || latestProfileSnap.data().workspace_id !== actor.workspaceId || latestProfileSnap.data().status !== expectedProfileStatus || latestProfileSnap.data().role === 'Customer') fail('That Firebase account is no longer eligible for Cylinder.', 409)
        if (latestDepartmentSnaps.some((department) => !department.exists || department.data().status !== 'Active')) fail('Choose active departments.', 409)
        if (latestMemberSnap.exists && latestMemberSnap.data().status !== 'Removed') fail('That account is already enrolled in Cylinder.', 409)
        const createdAt = timestamp()
        tx.set(memberRef, {
          uid: account.uid, email, name: name || account.displayName || email, rank, rank_name: RANK_NAMES[rank], account_type: 'employee',
          department_ids: departmentIds, job_function: jobFunction, status: 'Pending',
          created_by: actor.uid, created_at: latestMemberSnap.exists ? latestMemberSnap.data().created_at || createdAt : createdAt,
          updated_at: createdAt, removed_at: fieldValue.delete(), removed_by: fieldValue.delete(),
        }, { merge: true })
        tx.update(invitedProfileRef, { cylinder_managed: true, updated_at: createdAt })
        tx.create(auditCollection(actor.workspaceId).doc(), { action: 'member_invited', actor_uid: actor.uid, actor_email: actor.email, target_uid: account.uid, workspace_id: actor.workspaceId, details: { email, rank, department_ids: departmentIds, job_function: jobFunction, existing_workspace_account: !isNewAccount }, created_at: createdAt })
      })
    } catch (error) {
      if (isNewAccount) {
        await db.doc(`profiles/${account.uid}`).delete().catch(() => {})
        await auth.deleteUser(account.uid).catch(() => {})
      }
      throw error
    }
    return { invited: true, uid: account.uid, email, rank, existingWorkspaceAccount: !isNewAccount, passwordSetupLink }
  }

  async function updateMember(actor, body) {
    requireRank(actor, 2)
    const uid = String(body.uid || '')
    if (!safeId(uid) || uid === actor.uid) fail('Select another employee to update.', 400)
    const ref = memberCollection(actor.workspaceId).doc(uid)
    const snap = await ref.get()
    if (!snap.exists) fail('Cylinder member not found.', 404)
    const target = snap.data()
    if (actor.member.rank <= target.rank) fail('You cannot manage a member at your Rank or higher.')
    if (actor.member.rank !== 4 && !(target.department_ids || []).some((id) => (actor.member.department_ids || []).includes(id))) fail('The employee is outside your department scope.')
    const departments = await activeDepartments(actor, body.departmentIds || target.department_ids || [])
    const rank = body.rank === undefined ? target.rank : Number(body.rank)
    const status = body.status === undefined ? target.status : String(body.status)
    const jobFunction = body.jobFunction === undefined ? (target.job_function || 'Support') : body.jobFunction
    if (![1, 2, 3].includes(rank) || rank >= actor.member.rank) fail('You can only assign a Rank below your own.')
    if (actor.member.rank === 2 && rank !== 1) fail('Management can assign Rank 1 only.')
    if (!['Active', 'Suspended'].includes(status)) fail('Choose Active or Suspended status.', 400)
    if (!JOB_FUNCTIONS.has(jobFunction)) fail('Choose a supported job function.', 400)
    if (target.rank === 4) fail('Workspace ownership cannot be changed from the member editor.')
    await db.runTransaction(async (tx) => {
      const [latestActorSnap, latestTargetSnap, ...latestDepartmentSnaps] = await Promise.all([
        tx.get(actor.memberRef), tx.get(ref), ...departments.map((id) => tx.get(departmentCollection(actor.workspaceId).doc(id))),
      ])
      const latestActor = latestActorSnap.data(), latest = latestTargetSnap.data()
      if (!latestActorSnap.exists || latestActor.status !== 'Active' || latestActor.rank !== actor.member.rank || !sameIds(latestActor.department_ids, actor.member.department_ids) || !latest || latest.rank !== target.rank || latest.status !== target.status || !sameIds(latest.department_ids, target.department_ids)) fail('This member or your access changed while you were editing. Refresh and try again.', 409)
      if (latestActor.rank !== 4 && !(latest.department_ids || []).some((id) => (latestActor.department_ids || []).includes(id))) fail('The employee is outside your department scope.')
      if ((latestActor.rank !== 4 && departments.some((id) => !(latestActor.department_ids || []).includes(id))) || latestDepartmentSnaps.some((department) => !department.exists || department.data().status !== 'Active')) fail('Choose active departments within your current scope.', 409)
      if (latestActor.rank <= latest.rank || (latestActor.rank === 2 && rank !== 1)) fail('Your current Rank cannot make this change.')
      tx.update(ref, { rank, rank_name: RANK_NAMES[rank], department_ids: departments, job_function: jobFunction, status, updated_at: timestamp(), updated_by: actor.uid })
      tx.create(auditCollection(actor.workspaceId).doc(), { action: 'member_updated', actor_uid: actor.uid, actor_email: actor.email, target_uid: uid, workspace_id: actor.workspaceId, details: { previous_rank: latest.rank, rank, previous_status: latest.status, status, department_ids: departments, job_function: jobFunction }, created_at: timestamp() })
    })
    return { updated: true }
  }

  async function removeMember(actor, body) {
    requireRank(actor, 2)
    const uid = String(body.uid || '')
    if (!safeId(uid) || uid === actor.uid) fail('Select another employee to remove.', 400)
    const ref = memberCollection(actor.workspaceId).doc(uid)
    const snap = await ref.get()
    if (!snap.exists) fail('Cylinder member not found.', 404)
    const target = snap.data()
    if (target.rank === 4 || target.rank >= actor.member.rank) fail('You cannot remove an Owner or a member at your Rank or higher.')
    if (actor.member.rank === 2 && target.rank !== 1) fail('Management can remove Rank 1 members only.')
    if (!(target.department_ids || []).some((id) => (actor.member.department_ids || []).includes(id)) && actor.member.rank !== 4) fail('The employee is outside your department scope.')
    await db.runTransaction(async (tx) => {
      const [latestActorSnap, latestTargetSnap] = await Promise.all([tx.get(actor.memberRef), tx.get(ref)])
      const latestActor = latestActorSnap.data(), latest = latestTargetSnap.data()
      if (!latestActorSnap.exists || latestActor.status !== 'Active' || latestActor.rank !== actor.member.rank || !sameIds(latestActor.department_ids, actor.member.department_ids) || !latest || latest.rank === 4 || latest.rank >= latestActor.rank) fail('Your current Rank cannot remove this member.', 409)
      if (latestActor.rank === 2 && latest.rank !== 1) fail('Management can remove Rank 1 members only.')
      if (latestActor.rank !== 4 && !(latest.department_ids || []).some((id) => (latestActor.department_ids || []).includes(id))) fail('The employee is outside your department scope.')
      tx.update(ref, { status: 'Removed', removed_at: timestamp(), removed_by: actor.uid, updated_at: timestamp() })
      tx.create(auditCollection(actor.workspaceId).doc(), { action: 'member_removed', actor_uid: actor.uid, actor_email: actor.email, target_uid: uid, workspace_id: actor.workspaceId, details: { rank: latest.rank, department_ids: latest.department_ids || [] }, created_at: timestamp() })
    })
    return { removed: true }
  }

  async function createDepartment(actor, body) {
    requireRank(actor, 4)
    const name = cleanText(body.name, 100)
    if (name.length < 2) fail('Enter a department name.', 400)
    const ref = departmentCollection(actor.workspaceId).doc(crypto.randomUUID())
    const data = { id: ref.id, name, status: 'Active', created_by: actor.uid, created_at: timestamp(), updated_at: timestamp() }
    await ref.create(data)
    await writeAudit(actor, 'department_created', ref.id, { name })
    return { department: (await ref.get()).data() }
  }

  async function setDevice(actor, body) {
    requireRank(actor, 3)
    const id = String(body.id || '')
    const status = String(body.status || '')
    if (!safeId(id) || !['Allowed', 'Blocked', 'Retired'].includes(status)) fail('Choose a valid device and status.', 400)
    const ref = deviceCollection(actor.workspaceId).doc(id)
    const snap = await ref.get()
    if (!snap.exists) fail('Cylinder device not found.', 404)
    const device = snap.data()
    if (actor.member.rank !== 4 && !(device.department_ids || []).some((id) => (actor.member.department_ids || []).includes(id))) fail('The device is outside your department scope.')
    const departmentIds = await activeDepartments(actor, body.departmentIds || device.department_ids || [])
    const allowedUids = Array.isArray(body.allowedUids) ? [...new Set(body.allowedUids.filter(safeId))] : device.allowed_uids || []
    if (allowedUids.length > 400) fail('A device can be assigned to no more than 400 named users.', 400)
    await db.runTransaction(async (tx) => {
      const ownerRef = memberCollection(actor.workspaceId).doc(actor.workspaceId)
      const [latestActorSnap, latestDeviceSnap, ownerSnap, allowedDevicesSnap] = await Promise.all([
        tx.get(actor.memberRef), tx.get(ref), tx.get(ownerRef), tx.get(deviceCollection(actor.workspaceId).where('status', '==', 'Allowed')),
      ])
      const latestActor = latestActorSnap.data(), latest = latestDeviceSnap.data()
      if (!latestActorSnap.exists || latestActor.status !== 'Active' || latestActor.rank !== actor.member.rank || !sameIds(latestActor.department_ids, actor.member.department_ids) || !latest || !sameIds(latest.department_ids, device.department_ids)) fail('Your access or this device changed while you were editing.', 409)
      if (latestActor.rank !== 4 && !(latest.department_ids || []).some((deptId) => (latestActor.department_ids || []).includes(deptId))) fail('The device is outside your department scope.')
      if (latestActor.rank < 3) fail('Administrator Rank is required for device management.')
      const [latestDepartmentSnaps, targetSnaps] = await Promise.all([
        Promise.all(departmentIds.map((deptId) => tx.get(departmentCollection(actor.workspaceId).doc(deptId)))),
        Promise.all(allowedUids.map((uid) => tx.get(memberCollection(actor.workspaceId).doc(uid)))),
      ])
      if ((latestActor.rank !== 4 && departmentIds.some((deptId) => !(latestActor.department_ids || []).includes(deptId))) || latestDepartmentSnaps.some((department) => !department.exists || department.data().status !== 'Active')) fail('Choose active device departments within your current scope.', 409)
      const deviceDepartmentSet = new Set(departmentIds)
      if (targetSnaps.some((target) => !target.exists || target.data().status !== 'Active' || target.data().account_type === 'customer' || !(target.data().department_ids || []).some((deptId) => deviceDepartmentSet.has(deptId)) || (latestActor.rank !== 4 && target.data().rank >= latestActor.rank))) fail('Device users must be active employees assigned to the selected device departments and within your Rank scope.', 409)
      if (['Blocked', 'Retired'].includes(status)) {
        const owner = ownerSnap.data()
        const ownerDepartments = owner?.department_ids || []
        const ownerCanUseAnotherDevice = allowedDevicesSnap.docs.some((candidate) => {
          if (candidate.id === id) return false
          const item = candidate.data(), allowed = item.allowed_uids || []
          return (item.department_ids || []).some((deptId) => ownerDepartments.includes(deptId)) && (!allowed.length || allowed.includes(actor.workspaceId))
        })
        if (!ownerCanUseAnotherDevice) fail('Enroll and allow another Owner device before blocking this one, to keep workspace recovery available.')
      }
      tx.update(ref, { status, department_ids: departmentIds, allowed_uids: allowedUids, updated_at: timestamp(), updated_by: actor.uid })
      tx.create(auditCollection(actor.workspaceId).doc(), { action: `device_${status.toLowerCase()}`, actor_uid: actor.uid, actor_email: actor.email, target_uid: id, workspace_id: actor.workspaceId, details: { department_ids: departmentIds, allowed_uids: allowedUids }, created_at: timestamp() })
    })
    return { updated: true }
  }

  async function savePolicy(actor, body) {
    requireRank(actor, 4)
    const version = cleanText(body.minimumAppVersion, 30)
    if (!/^\d+\.\d+\.\d+$/.test(version)) fail('Enter a version such as 0.3.19.', 400)
    const offlineHours = Number(body.offlineGraceHours)
    if (!Number.isInteger(offlineHours) || offlineHours < 0 || offlineHours > 24) fail('Offline grace must be between 0 and 24 hours.', 400)
    const data = {
      workspace_id: actor.workspaceId, minimum_app_version: version,
      offline_grace_hours: offlineHours, block_unenrolled_devices: true,
      disabled: body.disabled === true, version: crypto.randomUUID(), updated_by: actor.uid, updated_at: timestamp(),
    }
    await policyDoc(actor.workspaceId).set(data, { merge: true })
    await writeAudit(actor, 'policy_published', '', { minimum_app_version: version, offline_grace_hours: offlineHours, disabled: data.disabled, policy_version: data.version })
    return { saved: true, policy: (await policyDoc(actor.workspaceId).get()).data() }
  }

  async function activateInvitation(req, actor) {
    if (!actor) {
      const token = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '')
      if (!token) fail('Sign in with the invited account.', 401)
      let identity
      try { identity = await auth.verifyIdToken(token, true) } catch { fail('Your sign-in expired. Sign in again.', 401) }
      if (identity.email_verified !== true) fail('Verify your email before accepting the Cylinder invitation.')
      const profileRef = db.doc(`profiles/${identity.uid}`)
      const snap = await profileRef.get(), profile = snap.data()
      if (!profile || !safeId(profile.workspace_id) || !['Active', 'Pending'].includes(profile.status) || profile.email?.toLowerCase() !== identity.email?.toLowerCase()) fail('This account is not active for Cylinder.')
      const memberRef = memberCollection(profile.workspace_id).doc(identity.uid)
      const memberSnap = await memberRef.get()
      if (!memberSnap.exists) return { activated: false }
      if (memberSnap.data().status !== 'Pending') return { activated: false }
      let activated = false
      await db.runTransaction(async (tx) => {
        const [latestProfileSnap, latestMemberSnap] = await Promise.all([tx.get(profileRef), tx.get(memberRef)])
        const latestProfile = latestProfileSnap.data(), latestMember = latestMemberSnap.data()
        if (!latestProfileSnap.exists || !latestMemberSnap.exists || latestProfile.email?.toLowerCase() !== identity.email?.toLowerCase()) fail('This Cylinder invitation changed. Sign in again.')
        if (latestMember.status !== 'Pending') return
        if (!['Active', 'Pending'].includes(latestProfile.status) || (latestProfile.status === 'Pending' && !latestProfile.cylinder_managed)) fail('This account is not active for Cylinder.')
        if (latestProfile.status === 'Pending') tx.update(profileRef, { status: 'Active', email_verified: true, updated_at: timestamp() })
        tx.update(memberRef, { status: 'Active', accepted_at: timestamp(), updated_at: timestamp() })
        tx.create(auditCollection(profile.workspace_id).doc(), { action: 'member_invitation_accepted', actor_uid: identity.uid, target_uid: identity.uid, workspace_id: profile.workspace_id, details: { department_ids: latestMember.department_ids || [] }, created_at: timestamp() })
        activated = true
      })
      return { activated }
    }
    return { activated: false }
  }

  async function dispatch(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required.' })
    try {
      const body = req.body || {}
      if (body.action === 'activateInvitation') return res.status(200).json(await activateInvitation(req, null))
      const actor = await actorFor(req)
      let result
      switch (body.action) {
        case 'bootstrap': result = await listFor(actor); break
        case 'heartbeat': result = await heartbeat(actor, body); break
        case 'inviteMember': result = await inviteMember(actor, body); break
        case 'updateMember': result = await updateMember(actor, body); break
        case 'removeMember': result = await removeMember(actor, body); break
        case 'createDepartment': result = await createDepartment(actor, body); break
        case 'setDevice': result = await setDevice(actor, body); break
        case 'savePolicy': result = await savePolicy(actor, body); break
        default: fail('Unknown Cylinder management action.', 400)
      }
      return res.status(200).json(result)
    } catch (error) {
      if (error.status >= 500 || !error.status) logger.error('Cylinder control request failed', error.message)
      return res.status(error.status || 500).json({ error: error.message || 'Cylinder management request failed.' })
    }
  }
  return onRequest({ region: 'us-central1', cors: true, invoker: 'public', timeoutSeconds: 60, memory: '512MiB' }, dispatch)
}

module.exports = { createCylinderHandler, RANKS, RANK_NAMES, compareVersion }
