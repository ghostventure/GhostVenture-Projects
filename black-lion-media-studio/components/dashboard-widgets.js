import Link from "next/link";
import {
  ArrowUpRight,
  BellRing,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Gauge,
  Mail,
  MessageSquareMore,
  ShieldCheck,
  Sparkles,
  UserRound
} from "lucide-react";
import { ServiceIcon } from "./service-icon";
import { Checklist, ConsultationCalendar, InfoGrid, TimelineList } from "./shared-ui";

export function HeroStatGrid({ metrics }) {
  const items = [
    {
      icon: ClipboardList,
      value: metrics.totalOrders ?? 0,
      label: "Orders Logged"
    },
    {
      icon: BellRing,
      value: metrics.newOrders ?? 0,
      label: "New Requests"
    },
    {
      icon: CalendarClock,
      value: metrics.futureConsultationCount ?? 0,
      label: "Upcoming Consults"
    },
    {
      icon: CircleDollarSign,
      value: metrics.estimatedBudgetFloor
        ? `$${metrics.estimatedBudgetFloor.toLocaleString()}`
        : "$0",
      label: "Budget Floor"
    }
  ];

  return (
    <div className="hero-stat-grid">
      {items.map((item) => (
        <div className="hero-stat-card" key={item.label}>
          <item.icon size={18} />
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function InsightBand({ highlights, metrics }) {
  const items = [
    {
      label: "Profile",
      value: highlights.profileStatus || "In progress"
    },
    {
      label: "Billing",
      value: highlights.billingStatus || "Review needed"
    },
    {
      label: "Consultation",
      value: highlights.consultationStatus || "Open"
    },
    {
      label: "Messages",
      value: highlights.communicationStatus || "Quiet"
    },
    {
      label: "Account Age",
      value: `${metrics.accountAgeDays ?? 0} days`
    }
  ];

  return (
    <div className="insight-band">
      {items.map((item) => (
        <div className="insight-pill" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function DashboardSection({ title, copy, action, children, id, className = "" }) {
  return (
    <section className={`card contemporary-card dashboard-panel ${className}`.trim()} id={id}>
      <div className="request-list-header dashboard-section-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{copy}</p>
        </div>
        {action || null}
      </div>
      {children}
    </section>
  );
}

export function SnapshotGrid({ items }) {
  return <InfoGrid items={items} className="dashboard-snapshot-grid" itemClassName="snapshot-card" />;
}

export function ReadinessPanel({ metrics }) {
  const items = [
    {
      label: "Profile",
      value: metrics.profileCompletionPercent ?? 0,
      note: `${metrics.filledProfileFields ?? 0}/${metrics.profileFieldCount ?? 0} fields ready`
    },
    {
      label: "Contact",
      value: metrics.contactReadyComplete ? 100 : Math.round(((metrics.contactReadyScore ?? 0) / 3) * 100),
      note: `${metrics.contactReadyScore ?? 0}/3 contact points available`
    },
    {
      label: "Billing",
      value: metrics.billingReadyComplete ? 100 : Math.round(((metrics.billingReadyScore ?? 0) / 4) * 100),
      note: `${metrics.billingReadyScore ?? 0}/4 billing details complete`
    }
  ];

  return (
    <div className="meter-grid">
      {items.map((item) => (
        <div className="meter-card" key={item.label}>
          <div className="meter-head">
            <span className="strip-label">{item.label}</span>
            <strong>{item.value}%</strong>
          </div>
          <div className="completion-bar">
            <span style={{ width: `${item.value}%` }} />
          </div>
          <p>{item.note}</p>
        </div>
      ))}
    </div>
  );
}

export function SignalGrid({ metrics }) {
  const items = [
    {
      icon: Gauge,
      label: "Service Coverage",
      value: metrics.uniqueServicesCount ?? 0,
      note: "Distinct service lanes used"
    },
    {
      icon: Clock3,
      label: "Avg. Budget Floor",
      value: metrics.averageBudgetFloor ? `$${metrics.averageBudgetFloor.toLocaleString()}` : "$0",
      note: "Average floor from submitted requests"
    },
    {
      icon: MessageSquareMore,
      label: "Messages Logged",
      value: metrics.totalMessages ?? 0,
      note: "Client communication history"
    },
    {
      icon: ShieldCheck,
      label: "Active Orders",
      value: metrics.activeOrders ?? 0,
      note: "Open or in-flight request count"
    }
  ];

  return (
    <div className="signal-grid">
      {items.map((item) => (
        <div className="signal-card" key={item.label}>
          <item.icon size={18} />
          <span className="strip-label">{item.label}</span>
          <strong>{item.value}</strong>
          <p>{item.note}</p>
        </div>
      ))}
    </div>
  );
}

export function ActionDeck() {
  const actions = [
    {
      href: "#request-workspace",
      label: "Start Request",
      note: "Jump into the service request form"
    },
    {
      href: "/profile",
      label: "Update Profile",
      note: "Adjust account and billing details"
    },
    {
      href: "/messages",
      label: "Open Messages",
      note: "Continue the studio conversation"
    },
    {
      href: "#service-selection",
      label: "Review Services",
      note: "Compare services before you book"
    }
  ];

  return (
    <div className="action-deck">
      {actions.map((action) => (
        <Link className="action-card" href={action.href} key={action.label}>
          <div>
            <span className="strip-label">{action.label}</span>
            <strong>{action.note}</strong>
          </div>
          <ArrowUpRight size={16} />
        </Link>
      ))}
    </div>
  );
}

export function BookingPulse({ metrics }) {
  const items = [
    {
      label: "Open Days",
      value: metrics.openDayCount ?? 0
    },
    {
      label: "Open Slots",
      value: metrics.openSlotCount ?? 0
    },
    {
      label: "Booked",
      value: metrics.bookedConsultationCount ?? 0
    },
    {
      label: "Next In",
      value:
        metrics.nextConsultationCountdownDays === null
          ? "Unscheduled"
          : `${metrics.nextConsultationCountdownDays} day${metrics.nextConsultationCountdownDays === 1 ? "" : "s"}`
    }
  ];

  return (
    <div className="pulse-grid">
      {items.map((item) => (
        <div className="pulse-card" key={item.label}>
          <span className="strip-label">{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function ActivityFeedPanel({ items }) {
  return <TimelineList items={items} className="activity-feed" itemClassName="feed-item" />;
}

export function FeaturedServicePanel({ featuredService, relatedServices }) {
  return (
    <div className="service-focus-layout">
      <div className="service-focus-card">
        <div className="service-focus-head">
          <span className="service-icon-wrap">
            <Sparkles size={18} />
          </span>
          <div>
            <span className="strip-label">Featured Service</span>
            <strong>{featuredService?.name || "No featured service"}</strong>
          </div>
        </div>
        <div className="service-focus-meta">
          <span>{featuredService?.priceLabel || "TBD"}</span>
          <span>{featuredService?.turnaround || "TBD"}</span>
        </div>
        <p>{featuredService?.coverage || "Select a service to review service coverage."}</p>
      </div>

      <div className="related-service-list">
        {relatedServices.map((service) => (
          <div className="related-service-card" key={service.slug}>
            <div className="related-service-head">
              <span className="service-icon-wrap compact">
                <ServiceIcon slug={service.slug} />
              </span>
              <div>
                <strong>{service.name}</strong>
                <p>{service.priceLabel}</p>
              </div>
            </div>
            <span className="mini-note">{service.turnaround}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MessagePreviewPanel({ messages }) {
  if (!messages.length) {
    return <div className="empty-state">No messages yet. Use the messages area when you need support.</div>;
  }

  return (
    <div className="message-preview-list">
      {messages.map((message) => (
        <div className="message-preview-card" key={message.id}>
          <div className="message-preview-head">
            <span className="message-role-chip">
              {message.sender_role === "studio" ? <Mail size={14} /> : <UserRound size={14} />}
              {message.sender_role === "studio" ? "Studio" : "Client"}
            </span>
            <span className="mini-note">{new Date(message.created_at).toLocaleDateString()}</span>
          </div>
          <strong>{message.subject}</strong>
          <p>{message.body}</p>
        </div>
      ))}
    </div>
  );
}

export function OrderHistoryPanel({ requests }) {
  if (!requests.length) {
    return (
      <div className="empty-state">
        No requests yet. Select a service and submit your first service request.
      </div>
    );
  }

  return (
    <div className="request-list">
      {requests.map((request) => (
        <article className="request-item order-card" key={request.id}>
          <div className="request-list-header">
            <h4>{request.project_type}</h4>
            <span className="status-pill">{request.status}</span>
          </div>
          <p>{request.details}</p>
          <div className="request-meta">
            <span>
              <CircleDollarSign size={14} /> {request.budget}
            </span>
            <span>
              <Clock3 size={14} /> {request.timeline}
            </span>
            <span>
              <CalendarClock size={14} /> {request.consultation_date} {request.consultation_time}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

export function WorkspaceChecklist({ items }) {
  return (
    <Checklist
      items={items}
      className="workspace-checklist"
      itemClassName="workspace-check-item"
    />
  );
}

export function PortalMapPanel({ items }) {
  return <InfoGrid items={items} className="portal-map-grid" itemClassName="portal-map-card" />;
}

export function ConsultationCalendarWidget({ calendar }) {
  return <ConsultationCalendar calendar={calendar} className="dashboard-consultation-calendar" />;
}
