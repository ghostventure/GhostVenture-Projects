import { useEffect, useMemo, useState } from 'react'
import { useFeatureRecords } from './FeatureWave101Helpers'
import './CustomerManagementWorkspace.css'

const tabs = ['Segments', 'Customer care', 'Duplicates', 'Feedback', 'Profile tools']
const checklistDefaults = ['Confirm primary contact', 'Record service requirements', 'Agree on preferred contact channel', 'Set first follow-up date']
const emptyRows = []
const clean = (value) => String(value || '').trim()
const normalized = (value) => clean(value).toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const newId = () => globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
const safeName = (customer) => customer.business_name || customer.owner_name || customer.email || 'Customer'

function downloadJson(filename, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function healthScore(customer, tasks, invoices) {
  let score = 100
  const openTasks = tasks.filter((task) => task.customer_id === customer.id && !/complete|closed|done/i.test(task.status || '')).length
  const overdueInvoices = invoices.filter((invoice) => invoice.customer_id === customer.id && !/paid|void/i.test(invoice.status || '') && invoice.due_date && invoice.due_date < new Date().toISOString().slice(0, 10)).length
  const activityDates = [...tasks.filter((task) => task.customer_id === customer.id).map((task) => task.updated_at || task.created_at || task.due_date), ...invoices.filter((invoice) => invoice.customer_id === customer.id).map((invoice) => invoice.updated_at || invoice.created_at || invoice.due_date)].filter(Boolean).map((value) => new Date(value).getTime()).filter(Number.isFinite)
  const daysSinceActivity = activityDates.length ? (Date.now() - Math.max(...activityDates)) / 86400000 : Infinity
  score -= Math.min(30, openTasks * 8)
  score -= Math.min(35, overdueInvoices * 18)
  score -= daysSinceActivity > 90 ? 25 : daysSinceActivity > 45 ? 12 : daysSinceActivity > 21 ? 5 : 0
  if (!clean(customer.email)) score -= 5
  return Math.max(0, Math.min(100, score))
}

export default function CustomerManagementWorkspace({ backendState = {}, secureView = true }) {
  const { records, loading, error, setError, save, remove } = useFeatureRecords('customers')
  const [tab, setTab] = useState(tabs[0])
  const [selectedId, setSelectedId] = useState('')
  const [segmentDraft, setSegmentDraft] = useState({ name: '', industry: '', status: 'Any', minHealth: '' })
  const [contactDraft, setContactDraft] = useState({ name: '', role: 'Billing', email: '', phone: '' })
  const [feedbackDraft, setFeedbackDraft] = useState({ customerId: '', subject: '', details: '', status: 'New' })
  const [ownerDraft, setOwnerDraft] = useState('')
  const [ownershipDraft, setOwnershipDraft] = useState({ name: '', industry: '', minHealth: '', ownerEmail: '' })
  const [allowOwnerOverride, setAllowOwnerOverride] = useState(false)
  const [followupDraft, setFollowupDraft] = useState({ dueDate: '', note: '' })
  const [message, setMessage] = useState('')
  const customers = backendState.customers || emptyRows
  const tasks = backendState.tasks || emptyRows
  const invoices = backendState.invoices || emptyRows
  const profiles = records.filter((record) => record.kind === 'customer_profile')
  const segments = records.filter((record) => record.kind === 'customer_segment')
  const feedback = records.filter((record) => record.kind === 'customer_feedback').sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  const ownershipRules = records.filter((record) => record.kind === 'customer_ownership_rule')
  const followups = records.filter((record) => record.kind === 'customer_followup').sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
  const fieldDefinitions = records.filter((record) => record.kind === 'customer_field_definition')
  const surveys = records.filter((record) => record.kind === 'customer_survey')
  const surveyResponses = records.filter((record) => record.kind === 'customer_survey_response')
  const relationships = records.filter((record) => record.kind === 'customer_relationship')
  const activeStaff = (backendState.userProfiles || []).filter((user) => (user.status || 'Active') === 'Active' && clean(user.email))
  const profileByCustomer = useMemo(() => new Map(profiles.map((profile) => [profile.customerId, profile])), [profiles])
  const selectedCustomer = customers.find((customer) => customer.id === selectedId) || customers[0]
  const selectedProfile = selectedCustomer ? profileByCustomer.get(selectedCustomer.id) : null
  const selectedOwnerEmail = selectedProfile?.accountOwnerEmail || activeStaff.find((user) => user.owner_name && user.owner_name === selectedCustomer?.owner_name)?.email || ''
  const contactBlocked = (selectedProfile?.preferences?.channel || selectedCustomer?.preferred_contact || 'Email') === 'Do not contact' || (selectedProfile?.consent || []).some((entry) => ['Withdrawn', 'Not provided'].includes(entry.state))

  useEffect(() => { setOwnerDraft(selectedOwnerEmail) }, [selectedCustomer?.id, selectedOwnerEmail])

  function profileFor(customer) {
    return profileByCustomer.get(customer.id) || { kind: 'customer_profile', customerId: customer.id, contacts: [], onboarding: checklistDefaults.map((label) => ({ label, done: false })), interactions: [], risks: [], consent: [], preferences: {}, renewal: {} }
  }
  async function saveProfile(customer, changes) {
    if (!customer?.id) throw new Error('Choose a saved customer first.')
    const current = profileFor(customer)
    await save({ ...current, ...changes, kind: 'customer_profile', customerId: customer.id })
    setMessage(`Customer workspace updated for ${safeName(customer)}.`)
  }
  const duplicateGroups = useMemo(() => {
    const keys = new Map()
    for (const customer of customers) {
      for (const [kind, value] of [['email', customer.email], ['name', customer.business_name]]) {
        const key = normalized(value)
        if (key.length < 4) continue
        const groupKey = `${kind}:${key}`
        keys.set(groupKey, [...(keys.get(groupKey) || []), customer])
      }
    }
    return [...keys.entries()].filter(([, group]) => group.length > 1).map(([key, group]) => ({ key, group }))
  }, [customers])
  function score(customer) { return healthScore(customer, tasks, invoices) }
  const segmentMatches = (segment) => customers.filter((customer) => {
    const health = score(customer)
    return (!segment.industry || normalized(customer.industry) === normalized(segment.industry))
      && (segment.status === 'Any' || (customer.status || 'Active') === segment.status)
      && (!Number.isFinite(Number(segment.minHealth)) || Number(segment.minHealth) <= 0 || health >= Number(segment.minHealth))
  })
  const selectedName = selectedCustomer ? safeName(selectedCustomer) : 'No customer selected'

  async function addSegment(event) {
    event.preventDefault()
    if (!clean(segmentDraft.name)) return
    await save({ kind: 'customer_segment', title: clean(segmentDraft.name), ...segmentDraft, minHealth: segmentDraft.minHealth === '' ? '' : Number(segmentDraft.minHealth) })
    setSegmentDraft({ name: '', industry: '', status: 'Any', minHealth: '' })
    setMessage('Customer segment saved. Matching uses current local customer records.')
  }
  async function addContact(event) {
    event.preventDefault()
    if (!clean(contactDraft.name) || !selectedCustomer) return
    const current = profileFor(selectedCustomer)
    await saveProfile(selectedCustomer, { contacts: [...(current.contacts || []), { ...contactDraft, id: newId(), name: clean(contactDraft.name), email: clean(contactDraft.email), phone: clean(contactDraft.phone) }] })
    setContactDraft({ name: '', role: 'Billing', email: '', phone: '' })
  }
  async function addFeedback(event) {
    event.preventDefault()
    if (!clean(feedbackDraft.subject) || !clean(feedbackDraft.details)) return
    const customer = customers.find((item) => item.id === feedbackDraft.customerId)
    await save({ kind: 'customer_feedback', title: clean(feedbackDraft.subject), customerId: customer?.id || '', customerName: customer ? safeName(customer) : 'Unlinked', details: clean(feedbackDraft.details), status: feedbackDraft.status, createdAt: new Date().toISOString() })
    setFeedbackDraft({ customerId: '', subject: '', details: '', status: 'New' })
    setMessage('Feedback saved to the local customer inbox; no message was sent.')
  }
  async function addCustomerNote(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    if (!selectedCustomer) throw new Error('Choose a customer first.')
    const form = new FormData(event.currentTarget)
    const body = clean(form.get('note'))
    if (!body) return
    const mentions = [...body.matchAll(/@([\w.+-]+@[\w.-]+)/g)].map((match) => match[1].toLowerCase())
    const current = profileFor(selectedCustomer)
    const note = { id: newId(), type: 'Internal note', body, mentions, createdAt: new Date().toISOString(), author: clean(backendState.currentUser?.email || '') }
    await saveProfile(selectedCustomer, { interactions: [note, ...(current.interactions || [])] })
    if (mentions.length) await save({ kind: 'customer_note_mention', customerId: selectedCustomer.id, noteId: note.id, mentions, body, createdAt: note.createdAt, status: 'Unread' })
    formElement.reset()
  }
  async function addCustomField(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(event.currentTarget)
    const name = clean(form.get('name'))
    if (!name) return
    if (fieldDefinitions.some((field) => normalized(field.title) === normalized(name))) throw new Error('A custom field with that name already exists.')
    await save({ kind: 'customer_field_definition', title: name, fieldType: clean(form.get('type')) || 'text', createdAt: new Date().toISOString() })
    formElement.reset()
    setMessage(`Custom field “${name}” is available on the selected customer.`)
  }
  async function saveCustomFieldValue(event) {
    event.preventDefault()
    if (!selectedCustomer) throw new Error('Choose a customer first.')
    const form = new FormData(event.currentTarget)
    const current = profileFor(selectedCustomer)
    const customFields = { ...(current.customFields || {}), [String(form.get('fieldId'))]: clean(form.get('value')) }
    await saveProfile(selectedCustomer, { customFields })
  }
  async function addSurvey(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(event.currentTarget)
    const title = clean(form.get('title'))
    const question = clean(form.get('question'))
    if (!title || !question) return
    await save({ kind: 'customer_survey', title, question, status: 'Active', createdAt: new Date().toISOString() })
    formElement.reset()
  }
  async function recordSurveyResponse(event, survey) {
    event.preventDefault()
    const formElement = event.currentTarget
    if (!selectedCustomer) throw new Error('Choose a customer first.')
    const answer = clean(new FormData(event.currentTarget).get('answer'))
    if (!answer) return
    await save({ kind: 'customer_survey_response', surveyId: survey.id, surveyTitle: survey.title, customerId: selectedCustomer.id, customerName: safeName(selectedCustomer), answer, createdAt: new Date().toISOString() })
    formElement.reset()
  }
  async function addRelationship(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    if (!selectedCustomer) throw new Error('Choose a customer first.')
    const form = new FormData(event.currentTarget)
    const relatedId = clean(form.get('relatedId'))
    if (!relatedId || relatedId === selectedCustomer.id) throw new Error('Choose a different customer to relate.')
    const existing = relationships.find((item) => item.customerId === selectedCustomer.id && item.relatedCustomerId === relatedId)
    await save({ ...(existing || {}), kind: 'customer_relationship', customerId: selectedCustomer.id, relatedCustomerId: relatedId, relationship: clean(form.get('relationship')), createdAt: existing?.createdAt || new Date().toISOString() })
    formElement.reset()
  }
  async function importWebsiteFeedback(event) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 1_000_000) { setError('Feedback import is limited to 1 MB.'); input.value = ''; return }
    try {
      const parsed = JSON.parse(await file.text())
      const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.feedback) ? parsed.feedback : Array.isArray(parsed?.product_feedback) ? parsed.product_feedback : null
      if (!rows || rows.length > 50) throw new Error('Choose a JSON array of at most 50 website feedback records (or an object with a feedback/product_feedback array).')
      const existingSources = new Set(feedback.map((item) => item.sourceId).filter(Boolean))
      let imported = 0
      for (const rawItem of rows) {
        const item = rawItem?.data && typeof rawItem.data === 'object' ? { ...rawItem.data, id: rawItem.id || rawItem.docId } : rawItem
        const details = clean(item?.message || item?.details)
        if (details.length < 10 || details.length > 4000) continue
        const email = clean(item?.created_by_email || item?.email).toLowerCase().slice(0, 254)
        const customer = customers.find((candidate) => clean(candidate.email).toLowerCase() === email)
        const sourceId = clean(item?.id || item?.docId || item?.sourceId) || `fp-${normalized(`${email}-${item?.feedback_type || ''}-${details}`).slice(0, 120)}`
        if (existingSources.has(sourceId)) continue
        const title = clean(item?.feedback_type || item?.subject) || 'Website product feedback'
        const candidateDate = item?.created_at?.seconds ? new Date(item.created_at.seconds * 1000).toISOString() : item?.created_at || item?.createdAt
        const createdAt = candidateDate && Number.isFinite(new Date(candidateDate).getTime()) ? new Date(candidateDate).toISOString() : new Date().toISOString()
        await save({ kind: 'customer_feedback', title: title.slice(0, 120), customerId: customer?.id || '', customerName: customer ? safeName(customer) : 'Website respondent', details, rating: Number.isInteger(Number(item?.rating)) ? Math.max(1, Math.min(5, Number(item.rating))) : null, followUpPermission: item?.follow_up === true || item?.follow_up === 'yes', source: 'website-product-feedback', sourceId, status: ['New', 'Reviewing', 'Resolved'].includes(item?.status) ? item.status : 'New', createdAt })
        existingSources.add(sourceId)
        imported += 1
      }
      setError('')
      setMessage(`Imported ${imported} validated website feedback record${imported === 1 ? '' : 's'}; duplicates and invalid entries were skipped.`)
    } catch (reason) { setError(reason?.message || 'Feedback import could not be read.') }
    finally { input.value = '' }
  }
  async function updateFeedback(item, status) { await save({ ...item, status }) }
  async function addRisk(event) {
    event.preventDefault()
    const formNode = event.currentTarget
    const form = new FormData(event.currentTarget)
    const label = clean(form.get('risk'))
    if (!label || !selectedCustomer) return
    const current = profileFor(selectedCustomer)
    await saveProfile(selectedCustomer, { risks: [{ id: newId(), label, severity: String(form.get('severity') || 'Medium'), status: 'Open', createdAt: new Date().toISOString() }, ...(current.risks || [])] })
    formNode.reset()
  }
  async function exportCustomer() {
    if (!selectedCustomer) return
    const related = { customer: selectedCustomer, workspaceProfile: selectedProfile || null, feedback: feedback.filter((item) => item.customerId === selectedCustomer.id), tasks: tasks.filter((item) => item.customer_id === selectedCustomer.id), invoices: invoices.filter((item) => item.customer_id === selectedCustomer.id) }
    downloadJson(`customer-${String(selectedCustomer.id).replace(/[^a-z0-9_-]/gi, '-')}-export.json`, { exportedAt: new Date().toISOString(), source: 'OverHead local customer workspace', records: related })
    setMessage('Customer-scoped JSON export created on this device.')
  }
  async function addFollowup(event) {
    event.preventDefault()
    if (!selectedCustomer) throw new Error('Choose a customer first.')
    const channel = selectedProfile?.preferences?.channel || selectedCustomer.preferred_contact || 'Email'
    if (contactBlocked) throw new Error('Customer contact is blocked by the saved communication preference or consent record. Review and update consent before creating a follow-up.')
    if (!selectedOwnerEmail) throw new Error('Assign an active staff owner before creating a customer follow-up.')
    await save({ kind: 'customer_followup', customerId: selectedCustomer.id, customerName: selectedName, assignedToEmail: selectedOwnerEmail, channel, dueDate: followupDraft.dueDate || new Date().toISOString().slice(0, 10), note: clean(followupDraft.note), status: 'Open', title: `Review ${channel} follow-up for ${selectedName}` })
    setFollowupDraft({ dueDate: '', note: '' })
    setMessage('Local follow-up task recorded. No customer message was sent.')
  }
  async function addOwnershipRule(event) {
    event.preventDefault()
    const user = activeStaff.find((entry) => entry.email === ownershipDraft.ownerEmail)
    if (!clean(ownershipDraft.name) || !user) throw new Error('Give the rule a name and choose an active staff owner.')
    const minHealth = ownershipDraft.minHealth === '' ? '' : Number(ownershipDraft.minHealth)
    if (minHealth !== '' && (!Number.isFinite(minHealth) || minHealth < 0 || minHealth > 100)) throw new Error('Minimum health must be between 0 and 100.')
    await save({ kind: 'customer_ownership_rule', title: clean(ownershipDraft.name), industry: clean(ownershipDraft.industry), minHealth, ownerEmail: user.email, ownerName: user.owner_name || user.email, status: 'Active' })
    setOwnershipDraft({ name: '', industry: '', minHealth: '', ownerEmail: '' })
    setMessage('Customer ownership rule saved. Apply it explicitly to selected matches below.')
  }
  async function applyOwnershipRule(rule) {
    const matches = customers.filter((customer) => (!rule.industry || normalized(customer.industry) === normalized(rule.industry)) && (rule.minHealth === '' || score(customer) >= Number(rule.minHealth)))
    let changed = 0
    for (const customer of matches) {
      const profile = profileFor(customer)
      const assigned = Boolean(profile.accountOwnerEmail || customer.owner_email || (customer.owner_name && customer.owner_name !== 'Owner pending'))
      if (assigned && !allowOwnerOverride) continue
      await save({ ...profile, id: profileByCustomer.get(customer.id)?.id, kind: 'customer_profile', customerId: customer.id, accountOwner: rule.ownerName, accountOwnerEmail: rule.ownerEmail })
      changed += 1
    }
    setMessage(`Applied “${rule.title}” to ${changed} customer${changed === 1 ? '' : 's'}; ${matches.length - changed} existing assignment${matches.length - changed === 1 ? '' : 's'} preserved.`)
  }

  if (!secureView) return <section className="feature-panel"><h2>Customer management</h2><p>Unlock protected customer details to use this workspace.</p></section>

  return <section className="feature-panel customer-management" aria-label="Customer management workspace">
    <header className="section-head"><div><p className="eyebrow">Customer operations</p><h2>Customer management</h2><p>Segments, care tracking, consent, ownership, and local customer records.</p></div><span>{customers.length} customers</span></header>
    <div className="button-row" role="tablist" aria-label="Customer tools">{tabs.map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'primary-action' : 'ghost-button'} onClick={() => setTab(item)}>{item}</button>)}</div>
    {loading && <p>Loading encrypted customer workspace records…</p>}{error && <p className="form-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {tab === 'Segments' && <div className="customer-management-grid">
      <form className="profile-form compact-form" onSubmit={(event) => addSegment(event).catch((reason) => setError(reason.message))}>
        <h3>Build a local customer segment</h3>
        <label>Segment name<input required maxLength="80" value={segmentDraft.name} onChange={(event) => setSegmentDraft({ ...segmentDraft, name: event.target.value })} /></label>
        <label>Industry match<input maxLength="80" value={segmentDraft.industry} onChange={(event) => setSegmentDraft({ ...segmentDraft, industry: event.target.value })} placeholder="Any industry" /></label>
        <label>Customer status<select value={segmentDraft.status} onChange={(event) => setSegmentDraft({ ...segmentDraft, status: event.target.value })}><option>Any</option><option>Active</option><option>Inactive</option></select></label>
        <label>Minimum health score<input type="number" min="0" max="100" value={segmentDraft.minHealth} onChange={(event) => setSegmentDraft({ ...segmentDraft, minHealth: event.target.value })} /></label>
        <button className="primary-action" type="submit">Save segment</button>
      </form>
      <div className="task-list">{segments.map((segment) => <article className="task-row" key={segment.id}><strong>{segment.title}</strong><span>{segmentMatches(segment).length} matches · {segment.industry || 'any industry'} · status {segment.status || 'Any'}{segment.minHealth !== '' ? ` · health ≥ ${segment.minHealth}` : ''}</span><button className="text-button" type="button" onClick={() => remove(segment.id).catch((reason) => setError(reason.message))}>Delete segment</button><details><summary>View matching customers</summary>{segmentMatches(segment).map((customer) => <p key={customer.id}>{safeName(customer)} · health {score(customer)}</p>)}</details></article>)}{!segments.length && <p>No customer segments saved.</p>}</div>
      <div className="task-row"><h3>Activity-based health score</h3><p>Score starts at 100, subtracts for overdue invoices, open tasks, stale task or invoice activity, and missing email. It is a transparent local heuristic, not a prediction.</p><select aria-label="Select customer for health score" value={selectedCustomer?.id || ''} onChange={(event) => setSelectedId(event.target.value)}><option value="">Choose customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{safeName(customer)}</option>)}</select>{selectedCustomer && <strong>{score(selectedCustomer)} / 100</strong>}</div>
    </div>}
    {tab === 'Customer care' && <>
      <label className="customer-picker">Customer<select value={selectedCustomer?.id || ''} onChange={(event) => setSelectedId(event.target.value)}><option value="">Choose a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{safeName(customer)}</option>)}</select></label>
      {!selectedCustomer ? <p>Create or import a customer before managing customer care details.</p> : <>
        <header className="section-head tight"><div><p className="eyebrow">Selected customer</p><h3>{selectedName}</h3></div><button className="ghost-button" type="button" onClick={() => exportCustomer().catch((reason) => setError(reason.message))}>Export this customer JSON</button></header>
        <div className="customer-management-grid">
          <article className="task-row"><h3>Contact roles</h3><p>Keep multiple customer contacts with a defined responsibility.</p><form className="profile-form compact-form" onSubmit={(event) => addContact(event).catch((reason) => setError(reason.message))}><label>Name<input required value={contactDraft.name} onChange={(event) => setContactDraft({ ...contactDraft, name: event.target.value })} /></label><label>Role<select value={contactDraft.role} onChange={(event) => setContactDraft({ ...contactDraft, role: event.target.value })}><option>Primary</option><option>Billing</option><option>Decision maker</option><option>Operations</option><option>Technical</option><option>Other</option></select></label><label>Email<input type="email" value={contactDraft.email} onChange={(event) => setContactDraft({ ...contactDraft, email: event.target.value })} /></label><label>Phone<input type="tel" value={contactDraft.phone} onChange={(event) => setContactDraft({ ...contactDraft, phone: event.target.value })} /></label><button className="primary-action">Add contact</button></form>{(selectedProfile?.contacts || []).map((contact) => <p key={contact.id}><strong>{contact.name}</strong> · {contact.role} · {contact.email || contact.phone || 'No contact method'} <button className="text-button" type="button" onClick={() => saveProfile(selectedCustomer, { contacts: selectedProfile.contacts.filter((item) => item.id !== contact.id) }).catch((reason) => setError(reason.message))}>Remove</button></p>)}</article>
          <article className="task-row"><h3>Onboarding checklist</h3>{(selectedProfile?.onboarding || checklistDefaults.map((label) => ({ label, done: false }))).map((item, index) => <label className="customer-check" key={`${item.label}-${index}`}><input type="checkbox" checked={Boolean(item.done)} onChange={(event) => { const next = [...(selectedProfile?.onboarding || checklistDefaults.map((label) => ({ label, done: false })))]; next[index] = { ...item, done: event.target.checked }; saveProfile(selectedCustomer, { onboarding: next }).catch((reason) => setError(reason.message)) }} />{item.label}</label>)}<small>Checklist state is stored locally with this customer profile.</small></article>
          <article className="task-row"><h3>Renewal tracking</h3><label>Renewal date<input type="date" value={selectedProfile?.renewal?.date || ''} onChange={(event) => saveProfile(selectedCustomer, { renewal: { ...(selectedProfile?.renewal || {}), date: event.target.value } }).catch((reason) => setError(reason.message))} /></label><label>Stage<select value={selectedProfile?.renewal?.stage || 'Not set'} onChange={(event) => saveProfile(selectedCustomer, { renewal: { ...(selectedProfile?.renewal || {}), stage: event.target.value } }).catch((reason) => setError(reason.message))}><option>Not set</option><option>Upcoming</option><option>Reviewing</option><option>Renewed</option><option>At risk</option><option>Not renewing</option></select></label><p>Dates and stages are tracked for staff review; reminders are not sent automatically.</p></article>
          <article className="task-row"><h3>Consent and communication preferences</h3><label>Contact preference<select value={selectedProfile?.preferences?.channel || selectedCustomer.preferred_contact || 'Email'} onChange={(event) => saveProfile(selectedCustomer, { preferences: { ...(selectedProfile?.preferences || {}), channel: event.target.value } }).catch((reason) => setError(reason.message))}><option>Email</option><option>Phone</option><option>Text message</option><option>Do not contact</option></select></label><form className="profile-form compact-form" onSubmit={(event) => { event.preventDefault(); const formNode = event.currentTarget; const form = new FormData(formNode); const entry = { id: newId(), purpose: clean(form.get('purpose')), state: String(form.get('state')), source: clean(form.get('source')), recordedAt: new Date().toISOString() }; saveProfile(selectedCustomer, { consent: [entry, ...(selectedProfile?.consent || [])] }).then(() => formNode.reset()).catch((reason) => setError(reason.message)) }}><label>Consent purpose<input name="purpose" required placeholder="Service updates" /></label><label>Consent state<select name="state"><option>Granted</option><option>Withdrawn</option><option>Not provided</option></select></label><label>Source or reference<input name="source" placeholder="Verbal, form, date" /></label><button className="primary-action">Record consent</button></form>{(selectedProfile?.consent || []).map((item) => <p key={item.id}>{item.purpose}: {item.state} · {item.source || 'source not recorded'} · {new Date(item.recordedAt).toLocaleDateString()}</p>)}<small>This is a staff record only; communication delivery does not enforce these preferences.</small></article>
          <article className="task-row"><h3>Customer risk flags</h3><form className="profile-form compact-form" onSubmit={(event) => addRisk(event).catch((reason) => setError(reason.message))}><label>Risk note<input name="risk" required maxLength="200" /></label><label>Severity<select name="severity"><option>Low</option><option>Medium</option><option>High</option></select></label><button className="primary-action">Add risk flag</button></form>{(selectedProfile?.risks || []).map((risk) => <p key={risk.id}><strong>{risk.severity}</strong> · {risk.label} · {risk.status}<button className="text-button" type="button" onClick={() => saveProfile(selectedCustomer, { risks: selectedProfile.risks.map((item) => item.id === risk.id ? { ...item, status: item.status === 'Open' ? 'Resolved' : 'Open' } : item) }).catch((reason) => setError(reason.message))}>{risk.status === 'Open' ? 'Resolve' : 'Reopen'}</button></p>)}</article>
          <article className="task-row"><h3>Account ownership</h3><label>Active staff owner<select value={ownerDraft} onChange={(event) => setOwnerDraft(event.target.value)}><option value="">Unassigned</option>{activeStaff.map((user) => <option key={user.email} value={user.email}>{user.owner_name || user.email} · {user.role}</option>)}</select></label><button className="ghost-button" type="button" onClick={() => { const user = activeStaff.find((item) => item.email === ownerDraft); saveProfile(selectedCustomer, { accountOwner: user?.owner_name || '', accountOwnerEmail: user?.email || '' }).catch((reason) => setError(reason.message)) }}>Save owner</button><p>Assignment is validated against active staff profiles. Existing owners are changed only by an explicit save or rule application.</p></article>
          <article className="task-row"><h3>Customer ownership rules</h3><form className="profile-form compact-form" onSubmit={(event) => addOwnershipRule(event).catch((reason) => setError(reason.message))}><label>Rule name<input required value={ownershipDraft.name} onChange={(event) => setOwnershipDraft({ ...ownershipDraft, name: event.target.value })} /></label><label>Industry match<input value={ownershipDraft.industry} onChange={(event) => setOwnershipDraft({ ...ownershipDraft, industry: event.target.value })} placeholder="Any industry" /></label><label>Minimum health score<input type="number" min="0" max="100" value={ownershipDraft.minHealth} onChange={(event) => setOwnershipDraft({ ...ownershipDraft, minHealth: event.target.value })} /></label><label>Assign to active staff<select required value={ownershipDraft.ownerEmail} onChange={(event) => setOwnershipDraft({ ...ownershipDraft, ownerEmail: event.target.value })}><option value="">Choose staff owner</option>{activeStaff.map((user) => <option key={user.email} value={user.email}>{user.owner_name || user.email} · {user.role}</option>)}</select></label><button className="primary-action" type="submit" disabled={!activeStaff.length}>Save rule</button></form><label className="customer-check"><input type="checkbox" checked={allowOwnerOverride} onChange={(event) => setAllowOwnerOverride(event.target.checked)} />Allow apply action to replace an existing owner</label>{ownershipRules.map((rule) => { const matches = customers.filter((customer) => (!rule.industry || normalized(customer.industry) === normalized(rule.industry)) && (rule.minHealth === '' || score(customer) >= Number(rule.minHealth))); return <p key={rule.id}><strong>{rule.title}</strong> · {rule.industry || 'all industries'} · {matches.length} matches · owner {rule.ownerName}<button className="text-button" type="button" onClick={() => applyOwnershipRule(rule).catch((reason) => setError(reason.message))}>Apply to matches</button></p> })}{!ownershipRules.length && <small>No ownership rules saved. Rules never apply until you select Apply to matches.</small>}</article>
          <article className="task-row"><h3>Permission-gated follow-up</h3><p>No email sender is configured in this desktop app. This action records an internal follow-up task only; it does not contact the customer.</p><form className="profile-form compact-form" onSubmit={(event) => addFollowup(event).catch((reason) => setError(reason.message))}><label>Due date<input type="date" value={followupDraft.dueDate} onChange={(event) => setFollowupDraft({ ...followupDraft, dueDate: event.target.value })} /></label><label>Internal note<input maxLength="300" value={followupDraft.note} onChange={(event) => setFollowupDraft({ ...followupDraft, note: event.target.value })} /></label><button className="primary-action" disabled={contactBlocked || !selectedOwnerEmail}>Create internal follow-up</button>{contactBlocked && <small role="alert">Blocked by the saved Do not contact preference or a Withdrawn/Not provided consent record.</small>}{!selectedOwnerEmail && <small>Assign an active staff owner first.</small>}</form>{followups.filter((item) => item.customerId === selectedCustomer.id && item.status === 'Open').map((item) => <p key={item.id}>{item.dueDate} · {item.title}<button className="text-button" type="button" onClick={() => save({ ...item, status: 'Complete' }).catch((reason) => setError(reason.message))}>Complete</button></p>)}</article>
        </div>
      </>}
    </>}
    {tab === 'Duplicates' && <article className="task-row"><h3>Possible duplicate customers</h3><p>Exact normalized name/email matches from currently loaded local customer records. Review before acting; no records are merged or changed.</p>{duplicateGroups.map(({ key, group }) => <div key={key}><strong>{key.startsWith('email:') ? 'Email match' : 'Name match'}</strong>{group.map((customer) => <p key={customer.id}>{safeName(customer)} · {customer.email || 'no email'} · ID {customer.id}</p>)}</div>)}{!duplicateGroups.length && <p>No exact name or email duplicates found.</p>}</article>}
    {tab === 'Profile tools' && <>
      <label className="customer-picker">Customer<select value={selectedCustomer?.id || ''} onChange={(event) => setSelectedId(event.target.value)}><option value="">Choose a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{safeName(customer)}</option>)}</select></label>
      <div className="customer-management-grid">
        <article className="task-row"><h3>Custom customer fields</h3><p>Field definitions and values stay in the encrypted local customer workspace.</p><form className="profile-form compact-form" onSubmit={(event) => addCustomField(event).catch((reason) => setError(reason.message))}><label>Field name<input name="name" required maxLength="60" /></label><label>Type<select name="type"><option>text</option><option>number</option><option>date</option></select></label><button className="primary-action">Add field</button></form>{selectedCustomer && fieldDefinitions.map((field) => <form key={field.id} className="profile-form compact-form" onSubmit={(event) => saveCustomFieldValue(event).catch((reason) => setError(reason.message))}><label>{field.title}<input name="value" defaultValue={selectedProfile?.customFields?.[field.id] || ''} type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'} /></label><input type="hidden" name="fieldId" value={field.id} /><button className="ghost-button">Save value</button></form>)}</article>
        <article className="task-row"><h3>Internal notes and mentions</h3><p>Use @name@example.com to record an encrypted local mention inbox item. No message is sent.</p>{selectedCustomer && <form className="profile-form compact-form" onSubmit={(event) => addCustomerNote(event).catch((reason) => setError(reason.message))}><label>Note<textarea name="note" required rows="3" maxLength="1200" /></label><button className="primary-action">Save internal note</button></form>}{(selectedProfile?.interactions || []).filter((item) => item.type === 'Internal note').map((note) => <p key={note.id}>{note.createdAt ? new Date(note.createdAt).toLocaleString() : ''} · {note.body}<small>{note.mentions?.length ? ` Mentioned: ${note.mentions.join(', ')}` : ''}</small></p>)}</article>
        <article className="task-row"><h3>Customer satisfaction surveys</h3><p>Create local question templates and record responses during a customer conversation. No invitations are sent.</p><form className="profile-form compact-form" onSubmit={(event) => addSurvey(event).catch((reason) => setError(reason.message))}><label>Survey title<input name="title" required maxLength="80" /></label><label>Question<input name="question" required maxLength="240" /></label><button className="primary-action">Create survey</button></form>{surveys.filter((survey) => survey.status === 'Active').map((survey) => <div key={survey.id}><strong>{survey.title}</strong><p>{survey.question}</p>{selectedCustomer && <form className="profile-form compact-form" onSubmit={(event) => recordSurveyResponse(event, survey).catch((reason) => setError(reason.message))}><label>Response<input name="answer" required maxLength="1200" /></label><button className="ghost-button">Record response for {safeName(selectedCustomer)}</button></form>}{surveyResponses.filter((response) => response.surveyId === survey.id).map((response) => <small key={response.id}>{response.customerName} � {response.answer}</small>)}</div>)}</article>
        <article className="task-row"><h3>Customer relationships</h3><p>Maintain an explicit local relationship map between loaded customer records.</p>{selectedCustomer && <form className="profile-form compact-form" onSubmit={(event) => addRelationship(event).catch((reason) => setError(reason.message))}><label>Related customer<select name="relatedId" required defaultValue=""><option value="">Choose customer</option>{customers.filter((customer) => customer.id !== selectedCustomer.id).map((customer) => <option key={customer.id} value={customer.id}>{safeName(customer)}</option>)}</select></label><label>Relationship<input name="relationship" required placeholder="Parent, subsidiary, referral partner" /></label><button className="primary-action">Save relationship</button></form>}{relationships.filter((item) => item.customerId === selectedCustomer?.id).map((item) => <p key={item.id}>{item.relationship} ? {safeName(customers.find((customer) => customer.id === item.relatedCustomerId) || {})}</p>)}</article>
      </div>
    </>}    {tab === 'Feedback' && <div className="customer-management-grid"><article className="task-row"><h3>Import verified website feedback JSON</h3><p>Export an array of documents from the website&apos;s <code>product_feedback</code> collection. The importer validates message length, deduplicates by source ID, imports up to 50 records, and keeps the result in encrypted local storage.</p><input type="file" accept="application/json,.json" aria-label="Import website feedback JSON" onChange={(event) => importWebsiteFeedback(event).catch((reason) => setError(reason.message))} /><small>Accepted fields follow the current form: feedback_type, rating, message, follow_up, created_by_email, created_at, status, plus an optional source id.</small></article><form className="profile-form compact-form" onSubmit={(event) => addFeedback(event).catch((reason) => setError(reason.message))}><h3>Enter feedback locally</h3><label>Customer<select value={feedbackDraft.customerId} onChange={(event) => setFeedbackDraft({ ...feedbackDraft, customerId: event.target.value })}><option value="">Unlinked feedback</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{safeName(customer)}</option>)}</select></label><label>Subject<input required value={feedbackDraft.subject} onChange={(event) => setFeedbackDraft({ ...feedbackDraft, subject: event.target.value })} /></label><label>Feedback<textarea required rows="4" value={feedbackDraft.details} onChange={(event) => setFeedbackDraft({ ...feedbackDraft, details: event.target.value })} /></label><button className="primary-action">Add to inbox</button></form><div className="task-list">{feedback.map((item) => <article className="task-row" key={item.id}><strong>{item.title}</strong><span>{item.customerName} · {new Date(item.createdAt || item.created_at).toLocaleString()} · {item.source || 'Local entry'}</span><p>{item.details}</p>{item.rating && <small>Rating: {item.rating}/5 · follow-up permission: {item.followUpPermission ? 'yes' : 'not granted'}</small>}<label>Status<select value={item.status} onChange={(event) => updateFeedback(item, event.target.value).catch((reason) => setError(reason.message))}><option>New</option><option>Reviewing</option><option>Resolved</option></select></label></article>)}{!feedback.length && <p>No customer feedback records.</p>}</div></div>}
  </section>
}
