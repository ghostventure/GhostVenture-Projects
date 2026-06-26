import Link from "next/link";
import { Suspense } from "react";
import { QuickQuoteForm } from "../../components/quick-quote-form";
import { ShortcutRail, SupportNotice } from "../../components/shared-ui";

export const metadata = {
  title: "Quick Quote",
  description: "Request a quick Black Lion Studios quote for photography, video, music, DJ, membership site, PC support, or merch work.",
  alternates: { canonical: "/quote" }
};

export default function QuotePage() {
  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel legal-hero quote-hero">
          <p className="label">Quick quote</p>
          <h1>Send enough detail for a useful first response.</h1>
          <p>
            Pick the service, budget range, timing, and contact details. The form saves a local
            fallback record in this browser, then points you to the portal for account-based follow-up.
          </p>
          <div className="legal-action-row">
            <Link href="/portal" className="button">Open portal</Link>
            <Link href="/services" className="button button-secondary">Review services</Link>
          </div>
        </section>

        <section className="two-column quote-layout">
          <div className="panel">
            <p className="label">Request details</p>
            <h2 className="editorial-heading">Start the quote.</h2>
            <Suspense fallback={<p className="message">Loading quote form.</p>}>
              <QuickQuoteForm />
            </Suspense>
          </div>

          <div className="stack-small">
            <SupportNotice
              title="Local fallback only"
              copy="This quick form does not add a backend API. It keeps the draft lead in the visitor's browser and routes serious follow-up to the portal."
            />
            <section className="panel">
              <p className="label">Best next path</p>
              <ShortcutRail
                items={[
                  { href: "/portal", label: "Portal", value: "Create account", note: "Best for tracked follow-up" },
                  { href: "/services", label: "Services", value: "Compare options", note: "Review price ranges and timing" },
                  { href: "/contact", label: "Contact", value: "Ask first", note: "Use if the request needs routing" }
                ]}
                className="ui-shortcut-tight"
              />
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
