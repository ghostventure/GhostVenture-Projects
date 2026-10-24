import { useMemo, useState } from 'react'
import { FeaturePanel, FeatureRecordList, FeatureRecordManager, FeatureTabs, currentDate, useFeatureRecords } from './FeatureWave101Helpers'
import './SchedulingWorkspace.css'

const tabs = [{ id: 'calendar', label: 'Shared calendar' }, { id: 'booking', label: 'Booking and polls' }, { id: 'resources', label: 'Rooms and resources' }, { id: 'time', label: 'Work and time' }, { id: 'meetings', label: 'Meetings and projects' }]
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const localMonth = (date = new Date()) => localDate(date).slice(0, 7)
const monthNow = () => localMonth()
const emptyRows = []
const preparationItems = [
  'Confirm customer and contact details',
  'Review appointment notes and requested work',
  'Confirm materials, access, and arrival instructions',
]
const createLocalId = () => globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`

function icsEscape(value = '') {
  return String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function icsUnescape(value = '') {
  return String(value).replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

function icsDate(value, tzid = '') {
  const compact = String(value || '').trim()
  const zone = /^[A-Za-z0-9_+/-]{1,100}$/.test(tzid) ? tzid : ''
  if (/^\d{8}$/.test(compact)) return icsDate(`${compact}T000000`, zone)
  const match = compact.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]))
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3]) || Number(match[4]) > 23 || Number(match[5]) > 59) return null
  if (match[7]) return { value: `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`, timezone: 'UTC' }
  return { value: `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`, timezone: zone || Intl.DateTimeFormat().resolvedOptions().timeZone }
}

function parseIcsEvents(source) {
  const unfolded = source.replace(/\r?\n[ \t]/g, '')
  const blocks = unfolded.split(/BEGIN:VEVENT\s*/i).slice(1).map((part) => part.split(/END:VEVENT/i)[0])
  return blocks.map((block, index) => {
    const props = {}
    for (const line of block.split(/\r?\n/)) {
      const split = line.indexOf(':')
      if (split < 0) continue
      const [key, ...params] = line.slice(0, split).split(';')
      const name = key.toUpperCase()
      if (!['UID', 'SUMMARY', 'DTSTART', 'DTEND', 'DESCRIPTION', 'LOCATION', 'STATUS'].includes(name)) continue
      const tzid = params.find((part) => /^TZID=/i.test(part))?.slice(5) || ''
      props[name] = { value: line.slice(split + 1), tzid }
    }
    const start = props.DTSTART && icsDate(props.DTSTART.value, props.DTSTART.tzid)
    const end = props.DTEND && icsDate(props.DTEND.value, props.DTEND.tzid)
    if (!start || !props.SUMMARY?.value.trim()) return null
    return {
      kind: 'meeting', title: icsUnescape(props.SUMMARY.value), startAt: start.value,
      endAt: end?.value || '', timezone: start.timezone,
      agenda: [props.DESCRIPTION && icsUnescape(props.DESCRIPTION.value), props.LOCATION && `Location: ${icsUnescape(props.LOCATION.value)}`].filter(Boolean).join('\n'),
      status: props.STATUS?.value.toUpperCase() === 'CANCELLED' ? 'Canceled' : 'Scheduled',
      calendarSourceUid: icsUnescape(props.UID?.value || `local-import-${Date.now()}-${index}`),
    }
  }).filter(Boolean)
}

function foldIcsLine(line) {
  const chunks = []
  let chunk = ''
  let bytes = 0
  for (const character of line) {
    const size = new TextEncoder().encode(character).length
    if (bytes + size > 73) { chunks.push(chunk); chunk = ` ${character}`; bytes = 1 + size }
    else { chunk += character; bytes += size }
  }
  chunks.push(chunk)
  return chunks.join('\r\n')
}

function toIcsDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  return match ? `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}00` : ''
}

export default function SchedulingWorkspace({ backendState = {}, setOperationNotice = () => {} }) {
  const { records, loading, error, setError, save, remove } = useFeatureRecords('scheduling')
  const { records: customerRecords, save: saveCustomerRecord } = useFeatureRecords('customers')
  const { records: projectRecords, save: saveProject, remove: removeProject } = useFeatureRecords('projects')
  const [tab, setTab] = useState('calendar')
  const [month, setMonth] = useState(monthNow())
  const [calendarView, setCalendarView] = useState('list')
  const [day, setDay] = useState(localDate())
  const [eventFilter, setEventFilter] = useState('all')
  const [rescheduleDrafts, setRescheduleDrafts] = useState({})
  const [prepAppointmentId, setPrepAppointmentId] = useState('')
  const [focusDraft, setFocusDraft] = useState({ title: 'Focus time', startAt: '', endAt: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
  const [focusError, setFocusError] = useState('')
  const [calendarNotice, setCalendarNotice] = useState('')
  const [calendarError, setCalendarError] = useState('')
  const appointments = backendState.appointments || emptyRows

  const scheduleRows = useMemo(() => {
    const savedEvents = records.filter((record) => ['meeting', 'resource_booking', 'shift', 'focus_block'].includes(record.kind)).map((record) => ({ ...record, date: record.startAt || record.date || '' }))
    const liveAppointments = appointments.map((item) => ({ id: item.id, kind: 'appointment', title: item.title, status: item.status, date: item.scheduled_for, customerId: item.customer_id, notes: item.notes }))
    return [...liveAppointments, ...savedEvents].filter((item) => String(item.date || '').startsWith(month)).sort((a, b) => String(a.date).localeCompare(String(b.date)))
  }, [records, appointments, month])
  const dayRows = useMemo(() => scheduleRows.filter((item) => String(item.date || '').slice(0, 10) === day), [scheduleRows, day])
  const visibleDayRows = useMemo(() => dayRows.filter((item) => eventFilter === 'all' || item.kind === eventFilter), [dayRows, eventFilter])
  const appointmentPrep = useMemo(() => new Map(records.filter((record) => record.kind === 'appointment_preparation').map((record) => [record.appointmentId, record])), [records])
  const dayAppointmentRows = visibleDayRows.filter((item) => item.kind === 'appointment')
  const readyAppointmentCount = dayAppointmentRows.filter((item) => appointmentPrep.get(item.id)?.readinessStatus === 'Ready').length
  const followups = useMemo(() => customerRecords.filter((item) => item.kind === 'customer_followup' && !['complete', 'completed', 'dismissed'].includes(String(item.status || '').toLowerCase())).sort((a, b) => String(a.dueDate || '9999-12-31').localeCompare(String(b.dueDate || '9999-12-31'))), [customerRecords])
  const allDueFollowups = followups.filter((item) => item.dueDate && item.dueDate <= localDate())
  const dueFollowups = allDueFollowups.slice(0, 12)

  function shiftAgendaDay(offset) {
    const current = new Date(`${day}T12:00:00`)
    current.setDate(current.getDate() + offset)
    const nextDay = localDate(current)
    setDay(nextDay)
    setMonth(localMonth(current))
  }

  async function ensureAppointmentPreparation(appointment) {
    let prep = appointmentPrep.get(appointment.id)
    if (!prep) {
      prep = await save({
        kind: 'appointment_preparation',
        appointmentId: appointment.id,
        appointmentTitle: appointment.title || 'Appointment',
        customerId: appointment.customerId || appointment.customer_id || '',
        items: preparationItems.map((label) => ({ label, done: false })),
        readinessStatus: 'Needs preparation',
        arrivalStatus: 'Not arrived',
      })
    }
    setPrepAppointmentId(appointment.id)
    return prep
  }

  async function updatePreparation(prep, changes) {
    await save({ ...prep, ...changes })
  }

  async function saveFollowupStatus(item, status) {
    await saveCustomerRecord({ ...item, status })
    setOperationNotice(`Internal follow-up marked ${status.toLowerCase()}. No customer message was sent.`)
  }

  async function commitReschedule(row, draft) {
    if (!row || !draft?.startAt || !draft?.endAt || draft.endAt <= draft.startAt) {
      setCalendarError('Choose a valid start and end time before reviewing the schedule change.')
      return
    }
    const before = `${row.startAt} – ${row.endAt}`
    const after = `${draft.startAt} – ${draft.endAt}`
    if (!window.confirm(`Review schedule change\n\n${row.title || row.kind}\nBefore: ${before}\nAfter:  ${after}\n\nSave this change?`)) return
    await saveRecord({ ...row, startAt: draft.startAt, endAt: draft.endAt })
    setRescheduleDrafts((current) => { const next = { ...current }; delete next[row.id]; return next })
    setCalendarError('')
  }

  async function updateAppointmentPreparationItem(prep, index, done) {
    const nextItems = (prep.items || []).map((item, itemIndex) => itemIndex === index ? { ...item, done } : item)
    const allReady = nextItems.length > 0 && nextItems.every((item) => item.done)
    await updatePreparation(prep, { items: nextItems, readinessStatus: allReady ? 'Ready' : 'Needs preparation' })
  }

  function printDailySheet() {
    setDay(localDate())
    setCalendarView('day')
    setMonth(localMonth())
    setEventFilter('all')
    window.setTimeout(() => window.print(), 80)
  }

  const conflicts = useMemo(() => {
    const reservations = records.filter((record) => record.kind === 'resource_booking' && record.startAt && record.endAt)
    return reservations.flatMap((record, index) => reservations.slice(index + 1).filter((other) =>
      (record.resource && record.resource === other.resource || record.person && record.person === other.person)
      && record.startAt < other.endAt && other.startAt < record.endAt,
    ).map((other) => ({ first: record.title, second: other.title, resource: record.resource || record.person })))
  }, [records])

  const timeRows = records.filter((record) => record.kind === 'time_entry')
  const approvedHours = timeRows.filter((entry) => entry.status === 'Approved').reduce((sum, entry) => sum + Number(entry.hours || 0), 0)
  const billableHours = timeRows.filter((entry) => entry.billable === 'Yes' && entry.status === 'Approved').reduce((sum, entry) => sum + Number(entry.hours || 0), 0)
  const timeBudget = records.filter((record) => record.kind === 'time_budget')
  const timeAlerts = timeBudget.map((budget) => ({ ...budget, actual: timeRows.filter((entry) => entry.project === budget.project && entry.status === 'Approved').reduce((sum, entry) => sum + Number(entry.hours || 0), 0) }))

  function getScheduleConflicts(candidate) {
    const startsAt = candidate.startAt || candidate.date
    const endsAt = candidate.endAt
    const start = Date.parse(startsAt || '')
    const end = Date.parse(endsAt || '')
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return []
    const activeStatuses = new Set(['canceled', 'cancelled', 'complete', 'completed', 'declined'])
    const candidatePeople = [candidate.person, ...(Array.isArray(candidate.attendees) ? candidate.attendees : String(candidate.attendees || '').split(','))]
      .map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
    const conflicts = records.filter((other) => {
      if (other.id && other.id === candidate.id) return false
      if (!['meeting', 'resource_booking', 'shift', 'focus_block'].includes(other.kind)) return false
      if (activeStatuses.has(String(other.status || '').trim().toLowerCase())) return false
      const otherStart = Date.parse(other.startAt || other.date || '')
      const otherEnd = Date.parse(other.endAt || '')
      if (!Number.isFinite(otherStart) || !Number.isFinite(otherEnd) || otherEnd <= otherStart || start >= otherEnd || otherStart >= end) return false
      const sharesResource = candidate.resource && other.resource && String(candidate.resource).trim().toLowerCase() === String(other.resource).trim().toLowerCase()
      const otherPeople = [other.person, ...(Array.isArray(other.attendees) ? other.attendees : String(other.attendees || '').split(','))]
        .map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
      const sharesPerson = candidatePeople.some((person) => otherPeople.includes(person))
      if (!sharesResource && !sharesPerson) return false
      return { ...other, conflictReason: sharesResource ? `same resource: ${other.resource}` : `same staff member: ${candidatePeople.find((person) => otherPeople.includes(person))}` }
    })
    // Legacy appointments store a start time only; flag exact start matches for review
    // without guessing their duration or assigned staff member.
    const appointmentStartMatches = appointments.filter((item) => {
      if (item.id && item.id === candidate.id) return false
      if (activeStatuses.has(String(item.status || '').trim().toLowerCase())) return false
      return Date.parse(item.scheduled_for || '') === start
    }).map((item) => ({ title: item.title || 'Appointment', startAt: item.scheduled_for, endAt: '', conflictReason: 'same appointment start time; duration and assigned staff are not recorded' }))
    return [...conflicts, ...appointmentStartMatches]
  }

  function confirmScheduleConflicts(candidate) {
    const detected = getScheduleConflicts(candidate)
    if (!detected.length) return true
    const details = detected.map((item) => `• ${item.title || item.kind} (${item.startAt}${item.endAt ? `–${item.endAt}` : ''}; ${item.conflictReason})`)
    return window.confirm(`This schedule overlaps ${detected.length} existing item${detected.length === 1 ? '' : 's'}:\n\n${details.join('\n')}\n\nReview the conflicting time or choose OK to save anyway.`)
  }

  async function saveRecord(record) {
    if (!confirmScheduleConflicts(record)) return
    await save(record); setError(''); setOperationNotice(`${record.title || 'Schedule record'} saved locally.`)
  }
  async function deleteRecord(id) { await remove(id); setOperationNotice('Schedule record deleted.') }
  async function createFocusBlock() {
    if (!focusDraft.startAt || !focusDraft.endAt || focusDraft.startAt >= focusDraft.endAt) { setFocusError('Choose a valid start and end time.'); return }
    const record = { ...focusDraft, kind: 'focus_block', title: focusDraft.title || 'Focus time', status: 'Scheduled' }
    if (!confirmScheduleConflicts(record)) return
    await save(record)
    setFocusError('')
    setOperationNotice('Focus-time block added to the shared calendar.')
    setFocusDraft((current) => ({ ...current, startAt: '', endAt: '' }))
  }

  async function importCalendarFile(event) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setCalendarError('Choose an iCalendar file smaller than 5 MB.'); return }
    try {
      const parsed = parseIcsEvents(await file.text())
      if (!parsed.length) throw new Error('No supported calendar events were found in that file.')
      let imported = 0
      for (const eventRecord of parsed) {
        const existing = records.find((record) => record.calendarSourceUid === eventRecord.calendarSourceUid)
        await save({ ...eventRecord, ...(existing?.id ? { id: existing.id } : {}) })
        imported += 1
      }
      setCalendarError('')
      setCalendarNotice(`${imported} event${imported === 1 ? '' : 's'} imported from ${file.name}.`)
    } catch (reason) { setCalendarError(reason?.message || 'The calendar file could not be imported.') }
  }

  function exportCalendarFile() {
    const exportRows = [
      ...records.filter((record) => ['meeting', 'resource_booking', 'shift', 'focus_block'].includes(record.kind)),
      ...appointments.map((item) => ({ id: item.id, kind: 'appointment', title: item.title, startAt: item.scheduled_for, status: item.status, notes: item.notes })),
    ].filter((record) => toIcsDate(record.startAt))
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OverHead//Local Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
    for (const record of exportRows) {
      const start = toIcsDate(record.startAt)
      const end = toIcsDate(record.endAt) || start
      lines.push('BEGIN:VEVENT', `UID:${icsEscape(record.calendarSourceUid || record.id || `${record.kind}-${start}`)}@overhead.local`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`, `DTSTART${record.timezone && record.timezone !== 'UTC' ? `;TZID=${record.timezone}` : ''}:${start}${record.timezone === 'UTC' ? 'Z' : ''}`, `DTEND${record.timezone && record.timezone !== 'UTC' ? `;TZID=${record.timezone}` : ''}:${end}${record.timezone === 'UTC' ? 'Z' : ''}`, `SUMMARY:${icsEscape(record.title || record.kind)}`, `DESCRIPTION:${icsEscape([record.kind, record.agenda, record.notes].filter(Boolean).join('\n'))}`, `STATUS:${record.status === 'Canceled' || record.status === 'Cancelled' ? 'CANCELLED' : 'CONFIRMED'}`, 'END:VEVENT')
    }
    lines.push('END:VCALENDAR')
    const blob = new Blob([lines.map(foldIcsLine).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `overhead-calendar-${currentDate()}.ics`
    link.click()
    URL.revokeObjectURL(href)
    setCalendarError('')
    setCalendarNotice(`${exportRows.length} local event${exportRows.length === 1 ? '' : 's'} exported. Provider calendars are not contacted.`)
  }

  return <section className="reports-page">
    <FeatureTabs tabs={tabs} active={tab} onChange={setTab} />
    {error && <p className="form-error" role="alert">{error}</p>}{loading && <p className="queue-empty">Loading secure schedule records…</p>}
    {tab === 'calendar' && <FeaturePanel eyebrow="Scheduling and time" title="Shared team calendar" description="See locally scheduled appointments, meetings, shifts, resource bookings, and focus blocks by month. Times retain the time zone recorded with the event.">
      <div className="profile-form compact-form"><strong>Calendar file exchange</strong><p>Import or export standard .ics calendar files to move events between OverHead and another calendar app. This is a manual desktop file exchange; it does not connect to provider accounts.</p><label>Import calendar (.ics)<input type="file" accept=".ics,text/calendar" onChange={(event) => importCalendarFile(event).catch((reason) => setCalendarError(reason.message))} /></label><button className="ghost-button" type="button" onClick={exportCalendarFile}>Export local calendar (.ics)</button>{calendarError && <p className="form-error" role="alert">{calendarError}</p>}{calendarNotice && <p role="status">{calendarNotice}</p>}</div>
      <p className="form-hint">Live appointments are read-only here because the current appointment service exposes no reschedule or recurring-series operation. Locally stored events with start and end times can be rescheduled with review below.</p>
      <label className="form-field">Calendar month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
      <div className="button-row calendar-view-controls" role="group" aria-label="Calendar view">
        <button type="button" className={calendarView === 'list' ? 'primary-action' : 'ghost-button'} aria-pressed={calendarView === 'list'} onClick={() => setCalendarView('list')}>List view</button>
        <button type="button" className={calendarView === 'day' ? 'primary-action' : 'ghost-button'} aria-pressed={calendarView === 'day'} onClick={() => setCalendarView('day')}>Day agenda</button>
        <button type="button" className="ghost-button" onClick={printDailySheet}>Print today’s sheet</button>
      </div>
      {calendarView === 'day' && <div className="agenda-day-tools"><div className="button-row" role="group" aria-label="Change agenda day"><button className="ghost-button" type="button" aria-label="Previous day" onClick={() => shiftAgendaDay(-1)}>Previous day</button><button className="ghost-button" type="button" onClick={() => { const today = localDate(); setDay(today); setMonth(localMonth()) }}>Today</button><button className="ghost-button" type="button" aria-label="Next day" onClick={() => shiftAgendaDay(1)}>Next day</button></div><label className="form-field">Agenda date<input type="date" value={day} onChange={(event) => { setDay(event.target.value); setMonth(event.target.value.slice(0, 7)) }} /></label><label className="form-field">Show event type<select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}><option value="all">All event types</option><option value="appointment">Appointments</option><option value="meeting">Meetings</option><option value="shift">Shifts</option><option value="resource_booking">Resource bookings</option><option value="focus_block">Focus blocks</option></select></label></div>}
      {calendarView === 'day' && <div className="agenda-summary no-print" aria-live="polite"><span><strong>{visibleDayRows.length}</strong> scheduled item(s)</span><span><strong>{dayAppointmentRows.length}</strong> appointment(s)</span><span><strong>{readyAppointmentCount}</strong> appointment(s) ready</span><span><strong>{allDueFollowups.length}</strong> customer follow-up(s) due/overdue</span></div>}
      <div className="task-list daily-sheet-print-area">{(calendarView === 'day' ? visibleDayRows : scheduleRows).map((row) => {
        const prep = appointmentPrep.get(row.id)
        const customer = (backendState.customers || []).find((item) => item.id === row.customerId)
        const activeScheduleStatus = !['complete', 'completed', 'canceled', 'cancelled', 'declined'].includes(String(row.status || '').toLowerCase())
        const supportsReschedule = ['meeting', 'resource_booking', 'shift', 'focus_block'].includes(row.kind) && row.startAt && row.endAt && activeScheduleStatus
        const draft = rescheduleDrafts[row.id]
        return <article className="task-row schedule-agenda-row" key={`${row.kind}-${row.id}`}><strong>{row.title || row.kind}</strong><span>{row.kind}</span><span>{row.date}{row.timezone ? ` · ${row.timezone}` : ''}</span><span>{row.status || 'Scheduled'}</span>{customer && <small>Customer: {customer.business_name || customer.owner_name || customer.email}</small>}{row.project && <small>Project: {row.project}</small>}{row.notes && <small>{row.notes}</small>}{row.kind === 'appointment' && <button className="text-button no-print" type="button" onClick={() => ensureAppointmentPreparation(row).catch((reason) => setCalendarError(reason.message))}>{prep ? 'Open readiness checklist' : 'Prepare appointment'}</button>}{supportsReschedule && !draft && <button className="text-button no-print" type="button" onClick={() => setRescheduleDrafts((current) => ({ ...current, [row.id]: { startAt: row.startAt, endAt: row.endAt } }))}>Reschedule</button>}{supportsReschedule && draft && <div className="schedule-change-editor no-print"><label>New start<input type="datetime-local" value={draft.startAt} onChange={(event) => setRescheduleDrafts((current) => ({ ...current, [row.id]: { ...current[row.id], startAt: event.target.value } }))} /></label><label>New end<input type="datetime-local" value={draft.endAt} onChange={(event) => setRescheduleDrafts((current) => ({ ...current, [row.id]: { ...current[row.id], endAt: event.target.value } }))} /></label><div className="button-row"><button className="primary-action" type="button" onClick={() => commitReschedule(row, draft).catch((reason) => setCalendarError(reason.message))}>Review and save change</button><button className="ghost-button" type="button" onClick={() => setRescheduleDrafts((current) => { const next = { ...current }; delete next[row.id]; return next })}>Cancel</button></div></div>}</article>
      })}{!(calendarView === 'day' ? visibleDayRows : scheduleRows).length && <p className="queue-empty">{calendarView === 'day' ? `No events are scheduled for ${day} with this filter.` : `No events are scheduled for ${month}.`}</p>}</div>
      {prepAppointmentId && appointmentPrep.get(prepAppointmentId) && <article className="appointment-preparation-card no-print"><h3>Appointment readiness · {appointmentPrep.get(prepAppointmentId).appointmentTitle}</h3><p>Checklist and check-in status are stored as local workspace support records. They do not alter the live appointment or send a notification.</p><label>Arrival status<select value={appointmentPrep.get(prepAppointmentId).arrivalStatus || 'Not arrived'} onChange={(event) => { const status = event.target.value; const time = new Date().toISOString(); const timing = status === 'Checked in' ? { checkedInAt: time } : status === 'Checked out' ? { checkedOutAt: time } : {}; updatePreparation(appointmentPrep.get(prepAppointmentId), { arrivalStatus: status, ...timing }).catch((reason) => setCalendarError(reason.message)) }}><option>Not arrived</option><option>Checked in</option><option>In service</option><option>Checked out</option><option>No show</option></select></label>{appointmentPrep.get(prepAppointmentId).checkedInAt && <small>Checked in {new Date(appointmentPrep.get(prepAppointmentId).checkedInAt).toLocaleString()}</small>}{appointmentPrep.get(prepAppointmentId).checkedOutAt && <small>Checked out {new Date(appointmentPrep.get(prepAppointmentId).checkedOutAt).toLocaleString()}</small>}<div className="appointment-prep-checklist">{(appointmentPrep.get(prepAppointmentId).items || []).map((item, index) => <label key={`${index}-${item.label}`}><input type="checkbox" checked={Boolean(item.done)} onChange={(event) => updateAppointmentPreparationItem(appointmentPrep.get(prepAppointmentId), index, event.target.checked).catch((reason) => setCalendarError(reason.message))} />{item.label}</label>)}</div><button className="text-button" type="button" onClick={() => setPrepAppointmentId('')}>Close readiness panel</button></article>}
      <article className="appointment-reminder-queue no-print"><h3>Customer follow-ups due</h3><p>Internal reminders from customer records. Completing one updates its local status; nothing is sent to the customer.</p>{dueFollowups.length ? dueFollowups.map((item) => { const customer = (backendState.customers || []).find((row) => row.id === item.customerId); const overdue = item.dueDate < localDate(); return <div className="task-row" key={item.id}><strong>{item.title || `Follow up with ${item.customerName || 'customer'}`}</strong><span>{overdue ? 'Overdue' : 'Due today'} · {item.dueDate}</span><span>{customer?.business_name || customer?.owner_name || item.customerName || 'Customer'}</span>{item.note && <small>{item.note}</small>}<button className="text-button" type="button" onClick={() => saveFollowupStatus(item, 'Complete').catch((reason) => setCalendarError(reason.message))}>Mark complete</button></div>}) : <p className="queue-empty">No customer follow-ups are due today or overdue.</p>}{followups.some((item) => item.dueDate > localDate()) && <small>{followups.filter((item) => item.dueDate > localDate()).length} future internal follow-up reminder(s) are also queued.</small>}</article>
      <FeatureRecordManager records={records} kind="meeting" title="Add calendar event" description="Create a meeting or event with a time zone, attendees, agenda, and optional project reference." fields={[{ name: 'title', label: 'Event title', required: true }, { name: 'startAt', label: 'Start time', type: 'datetime-local', required: true }, { name: 'endAt', label: 'End time', type: 'datetime-local' }, { name: 'timezone', label: 'IANA time zone', defaultValue: Intl.DateTimeFormat().resolvedOptions().timeZone, required: true }, { name: 'attendees', label: 'Attendee emails (comma separated)' }, { name: 'project', label: 'Project name or ID' }, { name: 'agenda', label: 'Agenda', multiline: true }, { name: 'status', label: 'Status', options: ['Scheduled', 'Confirmed', 'Complete', 'Canceled'], defaultValue: 'Scheduled' }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Scheduled', 'Confirmed', 'Complete', 'Canceled']} emptyText="No meetings." />
      <div className="profile-form compact-form"><strong>Focus-time block</strong><label>Title<input value={focusDraft.title} onChange={(event) => setFocusDraft((current) => ({ ...current, title: event.target.value }))} /></label><label>Start<input type="datetime-local" value={focusDraft.startAt} onChange={(event) => setFocusDraft((current) => ({ ...current, startAt: event.target.value }))} /></label><label>End<input type="datetime-local" value={focusDraft.endAt} onChange={(event) => setFocusDraft((current) => ({ ...current, endAt: event.target.value }))} /></label><label>Time zone<input value={focusDraft.timezone} onChange={(event) => setFocusDraft((current) => ({ ...current, timezone: event.target.value }))} /></label><button className="ghost-button" type="button" onClick={() => createFocusBlock().catch((reason) => setFocusError(reason.message))}>Block focus time</button>{focusError && <p className="form-error">{focusError}</p>}</div>
    </FeaturePanel>}
    {tab === 'booking' && <FeaturePanel eyebrow="Availability" title="Booking requests and availability polls" description="Save local booking-page rules and poll options for customers or meeting attendees. Publishing a public booking page requires a website deployment, which this desktop module does not perform.">
      <FeatureRecordManager records={records} kind="booking_page" title="Booking page setup" description="Draft available hours, service options, buffer time, and the public URL slug for later website integration." fields={[{ name: 'title', label: 'Booking page name', required: true }, { name: 'slug', label: 'URL slug', required: true }, { name: 'services', label: 'Bookable services', multiline: true }, { name: 'availableHours', label: 'Available hours', placeholder: 'Mon–Fri 9:00–17:00' }, { name: 'bufferMinutes', label: 'Buffer minutes', type: 'number', min: 0, step: 5, defaultValue: '15' }, { name: 'timezone', label: 'IANA time zone', defaultValue: Intl.DateTimeFormat().resolvedOptions().timeZone }, { name: 'status', label: 'Status', options: ['Draft', 'Ready for publishing', 'Disabled'], defaultValue: 'Draft' }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Draft', 'Ready for publishing', 'Disabled']} emptyText="No booking page drafts." />
      <FeatureRecordManager records={records} kind="availability_poll" title="Meeting availability poll" description="Collect candidate meeting times and keep the selected option on the local workspace." fields={[{ name: 'title', label: 'Poll name', required: true }, { name: 'organizer', label: 'Organizer email' }, { name: 'attendees', label: 'Attendee emails (comma separated)' }, { name: 'options', label: 'Candidate dates and times', multiline: true, required: true }, { name: 'selectedOption', label: 'Selected option' }, { name: 'status', label: 'Status', options: ['Collecting', 'Selected', 'Canceled'], defaultValue: 'Collecting' }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Collecting', 'Selected', 'Canceled']} emptyText="No availability polls." />
    </FeaturePanel>}
    {tab === 'resources' && <FeaturePanel eyebrow="Rooms and equipment" title="Resource reservations and conflict warnings" description="Track rooms, vehicles, or equipment alongside appointments. Overlapping reservations for the same resource or person are flagged below.">
      <FeatureRecordManager records={records} kind="resource_booking" title="Room and equipment reservation" description="Reserve a room, vehicle, or other shared resource for a time window." fields={[{ name: 'title', label: 'Reservation title', required: true }, { name: 'resource', label: 'Room or equipment', required: true }, { name: 'person', label: 'Assigned person email' }, { name: 'startAt', label: 'Start time', type: 'datetime-local', required: true }, { name: 'endAt', label: 'End time', type: 'datetime-local', required: true }, { name: 'timezone', label: 'IANA time zone', defaultValue: Intl.DateTimeFormat().resolvedOptions().timeZone }, { name: 'status', label: 'Status', options: ['Reserved', 'Pending', 'Canceled', 'Complete'], defaultValue: 'Reserved' }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Reserved', 'Pending', 'Canceled', 'Complete']} emptyText="No resource reservations." />
      <div className="task-list">{conflicts.map((conflict, index) => <article className="task-row" key={`${index}-${conflict.first}`}><strong>Schedule conflict</strong><span>{conflict.first} overlaps {conflict.second}</span><span>{conflict.resource}</span></article>)}{!conflicts.length && <p className="queue-empty">No resource or staff conflicts detected.</p>}</div>
    </FeaturePanel>}
    {tab === 'time' && <FeaturePanel eyebrow="Work hours and time" title="Hours, shifts, time entries, and utilization" description="Store work-hour policies, holidays, shifts, and submitted time entries. Hours appear in reports only after approval.">
      <FeatureRecordManager records={records} kind="work_hours" title="Work-hour configuration" description="Set normal operating hours and holiday dates for schedule planning." fields={[{ name: 'title', label: 'Schedule name', required: true }, { name: 'timezone', label: 'IANA time zone', defaultValue: Intl.DateTimeFormat().resolvedOptions().timeZone }, { name: 'hours', label: 'Weekly hours', multiline: true, required: true }, { name: 'holidays', label: 'Holiday dates', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} emptyText="No work-hour rules." />
      <FeatureRecordManager records={records} kind="shift" title="Shift scheduling" description="Assign a team member to a shift and flag coverage status." fields={[{ name: 'title', label: 'Shift label', required: true }, { name: 'person', label: 'Team member email', required: true }, { name: 'startAt', label: 'Shift start', type: 'datetime-local', required: true }, { name: 'endAt', label: 'Shift end', type: 'datetime-local', required: true }, { name: 'timezone', label: 'IANA time zone', defaultValue: Intl.DateTimeFormat().resolvedOptions().timeZone }, { name: 'status', label: 'Status', options: ['Scheduled', 'Confirmed', 'Covered', 'Canceled'], defaultValue: 'Scheduled' }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Scheduled', 'Confirmed', 'Covered', 'Canceled']} emptyText="No shifts scheduled." />
      <FeatureRecordManager records={records} kind="time_entry" title="Time entry and approval" description="Capture hours, project, billable status, and submit them for manager review." fields={[{ name: 'title', label: 'Work description', required: true }, { name: 'person', label: 'Team member email', required: true }, { name: 'project', label: 'Project' }, { name: 'date', label: 'Work date', type: 'date', defaultValue: currentDate() }, { name: 'hours', label: 'Hours', type: 'number', min: 0.01, step: 0.25, required: true }, { name: 'billable', label: 'Billable', options: ['No', 'Yes'] }, { name: 'status', label: 'Status', options: ['Submitted', 'Approved', 'Rejected'], defaultValue: 'Submitted' }, { name: 'notes', label: 'Notes' }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Submitted', 'Approved', 'Rejected']} emptyText="No time entries." />
      <div className="task-list"><article className="task-row"><strong>Approved hours</strong><span>{approvedHours.toFixed(2)} total</span><span>{billableHours.toFixed(2)} billable</span></article>{timeAlerts.map((budget) => <article className="task-row" key={budget.id}><strong>{budget.project}</strong><span>{budget.actual.toFixed(2)} / {Number(budget.hours || 0).toFixed(2)} hours</span><span>{budget.actual > Number(budget.hours || 0) ? 'Budget exceeded' : 'Within budget'}</span></article>)}</div>
      <FeatureRecordManager records={records} kind="time_budget" title="Project time budgets and alerts" description="Set a target number of hours; the workspace shows when approved entries exceed the limit." fields={[{ name: 'title', label: 'Budget name', required: true }, { name: 'project', label: 'Project', required: true }, { name: 'hours', label: 'Hours budget', type: 'number', min: 0, step: 0.25, required: true }, { name: 'owner', label: 'Budget owner' }]} onSave={saveRecord} onDelete={deleteRecord} emptyText="No time budgets." />
      <FeatureRecordList records={records.filter((record) => record.kind === 'timesheet_reminder')} emptyText="No timesheet reminders." />
      <FeatureRecordManager records={records} kind="timesheet_reminder" title="Timesheet reminders" description="Queue a local reminder for timesheets that need submission; no external notification is sent." fields={[{ name: 'title', label: 'Reminder', required: true }, { name: 'person', label: 'Team member email' }, { name: 'dueDate', label: 'Due date', type: 'date' }, { name: 'status', label: 'Status', options: ['Queued', 'Sent locally', 'Dismissed'], defaultValue: 'Queued' }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Queued', 'Sent locally', 'Dismissed']} emptyText="No reminders queued." />
      <FeatureRecordManager records={records} kind="calendar_connector" title="Calendar sync connection plan" description="Record the provider and owner for a future connector. This screen does not request access tokens or synchronize provider calendars." fields={[{ name: 'title', label: 'Calendar provider', required: true }, { name: 'owner', label: 'Connection owner' }, { name: 'status', label: 'Status', options: ['Planned', 'Configured externally', 'Disabled'], defaultValue: 'Planned' }, { name: 'notes', label: 'Setup notes', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Planned', 'Configured externally', 'Disabled']} emptyText="No calendar connector records." />
    </FeaturePanel>}
    {tab === 'meetings' && <FeaturePanel eyebrow="Meetings" title="Agendas, action items, and project links" description="Keep reusable meeting agendas and link appointments to local project records.">
      <FeatureRecordManager records={records} kind="agenda_template" title="Meeting agenda templates" description="Save common agenda structures for recurring meetings." fields={[{ name: 'title', label: 'Agenda template', required: true }, { name: 'items', label: 'Agenda items', multiline: true, required: true }, { name: 'owner', label: 'Template owner' }]} onSave={saveRecord} onDelete={deleteRecord} emptyText="No agenda templates." />
      <FeatureRecordManager records={records} kind="meeting_action" title="Meeting action items" description="Capture a decision, action, owner, and due date." fields={[{ name: 'title', label: 'Action item', required: true }, { name: 'meeting', label: 'Meeting title' }, { name: 'owner', label: 'Owner email' }, { name: 'dueDate', label: 'Due date', type: 'date' }, { name: 'status', label: 'Status', options: ['Open', 'In progress', 'Blocked', 'Complete'], defaultValue: 'Open' }, { name: 'details', label: 'Decision or context', multiline: true }]} onSave={saveRecord} onDelete={deleteRecord} statusOptions={['Open', 'In progress', 'Blocked', 'Complete']} emptyText="No meeting actions." />
      <FeatureRecordManager records={projectRecords} kind="project" title="Project and calendar links" description="Create a local project and associate meetings or work with its name or ID." fields={[{ name: 'title', label: 'Project name', required: true }, { name: 'owner', label: 'Project owner' }, { name: 'startDate', label: 'Start date', type: 'date' }, { name: 'dueDate', label: 'Target date', type: 'date' }, { name: 'status', label: 'Status', options: ['Planned', 'Active', 'At risk', 'Complete', 'Archived'], defaultValue: 'Planned' }, { name: 'notes', label: 'Project notes', multiline: true }]} onSave={saveProject} onDelete={removeProject} statusOptions={['Planned', 'Active', 'At risk', 'Complete', 'Archived']} emptyText="No projects." />
      <FeatureRecordList records={projectRecords} emptyText="No project records in the shared project collection." />
    </FeaturePanel>}
  </section>
}
