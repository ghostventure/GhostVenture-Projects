import Link from "next/link";
import {
  LandingAvailabilityPanel,
  LandingBookingFlow,
  LandingConversionFooter,
  LandingOfferMatrix,
  LandingProjectBriefPanel,
  LandingTrustChecklist
} from "../../components/shared-ui";
import { getSquareAppointmentBookingUrl } from "../../lib/square-appointments";
import { serviceCatalog } from "../../lib/services";

export const metadata = {
  title: "Book a Project",
  description:
    "Start a Black Lion Studios request for photography, video, DJ services, beat sessions, membership sites, PC support, or merch questions.",
  alternates: { canonical: "/book" }
};

const bookingFlowItems = [
  { step: "01", title: "Book the time", copy: "Use Square Appointments to lock in the appointment window." },
  { step: "02", title: "Send details", copy: "Share timing, budget range, files, and project notes." },
  { step: "03", title: "Keep follow-up together", copy: "Square bookings sync into the studio calendar for review and follow-up." }
];

const offerItems = serviceCatalog.map((service) => ({
  label: service.priceLabel,
  value: service.name,
  copy: service.description
}));

export default function BookPage() {
  const squareBookingUrl = getSquareAppointmentBookingUrl();

  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel hero-stage" style={{ backgroundImage: "url('/ai/hero-editorial.png')" }}>
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow brand-signature">Black Lion Studios</p>
              <h1>Book creative or tech work without a loose message thread.</h1>
              <p>
                Start a request for photo, video, music, DJ work, membership-site support, PC help,
                or merch questions. The portal keeps the project details, messages, billing context,
                and follow-up in one place.
              </p>
              <div className="hero-actions">
                <a
                  href={squareBookingUrl}
                  className="button"
                  data-analytics-event="book_square_appointment_click"
                  target="_blank"
                  rel="noreferrer"
                >
                  Book appointment
                </a>
                <Link href="/portal" className="button button-secondary" data-analytics-event="book_portal_click">
                  Open portal
                </Link>
              </div>
            </div>
            <LandingProjectBriefPanel
              title="What to have ready"
              fields={[
                { label: "Service", value: "Pick one lane or say you need help choosing." },
                { label: "Timing", value: "Ideal date, deadline, or booking window." },
                { label: "Budget", value: "A range helps the studio recommend the right scope." },
                { label: "References", value: "Links, files, examples, or notes make follow-up faster." }
              ]}
            />
          </div>
        </section>

        <section className="panel">
          <p className="label">Start here</p>
          <LandingBookingFlow items={bookingFlowItems} />
        </section>

        <section className="panel">
          <p className="label">Services</p>
          <h2 className="editorial-heading">Choose the lane that fits the job.</h2>
          <LandingOfferMatrix items={offerItems} />
        </section>

        <section className="two-column">
          <div className="panel">
            <p className="label">Timing</p>
            <LandingAvailabilityPanel
              title="Normal request windows"
              items={["Same day questions", "1-3 day tech help", "3-10 day creative scheduling", "2-4 week site support"]}
            />
          </div>
          <div className="panel">
            <p className="label">Trust</p>
            <LandingTrustChecklist
              items={[
                "Starting prices and normal timing are visible before signup.",
                "Requests and messages stay connected to one account.",
                "Privacy, terms, FAQ, and copyright pages are available before booking.",
                "Payment and invoice context is handled through the site flow."
              ]}
            />
          </div>
        </section>

        <LandingConversionFooter
          eyebrow="Ready"
          title="Book through Square, then keep follow-up in the portal."
          copy="Confirmed Square appointments flow back into the studio calendar."
          href={squareBookingUrl}
          actionLabel="Book appointment"
        />
      </main>
    </div>
  );
}
