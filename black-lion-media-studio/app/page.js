import Link from "next/link";
import {
  HeroBadgeStack,
  LandingAudienceGrid,
  LandingBookingFlow,
  LandingConversionFooter,
  LandingFAQPreview,
  LandingFeatureMarquee,
  LandingIncentiveBanner,
  LandingOfferMatrix,
  LandingOutcomeList,
  LandingPortalPreview,
  LandingProofStrip,
  LandingServiceRibbon,
  LandingServiceTimeline,
  LandingSignalBar,
  LandingTrustChecklist,
  ProcessSteps,
  ShortcutRail,
  SpotlightCard,
  SurfaceGrid,
  ValueCardGrid
} from "../components/shared-ui";
import { getConsultationAvailability } from "../lib/consultations";
import { listAllRequestsWithUsers } from "../lib/db";
import { faqItems } from "../lib/legal-content";
import { serviceAdRoutes, serviceCatalog } from "../lib/services";
import { getSquareAppointmentBookingUrl } from "../lib/square-appointments";

export const dynamic = "force-dynamic";

const inactiveSplashStatuses = new Set(["Cancelled", "Canceled", "Declined", "Closed"]);

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatSplashDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(date);
}

function parseHourBlock(timeValue) {
  const match = String(timeValue || "").match(/^(\d{1,2})(?::\d{2})?\s(AM|PM)$/i);
  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const meridiem = match[2].toUpperCase();

  if (meridiem === "PM" && hour !== 12) {
    hour += 12;
  }

  if (meridiem === "AM" && hour === 12) {
    hour = 0;
  }

  return hour;
}

function formatHourBlock(hour) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function buildSplashBookingBlocks(availability, requests) {
  const displayDay = availability[0] || null;
  const dateValue = displayDay?.value || toIsoDate(new Date());
  const bookableHours = new Set((displayDay?.timeSlots || []).map(parseHourBlock).filter((hour) => hour !== null));
  const activeRequests = requests.filter((request) => !inactiveSplashStatuses.has(request.status));
  const reservedHours = new Set(
    activeRequests
      .filter((request) => request.consultation_date === dateValue)
      .map((request) => parseHourBlock(request.consultation_time))
      .filter((hour) => hour !== null)
  );

  return [10, 11, 12, 13, 14, 15, 16].map((hour) => {
    const isReserved = reservedHours.has(hour);
    const isAvailable = bookableHours.has(hour);
    const status = isReserved ? "reserved" : isAvailable ? "available" : "not-available";

    return {
      id: `${dateValue}-${hour}`,
      dateLabel: formatSplashDate(dateValue),
      timeLabel: formatHourBlock(hour),
      status,
      statusLabel:
        status === "reserved"
          ? "Reserved"
          : status === "available"
            ? "Available"
            : "Not Available"
    };
  });
}

async function getSplashBookingBlocks() {
  const availability = getConsultationAvailability();

  try {
    return buildSplashBookingBlocks(availability, await listAllRequestsWithUsers());
  } catch (error) {
    console.error("Unable to load public booking blocks", error);
    return buildSplashBookingBlocks(availability, []);
  }
}

