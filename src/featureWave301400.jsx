import { useEffect, useMemo, useRef, useState } from 'react'

const defaultPreferences = { textScale: 'normal', locale: 'en-US', density: 'comfortable', language: 'en', notificationSound: 'off' }
const assistModes = [
  ['search', 'Find records'], ['meeting', 'Meeting summary'], ['task', 'Task description'], ['status', 'Project status'],
  ['duplicates', 'Duplicate notes'], ['next', 'Suggested next action'], ['report', 'Report question'], ['article', 'Knowledge article draft'],
  ['email', 'Customer email draft'], ['risk', 'Risk summary'], ['workload', 'Workload balance'], ['missing', 'Missing fields'],
  ['thread', 'Long-thread summary'], ['document', 'Document key points'], ['category', 'Task category'], ['forecast', 'Forecast scenario'], ['automation', 'Automation outline'],
]

function localSuggestions(mode, input, backend = {}) {
  const text = input.trim()
  const customers = backend.customers || []
  const tasks = backend.tasks || []
  const quotes = backend.quotes || []
  const invoices = backend.invoices || []
  const appointments = backend.appointments || []
  const all = [...customers.map((item) => ({ ...item, _type: 'Customer' })), ...tasks.map((item) => ({ ...item, _type: 'Task' })), ...quotes.map((item) => ({ ...item, _type: 'Quote' })), ...invoices.map((item) => ({ ...item, _type: 'Invoice' })), ...appointments.map((item) => ({ ...item, _type: 'Appointment' }))]
  if (mode === 'search') {
    const terms = text.toLocaleLowerCase().split(/\s+/).filter(Boolean)
    return all.filter((record) => terms.some((term) => Object.values(record).some((value) => typeof value === 'string' && value.toLocaleLowerCase().includes(term)))).slice(0, 12).map((record) => `${record._type}: ${record.title || record.business_name || record.owner_name || record.email || record.id}`)
  }
  if (mode === 'duplicates') {
    const rows = [...tasks, ...(backend.notes || [])]
    const normalized = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
    const matches = rows.filter((item) => normalized(item.title || item.text || item.notes) && normalized(text).includes(normalized(item.title || item.text || item.notes)))
    return matches.length ? matches.slice(0, 8).map((item) => `Similar existing note/task: ${item.title || item.text || item.notes}`) : ['No exact or contained-text matches found in loaded local tasks/notes. This check does not use semantic AI.']
  }
  if (mode === 'status') return [`${tasks.filter((item) => !/done|complete|closed/i.test(item.status || '')).length} open tasks`, `${appointments.length} appointments`, `${quotes.filter((item) => /draft|sent/i.test(item.status || '')).length} active quotes`, `${invoices.filter((item) => !/paid|void/i.test(item.status || '')).length} unpaid/open invoices`, text ? `Context: ${text}` : 'Add a short project name or context for a focused status note.']
  if (mode === 'missing') {
    const fields = text.split(/[,\n]+/).map((field) => field.trim()).filter(Boolean)
    const likely = ['owner', 'due date', 'customer', 'status', 'next action']
    const missing = likely.filter((field) => !fields.some((entry) => entry.toLowerCase().includes(field)))
    return missing.length ? missing.map((field) => `Check whether ${field} is needed.`) : ['The supplied checklist includes owner, due date, customer, status, and next action. Review values for accuracy.']
  }
  if (mode === 'next') return [text ? `Confirm the outcome for “${text.slice(0, 100)}”, assign one responsible owner, set a due date, then record the next customer-safe action.` : 'Choose one overdue or unassigned task, assign an owner, and add a due date.', 'Review the suggestion before changing workspace records.']
  if (mode === 'category') {
    const lower = text.toLowerCase()
    const category = /invoice|payment|bill|expense/.test(lower) ? 'Finance' : /customer|call|email|support|follow/.test(lower) ? 'Customer follow-up' : /schedule|visit|appointment|meeting/.test(lower) ? 'Scheduling' : /quote|approve|review/.test(lower) ? 'Review and approval' : 'General operations'
    return [`Suggested category: ${category}`, 'This is a local keyword rule. Change the category if it is wrong.']
  }
  if (mode === 'workload') {
    const counts = tasks.reduce((result, task) => { const owner = task.assigned_to || task.owner || 'Unassigned'; result[owner] = (result[owner] || 0) + 1; return result }, {})
    const max = Math.max(0, ...Object.values(counts))
    const min = Math.min(max, ...Object.values(counts))
    return Object.keys(counts).length ? [`Task counts by owner: ${Object.entries(counts).map(([owner, count]) => `${owner} ${count}`).join('; ')}`, max - min > 3 ? 'Consider reviewing assignments; the count spread is over three tasks.' : 'No large task-count imbalance detected. Complexity and working hours are not modeled.'] : ['No tasks with owner information are loaded.']
  }
  if (mode === 'report') return [`Local counts: ${customers.length} customers, ${tasks.length} tasks, ${appointments.length} appointments, ${quotes.length} quotes, ${invoices.length} invoices.`, `Suggested chart: ${text || 'open versus completed tasks'} grouped by status.`, 'No chart is generated or data sent to a provider; use Reports to filter and export records.']
  if (mode === 'forecast') {
    const amount = Number(text.match(/(?:amount|value|target)\s*[:=]?\s*\$?([\d,]+(?:\.\d{1,2})?)/i)?.[1]?.replaceAll(',', ''))
    const probability = Number(text.match(/(?:probability|chance|confidence)\s*[:=]?\s*(\d{1,3})\s*%?/i)?.[1])
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(probability) || probability < 0 || probability > 100) return ['Enter verified assumptions in this format: amount=25000, probability=60%.', `This workspace currently has ${quotes.length} quotes and ${invoices.length} invoices; these counts are context only and are not treated as revenue.`, 'Scenario math is amount × probability. It is not accounting advice or a prediction.']
    const weighted = amount * probability / 100
    return [`Base amount: ${amount.toLocaleString()} at ${probability}% probability.`, `Weighted scenario: ${weighted.toLocaleString()}.`, `Range for this single opportunity: 0 to ${amount.toLocaleString()}.`, 'This transparent scenario uses only the assumptions you supplied; it is not a prediction, booked revenue, or accounting advice.']
  }
  if (mode === 'automation') return ['Trigger: when a task is marked due or overdue.', 'Condition: task has a customer and assigned owner.', 'Action: queue a review reminder; do not send messages or change billing automatically.', `Context: ${text || 'add the workflow you want to describe'}`, 'Confirm the workflow and permissions before configuring it.']
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  const clean = sentences.map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean)
  if (mode === 'task') return [text ? `Next action: ${text}` : 'Describe the next concrete action.', 'Suggested fields: responsible owner, customer (if needed), due date, and completion check.']
  if (mode === 'meeting' || mode === 'thread') return clean.length ? clean.slice(0, 6).map((line) => line.length > 220 ? `${line.slice(0, 217)}…` : line) : ['Paste meeting or thread notes to create a short extractive summary.']
  if (mode === 'article') return [`Draft title: ${text.split(/[.!?\n]/)[0]?.slice(0, 80) || 'Help topic'}`, 'Purpose: explain the task and when to use it.', `Draft source notes: ${text || '[add approved internal notes]'}`, 'Steps: verify the record; complete the action; confirm the result.', 'Review for accuracy and remove sensitive customer details before publishing.']
  if (mode === 'email') return [`Subject: Follow-up${text ? ` — ${text.slice(0, 60)}` : ''}`, 'Hello,', text || '[add the reviewed customer-safe update]', 'Please let us know if anything needs correction.', 'Regards,', '[Your name]', 'Review names, facts, privacy, and tone before sending.']
  if (mode === 'risk') return [text ? `Items to review from the supplied note: ${text}` : 'Add an observed issue or risk signal.', 'Check severity, affected customer/work, owner, containment, and next review time.', 'This helper does not infer fraud or make compliance decisions.']
  if (mode === 'document') return clean.length ? clean.slice(0, 8).map((line) => `Key point: ${line}`) : ['Paste document text to extract the opening sentences as review points. No file is uploaded.']
  return ['Enter notes to generate a local draft.']
}

