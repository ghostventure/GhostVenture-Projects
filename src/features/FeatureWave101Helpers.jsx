import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const emptyForm = {}
const featureCollectionByRecord = new WeakMap()
const cardMetadataFields = [
  { key: 'kindLabel', label: 'Type', value: (record) => record.kindLabel || record.kind },
  { key: 'category', label: 'Category', value: (record) => record.category },
  { key: 'owner', label: 'Owner', value: (record) => record.owner },
  { key: 'assignee', label: 'Assignee', value: (record) => record.assignee },
  { key: 'date', label: 'Date', value: (record) => record.date || record.dueDate || record.startAt || record.month },
  { key: 'status', label: 'Status', value: (record) => record.status },
  { key: 'details', label: 'Details', value: (record) => record.details },
  { key: 'notes', label: 'Notes', value: (record) => record.notes },
  { key: 'amount', label: 'Amount', value: (record) => record.amount === undefined ? '' : `${record.currency || 'USD'} ${Number(record.amount || 0).toFixed(2)}` },
  { key: 'updated', label: 'Last updated', value: (record) => record.updated_at ? new Date(record.updated_at).toLocaleString() : '' },
]

export function useFeatureRecords(collection) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!window.overheadBackend?.listFeatureRecords) {
      setError('Local workspace records are unavailable. Restart OverHead and try again.')
      setLoading(false)
      return []
    }
    try {
      const next = await window.overheadBackend.listFeatureRecords(collection)
      if (Array.isArray(next)) next.forEach((record) => featureCollectionByRecord.set(record, collection))
      setRecords(Array.isArray(next) ? next : [])
      setError('')
      setLoading(false)
      return next
    } catch (reason) {
      setError('Workspace records could not be loaded. Check your connection or workspace access, then refresh.')
      setLoading(false)
      return []
    }
  }, [collection])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const onBulkUpdate = (event) => { if (!event.detail?.collection || event.detail.collection === collection) refresh() }
    window.addEventListener('overhead:feature-records-updated', onBulkUpdate)
    return () => window.removeEventListener('overhead:feature-records-updated', onBulkUpdate)
  }, [refresh])

  const save = useCallback(async (record) => {
    const saved = await window.overheadBackend.upsertFeatureRecord({ collection, record })
    await refresh()
    return saved
  }, [collection, refresh])

  const remove = useCallback(async (recordId) => {
    const result = await window.overheadBackend.deleteFeatureRecord({ collection, recordId })
    await refresh()
    return result
  }, [collection, refresh])

  return { records, loading, error, setError, refresh, save, remove }
}

