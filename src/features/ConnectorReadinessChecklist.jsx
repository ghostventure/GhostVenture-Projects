import { useState } from 'react'
import { AlertTriangle, ListChecks } from 'lucide-react'
import './ConnectorReadinessChecklist.css'

const plans = [
  {
    id: 'accounting', title: 'Accounting sync', providers: 'QuickBooks Online / Xero',
    state: 'Export available', detail: 'OverHead can export accounting-shaped CSV files. Authenticated account sync, bank feeds, and reconciliation are not connected.',
    steps: ['Choose a chart-of-accounts mapping', 'Configure the provider OAuth app and callback URL', 'Map customers, invoices, expenses, tax, and currencies', 'Run a sandbox import/export and reconcile totals'],
  },
  {
    id: 'calendar', title: 'Calendar sync', providers: 'Google Calendar / Microsoft 365',
    state: 'Manual file exchange', detail: 'Local iCalendar import/export is available. Continuous provider sync and conflict handling are not configured.',
    steps: ['Register the provider OAuth application', 'Approve calendar read/write scopes', 'Define event ownership and conflict rules', 'Test recurring events, edits, cancellations, and time zones'],
  },
  {
    id: 'communications', title: 'Customer messaging', providers: 'Email / SMS / push',
    state: 'Local work queue', detail: 'OverHead can create internal follow-up work. Automated customer delivery needs a configured delivery provider and consent/preferences.',
    steps: ['Select an email or SMS delivery provider', 'Configure verified sender identity and callback events', 'Add customer opt-in, opt-out, and quiet-hour rules', 'Test delivery, bounce, retry, and duplicate handling'],
  },
  {
    id: 'automation', title: 'External automation', providers: 'Zapier / Make / Webhooks / REST API',
    state: 'Not connected', detail: 'The desktop rule builder is local. There is no public authenticated webhook/API endpoint configured for these services.',
    steps: ['Define event names and payload schemas', 'Implement signed, authenticated server endpoints', 'Add scoped credentials, rate limits, and replay protection', 'Publish connector documentation and test retries'],
  },
  {
    id: 'files', title: 'Cloud file storage', providers: 'OneDrive / Google Drive / Dropbox',
    state: 'Not connected', detail: 'Customer files can be managed locally. Provider-backed file sync and share-link lifecycle are not configured.',
    steps: ['Choose provider and least-privilege access scopes', 'Define file ownership, retention, and deletion behavior', 'Add upload/download and revocation handling', 'Test permission changes and account disconnect'],
  },
]

const getSaved = () => {
  try {
    const value = JSON.parse(localStorage.getItem('overhead.connector-readiness.v1') || '{}')
    return value && typeof value === 'object' ? value : {}
  } catch { return {} }
}

export default function ConnectorReadinessChecklist() {
  const [checks, setChecks] = useState(getSaved)

  function toggle(planId, stepIndex) {
    setChecks((current) => {
      const next = { ...current, [planId]: { ...(current[planId] || {}), [stepIndex]: !(current[planId] || {})[stepIndex] } }
      try { localStorage.setItem('overhead.connector-readiness.v1', JSON.stringify(next)) } catch {}
      return next
    })
  }

  return <section className="connector-readiness" aria-labelledby="connector-readiness-title">
      <div className="cr-heading">
      <div><p className="eyebrow">Connector launch planning</p><h3 id="connector-readiness-title"><ListChecks size={18} aria-hidden="true" /> Integration readiness</h3>
        <p>Track setup work separately from a live connection. Checking a box records a local planning note only; it does not authorize an account or run a sync.</p></div>
    </div>
    <div className="cr-cards">{plans.map((plan) => {
      const done = checks[plan.id] || {}
      const complete = plan.steps.every((_, index) => done[index])
      return <article className="cr-card" key={plan.id}>
        <div className="cr-card-head"><div><h4>{plan.title}</h4><span>{plan.providers}</span></div><span className={`cr-state ${complete ? 'is-planned' : ''}`}>{complete ? 'Setup plan reviewed' : plan.state}</span></div>
        <p>{plan.detail}</p>
        <details><summary>Setup checklist ({Object.values(done).filter(Boolean).length}/{plan.steps.length})</summary>
          <ul>{plan.steps.map((step, index) => <li key={step}><label><input type="checkbox" checked={Boolean(done[index])} onChange={() => toggle(plan.id, index)} /><span>{step}</span></label></li>)}</ul>
        </details>
      </article>
    })}</div>
    <p className="cr-note"><AlertTriangle size={15} aria-hidden="true" /> Checklist completion means planning is recorded. Confirm connection status in the integration panel and verify real provider data before relying on sync.</p>
  </section>
}
