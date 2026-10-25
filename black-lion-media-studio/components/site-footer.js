import Link from "next/link";
import { plugzSiteLinks } from "../lib/merch";
import { ThemeToggle } from "./theme-toggle";
import { AppearanceControls } from "./appearance-controls";

const footerGroups = [
  {
    title: "Studio",
    links: [
      { href: "/services", label: "All services" },
      { href: "/multimedia", label: "Multimedia" },
      { href: "/tech-development", label: "Tech development" },
      { href: "/fashion", label: "Fashion" }
    ]
  },
  {
    title: "Get started",
    links: [
      { href: "/plan", label: "Project planner" },
      { href: "/book", label: "Appointments" },
      { href: "/portal", label: "Client portal" }
    ]
  },
  {
    title: "Help",
    links: [
      { href: "/support", label: "Support" },
      { href: "/faq", label: "FAQ" },
      { href: "/legal", label: "Legal & policies" }
    ]
  },
  {
    title: "Shop",
    links: [
      { href: "/store", label: "Merch store" },
      { href: plugzSiteLinks.home, label: "Plugz storefront", external: true }
    ]
  }
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="page-shell footer-inner">
        <div className="footer-brand-block">
          <p className="brand-signature brand-mark">Black Lion Studios</p>
          <p>
            Multimedia, tech development, fashion, modeling, merch, and project follow-up in one place.
          </p>
          <div className="footer-actions">
            <ThemeToggle />
            <AppearanceControls />
          </div>
        </div>

        <div className="footer-link-grid">
          {footerGroups.map((group) => (
            <div className="footer-link-column" key={group.title}>
              <strong>{group.title}</strong>
              {group.links.map((link) =>
                link.external ? (
                  <a
                    href={link.href}
                    key={`${group.title}-${link.label}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link href={link.href} key={`${group.title}-${link.label}`}>
                    {link.label}
                  </Link>
                )
              )}
            </div>
          ))}
        </div>

        <div className="footer-bottom">
          <span>Copyright {year} Black Lion Studios. All rights reserved.</span>
          <span>Webmaster: Black Lion Studios.</span>
        </div>
      </div>
    </footer>
  );
}
