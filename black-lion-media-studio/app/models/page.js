import Link from "next/link";
import { BackendStatusNotice } from "../../components/backend-status-notice";
import { ModelApplicationForm } from "../../components/model-application-form";
import {
  ShortcutRail,
  SupportNotice
} from "../../components/shared-ui";
import { modelFaqPreviewItems } from "../../lib/model-faq";

export const metadata = {
  title: "Model Sign-up | Black Lion Fashion",
  description: "Apply to be considered for Black Lion Fashion modeling projects, brand shoots, editorial work, video productions, and casting opportunities.",
  alternates: { canonical: "/models" }
};

const premiumSignals = [
  { label: "Eligibility", value: "18+", note: "Adult-only applicant review" },
  { label: "Work type", value: "1099", note: "Project-based contractor opportunities" },
  { label: "Review pace", value: "Fast", note: "Speed, prep, and communication matter" },
  { label: "Profile lane", value: "Separate", note: "Model profiles are not client profiles" }
];

export default function ModelsPage() {
  return (
    <div className="page-shell models-page-shell">
      <main className="stack models-stack">
        <section className="panel legal-hero models-hero">
          <p className="label">Black Lion Fashion model sub-site</p>
          <h1>Apply for Black Lion Fashion modeling opportunities.</h1>
          <p>
            Submit your contact details, portfolio, availability, and project interests to be
            considered for Fashion-linked contracted shoots, campaigns, videos, editorial work, and casting pools.
          </p>
          <div className="legal-action-row">
            <a href="#model-application" className="button">Start application</a>
            <Link href="/portfolio" className="button button-secondary">View studio work</Link>
          </div>
          <div className="model-signal-grid model-signal-grid-compact">
            {premiumSignals.map((item) => (
              <div className="model-signal-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="model-application-layout">
          <div className="panel" id="model-application">
            <p className="label">Application</p>
            <h2 className="editorial-heading">Send your model profile.</h2>
            <p className="muted">
              Confirm the application matches how you want to be considered. The details you enter
              feed the separate model profile used for manager review.
            </p>
            <BackendStatusNotice context="model application" />
            <ModelApplicationForm />
            <SupportNotice
              title="Important terms"
              copy="Submission creates or updates a separate model profile. It does not create a booking, employment relationship, agency representation, exclusivity, or guaranteed paid work. Opportunities are project-based 1099 contractor opportunities, not full-time W-2 employment. Reapplication is limited to once every 3 months, and missed confirmed calls or bookings may lower future priority."
            />
            <section className="model-related-panel">
              <p className="label">Related paths</p>
              <ShortcutRail
                items={[
                  { href: "/fashion", label: "Fashion", value: "Black Lion Fashion", note: "Merch, fashion content, and model routing" },
                  { href: "/photography", label: "Photo", value: "Production work", note: "Portraits, events, and campaigns" },
                  { href: "/videography", label: "Video", value: "Shoot support", note: "Music videos, promos, and content" },
                  { href: "/contact", label: "Contact", value: "Ask first", note: "Use for routing questions" }
                ]}
                className="ui-shortcut-tight"
              />
            </section>
          </div>
        </section>
        <section className="panel model-faq-panel">
          <p className="label">Model FAQ</p>
          <h2 className="editorial-heading">Quick questions before signing up.</h2>
          <div className="model-faq-grid">
            {modelFaqPreviewItems.map((item) => (
              <details className="model-faq-item" key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
          <div className="section-action-row">
            <Link href="/models/faq" className="button button-secondary">Full Model FAQ</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
