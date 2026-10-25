import Link from "next/link";
import { SiteSearch } from "./site-search";

const studioLinks = [
  { href: "/services", label: "All services", note: "Browse and estimate project work" },
  { href: "/multimedia", label: "Multimedia", note: "Photo, video, DJ, and audio" },
  { href: "/tech-development", label: "Tech development", note: "AI, software, websites, and PC support" },
  { href: "/fashion", label: "Fashion", note: "Merch, modeling, and campaign content" }
];

const startLinks = [
  { href: "/plan", label: "Plan a project", note: "Prepare a brief and choose the right services" },
  { href: "/book", label: "Book an appointment", note: "See appointment options and request windows" },
  { href: "/portal", label: "Client portal", note: "Sign in, create an account, or send a request" }
];

function NavigationGroup({ label, links, className = "" }) {
  return (
    <details className={`site-nav-explore ${className}`.trim()}>
      <summary>{label}</summary>
      <div className="site-nav-explore-panel">
        {links.map((link) => (
          <Link href={link.href} key={link.href}>
            <strong>{link.label}</strong>
            <span>{link.note}</span>
          </Link>
        ))}
      </div>
    </details>
  );
}

function NavigationLinks({ className = "" }) {
  return (
    <nav aria-label="Main navigation" className={className}>
      <NavigationGroup label="Explore" links={studioLinks} />
      <NavigationGroup label="Get started" links={startLinks} className="site-nav-start" />
      <Link href="/support">Support</Link>
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
        <SiteSearch />
        <details className="site-mobile-menu">
          <summary>Menu</summary>
          <NavigationLinks className="site-nav site-nav-mobile" />
        </details>
      </div>
    </header>
  );
}
