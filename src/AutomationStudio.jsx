import { useEffect, useState } from 'react'

const events = [
  ['customer.created', 'New customer is added'],
  ['quote.status_updated', 'Quote status changes'],
  ['invoice.overdue', 'Invoice passes its due date'],
  ['task.deadline_due', 'Task deadline arrives'],
]
const style = { minHeight: 38, padding: '8px 10px', border: '1px solid var(--line, #d7dce2)', borderRadius: 8, background: 'var(--surface, #fff)', color: 'var(--text, #17202a)' }

export function AutomationStudio({ backendState = {}, sessionRole = 'Owner', setOperationNotice = () => {}, refreshBackend = async () => {} }) {
  const [rules, setRules] = useState([])
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState(events[0][0])
  const [condition, setCondition] = useState('')
  const [actionText, setActionText] = useState('Review this record')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [runs, setRuns] = useState([])
  async function refresh() {
    try { setRules((await window.overheadBackend.listFeatureRecords('automation')).filter((item) => item.kind === 'rule')); setRuns((await window.overheadBackend.listFeatureRecords('automation')).filter((item) => item.kind === 'run')) }
    catch (reason) { setError(String(reason?.message || 'Automation rules are unavailable.')) }
  }
  useEffect(() => { if (sessionRole === 'Owner') refresh() }, [sessionRole])

  async function saveRule() {
    if (!name.trim() || !actionText.trim()) { setError('Add a rule name and the task title to create.'); return }
    try {
      await window.overheadBackend.upsertFeatureRecord({ collection: 'automation', record: { id: crypto.randomUUID(), kind: 'rule', name: name.trim().slice(0, 100), trigger, condition: condition.trim().slice(0, 120), action: 'create_task', action_text: actionText.trim().slice(0, 180), enabled: true, last_triggered_ids: [] } })
      setName(''); setError(''); await refresh(); setOperationNotice('Automation rule saved to the encrypted local workspace.')
    } catch (reason) { setError(String(reason?.message || 'The automation rule could not be saved.')) }
  }
  async function toggleRule(rule) {
    try { await window.overheadBackend.upsertFeatureRecord({ collection: 'automation', record: { ...rule, enabled: !rule.enabled } }); await refresh() }
    catch (reason) { setError(String(reason?.message || 'The rule state could not be changed.')) }
  }
  async function removeRule(rule) {
    try { await window.overheadBackend.deleteFeatureRecord({ collection: 'automation', recordId: rule.id }); await refresh() }
    catch (reason) { setError(String(reason?.message || 'The rule could not be removed.')) }
  }
  async function evaluateRules() {
    if (sessionRole !== 'Owner') { setError('Only the workspace Owner can run automation rules.'); return }
    const audit = backendState.auditEvents || []
    const invoices = backendState.invoices || []
    let created = 0
    try {
      const detailsFor = (event) => { try { return typeof event.details === 'string' ? JSON.parse(event.details) : event.details || {} } catch { return {} } }
      for (const rule of rules.filter((item) => item.enabled)) {
        let matches = []
        if (rule.trigger === 'customer.created') matches = audit.filter((item) => item.event_type === 'customer.created')
        if (rule.trigger === 'quote.status_updated') matches = audit.filter((item) => item.event_type === 'quote.status_updated' && (!rule.condition || String(detailsFor(item).status || '').toLowerCase() === rule.condition.toLowerCase()))
        if (rule.trigger === 'invoice.overdue') matches = invoices.filter((item) => item.status !== 'Paid' && item.due_date && Date.parse(item.due_date) < Date.now()).map((item) => ({ id: item.id, details: { title: item.title, status: item.status } }))
        if (rule.trigger === 'task.deadline_due') matches = (backendState.tasks || []).filter((item) => item.status !== 'Complete' && item.due_at && Date.parse(item.due_at) <= Date.now()).map((item) => ({ id: item.id, details: { title: item.title, status: item.status } }))
        const seen = new Set(rule.last_triggered_ids || [])
        for (const match of matches.slice(0, 20)) {
          if (seen.has(match.id)) continue
          const target = match.details?.title || match.details?.status || rule.trigger.replace('.', ' ')
          await window.overheadBackend.queueWorkflowJob({ type: 'workflow.rule', title: `${rule.action_text}: ${target}`.slice(0, 180), payload: { ruleId: rule.id, sourceId: match.id } })
          seen.add(match.id); created += 1
        }
        if (matches.length) await window.overheadBackend.upsertFeatureRecord({ collection: 'automation', record: { ...rule, last_triggered_ids: [...seen].slice(-100) } })
        if (matches.length) await window.overheadBackend.upsertFeatureRecord({ collection: 'automation', record: { id: crypto.randomUUID(), kind: 'run', rule_id: rule.id, rule_name: rule.name, trigger: rule.trigger, matched: matches.length, queued: Math.min(matches.length, 20), created_at: new Date().toISOString(), outcome: 'Queued local tasks' } })
      }
      setError(''); await refresh(); await refreshBackend(); setOperationNotice(`${created} local workflow task${created === 1 ? '' : 's'} queued from matching events.`)
    } catch (reason) { setError(String(reason?.message || 'The automation run stopped. Review the workflow queue for partial results.')); await refresh() }
  }
  if (sessionRole !== 'Owner') return <section className="panel page-panel"><h2>Automation rules</h2><p>Rule creation and permission controls are restricted to the workspace Owner. Your existing workflow queue remains available in Automation Control.</p></section>
  const deadJobs = (backendState.workflowJobs || []).filter((job) => job.status === 'Dead Letter')
  const visibleRules = rules.filter((rule) => `${rule.name} ${rule.trigger} ${rule.action_text}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return <section className="panel page-panel" aria-labelledby="automation-studio-title">
    <div className="section-head"><div><p className="eyebrow">Owner controls</p><h2 id="automation-studio-title">No-code automation rules</h2></div><button className="primary-action" type="button" onClick={evaluateRules}>Evaluate current records</button></div>
    <p>Rules inspect local audit events and operational records, then queue deduplicated local tasks. They never send customer messages automatically.</p>
    <div className="profile-form compact-form">
      <label>Rule name<input style={style} value={name} onChange={(event) => setName(event.target.value)} placeholder="Review newly added customers" /></label>
      <label>When<select style={style} value={trigger} onChange={(event) => setTrigger(event.target.value)}>{events.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
      {trigger === 'quote.status_updated' && <label>Only when status equals<input style={style} value={condition} onChange={(event) => setCondition(event.target.value)} placeholder="Accepted (blank means any change)" /></label>}
      <label>Create task titled<input style={style} value={actionText} onChange={(event) => setActionText(event.target.value)} placeholder="Review this record" /></label>
      <button className="primary-action" type="button" onClick={saveRule}>Save rule</button>
    </div>
    <label>Find rules<input style={style} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rule names and triggers" /></label>
    <div className="task-list">{visibleRules.map((rule) => <div className="task-row" key={rule.id}><strong>{rule.name}<small style={{ display: 'block', color: 'var(--muted)' }}>{events.find(([id]) => id === rule.trigger)?.[1]} → {rule.action_text}</small></strong><span>{rule.enabled ? 'Active' : 'Paused'}</span><button className="ghost-button" type="button" onClick={() => toggleRule(rule)}>{rule.enabled ? 'Pause' : 'Resume'}</button><button className="ghost-button" type="button" onClick={() => removeRule(rule)}>Delete</button></div>)}{!visibleRules.length && <p className="queue-empty">No rules have been saved.</p>}</div>
    <div className="dashboard-grid"><article className="backend-health"><strong>Error inbox · {deadJobs.length}</strong>{deadJobs.slice(0, 8).map((job) => <p key={job.id}>{job.title}: {job.last_error || 'No error detail recorded.'}</p>)}{!deadJobs.length && <p>No failed workflow jobs need attention.</p>}</article><article className="backend-health"><strong>Run history</strong>{runs.slice(-10).reverse().map((run) => <p key={run.id}>{new Date(run.created_at).toLocaleString()} · {run.rule_name} · {run.queued} queued</p>)}{!runs.length && <p>Automation runs will appear here.</p>}</article></div>
    <div className="backend-health"><strong>Permission boundary</strong><p>Only Owners can create, change, evaluate, or remove rules. Actions queue local tasks for review; external delivery is disabled.</p></div>
    {error && <p className="form-error">{error}</p>}
  </section>
}
