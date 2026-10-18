import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, CircleHelp, Columns3, Download, Plus, Search, Star, Trash2 } from 'lucide-react'
import './GrowthWorkspace.css'

const areas = [
  { id: 'dashboard', label: 'Dashboard', title: 'Dashboard & navigation', fields: ['title', 'kind', 'metric', 'value', 'goal', 'previous_value', 'period', 'filter', 'notes'] },
  { id: 'tasks', label: 'Tasks', title: 'Tasks & workflow', fields: ['title', 'status', 'priority', 'assignee', 'due', 'labels', 'customer', 'project', 'estimate', 'checklist', 'template', 'recurrence', 'depends_on', 'watchers', 'approvals', 'escalationDays', 'escalationOwner', 'notes'] },
  { id: 'projects', label: 'Projects', title: 'Projects & planning', fields: ['title', 'status', 'health', 'owner', 'budget', 'actualCost', 'capacity', 'milestone', 'risk', 'riskOwner', 'riskSeverity', 'riskReviewed', 'decision', 'dependency', 'start', 'due', 'stage', 'resources', 'intakeRationale', 'notes'] },
  { id: 'customers', label: 'Customers', title: 'Customers & accounts', fields: ['title', 'segment', 'health', 'stage', 'owner', 'contacts', 'consent', 'preferences', 'renewal', 'risk', 'notes'] },
  { id: 'sales', label: 'Sales', title: 'Sales & opportunities', fields: ['title', 'stage', 'amount', 'probability', 'owner', 'territory', 'lead_score', 'source', 'close_date', 'lost_reason', 'commission', 'notes'] },
]

const defaults = {
  dashboard: ['Pipeline', 'Open tasks', 'Project health', 'Renewals'],
  tasks: ['New task', 'In progress', 'Waiting', 'Done'],
  projects: ['Planning', 'Active', 'At risk', 'Complete'],
  customers: ['Prospect', 'Onboarding', 'Active', 'Renewal'],
  sales: ['Lead', 'Qualified', 'Proposal', 'Won', 'Lost'],
}

const fieldLabels = {
  title: 'Name', kind: 'Widget type', metric: 'Metric', value: 'Current value', goal: 'Goal', previous_value: 'Previous period value', period: 'Comparison period', filter: 'Filter by status', notes: 'Notes',
  status: 'Status', priority: 'Priority', assignee: 'Assigned to', due: 'Due date', labels: 'Labels', customer: 'Customer', project: 'Project', estimate: 'Estimate (hours)', checklist: 'Checklist items', template: 'Template', recurrence: 'Repeat rule', depends_on: 'Depends on', watchers: 'Watchers (account emails, comma separated)', approvals: 'Approval steps (one account email per line)', escalationDays: 'Escalate after overdue days', escalationOwner: 'Escalation owner',
  health: 'Health (computed from risk/status)', owner: 'Owner', budget: 'Budget', actualCost: 'Actual cost to date', capacity: 'Capacity (hours)', milestone: 'Milestones (one per line)', risk: 'Risk description', riskOwner: 'Risk owner', riskSeverity: 'Risk severity', riskReviewed: 'Risk review date', decision: 'Decision log (one per line)', dependency: 'Depends on project', start: 'Start date', stage: 'Stage', resources: 'Resources', intakeRationale: 'Intake rationale',
  segment: 'Segment', contacts: 'Contacts / roles', consent: 'Consent', preferences: 'Communication preferences', renewal: 'Renewal date', amount: 'Deal amount', probability: 'Probability (%)', territory: 'Territory', lead_score: 'Lead score', source: 'Lead source', close_date: 'Expected close', lost_reason: 'Lost reason', commission: 'Commission estimate',
}
const contextualHelp = {
  dashboard: 'Each named workspace stores its own card order for your signed-in account. Set a metric, goal, previous-period value, and optional status filter on a card; workspace records remain shared according to their existing role permissions.',
  tasks: 'Use dependencies to block completion until prerequisite tasks are done. Recurrence creates the next item only when you choose Generate next occurrence. Reminder and watcher entries stay in the encrypted local workspace; no email or push notice is sent.',
  projects: 'Project health is calculated from status, overdue dates, and risk severity. The Active stage gate requires an owner, date range, rationale, and completed dependency. Budget actuals are entered manually, and linked resource bookings are checked for time overlap.',
}

