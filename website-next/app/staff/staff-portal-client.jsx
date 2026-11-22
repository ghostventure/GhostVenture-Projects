'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getIdTokenResult, onAuthStateChanged, signOut } from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { firebaseAuth } from '../firebase-client'

const api = httpsCallable(getFunctions(firebaseAuth.app, 'us-central1'), 'staffPortalApi')

const features = [
  ['customers', 'Customer management'],
  ['tasks', 'Tasks and work queues'],
  ['backups', 'Backups'],
  ['support_bundle', 'Support bundles'],
  ['workflow_jobs', 'Workflow automation'],
  ['legal_acknowledgements', 'Legal acknowledgements'],
  ['roles', 'Team roles'],
  ['data_export', 'Data export'],
  ['restore_validation', 'Restore validation'],
  ['fraud_detection', 'Fraud detection'],
  ['stripe', 'Stripe billing tools'],
  ['server_deployment', 'Cylinder server deployment'],
]

const collections = [
  ['profiles', 'Workspace people'],
  ['customers', 'Customer records'],
  ['tasks', 'Tasks'],
  ['approvals', 'Approvals'],
  ['support_tickets', 'Support tickets'],
  ['licenses', 'Licenses'],
  ['invites', 'Invitations'],
  ['audit_events', 'Workspace audit'],
]

function messageFor(error) {
  const code = String(error?.code || '')
  if (code.includes('permission-denied')) return 'This account is not authorized for the OverHead Staff portal.'
  if (code.includes('unauthenticated')) return 'Sign in with an authorized OverHead Staff account.'
  return error?.message || 'The staff action could not be completed.'
}

function pretty(value) {
  return JSON.stringify(value, null, 2)
}

function valueForFeature(records, featureId) {
  const override = records?.staff_feature_overrides?.find((item) => item.id === featureId)
  if (!override) return { mode: 'inherit', expiresAt: '' }
  if (override.expires_at && Date.parse(override.expires_at) <= Date.now()) return { mode: 'expired', expiresAt: override.expires_at }
  return { mode: override.enabled ? 'enabled' : 'disabled', expiresAt: override.expires_at || '' }
}

