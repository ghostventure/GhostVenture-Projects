import Link from "next/link";
import { ProcessSteps, ShortcutRail, SpotlightCard, SurfaceGrid } from "../../components/shared-ui";
import { serviceAdRoutes, serviceCatalog } from "../../lib/services";

export const metadata = {
  title: "Services",
  description: "Black Lion Studios services for photography, videography, DJ work, beat sessions, membership sites, and PC tech support.",
  alternates: { canonical: "/services" }
};

export default function ServicesPage() {
  const serviceRouteItems = serviceAdRoutes.map((route) => {
    const service = serviceCatalog.find((item) => item.slug === route.catalogSlug);
    return {
      label: service?.priceLabel || "Service",
      value: service?.name || route.route.replace("/", ""),
      href: route.route,
      note: route.headline
    };
  });

  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel">
          <p className="label">Services</p>
          <h1>Choose the work you need, then send the request.</h1>
          <p className="muted">
            Review starting prices, normal timing, and coverage before creating an account.
          </p>
          <div className="hero-actions">
            <Link href="/book" className="button">Start a request</Link>
            <Link href="/quote" className="button button-secondary">Get quick quote</Link>
          </div>
          <ShortcutRail items={serviceRouteItems} className="ui-shortcut-tight" />
        </section>
        <SurfaceGrid className="service-grid">
          {serviceCatalog.map((service) => (
            <SpotlightCard
              className="service-card"
              key={service.slug}
              eyebrow={service.priceLabel}
              title={service.name}
              copy={service.description}
            >
              <p className="muted">{service.coverage}</p>
              <p>{service.turnaround}</p>
            </SpotlightCard>
          ))}
        </SurfaceGrid>
        <section className="panel">
          <p className="label">Booking flow</p>
          <ProcessSteps
            items={[
              "Pick the service that matches the project.",
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
