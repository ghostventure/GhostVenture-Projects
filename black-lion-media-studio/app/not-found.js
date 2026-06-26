import Link from "next/link";

export const metadata = {
  title: "Page not found",
  robots: {
    index: false,
    follow: true
  }
};

export default function NotFound() {
  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel legal-hero">
          <p className="label">Black Lion Studios</p>
          <h1>That page moved.</h1>
          <p>
            Continue with the current service, contact, store, or portal paths instead of stopping
            at a dead end.
          </p>
          <div className="legal-action-row">
            <Link href="/services" className="button">Services</Link>
            <Link href="/portal" className="button button-secondary">Portal</Link>
            <Link href="/contact" className="button button-secondary">Contact</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
