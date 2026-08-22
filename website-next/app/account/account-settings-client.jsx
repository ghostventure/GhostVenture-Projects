'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { firebaseAuth, firebaseDb } from '../firebase-client'

export default function AccountSettingsClient() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [license, setLicense] = useState(null)
  const [businessName, setBusinessName] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => onAuthStateChanged(firebaseAuth, async (user) => {
    if (!user) { router.replace('/sign-in/'); return }
    const snapshot = await getDoc(doc(firebaseDb, 'profiles', user.uid))
    if (!snapshot.exists()) { router.replace('/sign-in/'); return }
    setProfile(snapshot.data()); setBusinessName(snapshot.data().business_name)
  }), [router])

  useEffect(() => {
    if (!profile?.workspace_id || !firebaseAuth.currentUser?.uid) return undefined
    return onSnapshot(doc(firebaseDb, 'workspaces', profile.workspace_id, 'licenses', firebaseAuth.currentUser.uid), (snapshot) => setLicense(snapshot.exists() ? snapshot.data() : null), (error) => setNotice(error.message || 'License status could not be loaded.'))
  }, [profile?.workspace_id])

  async function saveProfile() {
    try { await updateDoc(doc(firebaseDb, 'profiles', firebaseAuth.currentUser.uid), { business_name: businessName.trim() || profile.business_name, updated_at: serverTimestamp() }); setProfile((current) => ({ ...current, business_name: businessName.trim() || current.business_name })); setNotice('Workspace settings saved.') } catch (error) { setNotice(error.message || 'Settings could not be saved.') }
  }

  if (!profile) return <section className="dashboard-loading">Checking secure workspace access...</section>
  const licenseState = license?.status || 'Pending entitlement'
  return <section className="settings-shell"><div className="settings-heading"><div><p className="eyebrow">Protected workspace</p><h1>Account settings</h1><p>These settings belong to your Firebase-backed workspace identity.</p></div><Link className="secondary dark-secondary" href="/dashboard/">Back to dashboard</Link></div><div className="settings-grid"><section className="dashboard-panel"><span>Profile</span><h2>{profile.owner_name}</h2><p>{profile.email}</p><label>Business name<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} /></label><button className="primary" type="button" onClick={saveProfile}>Save changes</button>{notice && <p className="notice">{notice}</p>}</section><section className="dashboard-panel"><span>Access</span><h2>Workspace protection</h2><div className="control-list"><div><span>Role</span><strong>{profile.role}</strong></div><div><span>Workspace ID</span><strong>{profile.workspace_id}</strong></div><div><span>Email status</span><strong>{firebaseAuth.currentUser?.emailVerified ? 'Verified' : 'Pending verification'}</strong></div><div><span>Account source</span><strong>Firebase Authentication</strong></div></div><p>Administrators manage roles and invitations from the workspace dashboard. Managers and staff can only change their own profile details.</p></section><section className="dashboard-panel"><span>Workspace license</span><h2>{license?.tier ? `${license.tier[0].toUpperCase()}${license.tier.slice(1)} access` : 'License pending'}</h2><div className="control-list"><div><span>Status</span><strong>{licenseState}</strong></div><div><span>License record</span><strong>{license?.license_number || 'Assigned automatically when an entitlement is active'}</strong></div><div><span>Subscription record</span><strong>{license?.subscription_number || 'No active subscription record'}</strong></div></div><p>OverHead keeps these identifiers for the workspace. You do not need to copy or manage them. The website and installed desktop resolve the same workspace-member license.</p></section></div></section>
}
