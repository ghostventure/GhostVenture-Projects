import Link from "next/link";
import {
  LandingFeatureMarquee,
  ProcessSteps,
  ShortcutRail,
  SpotlightCard,
  SupportNotice,
  SurfaceGrid
} from "./shared-ui";
import { getSquareAppointmentBookingUrl } from "../lib/square-appointments";

export function BusinessLinePage({ line, children }) {
  const squareBookingUrl = getSquareAppointmentBookingUrl();

  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel hero-stage" style={{ backgroundImage: `url('${line.image}')` }}>
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow brand-signature">{line.name}</p>
              <h1>{line.hero}</h1>
              <p>{line.summary}</p>
              <div className="hero-actions">
                <Link href="/portal" className="button">
                  Start request
                </Link>
                <Link href="/services#service-estimation" className="button button-secondary">
                  Service Estimation
                </Link>
                <a href={squareBookingUrl} className="button button-secondary" target="_blank" rel="noreferrer">
                  Book appointment
                </a>
              </div>
            </div>
            <div className="ui-hero-badge-stack">
              {line.paths.slice(0, 3).map((item) => {
                const isExternal = /^https?:\/\//i.test(String(item.href || ""));
                const content = (
                  <>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <p>{item.note}</p>
                  </>
                );

                return isExternal ? (
                  <a href={item.href} className="ui-hero-badge" target="_blank" rel="noreferrer" key={item.label}>
                    {content}
                  </a>
                ) : (
                  <Link href={item.href} className="ui-hero-badge" key={item.label}>
                    {content}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <LandingFeatureMarquee items={line.highlights} />

        <section className="panel">
          <p className="label">{line.eyebrow}</p>
          <h2 className="editorial-heading">Choose the right path.</h2>
          <ShortcutRail items={line.paths} className="ui-shortcut-tight" />
        </section>

        <SurfaceGrid className="service-grid">
          {line.services.map((service) => (
            <SpotlightCard
              className="service-card"
              key={service.slug}
              eyebrow={service.priceLabel}
              title={service.name}
              copy={service.description}
            >
              <p className="muted">{service.coverage}</p>
              <p>{service.turnaround}</p>
              <div className="section-action-row">
                <Link href={service.href} className="button button-secondary">
                  Open
                </Link>
              </div>
            </SpotlightCard>
          ))}
        </SurfaceGrid>

        <section className="panel">
          <p className="label">How it moves</p>
          <ProcessSteps items={line.workflow} className="ui-process-compact" />
        </section>

        {children}

        <SupportNotice
          title="Portal handoff"
          copy="Use the portal for account-specific follow-up when available. If the account backend is unavailable, use Square Appointments or email contact@blacklionstudios.com with the branch, child service, timing, and project details."
        />
      </main>
    </div>
  );
}
