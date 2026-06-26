import Link from "next/link";

export function InfoGrid({ items, className = "", itemClassName = "" }) {
  return (
    <div className={className}>
      {items.map((item) => (
        <div className={itemClassName} key={`${item.label}-${item.value}`}>
          <span className="strip-label">{item.label}</span>
          <strong>{item.value}</strong>
          {item.note ? <p>{item.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function Checklist({ items, className = "", itemClassName = "" }) {
  return (
    <div className={className}>
      {items.map((item) => (
        <div className={itemClassName} key={item.label}>
          {item.icon ? <item.icon size={16} /> : null}
          <div>
            <span className="strip-label">{item.label}</span>
            <strong>{item.value}</strong>
            {item.note ? <p>{item.note}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TimelineList({ items, className = "", itemClassName = "" }) {
  if (!items.length) {
    return <div className="empty-state">No timeline items yet.</div>;
  }

  return (
    <div className={className}>
      {items.map((item) => (
        <div className={itemClassName} key={`${item.label}-${item.value}`}>
          <span className="feed-dot" />
          <div>
            <span className="strip-label">{item.label}</span>
            <strong>{item.value}</strong>
            {item.note ? <p>{item.note}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SectionEyebrow({ children, className = "" }) {
  return <p className={`ui-eyebrow ${className}`.trim()}>{children}</p>;
}

export function SurfaceCard({ children, className = "", as: Tag = "div" }) {
  return <Tag className={`ui-surface-card ${className}`.trim()}>{children}</Tag>;
}

export function SplitHeading({ eyebrow, title, copy, className = "" }) {
  return (
    <div className={`ui-split-heading ${className}`.trim()}>
      <div>
        {eyebrow ? <SectionEyebrow>{eyebrow}</SectionEyebrow> : null}
        <h2>{title}</h2>
      </div>
      {copy ? <p className="ui-section-copy">{copy}</p> : null}
    </div>
  );
}

export function ActionButtonRow({ items, className = "" }) {
  return (
    <div className={`ui-action-row ${className}`.trim()}>
      {items.map((item) => (
        <Link key={item.label} href={item.href} className={item.className}>
          {item.label}
        </Link>
      ))}
    </div>
  );
}

export function PillRow({ items, className = "" }) {
  return (
    <div className={`ui-pill-row ${className}`.trim()}>
      {items.map((item) => (
        <span className="ui-pill" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

export function StatBadge({ label, value, className = "" }) {
  return (
    <div className={`ui-stat-badge ${className}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function FeatureBulletList({ items, className = "" }) {
  return (
    <div className={`ui-feature-bullets ${className}`.trim()}>
      {items.map((item) => (
        <div className="ui-feature-bullet" key={item.text || item.label}>
          {item.icon ? <item.icon size={18} /> : null}
          <span>{item.text || item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function IconDetailList({ items, className = "" }) {
  return (
    <div className={`ui-icon-detail-list ${className}`.trim()}>
      {items.map((item) => (
        <div className="ui-icon-detail-row" key={item.title}>
          {item.icon ? <item.icon size={18} /> : null}
          <div>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProcessSteps({ items, className = "" }) {
  return (
    <div className={`ui-process-steps ${className}`.trim()}>
      {items.map((item, index) => (
        <div className="ui-process-step" key={item}>
          <span>0{index + 1}</span>
          <p>{item}</p>
        </div>
      ))}
    </div>
  );
}

export function QuotePanel({ quote, source, className = "" }) {
  return (
    <div className={`ui-quote-panel ${className}`.trim()}>
      <p>{quote}</p>
      {source ? <span>{source}</span> : null}
    </div>
  );
}

export function InlineNotice({ children, className = "" }) {
  return <p className={`ui-inline-notice ${className}`.trim()}>{children}</p>;
}

export function MetricStrip({ items, className = "" }) {
  return (
    <div className={`ui-metric-strip ${className}`.trim()}>
      {items.map((item) => (
        <StatBadge key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );
}

export function KeyValueList({ items, className = "" }) {
  return (
    <div className={`ui-key-value-list ${className}`.trim()}>
      {items.map((item) => (
        <div className="ui-key-value-row" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function ActionTileGrid({ items, className = "" }) {
  return (
    <div className={`ui-action-tile-grid ${className}`.trim()}>
      {items.map((item) => (
        <Link className="ui-action-tile" href={item.href} key={item.label}>
          <span className="strip-label">{item.label}</span>
          <strong>{item.value}</strong>
          {item.note ? <p>{item.note}</p> : null}
        </Link>
      ))}
    </div>
  );
}

export function EmptyBlock({ title, copy, className = "" }) {
  return (
    <div className={`ui-empty-block ${className}`.trim()}>
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

export function SectionDivider({ className = "" }) {
  return <div className={`ui-section-divider ${className}`.trim()} aria-hidden="true" />;
}

export function ShowcasePanel({ children, className = "" }) {
  return <div className={`ui-showcase-panel ${className}`.trim()}>{children}</div>;
}

export function ComparisonRows({ items, className = "" }) {
  return (
    <div className={`ui-comparison-rows ${className}`.trim()}>
      {items.map((item) => (
        <div className="ui-comparison-row" key={item.label}>
          <strong>{item.label}</strong>
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TagCloud({ items, className = "" }) {
  return (
    <div className={`ui-tag-cloud ${className}`.trim()}>
      {items.map((item) => (
        <span className="ui-tag" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

export function AccentCallout({ title, copy, className = "" }) {
  return (
    <div className={`ui-accent-callout ${className}`.trim()}>
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

export function SectionStack({ children, className = "" }) {
  return <div className={`ui-section-stack ${className}`.trim()}>{children}</div>;
}

export function PanelHeader({ eyebrow, title, copy, action, className = "" }) {
  return (
    <div className={`ui-panel-header ${className}`.trim()}>
      <div>
        {eyebrow ? <SectionEyebrow>{eyebrow}</SectionEyebrow> : null}
        <h3>{title}</h3>
        {copy ? <p className="ui-panel-copy">{copy}</p> : null}
      </div>
      {action || null}
    </div>
  );
}

export function StatusChip({ label, tone = "neutral", className = "" }) {
  return <span className={`ui-status-chip ${tone} ${className}`.trim()}>{label}</span>;
}

export function StatusChipRow({ items, className = "" }) {
  return (
    <div className={`ui-status-chip-row ${className}`.trim()}>
      {items.map((item) => (
        <StatusChip key={item.label} label={item.label} tone={item.tone} />
      ))}
    </div>
  );
}

export function SummaryStatRow({ items, className = "" }) {
  return (
    <div className={`ui-summary-stat-row ${className}`.trim()}>
      {items.map((item) => (
        <div className="ui-summary-stat" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function StatPillGrid({ items, className = "" }) {
  return (
    <div className={`ui-stat-pill-grid ${className}`.trim()}>
      {items.map((item) => (
        <div className="ui-stat-pill" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.note ? <p>{item.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function DetailPairGrid({ items, className = "" }) {
  return (
    <div className={`ui-detail-pair-grid ${className}`.trim()}>
      {items.map((item) => (
        <div className="ui-detail-pair" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function SegmentedControl({ items, activeId, onChange, className = "" }) {
  return (
    <div className={`ui-segmented-control ${className}`.trim()} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`ui-segmented-button ${activeId === item.id ? "active" : ""}`.trim()}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function SearchToolbar({
  value,
  onChange,
  placeholder = "Search",
  summary,
  className = ""
}) {
  return (
    <div className={`ui-search-toolbar ${className}`.trim()}>
      <label className="ui-search-field">
        <span className="strip-label">Search</span>
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      </label>
      {summary ? <div className="ui-search-summary">{summary}</div> : null}
    </div>
  );
}

export function CalendarLegend({ items, className = "" }) {
  return (
    <div className={`ui-calendar-legend ${className}`.trim()}>
      {items.map((item) => (
        <div className="ui-calendar-legend-item" key={item.label}>
          <span className={`ui-calendar-dot ${item.tone}`.trim()} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function CalendarDayGrid({ items, className = "" }) {
  return (
    <div className={`ui-calendar-day-grid ${className}`.trim()}>
      {items.map((item) => (
        <div className={`ui-calendar-day-card ${item.status || "open"}`.trim()} key={item.isoDate}>
          <div className="ui-calendar-day-head">
            <span>{item.weekday}</span>
            <strong>{item.dayNumber}</strong>
          </div>
          <p>{item.label}</p>
          <div className="ui-calendar-day-meta">
            <span>{item.primaryMeta}</span>
            <span>{item.secondaryMeta}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EventLedger({ items, empty = "No events yet.", className = "" }) {
  if (!items.length) {
    return <div className={`ui-empty-inline ${className}`.trim()}>{empty}</div>;
  }

  return (
    <div className={`ui-event-ledger ${className}`.trim()}>
      {items.map((item) => (
        <div className="ui-event-ledger-row" key={`${item.label}-${item.value}`}>
          <div>
            <span className="strip-label">{item.label}</span>
            <strong>{item.value}</strong>
          </div>
          {item.note ? <p>{item.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function EmptyInline({ children, className = "" }) {
  return <div className={`ui-empty-inline ${className}`.trim()}>{children}</div>;
}

export function ConsultationCalendar({ calendar, className = "" }) {
  if (!calendar) {
    return <EmptyInline className={className}>Calendar unavailable.</EmptyInline>;
  }

  const legendItems = [
    { label: "Open", tone: "open" },
    { label: "Busy", tone: "busy" },
    { label: "Full", tone: "full" },
    { label: "Scheduled", tone: "scheduled" }
  ];

  return (
    <div className={`ui-consultation-calendar ${className}`.trim()}>
      <PanelHeader
        eyebrow={calendar.eyebrow}
        title={calendar.title}
        copy={calendar.copy}
      />
      <SummaryStatRow items={calendar.summary} />
      <CalendarLegend items={legendItems} />
      <CalendarDayGrid items={calendar.days} />
      <EventLedger items={calendar.events} empty="No consultation events scheduled." />
    </div>
  );
}

export function UtilityBar({ items = [], className = "" }) {
  return (
    <div className={`ui-utility-bar ${className}`.trim()}>
      {items.map((item) => (
        <div className="ui-utility-item" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function IconStatList({ items = [], className = "" }) {
  return (
    <div className={`ui-icon-stat-list ${className}`.trim()}>
      {items.map((item) => (
        <div className="ui-icon-stat-row" key={item.label}>
          {item.icon ? <item.icon size={18} /> : null}
          <div>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.note ? <p>{item.note}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function KeyActionList({ items = [], className = "" }) {
  return (
    <div className={`ui-key-action-list ${className}`.trim()}>
      {items.map((item) =>
        item.href ? (
          <Link href={item.href} className="ui-key-action" key={item.label}>
            <div>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
            {item.note ? <p>{item.note}</p> : null}
          </Link>
        ) : (
          <div className="ui-key-action" key={item.label}>
            <div>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
            {item.note ? <p>{item.note}</p> : null}
          </div>
        )
      )}
    </div>
  );
}

export function SupportNotice({ title, copy, className = "" }) {
  return (
    <div className={`ui-support-notice ${className}`.trim()}>
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

export function FormSectionCard({ title, copy, children, className = "" }) {
  return (
    <div className={`ui-form-section-card ${className}`.trim()}>
      <div className="ui-form-section-head">
        <strong>{title}</strong>
        {copy ? <p>{copy}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function SurfaceGrid({ children, className = "" }) {
  return <div className={`ui-surface-grid ${className}`.trim()}>{children}</div>;
}

export function HeroBadgeStack({ items = [], className = "" }) {
  return (
    <div className={`ui-hero-badge-stack ${className}`.trim()}>
      {items.map((item) => (
        <div className="ui-hero-badge" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.note ? <p>{item.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function MiniStatRail({ items = [], className = "" }) {
  return (
    <div className={`ui-mini-stat-rail ${className}`.trim()}>
      {items.map((item) => (
        <div className="ui-mini-stat" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function ValueCardGrid({ items = [], className = "" }) {
  return (
    <div className={`ui-value-card-grid ${className}`.trim()}>
      {items.map((item) => (
        <div className="ui-value-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.note ? <p>{item.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function DisclosureList({ items = [], className = "" }) {
  return (
    <div className={`ui-disclosure-list ${className}`.trim()}>
      {items.map((item) => (
        <div className="ui-disclosure-row" key={item.label}>
          <strong>{item.label}</strong>
          <p>{item.copy}</p>
        </div>
      ))}
    </div>
  );
}

export function NarrativeStack({ items = [], className = "" }) {
  return (
    <div className={`ui-narrative-stack ${className}`.trim()}>
      {items.map((item) => (
        <div className="ui-narrative-card" key={item.title}>
          <span>{item.eyebrow}</span>
          <strong>{item.title}</strong>
          <p>{item.copy}</p>
        </div>
      ))}
    </div>
  );
}

export function ShortcutRail({ items = [], className = "" }) {
  return (
    <div className={`ui-shortcut-rail ${className}`.trim()}>
      {items.map((item) => {
        const isExternal = /^https?:\/\//i.test(String(item.href || ""));
        const content = (
          <>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.note ? <p>{item.note}</p> : null}
          </>
        );

        return isExternal ? (
          <a href={item.href} className="ui-shortcut-card" target="_blank" rel="noreferrer" key={item.label}>
            {content}
          </a>
        ) : (
          <Link href={item.href} className="ui-shortcut-card" key={item.label}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}

export function SpotlightCard({ eyebrow, title, copy, children, className = "" }) {
  return (
    <div className={`ui-spotlight-card ${className}`.trim()}>
      {eyebrow ? <span className="ui-spotlight-eyebrow">{eyebrow}</span> : null}
      {title ? <strong>{title}</strong> : null}
      {copy ? <p>{copy}</p> : null}
      {children}
    </div>
  );
}

export function LandingSignalBar({ items = [], className = "" }) {
  return (
    <div className={`landing-signal-bar ${className}`.trim()}>
      {items.map((item) => (
        <div className="landing-signal-item" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function LandingProofStrip({ items = [], className = "" }) {
  return (
    <div className={`landing-proof-strip ${className}`.trim()}>
      {items.map((item) => (
        <div className="landing-proof-item" key={item.title}>
          <strong>{item.title}</strong>
          <p>{item.copy}</p>
        </div>
      ))}
    </div>
  );
}

export function LandingAudienceGrid({ items = [], className = "" }) {
  return (
    <div className={`landing-audience-grid ${className}`.trim()}>
      {items.map((item) => (
        <div className="landing-audience-card" key={item.title}>
          <span>{item.eyebrow}</span>
          <strong>{item.title}</strong>
          <p>{item.copy}</p>
        </div>
      ))}
    </div>
  );
}

export function LandingServiceRibbon({ items = [], className = "" }) {
  return (
    <div className={`landing-service-ribbon ${className}`.trim()}>
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

export function LandingOutcomeList({ items = [], className = "" }) {
  return (
    <div className={`landing-outcome-list ${className}`.trim()}>
      {items.map((item) => (
        <div className="landing-outcome-item" key={item.title}>
          <span>{item.index}</span>
          <div>
            <strong>{item.title}</strong>
            <p>{item.copy}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LandingBookingFlow({ items = [], className = "" }) {
  return (
    <div className={`landing-booking-flow ${className}`.trim()}>
      {items.map((item) => (
        <div className="landing-booking-step" key={item.title}>
          <span>{item.step}</span>
          <strong>{item.title}</strong>
          <p>{item.copy}</p>
        </div>
      ))}
    </div>
  );
}

export function LandingIncentiveBanner({ title, copy, href, actionLabel, className = "" }) {
  return (
    <div className={`landing-incentive-banner ${className}`.trim()}>
      <div>
        <strong>{title}</strong>
        <p>{copy}</p>
      </div>
      {href ? (
        <Link href={href} className="button">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function LandingMediaPair({ image, eyebrow, title, copy, items = [], className = "" }) {
  return (
    <div className={`landing-media-pair ${className}`.trim()}>
      <div className="landing-media-image" style={{ backgroundImage: `url('${image}')` }} />
      <div className="landing-media-copy">
        <span>{eyebrow}</span>
        <strong>{title}</strong>
        <p>{copy}</p>
        <LandingServiceRibbon items={items} />
      </div>
    </div>
  );
}

export function LandingTrustChecklist({ items = [], className = "" }) {
  return (
    <div className={`landing-trust-checklist ${className}`.trim()}>
      {items.map((item) => (
        <div className="landing-trust-item" key={item}>
          <span aria-hidden="true">OK</span>
          <p>{item}</p>
        </div>
      ))}
    </div>
  );
}

export function LandingFeaturedQuote({ quote, source, className = "" }) {
  return (
    <div className={`landing-featured-quote ${className}`.trim()}>
      <p>{quote}</p>
      <span>{source}</span>
    </div>
  );
}

export function LandingOfferMatrix({ items = [], className = "" }) {
  return (
    <div className={`landing-offer-matrix ${className}`.trim()}>
      {items.map((item) => (
        <div className="landing-offer-cell" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <p>{item.copy}</p>
        </div>
      ))}
    </div>
  );
}

export function LandingAvailabilityPanel({ title, items = [], className = "" }) {
  return (
    <div className={`landing-availability-panel ${className}`.trim()}>
      <strong>{title}</strong>
      <div>
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}

export function LandingProjectBriefPanel({ title, fields = [], className = "" }) {
  return (
    <div className={`landing-project-brief ${className}`.trim()}>
      <strong>{title}</strong>
      {fields.map((field) => (
        <div className="landing-brief-row" key={field.label}>
          <span>{field.label}</span>
          <p>{field.value}</p>
        </div>
      ))}
    </div>
  );
}

export function LandingFAQPreview({ items = [], className = "" }) {
  return (
    <div className={`landing-faq-preview ${className}`.trim()}>
      {items.map((item) => (
        <details key={item.question}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function LandingConversionFooter({ eyebrow, title, copy, href, actionLabel, className = "" }) {
  const isExternal = /^https?:\/\//i.test(String(href || ""));

  return (
    <section className={`landing-conversion-footer ${className}`.trim()}>
      <span>{eyebrow}</span>
      <strong>{title}</strong>
      <p>{copy}</p>
      {isExternal ? (
        <a href={href} className="button" target="_blank" rel="noreferrer">
          {actionLabel}
        </a>
      ) : (
        <Link href={href} className="button">
          {actionLabel}
        </Link>
      )}
    </section>
  );
}

export function LandingFeatureMarquee({ items = [], className = "" }) {
  return (
    <div className={`landing-feature-marquee ${className}`.trim()}>
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

export function LandingClientTypeCards({ items = [], className = "" }) {
  return (
    <div className={`landing-client-type-cards ${className}`.trim()}>
      {items.map((item) => (
        <div className="landing-client-type-card" key={item.title}>
          <strong>{item.title}</strong>
          <p>{item.copy}</p>
        </div>
      ))}
    </div>
  );
}

export function LandingServiceTimeline({ items = [], className = "" }) {
  return (
    <div className={`landing-service-timeline ${className}`.trim()}>
      {items.map((item) => (
        <div className="landing-timeline-item" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function LandingManagerHandoff({ title, items = [], className = "" }) {
  return (
    <div className={`landing-manager-handoff ${className}`.trim()}>
      <strong>{title}</strong>
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </div>
  );
}

export function LandingPortalPreview({ items = [], className = "" }) {
  return (
    <div className={`landing-portal-preview ${className}`.trim()}>
      {items.map((item) => (
        <div className="landing-portal-row" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function PortalAccessHeader({ eyebrow, title, copy, actions = [], className = "" }) {
  return (
    <div className={`portal-access-header ${className}`.trim()}>
      <span>{eyebrow}</span>
      <strong>{title}</strong>
      <p>{copy}</p>
      {actions.length ? (
        <div className="portal-action-row">
          {actions.map((action) => (
            <Link href={action.href} className={action.variant === "secondary" ? "button button-secondary" : "button"} key={action.label}>
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PortalModeSummary({ items = [], className = "" }) {
  return (
    <div className={`portal-mode-summary ${className}`.trim()}>
      {items.map((item) => (
        <div className="portal-mode-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <p>{item.copy}</p>
        </div>
      ))}
    </div>
  );
}

export function PortalTrustPanel({ title, items = [], className = "" }) {
  return (
    <div className={`portal-trust-panel ${className}`.trim()}>
      <strong>{title}</strong>
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </div>
  );
}

export function PortalCredentialChecklist({ items = [], className = "" }) {
  return (
    <div className={`portal-credential-checklist ${className}`.trim()}>
      {items.map((item) => (
        <div className="portal-check-row" key={item}>
          <span aria-hidden="true">OK</span>
          <p>{item}</p>
        </div>
      ))}
    </div>
  );
}

export function PortalAccountTypeGrid({ items = [], className = "" }) {
  return (
    <div className={`portal-account-type-grid ${className}`.trim()}>
      {items.map((item) => (
        <div className="portal-account-type-card" key={item.title}>
          <span>{item.eyebrow}</span>
          <strong>{item.title}</strong>
          <p>{item.copy}</p>
        </div>
      ))}
    </div>
  );
}

export function PortalSignupTimeline({ items = [], className = "" }) {
  return (
    <div className={`portal-signup-timeline ${className}`.trim()}>
      {items.map((item) => (
        <div className="portal-timeline-row" key={item.title}>
          <span>{item.step}</span>
          <div>
            <strong>{item.title}</strong>
            <p>{item.copy}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PortalReturnUserPanel({ title, copy, href, actionLabel, className = "" }) {
  return (
    <div className={`portal-return-user-panel ${className}`.trim()}>
      <strong>{title}</strong>
      <p>{copy}</p>
      <Link href={href} className="button button-secondary">
        {actionLabel}
      </Link>
    </div>
  );
}

export function PortalManagerNotice({ title, items = [], className = "" }) {
  return (
    <div className={`portal-manager-notice ${className}`.trim()}>
      <strong>{title}</strong>
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </div>
  );
}

export function PortalSecurityNote({ title, copy, items = [], className = "" }) {
  return (
    <div className={`portal-security-note ${className}`.trim()}>
      <strong>{title}</strong>
      <p>{copy}</p>
      <div>
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}

export function PortalDataUsePanel({ title, items = [], className = "" }) {
  return (
    <div className={`portal-data-use-panel ${className}`.trim()}>
      <strong>{title}</strong>
      {items.map((item) => (
        <div className="portal-data-row" key={item.label}>
          <span>{item.label}</span>
          <p>{item.copy}</p>
        </div>
      ))}
    </div>
  );
}

export function PortalFormSidecar({ title, items = [], className = "" }) {
  return (
    <div className={`portal-form-sidecar ${className}`.trim()}>
      <strong>{title}</strong>
      <div>
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}

export function PortalQuickLinks({ items = [], className = "" }) {
  return (
    <div className={`portal-quick-links ${className}`.trim()}>
      {items.map((item) => (
        <Link href={item.href} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </Link>
      ))}
    </div>
  );
}

export function PortalServicePreview({ items = [], className = "" }) {
  return (
    <div className={`portal-service-preview ${className}`.trim()}>
      {items.map((item) => (
        <div className="portal-preview-card" key={item.title}>
          <span>{item.label}</span>
          <strong>{item.title}</strong>
          <p>{item.copy}</p>
        </div>
      ))}
    </div>
  );
}

export function PortalProfilePreview({ items = [], className = "" }) {
  return (
    <div className={`portal-profile-preview ${className}`.trim()}>
      {items.map((item) => (
        <div className="portal-profile-row" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function PortalMessagePreview({ items = [], className = "" }) {
  return (
    <div className={`portal-message-preview ${className}`.trim()}>
      {items.map((item) => (
        <div className="portal-message-row" key={item.title}>
          <span>{item.role}</span>
          <div>
            <strong>{item.title}</strong>
            <p>{item.copy}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PortalRequestPreview({ items = [], className = "" }) {
  return (
    <div className={`portal-request-preview ${className}`.trim()}>
      {items.map((item) => (
        <div className="portal-request-row" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <p>{item.copy}</p>
        </div>
      ))}
    </div>
  );
}

export function PortalSupportBand({ title, copy, href, actionLabel, className = "" }) {
  return (
    <div className={`portal-support-band ${className}`.trim()}>
      <div>
        <strong>{title}</strong>
        <p>{copy}</p>
      </div>
      <Link href={href} className="button">
        {actionLabel}
      </Link>
    </div>
  );
}

export function PortalEntrySteps({ items = [], className = "" }) {
  return (
    <div className={`portal-entry-steps ${className}`.trim()}>
      {items.map((item) => (
        <div className="portal-entry-step" key={item.title}>
          <span>{item.step}</span>
          <strong>{item.title}</strong>
          <p>{item.copy}</p>
        </div>
      ))}
    </div>
  );
}

export function PortalValueStack({ items = [], className = "" }) {
  return (
    <div className={`portal-value-stack ${className}`.trim()}>
      {items.map((item) => (
        <div className="portal-value-item" key={item.title}>
          <strong>{item.title}</strong>
          <p>{item.copy}</p>
        </div>
      ))}
    </div>
  );
}

export function PortalConversionStrip({ title, copy, href, actionLabel, className = "" }) {
  return (
    <section className={`portal-conversion-strip ${className}`.trim()}>
      <strong>{title}</strong>
      <p>{copy}</p>
      <Link href={href} className="button">
        {actionLabel}
      </Link>
    </section>
  );
}

export function PortalSigninComponentSuite({ eyebrow, title, copy, groups = [], className = "" }) {
  return (
    <section className={`panel portal-signin-suite ${className}`.trim()}>
      <div className="portal-suite-header">
        <div>
          <p className="label">{eyebrow}</p>
          <h2 className="editorial-heading">{title}</h2>
        </div>
        <p>{copy}</p>
      </div>

      <div className="portal-suite-grid">
        {groups.map((group) => (
          <div className="portal-suite-group" key={group.title}>
            <div className="portal-suite-group-header">
              <span>{group.kicker}</span>
              <strong>{group.title}</strong>
              {group.copy ? <p>{group.copy}</p> : null}
            </div>
            <div className="portal-suite-items">
              {group.items.map((item) => (
                <article className="portal-suite-card" key={item.title}>
                  <span>{item.label}</span>
                  <strong>{item.title}</strong>
                  <p>{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FormHint({ children, className = "" }) {
  return <p className={`ui-form-hint ${className}`.trim()}>{children}</p>;
}
