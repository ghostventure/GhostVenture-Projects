import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, BriefcaseBusiness, Building2, Clock3, KeyRound, MapPin, PencilLine, Save, ShieldCheck, UserRound, X } from 'lucide-react'
import './UserProfileCenter.css'

const blankProfile = {
  jobTitle: '',
  phone: '',
  location: '',
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
  workHours: '',
  about: '',
  accent: 'indigo',
}

const accents = [
  { id: 'indigo', label: 'Indigo' },
  { id: 'teal', label: 'Teal' },
  { id: 'coral', label: 'Coral' },
  { id: 'violet', label: 'Violet' },
]

function readProfile(email) {
  if (!email) return blankProfile
  try {
    const all = JSON.parse(window.localStorage.getItem('overhead.userProfile.details.v1') || '{}')
    const saved = all && !Array.isArray(all) && typeof all === 'object' ? all[email.toLowerCase()] : null
    const profile = { ...blankProfile }
    for (const key of ['jobTitle', 'phone', 'location', 'timeZone', 'workHours', 'about']) {
      if (typeof saved?.[key] === 'string') profile[key] = saved[key].slice(0, key === 'about' ? 280 : 100)
    }
    if (accents.some((accent) => accent.id === saved?.accent)) profile.accent = saved.accent
    return profile
  } catch {
    return blankProfile
  }
}

