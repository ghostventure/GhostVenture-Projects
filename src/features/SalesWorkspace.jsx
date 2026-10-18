import { useEffect, useMemo, useRef, useState } from 'react'
import { FeatureForm, FeaturePanel, FeatureRecordList, FeatureRecordManager, FeatureTabs, currentDate, useFeatureRecords } from './FeatureWave101Helpers'

const emptyRows = []
const stages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']
const scoreFields = [
  { name: 'fitScore', label: 'Customer fit (0–5)', type: 'number', min: 0, max: 5, step: 1 },
  { name: 'needScore', label: 'Need clarity (0–5)', type: 'number', min: 0, max: 5, step: 1 },
  { name: 'budgetScore', label: 'Budget readiness (0–5)', type: 'number', min: 0, max: 5, step: 1 },
  { name: 'timingScore', label: 'Timing (0–5)', type: 'number', min: 0, max: 5, step: 1 },
]
const opportunityFields = [
  { name: 'title', label: 'Opportunity name', required: true },
  { name: 'customer', label: 'Customer / lead name' },
  { name: 'stage', label: 'Stage', options: stages, defaultValue: 'Lead' },
  { name: 'amount', label: 'Deal amount (USD)', type: 'number', min: 0, step: 0.01, defaultValue: '0' },
  { name: 'probability', label: 'Win probability (%)', type: 'number', min: 0, max: 100, step: 1, defaultValue: '25' },
  { name: 'close_date', label: 'Expected close date', type: 'date' },
  { name: 'owner', label: 'Deal owner' },
  { name: 'territory', label: 'Sales territory' },
  { name: 'source', label: 'Lead source' },
  ...scoreFields,
  { name: 'lost_reason', label: 'Lost reason' },
  { name: 'notes', label: 'Deal notes', multiline: true },
]
const tabs = [
  { id: 'overview', label: 'Forecast and results' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'rules', label: 'Territories and leads' },
  { id: 'activities', label: 'Activity and notes' },
  { id: 'playbooks', label: 'Sales playbooks' },
]
const normalize = (value) => String(value || '').trim().toLowerCase()
const money = (value) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value) || 0)
const asNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const isClosed = (deal) => ['won', 'lost'].includes(normalize(deal.stage || deal.status))
const isWon = (deal) => normalize(deal.stage || deal.status) === 'won'
const isLost = (deal) => normalize(deal.stage || deal.status) === 'lost'

