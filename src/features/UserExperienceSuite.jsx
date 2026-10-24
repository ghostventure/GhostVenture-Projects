import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowRight, Check, CircleHelp, Command, FileUp, Plus, Search, ShieldCheck, Sparkles, Undo2, X } from 'lucide-react'
import './UserExperienceSuite.css'

const recordRoutes = {
  customers: 'customers', tasks: 'growth', quotes: 'work', invoices: 'finance', appointments: 'scheduling',
  supportTickets: 'support', projects: 'growth', sales: 'sales-growth', userProfiles: 'accounts',
}
const recordTitle = (item) => item.title || item.business_name || item.owner_name || item.subject || item.label || item.name || item.email || 'Untitled record'
const searchableText = (item) => Object.entries(item || {}).filter(([key, value]) => !key.startsWith('_') && (typeof value === 'string' || typeof value === 'number')).map(([, value]) => String(value)).join(' ').toLowerCase()
const normalizeIdentity = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const normalizePhone = (value) => String(value || '').replace(/\D/g, '')

function inspectCsv(rows, customers = []) {
  if (!rows.length) return null
  const headers = rows[0].map((value) => value.trim())
  const normalizedHeaders = headers.map(normalizeIdentity)
  const blankHeaders = headers.flatMap((header, index) => header ? [] : [index + 1])
  const duplicateHeaders = normalizedHeaders.flatMap((header, index) => header && normalizedHeaders.indexOf(header) !== index ? [headers[index]] : [])
  const dataRows = rows.slice(1).map((cells, index) => ({ rowNumber: index + 2, cells }))
  const widthIssues = dataRows.filter(({ cells }) => cells.length !== headers.length)
  const duplicateRows = []
  const seen = new Map()
  const emailIndex = normalizedHeaders.findIndex((header) => ['email', 'emailaddress', 'customeremail'].includes(header))
  const phoneIndex = normalizedHeaders.findIndex((header) => ['phone', 'phonenumber', 'mobile', 'mobilephone'].includes(header))
  const emailSet = new Set(customers.map((item) => normalizeEmail(item.email || item.customer_email)).filter(Boolean))
  const phoneSet = new Set(customers.map((item) => normalizePhone(item.phone || item.phone_number || item.mobile)).filter(Boolean))
  const existingMatches = []

  dataRows.forEach(({ rowNumber, cells }) => {
    if (!cells.some((value) => value.trim())) return
    const email = emailIndex >= 0 ? normalizeEmail(cells[emailIndex]) : ''
    const phone = phoneIndex >= 0 ? normalizePhone(cells[phoneIndex]) : ''
    const identity = email ? `email:${email}` : phone ? `phone:${phone}` : ''
    if (identity && seen.has(identity)) duplicateRows.push({ rowNumber, firstRow: seen.get(identity), kind: email ? 'email' : 'phone' })
    else if (identity) seen.set(identity, rowNumber)
    if ((email && emailSet.has(email)) || (phone && phoneSet.has(phone))) existingMatches.push({ rowNumber, kind: email && emailSet.has(email) ? 'email' : 'phone' })
  })

  return { headers, dataRows, blankHeaders, duplicateHeaders: [...new Set(duplicateHeaders)], widthIssues, duplicateRows, existingMatches, canCompareExisting: emailIndex >= 0 || phoneIndex >= 0 }
}

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
  const [importReport, setImportReport] = useState(null)
  const [importError, setImportError] = useState('')
  const [guideDone, setGuideDone] = useState(() => { try { return JSON.parse(localStorage.getItem('overhead.setup.done.v1') || '[]') } catch { return [] } })
  const [fontScale, setFontScale] = useState(() => Number(localStorage.getItem('overhead.fontScale.v1') || '100'))
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem('overhead.highContrast.v1') === 'true')
  const [updater, setUpdater] = useState({ status: 'not-checked', message: 'Update status has not been checked.' })
  const [busy, setBusy] = useState(false)
  const [tourStep, setTourStep] = useState(() => Number(localStorage.getItem('overhead.guidedTourStep.v1') || '0'))

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
    const openPanel = (event) => { if (['search', 'create', 'inbox', 'guide', 'help', 'tour'].includes(event.detail)) setPanel(event.detail) }
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
  const tour = [
    { title: 'Your workspace', text: 'The left navigation opens workspaces. Use search or the command shortcut to jump to a record or tool.', route: 'overview', action: 'Open the dashboard' },
    { title: 'Find and create records', text: 'Search checks records already loaded in this workspace. Quick create takes you to the normal form, where access rules still apply.', route: 'customers', action: 'Open customer workspace' },
    { title: 'Keep work moving', text: 'The Action Inbox groups open tasks, support requests, and queued jobs. Select an item to continue in its workspace.', route: 'growth', action: 'Open work board' },
    { title: 'Personalize and protect', text: 'Settings and Shortcuts & comfort contain navigation, text size, contrast, and recovery choices saved on this device.', route: 'settings', action: 'Open settings' },
  ]
  const currentTourStep = tour[Math.min(Math.max(tourStep, 0), tour.length - 1)]
  const nav = (section) => { setPanel(''); onNavigate(section) }
  const sectionHasRecords = index.some((item) => item.__route === activeSection)
  const emptySection = ['customers', 'growth', 'sales-growth', 'scheduling', 'documents', 'collaboration', 'finance', 'support'].includes(activeSection) && !sectionHasRecords

  async function checkUpdates() {
    setBusy(true)
    try {
      const check = window.overheadBackend?.checkForUpdatesFromGitHub || window.overheadBackend?.checkForUpdates
      if (!check) { setUpdater({ status: 'unavailable', message: 'Install a packaged release to use update checks.' }); return }
      setUpdater(await check())
    } catch (error) { setUpdater({ status: 'error', message: plainLanguageError(error, 'OverHead could not check for updates. Try again later.') }) }
    finally { setBusy(false) }
  }
  function markSetupDone(id) {
    const updated = [...new Set([...guideDone, id])]
    setGuideDone(updated); localStorage.setItem('overhead.setup.done.v1', JSON.stringify(updated))
  }
  function setTourPosition(position) {
    const next = Math.min(Math.max(position, 0), tour.length - 1)
    setTourStep(next)
    localStorage.setItem('overhead.guidedTourStep.v1', String(next))
  }
  function finishTour() { localStorage.setItem('overhead.guidedTourDone.v1', 'true'); setTourPosition(0); setPanel('') }
  function plainLanguageError(error, fallback) {
    const raw = String(error?.message || error || '').replace(/^Error invoking remote method '[^']+':\s*Error:\s*/i, '').replace(/^Error:\s*/i, '').trim()
    if (/network|fetch failed|econn|timed? ?out|offline/i.test(raw)) return 'OverHead could not reach the service. Check your internet connection and try again.'
    if (/permission|forbidden|unauthori[sz]ed|\b403\b|\b401\b/i.test(raw)) return 'Your account does not have access to finish this action. Ask a workspace owner to review your access.'
    if (/not found|enoent|missing file/i.test(raw)) return 'OverHead could not find the selected item. Refresh the workspace and try again.'
    if (/invalid|validation|required field/i.test(raw)) return 'Some information needs attention. Review the highlighted fields and try again.'
    return fallback
  }
  async function readImport(file) {
    setImportError(''); setImportRows([]); setImportReport(null); setImportFile(file?.name || '')
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setImportError('Choose a CSV under 5 MB for this preview.'); return }
    try {
      const rows = parseCsv(await file.text())
      setImportRows(rows)
      setImportReport(inspectCsv(rows, backendState.customers || []))
    }
    catch { setImportError('This CSV could not be read. Save it as UTF-8 and try again.') }
  }

  return <>
    <div className="ux-toolbar" aria-label="Workspace quick tools">
      <button type="button" onClick={() => { setPanel('search'); setSearch('') }}><Search size={16}/> Search all records</button>
      <button type="button" onClick={() => setPanel(panel === 'create' ? '' : 'create')}><Plus size={16}/> Quick create</button>
      <button type="button" onClick={() => setPanel(panel === 'inbox' ? '' : 'inbox')}><Activity size={16}/> Inbox <span className="ux-count">{inbox.length}</span></button>
      <button type="button" onClick={() => setPanel(panel === 'guide' ? '' : 'guide')}><Sparkles size={16}/> Setup {completeSetup}/{guide.length}</button>
      <button type="button" onClick={() => setPanel(panel === 'help' ? '' : 'help')}><CircleHelp size={16}/> Shortcuts & comfort</button>
      <span className={`ux-sync ${backendState.customerSync?.status === 'Synchronized' ? 'is-good' : ''}`} role="status" aria-live="polite" aria-atomic="true" title={backendState.customerSync?.message || updater.message}><i aria-hidden="true"/>Sync: {backendState.customerSync?.status || 'Waiting'}{backendState.customerSync?.last_synced_at ? `, last updated ${backendState.customerSync.last_synced_at}` : ''}</span>
      <button className="ux-update" type="button" title={updater.message || 'Check for a desktop update.'} disabled={busy} onClick={checkUpdates}>{busy ? 'Checking…' : updater.updateKind ? `${updater.updateKind} update available` : updater.status === 'not-checked' ? 'Check updates' : updater.status === 'unavailable' ? 'Updates unavailable' : updater.status === 'error' ? 'Update check failed' : `Updates: ${String(updater.status).replaceAll('-', ' ')}`}</button>
    </div>

    {emptySection && <aside className="ux-empty-hint" role="status"><strong>Nothing to show here yet.</strong><span>{activeSection === 'customers' ? 'Add a customer or preview a CSV import to get started.' : activeSection === 'growth' ? 'Create a task, project, or sales record to start your work board.' : 'Add your first record or use Search to find existing workspace information.'}</span><button type="button" onClick={() => setPanel(activeSection === 'customers' ? 'import' : 'create')}>Get started <ArrowRight size={14}/></button></aside>}
    {panel && <div className="ux-scrim" role="presentation" onMouseDown={() => setPanel('')}><section className="ux-panel" role="dialog" aria-modal="true" aria-label={panelTitle(panel)} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><small>OVERHEAD WORKSPACE</small><h2>{panelTitle(panel)}</h2></div><button type="button" aria-label="Close" onClick={() => setPanel('')}><X size={18}/></button></header>
      {panel === 'search' && <div className="ux-panel-body"><label className="ux-search"><Search size={18}/><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search names, notes, email, status…"/><kbd>Esc</kbd></label><p>{search ? `${results.length} matching records` : `${index.length} records available across this workspace`}</p><div className="ux-result-list">{results.map((item, position) => <button type="button" key={`${item.__collection}-${item.id || position}`} onClick={() => nav(item.__route)}><span>{item.__collection}</span><strong>{recordTitle(item)}</strong><small>{[item.status, item.email, item.due, item.notes].filter(Boolean).join(' · ')}</small><ArrowRight size={15}/></button>)}{search && !results.length && <p className="ux-empty">No matching records. Try a name, email, status, or part of a note.</p>}</div></div>}
      {panel === 'create' && <div className="ux-panel-body"><p>Choose what you want to add. OverHead opens the relevant workspace; the record is saved there under its normal access rules.</p><div className="ux-create-grid">{[['Customer', 'customers'], ['Task', 'growth'], ['Project', 'growth'], ['Sales opportunity', 'sales-growth'], ['Appointment', 'scheduling'], ['Invoice', 'finance'], ['Quote', 'work'], ['Support request', 'support']].map(([label, route]) => <button key={label} type="button" onClick={() => nav(route)}><Plus size={15}/>{label}<ArrowRight size={14}/></button>)}</div></div>}
      {panel === 'guide' && <div className="ux-panel-body"><p>Complete the basics to make this workspace useful. Items update automatically when OverHead can verify they are done.</p>{guide.map(([id, label, route, ready]) => { const checked = ready || guideDone.includes(id); return <article className="ux-guide-item" key={id}><span className={checked ? 'checked' : ''}>{checked && <Check size={14}/>}</span><div><strong>{label}</strong><small>{ready ? 'Complete' : checked ? 'Marked complete' : 'Recommended first step'}</small></div>{!checked && <><button type="button" onClick={() => nav(route)}>Open</button><button type="button" onClick={() => markSetupDone(id)}>Mark done</button></>}</article> })}<button className="ux-primary" type="button" onClick={() => { setTourPosition(0); setPanel('tour') }}>Start guided tour</button></div>}
      {panel === 'tour' && <div className="ux-panel-body ux-guided-tour" aria-live="polite"><p className="ux-tour-progress">Step {Math.min(tourStep + 1, tour.length)} of {tour.length}</p><h3>{currentTourStep.title}</h3><p>{currentTourStep.text}</p><button type="button" onClick={() => onNavigate(currentTourStep.route)}>{currentTourStep.action} <ArrowRight size={14}/></button><div className="ux-actions"><button type="button" disabled={tourStep <= 0} onClick={() => setTourPosition(tourStep - 1)}>Previous</button><button type="button" onClick={() => tourStep < tour.length - 1 ? setTourPosition(tourStep + 1) : finishTour()}>{tourStep < tour.length - 1 ? 'Next step' : 'Finish tour'}</button><button type="button" onClick={finishTour}>Skip tour</button></div></div>}
      {panel === 'inbox' && <div className="ux-panel-body"><p>Open work from tasks, support, and queued jobs. Select an item to continue in its workspace.</p>{inbox.map((item, index) => <button className="ux-inbox-item" type="button" key={`${item.__label}-${item.id || index}`} onClick={() => nav(item.__route)}><span>{item.__label}</span><strong>{recordTitle(item)}</strong><small>{[item.status, item.due || item.due_at, item.assignee].filter(Boolean).join(' · ') || 'Needs review'}</small><ArrowRight size={15}/></button>)}{!inbox.length && <p className="ux-empty">Your inbox is clear. New open tasks and support requests will appear here.</p>}{operationNotice && <small className="ux-operation">Latest activity: {operationNotice}</small>}</div>}
      {panel === 'recovery' && <div className="ux-panel-body"><ShieldCheck size={26}/><p>Create a safety backup before a major change. To restore, OverHead validates the backup and creates another backup before replacing workspace data.</p><div className="ux-actions"><button type="button" onClick={async () => { try { const result = await window.overheadBackend?.createBackup?.(); if (result) setOperationNotice(`Safety backup created: ${result.backupPath}`); else setImportError('The backup service is unavailable. Open Settings to review backup options.'); setPanel('') } catch (error) { setImportError(plainLanguageError(error, 'OverHead could not create the backup. Try again or open Settings for recovery options.')) } }}>Create safety backup</button><button type="button" onClick={() => nav('settings')}>Open restore tools</button></div>{importError && <p role="alert">{importError}</p>}</div>}
      {panel === 'import' && <div className="ux-panel-body"><p>Choose a CSV to inspect its columns and sample rows. This preview does not write any records; continue to the supported import workspace when you are ready.</p><label className="ux-file"><FileUp size={18}/>Choose CSV file<input type="file" accept=".csv,text/csv" onChange={(event) => readImport(event.target.files?.[0])}/></label>{importFile && <strong>{importFile}</strong>}{importError && <p role="alert">{importError}</p>}{importReport && <section className="ux-import-report" aria-label="CSV data quality summary"><h3>Pre-import review</h3><p>Checked {importReport.dataRows.length} data rows and {importReport.headers.length} columns. This review does not change or import records.</p><ul>
        {!!importReport.blankHeaders.length && <li className="is-warning"><strong>{importReport.blankHeaders.length} blank column heading{importReport.blankHeaders.length === 1 ? '' : 's'}.</strong> Add a heading in column{importReport.blankHeaders.length === 1 ? '' : 's'} {importReport.blankHeaders.join(', ')} before importing.</li>}
        {!!importReport.duplicateHeaders.length && <li className="is-warning"><strong>Repeated column names: {importReport.duplicateHeaders.join(', ')}.</strong> Rename repeated headings so fields can be mapped unambiguously.</li>}
        {!!importReport.widthIssues.length && <li className="is-warning"><strong>{importReport.widthIssues.length} row{importReport.widthIssues.length === 1 ? '' : 's'} have a different number of cells than the header.</strong> Review row{importReport.widthIssues.length === 1 ? '' : 's'} {importReport.widthIssues.slice(0, 8).map((item) => item.rowNumber).join(', ')}{importReport.widthIssues.length > 8 ? ', …' : ''}.</li>}
        {!!importReport.duplicateRows.length && <li className="is-warning"><strong>{importReport.duplicateRows.length} possible duplicate row{importReport.duplicateRows.length === 1 ? '' : 's'} in this file.</strong> Matching {importReport.duplicateRows[0].kind}; review rows {importReport.duplicateRows.slice(0, 8).map((item) => `${item.rowNumber} (matches row ${item.firstRow})`).join(', ')}{importReport.duplicateRows.length > 8 ? ', …' : ''}.</li>}
        {!!importReport.existingMatches.length && <li className="is-warning"><strong>{importReport.existingMatches.length} row{importReport.existingMatches.length === 1 ? '' : 's'} may match existing customers.</strong> Matching email or phone in this workspace; review rows {importReport.existingMatches.slice(0, 8).map((item) => item.rowNumber).join(', ')}{importReport.existingMatches.length > 8 ? ', …' : ''}.</li>}
        {!importReport.canCompareExisting && <li>Existing-customer duplicate check skipped: this CSV has no recognized email or phone column.</li>}
        {!importReport.blankHeaders.length && !importReport.duplicateHeaders.length && !importReport.widthIssues.length && !importReport.duplicateRows.length && !importReport.existingMatches.length && <li className="is-good"><strong>No obvious CSV structure or duplicate issues found.</strong> Review the preview and field mapping before continuing.</li>}
      </ul></section>}{importRows.length > 0 && <><p>Showing up to 20 sample rows from {Math.max(0, importRows.length - 1)} total data rows. First row is treated as column headers.</p><div className="ux-table-wrap"><table><tbody>{importRows.slice(0, 21).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div><button className="ux-primary" type="button" onClick={() => nav('imports')}>Continue to import connections <ArrowRight size={15}/></button></>}</div>}
      {panel === 'help' && <div className="ux-panel-body"><h3><Command size={17}/> Keyboard shortcuts</h3><p><kbd>Ctrl</kbd> + <kbd>K</kbd> (or <kbd>⌘</kbd> + <kbd>K</kbd>) opens a searchable command and workspace switcher. Use the arrow keys to choose an item and <kbd>Enter</kbd> to open it.</p><p><kbd>Alt</kbd> + <kbd>Shift</kbd> + assigned letter jumps directly to a workspace. Open Settings → Navigation shortcuts to assign or review letters. Press <kbd>Esc</kbd> to close a panel.</p><p>Workspace tabs and tool tabs also support arrow-key movement. Search, quick-create, and the inbox remain available in the top toolbar.</p><h3>Comfort and accessibility</h3><label className="ux-range">Text size <strong>{fontScale}%</strong><input type="range" min="90" max="125" step="5" value={fontScale} onChange={(event) => setFontScale(Number(event.target.value))}/></label><label className="ux-toggle"><input type="checkbox" checked={highContrast} onChange={(event) => setHighContrast(event.target.checked)}/> High contrast</label><button type="button" onClick={() => { setPanel('recovery'); setImportError('') }}><Undo2 size={16}/> Backup and recovery</button></div>}
    </section></div>}
  </>
}

function panelTitle(panel) {
  return ({ search: 'Search all records', create: 'Quick create', guide: 'First-run setup', inbox: 'Action inbox', help: 'Shortcuts and comfort', tour: 'Guided tour', recovery: 'Undo and recovery', import: 'Guided import preview' })[panel] || 'Workspace tools'
}
