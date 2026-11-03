import { useMemo, useState } from 'react'
import { FeaturePanel, useFeatureRecords } from './FeatureWave101Helpers'
import './TimeApprovalPayrollWorkspace.css'

const monthNow = () => new Date().toISOString().slice(0, 7)
const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
const hours = (value) => Math.round((Number(value) || 0) * 100) / 100

function allocateOvertime(entries) {
  const weekly = new Map()
  for (const entry of entries) {
    const date = new Date(`${entry.date}T12:00:00`)
    if (!Number.isFinite(date.getTime())) continue
    const monday = new Date(date)
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7))
    const key = `${String(entry.person || '').trim().toLowerCase()}|${monday.toISOString().slice(0, 10)}`
    weekly.set(key, (weekly.get(key) || 0) + Math.max(0, Number(entry.hours) || 0))
  }
  const consumed = new Map()
  return entries.map((entry) => {
    const date = new Date(`${entry.date}T12:00:00`)
    const monday = new Date(date)
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7))
    const key = `${String(entry.person || '').trim().toLowerCase()}|${monday.toISOString().slice(0, 10)}`
    const before = consumed.get(key) || 0
    const duration = Math.max(0, Number(entry.hours) || 0)
    consumed.set(key, before + duration)
    const regular = Math.max(0, Math.min(duration, 40 - before))
    return { ...entry, regularHours: hours(regular), overtimeHours: hours(duration - regular), weekHours: hours(weekly.get(key) || 0) }
  })
}