export default function StaffPortalClient() {
  const [identity, setIdentity] = useState(null)
  const [access, setAccess] = useState('checking')
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [workspace, setWorkspace] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [collectionId, setCollectionId] = useState('profiles')
  const [recordId, setRecordId] = useState('')
  const [recordDraft, setRecordDraft] = useState('')
  const [reason, setReason] = useState('')
  const [featureReason, setFeatureReason] = useState('')
  const [featureExpiry, setFeatureExpiry] = useState('')
  const [globalAudit, setGlobalAudit] = useState([])

  const invoke = useCallback(async (payload) => {
    const response = await api(payload)
    return response.data
  }, [])

  const checkAccess = useCallback(async (user) => {
    if (!user) {
      setIdentity(null)
      setAccess('signed-out')
      return
    }
    setIdentity({ uid: user.uid, email: user.email || '' })
    setAccess('checking')
    try {
      const token = await getIdTokenResult(user, true)
      const email = String(user.email || '').trim().toLowerCase()
      const alias = String(token.claims.overhead_staff_alias || '').trim().toLowerCase()
      const officialEmail = email.endsWith('@overheadteam.com') || alias.endsWith('@overheadteam.com')
      if (token.claims.overhead_staff === true && token.claims.email_verified === true && officialEmail) {
        setAccess('authorized')
        setNotice('')
        return
      }
      setAccess('denied')
    } catch (error) {
      setAccess('denied')
      setNotice(messageFor(error))
    }
  }, [])

  useEffect(() => onAuthStateChanged(firebaseAuth, checkAccess), [checkAccess])

  const loadAudit = useCallback(async () => {
    try {
      const response = await invoke({ action: 'audit' })
      setGlobalAudit(response.events || [])
    } catch (error) {
      setNotice(messageFor(error))
    }
  }, [invoke])

  useEffect(() => {
    if (access === 'authorized') loadAudit()
  }, [access, loadAudit])

  async function refreshAccess() {
    if (!firebaseAuth.currentUser) return
    setWorking(true)
    await checkAccess(firebaseAuth.currentUser)
    setWorking(false)
  }

  async function searchWorkspaces(event) {
    event.preventDefault()
    setWorking(true)
    setNotice('Searching authorized workspace records…')
    try {
      const response = await invoke({ action: 'search', query })
      setResults(response.workspaces || [])
      setNotice(`${response.workspaces?.length || 0} workspace${response.workspaces?.length === 1 ? '' : 's'} found.`)
    } catch (error) {
      setNotice(messageFor(error))
    } finally {
      setWorking(false)
    }
  }

  async function openWorkspace(item) {
    setWorking(true)
    setNotice(`Loading ${item.business_name}…`)
    try {
      const response = await invoke({ action: 'load_workspace', workspaceId: item.id })
      setWorkspace(response)
      setActiveTab('overview')
      setCollectionId('profiles')
      setRecordId('')
      setNotice(`Workspace ${response.workspace.business_name || response.workspace.id} is open in staff support mode.`)
    } catch (error) {
      setNotice(messageFor(error))
    } finally {
      setWorking(false)
    }
  }

  const currentRows = useMemo(() => {
    if (!workspace) return []
    return collectionId === 'profiles' ? workspace.profiles || [] : workspace.records?.[collectionId] || []
  }, [workspace, collectionId])

  const availableCollections = useMemo(() => {
    const known = new Map(collections)
    const dynamic = (workspace?.collectionNames || []).map((id) => [id, known.get(id) || id.replaceAll('_', ' ')])
    return [...collections, ...dynamic.filter(([id]) => !known.has(id))]
  }, [workspace])

  const editableCollections = ['profiles', 'customers', 'tasks', 'approvals', 'support_tickets']

  async function chooseCollection(id) {
    setCollectionId(id)
    setRecordId('')
    if (!workspace || id === 'profiles' || Object.prototype.hasOwnProperty.call(workspace.records || {}, id)) return
    setWorking(true)
    try {
      const response = await invoke({ action: 'read_collection', workspaceId: workspace.workspace.id, collection: id })
      setWorkspace((current) => current ? { ...current, records: { ...current.records, [id]: response.records || [] } } : current)
    } catch (error) {
      setNotice(messageFor(error))
    } finally {
      setWorking(false)
    }
  }

  function selectRecord(record) {
    const { id, ...document } = record
    setRecordId(id)
    setRecordDraft(pretty(document))
    setReason('')
  }

  async function saveRecord(event) {
    event.preventDefault()
    if (!workspace || !recordId) return
    let next
    try {
      next = JSON.parse(recordDraft)
    } catch {
      setNotice('Record JSON is invalid. Correct it before saving.')
      return
    }
    const before = currentRows.find((item) => item.id === recordId) || {}
    const previous = { ...before }
    delete previous.id
    const removed = Object.keys(previous).filter((key) => !Object.prototype.hasOwnProperty.call(next, key))
    if (removed.length) {
      setNotice(`Fields cannot be removed here. Clear a field value instead: ${removed.join(', ')}.`)
      return
    }
    const changes = Object.fromEntries(Object.entries(next).filter(([key, value]) => JSON.stringify(previous[key]) !== JSON.stringify(value)))
    if (!Object.keys(changes).length) {
      setNotice('No database values changed.')
      return
    }
    setWorking(true)
    try {
      await invoke({ action: 'update_document', workspaceId: workspace.workspace.id, collection: collectionId, documentId: recordId, changes, reason })
      const updated = await invoke({ action: 'load_workspace', workspaceId: workspace.workspace.id })
      setWorkspace(updated)
      setNotice(`Updated ${collectionId}/${recordId}. The change was written to the staff audit log.`)
      setReason('')
    } catch (error) {
      setNotice(messageFor(error))
    } finally {
      setWorking(false)
    }
  }

  async function updateFeature(featureId, mode) {
    if (!workspace) return
    setWorking(true)
    try {
      await invoke({
        action: 'set_feature_override',
        workspaceId: workspace.workspace.id,
        featureId,
        mode,
        expiresAt: featureExpiry ? new Date(`${featureExpiry}T23:59:59.999Z`).toISOString() : '',
        reason: featureReason,
      })
      const updated = await invoke({ action: 'load_workspace', workspaceId: workspace.workspace.id })
      setWorkspace(updated)
      setFeatureReason('')
      setNotice(`${featureId} override updated and logged.`)
    } catch (error) {
      setNotice(messageFor(error))
    } finally {
      setWorking(false)
    }
  }

  if (access === 'checking') return <section className="staff-gate"><p className="eyebrow">OverHead Staff</p><h1>Verifying staff access</h1><p>Checking the signed-in account against the server-issued staff permission.</p></section>

  if (access === 'signed-out') return (
    <section className="staff-gate">
      <img className="staff-gate-logo" src="/favicon.svg" alt="" width="56" height="56" />
      <p className="eyebrow">Restricted workspace</p><h1>OverHead Staff Portal</h1>
      <p>Sign in with a verified OverHead Staff account. Workspace Administrator access does not grant company staff access.</p>
      <a className="primary" href="/sign-in/">Sign in</a>
    </section>
  )

  if (access === 'denied') return (
    <section className="staff-gate">
      <img className="staff-gate-logo" src="/favicon.svg" alt="" width="56" height="56" />
      <p className="eyebrow">Access restricted</p><h1>This account is not on the OverHead Staff team.</h1>
      <p>{identity?.email || 'The signed-in account'} has no active server-issued staff claim. Customer workspace roles cannot grant staff access.</p>
      {notice && <p className="staff-notice error" role="alert">{notice}</p>}
      <div className="staff-actions"><button className="secondary" type="button" disabled={working} onClick={refreshAccess}>Refresh access</button><button className="secondary" type="button" onClick={() => signOut(firebaseAuth)}>Sign out</button></div>
    </section>
  )

  return (
    <section className="staff-console">
      <header className="staff-topbar">
        <div className="staff-title-group"><img className="staff-header-logo" src="/favicon.svg" alt="" width="48" height="48" /><div><p className="eyebrow">Internal operations</p><h1>OverHead Staff Portal</h1><p>Customer workspace support, access corrections, feature overrides, and audited database changes.</p></div></div>
        <div className="staff-identity"><span>Verified staff</span><strong>{identity?.email}</strong><button className="secondary" type="button" onClick={() => signOut(firebaseAuth)}>Sign out</button></div>
      </header>

      <div className="staff-notice-row" role="status">
        <span className={working ? 'staff-status-dot busy' : 'staff-status-dot'} />
        <span>{notice || 'Staff actions require a reason and are recorded in the audit trail.'}</span>
      </div>

      <div className="staff-layout">
        <aside className="staff-sidebar">
          <form className="staff-search" onSubmit={searchWorkspaces}>
            <label htmlFor="staff-workspace-search">Find a workspace</label>
            <input id="staff-workspace-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Workspace ID, email, or name" minLength={2} required />
            <button className="primary" type="submit" disabled={working}>Search records</button>
          </form>
          <div className="staff-result-list" aria-label="Workspace results">
            {results.map((item) => <button className={workspace?.workspace.id === item.id ? 'staff-result selected' : 'staff-result'} type="button" key={item.id} disabled={working} onClick={() => openWorkspace(item)}><strong>{item.business_name}</strong><span>{item.owner_name || item.email || item.id}</span><small>{item.id} · {item.member_count} member{item.member_count === 1 ? '' : 's'}</small></button>)}
            {!results.length && <p className="staff-empty">Search by exact workspace ID, verified email, or the beginning of a name.</p>}
          </div>
          <div className="staff-boundary"><strong>Engineering boundary</strong><p>Escalate source bugs, schema migrations, credential or payment-provider failures, infrastructure outages, and device-local database repair to the development team. This portal does not expose secrets or perform hard deletes.</p></div>
        </aside>

        <div className="staff-main">
          {!workspace ? <div className="staff-empty-state"><span>01</span><h2>Choose a workspace to support</h2><p>Search opens the server-synced workspace database, member access, tickets, entitlement details, and audit records.</p><div className="staff-capability-grid"><article><strong>Database</strong><span>Inspect and correct approved fields across customer, task, approval, and support records.</span></article><article><strong>Access</strong><span>Correct a member's workspace role, active status, and support risk notes.</span></article><article><strong>Feature access</strong><span>Enable or disable plan features per workspace with a reason and optional expiry.</span></article></div></div> : <>
            <header className="staff-workspace-head"><div><p className="eyebrow">Selected workspace</p><h2>{workspace.workspace.business_name || workspace.workspace.id}</h2><p>{workspace.workspace.id} · {workspace.profiles.length} member{workspace.profiles.length === 1 ? '' : 's'} · {workspace.billing?.tier || 'No cloud plan'} / {workspace.billing?.status || 'unavailable'}</p></div><button className="secondary" type="button" disabled={working} onClick={() => openWorkspace({ id: workspace.workspace.id, business_name: workspace.workspace.business_name })}>Refresh</button></header>
            <nav className="staff-tabs" aria-label="Workspace support sections">
              {['overview', 'database', 'features', 'audit'].map((tab) => <button className={activeTab === tab ? 'selected' : ''} type="button" key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}
            </nav>

            {activeTab === 'overview' && <div className="staff-overview">
              <div className="staff-metric-grid"><article><span>Customer records</span><strong>{workspace.records.customers?.length || 0}</strong><small>Showing up to 40</small></article><article><span>Open support tickets</span><strong>{workspace.records.support_tickets?.filter((item) => !['Resolved', 'Closed'].includes(item.status)).length || 0}</strong><small>Loaded from workspace</small></article><article><span>Members</span><strong>{workspace.profiles.length}</strong><small>Role and access controls</small></article><article><span>Feature overrides</span><strong>{workspace.records.staff_feature_overrides?.filter((item) => !item.expires_at || Date.parse(item.expires_at) > Date.now()).length || 0}</strong><small>Active staff controls</small></article></div>
              <section className="staff-panel"><div className="staff-panel-heading"><div><p className="eyebrow">Workspace people</p><h3>Member access</h3></div><button type="button" className="secondary" onClick={() => { setActiveTab('database'); setCollectionId('profiles') }}>Open in database</button></div><div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Workspace</th></tr></thead><tbody>{workspace.profiles.map((person) => <tr key={person.id}><td><strong>{person.owner_name || person.email}</strong><small>{person.email}</small></td><td>{person.role}</td><td><span className={`staff-pill ${person.status === 'Active' ? 'active' : 'muted'}`}>{person.status}</span></td><td>{person.workspace_id}</td></tr>)}</tbody></table></div></section>
              <section className="staff-panel"><div className="staff-panel-heading"><div><p className="eyebrow">Billing snapshot</p><h3>Plan and service status</h3></div></div><pre className="staff-json-preview">{pretty(workspace.billing || { status: 'No cloud billing record' })}</pre><p className="staff-helper">Payment identifiers are withheld. Use feature overrides for support adjustments; billing and payment records remain controlled by the billing service.</p></section>
            </div>}

            {activeTab === 'database' && <div className="staff-database">
                <section className="staff-panel"><div className="staff-panel-heading"><div><p className="eyebrow">Server-synced records</p><h3>Workspace database</h3></div><label className="staff-select-label">Collection<select value={collectionId} onChange={(event) => chooseCollection(event.target.value)}>{availableCollections.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label></div><p className="staff-helper">Collections are loaded in bounded batches of up to 40 records. Unknown collections are inspect-only. Hard delete, billing mutation, credentials, and immutable identity fields are protected. All edits require a support reason.</p>
                <div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>Record</th><th>Summary</th><th></th></tr></thead><tbody>{currentRows.map((record) => <tr key={record.id}><td><strong>{record.id}</strong></td><td><small>{record.business_name || record.name || record.title || record.subject || record.email || record.status || record.role || Object.keys(record).slice(0, 3).join(', ')}</small></td><td><button className="text-button" type="button" onClick={() => selectRecord(record)}>{editableCollections.includes(collectionId) ? 'Inspect / edit' : 'Inspect'}</button></td></tr>)}</tbody></table>{!currentRows.length && <p className="staff-empty">No records are available in this collection.</p>}</div>
              </section>
                {recordId && <form className="staff-panel staff-editor" onSubmit={editableCollections.includes(collectionId) ? saveRecord : (event) => event.preventDefault()}><div className="staff-panel-heading"><div><p className="eyebrow">{collectionId}/{recordId}</p><h3>{editableCollections.includes(collectionId) ? 'Record editor' : 'Read-only record'}</h3></div><button className="text-button" type="button" onClick={() => setRecordId('')}>Close</button></div><label>Record data<textarea value={recordDraft} onChange={(event) => setRecordDraft(event.target.value)} readOnly={!editableCollections.includes(collectionId)} rows={14} spellCheck="false" /></label>{editableCollections.includes(collectionId) ? <><label>Support reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={500} rows={2} placeholder="Explain the customer's issue and why this correction is needed." required /></label><div className="staff-actions"><button className="primary" type="submit" disabled={working}>Save audited change</button></div></> : <p className="staff-helper">This collection is available for support inspection. Record changes to it require a development-team schema or tooling update.</p>}</form>}
            </div>}

            {activeTab === 'features' && <div className="staff-features"><section className="staff-panel"><div className="staff-panel-heading"><div><p className="eyebrow">Support override controls</p><h3>Workspace feature access</h3></div><span className="staff-pill muted">Reason required</span></div><div className="staff-override-fields"><label>Reason for this support adjustment<textarea value={featureReason} onChange={(event) => setFeatureReason(event.target.value)} rows={2} maxLength={500} minLength={10} placeholder="Customer impact, ticket reference, and intended resolution." /></label><label>Optional expiry<input type="date" value={featureExpiry} onChange={(event) => setFeatureExpiry(event.target.value)} /></label></div><div className="staff-feature-grid">{features.map(([id, name]) => { const override = valueForFeature(workspace.records, id); return <article key={id} className="staff-feature-card"><div><strong>{name}</strong><span className={`staff-pill ${override.mode === 'enabled' ? 'active' : override.mode === 'disabled' ? 'danger' : 'muted'}`}>{override.mode === 'inherit' ? 'Plan default' : override.mode}</span></div><small>{override.expiresAt ? `Expires ${new Date(override.expiresAt).toLocaleDateString()}` : 'No expiry set'}</small><div className="staff-actions"><button type="button" className="text-button" disabled={working} onClick={() => updateFeature(id, 'enabled')}>Enable</button><button type="button" className="text-button" disabled={working} onClick={() => updateFeature(id, 'disabled')}>Disable</button><button type="button" className="text-button" disabled={working} onClick={() => updateFeature(id, 'inherit')}>Use plan</button></div></article> })}</div></section><p className="staff-helper">Overrides are separate from billing, expire automatically when set, and are returned to the desktop app during its secure entitlement refresh.</p></div>}

            {activeTab === 'audit' && <section className="staff-panel"><div className="staff-panel-heading"><div><p className="eyebrow">Support change history</p><h3>Staff audit trail</h3></div></div><div className="staff-audit-list">{workspace.audit.map((event) => <article key={event.id}><div><strong>{event.action}</strong><span>{event.target}</span></div><p>{event.reason}</p><small>{event.actor_email} · {event.created_at ? new Date(event.created_at).toLocaleString() : 'Just now'}</small></article>)}{!workspace.audit.length && <p className="staff-empty">No staff changes have been recorded for this workspace.</p>}</div><h4>Recent portal actions</h4><div className="staff-audit-list">{globalAudit.slice(0, 20).map((event) => <article key={event.id}><div><strong>{event.action}</strong><span>{event.workspace_id || 'Global'}</span></div><p>{event.reason}</p><small>{event.actor_email} · {event.created_at ? new Date(event.created_at).toLocaleString() : 'Just now'}</small></article>)}</div></section>}
          </>}
        </div>
      </div>
    </section>
  )
}
