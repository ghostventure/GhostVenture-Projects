import { useCallback, useEffect, useMemo, useState } from 'react'

const emptyForm = {}
const featureCollectionByRecord = new WeakMap()

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
      setError(reason?.message || 'Workspace records could not be loaded.')
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
  const draftKey = `overhead.formDraft.v1.${draftScope}.${initial.id || 'new'}`
  const templateKey = `overhead.formTemplates.v1.${draftScope}`
  const [templates, setTemplates] = useState(() => { try { return JSON.parse(window.localStorage.getItem(templateKey) || '[]') } catch { return [] } })

  useEffect(() => {
    let saved = {}
    try { saved = JSON.parse(window.localStorage.getItem(draftKey) || '{}') } catch {}
    setValues(Object.fromEntries(fields.map((field) => [field.name, initial[field.name] ?? saved[field.name] ?? field.defaultValue ?? ''])))
    setError('')
  }, [draftKey, fields, initial])

  useEffect(() => { try { window.localStorage.setItem(draftKey, JSON.stringify(values)) } catch {} }, [draftKey, values])

  function saveTemplate() {
    const name = window.prompt('Name this form template')?.trim()
    if (!name) return
    const next = [...templates.filter((item) => item.name !== name), { name, values }].slice(-12)
    setTemplates(next)
    window.localStorage.setItem(templateKey, JSON.stringify(next))
  }

  async function submit(event) {
    event.preventDefault()
    const missing = fields.find((field) => field.required && !String(values[field.name] ?? '').trim())
    if (missing) { setError(`${missing.label} is required.`); return }
    setSaving(true)
    try { await onSubmit(values); setError(''); window.localStorage.removeItem(draftKey); setValues(Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? '']))) }
    catch (reason) { setError(reason?.message || 'The record could not be saved.') }
    finally { setSaving(false) }
  }

  return <form className="profile-form compact-form" onSubmit={submit} style={{ display: 'grid', gap: 10, margin: '12px 0', padding: 12, border: '1px solid var(--line)', borderRadius: 7 }}>
    {templates.length > 0 && <label>Apply saved template<select value="" onChange={(event) => { const item = templates.find((entry) => entry.name === event.target.value); if (item) setValues((current) => ({ ...current, ...item.values })) }}><option value="">Choose a template</option>{templates.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>}
    {fields.map((field) => <label key={field.name}>
      {field.label}
      {field.options
        ? <select value={values[field.name]} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}>
          {field.options.map((option) => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? option}</option>)}
        </select>
        : field.multiline
          ? <textarea rows="3" value={values[field.name]} maxLength={field.maxLength || 2000} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} />
        : <input type={field.type || 'text'} min={field.min} max={field.max} step={field.step} value={values[field.name]} maxLength={field.maxLength || 200} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} />}
      {field.help && <small className="form-hint">{field.help}</small>}
    </label>)}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="button-row">
      <button className="primary-action" type="submit" disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
      <button className="ghost-button" type="button" onClick={saveTemplate}>Save as template</button>
      {onCancel && <button className="ghost-button" type="button" onClick={onCancel}>Cancel</button>}
    </div>
  </form>
}