export default async function HomePage() {
  const squareBookingUrl = getSquareAppointmentBookingUrl();
  const splashBookingBlocks = await getSplashBookingBlocks();
  const heroBadges = [
    { label: "Start here", value: "Book the time or send the details" },
    { label: "Best for", value: "Photos, video, music, tech help, and merch" },
    { label: "Calendar benefit", value: "Square appointments sync back into the studio view" }
  ];
  const signalItems = [
    { label: "Start", value: "Choose a service" },
    { label: "Send", value: "Share the project" },
    { label: "Track", value: "Messages, billing, status" }
  ];
  const audienceItems = [
    { eyebrow: "Creators", title: "Need photos, video, or music support", copy: "Book production help for releases, events, promo content, sessions, and brand work." },
    { eyebrow: "Small business", title: "Need a practical web or tech fix", copy: "Request membership-site support, PC help, setup, troubleshooting, and tune-up work." },
    { eyebrow: "Returning clients", title: "Need the next job to move faster", copy: "Keep your profile, billing details, messages, and project history in one account." }
  ];
  const proofItems = [
    { title: "Clear project details", copy: "Tell the studio what you need, when you need it, and what budget range fits." },
    { title: "Real follow-up", copy: "Your request goes to the studio with enough detail for a useful response." },
    { title: "Saved for next time", copy: "Your services, messages, and contact details stay together for future work." }
  ];
  const promiseItems = [
    { label: "Clarity", value: "Know what to book", note: "Services are shown before signup so the account has a clear purpose." },
    { label: "Momentum", value: "Request, track, message", note: "Keep project questions and updates in one place." },
    { label: "Incentive", value: "Start faster next time", note: "You do not have to repeat the same details for every project." }
  ];
  const signupHighlightItems = [
    { label: "Saved", value: "Contact and project notes" },
    { label: "Faster", value: "Repeat bookings and follow-up" },
    { label: "Cleaner", value: "Messages, invoices, and delivery" }
  ];
  const signupMomentumItems = [
    { label: "01", value: "Start once", note: "Create the account before the next booking rush." },
    { label: "02", value: "Keep details ready", note: "Service interest, contact info, notes, and billing context stay together." },
    { label: "03", value: "Return faster", note: "The next request starts from your saved workspace instead of a blank form." }
  ];
  const processItems = [
    "Choose the service that matches the project.",
    "Create an account so the studio knows who to contact.",
    "Send the details and continue the conversation from the same place."
  ];
  const outcomeItems = [
    { index: "01", title: "Less repeat explaining", copy: "Your contact and project details are ready when the studio responds." },
    { index: "02", title: "Easier booking decisions", copy: "Services show starting prices and timing before you sign up." },
    { index: "03", title: "A better next project", copy: "Future requests can start from what you already saved." }
  ];
  const serviceTimelineItems = [
    { label: "Same day", value: "Send request, ask questions, save project notes" },
    { label: "1-3 days", value: "PC support, diagnostics, quick creative planning" },
    { label: "3-10 days", value: "Photo, video, music, DJ, and beat-session scheduling" },
    { label: "2-4 weeks", value: "Membership-site setup, page updates, and support planning" }
  ];
  const bookingFlowItems = [
    { step: "Book", title: "Pick the appointment", copy: "Square handles the confirmed appointment slot." },
    { step: "Sync", title: "Calendar updates", copy: "The studio calendar receives Square booking changes." },
    { step: "Send", title: "Add project details", copy: "Use the portal when the job needs files, notes, or billing context." },
    { step: "Move", title: "Keep talking", copy: "Use messages for questions, updates, and next steps." }
  ];
  const offerItems = [
    { label: "Creative", value: "Photo, video, music", copy: "Production work for events, creators, brands, and projects." },
    { label: "Technical", value: "Sites and PC support", copy: "Practical help for membership sites and computer issues." },
    { label: "Store", value: "Merch", copy: "Browse merch and keep purchase questions tied to your account." },
    { label: "Support", value: "Scheduling and delivery", copy: "Ask questions about timing, billing, files, and next steps." }
  ];
  const adPathItems = [
    { label: "Book", value: "Square appointment", href: squareBookingUrl, note: "Confirmed booking path for visitors ready to move." },
    { label: "Quote", value: "Get quick quote", href: "/quote", note: "Fast lead capture before account handoff." },
    { label: "Support", value: "Ask for help", href: "/support", note: "Billing, scheduling, delivery, and account questions." },
    { label: "Expansion", value: "200-component board", href: "/ad-expansion", note: "Operational controls added for ad traffic." }
  ];
  const servicePathItems = serviceAdRoutes.map((route) => {
    const service = serviceCatalog.find((item) => item.slug === route.catalogSlug);
    return {
      label: service?.priceLabel || "Service",
      value: service?.name || route.route.replace("/", ""),
      href: route.route,
      note: route.audience
    };
  });
  const portalPreviewItems = [
    { label: "Profile", value: "Contact, billing, shipping, and preferences" },
    { label: "Dashboard", value: "Requests, dates, and project status" },
    { label: "Messages", value: "Questions and replies with the studio" }
  ];
  const trustItems = [
    "Starting prices and normal timing are visible before signup.",
    "Requests, messages, billing, and profile details stay tied to one account.",
    "Legal, privacy, accessibility, DMCA, and support pages are available from the footer.",
    "Payment and invoice work is routed through the site's billing flow instead of loose message threads."
  ];
  const homepageFaqItems = faqItems.slice(0, 8);

  return (
    <div className="page-shell homepage-shell">
      <main className="stack">
        <section className="panel hero-stage" style={{ backgroundImage: "url('/ai/hero-editorial.png')" }}>
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow brand-signature">Black Lion Studios</p>
              <h1>Book creative and tech work without starting from scratch every time.</h1>
              <p>
                Black Lion Studios handles photography, video, music, DJ work, membership sites,
                PC support, and merch. Choose what you need, send the project details, and keep
                follow-up, invoices, and messages in one account.
              </p>
              <div className="hero-actions">
                <a href={squareBookingUrl} className="button" target="_blank" rel="noreferrer">
                  Book appointment
                </a>
                <Link href="/portal" className="button button-secondary">
                  Create account
                </Link>
                <Link href="/models" className="button button-secondary">
                  Are you a model?
                </Link>
              </div>
              <LandingSignalBar items={signalItems} />
            </div>

            <HeroBadgeStack items={heroBadges} />
          </div>
        </section>

        <LandingFeatureMarquee
          items={["Photography", "Videography", "Beat sessions", "DJ services", "Membership sites", "PC support", "Merch"]}
        />

        <section className="signup-spark-panel" aria-label="Account signup benefits">
          <div>
            <p className="label">Client account</p>
            <strong>Sign up once. Move faster every time after.</strong>
          </div>
          <div className="signup-spark-grid">
            {signupHighlightItems.map((item) => (
              <div className="signup-spark-item" key={item.label}>
                <span>{item.label}</span>
                <p>{item.value}</p>
              </div>
            ))}
          </div>
          <Link href="/portal" className="button">
            Create account
          </Link>
        </section>

        <section className="panel">
          <p className="label">Visible access</p>
          <h2 className="editorial-heading">Choose the fastest way in.</h2>
          <ShortcutRail items={adPathItems} className="ui-shortcut-tight" />
        </section>

        <section className="two-column">
          <div className="panel splash-booking-card">
            <p className="label">Appointment calendar</p>
            <div className="splash-calendar-head">
              <div>
                <h2 className="editorial-heading">Open booking windows.</h2>
                <p className="support-copy muted">
                  Pick a Square appointment and the confirmed booking feeds back into the studio calendar.
                </p>
              </div>
              <span>Live sync</span>
            </div>
            <div className="splash-calendar-strip" aria-label="Upcoming appointment availability">
              {splashBookingBlocks.map((block) => (
                <div
                  className={`splash-calendar-day splash-calendar-day-${block.status}`}
                  key={block.id}
                >
                  <span>{block.dateLabel}</span>
                  <strong>{block.timeLabel}</strong>
                  <p>{block.statusLabel}</p>
                </div>
              ))}
            </div>
            <div className="splash-calendar-foot">
              <div>
                <strong>Square appointments</strong>
                <p>Models, clients, and studio bookings land in one review calendar.</p>
              </div>
              <a href={squareBookingUrl} className="button" target="_blank" rel="noreferrer">
                Book
              </a>
            </div>
          </div>
          <div className="panel">
            <p className="label">Square booking</p>
            <h2 className="editorial-heading">Book the appointment first, then keep the project details together.</h2>
            <p className="support-copy muted">
              Square handles appointment selection. Confirmed Square bookings flow into the studio
              calendar so models, clients, and studio bookings share one schedule view.
            </p>
            <div className="hero-actions">
              <a href={squareBookingUrl} className="button" target="_blank" rel="noreferrer">
                Book appointment
              </a>
              <Link href="/portal" className="button button-secondary">
                Open portal
              </Link>
            </div>
          </div>
        </section>

        <section className="panel">
          <p className="label">Who this helps</p>
          <LandingAudienceGrid items={audienceItems} />
        </section>

        <section className="panel highlight-panel">
          <p className="label">Why sign up</p>
          <div className="feature-grid">
            <div>
              <h2 className="editorial-heading">A clearer reason to create the account.</h2>
              <p className="support-copy muted">
                The account helps the studio answer faster because your contact details, service
                request, and messages stay together.
              </p>
              <ProcessSteps items={processItems} className="ui-process-compact" />
            </div>
            <ValueCardGrid items={promiseItems} />
          </div>
        </section>

        <section className="signup-momentum-panel" aria-label="Signup momentum">
          <div>
            <p className="label">Account advantage</p>
            <h2 className="editorial-heading">Make the next request feel already started.</h2>
            <p className="support-copy muted">
              The portal is built for people who plan to come back, ask follow-up questions,
              or keep booking work with the studio.
            </p>
          </div>
          <div className="signup-momentum-grid">
            {signupMomentumItems.map((item) => (
              <div className="signup-momentum-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.note}</p>
              </div>
            ))}
          </div>
          <div className="section-action-row">
            <Link href="/portal" className="button">
              Open client portal
            </Link>
            <Link href="/quote" className="button button-secondary">
              Quick quote
            </Link>
          </div>
        </section>

        <section className="panel">
          <p className="label">Proof and outcomes</p>
          <LandingProofStrip items={proofItems} />
          <LandingOutcomeList items={outcomeItems} />
        </section>

        <LandingIncentiveBanner
          title="The account is the shortcut."
          copy="Once it is set up, the next project starts with saved contact details, billing context, message history, and service preferences."
          href="/portal"
          actionLabel="Create account"
        />

        <section className="panel" id="services">
          <p className="label">Services</p>
          <h2 className="editorial-heading">What people can actually book.</h2>
          <LandingServiceRibbon items={serviceCatalog.map((service) => service.name)} />
          <ShortcutRail items={servicePathItems} className="ui-shortcut-tight" />
          <SurfaceGrid className="service-grid">
            {serviceCatalog.map((service) => (
              <SpotlightCard
                className="service-card"
                key={service.slug}
                eyebrow={service.priceLabel}
                title={service.name}
                copy={service.description}
              >
                <p className="muted">{service.turnaround}</p>
              </SpotlightCard>
            ))}
          </SurfaceGrid>
        </section>

        <section className="panel">
          <p className="label">Timing</p>
          <h2 className="editorial-heading">Know what kind of schedule you are starting.</h2>
          <LandingServiceTimeline items={serviceTimelineItems} />
        </section>

        <section className="two-column">
          <div className="panel">
            <p className="label">Booking flow</p>
            <LandingBookingFlow items={bookingFlowItems} />
          </div>
          <div className="panel">
            <p className="label">Account details</p>
            <LandingPortalPreview items={portalPreviewItems} />
          </div>
        </section>

        <section className="panel">
          <p className="label">Offer map</p>
          <LandingOfferMatrix items={offerItems} />
        </section>

        <section className="panel">
          <p className="label">Trust and handoff</p>
          <LandingTrustChecklist items={trustItems} />
        </section>

        <section className="panel" id="faq">
          <p className="label">Questions</p>
          <LandingFAQPreview items={homepageFaqItems} />
          <div className="section-action-row">
            <Link href="/faq" className="button button-secondary">
              Full FAQ
            </Link>
          </div>
        </section>

        <LandingConversionFooter
          eyebrow="Ready"
          title="Book the appointment, then keep follow-up in one place."
          copy="Square handles the slot. The portal keeps notes, messages, invoices, and delivery context connected."
          href={squareBookingUrl}
          actionLabel="Book appointment"
        />
      </main>
    </div>
  );
}