export function FeatureForm({ fields, initial = emptyForm, submitLabel = 'Save record', onSubmit, onCancel, draftScope = 'generic' }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((field) => [field.name, initial[field.name] ?? field.defaultValue ?? ''])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [draftStatus, setDraftStatus] = useState('saved')
  const [reviewChanges, setReviewChanges] = useState(null)
  const [errorDetail, setErrorDetail] = useState('')
  const [priorSuggestions, setPriorSuggestions] = useState(() => {
    try { const value = JSON.parse(window.localStorage.getItem(`overhead.formSuggestions.v1.${draftScope}`) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {} } catch { return {} }
  })
  const requiredFields = fields.filter((field) => field.required)
  const requiredComplete = requiredFields.filter((field) => String(values[field.name] ?? '').trim()).length
  const skipDraftWrite = useRef(false)
  const hydratedDraftKey = useRef('')
  const pendingHydration = useRef(true)
  const draftKey = `overhead.formDraft.v1.${draftScope}.${initial.id || 'new'}`
  const templateKey = `overhead.formTemplates.v1.${draftScope}`
  const [templates, setTemplates] = useState(() => { try { return JSON.parse(window.localStorage.getItem(templateKey) || '[]') } catch { return [] } })

  useEffect(() => {
    pendingHydration.current = true
    let saved = {}
    try { saved = JSON.parse(window.localStorage.getItem(draftKey) || '{}') } catch {}
    hydratedDraftKey.current = draftKey
    setValues(Object.fromEntries(fields.map((field) => [field.name, initial[field.name] ?? saved[field.name] ?? field.defaultValue ?? ''])))
    setError('')
    setErrorDetail('')
    setFieldErrors({})
    setReviewChanges(null)
    setDraftStatus('saved')
  }, [draftKey, fields, initial])

  useEffect(() => {
    if (initial.id) { setPriorSuggestions({}); return }
    try {
      const value = JSON.parse(window.localStorage.getItem(`overhead.formSuggestions.v1.${draftScope}`) || '{}')
      setPriorSuggestions(value && typeof value === 'object' && !Array.isArray(value) ? value : {})
    } catch { setPriorSuggestions({}) }
  }, [draftScope, initial.id])

  useEffect(() => {
    if (skipDraftWrite.current) { skipDraftWrite.current = false; return }
    if (pendingHydration.current || hydratedDraftKey.current !== draftKey) { pendingHydration.current = false; return }
    setDraftStatus('unsaved')
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(values))
      setDraftStatus('saved')
    } catch { setDraftStatus('unavailable') }
  }, [draftKey, values])

  function updateField(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => { if (!current[name]) return current; const next = { ...current }; delete next[name]; return next })
    setError('')
    setErrorDetail('')
    setReviewChanges(null)
  }

  function saveTemplate() {
    const name = window.prompt('Name this form template')?.trim()
    if (!name) return
    const next = [...templates.filter((item) => item.name !== name), { name, values }].slice(-12)
    setTemplates(next)
    window.localStorage.setItem(templateKey, JSON.stringify(next))
  }

  function applyPriorSuggestions() {
    setValues((current) => {
      const next = { ...current }
      for (const field of fields) {
        const suggestion = priorSuggestions[field.name]
        const currentValue = current[field.name]
        if (suggestion !== undefined && (currentValue === '' || currentValue === null || currentValue === undefined)) next[field.name] = suggestion
      }
      return next
    })
  }

  async function submit(event) {
    event.preventDefault()
    const validation = {}
    fields.forEach((field) => {
      if (field.required && !String(values[field.name] ?? '').trim()) validation[field.name] = `${field.label} is required.`
      else if (typeof field.validate === 'function') {
        const message = field.validate(values[field.name], values)
        if (message) validation[field.name] = message
      }
    })
    setFieldErrors(validation)
    if (Object.keys(validation).length) {
      setError('Review the highlighted fields before saving.')
      document.getElementById(`feature-field-${Object.keys(validation)[0]}`)?.focus()
      return
    }
    if (initial.id) {
      const changes = fields.filter((field) => JSON.stringify(initial[field.name] ?? '') !== JSON.stringify(values[field.name] ?? ''))
      if (changes.length) { setReviewChanges(changes); return }
    }
    await persist()
  }

  async function persist() {
    setSaving(true)
    try {
      await onSubmit(values)
      if (!initial.id) {
        const unsafeName = /email|phone|mobile|secret|token|password|address|account|contact|customer|client|name|note|description|message|consent|payment|card|tax|ssn|birth/i
        const suggestions = Object.fromEntries(fields
          .filter((field) => !field.sensitive && !unsafeName.test(`${field.name} ${field.label || ''}`) && !field.multiline && ['text', 'number', 'date', ''].includes(field.type || ''))
          .map((field) => [field.name, values[field.name]])
          .filter(([, value]) => value !== '' && value !== null && value !== undefined && String(value).length <= 120))
        try {
          window.localStorage.setItem(`overhead.formSuggestions.v1.${draftScope}`, JSON.stringify(suggestions))
          setPriorSuggestions(suggestions)
        } catch {}
      }
      setError('')
      setErrorDetail('')
      setFieldErrors({})
      setReviewChanges(null)
      window.localStorage.removeItem(draftKey)
      skipDraftWrite.current = true
      setValues(Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? ''])))
      setDraftStatus('saved')
    }
    catch (reason) {
      setError('Your changes could not be saved. Check your connection or workspace access, then try again.')
      setErrorDetail(reason?.message || String(reason || ''))
    }
    finally { setSaving(false) }
  }

  return <form className="profile-form compact-form" onSubmit={submit} style={{ display: 'grid', gap: 10, margin: '12px 0', padding: 12, border: '1px solid var(--line)', borderRadius: 7 }}>
    <p className="form-hint" aria-live="polite">{draftStatus === 'saved' ? 'Draft saved on this device.' : draftStatus === 'unsaved' ? 'Unsaved changes…' : 'Draft could not be saved on this device.'}</p>
    {requiredFields.length > 0 && <div className="form-hint"><label htmlFor={`feature-progress-${draftScope}`}>Required fields: {requiredComplete} of {requiredFields.length} complete</label><progress id={`feature-progress-${draftScope}`} max={requiredFields.length} value={requiredComplete} style={{ display: 'block', width: '100%', maxWidth: 360 }} /></div>}
    {!initial.id && Object.keys(priorSuggestions).some((key) => fields.some((field) => field.name === key)) && <details className="backend-health">
      <summary>Suggestions from your last saved {draftScope.replaceAll('_', ' ')} entry</summary>
      <p className="form-hint">Review these local suggestions. Applying fills empty fields only; you can edit them before saving.</p>
      <ul>{fields.filter((field) => priorSuggestions[field.name] !== undefined).map((field) => <li key={field.name}><strong>{field.label}:</strong> {String(priorSuggestions[field.name])}</li>)}</ul>
      <button className="ghost-button" type="button" onClick={applyPriorSuggestions}>Apply suggestions to empty fields</button>
    </details>}
    {templates.length > 0 && <label>Apply saved template<select value="" onChange={(event) => { const item = templates.find((entry) => entry.name === event.target.value); if (item) { setValues((current) => ({ ...current, ...item.values })); setReviewChanges(null) } }}><option value="">Choose a template</option>{templates.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>}
    {fields.map((field) => <label key={field.name} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      {field.label}{field.required ? <span className="feature-field-requirement is-required" style={{ color: 'var(--accent)', fontSize: '.78em', fontWeight: 700 }}> Required</span> : <span className="feature-field-requirement" style={{ color: 'var(--muted)', fontSize: '.78em' }}> Optional</span>}
      {field.options
        ? <select style={{ maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }} id={`feature-field-${field.name}`} aria-required={field.required || undefined} aria-invalid={fieldErrors[field.name] ? 'true' : undefined} aria-describedby={fieldErrors[field.name] ? `feature-error-${field.name}` : undefined} value={values[field.name]} onChange={(event) => updateField(field.name, event.target.value)}>
          {field.options.map((option) => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? option}</option>)}
        </select>
        : field.multiline
          ? <textarea style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }} id={`feature-field-${field.name}`} aria-required={field.required || undefined} aria-invalid={fieldErrors[field.name] ? 'true' : undefined} aria-describedby={fieldErrors[field.name] ? `feature-error-${field.name}` : undefined} rows="3" value={values[field.name]} maxLength={field.maxLength || 2000} onChange={(event) => updateField(field.name, event.target.value)} />
        : <input style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }} id={`feature-field-${field.name}`} aria-required={field.required || undefined} aria-invalid={fieldErrors[field.name] ? 'true' : undefined} aria-describedby={fieldErrors[field.name] ? `feature-error-${field.name}` : undefined} type={field.type || 'text'} min={field.min} max={field.max} step={field.step} value={values[field.name]} maxLength={field.maxLength || 200} onChange={(event) => updateField(field.name, event.target.value)} />}
      {field.help && <small className="form-hint">{field.help}</small>}
      {fieldErrors[field.name] && <small className="form-error" id={`feature-error-${field.name}`} role="alert">{fieldErrors[field.name]}</small>}
    </label>)}
    {error && <div className="form-error" role="alert"><p>{error}</p>{errorDetail && <details><summary>Technical details for support</summary><small>{errorDetail}</small></details>}</div>}
    {reviewChanges?.length > 0 && <section className="backend-health" aria-label="Review changes before saving">
      <strong>Review changes before saving</strong>
      <ul>{reviewChanges.slice(0, 5).map((field) => <li key={field.name}><strong>{field.label}:</strong> {String(initial[field.name] ?? '—') || '—'} → {String(values[field.name] ?? '—') || '—'}</li>)}</ul>
      {reviewChanges.length > 5 && <p>{reviewChanges.length - 5} additional changes</p>}
      <div className="button-row"><button className="primary-action" type="button" disabled={saving} onClick={persist}>{saving ? 'Saving…' : 'Confirm and save'}</button><button className="ghost-button" type="button" onClick={() => setReviewChanges(null)}>Back to editing</button></div>
    </section>}
    <div className="button-row">
      <button className="primary-action" type="submit" disabled={saving || Boolean(reviewChanges?.length)}>{saving ? 'Saving…' : submitLabel}</button>
      <button className="ghost-button" type="button" onClick={saveTemplate}>Save as template</button>
      {onCancel && <button className="ghost-button" type="button" onClick={onCancel}>Cancel</button>}
    </div>
  </form>
}

