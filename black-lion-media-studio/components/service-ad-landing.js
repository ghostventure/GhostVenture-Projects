import Link from "next/link";
import {
  LandingAvailabilityPanel,
  LandingConversionFooter,
  LandingFAQPreview,
  LandingMediaPair,
  LandingOfferMatrix,
  LandingProjectBriefPanel,
  LandingTrustChecklist,
  ProcessSteps,
  SpotlightCard,
  SurfaceGrid
} from "./shared-ui";
import { serviceAdRoutes } from "../lib/services";

const bookingSteps = [
  "Review the service fit, starting price, normal timing, and required details.",
  "Open the portal so contact details, project notes, messages, and billing context stay together.",
  "Send the request with the brief details so Black Lion Studios can respond with the next action."
];

const trustItems = [
  "Starting price and normal timing are shown before the portal handoff.",
  "The request starts with the details most likely to prevent back-and-forth delays.",
  "Portal follow-up keeps messages, billing context, and project status connected.",
  "Visitors can ask a question first if the service scope is not clear yet."
];

export default function ServiceAdLandingPage({ page }) {
  const otherRoutes = serviceAdRoutes
    .filter((item) => item.route !== page.route)
    .slice(0, 5)
    .map((item) => ({
      href: item.route,
      label: item.route.replace("/", ""),
      value: item.route
        .replace("/", "")
        .split("-")
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(" "),
      note: "Compare this service lane"
    }));

  return (
    <div className="page-shell">
      <main className="stack">
        <LandingMediaPair
          image={page.image}
          eyebrow={page.service.name}
          title={page.headline}
          copy={page.summary}
          items={[page.service.priceLabel, page.service.turnaround, page.audience]}
        />

        <section className="panel">
          <p className="label">Start here</p>
          <h1>{page.service.name}</h1>
          <p className="muted">{page.service.description}</p>
          <div className="hero-actions">
            <Link href="/#service-estimation" className="button">
              Service Estimation
            </Link>
            <Link href="/contact" className="button button-secondary">
              Ask first
            </Link>
          </div>
        </section>

        <SurfaceGrid className="service-grid">
          <SpotlightCard
            className="service-card"
            eyebrow="Starting point"
            title={page.service.priceLabel}
            copy={page.service.deliverable}
          />
          <SpotlightCard
            className="service-card"
            eyebrow="Normal timing"
            title={page.service.turnaround}
            copy="Actual schedule depends on scope, availability, revisions, and how complete the request details are."
          />
          <SpotlightCard
            className="service-card"
            eyebrow="Coverage"
            title="What this lane handles"
            copy={page.service.coverage}
          />
        </SurfaceGrid>

        <section className="panel">
          <p className="label">Good fit</p>
          <LandingAvailabilityPanel title={`Use ${page.service.name} for`} items={page.fit} />
        </section>

        <section className="two-column">
          <div className="panel">
            <p className="label">Request brief</p>
            <LandingProjectBriefPanel
              title="Details to include"
              fields={page.briefFields}
            />
          </div>
          <div className="panel">
            <p className="label">Booking flow</p>
            <ProcessSteps items={bookingSteps} className="ui-process-compact" />
          </div>
        </section>

        <section className="panel">
          <p className="label">What happens next</p>
          <LandingOfferMatrix items={page.outcomes} />
        </section>

        <section className="panel">
          <p className="label">Ad traffic handoff</p>
          <LandingTrustChecklist items={trustItems} />
        </section>

        <section className="panel">
          <p className="label">Quick answers</p>
          <LandingFAQPreview
            items={page.faqs.map((answer, index) => ({
              question: `${page.service.name} note ${index + 1}`,
              answer
            }))}
          />
        </section>

        <section className="panel">
          <p className="label">Other services</p>
          <SurfaceGrid className="service-grid">
            {otherRoutes.map((route) => (
              <SpotlightCard
                className="service-card"
                key={route.href}
                eyebrow={route.label}
                title={route.value}
                copy={route.note}
              >
                <Link href={route.href} className="button button-secondary">
                  View
                </Link>
              </SpotlightCard>
            ))}
          </SurfaceGrid>
        </section>

        <LandingConversionFooter
          eyebrow="Ready"
          title={`Start a ${page.service.name} request.`}
          copy="Start with the quote details, then continue into the portal for tracked follow-up."
          href="/#service-estimation"
          actionLabel="Service Estimation"
        />
      </main>
    </div>
  );
}
