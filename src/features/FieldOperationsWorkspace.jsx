import { useMemo, useState } from 'react'
import { useFeatureRecords } from './FeatureWave101Helpers'
import './FieldOperationsWorkspace.css'

const stages = ['Queued', 'Ready', 'Dispatched', 'On site', 'Complete']
const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const displayTime = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Time not set' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Dispatcher-oriented view over existing appointments with local dispatch notes. */
export default function FieldOperationsWorkspace({ backendState = {}, setOperationNotice = () => {} }) {
  const { records, loading, error, setError, save } = useFeatureRecords('scheduling')
  const [day, setDay] = useState(dateKey())
  const appointments = backendState.appointments || []
  const plans = records.filter((record) => record.kind === 'dispatch_job')
  const byAppointment = useMemo(() => new Map(plans.map((plan) => [plan.appointmentId, plan])), [plans])
  const queue = useMemo(() => appointments
    .filter((item) => String(item.scheduled_for || '').slice(0, 10) === day)
    .map((item) => ({ ...item, dispatch: byAppointment.get(item.id) || {} }))
    .sort((a, b) => {
      const seqA = Number(a.dispatch.sequence || 9999), seqB = Number(b.dispatch.sequence || 9999)
      return seqA - seqB || String(a.scheduled_for || '').localeCompare(String(b.scheduled_for || ''))
    }), [appointments, byAppointment, day])

  async function update(item, changes) {
    const current = item.dispatch || {}
    try {
      await save({ ...current, kind: 'dispatch_job', appointmentId: item.id, title: item.title || 'Appointment', ...changes })
      setError('')
      setOperationNotice('Field dispatch notes saved on this device.')
    } catch (reason) { setError(reason?.message || 'Dispatch update could not be saved.') }
  }

  function move(item, delta) {
    const index = queue.findIndex((row) => row.id === item.id)
    const other = queue[index + delta]
    if (!other) return
    void update(item, { sequence: index + delta + 1 })
    void update(other, { sequence: index + 1 })
  }

  return <section className="field-ops-workspace">
    <header className="field-ops-header">
      <div><p className="eyebrow">Field &amp; Assist · dispatch desk</p><h2>Today’s field queue</h2><p>Order appointments, assign a team member, and track readiness from one view. Dispatch assignments and notes are stored locally.</p></div>
      <label className="field-ops-date">Work date<input type="date" value={day} onChange={(event) => setDay(event.target.value)} /></label>
    </header>
    <div className="field-ops-summary" aria-live="polite">
      <span><strong>{queue.length}</strong> visits</span><span><strong>{queue.filter((item) => (item.dispatch.status || 'Queued') === 'Complete').length}</strong> complete</span><span><strong>{queue.filter((item) => !item.dispatch.assignee).length}</strong> unassigned</span>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <p className="queue-empty">Loading the local dispatch queue…</p> : queue.length ? <div className="field-ops-list">{queue.map((item, index) => {
      const dispatch = item.dispatch
      const status = dispatch.status || 'Queued'
      return <article className="field-ops-card" key={item.id}>
        <div className="field-ops-card-top"><div className="field-ops-time"><strong>{displayTime(item.scheduled_for)}</strong><span>Stop {index + 1}</span></div><div className="field-ops-title"><h3>{item.title || 'Appointment'}</h3><p>{item.customer_name || item.customer_id || 'Customer not linked'}</p></div><span className={`field-ops-status status-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span></div>
        <p className="field-ops-notes">{item.notes || 'No appointment notes.'}</p>
        <div className="field-ops-controls">
          <label>Assigned to<input value={dispatch.assignee || ''} onChange={(event) => update(item, { assignee: event.target.value })} placeholder="Team member" /></label>
          <label>Work status<select value={status} onChange={(event) => update(item, { status: event.target.value })}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
          <label>Site notes<input value={dispatch.siteNotes || ''} onChange={(event) => update(item, { siteNotes: event.target.value })} placeholder="Access, materials, arrival notes" /></label>
          <div className="field-ops-order"><span>Queue order</span><button type="button" className="ghost-button" aria-label={`Move ${item.title || 'appointment'} earlier`} disabled={index === 0} onClick={() => move(item, -1)}>↑</button><button type="button" className="ghost-button" aria-label={`Move ${item.title || 'appointment'} later`} disabled={index === queue.length - 1} onClick={() => move(item, 1)}>↓</button></div>
        </div>
      </article>
    })}</div> : <div className="field-ops-empty"><strong>No appointments scheduled for this date.</strong><span>Appointments created in OverHead will appear here.</span></div>}
    <p className="field-ops-boundary">This queue does not send customer updates or provide live GPS, route optimization, or shared cloud dispatch. Those require connected services.</p>
  </section>
}