export function FeatureWavePreferences({ session, backendState, setOperationNotice, operationNotice }) {
  const [prefs, setPrefs] = useState({ ...defaultPreferences, notificationDigest: true, renewalReminder: true })
  const [ready, setReady] = useState(false)
  const [tour, setTour] = useState(0)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let active = true
    window.overheadBackend?.listFeatureRecords?.('accessibility').then((records) => {
      if (!active) return
      const saved = records.find((record) => record.id === 'preferences')
      if (saved) setPrefs((current) => ({ ...current, ...saved.preferences }))
      setReady(true)
    }).catch((error) => { if (active) { setReady(true); setOperationNotice?.(`Accessibility preferences are device-local until the encrypted workspace is available: ${error.message}`) } })
    return () => { active = false }
  }, [setOperationNotice])
  useEffect(() => {
    document.documentElement.dataset.textScale = prefs.textScale
    document.documentElement.dataset.density = prefs.density
    document.documentElement.lang = prefs.language
    return () => { delete document.documentElement.dataset.textScale; delete document.documentElement.dataset.density }
  }, [prefs])
  async function update(key, value) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    try {
      setSaving(true)
      await window.overheadBackend?.upsertFeatureRecord?.({ collection: 'accessibility', record: { id: 'preferences', preferences: next, updated_by: session.email } })
    } catch (error) { setOperationNotice?.(`Preference changed for this session but could not be saved: ${error.message}`) }
    finally { setSaving(false) }
  }
  function previewSound() {
    if (prefs.notificationSound === 'off') return
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      const context = new AudioContextClass()
      const oscillator = context.createOscillator(); const gain = context.createGain()
      oscillator.frequency.value = prefs.notificationSound === 'soft' ? 520 : 780
      gain.gain.value = 0.035; oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.12)
      oscillator.onended = () => context.close()
    } catch { setOperationNotice?.('Audio preview is unavailable in this environment.') }
  }
  const lastNotice = useMemo(() => ({ value: operationNotice || '' }), [])
  useEffect(() => {
    if (!operationNotice || operationNotice === lastNotice.value) return
    lastNotice.value = operationNotice
    if (prefs.notificationSound === 'off') return
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      const context = new AudioContextClass()
      const oscillator = context.createOscillator(); const gain = context.createGain()
      oscillator.frequency.value = prefs.notificationSound === 'soft' ? 520 : 780
      gain.gain.value = 0.025; oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.12)
      oscillator.onended = () => context.close()
    } catch { /* Audio is optional; the notice remains visible. */ }
  }, [operationNotice, prefs.notificationSound, lastNotice])
  const dateExample = useMemo(() => new Intl.DateTimeFormat(prefs.locale, { dateStyle: 'long' }).format(new Date()), [prefs.locale])
  const numberExample = useMemo(() => new Intl.NumberFormat(prefs.locale, { style: 'currency', currency: prefs.locale === 'de-DE' ? 'EUR' : prefs.locale === 'en-GB' ? 'GBP' : 'USD' }).format(1234.5), [prefs.locale])
  const trialEndValue = backendState?.entitlements?.subscription?.trial_ends_at || ''
  const trialEndTime = Date.parse(trialEndValue)
  const trialDaysRemaining = Number.isFinite(trialEndTime) ? Math.ceil((trialEndTime - Date.now()) / 86400000) : null
  const tourSteps = ['Dashboard: review priorities and choose one next action.', 'Workflows: create appointments, quotes, invoices, and reminders.', 'Customers: keep only the minimum information needed for service.', 'Security: review access, privacy requests, and recovery.', 'Settings: choose display preferences and create local backups.']
  return <div className="feature-wave-preferences">
    <div className="backend-health">
      <strong>Display and regional preferences</strong>
      <label>Text size<select value={prefs.textScale} onChange={(event) => update('textScale', event.target.value)}><option value="normal">Standard</option><option value="large">Large</option><option value="larger">Extra large</option></select></label>
      <label>Date and number region<select value={prefs.locale} onChange={(event) => update('locale', event.target.value)}><option value="en-US">United States (MM/DD, USD)</option><option value="en-GB">United Kingdom (DD/MM, GBP)</option><option value="de-DE">Germany (DD.MM, EUR)</option><option value="fr-FR">France (DD/MM, EUR)</option></select></label>
      <label>Layout density<select value={prefs.density} onChange={(event) => update('density', event.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
      <label>Interface language<select value={prefs.language} onChange={(event) => update('language', event.target.value)}><option value="en">English</option></select></label>
      <small>Language selection currently offers English only; full translations are not included. Examples: {dateExample}; {numberExample}. {ready ? saving ? 'Saving…' : 'Saved in this workspace.' : 'Loading saved preferences…'}</small>
      <label className="checkbox-line"><input type="checkbox" checked={prefs.notificationDigest} onChange={(event) => update('notificationDigest', event.target.checked)} /><span>Workspace activity reminders</span></label>
      <label className="checkbox-line"><input type="checkbox" checked={prefs.renewalReminder} onChange={(event) => update('renewalReminder', event.target.checked)} /><span>Renewal/trial reminder preference</span></label>
      {prefs.renewalReminder && trialDaysRemaining !== null && trialDaysRemaining >= 0 && trialDaysRemaining <= 30 && <p role="status"><strong>Trial ending soon:</strong> {new Intl.DateTimeFormat(prefs.locale, { dateStyle: 'long' }).format(new Date(trialEndTime))} ({trialDaysRemaining === 0 ? 'today' : `in ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'}`}). Review Plans and billing before then.</p>}
      <small>When an active trial ends within 30 days, this reminder appears while you are in Settings. No background push, email, or paid-plan renewal date is scheduled here.</small>
      <div><strong>Seat utilization</strong><p>{(backendState?.licenses || []).filter((license) => license.status === 'Active').length} active licenses · {(backendState?.userProfiles || []).filter((user) => user.status === 'Active').length} active profiles</p><small>Counts reflect local workspace records; plan seat limits and remote membership may differ.</small></div>
      <label>Notification sound<select value={prefs.notificationSound} onChange={(event) => update('notificationSound', event.target.value)}><option value="off">Off</option><option value="soft">Soft tone</option><option value="bright">Bright tone</option></select></label>
      <button className="mini-button" type="button" onClick={previewSound}>Preview sound</button>
      <small>Sound is an optional local preview; message alerts are not sent or generated by this preference.</small>
    </div>
    <div className="backend-health">
      <strong>Guided feature tour</strong>
      <p>Walk through the dashboard, workflows, customer records, security, and settings.</p>
      <button className="ghost-button" type="button" onClick={() => setTour((current) => current ? 0 : 1)}>{tour ? 'Close tour' : 'Start guided tour'}</button>
      {tour > 0 && <div role="dialog" aria-label="Guided feature tour"><p><strong>Step {tour} of {tourSteps.length}</strong> — {tourSteps[tour - 1]}</p><div className="button-row"><button className="mini-button" type="button" disabled={tour <= 1} onClick={() => setTour((current) => current - 1)}>Previous</button><button className="mini-button" type="button" onClick={() => setTour((current) => current >= tourSteps.length ? 0 : current + 1)}>{tour >= tourSteps.length ? 'Finish' : 'Next'}</button></div></div>}
    </div>
  </div>
}

export function FieldAssistSection({ backendState, session, setOperationNotice }) {
  const [assistEnabled, setAssistEnabled] = useState(false)
  const [assistSettings, setAssistSettings] = useState({ id: 'controls', enabled: false })
  const [mode, setMode] = useState('search')
  const [input, setInput] = useState('')
  const [results, setResults] = useState([])
  const [history, setHistory] = useState([])
  const [fieldDraft, setFieldDraft] = useState({ title: '', note: '', customerId: '', minutes: '', checklist: '' })
  const [mobileRecords, setMobileRecords] = useState([])
  const [undoChecklist, setUndoChecklist] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    Promise.all([window.overheadBackend?.listFeatureRecords?.('ai_knowledge') || [], window.overheadBackend?.listFeatureRecords?.('mobile') || []]).then(([ai, mobile]) => {
      if (!active) return
      const controls = ai.find((record) => record.id === 'controls')
      setAssistSettings(controls || { id: 'controls', enabled: false }); setAssistEnabled(Boolean(controls?.enabled))
      setHistory(ai.filter((record) => record.id !== 'controls' && record.kind === 'review'))
      setMobileRecords(mobile)
    }).catch((reason) => { if (active) setError(`Encrypted local tools are unavailable: ${reason.message}`) })
    return () => { active = false }
  }, [])
  const suggestions = useMemo(() => results, [results])
  async function saveAssistControl(enabled) {
    setAssistEnabled(enabled); setAssistSettings((current) => ({ ...current, enabled }))
    try { await window.overheadBackend?.upsertFeatureRecord?.({ collection: 'ai_knowledge', record: { ...assistSettings, id: 'controls', enabled, updated_by: session.email, mode: 'local_only' } }) }
    catch (reason) { setError(reason.message); setAssistEnabled(!enabled) }
  }
  function generate() {
    if (!assistEnabled) { setError('Enable local suggestions first.'); return }
    const output = localSuggestions(mode, input, backendState)
    setResults(output); setError('')
  }
  async function saveReview() {
    const record = { kind: 'review', mode, prompt: input.slice(0, 2000), suggestion: results.join('\n').slice(0, 5000), reviewed_by: session.email, disposition: 'Reviewed' }
    try {
      const saved = await window.overheadBackend?.upsertFeatureRecord?.({ collection: 'ai_knowledge', record })
      setHistory((current) => [saved || { ...record, id: `review-${Date.now()}`, created_at: new Date().toISOString() }, ...current])
      setOperationNotice('Local suggestion review recorded. No provider was contacted.')
    } catch (reason) { setError(reason.message) }
  }
  async function captureFieldNote() {
    if (!fieldDraft.title.trim() && !fieldDraft.note.trim()) { setError('Add a short visit title or note before saving.'); return }
    const record = { title: fieldDraft.title.trim() || 'Field visit', note: fieldDraft.note.trim(), customer_id: fieldDraft.customerId, minutes: Math.max(0, Number(fieldDraft.minutes) || 0), checklist: fieldDraft.checklist.split(/\n|,/).map((item) => item.trim()).filter(Boolean).slice(0, 20).map((label) => ({ label, done: false })), captured_at: new Date().toISOString(), captured_by: session.email, sync_status: 'Saved on this device' }
    try {
      const saved = await window.overheadBackend?.upsertFeatureRecord?.({ collection: 'mobile', record })
      setMobileRecords((current) => [saved || record, ...current]); setFieldDraft({ title: '', note: '', customerId: '', minutes: '', checklist: '' }); setError('')
      setOperationNotice('Field note saved in the encrypted local workspace.')
    } catch (reason) { setError(reason.message) }
  }
  async function updateChecklist(record, item, done) {
    const before = record.checklist || []
    const after = before.map((check) => check.label === item.label ? { ...check, done } : check)
    const next = { ...record, checklist: after }
    try {
      await window.overheadBackend?.upsertFeatureRecord?.({ collection: 'mobile', record: next })
      setUndoChecklist({ recordId: record.id, checklist: before })
      setMobileRecords((current) => current.map((saved) => saved.id === record.id ? next : saved))
      setError('')
    } catch (reason) { setError(`Checklist update failed: ${reason.message}`) }
  }
  async function undoChecklistChange() {
    if (!undoChecklist) return
    const record = mobileRecords.find((item) => item.id === undoChecklist.recordId)
    if (!record) return setUndoChecklist(null)
    const next = { ...record, checklist: undoChecklist.checklist }
    try {
      await window.overheadBackend?.upsertFeatureRecord?.({ collection: 'mobile', record: next })
      setMobileRecords((current) => current.map((saved) => saved.id === record.id ? next : saved))
      setUndoChecklist(null); setOperationNotice('Last field checklist change was undone.')
    } catch (reason) { setError(`Could not undo checklist change: ${reason.message}`) }
  }
  const selectedCustomer = (backendState.customers || []).find((customer) => customer.id === fieldDraft.customerId)
  return <section className="panel page-panel feature-wave-section">
    <div className="section-head"><div><p className="eyebrow">Field work · private local assist</p><h2>Mobile capture and reviewable suggestions</h2></div></div>
    <div className="feature-wave-grid">
      <div className="backend-health field-capture">
        <strong>Field visit and offline capture</strong>
        <p>Text and checklists are saved to the encrypted local workspace. When offline, capture stays on this device until OverHead can reach its local store. No location is collected automatically.</p>
        <LocalAudioNoteRecorder />
        <label>Visit title<input value={fieldDraft.title} onChange={(event) => setFieldDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Site visit" /></label>
        <label>Customer<select value={fieldDraft.customerId} onChange={(event) => setFieldDraft((current) => ({ ...current, customerId: event.target.value }))}><option value="">No customer selected</option>{(backendState.customers || []).map((customer) => <option key={customer.id} value={customer.id}>{customer.business_name || customer.owner_name || customer.email}</option>)}</select></label>
        {selectedCustomer?.phone && <a href={`tel:${selectedCustomer.phone}`}>Call {selectedCustomer.phone}</a>}
        {selectedCustomer?.service_area && <a href={`https://maps.google.com/?q=${encodeURIComponent(selectedCustomer.service_area)}`} target="_blank" rel="noreferrer">Directions to service area</a>}
        <label>Visit note<textarea value={fieldDraft.note} onChange={(event) => setFieldDraft((current) => ({ ...current, note: event.target.value }))} rows="3" placeholder="Record only the service details needed." /></label>
        <label>Time spent (minutes)<input type="number" min="0" max="1440" value={fieldDraft.minutes} onChange={(event) => setFieldDraft((current) => ({ ...current, minutes: event.target.value }))} /></label>
        <label>Visit checklist (one step per line)<textarea value={fieldDraft.checklist} onChange={(event) => setFieldDraft((current) => ({ ...current, checklist: event.target.value }))} rows="3" placeholder="Confirm arrival\nReview requested work\nAgree on next step" /></label>
        <button className="mini-button" type="button" onClick={() => setFieldDraft((current) => ({ ...current, checklist: 'Review site access and hazards\nConfirm required protective equipment\nKeep customer and staff clear of active work area\nRecord any incident and notify the responsible manager' }))}>Use worksite safety checklist</button>
        <button className="primary-action" type="button" onClick={captureFieldNote}>Save field note</button>
        {undoChecklist && <button className="mini-button" type="button" onClick={undoChecklistChange}>Undo last checklist change</button>}
        {mobileRecords.slice(0, 4).map((record) => <article key={record.id}><strong>{record.title}</strong><p>{record.note}</p><small>{record.minutes || 0} minutes · {record.sync_status || 'Saved locally'} · {new Date(record.captured_at || record.created_at).toLocaleString()}</small>{record.checklist?.map((item) => <label className="checkbox-line" key={item.label}><input type="checkbox" checked={item.done} onChange={(event) => updateChecklist(record, item, event.target.checked)} /><span>{item.label}</span></label>)}</article>)}
        <small>Voice notes, photo/signature capture, barcode scanning, native home-screen widgets and push notifications require platform permissions and signed native integrations; none are simulated here.</small>
      </div>
      <div className="backend-health local-assist">
        <strong>Local/offline suggestion controls</strong>
        <p>These are deterministic, rule-based extracts over the records already loaded on this device. No external AI service is configured, and nothing is sent to a provider.</p>
        <label className="checkbox-line"><input type="checkbox" checked={assistEnabled} disabled={session.role !== 'Owner'} onChange={(event) => saveAssistControl(event.target.checked)} /><span><strong>Enable local suggestions for this workspace</strong><small>{session.role === 'Owner' ? 'Default off. Suggestions may be incomplete; review before acting.' : 'An Owner controls the workspace opt-in. Suggestions use no external provider.'}</small></span></label>
        <label>Tool<select value={mode} onChange={(event) => setMode(event.target.value)}>{assistModes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label>Prompt or source notes<textarea value={input} onChange={(event) => setInput(event.target.value)} rows="4" placeholder="Paste only the information needed for the draft." /></label>
        <button className="ghost-button" type="button" disabled={!assistEnabled} onClick={generate}>Create local suggestion</button>
        {suggestions.length > 0 && <div className="feature-suggestion" aria-live="polite"><ol>{suggestions.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ol><button className="mini-button" type="button" onClick={saveReview}>Record review</button></div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div><strong>Suggestion review history ({history.length})</strong>{history.slice(0, 5).map((item) => <p key={item.id}>{item.mode} · {item.disposition} · {new Date(item.created_at || item.updated_at).toLocaleString()}</p>)}{!history.length && <small>Reviewed suggestions are recorded only after you choose “Record review.”</small>}</div>
      </div>
    </div>
  </section>
}

function LocalAudioNoteRecorder() {
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const chunksRef = useRef([])
  const byteCountRef = useRef(0)
  const [title, setTitle] = useState('Field audio note')
  const [recording, setRecording] = useState(false)
  const [recordedUrl, setRecordedUrl] = useState('')
  const [recordedType, setRecordedType] = useState('audio/webm')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => () => {
    clearInterval(timerRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
  }, [recordedUrl])
  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Audio recording is not supported in this environment.'); return }
    try {
      setError('')
      if (recordedUrl) URL.revokeObjectURL(recordedUrl)
      setRecordedUrl(''); setDuration(0); chunksRef.current = []; byteCountRef.current = 0
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const preferredType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (!event.data?.size) return
        byteCountRef.current += event.data.size
        if (byteCountRef.current > 50 * 1024 * 1024) { setError('Recording stopped at the 50 MB local file limit.'); recorder.stop(); return }
        chunksRef.current.push(event.data)
      }
      recorder.onerror = () => setError('The browser could not capture audio. Check microphone permissions and try again.')
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size) { setRecordedType(blob.type || 'audio/webm'); setRecordedUrl(URL.createObjectURL(blob)) }
        stream.getTracks().forEach((track) => track.stop()); streamRef.current = null
        clearInterval(timerRef.current); setRecording(false)
      }
      recorder.start(1000); setRecording(true)
      timerRef.current = setInterval(() => setDuration((seconds) => { if (seconds >= 599) { recorder.stop(); return 600 } return seconds + 1 }), 1000)
    } catch (reason) {
      streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null
      setRecording(false); setError(reason.name === 'NotAllowedError' ? 'Microphone access was declined. Allow it only if you want to record a note.' : `Could not start audio recording: ${reason.message}`)
    }
  }
  function stopRecording() { if (recorderRef.current?.state === 'recording') recorderRef.current.stop() }
  function clearRecording() { if (recordedUrl) URL.revokeObjectURL(recordedUrl); setRecordedUrl(''); setDuration(0); chunksRef.current = [] }
  const extension = recordedType.includes('ogg') ? 'ogg' : recordedType.includes('mp4') ? 'm4a' : 'webm'
  const fileTitle = (title.trim() || 'audio-note').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'audio-note'
  return <div className="backend-health local-audio-note"><strong>Local audio note</strong><p>Recording begins only when you select Start. Audio stays in memory until you download or clear it; maximum 10 minutes or 50 MB.</p><label>Note title<input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} disabled={recording} /></label><div className="button-row">{recording ? <button className="mini-button" type="button" onClick={stopRecording}>Stop recording ({Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')})</button> : <button className="mini-button" type="button" onClick={startRecording}>Start audio recording</button>}{recordedUrl && <button className="mini-button" type="button" onClick={clearRecording}>Clear recording</button>}</div>{recordedUrl && <><audio controls src={recordedUrl}>Audio playback is unavailable.</audio><a className="ghost-button" href={recordedUrl} download={`${fileTitle}.${extension}`}>Download audio note</a></>}{error && <small className="form-error" role="alert">{error}</small>}</div>
}

export function SupportOperationsPanel({ tickets = [], users = [], session, setOperationNotice }) {
  const [records, setRecords] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [feedback, setFeedback] = useState(5)
  const [outageNotice, setOutageNotice] = useState('')
  const [routingTarget, setRoutingTarget] = useState('Support lead')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    window.overheadBackend?.listFeatureRecords?.('support').then((rows) => { if (active) setRecords(rows) }).catch((reason) => { if (active) setError(reason.message) })
    return () => { active = false }
  }, [])
  const ticket = tickets.find((item) => item.id === selectedId) || tickets[0]
  const metadata = records.find((item) => item.ticket_id === ticket?.id) || {}
  const category = metadata.category || 'General inquiry'
  const firstResponseAt = metadata.first_response_at || ''
  const priorities = { Low: 72, Normal: 24, High: 8, Urgent: 2 }
  const slaDeadline = ticket?.created_at ? new Date(new Date(ticket.created_at).getTime() + (priorities[ticket.priority] || 24) * 3600000) : null
  const roundRobin = users.filter((user) => ['Owner', 'Support', 'Bookkeeper'].includes(user.role) && user.status === 'Active')
  async function saveMeta(patch) {
    if (!ticket?.id) return
    const next = { ...metadata, ticket_id: ticket.id, category, ...patch, updated_by: session.email }
    try {
      const saved = await window.overheadBackend?.upsertFeatureRecord?.({ collection: 'support', record: next })
      setRecords((current) => [saved || next, ...current.filter((item) => item.ticket_id !== ticket.id)])
      setError('')
    } catch (reason) { setError(reason.message) }
  }
  async function addInternalNote() {
    if (!internalNote.trim()) return
    const note = { text: internalNote.trim(), author: session.email, created_at: new Date().toISOString() }
    await saveMeta({ internal_notes: [...(metadata.internal_notes || []), note] })
    setInternalNote('')
  }
  async function convertToProject() {
    if (!ticket || !['Owner', 'Front Desk', 'Bookkeeper'].includes(session.role)) return setError('Your role cannot create project records from support tickets.')
    try {
      await window.overheadBackend?.upsertFeatureRecord?.({ collection: 'projects', record: { title: `Support: ${ticket.subject || 'Customer request'}`, status: 'Planning', description: ticket.details || '', source_ticket_id: ticket.id, owner: metadata.assignee || session.email } })
      await saveMeta({ converted_to_project: true })
      setOperationNotice?.('Support request copied to a local project record for follow-up.')
    } catch (reason) { setError(reason.message) }
  }
  async function publishOutageNotice() {
    if (!outageNotice.trim()) return
    try {
      const saved = await window.overheadBackend?.upsertFeatureRecord?.({ collection: 'support', record: { id: 'service-outage-notice', type: 'outage_notice', body: outageNotice.trim(), status: 'Draft', updated_by: session.email } })
      setRecords((current) => [saved || { id: 'service-outage-notice', type: 'outage_notice', body: outageNotice.trim(), status: 'Draft' }, ...current.filter((item) => item.id !== 'service-outage-notice')])
      setOutageNotice(''); setOperationNotice?.('Outage notice saved as a local draft. Publishing externally requires a configured service channel.')
    } catch (reason) { setError(reason.message) }
  }
  async function advanceRoundRobin() {
    if (!roundRobin.length || !ticket) return setError('No active Owner/Support assignee is available.')
    const currentIndex = roundRobin.findIndex((user) => user.email === metadata.assignee)
    await saveMeta({ assignee: roundRobin[(currentIndex + 1) % roundRobin.length].email })
  }
  async function recordFirstResponse() {
    if (firstResponseAt) return
    await saveMeta({ first_response_at: new Date().toISOString(), first_response_by: session.email })
  }
  const workload = roundRobin.map((user) => ({ email: user.email, count: records.filter((record) => record.assignee === user.email && !record.closed_at).length }))
  const macros = ['Thanks for the details. We will review the affected workflow and follow up with the next safe step.', 'We need one more detail to investigate: what did you expect to happen, and what happened instead?', 'This request is resolved. Please reply if the issue returns; we can reopen the record for review.']
  const [macroIndex, setMacroIndex] = useState(0)
  return <section className="backend-health support-operations">
    <strong>Support operations</strong>
    <div className="support-ops-grid">
      <div>
        <label>Ticket<select value={ticket?.id || ''} onChange={(event) => setSelectedId(event.target.value)}><option value="">Select a ticket</option>{tickets.map((item) => <option key={item.id} value={item.id}>{item.subject || item.id} · {item.status || 'Open'}</option>)}</select></label>
        {ticket ? <>
          <p><strong>{ticket.subject || 'Support request'}</strong> · {ticket.priority || 'Normal'} · {ticket.status || 'Open'}</p>
          <label>Category<select value={category} onChange={(event) => saveMeta({ category: event.target.value })}>{['General inquiry', 'Account access', 'Billing', 'Bug report', 'Data and privacy', 'Feature request', 'Service outage'].map((item) => <option key={item}>{item}</option>)}</select></label>
          <p>First-response target: {slaDeadline ? slaDeadline.toLocaleString() : 'Waiting for ticket timestamp'} · {slaDeadline && slaDeadline < new Date() ? 'Target elapsed — review for escalation.' : 'Target window active.'}</p>
          <p>First response: {firstResponseAt ? `${new Date(firstResponseAt).toLocaleString()} by ${metadata.first_response_by || 'staff'}` : 'Not recorded'}</p>
          {!firstResponseAt && <button className="mini-button" type="button" onClick={recordFirstResponse}>Record first response now</button>}
          <label>Escalation path<select value={metadata.escalation_path || 'support_lead'} onChange={(event) => saveMeta({ escalation_path: event.target.value })}><option value="support_lead">Support lead review</option><option value="workspace_owner">Workspace Owner review</option><option value="billing_owner">Billing owner review</option><option value="privacy_lead">Privacy/security owner review</option></select></label>
          <label>Assign support owner<select value={metadata.assignee || ''} onChange={(event) => saveMeta({ assignee: event.target.value })}><option value="">Unassigned</option>{roundRobin.map((user) => <option key={user.email} value={user.email}>{user.owner_name || user.email}</option>)}</select></label>
          <div className="button-row"><button className="mini-button" type="button" onClick={advanceRoundRobin}>Assign next in rotation</button><button className="mini-button" type="button" onClick={convertToProject}>Create follow-up project</button></div>
          <label>Internal collaboration note<input value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Staff-only, non-sensitive handoff" /></label><button className="mini-button" type="button" onClick={addInternalNote}>Add internal note</button>
          {(metadata.internal_notes || []).slice(-3).map((note, index) => <small key={`${note.created_at}-${index}`}>{note.author}: {note.text}</small>)}
          <label>Customer satisfaction rating<select value={feedback} onChange={(event) => setFeedback(Number(event.target.value))}>{[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>{score} / 5</option>)}</select></label><button className="mini-button" type="button" onClick={() => saveMeta({ satisfaction: feedback })}>Record rating</button>
          <label>Closure checklist</label>{['Customer updated', 'Workaround or resolution recorded', 'No sensitive credentials in notes', 'Follow-up owner assigned'].map((item) => <label className="checkbox-line" key={item}><input type="checkbox" checked={(metadata.closure_checklist || []).includes(item)} onChange={(event) => saveMeta({ closure_checklist: event.target.checked ? [...(metadata.closure_checklist || []), item] : (metadata.closure_checklist || []).filter((value) => value !== item) })} /><span>{item}</span></label>)}
          <button className="mini-button" type="button" onClick={() => saveMeta({ reopened_at: new Date().toISOString(), closed_at: '' })}>Reopen ticket for review</button>
          <p>Related requests: {tickets.filter((other) => other.id !== ticket.id && (other.subject || '').toLowerCase().split(/\s+/).some((term) => term.length > 4 && (ticket.subject || '').toLowerCase().includes(term))).slice(0, 3).map((item) => item.subject).join(' · ') || 'No obvious subject matches'}</p>
          <p>Ticket timeline: created {ticket.created_at ? new Date(ticket.created_at).toLocaleString() : 'time unavailable'}; metadata updated {metadata.updated_at ? new Date(metadata.updated_at).toLocaleString() : 'not yet'}.</p>
          <label>Reply macro<select value={macroIndex} onChange={(event) => setMacroIndex(Number(event.target.value))}>{macros.map((macro, index) => <option key={macro} value={index}>Macro {index + 1}</option>)}</select></label><textarea readOnly value={macros[macroIndex]} rows="3" aria-label="Reviewable support reply macro" />
        </> : <p>Select a ticket to review its response target and private operations metadata.</p>}
      </div>
      <div>
        <strong>Workload at a glance</strong>{workload.map((row) => <p key={row.email}>{row.email}: {row.count} active assigned tickets</p>)}
        <strong>Response-time report</strong><p>{tickets.filter((item) => item.created_at).length} ticket timestamps available. Targets: urgent 2h, high 8h, normal 24h, low 72h. First-response durations use staff-recorded timestamps below and exclude tickets without a recorded response.</p>
        <p>Recorded first responses: {tickets.filter((item) => records.some((record) => record.ticket_id === item.id && record.first_response_at)).length} · average elapsed: {(() => { const durations = tickets.map((item) => { const response = records.find((record) => record.ticket_id === item.id)?.first_response_at; return item.created_at && response ? new Date(response) - new Date(item.created_at) : null }).filter((value) => Number.isFinite(value) && value >= 0); return durations.length ? `${Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length / 60000)} minutes (${durations.length} recorded)` : 'not enough recorded responses' })()}</p>
        <strong>Local support routing</strong><label>Route selected ticket to<select value={routingTarget} onChange={(event) => setRoutingTarget(event.target.value)}>{['Support lead', 'Workspace Owner', 'Billing owner', 'Privacy/security owner'].map((value) => <option key={value}>{value}</option>)}</select></label><button className="mini-button" type="button" onClick={() => { const role = routingTarget === 'Workspace Owner' ? 'Owner' : routingTarget === 'Billing owner' ? 'Bookkeeper' : routingTarget === 'Privacy/security owner' ? 'Owner' : 'Support'; const target = roundRobin.find((user) => user.role === role); if (!target) return setError(`No active ${role} profile is available for this route.`); saveMeta({ escalation_path: routingTarget.toLowerCase().replaceAll(' ', '_'), assignee: target.email, routed_at: new Date().toISOString() }) }}>Route selected ticket</button>
        <label>Help article feedback topic<input id="support-article-topic" placeholder="Article or FAQ title" /></label><label>Was it helpful?<select id="support-article-rating"><option>Yes</option><option>Partly</option><option>No</option></select></label><button className="mini-button" type="button" onClick={async () => { const topic = document.getElementById('support-article-topic')?.value.trim(); const helpful = document.getElementById('support-article-rating')?.value; if (!topic) return setError('Enter the article title first.'); try { const saved = await window.overheadBackend?.upsertFeatureRecord?.({ collection: 'support', record: { type: 'article_feedback', article: topic, helpful, created_by: session.email } }); setRecords((current) => [saved, ...current]); setOperationNotice?.('Help article feedback saved in the local support workspace.') } catch (reason) { setError(reason.message) } }}>Submit article feedback</button>
        <strong>Service outage notice draft</strong><textarea value={outageNotice} onChange={(event) => setOutageNotice(event.target.value)} rows="3" placeholder="Draft an incident update; do not include private customer details." /><button className="mini-button" type="button" onClick={publishOutageNotice}>Save draft locally</button>
        {records.filter((item) => item.type === 'outage_notice').map((item) => <p key={item.id}>Draft: {item.body}</p>)}
        <small>First-response reporting uses staff-recorded timestamps; email mailbox ingestion/forwarding are not available in this local-only view. Ticket macros are draft text only. Public notices require an approved publishing channel.</small>
      </div>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>
}

