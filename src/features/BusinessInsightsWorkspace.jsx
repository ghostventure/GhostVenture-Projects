import { useMemo, useState } from 'react'
import { Activity, AlertCircle, ArrowDownRight, ArrowUpRight, BriefcaseBusiness, Clock3, FileText, Users } from 'lucide-react'
import { useFeatureRecords } from './FeatureWave101Helpers'
import './BusinessInsightsWorkspace.css'

const dayMs = 86400000
const todayKey = () => new Date().toISOString().slice(0, 10)
const parseDate = (value) => {
  const time = Date.parse(value || '')
  return Number.isFinite(time) ? time : 0
}
const money = (value) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value) || 0)
const norm = (value) => String(value || '').trim().toLowerCase()

function MetricCard({ icon: Icon, label, value, detail, tone = 'neutral' }) {
  return <article className={`bi-metric tone-${tone}`}><div className="bi-metric-top"><span>{label}</span><Icon size={17} aria-hidden="true" /></div><strong>{value}</strong><small>{detail}</small></article>
}

export default function BusinessInsightsWorkspace({ backendState = {} }) {
  const { records: salesRecords } = useFeatureRecords('sales')
  const { records: scheduleRecords } = useFeatureRecords('scheduling')
  const [range, setRange] = useState(30)
  const now = Date.now()
  const cutoff = now - range * dayMs
  const opportunities = salesRecords.filter((record) => !record.kind || record.kind === 'opportunity')
  const appointments = backendState.appointments || []
  const invoices = backendState.invoices || []
  const timeEntries = scheduleRecords.filter((record) => record.kind === 'time_entry')

  const metrics = useMemo(() => {
    const closed = opportunities.filter((record) => ['won', 'lost'].includes(norm(record.stage || record.status)))
    const won = closed.filter((record) => norm(record.stage || record.status) === 'won')
    const currentAppointments = appointments.filter((record) => {
      const date = parseDate(record.scheduled_for)
      return date >= cutoff && date <= now + 7 * dayMs
    })
    const completed = appointments.filter((record) => norm(record.status) === 'completed' && parseDate(record.updated_at || record.scheduled_for) >= cutoff)
    const outstanding = invoices.filter((record) => !['paid', 'void', 'canceled', 'cancelled'].includes(norm(record.status)))
    const outstandingAmount = outstanding.reduce((sum, record) => sum + Number(record.amount || 0), 0)
    const approved = timeEntries.filter((record) => record.status === 'Approved' && parseDate(record.date) >= cutoff)
    const hours = approved.reduce((sum, record) => sum + Number(record.hours || 0), 0)
    const billableHours = approved.filter((record) => record.billable === 'Yes').reduce((sum, record) => sum + Number(record.hours || 0), 0)
    return {
      opportunityCount: opportunities.length,
      closedCount: closed.length,
      conversion: closed.length ? Math.round((won.length / closed.length) * 100) : null,
      appointments: currentAppointments.length,
      completed: completed.length,
      outstandingCount: outstanding.length,
      outstandingAmount,
      hours,
      billableHours,
      billableRate: hours ? Math.round((billableHours / hours) * 100) : null,
    }
  }, [opportunities, appointments, invoices, timeEntries, cutoff, now])

  const actions = useMemo(() => {
    const due = appointments.filter((row) => parseDate(row.scheduled_for) > now && parseDate(row.scheduled_for) < now + 2 * dayMs)
    const overdue = invoices.filter((row) => !['paid', 'void', 'canceled', 'cancelled'].includes(norm(row.status)) && row.due_date && row.due_date < todayKey())
    const pendingTime = timeEntries.filter((row) => row.status === 'Submitted')
    const incomplete = []
    if (!opportunities.length) incomplete.push('Add sales opportunities to calculate a conversion rate.')
    if (!appointments.length) incomplete.push('No appointment records are available for workload insights.')
    if (!invoices.length) incomplete.push('No invoice records are available for receivables insights.')
    if (!timeEntries.length) incomplete.push('No time entries are available for staff hours or utilization.')
    return { due, overdue, pendingTime, incomplete }
  }, [appointments, invoices, timeEntries, opportunities, now])

  return <section className="business-insights" aria-labelledby="business-insights-title">
    <header className="bi-header"><div><p className="eyebrow">Operations overview</p><h2 id="business-insights-title">Business insights</h2><p>Actionable snapshots from the records currently available to this workspace.</p></div>
      <label className="bi-range">Window<select value={range} onChange={(event) => setRange(Number(event.target.value))}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
    </header>
    <div className="bi-grid">
      <MetricCard icon={BriefcaseBusiness} label="Lead conversion" value={metrics.conversion === null ? '—' : `${metrics.conversion}%`} detail={metrics.closedCount ? `${metrics.closedCount} closed opportunities · ${metrics.opportunityCount} total` : 'Needs at least one won or lost opportunity'} tone={metrics.conversion !== null && metrics.conversion >= 30 ? 'good' : 'neutral'} />
      <MetricCard icon={Activity} label="Scheduled work" value={metrics.appointments} detail={`${metrics.completed} completed in selected window · includes next 7 days`} />
      <MetricCard icon={FileText} label="Open invoices" value={metrics.outstandingCount} detail={invoices.length ? `${money(metrics.outstandingAmount)} listed as unpaid · not reconciled cash` : 'No invoice data available'} tone={actions.overdue.length ? 'attention' : 'neutral'} />
      <MetricCard icon={Clock3} label="Approved staff hours" value={metrics.hours.toFixed(1)} detail={metrics.billableRate === null ? 'Billable share unavailable until approved hours are recorded' : `${metrics.billableHours.toFixed(1)} billable · ${metrics.billableRate}% of approved hours`} />
    </div>
    <div className="bi-panels">
      <article className="bi-panel"><h3><ArrowUpRight size={17} aria-hidden="true" /> Next actions</h3>
        {actions.due.length > 0 && <p><strong>{actions.due.length} appointments</strong> are scheduled in the next 48 hours. Confirm readiness and ownership.</p>}
        {actions.overdue.length > 0 && <p><strong>{actions.overdue.length} invoices</strong> are past due. Review status and assign follow-up.</p>}
        {actions.pendingTime.length > 0 && <p><strong>{actions.pendingTime.length} time entries</strong> are awaiting approval.</p>}
        {!actions.due.length && !actions.overdue.length && !actions.pendingTime.length && <p>No urgent items detected in the available records.</p>}
      </article>
      <article className="bi-panel"><h3><ArrowDownRight size={17} aria-hidden="true" /> Data coverage</h3>
        {actions.incomplete.length ? <ul>{actions.incomplete.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Core records are present. This view summarizes operations; it does not measure accounting profit, bank balance, or true staff utilization.</p>}
        <p className="bi-disclaimer"><AlertCircle size={15} aria-hidden="true" /> Counts and amounts depend on local records and status labels. Missing records are shown as unavailable, not as zero business activity.</p>
      </article>
    </div>
    <footer className="bi-footer"><Users size={15} aria-hidden="true" /> Staff utilization requires scheduled capacity and complete approved time entries. Financial performance requires reconciled payment, expense, and accounting data that OverHead does not currently provide here.</footer>
  </section>
}