export default function TimeApprovalPayrollWorkspace({ setOperationNotice = () => {} }) {
  const { records, loading, error, setError, save } = useFeatureRecords('scheduling')
  const [month, setMonth] = useState(monthNow())
  const [personFilter, setPersonFilter] = useState('')
  const [busyId, setBusyId] = useState('')

  const entries = useMemo(() => records.filter((record) => record.kind === 'time_entry' && String(record.date || '').startsWith(month)), [records, month])
  const shifts = useMemo(() => records.filter((record) => record.kind === 'shift' && String(record.startAt || record.date || '').startsWith(month)), [records, month])
  const visibleEntries = useMemo(() => entries.filter((entry) => !personFilter || String(entry.person || '').toLowerCase().includes(personFilter.toLowerCase())), [entries, personFilter])
  const approvedAll = useMemo(() => records.filter((record) => record.kind === 'time_entry' && String(record.status || '').toLowerCase() === 'approved').sort((a, b) => `${a.person}|${a.date}`.localeCompare(`${b.person}|${b.date}`)), [records])
  const approved = useMemo(() => visibleEntries.filter((entry) => String(entry.status || '').toLowerCase() === 'approved'), [visibleEntries])
  const payrollRows = useMemo(() => allocateOvertime(approvedAll).filter((entry) => String(entry.date || '').startsWith(month) && (!personFilter || String(entry.person || '').toLowerCase().includes(personFilter.toLowerCase()))), [approvedAll, month, personFilter])
  const totalHours = hours(approved.reduce((sum, entry) => sum + Number(entry.hours || 0), 0))

  async function setApproval(entry, status) {
    setBusyId(entry.id)
    try {
      await save({ ...entry, status, approvalStatus: status, approvedAt: status === 'Approved' ? new Date().toISOString() : '', updatedAt: new Date().toISOString() })
      setOperationNotice(`Time entry ${status.toLowerCase()}.`)
    } catch (reason) { setError(reason.message || 'Approval could not be saved.') }
    finally { setBusyId('') }
  }

  function exportPayroll() {
    if (!payrollRows.length) { setError('Approve at least one time entry before exporting payroll preparation data.'); return }
    const rows = [
      ['Export type', 'Payroll preparation only - not submitted to payroll'],
      ['Pay period', month],
      ['Overtime estimate', 'Basic 40-hour workweek threshold; verify applicable rules and pay periods before use'],
      [],
      ['Employee', 'Work date', 'Project', 'Description', 'Approved hours', 'Regular hours (estimate)', 'Overtime hours (estimate)', 'Status', 'Notes'],
      ...payrollRows.map((entry) => [entry.person, entry.date, entry.project || '', entry.title || '', hours(entry.hours), entry.regularHours, entry.overtimeHours, 'Approved', entry.notes || '']),
    ]
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `overhead-payroll-preparation-${month}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setOperationNotice(`Payroll preparation CSV saved with ${payrollRows.length} approved time entries.`)
  }

  return <section className="payroll-workspace">
    <FeaturePanel eyebrow="People operations" title="Review time before payroll preparation" description="Approve submitted hours, compare the approved total with scheduled shifts, and export a reviewable CSV for your payroll process.">
      <div className="payroll-warning" role="note"><strong>Preparation export only</strong><span>OverHead does not calculate wages, withholdings, benefits, or employer taxes and does not submit payroll. Review overtime and local labor rules with your payroll provider.</span></div>
      <div className="payroll-toolbar"><label>Pay period month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><label>Filter team member<input type="search" value={personFilter} onChange={(event) => setPersonFilter(event.target.value)} placeholder="Name or email" /></label><div className="payroll-summary"><span><b>{visibleEntries.length}</b> entries</span><span><b>{approved.length}</b> approved</span><span><b>{totalHours.toFixed(2)}</b> approved hours</span></div><button className="primary-action" type="button" onClick={exportPayroll} disabled={!approved.length}>Export payroll prep CSV</button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <p className="queue-empty">Loading time and shift records…</p> : <>
        <div className="payroll-section-head"><div><h3>Time entries for review</h3><p>Only approved entries are included in the CSV. Approve or reject a submitted record below.</p></div></div>
        {visibleEntries.length ? <div className="payroll-table-wrap"><table className="payroll-table"><thead><tr><th>Employee</th><th>Date</th><th>Work</th><th>Hours</th><th>Status</th><th>Review</th></tr></thead><tbody>{visibleEntries.map((entry) => <tr key={entry.id}><td data-label="Employee">{entry.person || 'Unassigned'}</td><td data-label="Date">{entry.date || '—'}</td><td data-label="Work">{entry.title || 'Time entry'}{entry.project && <small>{entry.project}</small>}</td><td data-label="Hours">{hours(entry.hours).toFixed(2)}</td><td data-label="Status"><span className={`payroll-status ${String(entry.status || 'Submitted').toLowerCase()}`}>{entry.status || 'Submitted'}</span></td><td data-label="Review"><div className="payroll-actions"><button type="button" className="ghost-button" disabled={busyId === entry.id || entry.status === 'Approved'} onClick={() => setApproval(entry, 'Approved')}>{busyId === entry.id ? 'Saving…' : 'Approve'}</button><button type="button" className="payroll-reject" disabled={busyId === entry.id || entry.status === 'Rejected'} onClick={() => setApproval(entry, 'Rejected')}>Reject</button></div></td></tr>)}</tbody></table></div> : <p className="queue-empty">No time entries match this month and filter.</p>}
        <div className="payroll-section-head payroll-shifts-head"><div><h3>Scheduled shifts (context)</h3><p>Shifts are shown for comparison; they are not treated as worked or approved hours and are never added to the payroll CSV.</p></div><span>{shifts.length} shift{shifts.length === 1 ? '' : 's'}</span></div>
        {shifts.length ? <div className="payroll-shifts">{shifts.map((shift) => <article key={shift.id}><strong>{shift.person || 'Unassigned'}</strong><span>{shift.title || 'Shift'}</span><span>{shift.startAt || shift.date || 'Date unavailable'}{shift.endAt ? ` – ${shift.endAt}` : ''}</span><small>{shift.status || 'Scheduled'}</small></article>)}</div> : <p className="queue-empty">No shifts recorded for this month.</p>}
        <div className="payroll-gaps"><strong>Payroll connection gaps</strong><ul><li>No pay rates, wage calculations, deductions, tax withholding, or benefits are included.</li><li>The 40-hour weekly split in the CSV is a basic estimate, not a jurisdiction-aware overtime determination.</li><li>No QuickBooks, Xero, ADP, Gusto, or other payroll submission is configured; export is a CSV for review and transfer by an authorized person.</li></ul></div>
      </>}
    </FeaturePanel>
  </section>
}
