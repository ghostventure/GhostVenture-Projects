"use client";

export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <main className="page-shell">
          <section className="panel legal-hero">
            <p className="label">Black Lion Studios</p>
            <h1>The site is recovering.</h1>
            <p>Reload the page or continue to the home page.</p>
            <div className="legal-action-row">
              <a href="/" className="button">
                Home
              </a>
              <a href="/portal" className="button button-secondary">
                Portal
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
