import Link from "next/link";
import { BookingServicePicker } from "../../components/booking-service-picker";
import {
  LandingAvailabilityPanel,
  LandingBookingFlow,
  LandingProjectBriefPanel,
  LandingTrustChecklist,
  ShortcutRail
} from "../../components/shared-ui";
import { businessLines } from "../../lib/business-lines";
import { getSquareAppointmentBookingUrl } from "../../lib/square-appointments";

export const metadata = {
  title: "Book a Project",
  description:
    "Start a Black Lion Studios request through Multimedia, Tech Development, or Fashion.",
  alternates: { canonical: "/book" }
};

const bookingFlowItems = [
  { step: "01", title: "Choose the service", copy: "Photography, video, music sessions, AI development, and technical support use the same request flow." },
  { step: "02", title: "Send your request", copy: "Share project details, a budget range, and your preferred consultation time in the portal." },
  { step: "03", title: "Confirm the plan", copy: "Review scope, pricing, and scheduling with the studio before work begins." }
];

export default function BookPage() {
  const squareBookingUrl = getSquareAppointmentBookingUrl();

  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel hero-stage" style={{ backgroundImage: "url('/ai/hero-editorial.png')" }}>
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow brand-signature">Black Lion Studios</p>
              <h1>Choose a service. Tell us what you need.</h1>
              <p>
                Start with Multimedia, Tech Development, or Fashion. The portal keeps project
                details, messages, billing context, and follow-up in one place.
              </p>
              <div className="hero-actions">
                <Link href="/plan" className="button">Build a project brief</Link>
                <a
                  href={squareBookingUrl}
                  className="button button-secondary"
                  data-analytics-event="book_square_appointment_click"
                  target="_blank"
                  rel="noreferrer"
                >
                  Book appointment
                </a>
              </div>
            </div>
            <LandingProjectBriefPanel
              title="What to have ready"
              fields={[
                { label: "Branch", value: "Pick Multimedia, Tech Development, Fashion, or say you need help choosing." },
                { label: "Timing", value: "Ideal date, deadline, or booking window." },
                { label: "Budget", value: "A range helps the studio recommend the right scope." },
                { label: "References", value: "Links, files, examples, or notes make follow-up faster." }
              ]}
            />
          </div>
        </section>

        <BookingServicePicker />

        <section className="panel">
          <p className="label">Start here</p>
          <LandingBookingFlow items={bookingFlowItems} />
        </section>

        <section className="panel">
          <p className="label">Branches</p>
          <h2 className="editorial-heading">Choose the branch that fits the job.</h2>
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

        <section className="two-column">
          <div className="panel">
            <p className="label">Timing</p>
            <LandingAvailabilityPanel
              title="Normal request windows"
              items={["Same day questions", "1-3 day tech help", "3-10 day multimedia scheduling", "2-4 week web support"]}
            />
          </div>
          <div className="panel">
            <p className="label">Trust</p>
            <LandingTrustChecklist
              items={[
                "Starting prices or custom-quote terms are visible before signup.",
                "Requests and messages stay connected to one account.",
                "Privacy, terms, FAQ, and copyright pages are available before booking.",
                "Payment and invoice context is handled through the site flow."
              ]}
            />
          </div>
        </section>

      </main>
    </div>
  );
}