export default function GrowthWorkspace({ session }) {
  const [area, setArea] = useState('dashboard')
  const [records, setRecords] = useState([])
  const [all, setAll] = useState({})
  const [draft, setDraft] = useState({})
  const [editing, setEditing] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [labelFilter, setLabelFilter] = useState('All')
  const [view, setView] = useState('List')
  const [workspace, setWorkspace] = useState('My workspace')
  const [presets, setPresets] = useState(['My workspace', 'Sales', 'Operations'])
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [layout, setLayout] = useState(['Open tasks', 'Project health', 'Pipeline'])
  const [refreshedAt, setRefreshedAt] = useState(null)
  const [customerOptions, setCustomerOptions] = useState([])
  const [showHelp, setShowHelp] = useState(false)
  const [projectMonth, setProjectMonth] = useState(new Date().toISOString().slice(0, 7))

  const current = areas.find((item) => item.id === area)
  const userKey = String(session?.email || session?.ownerName || 'workspace').trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_')
  const load = useCallback(async () => {
    if (!window.overheadBackend?.listFeatureRecords) return
    setBusy(true)
    try {
      const collections = [...areas.map((item) => item.id), 'documents', 'scheduling']
      const results = await Promise.all(collections.map(async (collection) => {
        try { return [collection, await window.overheadBackend.listFeatureRecords(collection)] }
        catch { return [collection, []] }
      }))
      const saved = Object.fromEntries(results)
      if (area === 'tasks') {
        const today = new Date().toISOString().slice(0, 10)
        let tasks = saved.tasks || []
        const taskNotices = []
        for (const task of [...tasks].filter((item) => !item.kind && item.due && item.due <= today && !['Done', 'Complete', 'Approved', 'Rejected'].includes(item.status))) {
          const hasReminder = tasks.some((item) => item.kind === 'task_reminder' && item.taskId === task.id && item.due === task.due)
          if (!hasReminder) {
            const reminder = await window.overheadBackend.upsertFeatureRecord({ collection: 'tasks', record: { kind: 'task_reminder', taskId: task.id, taskTitle: task.title, due: task.due, status: 'Due', triggeredAt: new Date().toISOString(), recipient: task.assignee || '' } })
            tasks = [...tasks, reminder]
          }
          const daysOverdue = Math.max(0, Math.floor((new Date(`${today}T12:00:00`) - new Date(`${task.due}T12:00:00`)) / 86400000))
          if (task.escalationDays && daysOverdue >= Number(task.escalationDays) && task.status !== 'Escalated') {
            const escalated = await window.overheadBackend.upsertFeatureRecord({ collection: 'tasks', record: { ...task, status: 'Escalated', priority: task.priority === 'Urgent' ? 'Urgent' : 'High', escalatedAt: new Date().toISOString(), escalatedTo: task.escalationOwner || '' } })
            tasks = tasks.map((item) => item.id === escalated.id ? escalated : item)
            const alert = await window.overheadBackend.upsertFeatureRecord({ collection: 'tasks', record: { id: `escalation:${task.id}:${task.due}`, kind: 'task_watch_notice', taskId: task.id, taskTitle: task.title, recipient: '', message: `Automatically escalated after ${daysOverdue} overdue day(s)${task.escalationOwner ? ` · assigned escalation owner: ${task.escalationOwner}` : ''}`, at: new Date().toISOString(), readAt: '' } })
            taskNotices.push(alert)
          }
        }
        saved.tasks = [...tasks, ...taskNotices]
      }
      setAll(saved)
      setRecords(saved[area] || [])
      setRefreshedAt(new Date())
      if (window.overheadBackend?.listCustomers) {
        try { setCustomerOptions(await window.overheadBackend.listCustomers()) }
        catch { setCustomerOptions([]) }
      }
      const prefs = saved.dashboard || []
      const savedLayout = prefs.find((item) => item.id === `layout:${userKey}:${workspace}`)?.items
      setLayout(Array.isArray(savedLayout) ? savedLayout : ['Open tasks', 'Project health', 'Pipeline'])
      const savedPresets = prefs.find((item) => item.id === `workspace-presets:${userKey}`)?.items
      if (Array.isArray(savedPresets)) setPresets([...new Set(['My workspace', ...savedPresets])])
      setNotice('Workspace changes save to OverHead’s encrypted local store.')
    } catch (error) {
      setNotice(error?.message || 'Could not load saved workspace records.')
    } finally { setBusy(false) }
  }, [area, workspace, userKey])
  useEffect(() => { setRecords(all[area] || []); setDraft({}); setEditing(''); setFilter('All'); setQuery('') }, [area, all])
  useEffect(() => { load() }, [load])

  const stageOptions = useMemo(() => [...new Set([...(defaults[area] || []), ...records.filter((item) => !item.kind).map((item) => item.status || item.stage).filter(Boolean)])], [area, records])
  const visible = records.filter((record) => !['template', 'project_decision', 'project_risk', 'project_report', 'task_reminder', 'task_watch_notice', 'assignment_rule'].includes(record.kind)).filter((record) => {
    const matches = `${record.title || ''} ${record.name || ''} ${record.notes || ''} ${record.customer || ''}`.toLowerCase().includes(query.toLowerCase())
    const value = record.status || record.stage || 'Open'
    const labels = String(record.labels || '').split(',').map((label) => label.trim()).filter(Boolean)
    return matches && (filter === 'All' || value === filter) && (area !== 'tasks' || labelFilter === 'All' || labels.includes(labelFilter))
  })
  const taskReminders = area === 'tasks' ? records.filter((record) => record.kind === 'task_reminder') : []
  const taskNotices = area === 'tasks' ? records.filter((record) => record.kind === 'task_watch_notice' && (!record.recipient || String(record.recipient).toLowerCase() === String(session?.email || '').toLowerCase())) : []
  const assignmentRules = area === 'tasks' ? records.filter((record) => record.kind === 'assignment_rule' && record.enabled !== false) : []
  const projectRisks = area === 'projects' ? records.filter((record) => record.kind === 'project_risk') : []
  const projectDecisions = area === 'projects' ? records.filter((record) => record.kind === 'project_decision') : []
  const projectReports = area === 'projects' ? records.filter((record) => record.kind === 'project_report') : []
  const dashboardValue = (card, label) => {
    const rowsFor = (name) => (all[name] || []).filter((row) => !card?.filter || card.filter === 'All' || (row.status || row.stage || 'Open') === card.filter)
    const metric = card?.metric || label
    if (metric === 'Open tasks') return rowsFor('tasks').filter((item) => !item.kind && item.status !== 'Done' && item.status !== 'Complete').length
    if (metric === 'Pipeline') return rowsFor('sales').filter((item) => !item.kind || item.kind === 'opportunity').length
    if (metric === 'Project budget variance') return rowsFor('projects').filter((item) => !item.kind).reduce((sum, item) => sum + Number(item.budget || 0) - Number(item.actualCost || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
    if (metric === 'Overdue tasks') return rowsFor('tasks').filter((item) => !item.kind && item.due && new Date(`${item.due}T23:59:59`) < new Date() && !['Done', 'Complete'].includes(item.status)).length
    if (metric === 'Project health') { const projects = rowsFor('projects').filter((item) => !item.kind); const atRisk = projects.filter((item) => item.status === 'At risk' || item.health === 'At risk' || item.riskSeverity === 'High' || item.riskSeverity === 'Critical').length; return `${projects.length - atRisk} / ${projects.length} healthy` }
    return card?.value || '—'
  }
  const save = async (record = draft) => {
    const title = String(record.title || '').trim()
    if (!title) { setNotice('Add a name before saving.'); return }
    try {
      if (area === 'tasks' && record.depends_on) {
        const dependency = records.find((item) => item.id === record.depends_on || item.title.toLowerCase() === String(record.depends_on).toLowerCase())
        if (!dependency) { setNotice('Choose an existing task by title or ID for this dependency.'); return }
        if (['Done', 'Complete'].includes(record.status) && !['Done', 'Complete'].includes(dependency.status)) { setNotice(`Complete “${dependency.title}” before closing this task.`); return }
      }
      if (area === 'projects' && record.dependency && (record.status === 'Active' || record.stage === 'Active')) {
        const dependency = records.find((item) => item.id === record.dependency)
        if (dependency && dependency.status !== 'Complete') { setNotice(`Complete project “${dependency.title}” before starting this project.`); return }
      }
      if (area === 'projects' && record.status === 'Active' && (!record.owner || !record.start || !record.due || !record.intakeRationale)) { setNotice('The Active stage gate needs an owner, start date, due date, and intake rationale.'); return }
      const checklistItems = area === 'tasks' && typeof record.checklist === 'string' ? record.checklist.split(/\r?\n/).map((text) => text.trim()).filter(Boolean).map((text) => ({ text, done: (record.checklistItems || []).some((item) => item.text === text && item.done) })) : record.checklistItems
      const milestoneItems = area === 'projects' && typeof record.milestone === 'string' ? record.milestone.split(/\r?\n/).map((text) => text.trim()).filter(Boolean).map((text) => ({ text, done: (record.milestoneItems || []).some((item) => item.text === text && item.done) })) : record.milestoneItems
      const previousRecord = records.find((item) => item.id === record.id)
      const payload = { ...record, ...(checklistItems ? { checklistItems } : {}), ...(milestoneItems ? { milestoneItems } : {}), title, status: record.status || record.stage || defaults[area]?.[0] || 'Open' }
      if (area === 'tasks' && !record.id && !payload.assignee) {
        const rule = assignmentRules.find((item) => (!item.priority || item.priority === 'Any' || item.priority === payload.priority) && (!item.project || item.project === payload.project) && (!item.customer || item.customer === payload.customer))
        if (rule) payload.assignee = rule.assignee
      }
      if (area === 'tasks' && payload.approvals && payload.approvals !== previousRecord?.approvals) { payload.approvalState = 'Pending'; payload.approvalIndex = 0; payload.status = 'In approval' }
      if (area === 'projects') {
        const overdue = payload.due && new Date(`${payload.due}T23:59:59`) < new Date() && !['Complete', 'Archived'].includes(payload.status)
        payload.health = ['At risk', 'Blocked'].includes(payload.status) || ['High', 'Critical'].includes(payload.riskSeverity) || overdue ? 'At risk' : payload.status === 'Complete' ? 'Complete' : 'On track'
      }
      const saved = await window.overheadBackend.upsertFeatureRecord({ collection: area, record: payload })
      const updated = [...records.filter((item) => item.id !== saved.id), saved]
      setRecords(updated); setAll((state) => ({ ...state, [area]: updated })); setDraft({}); setEditing('')
      if (area === 'projects' && previousRecord?.decision !== saved.decision && saved.decision) {
        const decisionRecord = await window.overheadBackend.upsertFeatureRecord({ collection: 'projects', record: { kind: 'project_decision', projectId: saved.id, project: saved.title, decision: saved.decision, owner: saved.owner || '', decidedAt: new Date().toISOString() } })
        setRecords((currentRecords) => [...currentRecords, decisionRecord]); setAll((state) => ({ ...state, projects: [...(state.projects || []), decisionRecord] }))
      }
      if (area === 'tasks' && saved.watchers) {
        const watchers = [...new Set(String(saved.watchers).split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))]
        const notices = await Promise.all(watchers.map((recipient) => window.overheadBackend.upsertFeatureRecord({ collection: 'tasks', record: { id: `watch:${saved.id}:${Date.now()}:${encodeURIComponent(recipient)}`, kind: 'task_watch_notice', taskId: saved.id, taskTitle: saved.title, recipient, message: `Task ${previousRecord ? 'updated' : 'created'}`, at: new Date().toISOString(), readAt: '' } })))
        if (notices.length) {
          const next = [...updated, ...notices]
          setRecords(next); setAll((state) => ({ ...state, tasks: [...(state.tasks || []), ...notices] }))
        }
      }
      if (area === 'dashboard' && !layout.includes(title)) saveLayout([...layout, title])
      setNotice(`${current.label} record saved.`)
    } catch (error) { setNotice(error?.message || 'Record could not be saved.') }
  }
  const remove = async (record) => {
    if (!record.id || record.id.startsWith('layout:')) return
    try { await window.overheadBackend.deleteFeatureRecord({ collection: area, recordId: record.id }); const updated = records.filter((item) => item.id !== record.id); setRecords(updated); setAll((state) => ({ ...state, [area]: updated })); setNotice('Record removed.') }
    catch (error) { setNotice(error?.message || 'Record could not be removed.') }
  }
  const saveTemplate = async (record) => {
    const templateData = Object.fromEntries(current.fields.map((key) => [key, record[key] ?? '']))
    const saved = await window.overheadBackend.upsertFeatureRecord({ collection: area, record: { kind: 'template', title: `${record.title || 'Reusable'} template`, templateData } })
    const updated = [...records.filter((item) => item.id !== saved.id), saved]
    setRecords(updated); setAll((state) => ({ ...state, [area]: updated })); setNotice(`Template “${saved.title}” saved.`)
  }
  const applyTemplate = (template) => startEdit({ ...template.templateData, template: template.title })
  const toggleChecklistItem = async (record, index) => {
    const items = (record.checklistItems || String(record.checklist || '').split(/\r?\n/).filter(Boolean).map((text) => ({ text, done: false }))).map((item, itemIndex) => itemIndex === index ? { ...item, done: !item.done } : item)
    const saved = await window.overheadBackend.upsertFeatureRecord({ collection: 'tasks', record: { ...record, checklistItems: items } })
    const updated = records.map((item) => item.id === saved.id ? saved : item)
    setRecords(updated); setAll((state) => ({ ...state, tasks: updated }))
  }
  const toggleMilestone = async (project, index) => {
    const items = (project.milestoneItems || String(project.milestone || '').split(/\r?\n/).filter(Boolean).map((text) => ({ text, done: false }))).map((item, itemIndex) => itemIndex === index ? { ...item, done: !item.done } : item)
    const saved = await window.overheadBackend.upsertFeatureRecord({ collection: 'projects', record: { ...project, milestoneItems: items } })
    const updated = records.map((item) => item.id === saved.id ? saved : item)
    setRecords(updated); setAll((state) => ({ ...state, projects: updated }))
  }
  const addProjectRisk = async (event, project) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') || '').trim()
    if (!title) return
    const saved = await window.overheadBackend.upsertFeatureRecord({ collection: 'projects', record: { kind: 'project_risk', projectId: project.id, project: project.title, title, severity: form.get('severity'), owner: form.get('owner'), status: 'Open', loggedAt: new Date().toISOString() } })
    const updated = [...records, saved]; setRecords(updated); setAll((state) => ({ ...state, projects: updated })); event.currentTarget.reset()
  }
  const createProjectFolder = async (event, project) => {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get('name') || '').trim()
    if (!name) return
    const folders = all.documents || []
    if (folders.some((folder) => folder.kind === 'project_folder' && folder.projectId === project.id && folder.name.toLowerCase() === name.toLowerCase())) { setNotice('A folder with this name already exists in this project.'); return }
    try {
      const saved = await window.overheadBackend.upsertFeatureRecord({ collection: 'documents', record: { kind: 'project_folder', title: name, name, projectId: project.id, project: project.title, createdBy: session?.email || '', createdAt: new Date().toISOString() } })
      setAll((state) => ({ ...state, documents: [...(state.documents || []), saved] })); event.currentTarget.reset(); setNotice(`Project folder “${name}” created.`)
    } catch (error) { setNotice(error?.message || 'Could not create the project folder.') }
  }
  const assignDocumentFolder = async (document, project, folderId) => {
    const folder = (all.documents || []).find((item) => item.id === folderId && item.kind === 'project_folder' && item.projectId === project.id)
    try {
      const saved = await window.overheadBackend.upsertFeatureRecord({ collection: 'documents', record: { ...document, projectId: project.id, project: project.title, folderId: folder?.id || '', folderName: folder?.name || '' } })
      setAll((state) => ({ ...state, documents: (state.documents || []).map((item) => item.id === saved.id ? saved : item) })); setNotice(folder ? `Document filed in ${folder.name}.` : 'Document removed from its project folder.')
    } catch (error) { setNotice(error?.message || 'Could not update the document folder.') }
  }
  const renameProjectFolder = async (folder) => {
    const name = window.prompt('Rename project folder', folder.name)?.trim()
    if (!name || name === folder.name) return
    if ((all.documents || []).some((item) => item.kind === 'project_folder' && item.projectId === folder.projectId && item.id !== folder.id && item.name.toLowerCase() === name.toLowerCase())) { setNotice('A folder with this name already exists in this project.'); return }
    try {
      const saved = await window.overheadBackend.upsertFeatureRecord({ collection: 'documents', record: { ...folder, name, title: name } })
      const renamedFiles = await Promise.all((all.documents || []).filter((item) => item.kind === 'document_file' && item.folderId === folder.id).map((file) => window.overheadBackend.upsertFeatureRecord({ collection: 'documents', record: { ...file, folderName: name } })))
      setAll((state) => ({ ...state, documents: (state.documents || []).map((item) => item.id === saved.id ? saved : renamedFiles.find((file) => file.id === item.id) || item) })); setNotice(`Folder renamed to “${name}”.`)
    } catch (error) { setNotice(error?.message || 'Could not rename the project folder.') }
  }
  const deleteProjectFolder = async (folder) => {
    try {
      const files = (all.documents || []).filter((item) => item.kind === 'document_file' && item.folderId === folder.id)
      const unfiled = await Promise.all(files.map((file) => window.overheadBackend.upsertFeatureRecord({ collection: 'documents', record: { ...file, folderId: '', folderName: '' } })))
      await window.overheadBackend.deleteFeatureRecord({ collection: 'documents', recordId: folder.id })
      setAll((state) => ({ ...state, documents: [...(state.documents || []).filter((item) => item.id !== folder.id && !files.some((file) => file.id === item.id)), ...unfiled] })); setNotice('Folder removed; indexed documents are now unfiled.')
    } catch (error) { setNotice(error?.message || 'Could not remove the project folder.') }
  }
  const closeProjectRisk = async (risk) => {
    const saved = await window.overheadBackend.upsertFeatureRecord({ collection: 'projects', record: { ...risk, status: 'Mitigated', resolvedAt: new Date().toISOString() } })
    const updated = records.map((item) => item.id === saved.id ? saved : item); setRecords(updated); setAll((state) => ({ ...state, projects: updated }))
  }
  const createProjectReport = async () => {
    const projects = visible.filter((project) => !project.kind)
    const generatedAt = new Date().toISOString()
    const report = {
      kind: 'project_report', title: `Portfolio status · ${new Date(generatedAt).toLocaleDateString()}`,
      generatedAt, projectCount: projects.length,
      atRisk: projects.filter((project) => project.health === 'At risk' || ['At risk', 'Blocked'].includes(project.status)).length,
      budget: projects.reduce((sum, project) => sum + Number(project.budget || 0), 0),
      actualCost: projects.reduce((sum, project) => sum + Number(project.actualCost || 0), 0),
      projects: projects.map((project) => ({ id: project.id, title: project.title, status: project.status, health: project.health, owner: project.owner || '', start: project.start || '', due: project.due || '', budget: Number(project.budget || 0), actualCost: Number(project.actualCost || 0), risks: projectRisks.filter((risk) => risk.projectId === project.id && risk.status !== 'Mitigated').map((risk) => risk.title) })),
    }
    try {
      const saved = await window.overheadBackend.upsertFeatureRecord({ collection: 'projects', record: report })
      const updated = [...records.filter((item) => item.id !== saved.id), saved]
      setRecords(updated); setAll((state) => ({ ...state, projects: updated })); setNotice('Portfolio status report saved as a local snapshot.')
    } catch (error) { setNotice(error?.message || 'Could not save the project report.') }
  }
  const toggleProjectArchive = async (project) => {
    const saved = await window.overheadBackend.upsertFeatureRecord({ collection: 'projects', record: { ...project, status: project.status === 'Archived' ? 'Planning' : 'Archived', archivedAt: project.status === 'Archived' ? '' : new Date().toISOString() } })
    const updated = records.map((item) => item.id === saved.id ? saved : item); setRecords(updated); setAll((state) => ({ ...state, projects: updated })); setNotice(saved.status === 'Archived' ? 'Project archived; it remains searchable and can be restored.' : 'Project restored to Planning.')
  }
  const addProjectResourceBooking = async (event, project) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const resource = String(form.get('resource') || '').trim()
    const startAt = String(form.get('startAt') || '')
    const endAt = String(form.get('endAt') || '')
    if (!resource || !startAt || !endAt || new Date(endAt) <= new Date(startAt)) { setNotice('Enter a resource and a valid start/end range.'); return }
    const overlap = (all.scheduling || []).find((item) => item.kind === 'resource_booking' && item.resource === resource && new Date(item.startAt) < new Date(endAt) && new Date(item.endAt) > new Date(startAt))
    if (overlap) { setNotice(`Resource already has a booking during this range: ${overlap.title}.`); return }
    const saved = await window.overheadBackend.upsertFeatureRecord({ collection: 'scheduling', record: { kind: 'resource_booking', title: `${resource} · ${project.title}`, project: project.title, projectId: project.id, resource, startAt, endAt, status: 'Booked', bookedBy: session?.email || '' } })
    const updated = [...(all.scheduling || []), saved]; setAll((state) => ({ ...state, scheduling: updated })); event.currentTarget.reset(); setNotice(`Resource booking linked to ${project.title}.`)
  }
  const generateNextTask = async (task) => {
    if (!task.due || !task.recurrence) { setNotice('Set a due date and a weekly, monthly, quarterly, or yearly repeat rule first.'); return }
    const match = String(task.recurrence).match(/weekly|monthly|quarterly|yearly/i)
    if (!match) { setNotice('Repeat rule must include Weekly, Monthly, Quarterly, or Yearly.'); return }
    const nextDate = new Date(`${task.due}T12:00:00`)
    const recurrence = match[0].toLowerCase()
    if (recurrence === 'weekly') nextDate.setDate(nextDate.getDate() + 7)
    else {
      const originalDay = nextDate.getDate()
      const monthOffset = recurrence === 'quarterly' ? 3 : recurrence === 'yearly' ? 12 : 1
      nextDate.setDate(1); nextDate.setMonth(nextDate.getMonth() + monthOffset)
      const finalDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()
      nextDate.setDate(Math.min(originalDay, finalDay))
    }
    const saved = await window.overheadBackend.upsertFeatureRecord({ collection: 'tasks', record: { ...task, id: undefined, title: `${task.title} · ${nextDate.toLocaleDateString()}`, status: defaults.tasks[0], due: nextDate.toISOString().slice(0, 10), recurrence: task.recurrence, checklistItems: [] } })
    const updated = [...records, saved]; setRecords(updated); setAll((state) => ({ ...state, tasks: updated })); setNotice(`Next task occurrence created for ${saved.due}.`)
  }
  const queueTaskReminder = async (task) => {
    if (!task.due) { setNotice('Add a due date before queueing a task reminder.'); return }
    const prior = taskReminders.find((item) => item.taskId === task.id && item.due === task.due && item.status !== 'Delivered')
    const reminder = await window.overheadBackend.upsertFeatureRecord({ collection: 'tasks', record: { ...(prior || {}), kind: 'task_reminder', taskId: task.id, taskTitle: task.title, due: task.due, status: 'Queued', queuedAt: new Date().toISOString(), recipient: task.assignee || '' } })
    const updated = [...records.filter((item) => item.id !== reminder.id), reminder]
    setRecords(updated); setAll((state) => ({ ...state, tasks: updated })); setNotice(`Local reminder queued for ${task.due}. It remains in OverHead and does not send email or push notifications.`)
  }
  const markTaskNoticeRead = async (notice) => {
    const saved = await window.overheadBackend.upsertFeatureRecord({ collection: 'tasks', record: { ...notice, readAt: new Date().toISOString() } })
    const updated = records.map((item) => item.id === saved.id ? saved : item)
    setRecords(updated); setAll((state) => ({ ...state, tasks: updated }))
  }
  const dismissTaskReminder = async (reminder) => {
    const saved = await window.overheadBackend.upsertFeatureRecord({ collection: 'tasks', record: { ...reminder, status: 'Dismissed', dismissedAt: new Date().toISOString() } })
    const updated = records.map((item) => item.id === saved.id ? saved : item)
    setRecords(updated); setAll((state) => ({ ...state, tasks: updated }))
  }
  const saveAssignmentRule = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const assignee = String(form.get('assignee') || '').trim()
    if (!assignee) { setNotice('Enter an assignee for the task rule.'); return }
    const saved = await window.overheadBackend.upsertFeatureRecord({ collection: 'tasks', record: { kind: 'assignment_rule', title: `${form.get('priority') || 'Any'} task assignment`, priority: form.get('priority'), project: String(form.get('project') || '').trim(), customer: String(form.get('customer') || '').trim(), assignee, enabled: true } })
    const updated = [...records, saved]; setRecords(updated); setAll((state) => ({ ...state, tasks: updated })); event.currentTarget.reset(); setNotice('Task assignment rule saved; it applies to new tasks that match.')
  }
  const advanceApproval = async (task, reject = false) => {
    const steps = String(task.approvals || '').split(/\r?\n/).map((value) => value.trim().toLowerCase()).filter(Boolean)
    const actor = String(session?.email || '').trim().toLowerCase()
    if (!steps.length || !actor || steps[task.approvalIndex || 0] !== actor) { setNotice('Only the account assigned to the current approval step can act on it.'); return }
    const nextIndex = (task.approvalIndex || 0) + 1
    const saved = await window.overheadBackend.upsertFeatureRecord({ collection: 'tasks', record: { ...task, approvalIndex: reject ? task.approvalIndex : nextIndex, approvalState: reject ? 'Rejected' : nextIndex >= steps.length ? 'Approved' : 'Pending', status: reject ? 'Rejected' : nextIndex >= steps.length ? 'Approved' : 'In approval', approvalUpdatedAt: new Date().toISOString() } })
    const updated = records.map((item) => item.id === saved.id ? saved : item); setRecords(updated); setAll((state) => ({ ...state, tasks: updated })); setNotice(reject ? 'Approval rejected.' : saved.approvalState === 'Approved' ? 'All approval steps are complete.' : 'Approval recorded; the next approver can act.')
  }
  const escalateTask = async (task) => {
    const daysOverdue = Math.floor((Date.now() - new Date(`${task.due}T23:59:59`).getTime()) / 86400000)
    if (daysOverdue < Number(task.escalationDays || 0)) { setNotice('This task has not reached its configured escalation threshold.'); return }
    const saved = await window.overheadBackend.upsertFeatureRecord({ collection: 'tasks', record: { ...task, status: 'Escalated', priority: task.priority === 'Urgent' ? 'Urgent' : 'High', escalatedAt: new Date().toISOString(), escalatedTo: task.escalationOwner || '' } })
    const updated = records.map((item) => item.id === saved.id ? saved : item); setRecords(updated); setAll((state) => ({ ...state, tasks: updated })); setNotice(`Task escalated${saved.escalatedTo ? ` to ${saved.escalatedTo}` : ''}.`)
  }
  const startEdit = (record) => { setDraft({ ...record }); setEditing(record.id || 'new') }
  const addPreset = () => {
    const label = window.prompt('Name this workspace preset')?.trim()
    if (label && !presets.includes(label)) {
      const updated = [...presets, label]
      setPresets(updated); setWorkspace(label)
      window.overheadBackend.upsertFeatureRecord({ collection: 'dashboard', record: { id: `workspace-presets:${userKey}`, title: 'Workspace presets', kind: 'presets', owner: userKey, items: updated } }).catch((error) => setNotice(error?.message || 'Could not save workspace preset.'))
    }
  }
  const saveLayout = async (items) => {
    setLayout(items)
    try { await window.overheadBackend.upsertFeatureRecord({ collection: 'dashboard', record: { id: `layout:${userKey}:${workspace}`, title: `${workspace} layout`, kind: 'layout', owner: userKey, items } }); setNotice('Dashboard layout saved.') }
    catch (error) { setNotice(error?.message || 'Could not save dashboard layout.') }
  }
  const exportRows = () => {
    const keys = current.fields
    const lines = [keys.join(','), ...visible.map((item) => keys.map((key) => `"${String(item[key] ?? '').replaceAll('"', '""')}"`).join(','))]
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv' })); link.download = `overhead-${area}.csv`; link.click(); URL.revokeObjectURL(link.href)
  }
  const moveCard = async (record, offset) => {
    const index = records.findIndex((item) => item.id === record.id)
    const target = Math.max(0, Math.min(records.length - 1, index + offset))
    if (target === index || !record.id) return
    const reordered = [...records]; reordered.splice(index, 1); reordered.splice(target, 0, record)
    const updated = await Promise.all(reordered.map((item, order) => window.overheadBackend.upsertFeatureRecord({ collection: area, record: { ...item, order } })))
    setRecords(updated); setAll((state) => ({ ...state, [area]: updated }))
  }
  const dragLayout = (event, index) => event.dataTransfer.setData('text/plain', `layout:${index}`)
  const dropLayout = (event, targetIndex) => {
    const value = event.dataTransfer.getData('text/plain')
    if (!value.startsWith('layout:')) return
    const sourceIndex = Number(value.slice(7))
    if (!Number.isInteger(sourceIndex) || sourceIndex === targetIndex) return
    const source = [...layout]
    const [item] = source.splice(sourceIndex, 1); source.splice(targetIndex, 0, item)
    saveLayout(source)
  }
  const dropOnStage = async (event, stage) => {
    const recordId = event.dataTransfer.getData('text/plain')
    if (!recordId || recordId.startsWith('layout:')) return
    const record = records.find((item) => item.id === recordId)
    if (!record) return
    if (area === 'tasks' && ['Done', 'Complete'].includes(stage) && record.depends_on) {
      const dependency = records.find((item) => item.id === record.depends_on)
      if (dependency && !['Done', 'Complete'].includes(dependency.status)) { setNotice(`Complete “${dependency.title}” before closing this task.`); return }
    }
    if (area === 'projects' && stage === 'Active' && (!record.owner || !record.start || !record.due || !record.intakeRationale)) { setNotice('The Active stage gate needs an owner, start date, due date, and intake rationale.'); return }
    if (area === 'projects' && stage === 'Active' && record.dependency) { const dependency = records.find((item) => item.id === record.dependency); if (dependency && dependency.status !== 'Complete') { setNotice(`Complete project “${dependency.title}” before starting this project.`); return } }
    const updatedRecord = await window.overheadBackend.upsertFeatureRecord({ collection: area, record: { ...record, [area === 'sales' || area === 'customers' ? 'stage' : 'status']: stage } })
    const updated = records.map((item) => item.id === recordId ? updatedRecord : item)
    setRecords(updated); setAll((state) => ({ ...state, [area]: updated }))
  }
  const renderField = (key) => {
    const options = key === 'priority' ? ['Low', 'Normal', 'High', 'Urgent'] : key === 'filter' ? ['All', ...new Set(Object.values(all).flat().map((item) => item.status || item.stage).filter(Boolean))] : key === 'riskSeverity' ? ['Low', 'Medium', 'High', 'Critical'] : key === 'metric' ? ['Manual KPI', 'Open tasks', 'Pipeline', 'Project health', 'Overdue tasks', 'Project budget variance'] : key === 'period' ? ['Week', 'Month', 'Quarter', 'Year'] : null
    const setValue = (value) => setDraft({ ...draft, [key]: value })
    const inputType = /date$|^due$|^renewal$|^start$/.test(key) ? 'date' : ['goal', 'value', 'previous_value', 'amount', 'probability', 'estimate', 'budget', 'actualCost', 'capacity', 'escalationDays'].includes(key) ? 'number' : 'text'
    if (key === 'customer' && area === 'tasks' && customerOptions.length) return <label key={key}>{fieldLabels[key]}<select value={draft.customer_id || ''} onChange={(event) => { const customer = customerOptions.find((item) => item.id === event.target.value); setDraft({ ...draft, customer_id: customer?.id || '', customer: customer?.business_name || customer?.owner_name || customer?.email || '' }) }}><option value="">Select customer</option>{customerOptions.map((customer) => <option key={customer.id} value={customer.id}>{customer.business_name || customer.owner_name || customer.email}</option>)}</select></label>
    if (key === 'project' && area === 'tasks') return <label key={key}>{fieldLabels[key]}<select value={draft.projectId || ''} onChange={(event) => { const project = (all.projects || []).find((item) => item.id === event.target.value); setDraft({ ...draft, projectId: project?.id || '', project: project?.title || '' }) }}><option value="">No project</option>{(all.projects || []).filter((item) => !item.kind).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
    if (key === 'depends_on' && area === 'tasks') return <label key={key}>{fieldLabels[key]}<select value={draft.depends_on || ''} onChange={(event) => setValue(event.target.value)}><option value="">No dependency</option>{(all.tasks || []).filter((item) => item.id !== draft.id && !item.kind).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
    if (key === 'dependency' && area === 'projects') return <label key={key}>{fieldLabels[key]}<select value={draft.dependency || ''} onChange={(event) => setValue(event.target.value)}><option value="">No dependency</option>{(all.projects || []).filter((item) => item.id !== draft.id && !item.kind).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
    return <label key={key} className={['notes', 'checklist', 'approvals', 'risk', 'decision', 'milestone', 'intakeRationale'].includes(key) ? 'wide' : ''}>{fieldLabels[key] || key}{options ? <select value={draft[key] ?? (key === 'filter' ? 'All' : 'Normal')} onChange={(event) => setValue(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select> : ['checklist', 'approvals', 'risk', 'decision', 'milestone', 'intakeRationale'].includes(key) ? <textarea rows="4" value={draft[key] ?? ''} onChange={(event) => setValue(event.target.value)} placeholder={key === 'approvals' ? 'approver@example.com, one per line' : 'One item per line'}/> : <input autoFocus={key === 'title'} type={inputType} min={['probability', 'escalationDays'].includes(key) ? 0 : undefined} max={key === 'probability' ? 100 : undefined} value={draft[key] ?? ''} onChange={(event) => setValue(event.target.value)} placeholder={key === 'watchers' ? 'name@example.com, name2@example.com' : key === 'status' || key === 'stage' ? (defaults[area] || []).join(' / ') : ''}/>}</label>
  }
  const renderProjectDocumentRow = (file, project, folders) => <div className="growth-document-row" key={file.id}><span>{file.title || file.fileName} · {file.status || 'Indexed'}</span><select aria-label={`Folder for ${file.title || file.fileName}`} value={file.folderId || ''} onChange={(event) => assignDocumentFolder(file, project, event.target.value)}><option value="">Unfiled</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></div>

  return <div className="growth-workspace">
    <div className="growth-heading"><div><p className="eyebrow">Workspace suite · encrypted local records</p><h2>Build and run your work</h2><p>Saved boards, work queues, customer accounts, projects, and sales opportunities.</p></div><button className="ghost-button" type="button" aria-expanded={showHelp} onClick={() => setShowHelp((value) => !value)}><CircleHelp size={17}/> {showHelp ? 'Hide help' : `Help: ${current.label}`}</button></div>
    {showHelp && <aside className="growth-context-help" role="note"><strong>{current.title}</strong><p>{contextualHelp[area] || 'Records are validated and stored in OverHead’s encrypted local workspace. External providers are not contacted from this workspace.'}</p></aside>}
    <div className="growth-controls"><label className="growth-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${current.label.toLowerCase()}`} aria-label={`Search ${current.label}`}/></label><label>Workspace<select value={workspace} onChange={(event) => setWorkspace(event.target.value)}>{presets.map((item) => <option key={item}>{item}</option>)}</select></label><button type="button" className="ghost-button" onClick={addPreset}>Save workspace preset</button></div>
    <div className="growth-tabs" role="tablist" aria-label="Workspace areas">{areas.map((item) => <button key={item.id} type="button" role="tab" aria-selected={area === item.id} className={area === item.id ? 'growth-tab active' : 'growth-tab'} onClick={() => setArea(item.id)}>{item.label}<span>{item.id === 'dashboard' ? (all.dashboard || []).filter((row) => row.kind !== 'layout').length : (all[item.id] || []).length}</span></button>)}</div>
    {area === 'dashboard' && <section className="growth-panel"><div className="growth-toolbar"><div><h3>{workspace} dashboard</h3><p>Choose cards, search this dashboard, and drag cards into order.</p><small>Data loaded {refreshedAt ? refreshedAt.toLocaleTimeString() : 'not yet refreshed'}</small></div><button className="primary-action" type="button" onClick={() => { setDraft({ kind: 'KPI', title: '' }); setEditing('new') }}><Plus size={16}/> Add KPI card</button></div><div className="growth-preset-row"><span>Layouts</span>{['Executive', 'Sales', 'Operations', 'Blank'].map((preset) => <button type="button" key={preset} onClick={() => saveLayout(preset === 'Blank' ? [] : preset === 'Executive' ? ['Pipeline', 'Revenue goal', 'Project health'] : preset === 'Sales' ? ['Pipeline', 'Win rate', 'Renewals'] : ['Open tasks', 'Overdue tasks', 'Project health', 'Project budget variance'])}>{preset}</button>)}</div><div className="growth-dashboard-grid">{layout.filter((label) => label.toLowerCase().includes(query.toLowerCase())).map((label, index) => { const card = records.find((item) => item.title === label); const value = dashboardValue(card, label); const goal = Number(card?.goal); const numericValue = Number(String(value).replace(/[^\d.-]/g, '')); const progress = goal > 0 && Number.isFinite(numericValue) ? Math.min(100, Math.max(0, numericValue / goal * 100)) : null; return <article draggable className="growth-kpi" key={`${label}-${index}`} onDragStart={(event) => dragLayout(event, index)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropLayout(event, index)}><div><small>{card?.kind || 'Workspace metric'}</small><button type="button" aria-label={`Remove ${label} from dashboard`} onClick={() => saveLayout(layout.filter((item) => item !== label))}><Trash2 size={15}/></button></div><strong>{value}</strong><span>{label}{card?.goal ? ` · goal ${card.goal}` : ''}</span>{progress !== null && <progress max="100" value={progress} aria-label={`${label} goal progress`}/>}{card?.previous_value && <small>Previous: {card.previous_value} · change {numericValue - Number(card.previous_value) >= 0 ? '+' : ''}{numericValue - Number(card.previous_value)}</small>}<footer><button type="button" onClick={() => saveLayout([...layout, label])}>Duplicate card</button><button type="button" onClick={() => { setDraft(card || { title: label, kind: 'KPI' }); setEditing(card?.id || 'new') }}>Edit</button></footer></article> })}<button className="growth-add-card" type="button" onClick={() => { setDraft({ kind: 'KPI' }); setEditing('new') }}><Plus size={20}/> Add a dashboard card</button></div></section>}
    {area !== 'dashboard' && <section className="growth-panel"><div className="growth-toolbar"><div><h3>{current.title}</h3><p>{records.filter((record) => !record.kind).length} saved · {visible.length} shown</p></div><div className="growth-actions"><label>Status<select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option>{stageOptions.map((item) => <option key={item}>{item}</option>)}</select></label>{area === 'tasks' && <label>Label<select value={labelFilter} onChange={(event) => setLabelFilter(event.target.value)}><option>All</option>{[...new Set(records.flatMap((item) => String(item.labels || '').split(',').map((label) => label.trim()).filter(Boolean)))].map((item) => <option key={item}>{item}</option>)}</select></label>}<label>View<select value={view} onChange={(event) => setView(event.target.value)}><option>List</option><option>Board</option><option>Timeline</option>{area === 'projects' && <option>Calendar</option>}</select></label><button type="button" className="ghost-button" onClick={exportRows}><Download size={16}/> CSV</button><button type="button" className="primary-action" onClick={() => startEdit({ status: defaults[area]?.[0] })}><Plus size={16}/> Add record</button></div></div>
      {area === 'projects' && <div className="growth-project-overview"><strong>Portfolio summary</strong><span>{visible.length} projects · {visible.filter((item) => item.health === 'At risk' || ['At risk', 'Blocked'].includes(item.status)).length} at risk · budget {visible.reduce((sum, item) => sum + Number(item.budget || 0), 0).toLocaleString()} · actual {visible.reduce((sum, item) => sum + Number(item.actualCost || 0), 0).toLocaleString()}</span><span>Estimated task capacity: {visible.reduce((sum, project) => sum + Number(project.capacity || 0), 0)} hours · assigned estimates: {(all.tasks || []).filter((task) => !task.kind && visible.some((project) => project.title === task.project)).reduce((sum, task) => sum + Number(task.estimate || 0), 0)} hours</span><button type="button" className="ghost-button" onClick={createProjectReport}>Save status report snapshot</button>{projectReports.length > 0 && <details className="growth-project-detail"><summary>Saved reports ({projectReports.length})</summary>{projectReports.sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt))).map((report) => <p key={report.id}>{report.title} · {report.projectCount} projects · {report.atRisk} at risk · budget variance {(Number(report.budget || 0) - Number(report.actualCost || 0)).toLocaleString()}</p>)}</details>}</div>}
      {area === 'projects' && view === 'Calendar' && <div className="growth-project-calendar"><label>Project month<input type="month" value={projectMonth} onChange={(event) => setProjectMonth(event.target.value)}/></label>{visible.filter((project) => String(project.start || '').startsWith(projectMonth) || String(project.due || '').startsWith(projectMonth)).sort((a, b) => String(a.start || a.due).localeCompare(String(b.start || b.due))).map((project) => <article key={project.id}><strong>{project.title}</strong><span>{project.status} · {project.start || 'No start'} to {project.due || 'No due date'}</span><button className="ghost-button" type="button" onClick={() => startEdit(project)}>Edit project dates</button></article>)}{!visible.some((project) => String(project.start || '').startsWith(projectMonth) || String(project.due || '').startsWith(projectMonth)) && <p className="queue-empty">No project start or due dates fall in this month.</p>}</div>}
      {area === 'tasks' && <details className="growth-project-detail"><summary>Assignment rules ({assignmentRules.length})</summary><p>Rules apply to new tasks when priority, project, and customer conditions match. The first matching rule assigns the task.</p>{assignmentRules.map((rule) => <p key={rule.id}>{rule.priority || 'Any'} · {rule.project || 'Any project'} · {rule.customer || 'Any customer'} → {rule.assignee}</p>)}<form onSubmit={saveAssignmentRule} className="growth-risk-form"><select name="priority"><option>Any</option><option>Low</option><option>Normal</option><option>High</option><option>Urgent</option></select><select name="project"><option value="">Any project</option>{(all.projects || []).filter((item) => !item.kind).map((project) => <option key={project.id}>{project.title}</option>)}</select><select name="customer"><option value="">Any customer</option>{customerOptions.map((customer) => <option key={customer.id}>{customer.business_name || customer.owner_name || customer.email}</option>)}</select><input name="assignee" placeholder="Assignee name or email" required/><button type="submit">Add rule</button></form></details>}
      {area === 'tasks' && taskReminders.some((item) => item.status !== 'Dismissed') && <details className="growth-project-detail"><summary>Local reminder inbox ({taskReminders.filter((item) => item.status === 'Due' && item.status !== 'Dismissed').length} due)</summary>{taskReminders.filter((item) => item.status !== 'Dismissed').slice(-10).reverse().map((reminder) => <p key={reminder.id}>{reminder.taskTitle} · due {reminder.due} · {reminder.status} · {reminder.recipient || 'No assignee'} {reminder.status === 'Due' && <button type="button" onClick={() => dismissTaskReminder(reminder)}>Mark seen</button>}</p>)}<small>Overdue reminders are evaluated when Tasks opens and stored in the encrypted local workspace. No email or push service is used.</small></details>}
      {area === 'tasks' && taskNotices.length > 0 && <div className="growth-panel"><strong>Watcher inbox ({taskNotices.filter((item) => !item.readAt).length} unread)</strong>{taskNotices.slice(-10).reverse().map((notice) => <p key={notice.id}>{notice.taskTitle} · {notice.message} · {notice.at ? new Date(notice.at).toLocaleString() : ''} {!notice.readAt && <button type="button" onClick={() => markTaskNoticeRead(notice)}>Mark read</button>}</p>)}</div>}
      {view === 'Board' ? <div className="growth-board">{stageOptions.map((stage) => <section className="growth-column" key={stage} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOnStage(event, stage)}><h4>{stage}<span>{visible.filter((item) => (item.status || item.stage || 'Open') === stage).length}</span></h4>{visible.filter((item) => (item.status || item.stage || 'Open') === stage).map((record) => <RecordCard key={record.id} record={record} onEdit={startEdit} onRemove={remove}/>)}</section>)}</div> : area === 'projects' && view === 'Calendar' ? null : <div className="growth-record-list">{visible.map((record) => <article className="growth-record" key={record.id}><div className="growth-record-main"><span className="growth-status">{record.status || record.stage || 'Open'}</span><h4>{record.title}</h4><p>{[record.customer && `Customer: ${record.customer}`, record.project && `Project: ${record.project}`, record.owner && `Owner: ${record.owner}`, record.due && `Due: ${record.due}`, record.amount && `Amount: ${record.amount}`, area === 'projects' && record.budget && `Budget variance: ${(Number(record.budget) - Number(record.actualCost || 0)).toLocaleString()}`].filter(Boolean).join(' · ') || record.notes || 'Add detail to this record.'}</p></div><div className="growth-record-actions"><button type="button" title="Move up" onClick={() => moveCard(record, -1)}><ArrowUp size={15}/></button><button type="button" title="Move down" onClick={() => moveCard(record, 1)}><ArrowDown size={15}/></button><button type="button" title="Favorite" onClick={() => save({ ...record, favorite: !record.favorite })}><Star size={15} fill={record.favorite ? 'currentColor' : 'none'}/></button><button type="button" onClick={() => startEdit(record)}>Edit</button>{['tasks', 'projects'].includes(area) && <button type="button" onClick={() => saveTemplate(record)}>Save template</button>}<button type="button" onClick={() => remove(record)} aria-label={`Delete ${record.title}`}><Trash2 size={15}/></button>{area === 'projects' && <button type="button" onClick={() => toggleProjectArchive(record)}>{record.status === 'Archived' ? 'Restore' : 'Archive'}</button>}</div>{area === 'tasks' && record.approvalState === 'Pending' && <div className="growth-task-approval"><strong>Approval step {(record.approvalIndex || 0) + 1}</strong><span>{String(record.approvals || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean)[record.approvalIndex || 0]}</span>{String(record.approvals || '').split(/\r?\n/).map((value) => value.trim().toLowerCase()).filter(Boolean)[record.approvalIndex || 0] === String(session?.email || '').toLowerCase() && <><button type="button" onClick={() => advanceApproval(record)}>Approve step</button><button type="button" onClick={() => advanceApproval(record, true)}>Reject</button></>}</div>}{area === 'tasks' && record.due && <button type="button" className="ghost-button" onClick={() => queueTaskReminder(record)}>{taskReminders.some((item) => item.taskId === record.id && item.due === record.due && item.status === 'Queued') ? 'Refresh local reminder' : 'Queue local reminder'}</button>}{area === 'tasks' && record.due && record.escalationDays && Math.floor((Date.now() - new Date(`${record.due}T23:59:59`).getTime()) / 86400000) >= Number(record.escalationDays) && !['Done', 'Complete', 'Escalated'].includes(record.status) && <button type="button" className="ghost-button" onClick={() => escalateTask(record)}>Escalate overdue task</button>}{area === 'tasks' && record.recurrence && <button type="button" className="ghost-button" onClick={() => generateNextTask(record)}>Generate next occurrence</button>}{area === 'tasks' && record.depends_on && <small>Depends on {records.find((item) => item.id === record.depends_on)?.title || record.depends_on}</small>}{area === 'tasks' && record.checklistItems?.length > 0 && <div className="growth-checklist">{record.checklistItems.map((item, index) => <label key={`${record.id}-${index}`}><input type="checkbox" checked={Boolean(item.done)} onChange={() => toggleChecklistItem(record, index)}/>{item.text}</label>)}</div>}{area === 'projects' && (record.milestoneItems || String(record.milestone || '').split(/\r?\n/).filter(Boolean).map((text) => ({ text, done: false }))).length > 0 && <div className="growth-checklist"><strong>Milestones</strong>{(record.milestoneItems || String(record.milestone || '').split(/\r?\n/).filter(Boolean).map((text) => ({ text, done: false }))).map((item, index) => <label key={`${record.id}-milestone-${index}`}><input type="checkbox" checked={Boolean(item.done)} onChange={() => toggleMilestone(record, index)}/>{item.text}</label>)}</div>}{area === 'projects' && <details className="growth-project-detail"><summary>Risks ({projectRisks.filter((risk) => risk.projectId === record.id && risk.status !== 'Mitigated').length})</summary>{projectRisks.filter((risk) => risk.projectId === record.id).map((risk) => <p key={risk.id}>{risk.severity} · {risk.title} · {risk.owner || 'Unassigned'} · {risk.status}{risk.status !== 'Mitigated' && <button type="button" onClick={() => closeProjectRisk(risk)}>Mark mitigated</button>}</p>)}<form onSubmit={(event) => addProjectRisk(event, record)} className="growth-risk-form"><input name="title" placeholder="Risk description" required/><select name="severity"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select><input name="owner" placeholder="Risk owner"/><button type="submit">Add risk</button></form></details>}{area === 'projects' && projectDecisions.some((item) => item.projectId === record.id) && <details className="growth-project-detail"><summary>Decision log</summary>{projectDecisions.filter((item) => item.projectId === record.id).sort((a, b) => String(b.decidedAt).localeCompare(String(a.decidedAt))).map((item) => <p key={item.id}>{new Date(item.decidedAt).toLocaleDateString()} · {item.decision} · {item.owner || 'No owner'}</p>)}</details>}{area === 'projects' && <><details className="growth-project-detail"><summary>Project dependencies</summary><p>Depends on: {records.find((item) => item.id === record.dependency)?.title || 'No project'}</p>{visible.filter((item) => item.dependency === record.id).map((item) => <p key={item.id}>Blocked by {record.title}: {item.title}</p>)}</details><details className="growth-project-detail"><summary>Resource bookings ({(all.scheduling || []).filter((item) => item.kind === 'resource_booking' && item.projectId === record.id).length})</summary>{(all.scheduling || []).filter((item) => item.kind === 'resource_booking' && item.projectId === record.id).map((booking) => <p key={booking.id}>{booking.resource} · {new Date(booking.startAt).toLocaleString()} to {new Date(booking.endAt).toLocaleString()}</p>)}<form onSubmit={(event) => addProjectResourceBooking(event, record)} className="growth-risk-form"><input name="resource" placeholder="Room, equipment, or person" required/><input name="startAt" type="datetime-local" required/><input name="endAt" type="datetime-local" required/><button type="submit">Book resource</button></form></details><details className="growth-project-detail"><summary>Project folders ({(all.documents || []).filter((item) => item.kind === 'project_folder' && item.projectId === record.id).length})</summary>{(() => { const projectFiles = (all.documents || []).filter((item) => item.kind === 'document_file' && (item.projectId === record.id || item.project === record.title)); const folders = (all.documents || []).filter((item) => item.kind === 'project_folder' && item.projectId === record.id); return <>{folders.map((folder) => <details className="growth-project-detail" key={folder.id}><summary>{folder.name} ({projectFiles.filter((file) => file.folderId === folder.id).length})</summary><button type="button" onClick={() => renameProjectFolder(folder)}>Rename</button><button type="button" onClick={() => deleteProjectFolder(folder)}>Delete folder</button>{projectFiles.filter((file) => file.folderId === folder.id).map((file) => renderProjectDocumentRow(file, record, folders))}</details>)}<strong>Unfiled documents</strong>{projectFiles.filter((file) => !folders.some((folder) => folder.id === file.folderId)).map((file) => renderProjectDocumentRow(file, record, folders))}<form onSubmit={(event) => createProjectFolder(event, record)} className="growth-risk-form"><input name="name" placeholder="New folder name" required/><button type="submit">Create project folder</button></form><small>Folders organize document metadata from the document vault; source file contents remain in that vault.</small></> })()}</details></>}</article>)}</div>}
      {visible.length === 0 && <div className="growth-empty"><Columns3 size={24}/><strong>{query ? 'No matching records' : `Start your ${current.label.toLowerCase()} board`}</strong><span>Add a record, apply a reusable template, then move work across stages.</span><button className="primary-action" type="button" onClick={() => startEdit({ status: defaults[area]?.[0] })}><Plus size={16}/> Create first record</button></div>}
      <div className="growth-template-row"><span>Reusable templates</span>{(area === 'tasks' ? ['Follow-up', 'Approval', 'Recurring maintenance'] : area === 'projects' ? ['Client launch', 'Quarterly plan', 'Incident review'] : area === 'customers' ? ['New customer', 'Renewal', 'At-risk account'] : ['New lead', 'Proposal', 'Renewal deal']).map((template) => <button type="button" key={template} onClick={() => startEdit({ title: template, template, status: defaults[area]?.[0], priority: 'Normal' })}>{template}</button>)}{['tasks', 'projects'].includes(area) && records.filter((record) => record.kind === 'template').map((template) => <button type="button" key={template.id} onClick={() => applyTemplate(template)}>{template.title}</button>)}</div>
    </section>}
    {editing && <div className="growth-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setEditing(''); setDraft({}) } }}><form className="growth-editor" onSubmit={(event) => { event.preventDefault(); save() }}><div className="growth-toolbar"><div><p className="eyebrow">{draft.template ? `Template · ${draft.template}` : editing === 'new' ? 'New record' : 'Edit record'}</p><h3>{area === 'dashboard' ? 'Dashboard card' : current.label.slice(0, -1) || current.label}</h3></div><button type="button" className="ghost-button" onClick={() => { setEditing(''); setDraft({}) }}>Close</button></div><div className="growth-form-grid">{current.fields.map(renderField)}</div><div className="growth-modal-actions"><span>Saved locally to this encrypted workspace.</span><button className="primary-action" type="submit">Save {current.label.slice(0, -1) || current.label}</button></div></form></div>}
    <p className="growth-notice" aria-live="polite">{busy ? 'Loading saved records…' : notice}</p>
  </div>
}

function RecordCard({ record, onEdit, onRemove }) {
  return <article draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', record.id)} className="growth-board-card"><strong>{record.title}</strong><span>{record.priority || record.owner || record.customer || 'Unassigned'}</span><div><button type="button" onClick={() => onEdit(record)}>Edit</button><button type="button" aria-label={`Delete ${record.title}`} onClick={() => onRemove(record)}><Trash2 size={14}/></button></div></article>
}