export function AccountGovernancePanel({ backendState, session, setOperationNotice }) {
  const [checklist, setChecklist] = useState([])
  const [loaded, setLoaded] = useState(false)
  const items = [
    'Export and verify a workspace archive before closure',
    'Review active staff seats and revoke access that is no longer needed',
    'Resolve invoices, refunds, or billing questions with the billing provider',
    'Review customer retention obligations and open privacy requests',
    'Confirm backup recovery and document the closure owner',
    'Submit a separate verified deletion request for records that may be removed',
  ]
  useEffect(() => {
    let active = true
    if (session.role !== 'Owner') { setLoaded(true); return undefined }
    window.overheadBackend?.listFeatureRecords?.('account').then((records) => {
      if (active) { const saved = records.find((record) => record.id === 'closure-checklist'); setChecklist(saved?.completed || []); setLoaded(true) }
    }).catch(() => { if (active) setLoaded(true) })
    return () => { active = false }
  }, [session.role])
  async function toggle(item, checked) {
    const next = checked ? [...new Set([...checklist, item])] : checklist.filter((entry) => entry !== item)
    setChecklist(next)
    try { await window.overheadBackend?.upsertFeatureRecord?.({ collection: 'account', record: { id: 'closure-checklist', completed: next, updated_by: session.email } }) }
    catch (error) { setOperationNotice?.(`Closure checklist changed on screen but could not be saved: ${error.message}`) }
  }
  return <section className="backend-health account-governance">
    <strong>Account closure checklist</strong>
    <p>This checklist prepares a deliberate closure request. It does not delete records, cancel a subscription, or transfer workspace ownership.</p>
    {items.map((item) => <label className="checkbox-line" key={item}><input type="checkbox" disabled={session.role !== 'Owner'} checked={checklist.includes(item)} onChange={(event) => toggle(item, event.target.checked)} /><span>{item}</span></label>)}
    <small>{loaded ? `${checklist.length} of ${items.length} steps recorded.` : 'Loading saved closure checklist…'} Only the Owner can update this record.</small>
    <div><strong>Seat utilization detail</strong>{(backendState.userProfiles || []).map((user) => <p key={user.id}>{user.role} · {user.status} · {user.email} · {user.status === 'Active' ? 'counts as active seat' : 'inactive seat'}</p>)}</div>
  </section>
}
