const { applicationDefault, getApps, initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')

const [uidOrEmail, action, requestedAlias = ''] = process.argv.slice(2)

async function main() {
  if (!uidOrEmail || !['grant', 'revoke'].includes(action)) {
    throw new Error('Usage: node functions/scripts/set-overhead-staff-claim.js <firebase-uid-or-email> grant|revoke [@overheadteam.com-alias]')
  }
  if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'overhead-office' })
  const auth = getAuth()
  const user = uidOrEmail.includes('@') ? await auth.getUserByEmail(uidOrEmail.trim().toLowerCase()) : await auth.getUser(uidOrEmail)
  if (action === 'grant' && (!user.emailVerified || !user.email)) {
    throw new Error('Only an account with a verified email can receive the OverHead Staff claim.')
  }
  const email = String(user.email || '').trim().toLowerCase()
  const alias = String(requestedAlias || (email.endsWith('@overheadteam.com') ? email : '')).trim().toLowerCase()
  if (action === 'grant' && !alias.endsWith('@overheadteam.com')) {
    throw new Error('For a personal login email, provide the staff member’s assigned @overheadteam.com alias.')
  }
  const claims = { ...(user.customClaims || {}) }
  if (action === 'grant') {
    claims.overhead_staff = true
    claims.overhead_staff_alias = alias
  } else {
    delete claims.overhead_staff
    delete claims.overhead_staff_alias
  }
  await auth.setCustomUserClaims(user.uid, claims)
  console.log(`OverHead Staff access ${action === 'grant' ? 'granted to' : 'revoked for'} ${user.email || user.uid}. Sign out and back in to refresh the ID token.`)
}

main().catch((error) => {
  console.error(error.message || 'Unable to update staff claims.')
  process.exitCode = 1
})