export function FeatureRecordList({ records, emptyText = 'No records yet.', onEdit, onDelete, onStatus, onAction, actionLabel, onInlineUpdate, onBulkStatus, viewScope = 'workspace', requiredFields = [] }) {
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState('recent')
  const [density, setDensity] = useState('comfortable')
  const [savedViews, setSavedViews] = useState(() => { try { const value = JSON.parse(window.localStorage.getItem(`overhead.savedViews.v1.${viewScope}`) || '[]'); return Array.isArray(value) ? value : [] } catch { return [] } })
  const [selectedView, setSelectedView] = useState('')
  const [visibleCardFields, setVisibleCardFields] = useState(null)
  const [selected, setSelected] = useState([])
  const [deletePreview, setDeletePreview] = useState(false)
  const [previewId, setPreviewId] = useState('')
  const [inlineId, setInlineId] = useState('')
  const [inlineTitle, setInlineTitle] = useState('')
  const [inlineReview, setInlineReview] = useState(null)
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkPreview, setBulkPreview] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [actionError, setActionError] = useState('')
  useEffect(() => {
    try {
      const preferences = JSON.parse(window.localStorage.getItem(`overhead.recordListPrefs.v1.${viewScope}`) || '{}')
      setSortMode(preferences.sortMode || 'recent')
      setDensity(preferences.density || 'comfortable')
      const views = JSON.parse(window.localStorage.getItem(`overhead.savedViews.v1.${viewScope}`) || '[]')
      setSavedViews(Array.isArray(views) ? views : [])
      const cardFields = JSON.parse(window.localStorage.getItem(`overhead.cardFields.v1.${viewScope}`) || 'null')
      setVisibleCardFields(Array.isArray(cardFields) ? cardFields.filter((key) => cardMetadataFields.some((field) => field.key === key)) : cardMetadataFields.map((field) => field.key))
    } catch {}
  }, [viewScope])
  const displayedCardFields = visibleCardFields || cardMetadataFields.map((field) => field.key)
  function toggleCardField(key, checked) {
    const next = checked ? [...new Set([...displayedCardFields, key])] : displayedCardFields.filter((field) => field !== key)
    setVisibleCardFields(next)
    try { window.localStorage.setItem(`overhead.cardFields.v1.${viewScope}`, JSON.stringify(next)) } catch {}
  }
  function persistListPreferences(next) {
    const preferences = { sortMode, density, ...next }
    setSortMode(preferences.sortMode)
    setDensity(preferences.density)
    try { window.localStorage.setItem(`overhead.recordListPrefs.v1.${viewScope}`, JSON.stringify(preferences)) } catch {}
  }
  function saveCurrentView() {
    const name = window.prompt('Name this saved view')?.trim()
    if (!name) return
    const next = [...savedViews.filter((item) => item.name !== name), { name, query, sortMode }].slice(-12)
    setSavedViews(next)
    setSelectedView(name)
    try { window.localStorage.setItem(`overhead.savedViews.v1.${viewScope}`, JSON.stringify(next)) } catch {}
  }
  function chooseView(name) {
    setSelectedView(name)
    const view = savedViews.find((item) => item.name === name)
    if (view) { setQuery(view.query || ''); persistListPreferences({ sortMode: view.sortMode || 'recent' }) }
  }
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return records.filter((record) => !needle || Object.values(record).some((value) => typeof value === 'string' && value.toLowerCase().includes(needle)))
      .slice().sort((a, b) => {
        if (sortMode === 'name') return String(a.title || a.name || a.subject || '').localeCompare(String(b.title || b.name || b.subject || ''))
        if (sortMode === 'status') return String(a.status || '').localeCompare(String(b.status || '')) || String(a.title || a.name || '').localeCompare(String(b.title || b.name || ''))
        return String(b.updated_at || b.updatedAt || b.created_at || b.createdAt || '').localeCompare(String(a.updated_at || a.updatedAt || a.created_at || a.createdAt || ''))
      })
  }, [records, query, sortMode])

  async function bulkDelete() {
    if (selected.length) setDeletePreview(true)
  }

  async function confirmBulkDelete() {
    const selectedRecords = selected.map((id) => records.find((record) => record.id === id)).filter(Boolean)
    for (const record of selectedRecords) await onDelete(record)
    setSelected([])
    setDeletePreview(false)
  }

  async function applyBulkStatus() {
    if (!bulkStatus || !selected.length) return
    const selectedRecords = selected.map((id) => records.find((record) => record.id === id)).filter(Boolean)
    try {
      if (onBulkStatus?.batch) await onBulkStatus.batch(selectedRecords, bulkStatus)
      else for (const record of selectedRecords) await onBulkStatus(record, bulkStatus)
      setSelected([]); setBulkStatus(''); setBulkPreview(false); setActionError('')
    } catch (reason) { setActionError(reason?.message || 'The selected records could not be updated.') }
  }

  async function confirmInlineUpdate() {
    if (!inlineReview) return
    try {
      await onInlineUpdate?.(inlineReview.record, { title: inlineReview.title })
      setInlineReview(null)
      setInlineId('')
      setActionError('')
    } catch (reason) { setActionError(reason?.message || 'The quick edit could not be saved.') }
  }

  function markViewed(record) {
    try {
      const current = JSON.parse(window.localStorage.getItem('overhead.recentRecords.v1') || '[]')
      const kind = record.kind || ''
      const item = { id: record.id, title: record.title || record.name || record.subject || 'Workspace record', kind, section: window.localStorage.getItem('overhead.lastSection.v1') || 'overview', viewedAt: Date.now() }
      window.localStorage.setItem('overhead.recentRecords.v1', JSON.stringify([item, ...current.filter((entry) => entry.id !== item.id || entry.kind !== item.kind)].slice(0, 12)))
      window.dispatchEvent(new Event('overhead:recent-records'))
    } catch {}
  }

  return <div className="task-list" style={{ display: 'grid', gap: 8 }}>
    {actionError && <p className="form-error" role="alert">{actionError}</p>}
    <div className="feature-list-tools" role="toolbar" aria-label="List view options" style={{ display: 'flex', alignItems: 'end', flexWrap: 'wrap', gap: 8 }}>
      {records.length > 0 && <label className="feature-search">Search records<input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedView('') }} placeholder="Search this list" /></label>}
      <label>Sort by<select value={sortMode} onChange={(event) => persistListPreferences({ sortMode: event.target.value })}><option value="recent">Recently updated</option><option value="name">Name</option><option value="status">Status</option></select></label>
      <label>Display<select value={density} onChange={(event) => persistListPreferences({ density: event.target.value })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
      <label>Saved views<select value={selectedView} onChange={(event) => chooseView(event.target.value)}><option value="">Choose a view</option>{savedViews.map((view) => <option key={view.name} value={view.name}>{view.name}</option>)}</select></label>
      <details><summary>Card fields</summary><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6, padding: 8 }}>{cardMetadataFields.map((field) => <label key={field.key}><input type="checkbox" checked={displayedCardFields.includes(field.key)} onChange={(event) => toggleCardField(field.key, event.target.checked)} /> {field.label}</label>)}</div><small>Preferences are saved on this device for this record type. Titles and actions always remain visible.</small></details>
      <button className="ghost-button" type="button" onClick={saveCurrentView}>Save current view</button>
      {selectedView && <button className="text-button" type="button" onClick={() => { const next = savedViews.filter((view) => view.name !== selectedView); setSavedViews(next); setSelectedView(''); try { window.localStorage.setItem(`overhead.savedViews.v1.${viewScope}`, JSON.stringify(next)) } catch {} }}>Delete view</button>}
    </div>
    {visible.length > 0 && <button className="text-button" type="button" onClick={() => setSelected((current) => current.length === visible.length && visible.every((record) => current.includes(record.id)) ? [] : visible.map((record) => record.id))}>{visible.every((record) => selected.includes(record.id)) ? 'Clear matching selection' : `Select all ${visible.length} matching records`}</button>}
    {selected.length > 0 && <div className="button-row" role="toolbar" aria-label="Selected record actions"><span>{selected.length} selected</span><button className="ghost-button" type="button" disabled={selected.length < 2} onClick={() => setCompareOpen((open) => !open)}>Compare records</button>{onBulkStatus && <><select aria-label="Set selected records status" value={bulkStatus} onChange={(event) => { setBulkStatus(event.target.value); setBulkPreview(false) }}><option value="">Choose status</option>{onBulkStatus.options.map((status) => <option key={status}>{status}</option>)}</select><button className="ghost-button" type="button" disabled={!bulkStatus} onClick={() => setBulkPreview((open) => !open)}>{bulkPreview ? 'Close preview' : 'Preview bulk change'}</button></>}{onDelete && <button className="ghost-button" type="button" onClick={() => bulkDelete().catch(() => {})}>Delete selected</button>}<button className="ghost-button" type="button" onClick={() => { setSelected([]); setBulkPreview(false); setCompareOpen(false) }}>Clear selection</button></div>}
    {bulkPreview && <section className="backend-health" aria-label="Bulk change preview"><strong>Review status change · {selected.length} records → {bulkStatus}</strong>{selected.map((id) => { const row = records.find((record) => record.id === id); return row && <small key={id}>{row.title || row.name || row.subject || row.id}: {row.status || 'Unspecified'} → {bulkStatus}</small> })}<button className="primary-action" type="button" onClick={applyBulkStatus}>Apply reviewed changes</button></section>}
    {deletePreview && <section className="backend-health feature-delete-review" role="group" aria-label="Review records to delete"><strong>Review before deleting {selected.length} records</strong><p>These records will be removed from this workspace. Review the list before confirming.</p><ul>{selected.map((id) => records.find((record) => record.id === id)).filter(Boolean).map((record) => <li key={record.id}>{record.title || record.name || record.subject || record.id}</li>)}</ul><div className="button-row"><button className="danger-button" type="button" onClick={() => confirmBulkDelete().catch((reason) => setActionError(reason?.message || 'Some records could not be deleted.'))}>Delete listed records</button><button className="ghost-button" type="button" onClick={() => setDeletePreview(false)}>Cancel</button></div></section>}
    {compareOpen && selected.length >= 2 && <section className="backend-health" aria-label="Record comparison"><strong>Side-by-side record comparison</strong><div className="dashboard-grid">{selected.slice(0, 3).map((id) => records.find((record) => record.id === id)).filter(Boolean).map((record) => <div key={record.id}><h4>{record.title || record.name || record.subject || 'Untitled record'}</h4>{Object.entries(record).filter(([key, value]) => !['id', 'revisionHistory'].includes(key) && ['string', 'number', 'boolean'].includes(typeof value) && value !== '').map(([key, value]) => <p key={key}><small>{key.replace(/([A-Z])/g, ' $1')}: </small>{String(value)}</p>)}</div>)}</div></section>}
    {visible.map((record) => <article className={`task-row feature-record-row ${density}`} key={record.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', alignItems: 'center', gap: density === 'compact' ? 6 : 10, padding: density === 'compact' ? 6 : 10 }}>
      <label className="record-select"><input type="checkbox" aria-label={`Select ${record.title || record.name || 'record'}`} checked={selected.includes(record.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, record.id] : current.filter((id) => id !== record.id))} /><span>Select</span></label>
      <div className="feature-record-main">
        {inlineId === record.id ? <form onSubmit={(event) => { event.preventDefault(); setInlineReview({ record, title: inlineTitle }) }}><input aria-label="Edit record title" value={inlineTitle} onChange={(event) => setInlineTitle(event.target.value)} autoFocus /><button className="text-button" type="submit">Review change</button><button className="text-button" type="button" onClick={() => setInlineId('')}>Cancel</button></form> : <strong>{record.title || record.name || record.subject || record.description || record.kind || 'Workspace record'}</strong>}
        {requiredFields.length > 0 && (() => { const missing = requiredFields.filter((field) => !String(record[field.name] ?? '').trim()); return missing.length > 0 && <small className="form-hint" title={`Missing: ${missing.map((field) => field.label).join(', ')}`}>Needs {missing.length} required {missing.length === 1 ? 'field' : 'fields'}</small> })()}
        <span>{cardMetadataFields.filter((field) => displayedCardFields.includes(field.key) && !['details', 'notes', 'amount', 'updated'].includes(field.key)).map((field) => field.value(record)).filter(Boolean).join(' · ')}</span>
        {displayedCardFields.includes('details') && record.details && <p>{record.details}</p>}
        {displayedCardFields.includes('notes') && record.notes && <p>{record.notes}</p>}
        {displayedCardFields.includes('amount') && record.amount !== undefined && <small>{cardMetadataFields.find((field) => field.key === 'amount').value(record)}</small>}
        {displayedCardFields.includes('updated') && record.updated_at && <small className="record-freshness" title={`Last changed ${new Date(record.updated_at).toLocaleString()}`}>Updated {new Date(record.updated_at).toLocaleString()}</small>}
      </div>
      {onStatus && record.status && <label className="feature-status">Status<select value={record.status} onChange={(event) => onStatus(record, event.target.value)}>{onStatus.options.map((status) => <option key={status}>{status}</option>)}</select></label>}
      <div className="feature-record-actions">
        <button className="text-button" type="button" onClick={() => { setPreviewId((current) => current === record.id ? '' : record.id); markViewed(record) }}>{previewId === record.id ? 'Close preview' : 'Preview'}</button>
        {onInlineUpdate && <button className="text-button" type="button" onClick={() => { setInlineId(record.id); setInlineTitle(record.title || '') }}>Quick edit</button>}
        {onAction && <button className="ghost-button" type="button" onClick={() => onAction(record)}>{actionLabel || 'Run'}</button>}
        {onEdit && <button className="text-button" type="button" onClick={() => onEdit(record)}>Edit</button>}
        {onDelete && <button className="text-button danger-text" type="button" onClick={() => onDelete(record)}>Delete</button>}
      </div>
      {previewId === record.id && <div className="feature-record-preview" style={{ gridColumn: '1 / -1', padding: 12, borderTop: '1px solid var(--line)' }}><strong>Record preview</strong>{Object.entries(record).filter(([key, value]) => !['id', 'revisionHistory'].includes(key) && value !== '' && value != null && typeof value !== 'object').map(([key, value]) => <p key={key}><small>{key.replace(/([A-Z])/g, ' $1')}: </small>{String(value)}</p>)}{record.revisionHistory?.length > 0 && <div className="record-history"><strong>Change history</strong>{[...record.revisionHistory].reverse().slice(0, 10).map((revision) => <article key={revision.at}><small>{new Date(revision.at).toLocaleString()} · {revision.by || 'Workspace user'}</small>{revision.changes.map((change) => <p key={change.field}><strong>{change.field}:</strong> {String(change.before ?? '—')} → {String(change.after ?? '—')} <button type="button" className="text-button" onClick={() => onInlineUpdate?.(record, { [change.field]: change.before })}>Restore previous value</button></p>)}</article>)}</div>}</div>}
    </article>)}
    {inlineReview && <section className="backend-health" role="dialog" aria-label="Review quick edit"><strong>Review title change</strong><p>{inlineReview.record.title || inlineReview.record.name || 'Untitled'} → {inlineReview.title || 'Untitled'}</p><div className="button-row"><button className="primary-action" type="button" onClick={confirmInlineUpdate}>Confirm quick edit</button><button className="ghost-button" type="button" onClick={() => setInlineReview(null)}>Back to list</button></div></section>}
    {!visible.length && <p className="queue-empty">{records.length ? 'No records match this search.' : emptyText}</p>}
  </div>
}

