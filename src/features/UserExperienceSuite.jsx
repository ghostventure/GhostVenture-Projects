import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowRight, Check, CircleHelp, Command, FileUp, Plus, Search, ShieldCheck, Sparkles, Undo2, X } from 'lucide-react'
import './UserExperienceSuite.css'

const recordRoutes = {
  customers: 'customers', tasks: 'growth', quotes: 'work', invoices: 'finance', appointments: 'scheduling',
  supportTickets: 'support', projects: 'growth', sales: 'sales-growth', userProfiles: 'accounts',
}
const recordTitle = (item) => item.title || item.business_name || item.owner_name || item.subject || item.label || item.name || item.email || 'Untitled record'
const searchableText = (item) => Object.entries(item || {}).filter(([key, value]) => !key.startsWith('_') && (typeof value === 'string' || typeof value === 'number')).map(([, value]) => String(value)).join(' ').toLowerCase()

function parseCsv(text) {
  const rows = []
  let row = [], cell = '', quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell); if (row.some((value) => value.trim())) rows.push(row)
      row = []; cell = ''
    } else cell += char
  }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row)
  return rows
}

export default function UserExperienceSuite({ backendState = {}, activeSection = 'overview', onNavigate = () => {}, operationNotice = '', setOperationNotice = () => {} }) {
  const [panel, setPanel] = useState('')
  const [search, setSearch] = useState('')
  const [importFile, setImportFile] = useState('')
  const [importRows, setImportRows] = useState([])
  const [importError, setImportError] = useState('')
  const [guideDone, setGuideDone] = useState(() => { try { return JSON.parse(localStorage.getItem('overhead.setup.done.v1') || '[]') } catch { return [] } })
  const [fontScale, setFontScale] = useState(() => Number(localStorage.getItem('overhead.fontScale.v1') || '100'))
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem('overhead.highContrast.v1') === 'true')
  const [updater, setUpdater] = useState({ status: 'not-checked', message: 'Update status has not been checked.' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.documentElement.style.setProperty('--ux-font-scale', `${fontScale}%`)
    document.documentElement.dataset.highContrast = String(highContrast)
    localStorage.setItem('overhead.fontScale.v1', String(fontScale))
    localStorage.setItem('overhead.highContrast.v1', String(highContrast))
  }, [fontScale, highContrast])
  useEffect(() => {
    let live = true
    window.overheadBackend?.updaterStatus?.().then((status) => { if (live) setUpdater(status) }).catch(() => {})
    return () => { live = false }
  }, [])
  useEffect(() => {
    if (!panel) return undefined
    const onKeyDown = (event) => { if (event.key === 'Escape') setPanel('') }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [panel])
  useEffect(() => {
    const openPanel = (event) => { if (['search', 'create', 'inbox', 'guide', 'help'].includes(event.detail)) setPanel(event.detail) }
    window.addEventListener('overhead:open-ux-panel', openPanel)
    return () => window.removeEventListener('overhead:open-ux-panel', openPanel)
  }, [])

  const index = useMemo(() => Object.entries(backendState).flatMap(([collection, values]) => Array.isArray(values)
    ? values.filter((item) => item && typeof item === 'object').map((item) => ({ ...item, __collection: collection, __route: recordRoutes[collection] || 'overview' })) : []), [backendState])
  const results = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? index.filter((item) => searchableText(item).includes(query)).slice(0, 12) : []
  }, [index, search])
  const inbox = useMemo(() => {
    const openTasks = (backendState.tasks || []).filter((task) => !['Complete', 'Done', 'Closed'].includes(task.status)).slice(0, 6).map((item) => ({ ...item, __label: 'Task', __route: 'growth' }))
    const openSupport = (backendState.supportTickets || []).filter((ticket) => !['Resolved', 'Closed', 'Complete'].includes(ticket.status)).slice(0, 4).map((item) => ({ ...item, __label: 'Support', __route: 'support' }))
    const jobs = (backendState.queuedJobs || []).filter((job) => !['Complete', 'Done', 'Canceled'].includes(job.status)).slice(0, 4).map((item) => ({ ...item, __label: 'Queued job', __route: 'automations' }))
    return [...openTasks, ...openSupport, ...jobs].slice(0, 12)
  }, [backendState])
  const guide = [
    ['profile', 'Review your business profile', 'settings', Boolean(backendState.health?.databaseExists)],
    ['customer', 'Add or import a customer', 'customers', Number(backendState.health?.customerCount || backendState.customers?.length || 0) > 0],
    ['task', 'Create your first task', 'growth', Number(backendState.health?.taskCount || backendState.tasks?.length || 0) > 0],
    ['backup', 'Create a safety backup', 'settings', Boolean(backendState.health?.backupCount)],
  ]
  const completeSetup = guide.filter(([id, , , ready]) => ready || guideDone.includes(id)).length
  const nav = (section) => { setPanel(''); onNavigate(section) }
  const sectionHasRecords = index.some((item) => item.__route === activeSection)
  const emptySection = ['customers', 'growth', 'sales-growth', 'scheduling', 'documents', 'collaboration', 'finance', 'support'].includes(activeSection) && !sectionHasRecords

  async function checkUpdates() {
    setBusy(true)
    try {
      const check = window.overheadBackend?.checkForUpdatesFromGitHub || window.overheadBackend?.checkForUpdates
      if (!check) { setUpdater({ status: 'unavailable', message: 'Install a packaged release to use update checks.' }); return }
      setUpdater(await check())
    } catch (error) { setUpdater({ status: 'error', message: error?.message || 'Update check failed.' }) }
    finally { setBusy(false) }
  }
  function markSetupDone(id) {
    const updated = [...new Set([...guideDone, id])]
    setGuideDone(updated); localStorage.setItem('overhead.setup.done.v1', JSON.stringify(updated))
  }
  async function readImport(file) {
    setImportError(''); setImportRows([]); setImportFile(file?.name || '')
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setImportError('Choose a CSV under 5 MB for this preview.'); return }
    try { setImportRows(parseCsv(await file.text()).slice(0, 21)) }
    catch { setImportError('This CSV could not be read. Save it as UTF-8 and try again.') }
  }

  return <>
    <div className="ux-toolbar" aria-label="Workspace quick tools">
      <button type="button" onClick={() => { setPanel('search'); setSearch('') }}><Search size={16}/> Search all records</button>
      <button type="button" onClick={() => setPanel(panel === 'create' ? '' : 'create')}><Plus size={16}/> Quick create</button>
      <button type="button" onClick={() => setPanel(panel === 'inbox' ? '' : 'inbox')}><Activity size={16}/> Inbox <span className="ux-count">{inbox.length}</span></button>
      <button type="button" onClick={() => setPanel(panel === 'guide' ? '' : 'guide')}><Sparkles size={16}/> Setup {completeSetup}/{guide.length}</button>
      <button type="button" onClick={() => setPanel(panel === 'help' ? '' : 'help')}><CircleHelp size={16}/> Shortcuts & comfort</button>
      <span className={`ux-sync ${backendState.customerSync?.status === 'Synchronized' ? 'is-good' : ''}`} title={backendState.customerSync?.message || updater.message}><i/>Sync: {backendState.customerSync?.status || 'Waiting'}</span>
      <button className="ux-update" type="button" title={updater.message || 'Check for a desktop update.'} disabled={busy} onClick={checkUpdates}>{busy ? 'Checking…' : updater.updateKind ? `${updater.updateKind} update available` : updater.status === 'not-checked' ? 'Check updates' : updater.status === 'unavailable' ? 'Updates unavailable' : updater.status === 'error' ? 'Update check failed' : `Updates: ${String(updater.status).replaceAll('-', ' ')}`}</button>
    </div>

    {emptySection && <aside className="ux-empty-hint" role="status"><strong>Nothing to show here yet.</strong><span>{activeSection === 'customers' ? 'Add a customer or preview a CSV import to get started.' : activeSection === 'growth' ? 'Create a task, project, or sales record to start your work board.' : 'Add your first record or use Search to find existing workspace information.'}</span><button type="button" onClick={() => setPanel(activeSection === 'customers' ? 'import' : 'create')}>Get started <ArrowRight size={14}/></button></aside>}

    {panel && <div className="ux-scrim" role="presentation" onMouseDown={() => setPanel('')}><section className="ux-panel" role="dialog" aria-modal="true" aria-label={panelTitle(panel)} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><small>OVERHEAD WORKSPACE</small><h2>{panelTitle(panel)}</h2></div><button type="button" aria-label="Close" onClick={() => setPanel('')}><X size={18}/></button></header>
      {panel === 'search' && <div className="ux-panel-body"><label className="ux-search"><Search size={18}/><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search names, notes, email, status…"/><kbd>Esc</kbd></label><p>{search ? `${results.length} matching records` : `${index.length} records available across this workspace`}</p><div className="ux-result-list">{results.map((item, position) => <button type="button" key={`${item.__collection}-${item.id || position}`} onClick={() => nav(item.__route)}><span>{item.__collection}</span><strong>{recordTitle(item)}</strong><small>{[item.status, item.email, item.due, item.notes].filter(Boolean).join(' · ')}</small><ArrowRight size={15}/></button>)}{search && !results.length && <p className="ux-empty">No matching records. Try a name, email, status, or part of a note.</p>}</div></div>}
      {panel === 'create' && <div className="ux-panel-body"><p>Choose what you want to add. OverHead opens the relevant workspace; the record is saved there under its normal access rules.</p><div className="ux-create-grid">{[['Customer', 'customers'], ['Task', 'growth'], ['Project', 'growth'], ['Sales opportunity', 'sales-growth'], ['Appointment', 'scheduling'], ['Invoice', 'finance'], ['Quote', 'work'], ['Support request', 'support']].map(([label, route]) => <button key={label} type="button" onClick={() => nav(route)}><Plus size={15}/>{label}<ArrowRight size={14}/></button>)}</div></div>}
      {panel === 'guide' && <div className="ux-panel-body"><p>Complete the basics to make this workspace useful. Items update automatically when OverHead can verify they are done.</p>{guide.map(([id, label, route, ready]) => { const checked = ready || guideDone.includes(id); return <article className="ux-guide-item" key={id}><span className={checked ? 'checked' : ''}>{checked && <Check size={14}/>}</span><div><strong>{label}</strong><small>{ready ? 'Complete' : checked ? 'Marked complete' : 'Recommended first step'}</small></div>{!checked && <><button type="button" onClick={() => nav(route)}>Open</button><button type="button" onClick={() => markSetupDone(id)}>Mark done</button></>}</article> })}</div>}
      {panel === 'inbox' && <div className="ux-panel-body"><p>Open work from tasks, support, and queued jobs. Select an item to continue in its workspace.</p>{inbox.map((item, index) => <button className="ux-inbox-item" type="button" key={`${item.__label}-${item.id || index}`} onClick={() => nav(item.__route)}><span>{item.__label}</span><strong>{recordTitle(item)}</strong><small>{[item.status, item.due || item.due_at, item.assignee].filter(Boolean).join(' · ') || 'Needs review'}</small><ArrowRight size={15}/></button>)}{!inbox.length && <p className="ux-empty">Your inbox is clear. New open tasks and support requests will appear here.</p>}{operationNotice && <small className="ux-operation">Latest activity: {operationNotice}</small>}</div>}
      {panel === 'recovery' && <div className="ux-panel-body"><ShieldCheck size={26}/><p>Create a safety backup before a major change. To restore, OverHead validates the backup and creates another backup before replacing workspace data.</p><div className="ux-actions"><button type="button" onClick={async () => { try { const result = await window.overheadBackend?.createBackup?.(); if (result) setOperationNotice(`Safety backup created: ${result.backupPath}`); else setImportError('The backup service is unavailable. Open Settings to review backup options.'); setPanel('') } catch (error) { setImportError(error?.message || 'Backup could not be created.') } }}>Create safety backup</button><button type="button" onClick={() => nav('settings')}>Open restore tools</button></div>{importError && <p role="alert">{importError}</p>}</div>}
      {panel === 'import' && <div className="ux-panel-body"><p>Choose a CSV to inspect its columns and sample rows. This preview does not write any records; continue to the supported import workspace when you are ready.</p><label className="ux-file"><FileUp size={18}/>Choose CSV file<input type="file" accept=".csv,text/csv" onChange={(event) => readImport(event.target.files?.[0])}/></label>{importFile && <strong>{importFile}</strong>}{importError && <p role="alert">{importError}</p>}{importRows.length > 0 && <><p>Showing {Math.max(0, importRows.length - 1)} sample rows. First row is treated as column headers.</p><div className="ux-table-wrap"><table><tbody>{importRows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div><button className="ux-primary" type="button" onClick={() => nav('imports')}>Continue to import connections <ArrowRight size={15}/></button></>}</div>}
      {panel === 'help' && <div className="ux-panel-body"><h3><Command size={17}/> Keyboard shortcuts</h3><p><kbd>Ctrl</kbd> + <kbd>K</kbd> (or <kbd>⌘</kbd> + <kbd>K</kbd>) opens a searchable command and workspace switcher. Use the arrow keys to choose an item and <kbd>Enter</kbd> to open it.</p><p><kbd>Alt</kbd> + <kbd>Shift</kbd> + assigned letter jumps directly to a workspace. Open Settings → Navigation shortcuts to assign or review letters. Press <kbd>Esc</kbd> to close a panel.</p><p>Workspace tabs and tool tabs also support arrow-key movement. Search, quick-create, and the inbox remain available in the top toolbar.</p><h3>Comfort and accessibility</h3><label className="ux-range">Text size <strong>{fontScale}%</strong><input type="range" min="90" max="125" step="5" value={fontScale} onChange={(event) => setFontScale(Number(event.target.value))}/></label><label className="ux-toggle"><input type="checkbox" checked={highContrast} onChange={(event) => setHighContrast(event.target.checked)}/> High contrast</label><button type="button" onClick={() => { setPanel('recovery'); setImportError('') }}><Undo2 size={16}/> Backup and recovery</button></div>}
    </section></div>}
  </>
}

function panelTitle(panel) {
  return ({ search: 'Search all records', create: 'Quick create', guide: 'First-run setup', inbox: 'Action inbox', help: 'Shortcuts and comfort', recovery: 'Undo and recovery', import: 'Guided import preview' })[panel] || 'Workspace tools'
}
