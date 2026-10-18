import Link from "next/link";
import { BusinessLinePage } from "../../components/business-line-page";
import { findBusinessLine } from "../../lib/business-lines";

const line = findBusinessLine("fashion");

export const metadata = {
  title: "Black Lion Fashion",
  description:
    "Black Lion Fashion connects Plugz merch, streetwear, fashion campaigns, product imagery, and the Black Lion Studios model sign-up sub-site.",
  alternates: { canonical: "/fashion" }
};

export default function FashionPage() {
  return (
    <BusinessLinePage line={line}>
      <section className="panel">
        <p className="label">Model sub-site</p>
        <h2 className="editorial-heading">Modeling stays in its own application lane.</h2>
        <p className="muted">
          The model path is grouped under Fashion, but it keeps its separate applicant profile,
          1099 project terms, FAQ, and review workflow.
        </p>
        <div className="hero-actions">
          <Link href="/models" className="button">
            Open Model Sign-up
          </Link>
          <Link href="/models/faq" className="button button-secondary">
            Model FAQ
          </Link>
        </div>
      </section>
    </BusinessLinePage>
  );
}