export function FeaturePanel({ eyebrow, title, description, children }) {
  return <section className="panel action-panel feature-panel">
    <div className="section-head"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div></div>
    {description && <p className="panel-copy">{description}</p>}
    {children}
  </section>
}

export function FeatureRecordManager({ records, kind, title, description, fields, onSave, onDelete, statusOptions, emptyText, onAction, actionLabel }) {
  const [editing, setEditing] = useState(null)
  const [duplicateNotice, setDuplicateNotice] = useState('')
  const rows = useMemo(() => records.filter((record) => record.kind === kind), [records, kind])
  async function commit(record, patch) {
    const changes = Object.keys(patch).filter((field) => JSON.stringify(record?.[field]) !== JSON.stringify(patch[field])).map((field) => ({ field, before: record?.[field] ?? '', after: patch[field] ?? '' }))
    const revisionHistory = changes.length ? [...(record?.revisionHistory || []), { at: new Date().toISOString(), by: 'Workspace user', changes }].slice(-20) : (record?.revisionHistory || [])
    await onSave({ ...record, ...patch, revisionHistory })
  }
  async function save(values) {
    const candidate = String(values.title || values.name || values.email || '').trim().toLowerCase()
    const duplicate = rows.find((record) => record.id !== editing?.id && candidate && String(record.title || record.name || record.email || '').trim().toLowerCase() === candidate)
    if (duplicate) {
      const existingSummary = [`ID ${duplicate.id}`, duplicate.title || duplicate.name || duplicate.email, duplicate.email && `email ${duplicate.email}`, duplicate.status && `status ${duplicate.status}`].filter(Boolean).join(' · ')
      const proposedSummary = [values.title || values.name || values.email || '(no title)', values.email && `email ${values.email}`, values.status && `status ${values.status}`].filter(Boolean).join(' · ')
      if (!window.confirm(`Possible duplicate ${kind.replaceAll('_', ' ')}. Compare before saving:\n\nExisting: ${existingSummary}\nNew: ${proposedSummary}\n\nSave as a separate record?`)) { setDuplicateNotice('The existing and proposed record summaries are shown above. Review the match or change the identifying details before saving.'); return }
    }
    await commit(editing, { ...values, kind, title: featureTitle(values) || title })
    setDuplicateNotice('')
    setEditing(null)
  }
  async function remove(record) {
    if (window.confirm(`Delete “${record.title || title}” from this local workspace?`)) await onDelete(record.id)
  }
  async function updateStatus(record, status) {
    await commit(record, { status })
  }
  const statusHandler = statusOptions ? Object.assign(updateStatus, { options: statusOptions }) : null
  const bulkStatusHandler = statusOptions ? Object.assign(async (record, status) => commit(record, { status }), {
    options: statusOptions,
    batch: async (selectedRecords, status) => {
      if (!window.overheadBackend?.updateFeatureRecordStatuses) throw new Error('Bulk updates require the current OverHead version.')
      const collection = featureCollectionByRecord.get(selectedRecords[0])
      if (!collection || selectedRecords.some((record) => featureCollectionByRecord.get(record) !== collection)) throw new Error('Selected records must come from the same workspace. Refresh this screen and try again.')
      const result = await window.overheadBackend.updateFeatureRecordStatuses({ collection, recordIds: selectedRecords.map((record) => record.id), status })
      window.dispatchEvent(new CustomEvent('overhead:feature-records-updated', { detail: { collection: result.collection } }))
      return result
    },
  }) : null
  return <div className="feature-manager" style={{ display: 'grid', gap: 12 }}>
    <div className="section-head" style={{ alignItems: 'start' }}><div><h3>{title}</h3><p>{description}</p></div>
      <button className="ghost-button" type="button" onClick={() => setEditing({})}>{editing ? 'New record' : 'Add record'}</button>
    </div>
    {duplicateNotice && <p className="form-hint" role="status">{duplicateNotice}</p>}
    {editing && <FeatureForm key={editing.id || `new-${kind}`} fields={fields} initial={editing} draftScope={kind} submitLabel={editing.id ? 'Save changes' : 'Create record'} onSubmit={save} onCancel={() => setEditing(null)} />}
    <FeatureRecordList records={rows} viewScope={kind} requiredFields={fields.filter((field) => field.required)} emptyText={emptyText} onEdit={setEditing} onDelete={remove} onStatus={statusHandler} onAction={onAction} actionLabel={actionLabel} onInlineUpdate={(record, patch) => commit(record, patch)} onBulkStatus={bulkStatusHandler} />
  </div>
}

