import { useMemo, useState } from 'react'
import './SupportTicketHistory.css'

function parseDetails(value) {
  if (value && typeof value === 'object') return value
  if (typeof value !== 'string') return null
  try { return JSON.parse(value) } catch { return null }
}

function formatDate(value) {
  if (!value) return 'Date not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date not recorded' : date.toLocaleString()
}

/** Displays only audit entries explicitly correlated to a support ticket id. */
export default function SupportTicketHistory({ auditEvents = [], tickets = [] }) {
  const [selectedId, setSelectedId] = useState('')
  const safeTickets = Array.isArray(tickets) ? tickets : []
  const safeEvents = Array.isArray(auditEvents) ? auditEvents : []
  const selectedTicket = safeTickets.find((ticket) => String(ticket?.id || '') === selectedId) || safeTickets[0]

  const correlatedEvents = useMemo(() => {
    if (!selectedTicket?.id) return []
    return safeEvents
      .filter((event) => {
        if (event?.event_type !== 'support.ticket_created') return false
        const details = parseDetails(event.details)
        return String(details?.id || '') === String(selectedTicket.id)
      })
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
  }, [safeEvents, selectedTicket?.id])

  if (!safeTickets.length) {
    return <section className="support-ticket-history" aria-labelledby="support-ticket-history-title">
      <div className="support-ticket-history__heading"><div><h3 id="support-ticket-history-title">Ticket history</h3><p>Audit events linked directly to a support ticket.</p></div></div>
      <p className="support-ticket-history__empty">There are no support tickets to review yet.</p>
    </section>
  }

  return <section className="support-ticket-history" aria-labelledby="support-ticket-history-title">
    <div className="support-ticket-history__heading">
      <div><h3 id="support-ticket-history-title">Ticket history</h3><p>Audit events linked directly to a support ticket.</p></div>
      <label className="support-ticket-history__selector">Ticket
        <select value={selectedTicket?.id || ''} onChange={(event) => setSelectedId(event.target.value)} aria-label="Choose ticket history">
          {safeTickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.subject || 'Support request'} · {ticket.id}</option>)}
        </select>
      </label>
    </div>
    <div className="support-ticket-history__scope"><strong>{selectedTicket?.subject || 'Support request'}</strong><span>{selectedTicket?.status || 'Status unavailable'} · {selectedTicket?.priority || 'Priority unavailable'}</span></div>
    {correlatedEvents.length ? <ol className="support-ticket-history__timeline">
      {correlatedEvents.map((event) => <li key={event.id || `${event.event_type}-${event.created_at}`}>
        <span className="support-ticket-history__marker" aria-hidden="true" />
        <div><strong>{event.title || 'Ticket created'}</strong><time dateTime={event.created_at || undefined}>{formatDate(event.created_at)}</time><small>Recorded by {event.actor || 'local system'}</small></div>
      </li>)}
    </ol> : <p className="support-ticket-history__empty">No ticket-linked audit events are available for this ticket. The current audit log records ticket creation, but assignment and status changes are not yet linked to ticket IDs, so they cannot be shown here.</p>}
  </section>
}
