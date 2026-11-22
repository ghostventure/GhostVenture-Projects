import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Database, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react'

const collections = [
  ['profiles', 'Workspace people'], ['customers', 'Customer records'], ['tasks', 'Tasks'],
  ['approvals', 'Approvals'], ['support_tickets', 'Support tickets'], ['licenses', 'Licenses'],
  ['invites', 'Invitations'], ['audit_events', 'Workspace audit'],
]
const features = [
  ['customers', 'Customer management'], ['tasks', 'Tasks and work queues'], ['backups', 'Backups'],
  ['support_bundle', 'Support bundles'], ['workflow_jobs', 'Workflow automation'],
  ['legal_acknowledgements', 'Legal acknowledgements'], ['roles', 'Team roles'],
  ['data_export', 'Data export'], ['restore_validation', 'Restore validation'],
  ['fraud_detection', 'Fraud detection'], ['stripe', 'Stripe billing tools'],
  ['server_deployment', 'Cylinder server deployment'],
]
const editable = ['profiles', 'customers', 'tasks', 'approvals', 'support_tickets']
const pretty = (value) => JSON.stringify(value, null, 2)

function messageOf(error) {
  return String(error?.message || error || 'Staff portal request failed.')
}

export default function StaffPortalSection() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [workspace, setWorkspace] = useState(null)
  const [tab, setTab] = useState('overview')
  const [collection, setCollection] = useState('profiles')
  const [recordId, setRecordId] = useState('')
  const [draft, setDraft] = useState('')
  const [reason, setReason] = useState('')
  const [featureReason, setFeatureReason] = useState('')
  const [featureExpiry, setFeatureExpiry] = useState('')
  const [audit, setAudit] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteInfo, setInviteInfo] = useState(null)

  const call = useCallback(async (payload) => window.overheadBackend.staffPortalApi(payload), [])
  const reloadAudit = useCallback(async () => {
    const response = await call({ action: 'audit' })
    setAudit(response.events || [])
  }, [call])

  useEffect(() => {
    let active = true
    call({ action: 'access_check' }).then(async (response) => {
      if (!active) return
      setAuthorized(response.authorized === true)
      await reloadAudit()
    }).catch((failure) => { if (active) setError(messageOf(failure)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [call, reloadAudit])

  const records = workspace?.records || {}
  const rows = useMemo(() => collection === 'profiles' ? workspace?.profiles || [] : records[collection] || [], [collection, records, workspace])
  const known = new Map(collections)
  const choices = [...collections, ...(workspace?.collectionNames || []).filter((name) => !known.has(name)).map((name) => [name, name.replaceAll('_', ' ')])]

  async function search(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('Searching workspaces…')
    try { const response = await call({ action: 'search', query }); setResults(response.workspaces || []); setNotice(`${response.workspaces?.length || 0} workspace(s) found.`) }
    catch (failure) { setError(messageOf(failure)); setNotice('') }
    finally { setBusy(false) }
  }

  async function openWorkspace(item) {
    setBusy(true); setError(''); setNotice(`Loading ${item.business_name || item.id}…`)
    try { const data = await call({ action: 'load_workspace', workspaceId: item.id }); setWorkspace(data); setTab('overview'); setCollection('profiles'); setRecordId(''); setNotice('Workspace loaded. Staff actions are audit logged.') }
    catch (failure) { setError(messageOf(failure)) }
    finally { setBusy(false) }
  }

  async function chooseCollection(value) {
    setCollection(value); setRecordId('')
    if (value === 'profiles' || Object.prototype.hasOwnProperty.call(records, value)) return
    setBusy(true)
    try { const response = await call({ action: 'read_collection', workspaceId: workspace.workspace.id, collection: value }); setWorkspace((current) => ({ ...current, records: { ...current.records, [value]: response.records || [] } })) }
    catch (failure) { setError(messageOf(failure)) }
    finally { setBusy(false) }
  }

  function inspect(record) { const { id, ...data } = record; setRecordId(id); setDraft(pretty(data)); setReason('') }

  async function saveRecord(event) {
    event.preventDefault()
    let next
    try { next = JSON.parse(draft) } catch { setError('The record is not valid JSON.'); return }
    const before = rows.find((row) => row.id === recordId) || {}
    const previous = { ...before }; delete previous.id
    const removed = Object.keys(previous).filter((key) => !Object.hasOwn(next, key))
    if (removed.length) { setError(`Fields cannot be removed here: ${removed.join(', ')}.`); return }
    const changes = Object.fromEntries(Object.entries(next).filter(([key, value]) => JSON.stringify(previous[key]) !== JSON.stringify(value)))
    if (!Object.keys(changes).length) { setError('No database values changed.'); return }
    setBusy(true); setError('')
    try { await call({ action: 'update_document', workspaceId: workspace.workspace.id, collection, documentId: recordId, changes, reason }); await openWorkspace(workspace.workspace); setNotice(`Saved ${collection}/${recordId} with an audit entry.`); setRecordId('') }
    catch (failure) { setError(messageOf(failure)) }
    finally { setBusy(false) }
  }

  async function setOverride(featureId, mode) {
    if (!workspace) return
    setBusy(true); setError('')
    try {
      await call({ action: 'set_feature_override', workspaceId: workspace.workspace.id, featureId, mode, expiresAt: featureExpiry ? new Date(`${featureExpiry}T23:59:59.999Z`).toISOString() : '', reason: featureReason })
      const data = await call({ action: 'load_workspace', workspaceId: workspace.workspace.id }); setWorkspace(data); setFeatureReason(''); setNotice(`${featureId} override saved and audit logged.`)
    } catch (failure) { setError(messageOf(failure)) }
    finally { setBusy(false) }
  }

  async function createInvite(event) {
    event.preventDefault(); setBusy(true); setError(''); setInviteInfo(null)
    try {
      const invite = await call({ action: 'create_invite', email: inviteEmail })
      const delivery = await window.overheadBackend.sendStaffInvitationEmail({ email: invite.email, code: invite.code, expiresAt: invite.expiresAt })
      setInviteInfo({ ...invite, delivery })
      setInviteEmail('')
      setNotice(delivery.status === 'sent' ? `Invitation email sent to ${invite.email}.` : `Invitation saved. Email is queued on this computer for ${invite.email}.`)
    } catch (failure) { setError(messageOf(failure)) }
    finally { setBusy(false) }
  }

  if (loading) return <section className="panel page-panel staff-desktop"><h2>Verifying OverHead Staff access</h2><p>The server validates the staff claim before enabling this screen.</p></section>
  if (!authorized) return <section className="panel page-panel staff-desktop"><div className="staff-native-heading"><ShieldCheck /><div><p className="eyebrow">Restricted access</p><h2>OverHead Staff Portal</h2></div></div><p>{error || 'This Firebase account does not have an active OverHead Staff permission. A workspace Administrator role does not grant company-wide access.'}</p></section>

  const overrideValue = (id) => records.staff_feature_overrides?.find((entry) => entry.id === id)
  return <section className="staff-desktop">
    <header className="staff-native-heading"><ShieldCheck /><div><p className="eyebrow">Internal operations</p><h2>OverHead Staff Portal</h2><p>Cross-workspace support with server-verified access and an audit trail.</p></div></header>
    {(error || notice) && <div className={error ? 'staff-native-notice error' : 'staff-native-notice'} role={error ? 'alert' : 'status'}>{error || notice}</div>}
    <div className="staff-native-layout">
      <aside className="staff-native-sidebar">
        <form onSubmit={search}><label htmlFor="staff-native-search">Find a workspace</label><div className="staff-native-search"><Search size={16} /><input id="staff-native-search" minLength={2} required value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Workspace ID, email, or name" /></div><button className="primary-action" disabled={busy}>Search workspaces</button></form>
        <form className="staff-native-invite" onSubmit={createInvite}><strong>Invite a staff member</strong><p>Send setup steps to their @overheadteam.com alias. They’ll use their personal email to sign in.</p><label htmlFor="staff-native-invite-email">OverHead company alias</label><input id="staff-native-invite-email" type="email" pattern=".+@overheadteam\.com" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@overheadteam.com" /><button className="primary-action" disabled={busy}>Send staff invitation</button>{inviteInfo?.delivery?.status !== 'sent' && inviteInfo?.code && <div className="staff-native-invite-code"><span>Email is queued locally. Share this code if needed:</span><code>{inviteInfo.code}</code><button type="button" className="text-action" onClick={() => navigator.clipboard?.writeText(inviteInfo.code)}>Copy invitation code</button></div>}</form>
        <div className="staff-native-results">{results.map((item) => <button type="button" key={item.id} onClick={() => openWorkspace(item)} disabled={busy}><strong>{item.business_name || 'Workspace'}</strong><span>{item.owner_name || item.email || item.id}</span><small>{item.id} · {item.member_count} members</small></button>)}{!results.length && <p>Search results will appear here.</p>}</div>
        <div className="staff-native-boundary"><AlertTriangle size={17} /><div><strong>Development team boundary</strong><p>Source defects, schema migrations, provider credentials, infrastructure failures, hard deletes, and device-local database repair require engineering.</p></div></div>
      </aside>
      <main className="staff-native-main">{!workspace ? <div className="panel page-panel"><Database size={24} /><h3>Select a workspace to support</h3><p>Inspect shared records, member access, billing state, feature controls, and staff audit history.</p></div> : <>
        <header className="staff-native-workspace"><div><p className="eyebrow">Selected workspace</p><h3>{workspace.workspace.business_name || workspace.workspace.id}</h3><p>{workspace.workspace.id} · {workspace.profiles.length} members · {workspace.billing?.tier || 'No cloud plan'} / {workspace.billing?.status || 'unavailable'}</p></div><button className="ghost-button" disabled={busy} onClick={() => openWorkspace(workspace.workspace)}><RefreshCw size={15} /> Refresh</button></header>
        <nav className="staff-native-tabs">{['overview', 'database', 'features', 'audit'].map((item) => <button type="button" key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</nav>
        {tab === 'overview' && <div className="staff-native-cards"><article><Users /><span>Members</span><strong>{workspace.profiles.length}</strong></article><article><Database /><span>Customer records</span><strong>{records.customers?.length || 0}</strong></article><article><AlertTriangle /><span>Open support tickets</span><strong>{records.support_tickets?.filter((entry) => !['Resolved', 'Closed'].includes(entry.status)).length || 0}</strong></article><article className="staff-native-detail"><h4>Billing summary</h4><pre>{pretty(workspace.billing || { status: 'No cloud billing record' })}</pre><small>Payment identifiers are redacted. Use the billing service for charges, refunds, or subscription changes.</small></article></div>}
        {tab === 'database' && <div className="staff-native-database"><div className="panel page-panel"><div className="staff-native-row"><h3>Workspace database</h3><label>Collection<select value={collection} onChange={(event) => chooseCollection(event.target.value)}>{choices.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div><p>Bounded batches of up to 40 records. Unknown collections are read-only; protected fields and hard deletes are unavailable.</p><div className="staff-native-table-scroll"><table className="staff-native-table"><thead><tr><th>Record</th><th>Summary</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.id}</td><td>{row.name || row.title || row.subject || row.email || row.status || Object.keys(row).slice(0, 3).join(', ')}</td><td><button className="text-action" onClick={() => inspect(row)}>{editable.includes(collection) ? 'Inspect / edit' : 'Inspect'}</button></td></tr>)}</tbody></table>{!rows.length && <p>No records in this collection.</p>}</div></div>
          {recordId && <form className="panel page-panel" onSubmit={editable.includes(collection) ? saveRecord : (event) => event.preventDefault()}><h3>{editable.includes(collection) ? 'Correct record' : 'Read-only record'} · {recordId}</h3><textarea rows={12} value={draft} readOnly={!editable.includes(collection)} onChange={(event) => setDraft(event.target.value)} />{editable.includes(collection) && <><label>Required support reason<textarea value={reason} minLength={10} maxLength={500} required onChange={(event) => setReason(event.target.value)} /></label><button className="primary-action" disabled={busy}>Save audited correction</button></>}</form>}</div>}
        {tab === 'features' && <div className="panel page-panel"><div className="staff-native-row"><h3>Workspace feature overrides</h3><label>Optional expiry<input type="date" value={featureExpiry} onChange={(event) => setFeatureExpiry(event.target.value)} /></label></div><label>Required reason<textarea minLength={10} maxLength={500} value={featureReason} onChange={(event) => setFeatureReason(event.target.value)} placeholder="Customer impact, ticket reference, intended resolution" /></label><div className="staff-native-feature-grid">{features.map(([id, label]) => { const value = overrideValue(id); const status = value ? value.enabled ? 'Enabled' : 'Disabled' : 'Plan default'; return <article key={id}><div><strong>{label}</strong><span>{status}</span></div><div><button className="text-action" disabled={busy} onClick={() => setOverride(id, 'enabled')}>Enable</button><button className="text-action" disabled={busy} onClick={() => setOverride(id, 'disabled')}>Disable</button><button className="text-action" disabled={busy} onClick={() => setOverride(id, 'inherit')}>Use plan</button></div></article> })}</div><small>Overrides do not change billing and are enforced by the server and supported desktop features.</small></div>}
        {tab === 'audit' && <div className="staff-native-audit">{workspace.audit.map((entry) => <article key={entry.id}><strong>{entry.action}</strong><span>{entry.target} · {entry.actor_email}</span><p>{entry.reason}</p></article>)}{audit.slice(0, 20).map((entry) => <article key={entry.id}><strong>{entry.action}</strong><span>{entry.workspace_id || 'Global'} · {entry.actor_email}</span><p>{entry.reason}</p></article>)}</div>}
      </>}</main>
    </div>
  </section>
}
