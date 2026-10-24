import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Archive, CalendarClock, CheckCircle2, ClipboardCheck, Download, FileWarning, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { useFeatureRecords } from './FeatureWave101Helpers'
import './OperationsQualityPanel.css'

const doneStatuses = new Set(['done', 'complete', 'completed', 'canceled', 'cancelled', 'rejected', 'paid', 'closed'])
const todayKey = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const dateValue = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
const customerLabel = (customer) => customer?.business_name || customer?.owner_name || customer?.email || 'Unnamed customer'
const identityKey = (value) => String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += char
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((item) => item.some((value) => value.trim()))
}

export default function OperationsQualityPanel({ backendState = {}, session = {}, setOperationNotice = () => {} }) {
  const tasks = backendState.tasks || []
  const { records: featureRecords } = useFeatureRecords('tasks')
  const actionableTasks = featureRecords.filter((record) => !record.kind)
  const appointments = backendState.appointments || []
  const customers = backendState.customers || []
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkStatus, setBulkStatus] = useState('Complete')
  const [bulkReview, setBulkReview] = useState(false)
  const [backupList, setBackupList] = useState([])
  const [backupError, setBackupError] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)
  const [csvReport, setCsvReport] = useState(null)
  const [requiredHeaders, setRequiredHeaders] = useState([])
  const [exportHistory, setExportHistory] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem('overhead.operationsExportHistory.v1') || '[]'); return Array.isArray(saved) ? saved : [] } catch { return [] }
  })

  const today = todayKey()
  const myWork = useMemo(() => {
    const who = identityKey(session.email || session.ownerName)
    const combinedTasks = [...actionableTasks, ...tasks]
    const todaysTasks = combinedTasks.filter((task, index) => {
      if (task.id && combinedTasks.findIndex((candidate) => candidate.id === task.id) !== index) return false
      const due = String(task.due || task.due_at || task.due_date || '').slice(0, 10)
      const owner = identityKey(task.assignee || task.owner || task.assigned_to || task.assigned_email)
      return due === today && !doneStatuses.has(String(task.status || '').toLowerCase()) && (!owner || owner === who)
    })
    const todaysAppointments = appointments.filter((item) => String(item.scheduled_for || item.start_at || item.startAt || '').slice(0, 10) === today)
    return { tasks: todaysTasks, appointments: todaysAppointments }
  }, [tasks, actionableTasks, appointments, today, session.email, session.ownerName])

  const duplicates = useMemo(() => {
    const seen = new Map()
    const candidates = []
    customers.forEach((customer) => {
      const email = identityKey(customer.email)
      const name = identityKey(customer.business_name || customer.owner_name)
      const key = email ? `email:${email}` : name ? `name:${name}` : ''
      if (!key) return
      const prior = seen.get(key)
      if (prior) candidates.push({ first: prior, second: customer, reason: email ? 'Matching email address' : 'Matching customer name' })
      else seen.set(key, customer)
    })
    return candidates
  }, [customers])

  const completeness = useMemo(() => customers.flatMap((customer) => {
    const missing = []
    if (!String(customer.business_name || customer.owner_name || '').trim()) missing.push('name')
    if (!String(customer.email || '').trim()) missing.push('email')
    if (!String(customer.phone || customer.phone_number || '').trim()) missing.push('phone')
    if (!String(customer.service_area || customer.serviceArea || '').trim()) missing.push('service area')
    return missing.length ? [{ customer, missing }] : []
  }), [customers])

  const conflicts = useMemo(() => {
    const events = appointments.map((item) => {
      const start = dateValue(item.scheduled_for || item.start_at || item.startAt)
      if (!start || doneStatuses.has(String(item.status || '').toLowerCase())) return null
      const duration = Number(item.duration_minutes || item.durationMinutes || 60)
      const end = new Date(start.getTime() + Math.max(15, Math.min(duration, 1440)) * 60000)
      return { item, start, end, owner: identityKey(item.assignee || item.owner || item.assigned_to) }
    }).filter(Boolean).sort((a, b) => a.start - b.start)
    const found = []
    for (let left = 0; left < events.length; left += 1) {
      for (let right = left + 1; right < events.length && events[right].start < events[left].end; right += 1) {
        const sameAssignee = events[left].owner && events[right].owner ? events[left].owner === events[right].owner : true
        if (sameAssignee && events[left].start < events[right].end) found.push({ first: events[left], second: events[right] })
      }
    }
    return found
  }, [appointments])

  const selectedTasks = actionableTasks.filter((task) => selectedIds.includes(task.id))

  async function loadBackups() {
    if (!window.overheadBackend?.listBackups) { setBackupError('Backup inventory is unavailable in this app build.'); return }
    try { setBackupError(''); setBackupList(await window.overheadBackend.listBackups()) }
    catch (error) { setBackupError(error?.message || 'Backup status is unavailable for this account.') }
  }
  useEffect(() => { loadBackups() }, [])

  function toggleTask(id) { setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }
  async function applyBulkStatus() {
    if (!selectedTasks.length || !window.overheadBackend?.updateFeatureRecordStatuses) return
    try {
      const result = await window.overheadBackend.updateFeatureRecordStatuses({ collection: 'tasks', recordIds: selectedIds, status: bulkStatus })
      setSelectedIds([]); setBulkReview(false)
      setOperationNotice(`Updated ${result?.updated ?? selectedTasks.length} task statuses.`)
      window.dispatchEvent(new CustomEvent('overhead:feature-records-updated', { detail: { collection: 'tasks' } }))
    } catch (error) { setOperationNotice(error?.message || 'Bulk task update could not be completed.') }
  }

  async function inspectCsv(file) {
    if (!file) return
    const rows = parseCsv(await file.text())
    const headers = (rows[0] || []).map((header) => header.trim())
    const issues = []
    if (!headers.length) issues.push({ row: 1, message: 'The file has no header row.' })
    headers.forEach((header, index) => { if (!header) issues.push({ row: 1, message: `Column ${index + 1} has a blank header.` }) })
    const headerKeySet = new Set()
    headers.forEach((header, index) => {
      const key = identityKey(header)
      if (key && headerKeySet.has(key)) issues.push({ row: 1, message: `Column ${index + 1} repeats the “${header}” header.` })
      headerKeySet.add(key)
    })
    const body = rows.slice(1)
    const fingerprints = new Set()
    body.forEach((values, index) => {
      const rowNumber = index + 2
      if (values.length !== headers.length) issues.push({ row: rowNumber, message: `Expected ${headers.length} columns, found ${values.length}.` })
      requiredHeaders.forEach((header) => {
        const position = headers.indexOf(header)
        if (position >= 0 && !String(values[position] || '').trim()) issues.push({ row: rowNumber, message: `Required value “${header}” is missing.` })
      })
      const fingerprint = values.map(identityKey).join('|')
      if (fingerprints.has(fingerprint)) issues.push({ row: rowNumber, message: 'This row duplicates an earlier row in this file.' })
      fingerprints.add(fingerprint)
    })
    setCsvReport({ fileName: file.name, headers, rowCount: body.length, issues })
  }

  function downloadOperationalCsv() {
    const records = [
      ...actionableTasks.map((item) => ({ type: 'Task', ...item })),
      ...appointments.map((item) => ({ type: 'Appointment', ...item })),
      ...customers.map((item) => ({ type: 'Customer', ...item })),
    ]
    const columns = ['type', 'id', 'title', 'business_name', 'owner_name', 'email', 'status', 'due', 'scheduled_for']
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = [columns, ...records.map((record) => columns.map((column) => record[column] ?? ''))].map((row) => row.map(quote).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    const fileName = `overhead-operations-${today}.csv`
    link.href = url; link.download = fileName; link.click(); URL.revokeObjectURL(url)
    const entry = { fileName, createdAt: new Date().toISOString(), recordCount: records.length }
    const next = [entry, ...exportHistory].slice(0, 20)
    setExportHistory(next)
    try { localStorage.setItem('overhead.operationsExportHistory.v1', JSON.stringify(next)) } catch {}
  }

  async function createBackup() {
    if (!window.overheadBackend?.createBackup) { setBackupError('Backup creation is unavailable in this app build.'); return }
    setBackupBusy(true)
    try {
      const result = await window.overheadBackend.createBackup()
      setOperationNotice(`Backup created: ${result?.backupPath || 'saved locally'}`)
      await loadBackups()
    } catch (error) { setBackupError(error?.message || 'Backup could not be created.') }
    finally { setBackupBusy(false) }
  }

  return <section className="operations-quality" aria-label="Operations quality tools">
    <div className="operations-quality-heading"><div><p className="eyebrow">Daily operations</p><h2>Work quality and data checks</h2></div><span>{today}</span></div>
    <div className="operations-quality-grid">
      <article className="operations-quality-card"><div className="operations-card-title"><CalendarClock size={18}/><h3>My work today</h3></div><p>{myWork.tasks.length} open task{myWork.tasks.length === 1 ? '' : 's'} and {myWork.appointments.length} appointment{myWork.appointments.length === 1 ? '' : 's'} scheduled for today.</p>
        {[...myWork.tasks.map((item) => ({ label: item.title || item.label || 'Untitled task', when: item.due || item.due_at || 'Due today' })), ...myWork.appointments.map((item) => ({ label: item.title || 'Appointment', when: dateValue(item.scheduled_for || item.start_at)?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) || 'Today' }))].slice(0, 6).map((item, index) => <div className="operations-line-item" key={`${item.label}-${index}`}><strong>{item.label}</strong><span>{item.when}</span></div>)}
        {!myWork.tasks.length && !myWork.appointments.length && <small>No work is assigned to you today.</small>}
      </article>

      <article className="operations-quality-card"><div className="operations-card-title"><Users size={18}/><h3>Possible duplicate customers</h3><span className="operations-count">{duplicates.length}</span></div><p>Matched by exact email or, when email is absent, exact customer name. Review candidates before merging.</p>{duplicates.slice(0, 5).map(({ first, second, reason }) => <div className="operations-line-item" key={`${first.id}-${second.id}`}><strong>{customerLabel(first)} ↔ {customerLabel(second)}</strong><span>{reason}</span></div>)}{!duplicates.length && <small>No exact duplicate candidates found.</small>}</article>

      <article className="operations-quality-card"><div className="operations-card-title"><ClipboardCheck size={18}/><h3>Bulk task status</h3></div><p>Select tasks, review the exact changes, then confirm. Updates are sent to the local task workspace.</p><label className="operations-select-label">Set status<select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}><option>Open</option><option>Queued</option><option>Blocked</option><option>Complete</option></select></label><div className="operations-selection-list">{actionableTasks.filter((task) => task.id && !doneStatuses.has(String(task.status || '').toLowerCase())).slice(0, 8).map((task) => <label key={task.id}><input type="checkbox" checked={selectedIds.includes(task.id)} onChange={() => toggleTask(task.id)}/><span>{task.title || task.label || 'Untitled task'} <small>· {task.status || 'Open'}</small></span></label>)}</div><button type="button" className="operations-action" disabled={!selectedTasks.length} onClick={() => setBulkReview(true)}>Review {selectedTasks.length} selected</button>
        {bulkReview && <div className="operations-review" role="region" aria-label="Bulk update review"><strong>Confirm status update</strong><p>{selectedTasks.length} tasks will change to “{bulkStatus}”.</p>{selectedTasks.map((task) => <small key={task.id}>{task.title || task.label} · {task.status || 'Open'} → {bulkStatus}</small>)}<div><button type="button" className="operations-action" onClick={applyBulkStatus}>Apply updates</button><button type="button" onClick={() => setBulkReview(false)}>Cancel</button></div></div>}
      </article>

      <article className="operations-quality-card"><div className="operations-card-title"><FileWarning size={18}/><h3>CSV row check</h3></div><p>Check headers, row width, repeated rows, and selected required columns. This is a preview only; it does not import data.</p><label className="operations-file-label">Choose CSV to validate<input type="file" accept=".csv,text/csv" onChange={(event) => inspectCsv(event.target.files?.[0])}/></label>{csvReport && <><strong>{csvReport.fileName} · {csvReport.rowCount} data rows</strong>{csvReport.headers.length > 0 && <div className="operations-required-fields"><span>Mark required columns:</span>{csvReport.headers.filter(Boolean).map((header) => <label key={header}><input type="checkbox" checked={requiredHeaders.includes(header)} onChange={() => setRequiredHeaders((current) => current.includes(header) ? current.filter((item) => item !== header) : [...current, header])}/>{header}</label>)}</div>}<button type="button" className="operations-action" onClick={() => inspectCsv(document.querySelector('.operations-file-label input')?.files?.[0])}>Recheck rows</button><div className="operations-issues" role="status">{csvReport.issues.length ? <><strong>{csvReport.issues.length} issue{csvReport.issues.length === 1 ? '' : 's'} found</strong>{csvReport.issues.slice(0, 8).map((issue, index) => <small key={`${issue.row}-${index}`}>Row {issue.row}: {issue.message}</small>)}</> : <span><CheckCircle2 size={15}/> No structural issues found.</span>}</div></>}</article>

      <article className="operations-quality-card"><div className="operations-card-title"><AlertTriangle size={18}/><h3>Appointment conflicts</h3><span className="operations-count">{conflicts.length}</span></div><p>Overlaps assume a 60-minute duration when no appointment length is stored. Conflicts are compared per assignee when assignments exist.</p>{conflicts.slice(0, 5).map(({ first, second }) => <div className="operations-conflict" key={`${first.item.id}-${second.item.id}`}><strong>{first.item.title || 'Appointment'} overlaps {second.item.title || 'another appointment'}</strong><span>{first.start.toLocaleString()} – {first.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span><span>{second.start.toLocaleString()} – {second.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div>)}{!conflicts.length && <small>No appointment overlaps found in the available schedule.</small>}</article>

      <article className="operations-quality-card"><div className="operations-card-title"><CheckCircle2 size={18}/><h3>Customer data completeness</h3><span className="operations-count">{completeness.length}</span></div><p>Records missing a name, email, phone, or service area. Open the related customer workspace to update them.</p>{completeness.slice(0, 6).map(({ customer, missing }) => <div className="operations-line-item" key={customer.id}><strong>{customerLabel(customer)}</strong><span>{missing.join(', ')} · ID {customer.id}</span></div>)}{!completeness.length && <small>All loaded customer records have the checked fields.</small>}</article>

      <article className="operations-quality-card"><div className="operations-card-title"><Archive size={18}/><h3>Local backup status</h3></div><p>Backup inventory is read from the protected local backup service. Only accounts permitted by workspace policy can inspect or create backups.</p>{backupList.length ? <><strong>Latest backup: {backupList[0].createdAt ? new Date(backupList[0].createdAt).toLocaleString() : 'timestamp unavailable'}</strong><span>{backupList[0].verified ? 'Verified' : 'Needs review'} · {backupList.length} backup{backupList.length === 1 ? '' : 's'}</span></> : <strong>No available backup record was returned.</strong>}{backupError && <small role="alert">{backupError}</small>}<div className="operations-card-actions"><button type="button" onClick={loadBackups}><RefreshCw size={14}/> Refresh</button>{['Owner', 'Bookkeeper'].includes(session.role) && <button type="button" className="operations-action" disabled={backupBusy} onClick={createBackup}>{backupBusy ? 'Creating…' : 'Create backup'}</button>}</div></article>

      <article className="operations-quality-card"><div className="operations-card-title"><Download size={18}/><h3>Operations export history</h3></div><p>Exports are created on this device. The history records only exports initiated from this panel.</p><button type="button" className="operations-action" onClick={downloadOperationalCsv}>Export current tasks, appointments, and customers</button>{exportHistory.slice(0, 5).map((item) => <div className="operations-line-item" key={`${item.fileName}-${item.createdAt}`}><strong>{item.fileName}</strong><span>{new Date(item.createdAt).toLocaleString()} · {item.recordCount} records</span></div>)}{!exportHistory.length && <small>No exports from this panel yet.</small>}<button type="button" className="operations-clear-history" onClick={() => { setExportHistory([]); try { localStorage.removeItem('overhead.operationsExportHistory.v1') } catch {} }}>Clear local history</button></article>

      <article className="operations-quality-card"><div className="operations-card-title"><ShieldCheck size={18}/><h3>Existing draft recovery</h3></div><p>OverHead already saves supported forms as drafts on this device and restores them when that form is reopened. Draft contents are not copied into this overview.</p><small>For recovery, return to the form you were editing. Protected values remain in the local draft store.</small></article>
    </div>
  </section>
}
