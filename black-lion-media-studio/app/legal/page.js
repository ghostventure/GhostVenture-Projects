import Link from "next/link";
import {
  complianceItems,
  governmentComplianceSections,
  lastUpdated,
  legalReferenceLinks
} from "../../lib/legal-content";

export default function LegalPage() {
  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel legal-hero">
          <p className="label">Legal</p>
          <h1>Legal, compliance, and site policy overview.</h1>
          <p>
            This page summarizes the operating rules for Black Lion Studios and links to the
            detailed privacy, terms, and copyright-claim pages. It includes current notes for
            Square appointments, public availability display, account data, marketing, accessibility,
            payments, merch, DJ/music services, creative deliverables, PC tech support,
            membership-site work, and copyright handling. It is a business policy summary, not
            legal advice. Last updated {lastUpdated}.
          </p>
          <div className="legal-action-row">
            <Link href="/privacy" className="button">
              Privacy Policy
            </Link>
            <Link href="/terms" className="button button-secondary">
              Terms of Use
            </Link>
            <Link href="/dmca" className="button button-secondary">
              Copyright Claims
            </Link>
          </div>
        </section>

        <section className="legal-grid">
          {complianceItems.map((item) => (
            <article className="panel legal-card" key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </section>

        <section className="panel legal-section">
          <p className="label">Government compliance</p>
          <h2>Operational compliance checklist.</h2>
          <p>
            This section is where Black Lion Studios keeps the practical government-compliance
            position for the website, portal, Square appointment flow, billing, merch, marketing,
            DJ/music work, creative services, PC tech support, membership-site support, copyright,
            privacy, accessibility, and client-service flow. It should be reviewed when operations
            or law changes.
          </p>
          <div className="legal-compliance-list">
            {governmentComplianceSections.map((section) => (
              <article className="legal-compliance-row" key={section.title}>
                <h3>{section.title}</h3>
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="panel legal-section">
          <p className="label">Government references</p>
          <h2>Compliance sources to review and keep current.</h2>
          <div className="legal-link-list">
            {legalReferenceLinks.map((link) => (
              <a href={link.href} key={link.href} rel="noreferrer" target="_blank">
                {link.label}
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
