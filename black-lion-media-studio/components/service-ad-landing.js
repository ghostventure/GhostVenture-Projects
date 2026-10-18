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
  "Choose your service and review its starting price or custom-quote approach.",
  "Send your project details, budget range, and preferred consultation time through the portal.",
  "Receive follow-up to confirm scope, pricing, and scheduling before work begins."
];

const trustItems = [
  "Starting prices or custom-quote terms are shown before the portal handoff.",
  "The request starts with the details most likely to prevent back-and-forth delays.",
  "Portal follow-up keeps messages, billing context, and project status connected.",
  "Visitors can ask a question first if the service scope is not clear yet."
];

export default function ServiceAdLandingPage({ page }) {
  const otherRoutes = serviceAdRoutes
    .filter((item) => item.route !== page.route)
    .sort((a, b) => Number(b.branchHref === page.branchHref) - Number(a.branchHref === page.branchHref))
    .slice(0, 5)
    .map((item) => ({
      href: item.route,
      label: item.route.replace("/", ""),
      value: item.route
        .replace("/", "")
        .split("-")
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(" "),
      note: "Compare this child service"
    }));

  return (
    <div className="page-shell">
      <main className="stack">
        <LandingMediaPair
          image={page.image}
          eyebrow={`${page.branchName} child service`}
          title={page.headline}
          copy={page.summary}
          items={[page.branchName, page.service.priceLabel, page.service.turnaround, page.audience]}
        />

        <section className="panel">
          <p className="label">Start here</p>
          <h1>{page.service.name}</h1>
          <p className="muted">
            {page.service.description} This page belongs under {page.branchName}.
          </p>
          <div className="hero-actions">
            <Link href={`/portal?service=${page.service.slug}`} className="button">
              Start request
            </Link>
            <Link href={page.branchHref} className="button button-secondary">
              {page.branchName}
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
            title="What this child service handles"
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
          <LandingTrustChecklist items={page.trustItems || trustItems} />
        </section>

        <section className="panel">
          <p className="label">Quick answers</p>
          <LandingFAQPreview
            items={page.faqs.map((answer, index) => ({
              question: typeof answer === "string" ? `${page.service.name} note ${index + 1}` : answer.question,
              answer: typeof answer === "string" ? answer : answer.answer
            }))}
          />
        </section>

        <section className="panel">
          <p className="label">Other child services</p>
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
          copy="Choose your service, share the project details and preferred timing, then receive follow-up on scope and scheduling."
          href={`/portal?service=${page.service.slug}`}
          actionLabel="Start request"
        />
      </main>
    </div>
  );
}
