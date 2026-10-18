import { useEffect, useMemo, useState } from 'react'
import { buildReportMetrics, filterReportRows } from './reportStudio'

const TYPES = [
  ['invoices', 'Invoices'], ['quotes', 'Quotes'], ['appointments', 'Appointments'], ['tasks', 'Tasks'],
  ['customers', 'Customers'], ['expenses', 'Expenses'],
]
const money = (value) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0))
const control = { display: 'grid', gap: 6, color: 'var(--muted, #69717c)', fontSize: 12 }
const input = { minHeight: 38, padding: '8px 10px', border: '1px solid var(--line, #d7dce2)', borderRadius: 8, background: 'var(--surface, #fff)', color: 'var(--text, #17202a)' }
const button = { minHeight: 38, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line, #d7dce2)', background: 'var(--surface, #fff)', color: 'var(--text, #17202a)', cursor: 'pointer' }

export function ReportStudio({ backendState = {}, sessionRole = 'Owner', sessionEmail = '', setOperationNotice = () => {} }) {
  const [reportType, setReportType] = useState('invoices')
  const [period, setPeriod] = useState('30')
  const [status, setStatus] = useState('All')
  const [query, setQuery] = useState('')
  const [title, setTitle] = useState('')
  const [annotation, setAnnotation] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [metricName, setMetricName] = useState('')
  const [metricKind, setMetricKind] = useState('record_count')
  const [saved, setSaved] = useState([])
  const [notes, setNotes] = useState([])
  const [customMetrics, setCustomMetrics] = useState([])
  const [accessEvents, setAccessEvents] = useState([])
  const [schedules, setSchedules] = useState([])
  const [projects, setProjects] = useState([])
  const [salesRecords, setSalesRecords] = useState([])
  const [forecastSnapshots, setForecastSnapshots] = useState([])
  const [forecastMonth, setForecastMonth] = useState(new Date().toISOString().slice(0, 7))
  const [error, setError] = useState('')
  const metrics = useMemo(() => buildReportMetrics(backendState, period), [backendState, period])
  const records = useMemo(() => backendState[reportType] || [], [backendState, reportType])
  const rows = useMemo(() => filterReportRows(records, { period, status, query }), [records, period, status, query])
  const availableStatuses = [...new Set(records.map((record) => String(record.status || 'Unspecified')))]
  const total = rows.reduce((sum, record) => sum + (Number(record.amount) || 0), 0)
  const metricValue = (metric) => {
    const source = filterReportRows(backendState[metric.source] || [], { period })
    if (metric.measure === 'amount_sum') return money(source.reduce((sum, record) => sum + Number(record.amount || 0), 0))
    if (metric.measure === 'completion_rate') { const complete = source.filter((record) => record.status === 'Complete').length; return `${source.length ? Math.round(complete / source.length * 100) : 0}%` }
    return String(source.length)
  }
  const sharedRoles = ['Owner', 'Bookkeeper']

  async function refresh() {
    try {
      const [items, projectRows, salesRows] = await Promise.all([window.overheadBackend.listFeatureRecords('reporting'), window.overheadBackend.listFeatureRecords('projects'), window.overheadBackend.listFeatureRecords('sales')])
      setSaved(items.filter((item) => item.kind === 'saved_filter'))
      setNotes(items.filter((item) => item.kind === 'annotation'))
      setCustomMetrics(items.filter((item) => item.kind === 'metric'))
      setAccessEvents(items.filter((item) => item.kind === 'access').slice(-20).reverse())
      setSchedules(items.filter((item) => item.kind === 'schedule'))
      setProjects(projectRows.filter((item) => !item.kind))
      setForecastSnapshots(items.filter((item) => item.kind === 'forecast_snapshot').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))))
      setSalesRecords(salesRows.filter((item) => !item.kind || item.kind === 'opportunity'))
      setError('')
    } catch (reason) { setError(String(reason?.message || 'Saved reporting settings are unavailable.')) }
  }
  useEffect(() => { refresh(); const timer = window.setInterval(refresh, 30000); return () => window.clearInterval(timer) }, [])

  async function saveRecord(record) {
    try { const savedRecord = await window.overheadBackend.upsertFeatureRecord({ collection: 'reporting', record }); await refresh(); return savedRecord }
    catch (reason) { setError(String(reason?.message || 'The reporting setting could not be saved.')); return null }
  }
  function downloadCsv() {
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const content = [['Record ID', 'Title', 'Status', 'Date', 'Amount'], ...rows.map((record) => [record.id, record.title || record.business_name || record.label, record.status, record.created_at || record.updated_at || record.due_date || record.expense_date, record.amount])].map((row) => row.map(quote).join(',')).join('\r\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })); link.download = `overhead-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href)
    saveRecord({ id: crypto.randomUUID(), kind: 'access', report_type: reportType, action: 'spreadsheet_export', actor_role: sessionRole, accessed_at: new Date().toISOString() })
  }
  function printPdf() { window.print(); saveRecord({ id: crypto.randomUUID(), kind: 'access', report_type: reportType, action: 'pdf_export', actor_role: sessionRole, accessed_at: new Date().toISOString() }) }
  async function saveFilter() {
    if (!title.trim()) { setError('Give this saved report a name.'); return }
    await saveRecord({ id: crypto.randomUUID(), kind: 'saved_filter', title: title.trim(), filters: { reportType, period, status, query }, shared_roles: sharedRoles, created_by_role: sessionRole })
    setTitle(''); setOperationNotice('Report filter saved for Owner and Bookkeeper access.')
  }
  async function addAnnotation() {
    if (!annotation.trim()) { setError('Add a note before saving the annotation.'); return }
    await saveRecord({ id: crypto.randomUUID(), kind: 'annotation', report_type: reportType, note: annotation.trim().slice(0, 1000), created_by_role: sessionRole, created_at: new Date().toISOString() })
    setAnnotation(''); setOperationNotice('Report note saved locally.')
  }
  async function scheduleDelivery() {
    if (!scheduleAt || Date.parse(scheduleAt) <= Date.now()) { setError('Choose a future local delivery time.'); return }
    if (!['Owner', 'Bookkeeper'].includes(sessionRole) || !sessionEmail) { setError('Sign in as an Owner or Bookkeeper to schedule a local report export.'); return }
    await saveRecord({ id: crypto.randomUUID(), kind: 'schedule', report_type: reportType, filters: { period, status, query }, run_at: new Date(scheduleAt).toISOString(), delivery: 'local_csv', status: 'Scheduled', created_by_role: sessionRole, created_by_email: sessionEmail })
    setScheduleAt(''); setOperationNotice('Local CSV delivery scheduled. OverHead will create the file while this account is signed in and the desktop app is open.')
  }
  async function saveForecastSnapshot() {
    const amount = salesRecords.filter((deal) => !['won', 'lost'].includes(String(deal.stage || deal.status).toLowerCase()) && String(deal.close_date || '').slice(0, 7) === forecastMonth).reduce((sum, deal) => { const probability = Number(deal.probability || 0); return sum + Number(deal.amount || 0) * Math.min(100, Math.max(0, Number.isFinite(probability) ? probability : 0)) / 100 }, 0)
    const saved = await saveRecord({ id: crypto.randomUUID(), kind: 'forecast_snapshot', title: `Sales forecast ${forecastMonth}`, month: forecastMonth, weighted_amount: amount, created_at: new Date().toISOString(), created_by_role: sessionRole })
    if (saved) setOperationNotice(`Weighted sales forecast snapshot saved for ${forecastMonth}.`)
  }
  async function addMetric() {
    if (!metricName.trim()) { setError('Name the custom metric.'); return }
    await saveRecord({ id: crypto.randomUUID(), kind: 'metric', title: metricName.trim(), measure: metricKind, source: reportType, created_by_role: sessionRole })
    setMetricName(''); setOperationNotice('Custom metric definition saved.')
  }
  async function applySavedFilter(item) {
    setReportType(item.filters.reportType); setPeriod(item.filters.period); setStatus(item.filters.status); setQuery(item.filters.query)
    await saveRecord({ id: crypto.randomUUID(), kind: 'access', report_type: item.filters.reportType, saved_filter_id: item.id, action: 'opened', actor_role: sessionRole, accessed_at: new Date().toISOString() })
  }
  async function togglePinned(item) {
    await saveRecord({ ...item, pinned: !item.pinned, pinned_at: item.pinned ? '' : new Date().toISOString() })
  }
  const bars = (entries, color) => {
    const max = Math.max(1, ...entries.map(([, value]) => Number(value)))
    return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: 10, alignItems: 'end', minHeight: 130 }}>{entries.map(([label, value]) => <div key={label} title={`${label}: ${money(value)}`} style={{ display: 'grid', gap: 6, textAlign: 'center', fontSize: 11 }}><strong>{money(value)}</strong><div style={{ height: Math.max(6, Number(value) / max * 72), borderRadius: '5px 5px 0 0', background: color }} /><span>{label}</span></div>)}</div>
  }

  return <section className="panel page-panel" aria-labelledby="report-studio-title">
    <div className="section-head"><div><p className="eyebrow">Local workspace analytics</p><h2 id="report-studio-title">Report studio</h2></div><div style={{ display: 'flex', gap: 8 }}><button style={button} type="button" onClick={printPdf}>Print / Save PDF</button><button style={button} type="button" onClick={downloadCsv}>Export spreadsheet</button></div></div>
    <p>Build a filtered report from your encrypted local records. Only saved filters, notes, and definitions are shared within authorized workspace roles.</p>
    <div className="report-controls">
      <label style={control}>Report type<select style={input} value={reportType} onChange={(event) => setReportType(event.target.value)}>{TYPES.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
      <label style={control}>Date range<select style={input} value={period} onChange={(event) => setPeriod(event.target.value)}><option value="30">30 days</option><option value="90">90 days</option><option value="365">12 months</option><option value="all">All records</option></select></label>
      <label style={control}>Status<select style={input} value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option>{availableStatuses.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label style={control}>Search records<input style={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search fields in this report" /></label>
    </div>
    <div className="dashboard-grid report-metrics"><article className="status-card"><span>Matching records</span><strong>{rows.length}</strong><small>{records.length} total in local source</small></article><article className="status-card"><span>Recorded amount</span><strong>{money(total)}</strong><small>Current report filter</small></article><article className="status-card"><span>Completion rate</span><strong>{metrics.taskCompletion.rate}%</strong><small>{metrics.taskCompletion.completed} of {metrics.taskCompletion.total} tasks</small></article></div>
    <div className="dashboard-grid" style={{ marginTop: 16 }}>
      <article className="panel"><h3>Revenue trend</h3>{bars(metrics.revenueByMonth, 'var(--accent, #297f70)')}</article>
      <article className="panel"><h3>Expense trend</h3>{bars(metrics.expenseByMonth, 'var(--warning, #c88731)')}</article>
      <article className="panel"><h3>Quote pipeline conversion</h3><p>{metrics.quoteConversion.accepted} accepted / {metrics.quoteConversion.sent} sent ({metrics.quoteConversion.sent ? Math.round(metrics.quoteConversion.accepted / metrics.quoteConversion.sent * 100) : 0}%)</p><p>{metrics.quoteConversion.declined} declined</p></article>
      <article className="panel"><h3>Repeat customer cohorts</h3><p>{metrics.customerRetention.repeatCustomers} repeat customers from {metrics.customerRetention.customers} current customer records.</p>{metrics.customerRetention.cohorts.map(([month, count]) => <small key={month} style={{ display: 'block' }}>{month}: {count} new customers</small>)}</article>
      <article className="panel"><h3>Receivables aging</h3>{Object.entries(metrics.agingReceivables).map(([label, value]) => <p key={label}>{label}: {money(value)}</p>)}</article>
    </div>
    <div className="task-list">{rows.slice(0, 30).map((record) => <div className="task-row" key={record.id}><strong>{record.title || record.business_name || record.label || record.id}</strong><span>{record.status || '—'}</span><span>{record.amount == null ? '' : money(record.amount)}</span><span>{record.created_at || record.due_date || record.expense_date || ''}</span></div>)}</div>
    {projects.length > 0 && <section className="backend-health"><h3>Project budget variance</h3><p>Local project estimates use each saved project budget and actual cost; this is a current snapshot, not an accounting ledger.</p><div className="task-list">{projects.map((project) => { const budget = Number(project.budget || 0); const actual = Number(project.actualCost || 0); return <div className="task-row" key={project.id}><strong>{project.title || project.id}</strong><span>Budget {money(budget)}</span><span>Actual cost {money(actual)}</span><span>{actual > budget ? 'Over budget' : 'Under budget'} by {money(Math.abs(budget - actual))}</span></div> })}</div></section>}
    <section className="backend-health"><h3>Forecast accuracy snapshots</h3><p>Save a monthly weighted open-sales forecast, then compare it with invoices created in that month. Invoice timing is used as a local actual-revenue proxy.</p><label style={control}>Forecast month<input style={input} type="month" value={forecastMonth} onChange={(event) => setForecastMonth(event.target.value)}/></label><button style={button} type="button" onClick={saveForecastSnapshot}>Save forecast snapshot</button>{forecastSnapshots.filter((snapshot) => snapshot.month === forecastMonth).map((snapshot) => { const actual = (backendState.invoices || []).filter((invoice) => String(invoice.created_at || '').slice(0, 7) === snapshot.month).reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0); const variance = actual - Number(snapshot.weighted_amount || 0); return <p key={snapshot.id}>{snapshot.month} forecast {money(snapshot.weighted_amount)} · invoices {money(actual)} · variance {money(variance)} · captured {new Date(snapshot.created_at).toLocaleString()}</p> })}</section>
    <div className="report-controls"><label style={control}>Save current report name<input style={input} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Monthly invoice review" /></label><button style={button} type="button" onClick={saveFilter}>Save shared filter</button><label style={control}>Schedule local CSV delivery<input style={input} type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} /></label><button style={button} type="button" onClick={scheduleDelivery}>Schedule export</button><span className="form-hint">A CSV is saved in this device's private OverHead exports folder while the scheduling account is signed in. No email or cloud delivery is sent.</span></div>
    <div className="report-controls"><label style={control}>Report annotation<input style={input} value={annotation} onChange={(event) => setAnnotation(event.target.value)} placeholder="Context for this period" /></label><button style={button} type="button" onClick={addAnnotation}>Add note</button><label style={control}>Metric name<input style={input} value={metricName} onChange={(event) => setMetricName(event.target.value)} placeholder="Accepted quote rate" /></label><select style={input} value={metricKind} onChange={(event) => setMetricKind(event.target.value)}><option value="record_count">Record count</option><option value="amount_sum">Amount sum</option><option value="completion_rate">Task completion rate</option></select><button style={button} type="button" onClick={addMetric}>Save metric</button></div>
    <section className="task-list"><h3>Pinned reports</h3>{saved.filter((item) => item.shared_roles?.includes(sessionRole) && item.pinned).map((item) => <div className="task-row" key={`pin-${item.id}`}><button style={button} type="button" onClick={() => applySavedFilter(item)}>{item.title} · {item.filters.reportType}</button><span>Pinned report</span><button style={button} type="button" onClick={() => togglePinned(item)}>Unpin</button></div>)}{!saved.some((item) => item.shared_roles?.includes(sessionRole) && item.pinned) && <p className="form-hint">Pin saved report filters below for quick access.</p>}</section>
    <div className="dashboard-grid">{saved.filter((item) => item.shared_roles?.includes(sessionRole)).map((item) => <div className="task-row" key={item.id}><button style={button} type="button" onClick={() => applySavedFilter(item)}>{item.title} · {item.filters.reportType}</button><button style={button} type="button" aria-pressed={Boolean(item.pinned)} onClick={() => togglePinned(item)}>{item.pinned ? 'Unpin report' : 'Pin report'}</button></div>)}</div>
    {customMetrics.map((metric) => <p key={metric.id} className="form-hint">Custom metric: {metric.title} · {metricValue(metric)} ({metric.measure} from {metric.source})</p>)}
    {notes.slice(-5).map((note) => <p key={note.id} className="form-hint">{new Date(note.created_at).toLocaleString()}: {note.note}</p>)}
    <details><summary>Data sources and access history</summary><p>This screen reads encrypted local invoices, quotes, appointments, tasks, customers, and expenses. Current metric sources: {Object.entries(metrics.sourceCounts).map(([name, count]) => `${name} ${count}`).join(' · ')}.</p>{accessEvents.map((event) => <small key={event.id} style={{ display: 'block' }}>{event.action} · {event.report_type} · {event.actor_role} · {event.accessed_at}</small>)}</details>
    {schedules.map((item) => <p key={item.id} className="form-hint">{item.status}: {item.report_type} scheduled for {new Date(item.run_at).toLocaleString()}{item.output_path ? ` · saved at ${item.output_path}` : ''}{item.last_error ? ` · ${item.last_error}` : ''}</p>)}
    {error && <p className="form-error">{error}</p>}
  </section>
}
