import Link from "next/link";
import { LandingProofStrip, ProcessSteps, ShortcutRail } from "../../components/shared-ui";
import { businessLines } from "../../lib/business-lines";

export const metadata = {
  title: "About",
  description: "About Black Lion Studios and its Multimedia, Tech Development, and Fashion branches.",
  alternates: { canonical: "/about" }
};

export default function AboutPage() {
  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel hero-stage" style={{ backgroundImage: "url('/ai/visual-storytelling.png')" }}>
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow brand-signature">Black Lion Studios</p>
              <h1>Three Black Lion branches with one client handoff.</h1>
              <p>
                Black Lion Studios routes public work through Black Lion Multimedia, Black Lion
                Tech Development, and Black Lion Fashion so visitors can choose the right
                branch before sending details.
              </p>
              <div className="hero-actions">
                <Link href="/portal" className="button">Start a request</Link>
                <Link href="/services" className="button button-secondary">View services</Link>
              </div>
            </div>
          </div>
        </section>
        <section className="panel">
          <p className="label">Branches</p>
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
        <section className="panel">
          <p className="label">How it works</p>
          <ProcessSteps
            items={[
              "Choose Multimedia, Tech Development, or Fashion.",
              "Create an account so contact details and messages stay together.",
              "Send the request and keep scheduling, billing, and follow-up in one portal."
            ]}
            className="ui-process-compact"
          />
        </section>
        <section className="panel">
          <p className="label">What clients get</p>
          <LandingProofStrip
            items={[
              { title: "Black Lion Multimedia", copy: "Photo, video, music, DJ, event, and campaign support." },
              { title: "Black Lion Tech Development", copy: "Software, web, membership-site, maintenance, and PC support." },
              { title: "Black Lion Fashion", copy: "Merch, fashion content, model sign-up, and campaign visuals." },
              { title: "Saved context", copy: "Requests, profile details, billing context, and messages stay connected." }
            ]}
          />
        </section>
      </main>
    </div>
  );
}
