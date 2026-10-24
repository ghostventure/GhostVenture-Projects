import { useMemo, useState } from 'react'
import { BookOpen, CheckCircle2, Download, FileArchive, FileText, ShieldCheck, Sparkles } from 'lucide-react'
import './UXCompanionPanel.css'

export default function UXCompanionPanel({ backendState = {}, session = {}, onNavigate = () => {}, setOperationNotice = () => {} }) {
  const [open, setOpen] = useState(false)
  const [sampleOpen, setSampleOpen] = useState(false)
  const [bundleReview, setBundleReview] = useState(false)
  const [bundleBusy, setBundleBusy] = useState(false)
  const [bundleError, setBundleError] = useState('')
  const counts = useMemo(() => ({
    customers: (backendState.customers || []).length,
    appointments: (backendState.appointments || []).length,
    backup: Number(backendState.health?.backupCount || 0),
  }), [backendState])
  const completedTasks = (backendState.tasks || []).filter((task) => ['done', 'complete', 'closed'].includes(String(task.status || '').toLowerCase())).length
  const openTasks = (backendState.tasks || []).filter((task) => !['done', 'complete', 'closed', 'canceled', 'cancelled'].includes(String(task.status || '').toLowerCase())).length
  const myOpenTasks = (backendState.tasks || []).filter((task) => {
    const assignee = String(task.assignee || task.assigned_to || task.assignedTo || '').trim().toLowerCase()
    return Boolean(session.email) && assignee === String(session.email).trim().toLowerCase() && !['done', 'complete', 'closed', 'canceled', 'cancelled'].includes(String(task.status || '').toLowerCase())
  }).length
  const legalDocs = backendState.legalDocuments || []
  const acknowledgements = backendState.legalAcknowledgements || []
  const approvedDocs = legalDocs.filter((doc) => /^approved|^active$/i.test(String(doc.status || ''))).length
  const ownerCanCreateBundle = ['Owner', 'Support'].includes(session.role)
  const missingEmail = (backendState.customers || []).filter((customer) => !String(customer.email || '').trim()).length
  const missingTaskDueDate = (backendState.tasks || []).filter((task) => !String(task.due_at || task.due_date || task.dueDate || '').trim()).length
  const missingAppointmentTime = (backendState.appointments || []).filter((appointment) => !String(appointment.scheduled_for || appointment.startAt || appointment.date || '').trim()).length
  const completedThisWeek = (backendState.tasks || []).filter((task) => {
    const date = Date.parse(task.updated_at || task.completed_at || '')
    return ['done', 'complete', 'closed'].includes(String(task.status || '').toLowerCase()) && Number.isFinite(date) && date >= Date.now() - 7 * 86400000
  }).length

  function exportActivitySummary() {
    const rows = [['Metric', 'Count'], ['Customers', counts.customers], ['Open tasks', openTasks], ['Completed tasks', completedTasks], ['Completed in last 7 days', completedThisWeek], ['Appointments', counts.appointments], ['Backups', counts.backup]]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'overhead-workspace-activity.csv'; link.click(); URL.revokeObjectURL(url)
  }

  async function createBundle() {
    if (!window.confirm('Create this support bundle on this computer? It includes health details, up to 100 audit events, tasks, customer records, and a reduced settings summary. It is not sent automatically.')) return
    setBundleBusy(true); setBundleError('')
    try {
      const result = await window.overheadBackend?.createSupportBundle?.()
      if (!result?.bundlePath) throw new Error('The support bundle service is unavailable.')
      setOperationNotice(`Support bundle created on this computer: ${result.bundlePath}`)
      setBundleReview(false)
    } catch (error) { setBundleError(error?.message || 'Could not create the support bundle.') }
    finally { setBundleBusy(false) }
  }

  return <section className="ux-companion panel" aria-label="Workspace helper: activity, guidance, support, and privacy">
    <div className="ux-companion-header">
      <div><p className="eyebrow">Helpful tools</p><h2><Sparkles size={19}/> Workspace helper</h2><p className="ux-companion-intro">Activity, setup guidance, service permissions, and support tools in one place.</p></div>
      <button className="ghost-button" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? 'Close helper' : 'Open helper'}</button>
    </div>
    <div className="ux-companion-summary" aria-live="polite">
      <span><strong>{openTasks}</strong> open tasks</span><span><strong>{completedTasks}</strong> completed</span><span><strong>{counts.customers}</strong> customers</span><span><strong>{counts.appointments}</strong> appointments</span>
    </div>
    {open && <div className="ux-companion-groups">
      <section className="ux-companion-group" aria-labelledby="ux-companion-work-title">
        <header><h3 id="ux-companion-work-title">Your workspace</h3><p>Quick links and summaries based on records currently loaded.</p></header>
        <div className="ux-companion-grid">
      <article className="backend-health"><h3><CheckCircle2 size={16}/> My open tasks</h3>{session.email ? <><p>{myOpenTasks} open task{myOpenTasks === 1 ? '' : 's'} assigned to {session.email}.</p><button className="ghost-button" type="button" onClick={() => { onNavigate('growth'); setOperationNotice(`Opened task workspace. ${myOpenTasks} open task${myOpenTasks === 1 ? '' : 's'} are assigned to your account.`) }}>Open task workspace</button><small>Count matches the task assignee email to your signed-in account.</small></> : <p>Sign in with a staff account to see your assigned task count.</p>}</article>
      <article className="backend-health"><h3><Sparkles size={16}/> Example workflow</h3><p>Preview a fictional customer, appointment, and follow-up. This does not create or change workspace records.</p>
        <button className="ghost-button" type="button" onClick={() => setSampleOpen((value) => !value)} aria-expanded={sampleOpen}>Preview example workflow</button>
        {sampleOpen && <div className="ux-sample-preview"><strong>Example only - not saved</strong><p>New customer, appointment, follow-up task. This preview is fictional and does not create or change workspace records.</p></div>}
      </article>
      <article className="backend-health"><h3><FileText size={16}/> Additional activity</h3><p>Summary is calculated from records currently loaded in this workspace.</p><div className="ux-productivity-list"><span>Completed in last 7 days <strong>{completedThisWeek}</strong></span><span>Backups <strong>{counts.backup}</strong></span></div><button type="button" className="ghost-button" onClick={exportActivitySummary}><Download size={15}/> Export activity summary</button></article>
      <article className="backend-health"><h3><CheckCircle2 size={16}/> Workspace completeness</h3><p>Review missing basics in existing records; nothing is edited automatically.</p><div className="ux-productivity-list"><span>Customers missing email <strong>{missingEmail}</strong></span><span>Tasks missing due date <strong>{missingTaskDueDate}</strong></span><span>Appointments missing start time <strong>{missingAppointmentTime}</strong></span></div><button className="ghost-button" type="button" onClick={() => onNavigate('customers')}>Review customer records</button><button className="ghost-button" type="button" onClick={() => onNavigate('growth')}>Review tasks</button></article>
        </div>
      </section>
      <section className="ux-companion-group" aria-labelledby="ux-companion-guide-title">
        <header><h3 id="ux-companion-guide-title">Guidance and privacy</h3><p>Understand app features, connected services, and local support exports.</p></header>
        <div className="ux-companion-grid">
      <article className="backend-health"><h3><BookOpen size={16}/> Recent UX improvements</h3><ul><li>Forms highlight missing required fields and preserve drafts.</li><li>CSV review finds duplicate contacts and malformed rows before import.</li><li>Scheduling warns about overlapping records before saving.</li></ul><small>Use the workspace toolbar to check for updates.</small></article>
      <article className="backend-health"><h3><ShieldCheck size={16}/> Privacy & consent</h3><p>{acknowledgements.length} acknowledgement record(s); {approvedDocs} approved policy document(s) of {legalDocs.length}. Drafts are not approved policies.</p>{legalDocs.slice(0, 8).map((doc) => { const ack = acknowledgements.find((item) => item.title === doc.title); return <div className="ux-consent-row" key={doc.title}><span>{doc.title}<small>{doc.status || 'Status unavailable'}</small></span><strong>{ack ? `Acknowledged ${new Date(ack.accepted_at).toLocaleDateString()}` : 'No acknowledgement recorded'}</strong></div> })}<button className="ghost-button" type="button" onClick={() => onNavigate('support')}>Open Support and review policies</button><button className="ghost-button" type="button" onClick={() => onNavigate('integrations')}>Review external service permissions</button><button className="ghost-button" type="button" onClick={() => onNavigate('settings')}>Open Settings</button><small>External services may open their own authorization page. Review the provider and requested access before continuing.</small></article>
      <article className="backend-health"><h3><FileArchive size={16}/> Support bundle preview</h3><p>Preview the contents before creating a local diagnostic archive. Customer records and audit details can include sensitive business information.</p><ul><li>Health and app diagnostics</li><li>Up to 100 recent audit events</li><li>Tasks and customer records</li><li>Reduced settings/count summary; credentials and provider sessions are excluded</li></ul>{ownerCanCreateBundle ? <button className="ghost-button" type="button" onClick={() => setBundleReview((value) => !value)} aria-expanded={bundleReview}>Review bundle contents</button> : <small>Only workspace owners and support staff can create a bundle.</small>}{bundleReview && <div className="ux-bundle-review"><strong>Nothing is created or sent until you confirm.</strong><p>The archive is written on this computer. You choose if and how to share it afterward.</p><button className="primary-action" type="button" disabled={bundleBusy} onClick={() => createBundle().catch(() => {})}>{bundleBusy ? 'Creating...' : 'Create local support bundle'}</button><button className="ghost-button" type="button" onClick={() => setBundleReview(false)}>Cancel</button>{bundleError && <p role="alert">{bundleError}</p>}</div>}</article>
        </div>
      </section>
    </div>}
  </section>
}
