import Link from "next/link";
import { ShortcutRail, SupportNotice } from "../../components/shared-ui";
import { lastUpdated, supportScopeSections } from "../../lib/legal-content";

export const metadata = {
  title: "Support",
  description:
    "Get Black Lion Studios help for account access, appointments, bookings, billing context, merch, privacy, accessibility, copyright, and active project issues.",
  alternates: { canonical: "/support" }
};

const supportPaths = [
  {
    label: "Ad link",
    value: "Landed in the wrong place",
    note: "Use this when an ad, post, or shared link does not match what you expected.",
    href: "/contact"
  },
  {
    label: "Account",
    value: "Sign-in or profile help",
    note: "Use the portal when you need access, profile, request, or message support.",
    href: "/portal?auth=required"
  },
  {
    label: "Booking",
    value: "Appointment or schedule question",
    note: "Use Square for appointment slots and the portal for project context.",
    href: "/book"
  },
  {
    label: "Merch",
    value: "Store or order question",
    note: "Open store details before sending purchase or delivery questions.",
    href: "/store"
  }
];

const issueTypes = [
  "Ad or campaign link did not match the page.",
  "Account sign-in, profile, or message access issue.",
  "Square appointment, booking, scheduling, deposit, or project-scope question.",
  "Merch, delivery, billing context, or invoice follow-up.",
  "Privacy, legal, copyright, or accessibility concern."
];

export default function SupportPage() {
  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel legal-hero">
          <p className="label">Support</p>
          <h1>Route the issue without slowing the request down.</h1>
          <p>
            Use this page when an ad, account, Square appointment, booking, merch, billing,
            privacy, accessibility, copyright, or active project question needs a cleaner next
            step. Account-specific work should stay in the portal so follow-up has the right
            context. Last updated {lastUpdated}.
          </p>
          <div className="legal-action-row">
            <Link href="/portal?auth=required" className="button">
              Open portal
            </Link>
            <Link href="mailto:contact@blacklionstudios.com" className="button button-secondary">
              Email support
            </Link>
          </div>
        </section>

        <section className="panel">
          <p className="label">Fast routing</p>
          <ShortcutRail items={supportPaths} className="ui-shortcut-tight" />
        </section>

        <section className="panel legal-section">
          <p className="label">Scope of support</p>
          <h2>What support can and cannot handle.</h2>
          <div className="legal-compliance-list">
            {supportScopeSections.map((section) => (
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

        <section className="two-column">
          <div className="panel">
            <p className="label">What to include</p>
            <div className="legal-faq-list">
              <details open>
                <summary>For ad or link issues</summary>
                <p>Share the link, where you clicked it, and what service you expected to see.</p>
              </details>
              <details>
                <summary>For account or booking issues</summary>
                <p>Share the account email, requested service, appointment date, target date, and the page that failed.</p>
              </details>
              <details>
                <summary>For billing, merch, or delivery issues</summary>
                <p>Share the order, invoice, or request context without sending payment details.</p>
              </details>
              <details>
                <summary>For privacy, legal, copyright, or accessibility issues</summary>
                <p>Share the page, account email if relevant, the specific concern, and the response you need.</p>
              </details>
            </div>
          </div>

          <div className="panel">
            <p className="label">Common issues</p>
            <div className="ui-disclosure-list">
              {issueTypes.map((issue) => (
                <div className="ui-disclosure-row" key={issue}>
                  <strong>{issue}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <SupportNotice
          title="Keep private details out of plain text."
          copy="Do not send card numbers, passwords, government IDs, health data, or unrelated sensitive data. Use the portal for account-specific service follow-up."
        />
      </main>
    </div>
  );
}
