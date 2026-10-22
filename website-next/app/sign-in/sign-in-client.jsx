'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword, reload, sendEmailVerification, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth'
import { doc, getDoc, getDocFromServer, serverTimestamp, writeBatch } from 'firebase/firestore'
import { firebaseAuth, firebaseDb } from '../firebase-client'

const blankWorkspace = { ownerName: '', businessName: '', email: '', password: '', confirmPassword: '', acceptedTerms: false }
const blankJoin = { workspaceId: '', email: '', password: '', confirmPassword: '' }
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function cleanUpUncommittedAccount(credential) {
  if (!credential?.user) return
  // A lost commit response does not mean the profile was not saved.
  // Delete a new Auth account only when the server confirms no profile exists.
  try {
    const profile = await getDocFromServer(doc(firebaseDb, 'profiles', credential.user.uid))
    if (!profile.exists()) await credential.user.delete()
  } catch { /* Preserve identity when the server cannot confirm the outcome. */ }
}

function errorMessage(error) {
  const code = String(error?.code || error?.message || '').toLowerCase()
  if (code.includes('configuration-not-found') || code.includes('operation-not-allowed')) return 'Email-and-password sign-in is not available yet. Please contact OverHead support.'
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'The email or password is not correct. Try again or reset your password.'
  if (code.includes('email-already-in-use')) return 'An account already exists for that email. Sign in or reset its password.'
  if (code.includes('weak-password')) return 'Use a password of at least 12 characters.'
  if (code.includes('too-many-requests')) return 'Too many attempts were made. Wait a few minutes, then try again or reset your password.'
  if (code.includes('network-request-failed')) return 'OverHead could not reach the sign-in service. Check your connection and try again.'
  if (code.includes('invalid-email')) return 'Enter a valid email address.'
  if (code.includes('user-disabled')) return 'This account is disabled. Contact the workspace administrator.'
  return 'We could not complete that request. Please try again.'
}

function validEmail(value) {
  return emailPattern.test(value.trim())
}

function PasswordField({ label = 'Password', value, onChange, confirm = false }) {
  const [visible, setVisible] = useState(false)
  return <label>{label}<div className="password-control"><input type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} placeholder={confirm ? 'Repeat your password' : 'At least 12 characters'} minLength="12" autoComplete={confirm ? 'new-password' : 'current-password'} required /><button className="password-toggle" type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? 'Hide' : 'Show'}</button></div></label>
}

