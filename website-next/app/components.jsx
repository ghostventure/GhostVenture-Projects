import Link from 'next/link'
import { businessGuideHref, checksumHref, cylinderPageHref, downloadHref, investorBrochureHref, navItems } from './data'

export function SiteShell({ children, tone = 'dark' }) {
  return (
    <>
      <header className={`site-header ${tone}`}>
        <Link className="brand" href="/">
          <span>OH</span>
          <strong>OverHead</strong>
        </Link>
        <nav aria-label="Main navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
        </nav>
        <Link className="nav-action" href="/sign-in/">Sign in</Link>
      </header>
      {children}
      <Footer />
    </>
  )
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <Link className="footer-brand" href="/">OverHead</Link>
        <p>Turn daily office pressure into a clearer, more controlled routine.</p>
        <p className="webmaster">Webmaster: Black Lion Studios</p>
      </div>
      <div className="footer-links">
        <Link href="/about/">About</Link>
        <Link href="/investors/">Investors</Link>
        <Link href={investorBrochureHref}>Investor Brochure</Link>
        <Link href={businessGuideHref}>Business Guide</Link>
        <Link href="/careers/">Careers</Link>
        <Link href={cylinderPageHref}>Cylinder</Link>
        <Link href="/support/">Support</Link>
        <Link href="/legal/">Legal</Link>
        <Link href={checksumHref}>Checksums</Link>
      </div>
    </footer>
  )
}

export function PageHero({ eyebrow, title, children }) {
  return (
    <section className="page-hero">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <div className="hero-copy">{children}</div>
      </div>
    </section>
  )
}

export function CTA() {
  return (
    <section className="cta-band">
      <div>
        <p className="eyebrow">Download</p>
        <h2>Ready to get organized?</h2>
        <p>Download OverHead, install it on Windows, and start with one customer or one task.</p>
      </div>
      <div className="cta-actions">
        <Link className="primary" href={downloadHref}>Get OverHead for Windows</Link>
        <Link className="secondary" href={cylinderPageHref}>Explore Cylinder for Server / IoT</Link>
        <Link className="secondary" href="/support/">Installation help</Link>
        <Link className="secondary" href={checksumHref}>Verify download</Link>
      </div>
    </section>
  )
}

export function CardGrid({ items, className = '' }) {
  return (
    <div className={`card-grid ${className}`}>
      {items.map((item) => (
        <article key={item.title || item.name}>
          {item.kicker && <span>{item.kicker}</span>}
          <strong>{item.title || item.name}</strong>
          <p>{item.body || item.text}</p>
        </article>
      ))}
    </div>
  )
}

export function ProductProof({ eyebrow = 'Desktop proof', title, body, image, alt, caption }) {
  return (
    <section className="product-proof-band">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="section-copy">{body}</p>
      </div>
      <figure>
        <img src={image} alt={alt} />
        <figcaption>{caption}</figcaption>
      </figure>
    </section>
  )
}