export function FeatureRecordList({ records, emptyText = 'No records yet.', onEdit, onDelete, onStatus, onAction, actionLabel, onInlineUpdate, onBulkStatus }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])
  const [previewId, setPreviewId] = useState('')
  const [inlineId, setInlineId] = useState('')
  const [inlineTitle, setInlineTitle] = useState('')
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkPreview, setBulkPreview] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [actionError, setActionError] = useState('')
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return records.filter((record) => !needle || Object.values(record).some((value) => typeof value === 'string' && value.toLowerCase().includes(needle)))
  }, [records, query])

  async function bulkDelete() {
    if (!selected.length || !window.confirm(`Delete ${selected.length} selected record${selected.length === 1 ? '' : 's'}?`)) return
    for (const id of selected) await onDelete(records.find((record) => record.id === id))
    setSelected([])
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
    {records.length > 3 && <label className="feature-search">Search records<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this list" /></label>}
    {selected.length > 0 && <div className="button-row" role="toolbar" aria-label="Selected record actions"><span>{selected.length} selected</span><button className="ghost-button" type="button" disabled={selected.length < 2} onClick={() => setCompareOpen((open) => !open)}>Compare records</button>{onBulkStatus && <><select aria-label="Set selected records status" value={bulkStatus} onChange={(event) => { setBulkStatus(event.target.value); setBulkPreview(false) }}><option value="">Choose status</option>{onBulkStatus.options.map((status) => <option key={status}>{status}</option>)}</select><button className="ghost-button" type="button" disabled={!bulkStatus} onClick={() => setBulkPreview((open) => !open)}>{bulkPreview ? 'Close preview' : 'Preview bulk change'}</button></>}{onDelete && <button className="ghost-button" type="button" onClick={() => bulkDelete().catch(() => {})}>Delete selected</button>}<button className="ghost-button" type="button" onClick={() => { setSelected([]); setBulkPreview(false); setCompareOpen(false) }}>Clear selection</button></div>}
    {bulkPreview && <section className="backend-health" aria-label="Bulk change preview"><strong>Review status change · {selected.length} records → {bulkStatus}</strong>{selected.map((id) => { const row = records.find((record) => record.id === id); return row && <small key={id}>{row.title || row.name || row.subject || row.id}: {row.status || 'Unspecified'} → {bulkStatus}</small> })}<button className="primary-action" type="button" onClick={applyBulkStatus}>Apply reviewed changes</button></section>}
    {compareOpen && selected.length >= 2 && <section className="backend-health" aria-label="Record comparison"><strong>Side-by-side record comparison</strong><div className="dashboard-grid">{selected.slice(0, 3).map((id) => records.find((record) => record.id === id)).filter(Boolean).map((record) => <div key={record.id}><h4>{record.title || record.name || record.subject || 'Untitled record'}</h4>{Object.entries(record).filter(([key, value]) => !['id', 'revisionHistory'].includes(key) && ['string', 'number', 'boolean'].includes(typeof value) && value !== '').map(([key, value]) => <p key={key}><small>{key.replace(/([A-Z])/g, ' $1')}: </small>{String(value)}</p>)}</div>)}</div></section>}
    {visible.map((record) => <article className="task-row" key={record.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', alignItems: 'center', gap: 10, padding: 10 }}>
      <label className="record-select"><input type="checkbox" aria-label={`Select ${record.title || record.name || 'record'}`} checked={selected.includes(record.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, record.id] : current.filter((id) => id !== record.id))} /><span>Select</span></label>
      <div className="feature-record-main">
        {inlineId === record.id ? <form onSubmit={(event) => { event.preventDefault(); onInlineUpdate?.(record, { title: inlineTitle }); setInlineId('') }}><input aria-label="Edit record title" value={inlineTitle} onChange={(event) => setInlineTitle(event.target.value)} autoFocus /><button className="text-button" type="submit">Save</button><button className="text-button" type="button" onClick={() => setInlineId('')}>Cancel</button></form> : <strong>{record.title || record.name || record.subject || record.description || record.kind || 'Workspace record'}</strong>}
        <span>{[record.kindLabel || record.kind, record.category, record.owner, record.assignee, record.date || record.dueDate || record.startAt || record.month, record.status].filter(Boolean).join(' · ')}</span>
        {record.details && <p>{record.details}</p>}
        {record.notes && <p>{record.notes}</p>}
        {record.amount !== undefined && <small>{record.currency || 'USD'} {Number(record.amount || 0).toFixed(2)}</small>}
        {record.updated_at && <small className="record-freshness" title={`Last changed ${new Date(record.updated_at).toLocaleString()}`}>Updated {new Date(record.updated_at).toLocaleString()}</small>}
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
    if (duplicate && !window.confirm(`A similar ${kind.replaceAll('_', ' ')} already exists: “${duplicate.title || duplicate.name || duplicate.email}”. Save another record anyway?`)) { setDuplicateNotice('Review the existing matching record or change the title before saving.'); return }
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
    <FeatureRecordList records={rows} emptyText={emptyText} onEdit={setEditing} onDelete={remove} onStatus={statusHandler} onAction={onAction} actionLabel={actionLabel} onInlineUpdate={(record, patch) => commit(record, patch)} onBulkStatus={bulkStatusHandler} />
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
  return <section className="panel action-panel"><div className="section-head"><div><p className="eyebrow">Recently viewed</p><h2>Pick up where you left off</h2></div></div><div className="task-list">{items.slice(0, limit).map((item) => <article className="task-row" key={`${item.kind}-${item.id}`}><button className="text-button" type="button" onClick={() => { if (item.section) window.dispatchEvent(new CustomEvent('overhead:navigate', { detail: item.section })) }}>{item.title}</button><span>{item.kind}</span><small>{new Date(item.viewedAt).toLocaleString()}</small></article>)}</div></section>
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
