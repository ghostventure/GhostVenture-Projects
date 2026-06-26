import Link from "next/link";
import { lastUpdated, termsSections } from "../../lib/legal-content";

export default function TermsPage() {
  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel legal-hero">
          <p className="label">Terms of Use</p>
          <h1>Rules for using the site, portal, and service request flow.</h1>
          <p>
            These terms apply to public browsing, account access, service requests, messages,
            Square appointments, store-related activity, payments, and project coordination.
            Last updated {lastUpdated}.
          </p>
          <Link href="/portal" className="button">
            Continue to portal
          </Link>
        </section>

        <section className="panel legal-section">
          <h2>Short version</h2>
          <p>
            Public pages are informational. Confirmed appointments, quotes, invoices, payment terms,
            cancellations, deliverables, and usage rights depend on the accepted project terms and
            the relevant Square or studio records.
          </p>
        </section>

        {termsSections.map((section) => (
          <section className="panel legal-section" key={section.title}>
            <h2>{section.title}</h2>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}

        <section className="panel legal-section">
          <h2>Governing law and updates</h2>
          <p>
            Unless a written agreement says otherwise, site terms are intended for use under
            applicable United States law and any mandatory local consumer protections that apply.
            Black Lion Studios may update these terms when services, laws, or operations change.
          </p>
        </section>
      </main>
    </div>
  );
}
