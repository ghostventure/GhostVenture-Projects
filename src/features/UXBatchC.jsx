import { useMemo, useState } from 'react'
import { readFormTemplates } from './uxPreferencesStorage.js'

const STARTUP_KEY = 'overhead.startupSection.v1'
const TEMPLATES_KEY = 'overhead.formTemplates.v1'
const TIPS_KEY = 'overhead.weekOneTips.v1'

export function WorkloadAgendaPanel({ backendState = {} }) {
  const tasks = backendState.tasks || []
  const appointments = backendState.appointments || []
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7)
  const dueThisWeek = [...tasks.map((item) => ({ ...item, date: item.due_at || item.due })), ...appointments.map((item) => ({ ...item, date: item.scheduled_for }))]
    .filter((item) => { const date = Date.parse(item.date || ''); return Number.isFinite(date) && date >= today.getTime() && date < weekEnd.getTime() && !['Complete', 'Canceled'].includes(item.status) })
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  const workload = useMemo(() => {
    const groups = new Map()
    tasks.filter((task) => !['Complete', 'Canceled'].includes(task.status)).forEach((task) => {
      const owner = task.assigned_to || task.owner || task.assignee || 'Unassigned'
      const entry = groups.get(owner) || { owner, open: 0, overdue: 0 }
      entry.open += 1
      if (Date.parse(task.due_at || task.due || '') < today.getTime()) entry.overdue += 1
      groups.set(owner, entry)
    })
    return [...groups.values()].sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.owner.localeCompare(b.owner))
  }, [tasks])
  return <section className="panel action-panel">
    <div className="section-head"><div><p className="eyebrow">Team planning</p><h2>Workload and upcoming agenda</h2></div></div>
    <div className="dashboard-grid">
      <div className="backend-health"><strong>Open work by owner</strong>{workload.length ? workload.map((row) => <p key={row.owner}><strong>{row.owner}</strong> · {row.open} open{row.overdue ? ` · ${row.overdue} overdue` : ''}</p>) : <p className="queue-empty">No open tasks to distribute.</p>}</div>
      <div className="backend-health"><strong>Next 7 days</strong>{dueThisWeek.length ? dueThisWeek.slice(0, 8).map((item) => <p key={item.id}><strong>{item.title || 'Untitled work'}</strong> · {new Date(item.date).toLocaleString()} · {item.status || 'Scheduled'}</p>) : <p className="queue-empty">No tasks or appointments due in the next 7 days.</p>}</div>
    </div>
  </section>
}

export function UXPreferencesPanel({ allowedSections = [], setOperationNotice = () => {} }) {
  const [templates, setTemplates] = useState(readFormTemplates)
  const [name, setName] = useState('')
  const [kind, setKind] = useState('appointment')
  const [defaults, setDefaults] = useState({ title: '', amount: '', notes: '' })
  const [dismissedTips, setDismissedTips] = useState(() => { try { return JSON.parse(window.localStorage.getItem(TIPS_KEY) || '[]') } catch { return [] } })
  const startupSection = window.localStorage.getItem(STARTUP_KEY) || 'overview'
  const help = [
    ['Find a screen', 'Use the top search field to open the command palette. It searches available commands and navigation actions.'],
    ['Protect private records', 'Privacy mode masks sensitive fields while you work near other people. Toggle it from the top bar.'],
    ['Recover workspace data', 'Create a backup before major changes. Validate a restore package before replacing the current workspace.'],
    ['Share files safely', 'Review exports and support bundles before sending them outside OverHead. They may contain business records.'],
  ]
  function saveTemplate() {
    if (!name.trim()) { setOperationNotice('Give the template a name first.'); return }
    const next = [...templates, { id: crypto.randomUUID(), name: name.trim(), kind, defaults }]
    setTemplates(next); window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next)); setName(''); setOperationNotice('Reusable form template saved on this device.')
  }
  function removeTemplate(id) { const next = templates.filter((item) => item.id !== id); setTemplates(next); window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next)) }
  function setStartup(value) { window.localStorage.setItem(STARTUP_KEY, value); setOperationNotice(`Startup page set to ${value === 'last' ? 'last-used workspace' : value}.`) }
  function dismissTip(id) { const next = [...new Set([...dismissedTips, id])]; setDismissedTips(next); window.localStorage.setItem(TIPS_KEY, JSON.stringify(next)) }
  return <div className="profile-form">
    <div className="backend-health"><strong>Startup page</strong><span>Choose which workspace opens after sign-in.</span><select aria-label="Startup page" value={startupSection} onChange={(event) => setStartup(event.target.value)}><option value="overview">Team Dashboard</option><option value="last">Last-used workspace</option>{allowedSections.filter((item) => !['overview', 'settings'].includes(item)).map((item) => <option key={item} value={item}>{item.replaceAll('-', ' ')}</option>)}</select></div>
    <div className="backend-health"><strong>Reusable form templates</strong><span>Save defaults for appointments, quotes, and invoices. Templates stay in this Windows profile.</span><div className="profile-form compact-form"><label>Template name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Routine service visit" /></label><label>Form type<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="appointment">Appointment</option><option value="quote">Quote</option><option value="invoice">Invoice</option></select></label><label>Default title<input value={defaults.title} onChange={(event) => setDefaults((value) => ({ ...value, title: event.target.value }))} /></label><label>Default amount<input type="number" min="0" step="0.01" value={defaults.amount} onChange={(event) => setDefaults((value) => ({ ...value, amount: event.target.value }))} /></label><label>Default notes<textarea value={defaults.notes} onChange={(event) => setDefaults((value) => ({ ...value, notes: event.target.value }))} /></label><button type="button" className="ghost-button" onClick={saveTemplate}>Save template</button></div>{templates.map((item) => <p key={item.id}><strong>{item.name}</strong> · {item.kind}<button type="button" className="text-button" onClick={() => removeTemplate(item.id)}>Remove</button></p>)}</div>
    <div className="backend-health"><strong>Contextual help</strong>{help.map(([title, text]) => <details key={title}><summary>{title}</summary><p>{text}</p></details>)}</div>
    <div className="backend-health"><strong>First-week tips</strong>{[['create', 'Start with one real customer, then use the customer record to connect quotes, appointments, and invoices.'], ['backup', 'Create a backup after importing or making a large set of changes.'], ['privacy', 'Keep privacy mode on when screens are visible to customers or visitors.']].filter(([id]) => !dismissedTips.includes(id)).map(([id, text]) => <p key={id}>{text}<button type="button" className="text-button" onClick={() => dismissTip(id)}>Dismiss</button></p>)}{dismissedTips.length === 3 && <button className="text-button" type="button" onClick={() => { setDismissedTips([]); window.localStorage.removeItem(TIPS_KEY) }}>Show tips again</button>}</div>
  </div>
}