export default function SalesWorkspace({ backendState = {}, refreshBackend = () => {}, setOperationNotice = () => {} }) {
  const { records, loading, error, setError, save, remove } = useFeatureRecords('sales')
  const { records: customerProfiles } = useFeatureRecords('customers')
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(null)
  const [notice, setNotice] = useState('')
  const [forecastMonth, setForecastMonth] = useState(currentDate().slice(0, 7))
  const [rateDraft, setRateDraft] = useState('10')
  const [renewalCustomerId, setRenewalCustomerId] = useState('')
  const [playbookOpportunityId, setPlaybookOpportunityId] = useState('')
  const [conversionDeal, setConversionDeal] = useState(null)
  const conversionDialogRef = useRef(null)
  const conversionOpenerRef = useRef(null)
  const conversionTitleId = 'sales-conversion-dialog-title'

  const opportunities = useMemo(() => records.filter((record) => !record.kind || record.kind === 'opportunity'), [records])
  const settings = records.find((record) => record.kind === 'sales_settings')
  const commissionRate = asNumber(settings?.commissionRate, 10)
  const settingId = settings?.id
  const savedCommissionRate = settings?.commissionRate
  useEffect(() => {
    if (settingId) setRateDraft(String(savedCommissionRate ?? 10))
  }, [settingId, savedCommissionRate])
  const territoryRules = useMemo(() => records.filter((record) => record.kind === 'territory_rule'), [records])
  const assignmentRules = useMemo(() => records.filter((record) => record.kind === 'lead_assignment_rule'), [records])
  const playbooks = useMemo(() => records.filter((record) => record.kind === 'sales_playbook'), [records])
  const renewalProfiles = useMemo(() => customerProfiles.filter((profile) => profile.kind === 'customer_profile' ? Boolean(profile.renewal?.date) : typeof profile.renewal === 'string' && Boolean(profile.renewal)), [customerProfiles])
  const activeDeals = opportunities.filter((deal) => !isClosed(deal))
  const weightedPipeline = activeDeals.reduce((sum, deal) => sum + asNumber(deal.amount) * Math.min(100, Math.max(0, asNumber(deal.probability))) / 100, 0)
  const wonDeals = opportunities.filter(isWon)
  const lostDeals = opportunities.filter(isLost)
  const closedDeals = wonDeals.length + lostDeals.length
  const winRate = closedDeals ? (wonDeals.length / closedDeals) * 100 : 0
  const forecast = useMemo(() => {
    const months = new Map()
    activeDeals.forEach((deal) => {
      const key = String(deal.close_date || '').slice(0, 7) || 'Unscheduled'
      const row = months.get(key) || { month: key, dealCount: 0, total: 0, weighted: 0 }
      const amount = asNumber(deal.amount)
      const probability = Math.min(100, Math.max(0, asNumber(deal.probability)))
      row.dealCount += 1
      row.total += amount
      row.weighted += amount * probability / 100
      months.set(key, row)
    })
    return [...months.values()].sort((a, b) => a.month.localeCompare(b.month))
  }, [activeDeals])
  const forecastMonthRow = forecast.find((row) => row.month === forecastMonth) || { month: forecastMonth, dealCount: 0, total: 0, weighted: 0 }
  const lostReasonRows = useMemo(() => {
    const reasons = new Map()
    lostDeals.forEach((deal) => {
      const reason = String(deal.lost_reason || '').trim() || 'Unspecified'
      reasons.set(reason, (reasons.get(reason) || 0) + 1)
    })
    return [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
  }, [lostDeals])
  const activityFields = useMemo(() => [
    { name: 'opportunityId', label: 'Opportunity', required: true, options: [{ value: '', label: 'Choose an opportunity' }, ...opportunities.map((deal) => ({ value: deal.id, label: deal.title }))] },
    { name: 'activityType', label: 'Activity type', options: ['Call', 'Meeting', 'Demo', 'Proposal', 'Internal note', 'Follow-up'] },
    { name: 'date', label: 'Date', type: 'date', defaultValue: currentDate() },
    { name: 'owner', label: 'Owner' },
    { name: 'notes', label: 'Summary and next action', multiline: true, required: true },
  ], [opportunities])
  const conversionFields = useMemo(() => [
    { name: 'businessName', label: 'Customer business name', required: true },
    { name: 'ownerName', label: 'Primary contact' },
    { name: 'email', label: 'Contact email', type: 'email', required: true },
    { name: 'industry', label: 'Industry', defaultValue: 'General services' },
    { name: 'serviceArea', label: 'Service area', defaultValue: 'Local' },
    { name: 'preferredContact', label: 'Preferred contact', options: ['Email', 'Phone', 'Text'] },
  ], [])

  useEffect(() => {
    if (!conversionDeal) return undefined
    const dialog = conversionDialogRef.current
    const focusable = () => [...(dialog?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])]
    focusable()[0]?.focus()
    function handleKeyDown(event) {
      if (event.key === 'Escape') { event.preventDefault(); closeConversionDialog(); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) { event.preventDefault(); dialog?.focus(); return }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [conversionDeal])

  function closeConversionDialog() {
    setConversionDeal(null)
    requestAnimationFrame(() => conversionOpenerRef.current?.focus())
  }

  async function saveRecord(record) {
    await save(record)
    setNotice(`${record.title || record.name || 'Sales record'} saved in the encrypted workspace.`)
    setOperationNotice(`${record.title || record.name || 'Sales record'} saved locally.`)
  }

  async function deleteRecord(id) {
    await remove(id)
    setNotice('Sales record deleted.')
  }

  async function saveOpportunity(event) {
    event.preventDefault()
    const draft = editing || {}
    const title = String(draft.title || '').trim()
    const amount = Number(draft.amount || 0)
    const probability = Number(draft.probability || 0)
    if (!title) { setError('Enter an opportunity name.'); return }
    if (!Number.isFinite(amount) || amount < 0) { setError('Deal amount must be zero or greater.'); return }
    if (!Number.isFinite(probability) || probability < 0 || probability > 100) { setError('Win probability must be between 0 and 100.'); return }
    try {
      await saveRecord({ ...draft, kind: 'opportunity', title, stage: draft.stage || draft.status || 'Lead', amount, probability })
      setEditing(null)
      setError('')
    } catch (reason) { setError(reason?.message || 'Opportunity could not be saved.') }
  }

  function scoreLead(deal) {
    const rawValues = [deal.fitScore, deal.needScore, deal.budgetScore, deal.timingScore]
    const values = rawValues.map((value) => Number(value))
    if (rawValues.some((value) => value === undefined || value === null || String(value).trim() === '') || values.some((value) => !Number.isFinite(value) || value < 0 || value > 5)) {
      setError(`Add all four 0–5 qualification ratings for ${deal.title} before scoring it.`)
      return
    }
    const [fit, need, budget, timing] = values
    const score = Math.round(((fit * 0.30 + need * 0.30 + budget * 0.20 + timing * 0.20) / 5) * 100)
    saveRecord({ ...deal, kind: 'opportunity', lead_score: score, scoreBreakdown: { fit, need, budget, timing }, scoreUpdatedAt: new Date().toISOString() }).catch((reason) => setError(reason.message))
    setError('')
  }

  async function saveCommissionRate() {
    const rate = Number(rateDraft)
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) { setError('Commission rate must be between 0 and 100%.'); return }
    await saveRecord({ ...(settings || {}), id: settings?.id || 'sales-settings', kind: 'sales_settings', title: 'Sales settings', commissionRate: rate })
    setError('')
  }

  async function applyTerritoryRules() {
    const enabled = territoryRules.filter((rule) => rule.status === 'Active' && String(rule.territory || '').trim() && String(rule.owner || '').trim())
    let updated = 0
    for (const deal of activeDeals) {
      if (deal.owner && enabled.find((rule) => normalize(rule.territory) === normalize(deal.territory))) continue
      const rule = enabled.find((item) => normalize(item.territory) === normalize(deal.territory))
      if (!rule) continue
      await saveRecord({ ...deal, kind: 'opportunity', owner: rule.owner })
      updated += 1
    }
    setNotice(`${updated} unassigned open deal${updated === 1 ? '' : 's'} assigned by territory. Existing owners were kept.`)
  }

  async function applyLeadAssignmentRules() {
    const enabled = assignmentRules.filter((rule) => rule.status === 'Active' && String(rule.owner || '').trim())
    let updated = 0
    for (const deal of activeDeals) {
      const rule = enabled.find((item) => {
        const territoryMatches = !String(item.territory || '').trim() || normalize(item.territory) === normalize(deal.territory)
        const sourceMatches = !String(item.source || '').trim() || normalize(item.source) === normalize(deal.source)
        const minimumScore = item.minimumScore === '' || item.minimumScore === undefined ? 0 : asNumber(item.minimumScore, 0)
        const scoreMatches = asNumber(deal.lead_score, -1) >= minimumScore
        return territoryMatches && sourceMatches && scoreMatches
      })
      if (!rule || (deal.owner && rule.overwrite !== 'Yes')) continue
      await saveRecord({ ...deal, kind: 'opportunity', owner: rule.owner })
      updated += 1
    }
    setNotice(`${updated} open deal${updated === 1 ? '' : 's'} assigned by the first matching active lead rule. Existing owners change only when a rule allows it.`)
  }

  async function createRenewal() {
    const profile = renewalProfiles.find((item) => item.id === renewalCustomerId)
    if (!profile) { setError('Choose a saved customer profile first.'); return }
    const coreCustomer = (backendState.customers || emptyRows).find((item) => item.id === profile.customerId)
    const customerId = profile.customerId || profile.id
    const customerName = coreCustomer?.business_name || profile.title || profile.businessName || profile.customerName || 'Customer'
    const renewalDate = typeof profile.renewal === 'object' ? profile.renewal.date : profile.renewal
    if (!renewalDate) { setError('That customer profile has no renewal date. Add a renewal date in Customer Records first.'); return }
    const exists = opportunities.some((deal) => deal.customerId === customerId && deal.renewalOpportunity && !isClosed(deal))
    if (exists) { setError('An open renewal opportunity already exists for this customer.'); return }
    await saveRecord({ kind: 'opportunity', title: `${customerName} renewal`, customer: customerName, customerId, owner: profile.owner || coreCustomer?.owner_name || '', territory: profile.territory || '', stage: 'Lead', amount: 0, probability: 25, close_date: renewalDate, source: 'Renewal', renewalOpportunity: true, notes: 'Created manually from the saved customer renewal date. Confirm scope and amount before forecasting.' })
    setError('')
  }

  async function convertDeal(values) {
    if (!conversionDeal || !isWon(conversionDeal)) throw new Error('Only a Won opportunity can be converted to a customer record.')
    const businessName = String(values.businessName || '').trim()
    const email = String(values.email || '').trim()
    const currentCustomers = backendState.customers || emptyRows
    const pendingCustomerId = conversionDeal.pendingCustomerId || conversionDeal.conversionCustomerId || conversionDeal.customerId
    const matched = currentCustomers.find((customer) => normalize(customer.business_name) === normalize(businessName) || (email && normalize(customer.email) === normalize(email)))
    let customer = currentCustomers.find((item) => item.id === pendingCustomerId) || (conversionDeal.pendingCustomer?.id === pendingCustomerId ? conversionDeal.pendingCustomer : null) || matched
    if (!customer) {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid contact email before creating a customer record.')
      if (!window.overheadBackend?.createCustomer) throw new Error('The local customer service is unavailable.')
      const result = await window.overheadBackend.createCustomer({ ...values, businessName, email })
      customer = (result?.customers || []).find((row) => normalize(row.business_name) === normalize(businessName) && normalize(row.email) === normalize(email))
      if (!customer) throw new Error('The customer was created, but its returned record could not be matched. Refresh the workspace before retrying.')
    }
    const pendingDeal = { ...conversionDeal, kind: 'opportunity', customer: customer.business_name, pendingCustomerId: customer.id, pendingCustomer: customer, conversionCustomerEmail: customer.email || email, conversionStatus: 'Conversion pending' }
    await saveRecord(pendingDeal)
    await saveRecord({ id: `lead-conversion-${conversionDeal.id}`, kind: 'lead_conversion', title: `Converted: ${conversionDeal.title}`, opportunityId: conversionDeal.id, customerId: customer.id, customer: customer.business_name, date: currentDate(), status: 'Complete', notes: matched ? 'Linked to an existing customer profile.' : 'Created a customer profile from the Won opportunity.' })
    await saveRecord({ ...pendingDeal, customerId: customer.id, conversionCustomerId: customer.id, conversionStatus: 'Converted', convertedAt: conversionDeal.convertedAt || new Date().toISOString() })
    await refreshBackend()
    closeConversionDialog()
    setOperationNotice(`${customer.business_name} is linked to the Won opportunity.`)
  }

  async function applyPlaybook(playbook) {
    const deal = opportunities.find((item) => item.id === playbookOpportunityId)
    if (!deal) throw new Error('Choose an opportunity to apply this playbook to.')
    const heading = `[${playbook.title} · ${currentDate()}]`
    const summary = String(playbook.content || '').trim()
    const notes = [String(deal.notes || '').trim(), heading, summary].filter(Boolean).join('\n\n')
    await saveRecord({ ...deal, kind: 'opportunity', notes })
    await saveRecord({ kind: 'sales_activity', opportunityId: deal.id, title: `Playbook applied: ${playbook.title}`, activityType: 'Playbook', date: currentDate(), owner: deal.owner || '', notes: `Applied to ${deal.title}.` })
  }

  async function addStarterPlaybooks() {
    const starters = [
      { title: 'Lead qualification', category: 'Discovery', content: 'Confirm the business need, buying roles, budget readiness, timing, and the agreed next step.' },
      { title: 'Proposal review', category: 'Proposal', content: 'Review scope, assumptions, decision date, approval path, and open questions before issuing a quote.' },
      { title: 'Renewal discovery', category: 'Renewal', content: 'Confirm upcoming needs, usage changes, decision makers, renewal date, and any service risks.' },
    ]
    for (const starter of starters) if (!playbooks.some((item) => item.title === starter.title)) await saveRecord({ ...starter, kind: 'sales_playbook', status: 'Active' })
    setNotice('Starter playbooks are ready to edit and reuse.')
  }

  const totalOpen = activeDeals.reduce((sum, deal) => sum + asNumber(deal.amount), 0)

  return <section className="reports-page sales-workspace">
    <div className="section-head"><div><p className="eyebrow">Sales operations · encrypted local records</p><h2>Sales forecasting and deal workflow</h2><p className="panel-copy">Calculate weighted forecasts, qualify leads, assign owners from explicit rules, and keep activity linked to each deal. No email or calendar provider is contacted here.</p></div></div>
    <FeatureTabs tabs={tabs} active={tab} onChange={setTab} />
    {(error || notice || loading) && <p className={error ? 'form-error' : 'queue-empty'} role={error ? 'alert' : undefined}>{error || notice || 'Loading saved sales records…'}</p>}

    {tab === 'overview' && <>
      <FeaturePanel eyebrow="Weighted pipeline" title="Forecast by close date" description="Open deals are weighted by their saved win probability. Estimates use the deal data in this local workspace and do not predict guaranteed revenue.">
        <div className="growth-dashboard-grid">
          <article className="growth-kpi"><small>Weighted open pipeline</small><strong>{money(weightedPipeline)}</strong><span>Across {activeDeals.length} open opportunities</span></article>
          <article className="growth-kpi"><small>Unweighted open pipeline</small><strong>{money(totalOpen)}</strong><span>Full amount of open deals</span></article>
          <article className="growth-kpi"><small>Closed-deal win rate</small><strong>{closedDeals ? `${winRate.toFixed(1)}%` : '—'}</strong><span>{wonDeals.length} won · {lostDeals.length} lost</span></article>
        </div>
        <div className="profile-form compact-form" style={{ maxWidth: 460 }}><label>Forecast month<input type="month" value={forecastMonth} onChange={(event) => setForecastMonth(event.target.value)} /></label><div className="task-list"><article className="task-row"><strong>{forecastMonth}</strong><span>{forecastMonthRow.dealCount} open deals</span><span>Amount {money(forecastMonthRow.total)}</span><span>Weighted {money(forecastMonthRow.weighted)}</span></article></div></div>
        <div className="task-list">{forecast.map((row) => <article className="task-row" key={row.month}><strong>{row.month}</strong><span>{row.dealCount} deals</span><span>Unweighted {money(row.total)}</span><span>Weighted {money(row.weighted)}</span></article>)}{!forecast.length && <p className="queue-empty">No open opportunities to forecast.</p>}</div>
      </FeaturePanel>
      <FeaturePanel eyebrow="Sales results" title="Lost-deal reasons and commission estimates" description="Lost reasons are grouped from closed Lost deals. Commission estimates use the configured local rate and deal amount; they are planning estimates only.">
        <div className="profile-form compact-form" style={{ maxWidth: 500 }}><label>Commission estimate rate (%)<input type="number" min="0" max="100" step="0.1" value={rateDraft} onChange={(event) => setRateDraft(event.target.value)} /></label><button className="primary-action" type="button" onClick={() => saveCommissionRate().catch((reason) => setError(reason.message))}>Save commission rate</button><span>Current rate {commissionRate}%</span></div>
        <div className="task-list">{lostReasonRows.map((row) => <article className="task-row" key={row.reason}><strong>{row.reason}</strong><span>{row.count} lost deal{row.count === 1 ? '' : 's'}</span></article>)}{!lostReasonRows.length && <p className="queue-empty">No Lost opportunities with reasons yet.</p>}</div>
        <div className="task-list">{opportunities.filter((deal) => asNumber(deal.amount) > 0).map((deal) => <article className="task-row" key={deal.id}><strong>{deal.title}</strong><span>{deal.stage || deal.status || 'Lead'}</span><span>Base {money(deal.amount)}</span><span>Estimate {money(asNumber(deal.amount) * commissionRate / 100)}</span></article>)}</div>
      </FeaturePanel>
    </>}

    {tab === 'opportunities' && <FeaturePanel eyebrow="Sales pipeline" title="Opportunity qualification and conversion" description="Maintain deal details, calculate lead scores from four explicit ratings, and convert a Won deal into a customer profile with a user-reviewed form.">
      <div className="section-head"><div><h3>Opportunity records</h3><p>{opportunities.length} saved opportunities · score formula: fit 30%, need 30%, budget 20%, timing 20%</p></div><button className="primary-action" type="button" onClick={() => { setEditing({ stage: 'Lead', amount: '0', probability: '25' }); setError('') }}>Add opportunity</button></div>
      {editing && <form className="profile-form compact-form" onSubmit={saveOpportunity} style={{ display: 'grid', gap: 12, padding: 14, border: '1px solid var(--line)', borderRadius: 8 }}>
        <strong>{editing.id ? 'Edit opportunity' : 'New opportunity'}</strong><div className="growth-form-grid">{opportunityFields.map((field) => <label key={field.name} className={field.multiline ? 'wide' : ''}>{field.label}{field.options ? <select value={editing[field.name] ?? field.defaultValue ?? ''} onChange={(event) => setEditing((current) => ({ ...current, [field.name]: event.target.value }))}>{field.options.map((option) => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? option}</option>)}</select> : field.multiline ? <textarea rows="3" value={editing[field.name] ?? ''} onChange={(event) => setEditing((current) => ({ ...current, [field.name]: event.target.value }))} /> : <input type={field.type || 'text'} min={field.min} max={field.max} step={field.step} value={editing[field.name] ?? field.defaultValue ?? ''} onChange={(event) => setEditing((current) => ({ ...current, [field.name]: event.target.value }))} />}</label>)}</div><div className="button-row"><button className="primary-action" type="submit">Save opportunity</button><button className="ghost-button" type="button" onClick={() => setEditing(null)}>Cancel</button></div>
      </form>}
      <div className="task-list">{opportunities.map((deal) => <article className="task-row" key={deal.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'start' }}><div><strong>{deal.title}</strong><span>{deal.customer ? `${deal.customer} · ` : ''}{deal.stage || deal.status || 'Lead'} · {deal.owner || 'Unassigned'}</span><span>{money(deal.amount)} at {Math.min(100, Math.max(0, asNumber(deal.probability)))}% · weighted {money(asNumber(deal.amount) * Math.min(100, Math.max(0, asNumber(deal.probability))) / 100)} · close {deal.close_date || 'unscheduled'}</span><span>Lead score {deal.lead_score === undefined || deal.lead_score === '' ? 'not scored' : `${deal.lead_score}/100`} · commission estimate {money(asNumber(deal.amount) * commissionRate / 100)}</span>{deal.lost_reason && <span>Lost reason: {deal.lost_reason}</span>}{deal.conversionStatus === 'Converted' && <span>Converted to customer profile {deal.customerId || ''}</span>}{deal.notes && <p>{deal.notes}</p>}</div><div className="feature-record-actions"><button className="ghost-button" type="button" onClick={() => scoreLead(deal)}>Calculate lead score</button><button className="text-button" type="button" onClick={() => { setEditing({ ...deal }); setError('') }}>Edit</button>{isWon(deal) && (deal.conversionStatus !== 'Converted' || !records.some((record) => record.kind === 'lead_conversion' && record.opportunityId === deal.id)) && <button className="text-button" type="button" onClick={(event) => { conversionOpenerRef.current = event.currentTarget; setConversionDeal(deal); setError('') }}>{deal.conversionStatus === 'Converted' ? 'Repair conversion record' : 'Convert to customer'}</button>}<button className="text-button danger-text" type="button" onClick={() => deleteRecord(deal.id).catch((reason) => setError(reason.message))}>Delete</button></div></article>)}{!opportunities.length && <p className="queue-empty">No opportunities saved yet.</p>}</div>
      <div className="profile-form compact-form" style={{ maxWidth: 560 }}><strong>Create a renewal opportunity</strong><label>Customer profile<select value={renewalCustomerId} onChange={(event) => setRenewalCustomerId(event.target.value)}><option value="">Choose a customer with a renewal date</option>{renewalProfiles.map((profile) => { const coreCustomer = (backendState.customers || emptyRows).find((item) => item.id === profile.customerId); const label = coreCustomer?.business_name || profile.title || profile.businessName || profile.customerName || 'Customer'; const renewalDate = typeof profile.renewal === 'object' ? profile.renewal.date : profile.renewal; return <option key={profile.id} value={profile.id}>{label} · renews {renewalDate}</option> })}</select></label><button className="ghost-button" type="button" onClick={() => createRenewal().catch((reason) => setError(reason.message))}>Create renewal opportunity</button></div>
      {conversionDeal && <div className="growth-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeConversionDialog() }}><div ref={conversionDialogRef} className="growth-editor" role="dialog" aria-modal="true" aria-labelledby={conversionTitleId} tabIndex={-1}><div className="section-head"><div><p className="eyebrow">Won deal conversion</p><h3 id={conversionTitleId}>Customer profile for {conversionDeal.title}</h3></div><button className="ghost-button" type="button" onClick={closeConversionDialog}>Close</button></div><p className="panel-copy">Review the customer details. If the business name or email matches an existing customer, the existing profile will be linked. A valid contact email is required for new customer records.</p><FeatureForm fields={conversionFields} initial={{ businessName: conversionDeal.customer || conversionDeal.title, ownerName: conversionDeal.owner || '', email: conversionDeal.conversionCustomerEmail || (backendState.customers || emptyRows).find((customer) => customer.id === (conversionDeal.pendingCustomerId || conversionDeal.conversionCustomerId || conversionDeal.customerId))?.email || '' }} submitLabel="Create or link customer" onSubmit={convertDeal} onCancel={closeConversionDialog} /></div></div>}
    </FeaturePanel>}

    {tab === 'rules' && <FeaturePanel eyebrow="Lead qualification and assignment" title="Territories, lead scoring, and owner rules" description="Rules act only when you press Apply. They update local opportunity owner fields; they do not enforce record visibility or change account permissions.">
      <div className="button-row"><button className="primary-action" type="button" onClick={() => applyTerritoryRules().catch((reason) => setError(reason.message))}>Apply territory rules to unassigned deals</button><button className="ghost-button" type="button" onClick={() => applyLeadAssignmentRules().catch((reason) => setError(reason.message))}>Apply active lead assignment rules</button></div>
      <FeatureRecordManager records={records} kind="territory_rule" title="Territory owner rules" description="Map a territory label to a default deal owner. Applying these rules fills unassigned owners and preserves existing owners." fields={[{ name: 'territory', label: 'Territory label', required: true }, { name: 'owner', label: 'Owner name or email', required: true }, { name: 'status', label: 'Rule status', options: ['Active', 'Disabled'], defaultValue: 'Active' }, { name: 'notes', label: 'Coverage notes', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Active', 'Disabled']} emptyText="No territory rules." />
      <FeatureRecordManager records={records} kind="lead_assignment_rule" title="Lead assignment rules" description="Rules match territory and source when provided, plus the minimum calculated lead score. The first active match wins; existing owners are preserved unless the rule explicitly allows replacement." fields={[{ name: 'title', label: 'Rule name', required: true }, { name: 'territory', label: 'Territory (optional)' }, { name: 'source', label: 'Lead source (optional)' }, { name: 'minimumScore', label: 'Minimum lead score', type: 'number', min: 0, max: 100, step: 1, defaultValue: '0' }, { name: 'owner', label: 'Assign to owner', required: true }, { name: 'overwrite', label: 'Replace existing owner', options: ['No', 'Yes'], defaultValue: 'No' }, { name: 'status', label: 'Rule status', options: ['Active', 'Disabled'], defaultValue: 'Active' }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Active', 'Disabled']} emptyText="No lead assignment rules." />
      <FeatureRecordList records={records.filter((record) => record.kind === 'lead_conversion')} emptyText="No lead conversion events recorded." />
    </FeaturePanel>}

    {tab === 'activities' && <FeaturePanel eyebrow="Deal history" title="Sales activities and collaboration notes" description="Record calls, meetings, demos, proposal reviews, follow-ups, and internal notes against a saved opportunity. Entries are local and user-created; no mail or calendar is imported.">
      <FeatureRecordManager records={records} kind="sales_activity" title="Opportunity activity log" description="Link each entry to an opportunity and record its outcome or next step." fields={activityFields} onSave={saveRecord} onDelete={deleteRecord} emptyText="No opportunity activities recorded." />
    </FeaturePanel>}

    {tab === 'playbooks' && <FeaturePanel eyebrow="Reusable sales guidance" title="Sales playbook library" description="Save editable qualification, proposal, and renewal guidance, then append a chosen playbook to a deal’s notes and activity history.">
      <div className="profile-form compact-form" style={{ maxWidth: 600 }}><label>Apply playbook to opportunity<select value={playbookOpportunityId} onChange={(event) => setPlaybookOpportunityId(event.target.value)}><option value="">Choose an opportunity</option>{opportunities.map((deal) => <option key={deal.id} value={deal.id}>{deal.title}</option>)}</select></label><button className="ghost-button" type="button" onClick={() => addStarterPlaybooks().catch((reason) => setError(reason.message))}>Add starter playbooks</button></div>
      <FeatureRecordManager records={records} kind="sales_playbook" title="Saved playbooks" description="Maintain internal guidance for your sales process; applying content adds it to the selected deal’s notes for review." fields={[{ name: 'title', label: 'Playbook name', required: true }, { name: 'category', label: 'Sales stage or use' }, { name: 'content', label: 'Guidance and checklist', multiline: true, required: true }, { name: 'status', label: 'Status', options: ['Active', 'Archived'], defaultValue: 'Active' }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Active', 'Archived']} emptyText="No playbooks saved." onAction={(playbook) => applyPlaybook(playbook).catch((reason) => setError(reason.message))} actionLabel="Apply to deal" />
    </FeaturePanel>}
  </section>
}
