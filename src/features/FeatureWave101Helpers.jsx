import { useCallback, useEffect, useMemo, useState } from 'react'

const emptyForm = {}

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

export function FeatureForm({ fields, initial = emptyForm, submitLabel = 'Save record', onSubmit, onCancel }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((field) => [field.name, initial[field.name] ?? field.defaultValue ?? ''])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setValues(Object.fromEntries(fields.map((field) => [field.name, initial[field.name] ?? field.defaultValue ?? ''])))
    setError('')
  }, [fields, initial])

  async function submit(event) {
    event.preventDefault()
    const missing = fields.find((field) => field.required && !String(values[field.name] ?? '').trim())
    if (missing) { setError(`${missing.label} is required.`); return }
    setSaving(true)
    try { await onSubmit(values); setError('') }
    catch (reason) { setError(reason?.message || 'The record could not be saved.') }
    finally { setSaving(false) }
  }

  return <form className="profile-form compact-form" onSubmit={submit} style={{ display: 'grid', gap: 10, margin: '12px 0', padding: 12, border: '1px solid var(--line)', borderRadius: 7 }}>
    {fields.map((field) => <label key={field.name}>
      {field.label}
      {field.options
        ? <select value={values[field.name]} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}>
          {field.options.map((option) => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? option}</option>)}
        </select>
        : field.multiline
          ? <textarea rows="3" value={values[field.name]} maxLength={field.maxLength || 2000} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} />
          : <input type={field.type || 'text'} min={field.min} max={field.max} step={field.step} value={values[field.name]} maxLength={field.maxLength || 200} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} />}
    </label>)}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="button-row">
      <button className="primary-action" type="submit" disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
      {onCancel && <button className="ghost-button" type="button" onClick={onCancel}>Cancel</button>}
    </div>
  </form>
}

export function FeatureRecordList({ records, emptyText = 'No records yet.', onEdit, onDelete, onStatus, onAction, actionLabel }) {
  const [query, setQuery] = useState('')
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return records.filter((record) => !needle || Object.values(record).some((value) => typeof value === 'string' && value.toLowerCase().includes(needle)))
  }, [records, query])

  return <div className="task-list" style={{ display: 'grid', gap: 8 }}>
    {records.length > 3 && <label className="feature-search">Search records<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this list" /></label>}
    {visible.map((record) => <article className="task-row" key={record.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', alignItems: 'center', gap: 10, padding: 10 }}>
      <div className="feature-record-main">
        <strong>{record.title || record.name || record.subject || record.description || record.kind || 'Workspace record'}</strong>
        <span>{[record.kindLabel || record.kind, record.category, record.owner, record.assignee, record.date || record.dueDate || record.startAt || record.month, record.status].filter(Boolean).join(' · ')}</span>
        {record.details && <p>{record.details}</p>}
        {record.notes && <p>{record.notes}</p>}
        {record.amount !== undefined && <small>{record.currency || 'USD'} {Number(record.amount || 0).toFixed(2)}</small>}
      </div>
      {onStatus && record.status && <label className="feature-status">Status<select value={record.status} onChange={(event) => onStatus(record, event.target.value)}>{onStatus.options.map((status) => <option key={status}>{status}</option>)}</select></label>}
      <div className="feature-record-actions">
        {onAction && <button className="ghost-button" type="button" onClick={() => onAction(record)}>{actionLabel || 'Run'}</button>}
        {onEdit && <button className="text-button" type="button" onClick={() => onEdit(record)}>Edit</button>}
        {onDelete && <button className="text-button danger-text" type="button" onClick={() => onDelete(record)}>Delete</button>}
      </div>
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
  const rows = useMemo(() => records.filter((record) => record.kind === kind), [records, kind])
  async function save(values) {
    await onSave({ ...editing, ...values, kind, title: featureTitle(values) || title })
    setEditing(null)
  }
  async function remove(record) {
    if (window.confirm(`Delete “${record.title || title}” from this local workspace?`)) await onDelete(record.id)
  }
  async function updateStatus(record, status) {
    await onSave({ ...record, status })
  }
  const statusHandler = statusOptions ? Object.assign(updateStatus, { options: statusOptions }) : null
  return <div className="feature-manager" style={{ display: 'grid', gap: 12 }}>
    <div className="section-head" style={{ alignItems: 'start' }}><div><h3>{title}</h3><p>{description}</p></div>
      <button className="ghost-button" type="button" onClick={() => setEditing({})}>{editing ? 'New record' : 'Add record'}</button>
    </div>
    {editing && <FeatureForm key={editing.id || `new-${kind}`} fields={fields} initial={editing} submitLabel={editing.id ? 'Save changes' : 'Create record'} onSubmit={save} onCancel={() => setEditing(null)} />}
    <FeatureRecordList records={rows} emptyText={emptyText} onEdit={setEditing} onDelete={remove} onStatus={statusHandler} onAction={onAction} actionLabel={actionLabel} />
  </div>
}

export function FeatureTabs({ tabs, active, onChange }) {
  return <div className="queue-filters feature-tabs" role="tablist" aria-label="Workspace tools">
    {tabs.map((tab) => <button type="button" role="tab" aria-selected={active === tab.id} className={active === tab.id ? 'active' : ''} key={tab.id} onClick={() => onChange(tab.id)}>{tab.label}</button>)}
  </div>
}

export function featureTitle(values) {
  return String(values.title || values.name || values.subject || values.description || values.task || values.person || values.vendor || '').trim()
}

export function currentDate() { return new Date().toISOString().slice(0, 10) }
export function currentMonth() { return currentDate().slice(0, 7) }