export function RecentRecords({ limit = 5 }) {
  const [items, setItems] = useState(() => { try { return JSON.parse(window.localStorage.getItem('overhead.recentRecords.v1') || '[]') } catch { return [] } })
  useEffect(() => {
    const refresh = () => { try { setItems(JSON.parse(window.localStorage.getItem('overhead.recentRecords.v1') || '[]')) } catch {} }
    window.addEventListener('storage', refresh)
    window.addEventListener('overhead:recent-records', refresh)
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('overhead:recent-records', refresh) }
  }, [])
  if (!items.length) return null
  function clearHistory() {
    try { window.localStorage.removeItem('overhead.recentRecords.v1') } catch {}
    setItems([])
    window.dispatchEvent(new Event('overhead:recent-records'))
  }
  return <section className="panel action-panel" aria-labelledby="recent-records-heading"><div className="section-head"><div><p className="eyebrow">Recently viewed</p><h2 id="recent-records-heading">Pick up where you left off</h2></div><button className="text-button" type="button" onClick={clearHistory}>Clear history</button></div><div className="task-list">{items.slice(0, limit).map((item) => <article className="task-row" key={`${item.kind}-${item.id}`}><button className="text-button" type="button" onClick={() => { if (item.section) window.dispatchEvent(new CustomEvent('overhead:navigate', { detail: item.section })) }}>{item.title}</button><span>{item.kind}</span><small>{new Date(item.viewedAt).toLocaleString()}</small></article>)}</div></section>
}

export function FeatureTabs({ tabs, active, onChange }) {
  function moveTab(event, index) {
    let nextIndex = index
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.length - 1
    else return
    event.preventDefault()
    onChange(tabs[nextIndex].id)
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[nextIndex]?.focus()
  }
  return <div className="queue-filters feature-tabs" role="tablist" aria-label="Workspace tools" aria-orientation="horizontal">
    {tabs.map((tab, index) => <button type="button" role="tab" tabIndex={active === tab.id ? 0 : -1} aria-selected={active === tab.id} className={active === tab.id ? 'active' : ''} key={tab.id} onKeyDown={(event) => moveTab(event, index)} onClick={() => onChange(tab.id)}>{tab.label}</button>)}
  </div>
}

export function featureTitle(values) {
  return String(values.title || values.name || values.subject || values.description || values.task || values.person || values.vendor || '').trim()
}

export function currentDate() { return new Date().toISOString().slice(0, 10) }
export function currentMonth() { return currentDate().slice(0, 7) }
