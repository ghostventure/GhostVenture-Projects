import Link from "next/link";

const primaryLinks = [
  { href: "/services", label: "Services" },
  { href: "/multimedia", label: "Multimedia" },
  { href: "/tech-development", label: "Tech" },
  { href: "/fashion", label: "Fashion" },
  { href: "/book", label: "Book" },
  { href: "/support", label: "Support" }
];

function NavigationLinks({ className = "" }) {
  return (
    <nav aria-label="Main navigation" className={className}>
      {primaryLinks.map((link) => (
        <Link href={link.href} key={link.href}>
          {link.label}
        </Link>
      ))}
      <Link href="/portal" className="site-nav-portal">Client portal</Link>
    </nav>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header-shell">
      <div className="site-header">
        <Link href="/" className="site-header-brand" aria-label="Black Lion Studios home">
          <span className="brand-signature">Black Lion Studios</span>
          <span className="site-header-tagline">Creative · Technology · Fashion</span>
        </Link>
        <NavigationLinks className="site-nav site-nav-desktop" />
        <details className="site-mobile-menu">
          <summary>Menu</summary>
          <NavigationLinks className="site-nav site-nav-mobile" />
        </details>
      </div>
    </header>
  );
}
