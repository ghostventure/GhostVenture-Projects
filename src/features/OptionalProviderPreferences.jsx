import { useEffect, useState } from 'react'
import { Check, ChevronDown, LockKeyhole, PlugZap, RotateCcw } from 'lucide-react'
import './OptionalProviderPreferences.css'

const KEY = 'overhead.optionalProviders.v1'
const providers = [
  { id: 'accounting', name: 'Accounting', choices: ['QuickBooks Online', 'Xero', 'CSV only'], data: 'Invoices, expenses, customers, and account mappings', dependencies: 'Provider OAuth registration, account authorization, chart mapping, and sandbox reconciliation', fallback: 'Keep exporting CSV and managing records locally.', mappingFields: ['Invoice date', 'Customer', 'Invoice total', 'Expense category'] },
  { id: 'calendar', name: 'Calendar', choices: ['Google Calendar', 'Microsoft 365', 'iCalendar files only'], data: 'Appointment and meeting titles, dates, locations, and notes', dependencies: 'Provider OAuth consent, calendar scopes, sync engine, and conflict policy', fallback: 'Keep using OverHead schedule and manual iCalendar import/export.', mappingFields: ['Event title', 'Start time', 'End time', 'Location'] },
  { id: 'communications', name: 'Customer communications', choices: ['Email', 'SMS', 'Email and SMS', 'Internal tasks only'], data: 'Customer contact details, message content, and delivery events', dependencies: 'Verified sender, delivery provider, customer opt-in/opt-out handling, and retry rules', fallback: 'Keep creating internal follow-up tasks; send messages outside OverHead.', mappingFields: ['Customer email', 'Customer phone', 'Reminder trigger', 'Message template ID'] },
  { id: 'automation', name: 'Automation', choices: ['Zapier', 'Make', 'Signed webhooks / API'], data: 'Only the selected event fields and workflow actions', dependencies: 'Authenticated endpoint, signed requests, scoped access, rate limits, and replay protection', fallback: 'Keep using the local rule builder and manual exports.', mappingFields: ['Event name', 'Record ID', 'Workspace ID', 'Callback URL'] },
  { id: 'files', name: 'Cloud files', choices: ['OneDrive', 'Google Drive', 'Dropbox'], data: 'Selected customer files, names, and access metadata', dependencies: 'Provider OAuth scopes, upload/download adapter, expiry/revocation, and retention rules', fallback: 'Keep files in the encrypted local workspace.', mappingFields: ['Customer folder', 'File category', 'Retention days', 'Share permission'] },
]

const empty = () => Object.fromEntries(providers.map((provider) => [provider.id, { enabled: false, consented: false, provider: provider.choices[0], mappings: {} }]))
function readSaved() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || 'null')
    const base = empty()
    if (!stored || typeof stored !== 'object') return base
    for (const provider of providers) {
      const value = stored[provider.id]
      if (!value || typeof value !== 'object') continue
      base[provider.id] = {
        enabled: value.enabled === true && value.consented === true,
        consented: value.consented === true,
        consentedAt: typeof value.consentedAt === 'string' ? value.consentedAt : '',
        provider: provider.choices.includes(value.provider) ? value.provider : provider.choices[0],
        mappings: value.mappings && typeof value.mappings === 'object' ? value.mappings : {},
      }
    }
    return base
  } catch { return empty() }
}

export function getOptionalProviderPreferences() { return readSaved() }

export default function OptionalProviderPreferences() {
  const [settings, setSettings] = useState(readSaved)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)) }
    catch { setNotice('Preferences could not be saved on this device.') }
  }, [settings])

  function update(id, patch) {
    setSettings((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
    setNotice('Provider preferences saved on this device. No connection was created.')
  }

  function enable(provider, checked) {
    const current = settings[provider.id]
    if (!checked) {
      update(provider.id, { enabled: false })
      return
    }
    if (!current.consented) {
      const accepted = window.confirm(`Optional ${provider.name} provider\n\nIf connected later, OverHead may share: ${provider.data}.\n\nProvider setup is not currently performed by this preference. The local fallback remains available. Continue and record this opt-in?`)
      if (!accepted) return
      update(provider.id, { enabled: true, consented: true, consentedAt: new Date().toISOString() })
      return
    }
    update(provider.id, { enabled: true })
  }

  function reset(id) {
    setSettings((current) => ({ ...current, [id]: { enabled: false, consented: false, provider: providers.find((item) => item.id === id).choices[0], mappings: {} } }))
    setNotice('Provider opt-in and local mappings cleared. Provider credentials are not managed here.')
  }

  return <section className="optional-providers" aria-labelledby="optional-providers-title">
    <header className="op-header"><div><p className="eyebrow">Optional provider controls</p><h3 id="optional-providers-title"><PlugZap size={18} aria-hidden="true" /> Provider preferences and mappings</h3><p>Choose which external workflows you intend to use. Opt-in is a local consent record; the live connection state remains in Integration status above.</p></div><span className="op-local-badge"><LockKeyhole size={14} aria-hidden="true" /> Local preference</span></header>
    <div className="op-grid">{providers.map((provider) => {
      const value = settings[provider.id]
      return <article className="op-card" key={provider.id}>
        <div className="op-card-head"><div><h4>{provider.name}</h4><span>{value.enabled ? `Opted in · ${value.provider}` : 'Disabled · local fallback active'}</span></div><label className="op-toggle"><input type="checkbox" checked={value.enabled} onChange={(event) => enable(provider, event.target.checked)} /><span>{value.enabled ? 'Enabled' : 'Disabled'}</span></label></div>
        <label className="op-select">Preferred provider<select value={value.provider} onChange={(event) => {
          if (event.target.value !== value.provider) update(provider.id, { provider: event.target.value, enabled: false, consented: false, consentedAt: '', mappings: {} })
        }}>{provider.choices.map((choice) => <option key={choice}>{choice}</option>)}</select></label>
        <details className="op-details"><summary><ChevronDown size={14} aria-hidden="true" /> Data and setup requirements</summary><p><strong>Potential data:</strong> {provider.data}</p><p><strong>Required setup:</strong> {provider.dependencies}</p><p><strong>Available fallback:</strong> {provider.fallback}</p></details>
        <div className="op-mapping"><strong>Optional field mappings</strong>{provider.mappingFields.map((field) => <label key={field}>{field}<input value={value.mappings[field] || ''} disabled={!value.enabled} maxLength={80} placeholder={`Provider field for ${field.toLowerCase()}`} onChange={(event) => update(provider.id, { mappings: { ...value.mappings, [field]: event.target.value } })} /></label>)}<small>Saved locally as a draft mapping. No records are transformed or sent by this control.</small></div>
        {value.consented && <div className="op-consent"><Check size={14} aria-hidden="true" /> Opt-in recorded {value.consentedAt ? new Date(value.consentedAt).toLocaleDateString() : 'on this device'}. Disable to pause preference, or clear to withdraw consent.</div>}
        <button className="ghost-button op-reset" type="button" onClick={() => reset(provider.id)}><RotateCcw size={14} aria-hidden="true" /> Clear opt-in and mapping</button>
      </article>
    })}</div>
    <p className="op-notice" role="status" aria-live="polite">{notice || 'No provider credentials are requested or stored in this panel. Do not paste API keys, access tokens, or passwords into mapping notes.'}</p>
  </section>
}
