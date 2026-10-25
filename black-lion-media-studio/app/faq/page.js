import Link from "next/link";
import { FaqSearchList } from "../../components/faq-search-list";
import { faqItems, lastUpdated } from "../../lib/legal-content";

export const metadata = {
  title: "FAQ",
  description:
    "Answers for Black Lion Studios booking, account setup, privacy, service requests, Square appointments, store access, and copyright-claim questions."
};

export default function FAQPage() {
  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel legal-hero">
          <p className="label">FAQ</p>
          <h1>Questions before you create the account.</h1>
          <p>
            Short answers for booking, account setup, privacy, service requests, store access, and
            copyright-claim questions, including Square appointment and public calendar behavior.
            Last updated {lastUpdated}.
          </p>
          <Link href="/portal" className="button">
            Start in the portal
          </Link>
        </section>

        <section className="panel">
          <FaqSearchList items={faqItems} />
        </section>
      </main>
    </div>
  );
}
