'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { firebaseAuth, firebaseDb } from '../firebase-client'

const blankWorkspace = { ownerName: '', businessName: '', email: '', password: '', confirmPassword: '', acceptedTerms: false }
const blankJoin = { workspaceId: '', email: '', password: '', confirmPassword: '' }

function errorMessage(error) {
  const code = error?.code || ''
  if (code.includes('configuration-not-found') || code.includes('operation-not-allowed')) return 'Firebase Email/Password sign-in has not been enabled for this project yet. Enable it in Firebase Authentication, then try again.'
  if (code.includes('email-already-in-use')) return 'An account already exists for that email. Sign in instead.'
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'That email and password do not match an account.'
  if (code.includes('weak-password')) return 'Use a password with at least 12 characters.'
  return error?.message || 'The account request could not be completed.'
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

  async function finishSignIn(credential) {
    const profile = await getDoc(doc(firebaseDb, 'profiles', credential.user.uid))
    if (!profile.exists()) {
      await signOut(firebaseAuth)
      throw new Error('This sign-in does not have a registered OverHead workspace profile. Use the workspace invite flow or contact an administrator.')
    }
    router.push('/dashboard/')
  }

  async function signIn() {
    try {
      setWorking(true); setNotice('')
      await finishSignIn(await signInWithEmailAndPassword(firebaseAuth, email.trim().toLowerCase(), password))
    } catch (error) { setNotice(errorMessage(error)) } finally { setWorking(false) }
  }

  async function createWorkspace() {
    if (!workspace.ownerName.trim() || !workspace.businessName.trim() || !workspace.email.includes('@')) return setNotice('Add your name, business name, and a valid email to create the workspace.')
    if (workspace.password.length < 12) return setNotice('Use a password with at least 12 characters.')
    if (workspace.password !== workspace.confirmPassword) return setNotice('The password confirmation does not match.')
    if (!workspace.acceptedTerms) return setNotice('Accept the terms acknowledgement to create the workspace.')
    try {
      setWorking(true); setNotice('')
      const credential = await createUserWithEmailAndPassword(firebaseAuth, workspace.email.trim().toLowerCase(), workspace.password)
      const createdAt = serverTimestamp()
      const profile = { uid: credential.user.uid, owner_name: workspace.ownerName.trim(), business_name: workspace.businessName.trim(), email: credential.user.email, workspace_id: credential.user.uid, role: 'Administrator', status: 'Active', email_verified: false, terms_accepted_at: createdAt, last_sign_in: createdAt, created_at: createdAt, updated_at: createdAt }
      const batch = writeBatch(firebaseDb)
      batch.set(doc(firebaseDb, 'workspaces', credential.user.uid), { owner_uid: credential.user.uid, business_name: workspace.businessName.trim(), created_at: createdAt, updated_at: createdAt })
      batch.set(doc(firebaseDb, 'profiles', credential.user.uid), profile)
      await batch.commit()
      await updateProfile(credential.user, { displayName: workspace.ownerName.trim() })
      await sendEmailVerification(credential.user).catch(() => undefined)
      router.push('/dashboard/')
    } catch (error) { setNotice(errorMessage(error)) } finally { setWorking(false) }
  }

  async function joinWorkspace() {
    if (!join.workspaceId.trim() || !join.email.includes('@')) return setNotice('Enter the workspace ID from your administrator and your invited email.')
    if (join.password.length < 12 || join.password !== join.confirmPassword) return setNotice('Use a matching password with at least 12 characters.')
    let credential
    try {
      setWorking(true); setNotice('')
      credential = await createUserWithEmailAndPassword(firebaseAuth, join.email.trim().toLowerCase(), join.password)
      const inviteRef = doc(firebaseDb, 'workspaces', join.workspaceId.trim(), 'invites', credential.user.email)
      const invite = await getDoc(inviteRef)
      if (!invite.exists()) throw new Error('No active invitation was found for that email and workspace ID.')
      const inviteData = invite.data()
      const createdAt = serverTimestamp()
      const batch = writeBatch(firebaseDb)
      batch.set(doc(firebaseDb, 'profiles', credential.user.uid), { uid: credential.user.uid, owner_name: inviteData.name || credential.user.email, business_name: inviteData.business_name || 'OverHead workspace', email: credential.user.email, workspace_id: join.workspaceId.trim(), role: inviteData.role, status: 'Active', email_verified: false, terms_accepted_at: createdAt, last_sign_in: createdAt, created_at: createdAt, updated_at: createdAt })
      batch.delete(inviteRef)
      await batch.commit()
      await sendEmailVerification(credential.user).catch(() => undefined)
      router.push('/dashboard/')
    } catch (error) {
      // Do not strand an unusable Auth account when its invitation is invalid.
      await credential?.user.delete().catch(() => undefined)
      await signOut(firebaseAuth).catch(() => undefined)
      setNotice(errorMessage(error))
    } finally { setWorking(false) }
  }

  async function requestRecovery() {
    try { setWorking(true); setNotice(''); await sendPasswordResetEmail(firebaseAuth, email.trim().toLowerCase()); setNotice('A password reset email has been requested. Check the inbox for the account email.') } catch (error) { setNotice(errorMessage(error)) } finally { setWorking(false) }
  }

  return <section className="auth-layout"><div className="auth-intro"><p className="eyebrow">OverHead Workspace</p><h1>Sign in to the workspace your role allows.</h1><p>One Firebase-backed account registry connects the website and OverHead Desktop, while workspace roles determine what each administrator, manager, and staff member can access.</p><div className="auth-points"><span>Shared workspace identity</span><span>Role-aware access</span><span>Administrator-managed invites</span></div></div><div className="auth-panel"><div className="auth-tabs"><button className={mode === 'sign-in' ? 'active' : ''} type="button" onClick={() => { setMode('sign-in'); setNotice('') }}>Sign in</button><button className={mode === 'create' ? 'active' : ''} type="button" onClick={() => { setMode('create'); setNotice('') }}>Create workspace</button><button className={mode === 'join' ? 'active' : ''} type="button" onClick={() => { setMode('join'); setNotice('') }}>Join workspace</button></div>{mode === 'sign-in' && <><h2>Welcome back.</h2><p>Use the same email and password on the website and OverHead Desktop.</p><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="owner@business.com" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" /></label><button className="primary" type="button" disabled={working} onClick={signIn}>{working ? 'Signing in...' : 'Sign in to dashboard'}</button><button className="text-button" type="button" onClick={() => { setMode('recover'); setNotice('') }}>Need account recovery?</button></>}{mode === 'create' && <><h2>Create an administrator workspace.</h2><p>The person creating the workspace becomes its administrator and can later invite managers and staff.</p><label>Your name<input value={workspace.ownerName} onChange={(event) => setWorkspace((current) => ({ ...current, ownerName: event.target.value }))} placeholder="Administrator name" /></label><label>Business name<input value={workspace.businessName} onChange={(event) => setWorkspace((current) => ({ ...current, businessName: event.target.value }))} placeholder="Business workspace" /></label><label>Email address<input type="email" value={workspace.email} onChange={(event) => setWorkspace((current) => ({ ...current, email: event.target.value }))} placeholder="owner@business.com" /></label><label>Password<input type="password" value={workspace.password} onChange={(event) => setWorkspace((current) => ({ ...current, password: event.target.value }))} placeholder="At least 12 characters" /></label><label>Confirm password<input type="password" value={workspace.confirmPassword} onChange={(event) => setWorkspace((current) => ({ ...current, confirmPassword: event.target.value }))} placeholder="Repeat your password" /></label><label className="checkbox-line"><input type="checkbox" checked={workspace.acceptedTerms} onChange={(event) => setWorkspace((current) => ({ ...current, acceptedTerms: event.target.checked }))} />I acknowledge the terms and privacy notice.</label><button className="primary" type="button" disabled={working} onClick={createWorkspace}>{working ? 'Creating...' : 'Create secure workspace'}</button></>}{mode === 'join' && <><h2>Join an existing workspace.</h2><p>Ask your administrator for the workspace ID and make sure they created an invite for this exact email address.</p><label>Workspace ID<input value={join.workspaceId} onChange={(event) => setJoin((current) => ({ ...current, workspaceId: event.target.value }))} placeholder="Workspace ID" /></label><label>Email address<input type="email" value={join.email} onChange={(event) => setJoin((current) => ({ ...current, email: event.target.value }))} placeholder="your@business.com" /></label><label>Password<input type="password" value={join.password} onChange={(event) => setJoin((current) => ({ ...current, password: event.target.value }))} placeholder="At least 12 characters" /></label><label>Confirm password<input type="password" value={join.confirmPassword} onChange={(event) => setJoin((current) => ({ ...current, confirmPassword: event.target.value }))} placeholder="Repeat your password" /></label><button className="primary" type="button" disabled={working} onClick={joinWorkspace}>{working ? 'Joining...' : 'Join invited workspace'}</button></>}{mode === 'recover' && <><h2>Recover your account.</h2><p>Enter your shared account email to request a Firebase password reset message.</p><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="owner@business.com" /></label><button className="primary" type="button" disabled={working} onClick={requestRecovery}>{working ? 'Requesting...' : 'Send password reset'}</button><button className="text-button" type="button" onClick={() => { setMode('sign-in'); setNotice('') }}>Return to sign in</button></>}{notice && <p className="notice">{notice}</p>}<p className="auth-disclosure">Access is backed by Firebase Authentication. Workspace roles and shared records are enforced by Firestore rules rather than browser-local data.</p></div></section>
}
