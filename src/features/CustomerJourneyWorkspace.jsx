import { useMemo, useState } from 'react'
import { FeaturePanel, useFeatureRecords } from './FeatureWave101Helpers'
import './CustomerJourneyWorkspace.css'

const lanes = [
  { id: 'new', label: 'New request' },
  { id: 'review', label: 'Review details' },
  { id: 'quote', label: 'Quote prepared' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'complete', label: 'Complete' },
]

const today = () => new Date().toISOString().slice(0, 10)

export default function CustomerJourneyWorkspace({ backendState = {}, setOperationNotice = () => {} }) {
  const { records, loading, error, setError, save, remove } = useFeatureRecords('sales')
  const customers = (backendState.customers || []).filter((customer) => !customer.merged_into)
  const [draft, setDraft] = useState({ title: '', customerId: '', service: '', preferredDate: '', amount: '', notes: '' })
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return records.filter((record) => record.kind === 'journey_request' && (!needle || [record.title, record.service, record.customerName, record.customerEmail].some((value) => String(value || '').toLowerCase().includes(needle))))
  }, [records, query])

  const columns = useMemo(() => Object.fromEntries(lanes.map((lane) => [lane.id, filtered.filter((record) => (record.stage || 'new') === lane.id)])), [filtered])

  async function createRequest(event) {
    event.preventDefault()
    if (!draft.title.trim() || !draft.service.trim()) { setError('Add a request title and service before saving.'); return }
    const customer = customers.find((item) => item.id === draft.customerId)
    setSaving(true)
    try {
      await save({
        kind: 'journey_request', title: draft.title.trim(), service: draft.service.trim(),
        customerId: customer?.id || '', customerName: customer?.business_name || customer?.owner_name || '',
        customerEmail: customer?.email || '', preferredDate: draft.preferredDate,
        estimateAmount: draft.amount ? Number(draft.amount) : null, notes: draft.notes.trim(),
        stage: 'new', status: 'Open', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      })
      setDraft({ title: '', customerId: '', service: '', preferredDate: '', amount: '', notes: '' })
      setOperationNotice('Request added to the internal customer journey board.')
    } catch (reason) { setError(reason.message || 'The request could not be saved.') }
    finally { setSaving(false) }
  }

  async function move(record, stage) {
    try {
      await save({ ...record, stage, status: stage === 'complete' ? 'Complete' : 'Open', updatedAt: new Date().toISOString() })
      setOperationNotice(`Request moved to ${lanes.find((lane) => lane.id === stage)?.label || stage}.`)
    } catch (reason) { setError(reason.message || 'The request could not be updated.') }
  }

  async function deleteRequest(record) {
    if (!window.confirm(`Remove “${record.title}” from the customer journey board?`)) return
    try { await remove(record.id); setOperationNotice('Request removed from the internal board.') }
    catch (reason) { setError(reason.message || 'The request could not be removed.') }
  }

  return <section className="customer-journey">
    <FeaturePanel eyebrow="Customer journey" title="Move each request to its next clear action" description="A compact internal queue from first request through quote, scheduling, and completion. Use it to keep ownership and next steps visible.">
      <div className="journey-callout" role="note"><strong>Internal workflow tracking</strong><span>Saving here does not send a customer message, publish a booking page, share a quote, collect payment, or record an e-signature.</span></div>
      <form className="journey-create" onSubmit={createRequest}>
        <label>Request title<input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Replace kitchen faucet" maxLength={100} required /></label>
        <label>Service or job type<input value={draft.service} onChange={(event) => setDraft((current) => ({ ...current, service: event.target.value }))} placeholder="Plumbing" maxLength={80} required /></label>
        <label>Customer<select value={draft.customerId} onChange={(event) => setDraft((current) => ({ ...current, customerId: event.target.value }))}><option value="">Unassigned customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.business_name || customer.owner_name || customer.email}</option>)}</select></label>
        <label>Preferred date<input type="date" min={today()} value={draft.preferredDate} onChange={(event) => setDraft((current) => ({ ...current, preferredDate: event.target.value }))} /></label>
        <label>Estimate amount (optional)<input type="number" min="0" step="0.01" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" /></label>
        <label className="journey-wide">Internal notes<textarea rows="2" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} maxLength={800} placeholder="Access details or next step" /></label>
        <button className="primary-action" type="submit" disabled={saving}>{saving ? 'Adding request…' : 'Add to journey board'}</button>
      </form>
      <div className="journey-toolbar"><label className="journey-search">Search requests<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Customer, service, or title" /></label><span>{filtered.length} active request{filtered.length === 1 ? '' : 's'}</span></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <p className="queue-empty">Loading saved requests…</p> : <div className="journey-board">{lanes.map((lane, index) => <section className="journey-lane" key={lane.id} aria-label={`${lane.label}, ${columns[lane.id].length} requests`}>
        <header><span>{lane.label}</span><b>{columns[lane.id].length}</b></header>
        {columns[lane.id].map((record) => <article className="journey-card" key={record.id}>
          <div className="journey-card-top"><strong>{record.title}</strong><button type="button" className="journey-remove" aria-label={`Remove ${record.title}`} onClick={() => deleteRequest(record)}>×</button></div>
          <span className="journey-service">{record.service}</span>
          {record.customerName && <span>{record.customerName}</span>}
          {record.customerEmail && <a href={`mailto:${encodeURIComponent(record.customerEmail)}`}>{record.customerEmail}</a>}
          {record.preferredDate && <span>Preferred {record.preferredDate}</span>}
          {Number.isFinite(Number(record.estimateAmount)) && record.estimateAmount !== null && <span>Estimate reference ${Number(record.estimateAmount).toFixed(2)}</span>}
          {record.notes && <p>{record.notes}</p>}
          <label className="journey-stage">Next stage<select value={record.stage || 'new'} onChange={(event) => move(record, event.target.value)}>{lanes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        </article>)}
        {!columns[lane.id].length && <p className="journey-empty">{index === 0 ? 'New requests will appear here.' : 'No requests in this stage.'}</p>}
      </section>)}</div>}
    </FeaturePanel>
  </section>
}
