import { useEffect, useMemo, useState } from 'react'
import { FeatureTabs, useFeatureRecords } from './FeatureWave101Helpers'

const DONE = new Set(['Done', 'Complete', 'Completed', 'Canceled', 'Rejected'])
const formatHours = (seconds) => (Math.max(0, seconds) / 3600).toFixed(2)

export default function WorkPlanner({ backendState = {}, session = {}, setOperationNotice = () => {} }) {
  const { records, save, refresh, loading, error } = useFeatureRecords('tasks')
  const [tab, setTab] = useState('flow')
  const [clock, setClock] = useState(() => { try { return JSON.parse(localStorage.getItem('overhead.workTimer.v1') || 'null') } catch { return null } })
  const [elapsed, setElapsed] = useState(0)
  const [timerTaskId, setTimerTaskId] = useState('')
  const [handoffTaskId, setHandoffTaskId] = useState('')
  const [assignId, setAssignId] = useState('')
  const [assignee, setAssignee] = useState('')
  const [handoff, setHandoff] = useState('')
  const [checklistName, setChecklistName] = useState('')
  const [checklistRole, setChecklistRole] = useState('Front Desk')
  const [checklistText, setChecklistText] = useState('')
  const [checklists, setChecklists] = useState([])
  const [checklistDraft, setChecklistDraft] = useState('')
  const [mention, setMention] = useState('')
  const [mentionText, setMentionText] = useState('')

  const tasks = useMemo(() => records.filter((record) => !record.kind), [records])
  const capacities = useMemo(() => records.filter((record) => record.kind === 'team_capacity'), [records])
  const events = useMemo(() => records.filter((record) => record.kind === 'task_event' || record.kind === 'task_watch_notice'), [records])
  const openTasks = useMemo(() => tasks.filter((task) => !DONE.has(task.status)), [tasks])
  const profileNames = useMemo(() => (backendState.userProfiles || []).filter((profile) => profile.status !== 'Suspended').map((profile) => profile.email || profile.ownerName).filter(Boolean), [backendState.userProfiles])

  useEffect(() => {
    let timerId
    const tick = () => setElapsed(clock?.startedAt ? Math.floor((Date.now() - Date.parse(clock.startedAt)) / 1000) : 0)
    tick()
    if (clock?.startedAt) timerId = window.setInterval(tick, 1000)
    return () => window.clearInterval(timerId)
  }, [clock])
  useEffect(() => { try { if (clock) localStorage.setItem('overhead.workTimer.v1', JSON.stringify(clock)); else localStorage.removeItem('overhead.workTimer.v1') } catch {} }, [clock])
  useEffect(() => {
    let active = true
    window.overheadBackend?.listFeatureRecords?.('tasks').then((rows) => { if (active) setChecklists(rows.filter((row) => row.kind === 'role_checklist_template')) }).catch(() => {})
    return () => { active = false }
  }, [])

  const dependencyRows = tasks.map((task) => {
    const dependencyId = typeof task.depends_on === 'string' ? task.depends_on : ''
    const dependency = tasks.find((item) => item.id === dependencyId)
    return { task, dependency, blocked: Boolean(dependency && !DONE.has(dependency.status)) }
  }).filter(({ task, dependency }) => task.depends_on || dependency)
  const today = new Date().toISOString().slice(0, 10)
  const escalationRows = openTasks.filter((task) => task.due && task.due < today).map((task) => {
    const overdueDays = Math.max(0, Math.floor((Date.now() - Date.parse(`${task.due}T12:00:00`)) / 86400000))
    const threshold = Math.max(1, Number(task.escalationDays) || 3)
    return { task, overdueDays, threshold, next: Math.max(0, threshold - overdueDays) }
  }).sort((a, b) => b.overdueDays - a.overdueDays)
  const capacityRows = capacities.map((capacity) => {
    const estimate = openTasks.filter((task) => String(task.assignee || '').toLowerCase() === String(capacity.owner || '').toLowerCase()).reduce((sum, task) => sum + Math.max(0, Number(task.estimate) || 0), 0)
    const limit = Math.max(0, Number(capacity.weeklyHours) || 0)
    return { owner: capacity.owner || 'Unassigned', estimate, limit, ratio: limit ? estimate / limit : 0 }
  })
  const selectedTask = tasks.find((task) => task.id === assignId)
  const beforeCount = openTasks.filter((task) => String(task.assignee || '').toLowerCase() === String(selectedTask?.assignee || '').toLowerCase()).length
  const afterCount = openTasks.filter((task) => String(task.assignee || '').toLowerCase() === String(assignee || '').toLowerCase()).length + (String(selectedTask?.assignee || '').toLowerCase() === String(assignee || '').toLowerCase() ? 0 : 1)

  async function saveChecklist() {
    if (!checklistName.trim() || !checklistText.trim()) return
    const row = await window.overheadBackend.upsertFeatureRecord({ collection: 'tasks', record: { id: crypto.randomUUID(), kind: 'role_checklist_template', title: checklistName.trim(), role: checklistRole, items: checklistText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 40), status: 'Active' } })
    setChecklists((current) => [row, ...current].slice(0, 60)); setChecklistName(''); setChecklistText(''); setOperationNotice('Role checklist saved in the encrypted workspace.')
  }
  async function startTimer() {
    if (!timerTaskId) return
    const selected = tasks.find((task) => task.id === timerTaskId)
    setClock({ taskId: timerTaskId, title: selected?.title || 'Work session', startedAt: new Date().toISOString() })
    setOperationNotice('Work timer started on this device.')
  }
  async function saveTimer() {
    if (!clock?.startedAt) return
    const seconds = Math.max(60, Math.floor((Date.now() - Date.parse(clock.startedAt)) / 1000))
    await window.overheadBackend.upsertFeatureRecord({ collection: 'scheduling', record: { id: crypto.randomUUID(), kind: 'time_entry', title: clock.title, taskId: clock.taskId, person: session.email || session.ownerName || 'Current user', date: today, hours: Number(formatHours(seconds)), status: 'Submitted', startedAt: clock.startedAt, endedAt: new Date().toISOString(), notes: 'Recorded from the task timer.' } })
    setClock(null); setOperationNotice(`Saved ${formatHours(seconds)} hours as a submitted time entry.`)
  }
  async function applyAssignment() {
    if (!selectedTask || !assignee) return
    await save({ ...selectedTask, assignee, revisionHistory: [...(selectedTask.revisionHistory || []), { at: new Date().toISOString(), by: session.email || 'Workspace user', changes: [{ field: 'assignee', before: selectedTask.assignee || '', after: assignee }] }].slice(-20) })
    setOperationNotice(`Assigned ${selectedTask.title || 'task'} to ${assignee}.`); setAssignId(''); setAssignee('')
  }
  async function exportHandoff() {
    const selected = openTasks.filter((task) => !handoffTaskId || task.id === handoffTaskId)
    const body = [`OverHead shift handoff · ${new Date().toLocaleString()}`, `Prepared by: ${session.ownerName || session.email || 'Workspace user'}`, '', 'Open work', ...selected.map((task) => `• ${task.title} · ${task.status || 'Open'} · ${task.assignee || 'Unassigned'} · due ${task.due || 'unscheduled'}${task.notes ? ` · ${task.notes}` : ''}`), '', `Notes: ${handoff || 'No extra handoff notes.'}`].join('\n')
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
    const href = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = href; link.download = `overhead-handoff-${today}.txt`; link.click(); URL.revokeObjectURL(href)
    setOperationNotice(`Handoff packet exported with ${selected.length} open task${selected.length === 1 ? '' : 's'}.`)
  }
  function addMention() { if (!mention) return; setMentionText((text) => `${text}${text ? ' ' : ''}@${mention}`); setMention('') }
  async function useChecklist(item) { setChecklistDraft(item.items.join('\n')); setOperationNotice(`Loaded ${item.title} checklist for ${item.role}.`) }

  const tabs = [{ id: 'flow', label: 'Dependencies and escalation' }, { id: 'capacity', label: 'Capacity and assignment' }, { id: 'time', label: 'Timer and handoff' }, { id: 'team', label: 'Team tools' }]
  return <section className="work-planner">
    <div className="section-head"><div><p className="eyebrow">Operations workbench</p><h2>Plan, review, and hand off work</h2><p className="panel-copy">A single view for task dependencies, team capacity, time capture, and shift handoffs.</p></div><span className="record-count">{openTasks.length} open tasks</span></div>
    <FeatureTabs tabs={tabs} active={tab} onChange={setTab} />
    {(error || loading) && <p className={error ? 'form-error' : 'queue-empty'}>{error || 'Loading encrypted task workspace…'}</p>}
    {tab === 'flow' && <div className="work-planner-grid">
      <article className="panel"><h3>Task dependency map</h3><p className="panel-copy">See prerequisites and blocked work. Manage dependencies in Growth &amp; Work.</p>{dependencyRows.length ? dependencyRows.map(({ task, dependency, blocked }) => <div className="planner-row" key={task.id}><strong>{task.title || 'Untitled task'}</strong><span>{blocked ? 'Blocked' : 'Ready'} · {task.status || 'Open'}</span><small>{dependency ? `Waiting for: ${dependency.title || dependency.id} (${dependency.status || 'Open'})` : 'Prerequisite not found'}</small></div>) : <p className="queue-empty">No task dependencies are configured.</p>}</article>
      <article className="panel"><h3>Escalation timeline</h3><p className="panel-copy">Shows overdue tasks and the remaining days before their configured escalation threshold.</p>{escalationRows.length ? escalationRows.slice(0, 12).map(({ task, overdueDays, threshold, next }) => <div className="planner-row" key={task.id}><strong>{task.title || 'Untitled task'}</strong><span>{overdueDays} day{overdueDays === 1 ? '' : 's'} overdue · threshold {threshold} days</span><small>{task.escalatedAt ? `Escalated ${new Date(task.escalatedAt).toLocaleString()}${task.escalatedTo ? ` to ${task.escalatedTo}` : ''}` : next ? `${next} day${next === 1 ? '' : 's'} until escalation` : 'Ready for escalation review'}</small></div>) : <p className="queue-empty">No overdue tasks need escalation.</p>}</article>
    </div>}
    {tab === 'capacity' && <div className="work-planner-grid">
      <article className="panel"><h3>Weekly availability heat map</h3><p className="panel-copy">Compare assigned estimates against each teammate’s weekly capacity.</p>{capacityRows.length ? capacityRows.map((row) => <div className="capacity-row" key={row.owner}><div><strong>{row.owner}</strong><span>{row.estimate.toFixed(1)} / {row.limit.toFixed(1)} hours</span></div><div className="capacity-track"><i style={{ width: `${Math.min(100, Math.max(4, row.ratio * 100))}%`, background: row.ratio > 1 ? 'var(--danger, #c54848)' : 'var(--accent)' }} /></div><small>{row.limit ? `${Math.round(row.ratio * 100)}% loaded` : 'Set weekly hours in People / Growth'}</small></div>) : <p className="queue-empty">Add a team capacity record to see planned availability.</p>}</article>
      <article className="panel"><h3>Reassignment preview</h3><p className="panel-copy">Review the workload change before moving a task.</p><label>Task<select value={assignId} onChange={(event) => { setAssignId(event.target.value); setAssignee('') }}><option value="">Choose an open task</option>{openTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label><label>New assignee<select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Choose a teammate</option>{profileNames.map((email) => <option key={email}>{email}</option>)}</select></label>{selectedTask && <div className="review-diff"><p><strong>{selectedTask.assignee || 'Unassigned'}</strong> currently has {beforeCount} open task{beforeCount === 1 ? '' : 's'}.</p><p><strong>{assignee || 'Choose a teammate'}</strong> would have {assignee ? afterCount : '—'} open tasks after reassignment.</p><button className="primary-action" type="button" disabled={!assignee} onClick={() => applyAssignment().catch((reason) => setOperationNotice(reason.message))}>Apply assignment</button></div>}</article>
    </div>}
    {tab === 'time' && <div className="work-planner-grid">
      <article className="panel"><h3>Task timer</h3><p className="panel-copy">Timer state stays on this device. Saving creates an encrypted submitted time entry.</p><label>Task<select value={timerTaskId} onChange={(event) => setTimerTaskId(event.target.value)} disabled={Boolean(clock)}><option value="">Choose a task</option>{openTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>{clock ? <><p className="timer-readout">{Math.floor(elapsed / 3600).toString().padStart(2, '0')}:{Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')}:{(elapsed % 60).toString().padStart(2, '0')}</p><strong>{clock.title}</strong><div className="button-row"><button className="primary-action" type="button" onClick={() => saveTimer().catch((reason) => setOperationNotice(reason.message))}>Stop and save time</button><button className="ghost-button" type="button" onClick={() => setClock(null)}>Discard timer</button></div></> : <button className="primary-action" type="button" disabled={!timerTaskId} onClick={startTimer}>Start task timer</button>}</article>
      <article className="panel"><h3>Shift handoff packet</h3><p className="panel-copy">Prepare a local text handoff from the current open task list. Review it before sharing.</p><label>Handoff note<textarea rows="4" maxLength="1000" value={handoff} onChange={(event) => setHandoff(event.target.value)} placeholder="What should the next person know?" /></label><label>Limit packet to task<select value={handoffTaskId} onChange={(event) => setHandoffTaskId(event.target.value)}><option value="">All open tasks</option>{openTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label><button className="primary-action" type="button" onClick={exportHandoff}>Review and export handoff</button><small>The exported file may include internal notes. Store it with the same care as workspace data.</small></article>
    </div>}
    {tab === 'team' && <div className="work-planner-grid">
      <article className="panel"><h3>Role-specific checklists</h3><p className="panel-copy">Save and reuse operational checklists by staff role.</p><label>Checklist name<input value={checklistName} onChange={(event) => setChecklistName(event.target.value)} maxLength="80" /></label><label>Role<select value={checklistRole} onChange={(event) => setChecklistRole(event.target.value)}>{['Owner', 'Front Desk', 'Bookkeeper', 'Support'].map((role) => <option key={role}>{role}</option>)}</select></label><label>Steps, one per line<textarea rows="4" value={checklistText} onChange={(event) => setChecklistText(event.target.value)} /></label><button className="primary-action" type="button" onClick={() => saveChecklist().catch((reason) => setOperationNotice(reason.message))}>Save checklist</button>{checklists.map((item) => <div className="planner-row" key={item.id}><strong>{item.title} · {item.role}</strong><span>{item.items?.length || 0} steps</span><button className="text-button" type="button" onClick={() => useChecklist(item)}>Load</button></div>)}{checklistDraft && <label>Loaded checklist<textarea rows="4" value={checklistDraft} onChange={(event) => setChecklistDraft(event.target.value)} /></label>}</article>
      <article className="panel"><h3>Teammate mention picker</h3><p className="panel-copy">Choose a workspace teammate to add a consistent mention to handoff or meeting notes.</p><div className="button-row"><select value={mention} onChange={(event) => setMention(event.target.value)}><option value="">Choose a teammate</option>{profileNames.map((email) => <option key={email}>{email}</option>)}</select><button className="ghost-button" type="button" disabled={!mention} onClick={addMention}>Add mention</button></div><label>Draft note<textarea rows="4" value={mentionText} onChange={(event) => setMentionText(event.target.value)} placeholder="Add a note and insert teammate mentions." /></label><small>Mentions are inserted into this draft. No message is sent automatically.</small></article>
    </div>}
    <p className="planner-footnote">{openTasks.length} open tasks · {events.length} task event records · {profileNames.length} team profiles</p>
  </section>
}
