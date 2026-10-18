import Link from "next/link";
import { ShortcutRail, SupportNotice } from "../../components/shared-ui";
import { businessLines } from "../../lib/business-lines";

export const metadata = {
  title: "Contact",
  description: "Contact Black Lion Studios for Multimedia, Tech Development, Fashion, scheduling, and service questions.",
  alternates: { canonical: "/contact" }
};

export default function ContactPage() {
  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel legal-hero">
          <p className="label">Contact</p>
          <h1>Send the right details the first time.</h1>
          <p>
            Use the portal for Multimedia, Tech Development, Fashion, scheduling, billing context,
            and follow-up messages.
          </p>
          <div className="legal-action-row">
            <Link href="/portal" className="button">Open portal</Link>
            <Link href="mailto:contact@blacklionstudios.com" className="button button-secondary">Email studio</Link>
          </div>
        </section>
        <section className="panel">
          <ShortcutRail
            items={[
              { href: "/services", label: "Services", value: "Review options", note: "See pricing and timing first" },
              ...businessLines.map((line) => ({
                href: line.href,
                label: line.eyebrow,
                value: line.name,
                note: line.summary
              })),
              { href: "/portal", label: "Portal", value: "Send request", note: "Best path for follow-up" },
              { href: "/faq", label: "FAQ", value: "Common answers", note: "Booking, accounts, billing, and merch" }
            ]}
            className="ui-shortcut-tight"
          />
        </section>
        <SupportNotice
          title="Best ad traffic path"
          copy="For paid traffic, send people to the service or portal path so their request has context before the studio follows up."
        />
      </main>
    </div>
  );
}
