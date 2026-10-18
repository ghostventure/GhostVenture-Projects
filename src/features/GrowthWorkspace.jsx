import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, CircleHelp, Columns3, Download, Plus, Search, Star, Trash2 } from 'lucide-react'
import './GrowthWorkspace.css'

const areas = [
  { id: 'dashboard', label: 'Dashboard', title: 'Dashboard & navigation', fields: ['title', 'kind', 'value', 'goal', 'period', 'filter', 'notes'] },
  { id: 'tasks', label: 'Tasks', title: 'Tasks & workflow', fields: ['title', 'status', 'priority', 'assignee', 'due', 'labels', 'customer', 'project', 'estimate', 'checklist', 'template', 'recurrence', 'depends_on', 'watchers', 'notes'] },
  { id: 'projects', label: 'Projects', title: 'Projects & planning', fields: ['title', 'status', 'health', 'owner', 'budget', 'capacity', 'milestone', 'risk', 'decision', 'dependency', 'start', 'due', 'stage', 'resources', 'notes'] },
  { id: 'customers', label: 'Customers', title: 'Customers & accounts', fields: ['title', 'segment', 'health', 'stage', 'owner', 'contacts', 'consent', 'preferences', 'renewal', 'risk', 'notes'] },
  { id: 'sales', label: 'Sales', title: 'Sales & opportunities', fields: ['title', 'stage', 'amount', 'probability', 'owner', 'territory', 'lead_score', 'source', 'close_date', 'lost_reason', 'commission', 'notes'] },
]

const defaults = {
  dashboard: ['Pipeline', 'Open tasks', 'Project health', 'Renewals'],
  tasks: ['New task', 'In progress', 'Waiting', 'Done'],
  projects: ['Planning', 'Active', 'At risk', 'Complete'],
  customers: ['Prospect', 'Onboarding', 'Active', 'Renewal'],
  sales: ['Lead', 'Qualified', 'Proposal', 'Won', 'Lost'],
}

const fieldLabels = {
  title: 'Name', kind: 'Widget type', value: 'KPI value', goal: 'Goal', period: 'Comparison period', filter: 'Saved filter', notes: 'Notes',
  status: 'Status', priority: 'Priority', assignee: 'Assigned to', due: 'Due date', labels: 'Labels', customer: 'Customer', project: 'Project', estimate: 'Estimate (hours)', checklist: 'Checklist items', template: 'Template', recurrence: 'Repeat rule', depends_on: 'Depends on', watchers: 'Watchers',
  health: 'Health', owner: 'Owner', budget: 'Budget', capacity: 'Capacity', milestone: 'Milestones', risk: 'Risks', decision: 'Decisions', dependency: 'Dependencies', start: 'Start date', stage: 'Stage', resources: 'Resources',
  segment: 'Segment', contacts: 'Contacts / roles', consent: 'Consent', preferences: 'Communication preferences', renewal: 'Renewal date', amount: 'Deal amount', probability: 'Probability (%)', territory: 'Territory', lead_score: 'Lead score', source: 'Lead source', close_date: 'Expected close', lost_reason: 'Lost reason', commission: 'Commission estimate',
}

