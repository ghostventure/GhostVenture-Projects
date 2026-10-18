import Link from "next/link";
import { modelFaqItems } from "../../../lib/model-faq";

export const metadata = {
  title: "Model FAQ | Black Lion Fashion",
  description: "Answers for Black Lion Fashion model applicants about 18+ eligibility, 1099 project work, reapplication timing, model profiles, portfolio links, and project terms.",
  alternates: { canonical: "/models/faq" }
};

export default function ModelFAQPage() {
  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel legal-hero models-hero">
          <p className="label">Black Lion Fashion model sub-site</p>
          <h1>Questions before applying to model.</h1>
          <p>
            Answers for adult model applicants about profile separation, 1099 project work,
            portfolio links, reapplication timing, no-show priority, privacy, and project terms.
          </p>
          <div className="legal-action-row">
            <Link href="/models" className="button">Back to Model Sign-up</Link>
            <Link href="/fashion" className="button button-secondary">Fashion</Link>
            <Link href="/privacy" className="button button-secondary">Privacy Policy</Link>
          </div>
        </section>

        <section className="panel">
          <div className="model-faq-grid">
            {modelFaqItems.map((item) => (
              <details className="model-faq-item" key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
