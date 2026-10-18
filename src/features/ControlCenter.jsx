import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDownToLine, Bell, Check, ChevronDown, CircleAlert, LockKeyhole, Plus, Search, ShieldCheck, Trash2, Workflow } from 'lucide-react'
import './ControlCenter.css'

const collectionsByRole = {
  Owner: ['dashboard', 'tasks', 'projects', 'customers', 'sales', 'finance', 'people', 'scheduling', 'documents', 'communications', 'reporting', 'automation', 'integrations', 'search', 'security', 'account', 'accessibility', 'mobile', 'support', 'ai_knowledge'],
  'Front Desk': ['dashboard', 'tasks', 'projects', 'customers', 'sales', 'scheduling', 'documents', 'communications', 'automation', 'search', 'accessibility', 'mobile', 'ai_knowledge'],
  Bookkeeper: ['dashboard', 'tasks', 'projects', 'customers', 'sales', 'finance', 'scheduling', 'documents', 'communications', 'reporting', 'automation', 'search', 'accessibility', 'mobile', 'ai_knowledge'],
  Support: ['dashboard', 'tasks', 'scheduling', 'documents', 'communications', 'search', 'accessibility', 'mobile', 'support', 'ai_knowledge'],
}

const automations = [
  ['Task follow-up', 'When a task moves to Waiting', 'Create a follow-up task after 2 business days', 'Enabled'],
  ['Deadline escalation', 'When a due date passes', 'Raise priority and request owner review', 'Enabled'],
  ['Customer handoff', 'When an opportunity is marked Won', 'Create an onboarding checklist', 'Paused'],
  ['Weekly project update', 'Every Monday at 9:00 AM', 'Create a project status request', 'Paused'],
]
const integrationCatalog = [
  ['Google Calendar', 'Calendar', 'Requires Google OAuth consent and provider configuration.'],
  ['Microsoft 365 Calendar', 'Calendar', 'Use the existing Microsoft sign-in and admin consent setup.'],
  ['Google Drive', 'Documents', 'Requires Drive OAuth consent and scope review.'],
  ['OneDrive', 'Documents', 'Use Microsoft sign-in; file sync is not enabled by this local registry.'],
  ['Dropbox', 'Documents', 'Requires a configured Dropbox OAuth application.'],
  ['Slack', 'Notifications', 'Requires an approved Slack app and signed webhook delivery.'],
  ['Microsoft Teams', 'Notifications', 'Requires an approved Microsoft Graph permission and delivery service.'],
  ['QuickBooks', 'Accounting export', 'Export review is available; live API sync requires Intuit setup.'],
  ['Xero', 'Accounting export', 'Export review is available; live API sync requires Xero setup.'],
  ['Stripe events', 'Payments', 'Existing billing is separate; event ingestion requires verified webhooks.'],
  ['Zapier', 'Workflow connector', 'Requires a published and authenticated Zapier integration.'],
  ['Make', 'Workflow connector', 'Requires a published and authenticated Make integration.'],
]
const toRows = (items) => items.map((item) => item.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')

export default function ControlCenter({ area = 'automation', backendState = {}, session = {}, setOperationNotice = () => {} }) {
  const [records, setRecords] = useState([])
  const [savedViews, setSavedViews] = useState([])
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState([])
  const [tags, setTags] = useState('')
  const [selectedSource, setSelectedSource] = useState('')
  const [csvPreview, setCsvPreview] = useState([])
  const [error, setError] = useState('')
  const [draft, setDraft] = useState({ title: '', trigger: '', condition: '', action: '', schedule: '', status: 'Paused' })
  const [allowed, setAllowed] = useState([])
  const [busy, setBusy] = useState(false)

  const getRecords = async (collection) => {
    if (!window.overheadBackend?.listFeatureRecords) return []
    return window.overheadBackend.listFeatureRecords(collection)
  }
  useEffect(() => {
    let active = true
    if (area === 'security' && session.role !== 'Owner') { setRecords([]); return () => { active = false } }
    const own = area === 'security' ? 'security' : area === 'integrations' ? 'integrations' : area === 'search' ? 'search' : 'automation'
    Promise.all([getRecords(own), ...(area === 'search' ? [getRecords('search')] : [])]).then(([rows]) => {
      if (!active) return
      setRecords(rows)
      if (area === 'search') {
        setSavedViews(rows.filter((item) => item.kind === 'saved_view'))
        setHistory(rows.filter((item) => item.kind === 'query').slice(0, 12))
        const tagRecord = rows.find((item) => item.kind === 'tags')
        setTags((tagRecord?.values || []).join(', '))
      }
    }).catch((reason) => { if (active) setError(reason.message || 'The workspace records could not be loaded.') })
    return () => { active = false }
  }, [area])
  useEffect(() => {
    if (area !== 'search') return
    let active = true
    const names = collectionsByRole[session.role] || ['dashboard', 'tasks', 'scheduling', 'documents', 'communications', 'support']
    setBusy(true)
    Promise.all(names.map(async (collection) => [collection, await getRecords(collection)]))
      .then((entries) => { if (active) setAllowed(entries.flatMap(([collection, rows]) => rows.map((row) => ({ ...row, __source: collection })))) })
      .catch((reason) => { if (active) setError(reason.message || 'Some searchable records are unavailable.') })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [area, session.role])

  const searchIndex = useMemo(() => [...allowed], [allowed])
  const matches = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (!terms.length) return []
    return searchIndex.filter((item) => terms.every((term) => JSON.stringify(item).toLowerCase().includes(term))).slice(0, 150)
  }, [query, searchIndex])

  async function saveRecord(record) {
    try {
      const collection = area === 'integrations' ? 'integrations' : area === 'security' ? 'security' : area === 'search' ? 'search' : 'automation'
      const saved = await window.overheadBackend.upsertFeatureRecord({ collection, record })
      setRecords((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
      setError('')
      return saved
    } catch (reason) { setError(reason.message || 'The record could not be saved.'); return null }
  }
  async function removeRecord(record) {
    try {
      const collection = area === 'integrations' ? 'integrations' : area === 'security' ? 'security' : area === 'search' ? 'search' : 'automation'
      await window.overheadBackend.deleteFeatureRecord({ collection, recordId: record.id })
      setRecords((current) => current.filter((item) => item.id !== record.id))
    } catch (reason) { setError(reason.message || 'The record could not be deleted.') }
  }
  async function createRule(event) {
    event.preventDefault()
    if (!draft.title.trim() || !draft.trigger.trim() || !draft.action.trim()) { setError('Give the rule a title, trigger, and action.'); return }
    const saved = await saveRecord({ kind: 'rule', ...draft, status: draft.status || 'Paused', created_by: session.email })
    if (saved) { setDraft({ title: '', trigger: '', condition: '', action: '', schedule: '', status: 'Paused' }); setOperationNotice('Workflow rule saved as a local draft. External effects are not triggered here.') }
  }
  async function runRule(record) {
    const saved = await saveRecord({ ...record, status: record.status === 'Enabled' ? 'Paused' : 'Enabled', last_reviewed_by: session.email, last_reviewed_at: new Date().toISOString() })
    if (saved) setOperationNotice(`${saved.title} ${saved.status.toLowerCase()}. This changes local rule status only.`)
  }
  async function addIntegration(item) {
    const existing = records.find((record) => record.name === item[0])
    await saveRecord({ id: existing?.id, kind: 'connection_review', name: item[0], category: item[1], status: 'Needs setup', note: item[2], checked_at: new Date().toISOString(), reviewed_by: session.email })
  }
  async function saveQuery() {
    if (!query.trim()) return setError('Enter a search phrase first.')
    const saved = await saveRecord({ kind: 'query', query: query.trim(), created_by: session.email, created_at: new Date().toISOString() })
    if (saved) setHistory((current) => [saved, ...current].slice(0, 12))
  }
  async function saveView() {
    const name = window.prompt('Name this saved search')?.trim()
    if (!name || !query.trim()) return
    const saved = await saveRecord({ kind: 'saved_view', title: name, query: query.trim(), scope: session.role === 'Owner' ? 'Shared workspace' : 'Personal', created_by: session.email })
    if (saved) setSavedViews((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
  }
  async function togglePin(item) {
    const source = String(item.__source || 'workspace')
    const recordId = String(item.id || item.title || item.name || '')
    if (!recordId) return
    const existing = records.find((record) => record.kind === 'pin' && record.source === source && record.record_id === recordId)
    if (existing) { await removeRecord(existing); setOperationNotice('Record unpinned.'); return }
    const saved = await saveRecord({ kind: 'pin', source, record_id: recordId, title: String(item.title || item.business_name || item.subject || item.name || 'Untitled').slice(0, 160), created_by: session.email })
    if (saved) setOperationNotice('Record pinned in your encrypted search workspace.')
  }
  async function saveTags() {
    const values = [...new Set(tags.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 80))]
    await saveRecord({ id: 'tags', kind: 'tags', title: 'Workspace tags', values, hierarchy: values.map((value) => ({ value, parent: '' })) })
    setOperationNotice('Tag list saved to the encrypted search workspace.')
  }
  function exportSearch() {
    const keys = [...new Set(matches.flatMap((item) => Object.keys(item)).filter((key) => !key.startsWith('__')))].slice(0, 30)
    const csv = toRows([keys, ...matches.map((item) => keys.map((key) => item[key] && typeof item[key] === 'object' ? JSON.stringify(item[key]) : item[key])])
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'overhead-search-results.csv'; link.click(); URL.revokeObjectURL(link.href)
  }
  function readImport(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setSelectedSource(file.name)
    const reader = new FileReader()
    reader.onload = () => setCsvPreview(String(reader.result || '').split(/\r?\n/).filter(Boolean).slice(0, 16).map((line) => line.split(',').map((cell) => cell.replace(/^"|"$/g, ''))))
    reader.onerror = () => setError('That CSV could not be read.')
    reader.readAsText(file)
  }

  const collection = area === 'integrations' ? 'integrations' : area === 'security' ? 'security' : area === 'search' ? 'search' : 'automation'
  return <section className="panel page-panel control-center">
    <div className="section-head"><div><p className="eyebrow">{area === 'automation' ? 'Operations' : area === 'integrations' ? 'Connections' : area === 'search' ? 'Find and organize' : 'Protection'}</p><h2>{area === 'automation' ? 'Automation & rules' : area === 'integrations' ? 'Integrations & data exchange' : area === 'search' ? 'Workspace search' : 'Security administration'}</h2></div>{area === 'security' ? <ShieldCheck size={20}/> : area === 'automation' ? <Workflow size={20}/> : area === 'search' ? <Search size={20}/> : <Activity size={20}/>}</div>
    {area === 'automation' && <div className="control-grid"><div className="control-card"><h3>No-code workflow builder</h3><p>Define an event, a condition, and a reviewable next action. Rules are drafts and are not executed automatically.</p><form className="control-form" onSubmit={createRule}><label>Rule name<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength="120" required/></label><label>Trigger<select value={draft.trigger} onChange={(event) => setDraft({ ...draft, trigger: event.target.value })} required><option value="">Choose a trigger</option>{['Task status changes', 'Due date passes', 'Customer is assigned', 'Form is received', 'Record is duplicated', 'Scheduled review time'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Condition<input value={draft.condition} onChange={(event) => setDraft({ ...draft, condition: event.target.value })} placeholder="When priority is High" maxLength="300"/></label><label>Action<input value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value })} placeholder="Create a review task" maxLength="300" required/></label><label>Schedule (optional)<input value={draft.schedule} onChange={(event) => setDraft({ ...draft, schedule: event.target.value })} placeholder="Weekdays at 9:00 AM" maxLength="160"/></label><button className="primary-action" type="submit"><Plus size={16}/> Save draft rule</button></form></div><div className="control-card"><h3>Recipes</h3><p>Start from a reviewed recipe, edit its trigger and action, then enable it when your team is ready.</p>{automations.map(([title, trigger, action, status]) => <article className="recipe-row" key={title}><div><strong>{title}</strong><small>{trigger} → {action}</small></div><button className="mini-button" type="button" onClick={() => setDraft({ title, trigger, condition: '', action, schedule: '', status })}>Use recipe</button></article>)}</div><div className="control-card wide"><h3>Rule register and run history</h3>{records.filter((item) => item.kind === 'rule').map((record) => <article className="record-row" key={record.id}><div><strong>{record.title}</strong><small>{record.trigger}{record.condition ? ` · ${record.condition}` : ''} → {record.action}</small><span>{record.schedule ? `Schedule: ${record.schedule} · ` : ''}{record.status}{record.last_reviewed_at ? ` · reviewed ${new Date(record.last_reviewed_at).toLocaleString()}` : ''}</span></div><button className="mini-button" type="button" onClick={() => runRule(record)}>{record.status === 'Enabled' ? 'Pause' : 'Enable'}</button><button type="button" aria-label={`Delete ${record.title}`} onClick={() => removeRecord(record)}><Trash2 size={15}/></button></article>)}{records.filter((item) => item.kind === 'run').map((record) => <p key={record.id}>{record.title} · {record.status} · {record.created_at}</p>)}{!records.length && <p>No rules configured. Pick a recipe or build a new draft above.</p>}</div></div>}
    {area === 'integrations' && <><div className="integration-banner"><LockKeyhole size={18}/><span>Connection entries never collect passwords, client secrets, payment credentials, or tokens. Provider login, consent, and live sync require their approved setup flow.</span></div><div className="integration-grid">{integrationCatalog.map((item) => { const saved = records.find((record) => record.name === item[0]); return <article className="control-card integration-card" key={item[0]}><div><strong>{item[0]}</strong><span>{item[1]}</span></div><p>{item[2]}</p><small>{saved?.status || 'Not connected'}</small><button className="mini-button" type="button" onClick={() => addIntegration(item)}>{saved ? 'Refresh setup status' : 'Record setup status'}</button></article> })}</div><div className="control-card"><h3>CSV import preview</h3><p>Read a file, inspect up to 15 rows, and check columns before any import. This screen does not write imported records.</p><label className="file-picker">Choose CSV<input type="file" accept=".csv,text/csv" onChange={readImport}/></label>{selectedSource && <strong>{selectedSource}</strong>}{csvPreview.length > 0 && <div className="csv-preview"><table><tbody>{csvPreview.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>}<small>Mapping can be reviewed in this preview; import destination, duplicate resolution, and write confirmation remain separate.</small></div><div className="control-card"><h3>Data export scheduler</h3><p>Exports are generated on demand in the relevant workspace. A background scheduler and provider webhooks are not active.</p><button className="mini-button" type="button" onClick={() => setOperationNotice('Export schedules require an approved background delivery service; no schedule was created.')}>Review scheduler requirement</button></div></>}
    {area === 'search' && <div className="control-grid"><div className="control-card wide"><h3>Search records</h3><label className="search-control"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveQuery() }} placeholder="Search names, notes, statuses, and custom fields"/><button type="button" aria-label="More search options"><ChevronDown size={15}/></button></label><div className="button-row"><button className="primary-action" type="button" onClick={saveQuery}>Save to recent searches</button><button className="mini-button" type="button" onClick={saveView}>Save search view</button><button className="mini-button" type="button" onClick={exportSearch}><ArrowDownToLine size={15}/> Export results</button></div><div className="search-facets">{[...new Set(matches.map((item) => item.__source || 'Workspace'))].map((source) => <span key={source}>{source}: {matches.filter((item) => (item.__source || 'Workspace') === source).length}</span>)}</div>{matches.map((item, index) => { const isPinned = records.some((record) => record.kind === 'pin' && record.source === item.__source && record.record_id === String(item.id || item.title || item.name || '')); return <article className="record-row" key={`${item.id || item.created_at || 'match'}-${index}`}><div><strong>{item.title || item.business_name || item.subject || item.name || 'Untitled record'}</strong><small>{item.__source} · {[item.status, item.priority, item.email, item.due_at, item.due].filter(Boolean).join(' · ')}</small><p>{item.notes || item.details || item.description || ''}</p></div><button className="mini-button" type="button" onClick={() => togglePin(item)}>{isPinned ? 'Unpin' : 'Pin'}</button></article> })}{query && !matches.length && <p>{busy ? 'Loading searchable records…' : 'No matching records in your accessible workspace.'}</p>}</div><div className="control-card"><h3>Saved views</h3>{savedViews.map((view) => <article className="recipe-row" key={view.id}><button type="button" onClick={() => setQuery(view.query)}>{view.title}</button><span>{view.scope}</span><button type="button" onClick={() => removeRecord(view)} aria-label={`Delete ${view.title}`}><Trash2 size={14}/></button></article>)}{!savedViews.length && <p>Save a search phrase for your own use; Owners may save shared workspace views.</p>}<label>Shared tags (comma-separated)<textarea value={tags} onChange={(event) => setTags(event.target.value)} placeholder="priority, renewal, follow-up"/></label><button className="mini-button" type="button" onClick={saveTags}>Save tag list</button><h3>Recent searches</h3>{history.map((item) => <button className="history-row" key={item.id} type="button" onClick={() => setQuery(item.query)}>{item.query}</button>)}</div></div>}
    {area === 'security' && session.role === 'Owner' && <div className="control-grid"><div className="control-card wide"><h3>Security controls</h3><p>Existing OverHead login and role controls remain the source of access. Save review notes here without weakening the role boundary.</p>{['Multi-factor authentication', 'Single sign-on', 'Device session list', 'Password policy', 'Field-level access', 'Record-level access', 'Scheduled access review', 'Inactive-user suspension', 'IP allowlist', 'Retention policy', 'Export permission', 'Recovery codes', 'Security event notifications'].map((name) => { const item = records.find((entry) => entry.key === name); const blocked = ['Multi-factor authentication', 'Single sign-on', 'IP allowlist', 'Device session list', 'Recovery codes'].includes(name); return <div className="security-row" key={name}><div><strong>{name}</strong><span>{item?.value || (blocked ? 'Not configured' : 'Current app policy')}</span></div><label>Review note<input defaultValue={item?.note || ''} maxLength="300" onBlur={(event) => saveRecord({ id: item?.id, key: name, value: blocked ? 'Not configured' : 'Reviewed', note: event.target.value, reviewed_by: session.email, reviewed_at: new Date().toISOString() })}/></label><small>{blocked ? 'Requires identity-provider, OS, or network infrastructure.' : 'Use existing role and security controls; this panel records review only.'}</small></div> })}</div><div className="control-card"><h3>Admin and access audit</h3><p>{(backendState.auditEvents || []).length} recent workspace audit events.</p>{(backendState.auditEvents || []).slice(0, 30).map((item) => <article className="audit-row" key={item.id}><span><Check size={14}/>{item.event_type || item.type}</span><small>{item.created_at || item.timestamp || ''} · {item.actor_email || ''}</small></article>)}{!(backendState.auditEvents || []).length && <p>Audit details load from the main security center.</p>}</div></div>}
    {area === 'security' && session.role !== 'Owner' && <div className="integration-banner"><CircleAlert size={17}/>This administrative view is Owner-only. Ask an Owner to review access and policy.</div>}
    {area === 'search' && <p className="small-muted">Search is limited to records readable by your role. Provider credentials and protected login details are excluded.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>
}
