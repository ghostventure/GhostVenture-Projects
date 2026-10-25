export function SiteHeader() {
  return (
    <>
      <a className="skip-link" href="#site-content">
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Timmy home">
          <span className="brand-mark" aria-hidden="true">T</span>
          <span>Timmy</span>
        </a>
        <button
          className="icon-button"
          type="button"
          data-nav-toggle
          aria-expanded="false"
          aria-controls="site-nav"
          aria-label="Open navigation"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <nav className="nav" id="site-nav" data-nav aria-label="Main navigation">
          <a href="/user-guide.html">Product guide</a>
          <details className="nav-menu">
            <summary>Resources</summary>
            <div className="nav-menu-items">
              <a href="/faq.html">FAQ</a>
              <a href="/boilerplates.html">Setup examples</a>
              <a href="/support.html">Support</a>
              <a href="/legal.html">Legal</a>
            </div>
          </details>
          <a className="button nav-download" href="/download.html">Download</a>
        </nav>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <a className="footer-brand" href="/">Timmy by Black Lion Studios</a>
        <div className="footer-links" aria-label="Policies and contact">
          <a href="/contact.html">Contact</a>
          <a href="/legal.html#privacy">Privacy</a>
          <a href="/legal.html#terms">Terms of Use</a>
          <a href="/legal.html#dmca">DMCA</a>
        </div>
      </div>
    </footer>
  );
}
