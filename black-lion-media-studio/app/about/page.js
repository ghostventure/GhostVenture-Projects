import Link from "next/link";
import { LandingProofStrip, ProcessSteps } from "../../components/shared-ui";

export const metadata = {
  title: "About",
  description: "About Black Lion Studios and the creative, technical, and merch support available through the client portal.",
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
              <h1>Creative production and practical tech support in one place.</h1>
              <p>
                Black Lion Studios supports creators, small businesses, and returning clients with
                photography, video, music, DJ services, membership sites, PC support, and merch
                coordination.
              </p>
              <div className="hero-actions">
                <Link href="/portal" className="button">Start a request</Link>
                <Link href="/services" className="button button-secondary">View services</Link>
              </div>
            </div>
          </div>
        </section>
        <section className="panel">
          <p className="label">How it works</p>
          <ProcessSteps
            items={[
              "Choose the service lane that fits the project.",
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
              { title: "Creative range", copy: "Photo, video, music, DJ, and campaign support for practical projects." },
              { title: "Tech lane", copy: "Membership-site support and PC service requests with clear next steps." },
              { title: "Saved context", copy: "Requests, profile details, billing context, and messages stay connected." }
            ]}
          />
        </section>
      </main>
    </div>
  );
}
