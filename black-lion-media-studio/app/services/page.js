import Link from "next/link";
import { ServiceQuoteBuilder } from "../../components/service-quote-builder";
import { ProcessSteps, ShortcutRail, SpotlightCard, SurfaceGrid } from "../../components/shared-ui";
import { businessLines } from "../../lib/business-lines";

export const metadata = {
  title: "Services",
  description: "Black Lion Studios services grouped into Multimedia, Tech Development, and Fashion branches.",
  alternates: { canonical: "/services" }
};

export default function ServicesPage() {
  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel">
          <p className="label">Services</p>
          <h1>Choose a Black Lion branch, then send the request.</h1>
          <p className="muted">
            Services are grouped into Multimedia, Tech Development, and Fashion, with individual
            service routes still available for specific ad or booking paths.
          </p>
          <div className="hero-actions">
            <Link href="/portal" className="button">Start a request</Link>
            <Link href="#service-estimation" className="button button-secondary">Service Estimation</Link>
          </div>
          <ShortcutRail
            items={businessLines.map((line) => ({
              href: line.href,
              label: line.eyebrow,
              value: line.name,
              note: line.summary
            }))}
            className="ui-shortcut-tight"
          />
        </section>
        {businessLines.map((line) => (
          <section className="panel" key={line.slug}>
            <p className="label">{line.eyebrow}</p>
            <h2 className="editorial-heading">{line.name}</h2>
            <p className="muted">{line.summary}</p>
            <ShortcutRail items={line.paths} className="ui-shortcut-tight" />
            <SurfaceGrid className="service-grid">
              {line.services.map((service) => (
                <SpotlightCard
                  className="service-card"
                  key={`${line.slug}-${service.slug}`}
                  eyebrow={service.priceLabel}
                  title={service.name}
                  copy={service.description}
                >
                  <p className="muted">{service.coverage}</p>
                  <p>{service.turnaround}</p>
                </SpotlightCard>
              ))}
            </SurfaceGrid>
          </section>
        ))}
        <section className="panel">
          <p className="label">AI project pricing</p>
          <h2>Start with a conversation about your idea.</h2>
          <p>AI guidance, custom software, and automation are quoted after a project review. Share what you want to do, even if you are unsure how to begin.</p>
          <Link href="/ai-services" className="button">Explore AI services</Link>
        </section>
        <ServiceQuoteBuilder />
        <section className="panel">
          <p className="label">Booking flow</p>
          <ProcessSteps
            items={[
              "Pick Multimedia, Tech Development, Fashion, or a child service inside one branch.",
              "Create the account so the studio has contact and billing context.",
              "Send details, files, dates, and budget range through the portal."
            ]}
            className="ui-process-compact"
          />
        </section>
      </main>
    </div>
  );
}