export default function SignInClient() {
  const router = useRouter()
  const [mode, setMode] = useState('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [workspace, setWorkspace] = useState(blankWorkspace)
  const [join, setJoin] = useState(blankJoin)
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(true)
  const [verificationEmail, setVerificationEmail] = useState('')

  useEffect(() => { setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {}) }, [])

  function changeMode(next) {
    setMode(next); setNotice(''); setPassword('')
  }

  async function preparePersistence() {
    await setPersistence(firebaseAuth, rememberDevice ? browserLocalPersistence : browserSessionPersistence)
  }

  async function finishSignIn(credential) {
    const profile = await getDoc(doc(firebaseDb, 'profiles', credential.user.uid))
    if (!profile.exists()) {
      await signOut(firebaseAuth)
      throw new Error('auth/missing-workspace-profile')
    }
    await reload(credential.user)
    if (!firebaseAuth.currentUser?.emailVerified) {
      setVerificationEmail(credential.user.email || '')
      setMode('verify')
      setNotice('Check your inbox and verify your email before opening the workspace.')
      return
    }
    router.replace('/dashboard/')
  }

  async function signIn() {
    if (!validEmail(email) || !password) return setNotice('Enter your email address and password.')
    try {
      setWorking(true); setNotice(''); await preparePersistence()
      await finishSignIn(await signInWithEmailAndPassword(firebaseAuth, email.trim().toLowerCase(), password))
    } catch (error) { setNotice(error?.message === 'auth/missing-workspace-profile' ? 'This account is not connected to an OverHead workspace. Use the invitation you received or contact your administrator.' : errorMessage(error)) } finally { setWorking(false) }
  }

  async function createWorkspace() {
    if (!workspace.ownerName.trim() || !workspace.businessName.trim() || !validEmail(workspace.email)) return setNotice('Add your name, business name, and a valid email address.')
    if (workspace.password.length < 12) return setNotice('Use a password with at least 12 characters.')
    if (workspace.password !== workspace.confirmPassword) return setNotice('The passwords do not match.')
    if (!workspace.acceptedTerms) return setNotice('Accept the terms and privacy notice to continue.')
    let credential
    try {
      setWorking(true); setNotice(''); await preparePersistence()
      credential = await createUserWithEmailAndPassword(firebaseAuth, workspace.email.trim().toLowerCase(), workspace.password)
      const createdAt = serverTimestamp()
      const profile = { uid: credential.user.uid, owner_name: workspace.ownerName.trim(), business_name: workspace.businessName.trim(), email: credential.user.email, workspace_id: credential.user.uid, role: 'Administrator', status: 'Active', email_verified: false, terms_accepted_at: createdAt, last_sign_in: createdAt, created_at: createdAt, updated_at: createdAt }
      const batch = writeBatch(firebaseDb)
      batch.set(doc(firebaseDb, 'workspaces', credential.user.uid), { owner_uid: credential.user.uid, business_name: workspace.businessName.trim(), created_at: createdAt, updated_at: createdAt })
      batch.set(doc(firebaseDb, 'profiles', credential.user.uid), profile)
      await batch.commit()
      await updateProfile(credential.user, { displayName: workspace.ownerName.trim() }).catch(() => undefined)
      const verificationSent = await sendEmailVerification(credential.user).then(() => true).catch(() => false)
      setVerificationEmail(credential.user.email || workspace.email.trim().toLowerCase())
      setMode('verify'); setNotice(verificationSent ? 'Your workspace is ready. We sent a verification link to your inbox.' : 'Your workspace is ready, but we could not send the verification email. Use “Send a new link” below.')
    } catch (error) {
      await cleanUpUncommittedAccount(credential)
      await signOut(firebaseAuth).catch(() => undefined)
      setNotice(errorMessage(error))
    } finally { setWorking(false) }
  }

  async function joinWorkspace() {
    if (!join.workspaceId.trim() || !validEmail(join.email)) return setNotice('Enter the workspace ID from your administrator and your invited email.')
    if (join.password.length < 12 || join.password !== join.confirmPassword) return setNotice('Use matching passwords with at least 12 characters.')
    let credential
    try {
      setWorking(true); setNotice(''); await preparePersistence()
      credential = await createUserWithEmailAndPassword(firebaseAuth, join.email.trim().toLowerCase(), join.password)
      const inviteRef = doc(firebaseDb, 'workspaces', join.workspaceId.trim(), 'invites', credential.user.email)
      const invite = await getDoc(inviteRef)
      if (!invite.exists()) throw new Error('auth/invalid-invitation')
      const inviteData = invite.data(); const createdAt = serverTimestamp()
      const batch = writeBatch(firebaseDb)
      batch.set(doc(firebaseDb, 'profiles', credential.user.uid), { uid: credential.user.uid, owner_name: inviteData.name || credential.user.email, business_name: inviteData.business_name || 'OverHead workspace', email: credential.user.email, workspace_id: join.workspaceId.trim(), role: inviteData.role, status: 'Active', email_verified: false, seat_charge_cents: Number(inviteData.seat_charge_cents) || 0, seat_number: Number(inviteData.seat_number) || 0, terms_accepted_at: createdAt, last_sign_in: createdAt, created_at: createdAt, updated_at: createdAt })
      batch.delete(inviteRef)
      await batch.commit()
      const verificationSent = await sendEmailVerification(credential.user).then(() => true).catch(() => false)
      setVerificationEmail(credential.user.email || join.email.trim().toLowerCase())
      setMode('verify'); setNotice(verificationSent ? 'Your account is connected. We sent a verification link to your inbox.' : 'Your account is connected, but we could not send the verification email. Use “Send a new link” below.')
    } catch (error) {
      await cleanUpUncommittedAccount(credential); await signOut(firebaseAuth).catch(() => undefined)
      setNotice(String(error?.message || '').includes('invalid-invitation') ? 'We could not find an active invitation for that workspace ID and email. Check the invitation, then try again.' : errorMessage(error))
    } finally { setWorking(false) }
  }

  async function requestRecovery() {
    if (!validEmail(email)) return setNotice('Enter the email address for your OverHead account.')
    try { setWorking(true); setNotice(''); await sendPasswordResetEmail(firebaseAuth, email.trim().toLowerCase()); setNotice('If that email belongs to an OverHead account, a password-reset link is on its way.') } catch (error) { setNotice(errorMessage(error)) } finally { setWorking(false) }
  }

  async function resendVerification() {
    try { setWorking(true); setNotice(''); if (!firebaseAuth.currentUser) throw new Error('auth/session-expired'); await sendEmailVerification(firebaseAuth.currentUser); setNotice('A new verification link is on its way.') } catch (error) { setNotice(errorMessage(error)) } finally { setWorking(false) }
  }

  async function completeVerification() {
    try { setWorking(true); setNotice(''); if (!firebaseAuth.currentUser) throw new Error('auth/session-expired'); await reload(firebaseAuth.currentUser); if (!firebaseAuth.currentUser.emailVerified) return setNotice('That email is not verified yet. Open the latest link from your inbox, then try again.'); router.replace('/dashboard/') } catch (error) { setNotice(errorMessage(error)) } finally { setWorking(false) }
  }

  return <section className="auth-layout"><div className="auth-intro"><p className="eyebrow">OverHead Workspace</p><h1>Sign in and get back to the work that matters.</h1><p>One account works on the website and OverHead Desktop. Your role determines what you can open after you sign in.</p><div className="auth-points"><span>One workspace identity</span><span>Private-device sign-in choice</span><span>Administrator-managed access</span></div></div><div className="auth-panel"><div className="auth-tabs"><button className={mode === 'sign-in' ? 'active' : ''} type="button" onClick={() => changeMode('sign-in')}>Sign in</button><button className={mode === 'create' ? 'active' : ''} type="button" onClick={() => changeMode('create')}>Create workspace</button><button className={mode === 'join' ? 'active' : ''} type="button" onClick={() => changeMode('join')}>Join workspace</button></div>{mode === 'sign-in' && <form onSubmit={(event) => { event.preventDefault(); signIn() }}><h2>Welcome back.</h2><p>Use the same email and password on the website and OverHead Desktop.</p><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="owner@business.com" autoComplete="email" required /></label><PasswordField value={password} onChange={setPassword} /><label className="checkbox-line"><input type="checkbox" checked={rememberDevice} onChange={(event) => setRememberDevice(event.target.checked)} />Keep me signed in on this private device</label><button className="primary" type="submit" disabled={working}>{working ? 'Signing in...' : 'Sign in to dashboard'}</button><button className="text-button" type="button" onClick={() => changeMode('recover')}>Forgot your password?</button></form>}{mode === 'create' && <form onSubmit={(event) => { event.preventDefault(); createWorkspace() }}><h2>Create your workspace.</h2><p>You will be its administrator and can later invite managers and staff.</p><label>Your name<input value={workspace.ownerName} onChange={(event) => setWorkspace((current) => ({ ...current, ownerName: event.target.value }))} placeholder="Administrator name" autoComplete="name" required /></label><label>Business name<input value={workspace.businessName} onChange={(event) => setWorkspace((current) => ({ ...current, businessName: event.target.value }))} placeholder="Business workspace" autoComplete="organization" required /></label><label>Email address<input type="email" value={workspace.email} onChange={(event) => setWorkspace((current) => ({ ...current, email: event.target.value }))} placeholder="owner@business.com" autoComplete="email" required /></label><PasswordField label="Create password" value={workspace.password} onChange={(value) => setWorkspace((current) => ({ ...current, password: value }))} /><PasswordField label="Confirm password" value={workspace.confirmPassword} onChange={(value) => setWorkspace((current) => ({ ...current, confirmPassword: value }))} confirm /><label className="checkbox-line"><input type="checkbox" checked={workspace.acceptedTerms} onChange={(event) => setWorkspace((current) => ({ ...current, acceptedTerms: event.target.checked }))} />I acknowledge the terms and privacy notice.</label><button className="primary" type="submit" disabled={working}>{working ? 'Creating...' : 'Create secure workspace'}</button></form>}{mode === 'join' && <form onSubmit={(event) => { event.preventDefault(); joinWorkspace() }}><h2>Join your workspace.</h2><p>Use the workspace ID and email address from your invitation.</p><label>Workspace ID<input value={join.workspaceId} onChange={(event) => setJoin((current) => ({ ...current, workspaceId: event.target.value }))} placeholder="Workspace ID" autoComplete="off" required /></label><label>Email address<input type="email" value={join.email} onChange={(event) => setJoin((current) => ({ ...current, email: event.target.value }))} placeholder="you@business.com" autoComplete="email" required /></label><PasswordField label="Create password" value={join.password} onChange={(value) => setJoin((current) => ({ ...current, password: value }))} /><PasswordField label="Confirm password" value={join.confirmPassword} onChange={(value) => setJoin((current) => ({ ...current, confirmPassword: value }))} confirm /><button className="primary" type="submit" disabled={working}>{working ? 'Joining...' : 'Join invited workspace'}</button></form>}{mode === 'recover' && <form onSubmit={(event) => { event.preventDefault(); requestRecovery() }}><h2>Reset your password.</h2><p>Enter your account email. If it is registered, we will send a reset link.</p><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="owner@business.com" autoComplete="email" required /></label><button className="primary" type="submit" disabled={working}>{working ? 'Requesting...' : 'Send reset link'}</button><button className="text-button" type="button" onClick={() => changeMode('sign-in')}>Return to sign in</button></form>}{mode === 'verify' && <section><h2>Verify your email.</h2><p>We sent a verification link to <strong>{verificationEmail || firebaseAuth.currentUser?.email || 'your email address'}</strong>. Open it in this browser, then return here.</p><button className="primary" type="button" disabled={working} onClick={completeVerification}>{working ? 'Checking...' : 'I verified my email'}</button><button className="text-button" type="button" disabled={working} onClick={resendVerification}>Send a new link</button><button className="text-button" type="button" disabled={working} onClick={() => { signOut(firebaseAuth); changeMode('sign-in') }}>Use a different account</button></section>}{notice && <p className="notice" role="status">{notice}</p>}<p className="auth-disclosure">OverHead keeps your password with Firebase Authentication. Workspace access is enforced by Firebase and Firestore rules, not browser-local data.</p></div></section>
}