export default function GrowthWorkspace({ session }) {
  const [area, setArea] = useState('dashboard')
  const [records, setRecords] = useState([])
  const [all, setAll] = useState({})
  const [draft, setDraft] = useState({})
  const [editing, setEditing] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [view, setView] = useState('List')
  const [workspace, setWorkspace] = useState('My workspace')
  const [presets, setPresets] = useState(['My workspace', 'Sales', 'Operations'])
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [layout, setLayout] = useState(['Open tasks', 'Project health', 'Pipeline'])

  const current = areas.find((item) => item.id === area)
  const userKey = String(session?.email || session?.ownerName || 'workspace').trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_')
  const load = useCallback(async () => {
    if (!window.overheadBackend?.listFeatureRecords) return
    setBusy(true)
    try {
      const values = await Promise.all(areas.map(async (item) => [item.id, await window.overheadBackend.listFeatureRecords(item.id)]))
      const saved = Object.fromEntries(values)
      setAll(saved)
      setRecords(saved[area] || [])
      const prefs = await window.overheadBackend.listFeatureRecords('dashboard')
      const savedLayout = prefs.find((item) => item.id === `layout:${userKey}:${workspace}`)?.items
      setLayout(Array.isArray(savedLayout) ? savedLayout : ['Open tasks', 'Project health', 'Pipeline'])
      const savedPresets = prefs.find((item) => item.id === `workspace-presets:${userKey}`)?.items
      if (Array.isArray(savedPresets)) setPresets([...new Set(['My workspace', ...savedPresets])])
      setNotice('Workspace changes save to OverHead’s encrypted local store.')
    } catch (error) {
      setNotice(error?.message || 'Could not load saved workspace records.')
    } finally { setBusy(false) }
  }, [area, workspace, userKey])
  useEffect(() => { setRecords(all[area] || []); setDraft({}); setEditing(''); setFilter('All'); setQuery('') }, [area, all])
  useEffect(() => { load() }, [load])

  const stageOptions = useMemo(() => [...new Set([...(defaults[area] || []), ...records.map((item) => item.status || item.stage).filter(Boolean)])], [area, records])
  const visible = records.filter((record) => {
    const matches = `${record.title || ''} ${record.name || ''} ${record.notes || ''} ${record.customer || ''}`.toLowerCase().includes(query.toLowerCase())
    const value = record.status || record.stage || 'Open'
    return matches && (filter === 'All' || value === filter)
  })
  const save = async (record = draft) => {
    const title = String(record.title || '').trim()
    if (!title) { setNotice('Add a name before saving.'); return }
    try {
      const saved = await window.overheadBackend.upsertFeatureRecord({ collection: area, record: { ...record, title, status: record.status || record.stage || defaults[area]?.[0] || 'Open' } })
      const updated = [...records.filter((item) => item.id !== saved.id), saved]
      setRecords(updated); setAll((state) => ({ ...state, [area]: updated })); setDraft({}); setEditing('')
      if (area === 'dashboard' && !layout.includes(title)) saveLayout([...layout, title])
      setNotice(`${current.label} record saved.`)
    } catch (error) { setNotice(error?.message || 'Record could not be saved.') }
  }
  const remove = async (record) => {
    if (!record.id || record.id.startsWith('layout:')) return
    try { await window.overheadBackend.deleteFeatureRecord({ collection: area, recordId: record.id }); const updated = records.filter((item) => item.id !== record.id); setRecords(updated); setAll((state) => ({ ...state, [area]: updated })); setNotice('Record removed.') }
    catch (error) { setNotice(error?.message || 'Record could not be removed.') }
  }
  const startEdit = (record) => { setDraft({ ...record }); setEditing(record.id || 'new') }
  const addPreset = () => {
    const label = window.prompt('Name this workspace preset')?.trim()
    if (label && !presets.includes(label)) {
      const updated = [...presets, label]
      setPresets(updated); setWorkspace(label)
      window.overheadBackend.upsertFeatureRecord({ collection: 'dashboard', record: { id: `workspace-presets:${userKey}`, title: 'Workspace presets', kind: 'presets', owner: userKey, items: updated } }).catch((error) => setNotice(error?.message || 'Could not save workspace preset.'))
    }
  }
  const saveLayout = async (items) => {
    setLayout(items)
    try { await window.overheadBackend.upsertFeatureRecord({ collection: 'dashboard', record: { id: `layout:${userKey}:${workspace}`, title: `${workspace} layout`, kind: 'layout', owner: userKey, items } }); setNotice('Dashboard layout saved.') }
    catch (error) { setNotice(error?.message || 'Could not save dashboard layout.') }
  }
  const exportRows = () => {
    const keys = current.fields
    const lines = [keys.join(','), ...visible.map((item) => keys.map((key) => `"${String(item[key] ?? '').replaceAll('"', '""')}"`).join(','))]
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv' })); link.download = `overhead-${area}.csv`; link.click(); URL.revokeObjectURL(link.href)
  }
  const moveCard = async (record, offset) => {
    const index = records.findIndex((item) => item.id === record.id)
    const target = Math.max(0, Math.min(records.length - 1, index + offset))
    if (target === index || !record.id) return
    const reordered = [...records]; reordered.splice(index, 1); reordered.splice(target, 0, record)
    const updated = await Promise.all(reordered.map((item, order) => window.overheadBackend.upsertFeatureRecord({ collection: area, record: { ...item, order } })))
    setRecords(updated); setAll((state) => ({ ...state, [area]: updated }))
  }
  const dragLayout = (event, index) => event.dataTransfer.setData('text/plain', `layout:${index}`)
  const dropLayout = (event, targetIndex) => {
    const value = event.dataTransfer.getData('text/plain')
    if (!value.startsWith('layout:')) return
    const sourceIndex = Number(value.slice(7))
    if (!Number.isInteger(sourceIndex) || sourceIndex === targetIndex) return
    const source = [...layout]
    const [item] = source.splice(sourceIndex, 1); source.splice(targetIndex, 0, item)
    saveLayout(source)
  }
  const dropOnStage = async (event, stage) => {
    const recordId = event.dataTransfer.getData('text/plain')
    if (!recordId || recordId.startsWith('layout:')) return
    const record = records.find((item) => item.id === recordId)
    if (!record) return
    const updatedRecord = await window.overheadBackend.upsertFeatureRecord({ collection: area, record: { ...record, [area === 'sales' || area === 'customers' ? 'stage' : 'status']: stage } })
    const updated = records.map((item) => item.id === recordId ? updatedRecord : item)
    setRecords(updated); setAll((state) => ({ ...state, [area]: updated }))
  }

  return <div className="growth-workspace">
    <div className="growth-heading"><div><p className="eyebrow">Workspace suite · encrypted local records</p><h2>Build and run your work</h2><p>Saved boards, work queues, customer accounts, projects, and sales opportunities.</p></div><button className="ghost-button" type="button" title="Records are validated and stored in the encrypted OverHead profile."><CircleHelp size={17}/> How it works</button></div>
    <div className="growth-controls"><label className="growth-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${current.label.toLowerCase()}`} aria-label={`Search ${current.label}`}/></label><label>Workspace<select value={workspace} onChange={(event) => setWorkspace(event.target.value)}>{presets.map((item) => <option key={item}>{item}</option>)}</select></label><button type="button" className="ghost-button" onClick={addPreset}>Save workspace preset</button></div>
    <div className="growth-tabs" role="tablist" aria-label="Workspace areas">{areas.map((item) => <button key={item.id} type="button" role="tab" aria-selected={area === item.id} className={area === item.id ? 'growth-tab active' : 'growth-tab'} onClick={() => setArea(item.id)}>{item.label}<span>{item.id === 'dashboard' ? (all.dashboard || []).filter((row) => row.kind !== 'layout').length : (all[item.id] || []).length}</span></button>)}</div>
    {area === 'dashboard' && <section className="growth-panel"><div className="growth-toolbar"><div><h3>{workspace} dashboard</h3><p>Choose cards, search this dashboard, and drag cards into order.</p></div><button className="primary-action" type="button" onClick={() => { setDraft({ kind: 'KPI', title: '' }); setEditing('new') }}><Plus size={16}/> Add KPI card</button></div><div className="growth-preset-row"><span>Layouts</span>{['Executive', 'Sales', 'Operations', 'Blank'].map((preset) => <button type="button" key={preset} onClick={() => saveLayout(preset === 'Blank' ? [] : preset === 'Executive' ? ['Pipeline', 'Revenue goal', 'Project health'] : preset === 'Sales' ? ['Pipeline', 'Win rate', 'Renewals'] : ['Open tasks', 'Due today', 'Project health'])}>{preset}</button>)}</div><div className="growth-dashboard-grid">{layout.filter((label) => label.toLowerCase().includes(query.toLowerCase())).map((label, index) => { const card = records.find((item) => item.title === label); return <article draggable className="growth-kpi" key={`${label}-${index}`} onDragStart={(event) => dragLayout(event, index)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropLayout(event, index)}><div><small>{card?.kind || 'Workspace metric'}</small><button type="button" aria-label={`Remove ${label} from dashboard`} onClick={() => saveLayout(layout.filter((item) => item !== label))}><Trash2 size={15}/></button></div><strong>{card?.value || (label === 'Open tasks' ? (all.tasks || []).filter((item) => item.status !== 'Done').length : label === 'Pipeline' ? (all.sales || []).length : '—')}</strong><span>{label}{card?.goal ? ` · goal ${card.goal}` : ''}</span><footer><button type="button" onClick={() => saveLayout([...layout, label])}>Duplicate card</button><button type="button" onClick={() => { setDraft(card || { title: label, kind: 'KPI' }); setEditing(card?.id || 'new') }}>Edit</button></footer></article> })}<button className="growth-add-card" type="button" onClick={() => { setDraft({ kind: 'KPI' }); setEditing('new') }}><Plus size={20}/> Add a dashboard card</button></div></section>}
    {area !== 'dashboard' && <section className="growth-panel"><div className="growth-toolbar"><div><h3>{current.title}</h3><p>{records.length} saved · {visible.length} shown</p></div><div className="growth-actions"><label>Status<select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option>{stageOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label>View<select value={view} onChange={(event) => setView(event.target.value)}><option>List</option><option>Board</option><option>Timeline</option></select></label><button type="button" className="ghost-button" onClick={exportRows}><Download size={16}/> CSV</button><button type="button" className="primary-action" onClick={() => startEdit({ status: defaults[area]?.[0] })}><Plus size={16}/> Add record</button></div></div>
      {view === 'Board' ? <div className="growth-board">{stageOptions.map((stage) => <section className="growth-column" key={stage} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOnStage(event, stage)}><h4>{stage}<span>{visible.filter((item) => (item.status || item.stage || 'Open') === stage).length}</span></h4>{visible.filter((item) => (item.status || item.stage || 'Open') === stage).map((record) => <RecordCard key={record.id} record={record} onEdit={startEdit} onRemove={remove}/>)}</section>)}</div> : <div className="growth-record-list">{visible.map((record) => <article className="growth-record" key={record.id}><div className="growth-record-main"><span className="growth-status">{record.status || record.stage || 'Open'}</span><h4>{record.title}</h4><p>{[record.customer && `Customer: ${record.customer}`, record.project && `Project: ${record.project}`, record.owner && `Owner: ${record.owner}`, record.due && `Due: ${record.due}`, record.amount && `Amount: ${record.amount}`].filter(Boolean).join(' · ') || record.notes || 'Add detail to this record.'}</p></div><div className="growth-record-actions"><button type="button" title="Move up" onClick={() => moveCard(record, -1)}><ArrowUp size={15}/></button><button type="button" title="Move down" onClick={() => moveCard(record, 1)}><ArrowDown size={15}/></button><button type="button" title="Favorite" onClick={() => save({ ...record, favorite: !record.favorite })}><Star size={15} fill={record.favorite ? 'currentColor' : 'none'}/></button><button type="button" onClick={() => startEdit(record)}>Edit</button><button type="button" onClick={() => remove(record)} aria-label={`Delete ${record.title}`}><Trash2 size={15}/></button></div></article>)}</div>}
      {visible.length === 0 && <div className="growth-empty"><Columns3 size={24}/><strong>{query ? 'No matching records' : `Start your ${current.label.toLowerCase()} board`}</strong><span>Add a record, apply a reusable template, then move work across stages.</span><button className="primary-action" type="button" onClick={() => startEdit({ status: defaults[area]?.[0] })}><Plus size={16}/> Create first record</button></div>}
      <div className="growth-template-row"><span>Reusable templates</span>{(area === 'tasks' ? ['Follow-up', 'Approval', 'Recurring maintenance'] : area === 'projects' ? ['Client launch', 'Quarterly plan', 'Incident review'] : area === 'customers' ? ['New customer', 'Renewal', 'At-risk account'] : ['New lead', 'Proposal', 'Renewal deal']).map((template) => <button type="button" key={template} onClick={() => startEdit({ title: template, template, status: defaults[area]?.[0], priority: 'Normal' })}>{template}</button>)}</div>
    </section>}
    {editing && <div className="growth-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setEditing(''); setDraft({}) } }}><form className="growth-editor" onSubmit={(event) => { event.preventDefault(); save() }}><div className="growth-toolbar"><div><p className="eyebrow">{draft.template ? `Template · ${draft.template}` : editing === 'new' ? 'New record' : 'Edit record'}</p><h3>{area === 'dashboard' ? 'Dashboard card' : current.label.slice(0, -1) || current.label}</h3></div><button type="button" className="ghost-button" onClick={() => { setEditing(''); setDraft({}) }}>Close</button></div><div className="growth-form-grid">{current.fields.map((key) => <label key={key} className={key === 'notes' || key === 'checklist' || key === 'risk' || key === 'decision' ? 'wide' : ''}>{fieldLabels[key] || key}<input autoFocus={key === 'title'} type={/date$|^due$|^renewal$|^start$/.test(key) ? 'date' : 'text'} value={draft[key] ?? ''} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} placeholder={key === 'status' || key === 'stage' ? (defaults[area] || []).join(' / ') : ''}/></label>)}</div><div className="growth-modal-actions"><span>Saved locally to this encrypted workspace.</span><button className="primary-action" type="submit">Save {current.label.slice(0, -1) || current.label}</button></div></form></div>}
    <p className="growth-notice" aria-live="polite">{busy ? 'Loading saved records…' : notice}</p>
  </div>
}

function RecordCard({ record, onEdit, onRemove }) {
  return <article draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', record.id)} className="growth-board-card"><strong>{record.title}</strong><span>{record.priority || record.owner || record.customer || 'Unassigned'}</span><div><button type="button" onClick={() => onEdit(record)}>Edit</button><button type="button" aria-label={`Delete ${record.title}`} onClick={() => onRemove(record)}><Trash2 size={14}/></button></div></article>
}