export default function UserProfileCenter({ session, backendState, onCredentialsChanged }) {
  const [profile, setProfile] = useState(() => readProfile(session?.email))
  const [draft, setDraft] = useState(profile)
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState('')
  const [credentialDraft, setCredentialDraft] = useState({ currentPassword: '', newEmail: session?.email || '', newPassword: '', confirmPassword: '' })
  const [credentialBusy, setCredentialBusy] = useState(false)
  const [credentialNotice, setCredentialNotice] = useState('')
  const [credentialNoticeError, setCredentialNoticeError] = useState(false)
  const [emailVerificationCode, setEmailVerificationCode] = useState('')
  const [localEmailVerificationPending, setLocalEmailVerificationPending] = useState(false)

  useEffect(() => {
    const next = readProfile(session?.email)
    setProfile(next)
    setDraft(next)
    setEditing(false)
    setNotice('')
  }, [session?.email])

  useEffect(() => {
    setCredentialDraft((current) => ({ ...current, newEmail: session?.email || '', currentPassword: '', newPassword: '', confirmPassword: '' }))
  }, [session?.email])

  const account = useMemo(() => (backendState?.userProfiles || []).find((item) => item.email?.toLowerCase() === session?.email?.toLowerCase()), [backendState?.userProfiles, session?.email])
  const identityName = session?.ownerName || account?.owner_name || session?.email || 'Your profile'
  const business = session?.businessName || account?.business_name || ''
  const initials = identityName.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'OH'
  const milestones = [
    { label: 'Name', complete: Boolean(identityName && identityName !== session?.email) },
    { label: 'Business', complete: Boolean(business) },
    { label: 'Role', complete: Boolean(session?.role) },
    { label: 'Job title', complete: Boolean(profile.jobTitle) },
    { label: 'Work location', complete: Boolean(profile.location) },
    { label: 'Time zone', complete: Boolean(profile.timeZone) },
  ]
  const completed = milestones.filter((item) => item.complete).length
  const percent = Math.round(completed / milestones.length * 100)

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function saveProfile(event) {
    event.preventDefault()
    const emailKey = session?.email?.toLowerCase()
    if (!emailKey) return
    try {
      const parsed = JSON.parse(window.localStorage.getItem('overhead.userProfile.details.v1') || '{}')
      const all = parsed && !Array.isArray(parsed) && typeof parsed === 'object' ? parsed : {}
      const saved = { ...blankProfile }
      for (const key of ['jobTitle', 'phone', 'location', 'timeZone', 'workHours', 'about']) saved[key] = String(draft[key] || '').trim().slice(0, key === 'about' ? 280 : 100)
      saved.accent = accents.some((accent) => accent.id === draft.accent) ? draft.accent : blankProfile.accent
      all[emailKey] = saved
      window.localStorage.setItem('overhead.userProfile.details.v1', JSON.stringify(all))
      setProfile(saved)
      setDraft(saved)
      setEditing(false)
      setNotice('Your workspace profile was saved on this device.')
      window.setTimeout(() => document.getElementById('upc-edit-profile')?.focus(), 0)
    } catch {
      setNotice('Could not save this profile on the device. Check available storage and try again.')
    }
  }

  function cancelEdit() {
    setDraft(profile)
    setEditing(false)
    setNotice('Profile edits discarded.')
    window.setTimeout(() => document.getElementById('upc-edit-profile')?.focus(), 0)
  }

  async function changeCredentials(event) {
    event.preventDefault()
    setCredentialNotice('')
    setCredentialNoticeError(false)
    if (credentialDraft.newPassword !== credentialDraft.confirmPassword) {
      setCredentialNotice('The new passwords do not match.')
      setCredentialNoticeError(true)
      return
    }
    if (credentialDraft.newPassword.length < 12) {
      setCredentialNotice('Use a new password with at least 12 characters.')
      setCredentialNoticeError(true)
      return
    }
    setCredentialBusy(true)
    try {
      const result = await window.overheadBackend.changeSignInCredentials({
        currentPassword: credentialDraft.currentPassword,
        newEmail: credentialDraft.newEmail,
        newPassword: credentialDraft.newPassword,
      })
      const oldEmail = String(session?.email || '').toLowerCase()
      if (result.emailChanged && oldEmail) {
        try {
          const all = JSON.parse(window.localStorage.getItem('overhead.userProfile.details.v1') || '{}')
          if (all[oldEmail] && !all[result.email.toLowerCase()]) all[result.email.toLowerCase()] = all[oldEmail]
          delete all[oldEmail]
          window.localStorage.setItem('overhead.userProfile.details.v1', JSON.stringify(all))
        } catch { /* Credential changes should not fail because optional profile details cannot migrate. */ }
      }
      setCredentialDraft({ currentPassword: '', newEmail: result.email, newPassword: '', confirmPassword: '' })
      onCredentialsChanged?.(result.email)
      setLocalEmailVerificationPending(result.emailChanged && result.verificationMethod === 'code')
      setEmailVerificationCode('')
      setCredentialNoticeError(false)
      setCredentialNotice(result.emailChanged
        ? result.verificationMethod === 'code'
          ? result.verificationSent
            ? `Sign-in details updated. Enter the verification code sent to ${result.email}.`
            : result.verificationQueued
              ? 'Sign-in details updated. A verification code was queued locally; configure email delivery before signing out.'
              : 'Sign-in details updated, but the verification message was not sent. Contact OverHead support before signing out.'
          : result.verificationSent
            ? `Sign-in details updated. Check ${result.email} for a verification link before your next sign-in.`
            : 'Sign-in details updated, but the verification link could not be sent. Contact OverHead support before signing out.'
        : 'Password updated for your OverHead sign-in.')
    } catch (reason) {
      setCredentialNotice(reason?.message || 'Could not update the sign-in details. Check the current password and try again.')
      setCredentialNoticeError(true)
    } finally {
      setCredentialBusy(false)
    }
  }

  async function verifyChangedEmail() {
    setCredentialBusy(true)
    setCredentialNotice('')
    setCredentialNoticeError(false)
    try {
      await window.overheadBackend.verifyEmail({ email: session?.email, code: emailVerificationCode })
      setLocalEmailVerificationPending(false)
      setEmailVerificationCode('')
      setCredentialNotice('Your new sign-in email is verified.')
      onCredentialsChanged?.(session?.email)
    } catch (reason) {
      setCredentialNotice(reason?.message || 'The email verification code could not be confirmed.')
      setCredentialNoticeError(true)
    } finally {
      setCredentialBusy(false)
    }
  }

  return (
    <section className="user-profile-center" aria-labelledby="user-profile-title">
      <header className={`upc-hero upc-accent-${profile.accent}`}>
        <div className="upc-hero-orbit upc-orbit-one" aria-hidden="true" />
        <div className="upc-hero-orbit upc-orbit-two" aria-hidden="true" />
        <div className="upc-hero-content">
          <div className="upc-avatar" aria-hidden="true">{initials}</div>
          <div className="upc-identity">
            <p className="upc-kicker">Your OverHead profile</p>
            <h2 id="user-profile-title">{identityName}</h2>
            <p>{profile.jobTitle || session?.role || 'Add your role to introduce yourself'}{business ? ` - ${business}` : ''}</p>
            <div className="upc-badges">
              <span><BadgeCheck size={14} /> {session?.role || 'Workspace member'}</span>
              <span><ShieldCheck size={14} /> {account ? account.email_verified ? 'Email verified' : 'Verification pending' : 'Sign-in profile'}</span>
              <span><Building2 size={14} /> {account?.shared_sync_status || 'Local profile'}</span>
            </div>
          </div>
          {!editing && <button id="upc-edit-profile" type="button" className="upc-edit-button" aria-label="Edit your workspace profile" title="Edit profile details" onClick={() => { setDraft(profile); setEditing(true); setNotice('') }}><PencilLine size={16} /> Edit profile</button>}
        </div>
        <div className="upc-readiness">
          <div className="upc-readiness-top"><span>Profile completeness</span><strong>{percent}%</strong></div>
          <div className="upc-progress" role="progressbar" aria-label="Profile completeness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${percent}% complete`}><span aria-hidden="true" style={{ width: `${percent}%` }} /></div>
          <small id="upc-readiness-details">{completed === milestones.length ? 'Your workspace profile is looking sharp.' : `${milestones.length - completed} details left to round out your profile.`} Account verification and permissions are managed separately.</small>
        </div>
      </header>

      {editing ? (
        <form className="upc-edit-grid" onSubmit={saveProfile}>
          <div className="upc-section-heading"><div><p className="upc-kicker">Personal workspace details</p><h3>Make this space yours</h3></div><span>Saved locally on this device</span></div>
          <div className="upc-field-grid">
            <label>Role or title<input autoFocus autoComplete="organization-title" maxLength={80} value={draft.jobTitle} onChange={(event) => update('jobTitle', event.target.value)} placeholder="e.g. Studio manager" /></label>
            <label>Work phone <span className="upc-optional">Optional</span><input autoComplete="tel" type="tel" maxLength={40} value={draft.phone} onChange={(event) => update('phone', event.target.value)} placeholder="A number teammates can use" /></label>
            <label>Work location<input autoComplete="address-level2" maxLength={100} value={draft.location} onChange={(event) => update('location', event.target.value)} placeholder="City, region, or remote" /></label>
            <label>Time zone<input maxLength={60} value={draft.timeZone} onChange={(event) => update('timeZone', event.target.value)} placeholder="e.g. America/New_York" /></label>
            <label>Typical work hours <span className="upc-optional">Optional</span><input maxLength={80} value={draft.workHours} onChange={(event) => update('workHours', event.target.value)} placeholder="e.g. Mon-Fri, 9:00-5:00" /></label>
          </div>
          <label className="upc-about">A little about your work <span className="upc-optional">Optional</span><textarea rows="3" maxLength={280} value={draft.about} onChange={(event) => update('about', event.target.value)} placeholder="Share what you work on with your team." /><small>{draft.about.length}/280</small></label>
          <fieldset className="upc-accent-picker"><legend>Profile color</legend><div>{accents.map((accent) => <button key={accent.id} type="button" aria-pressed={draft.accent === accent.id} aria-label={`${accent.label} profile color`} title={accent.label} className={`upc-swatch upc-swatch-${accent.id}`} onClick={() => update('accent', accent.id)} />)}</div></fieldset>
          <p className="upc-local-note"><ShieldCheck size={15} /> These details stay in this OverHead installation and are not sent to a shared account.</p>
          <div className="upc-form-actions"><button type="button" className="upc-cancel" onClick={cancelEdit}><X size={16} /> Cancel</button><button type="submit" className="upc-save"><Save size={16} /> Save profile</button></div>
        </form>
      ) : (
        <div className="upc-detail-grid">
          <article className="upc-detail-card upc-account-card">
            <div className="upc-card-heading"><span className="upc-icon-tile"><UserRound size={18} /></span><div><h3>Account identity</h3><p>Connected to your OverHead sign-in</p></div></div>
            <dl><div><dt>Email</dt><dd>{session?.email || 'Not available'}</dd></div><div><dt>Business</dt><dd>{business || 'Add a business name in Accounts'}</dd></div><div><dt>Access role</dt><dd>{session?.role || 'Not available'} <span className="upc-managed">Managed access</span></dd></div><div><dt>License</dt><dd>{account?.license_number || 'No license linked'}</dd></div></dl>
            <small>Sign-in email and access role are managed by account security. This profile card does not change credentials or permissions.</small>
          </article>
          <article className="upc-detail-card upc-security-card">
            <div className="upc-card-heading"><span className="upc-icon-tile"><KeyRound size={18} /></span><div><h3>Sign-in security</h3><p>Change your OverHead email or password</p></div></div>
            <form className="upc-credentials-form" aria-busy={credentialBusy} onSubmit={changeCredentials}>
              <label>Current password<input type="password" autoComplete="current-password" required value={credentialDraft.currentPassword} onChange={(event) => setCredentialDraft((current) => ({ ...current, currentPassword: event.target.value }))} /></label>
              <label>New sign-in email<input type="email" autoComplete="email" required value={credentialDraft.newEmail} onChange={(event) => setCredentialDraft((current) => ({ ...current, newEmail: event.target.value }))} /></label>
              <label>New password<input type="password" autoComplete="new-password" minLength={12} required value={credentialDraft.newPassword} onChange={(event) => setCredentialDraft((current) => ({ ...current, newPassword: event.target.value }))} /></label>
              <label>Confirm new password<input type="password" autoComplete="new-password" minLength={12} required value={credentialDraft.confirmPassword} onChange={(event) => setCredentialDraft((current) => ({ ...current, confirmPassword: event.target.value }))} /></label>
              <small>Your current password is checked before the change. New email addresses must be verified. Passwords stay out of saved profile data.</small>
              <button className="upc-save" type="submit" disabled={credentialBusy}><KeyRound size={15} /> {credentialBusy ? 'Updating…' : 'Update sign-in details'}</button>
              {localEmailVerificationPending && <div className="upc-email-verify"><label>Verification code<input inputMode="numeric" autoComplete="one-time-code" value={emailVerificationCode} onChange={(event) => setEmailVerificationCode(event.target.value)} placeholder="Enter the 6-digit code" /></label><button className="upc-save" type="button" disabled={credentialBusy || emailVerificationCode.trim().length < 6} onClick={verifyChangedEmail}>Verify email</button></div>}
              {credentialNotice && <p className={`upc-notice${credentialNoticeError ? ' is-error' : ''}`} role={credentialNoticeError ? 'alert' : 'status'} aria-live={credentialNoticeError ? 'assertive' : 'polite'}>{credentialNotice}</p>}
            </form>
          </article>
          <article className="upc-detail-card">
            <div className="upc-card-heading"><span className="upc-icon-tile"><BriefcaseBusiness size={18} /></span><div><h3>Work profile</h3><p>Helpful context for your workspace</p></div></div>
            <dl><div><dt>Role or title</dt><dd>{profile.jobTitle || 'Not set'}</dd></div><div><dt>Work phone</dt><dd>{profile.phone || 'Not set'}</dd></div><div><dt>Work location</dt><dd><MapPin size={14} aria-hidden="true" /> {profile.location || 'Not set'}</dd></div><div><dt>Work hours</dt><dd><Clock3 size={14} aria-hidden="true" /> {profile.workHours || 'Not set'}</dd></div><div><dt>Time zone</dt><dd>{profile.timeZone || 'Not set'}</dd></div></dl>
            {profile.about && <p className="upc-about-display">{profile.about}</p>}
          </article>
          <article className="upc-detail-card upc-checklist-card">
            <div className="upc-card-heading"><span className="upc-icon-tile"><BadgeCheck size={18} /></span><div><h3>Profile checklist</h3><p>Optional details make your workspace easier to recognize</p></div></div>
            <ul>{milestones.map((item) => <li key={item.label} className={item.complete ? 'is-complete' : ''}><span aria-hidden="true">{item.complete ? '✓' : '·'}</span>{item.label}<small>{item.complete ? 'Added' : 'Add detail'}</small></li>)}</ul>
          </article>
        </div>
      )}
      {notice && <p className="upc-notice" role="status" aria-live="polite">{notice}</p>}
    </section>
  )
}
