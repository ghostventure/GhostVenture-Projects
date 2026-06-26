import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const footerGroups = [
  {
    title: "Services",
    links: [
      { href: "/photography", label: "Photography" },
      { href: "/videography", label: "Videography" },
      { href: "/dj-services", label: "DJ services" },
      { href: "/beat-sessions", label: "Beat sessions" },
      { href: "/models", label: "Model Sign-up" },
      { href: "/pc-tech-support", label: "PC tech support" },
      { href: "/membership-sites", label: "Membership sites" }
    ]
  },
  {
    title: "Client",
    links: [
      { href: "/book", label: "Book service" },
      { href: "/quote", label: "Quick quote" },
      { href: "/portal", label: "Create account" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/messages", label: "Messages" },
      { href: "/profile", label: "Profile" }
    ]
  },
  {
    title: "Studio",
    links: [
      { href: "/store", label: "Merch store" },
      { href: "/booking-manager", label: "Manager access" },
      { href: "/support", label: "Support" },
      { href: "/ad-expansion", label: "Ad expansion" },
      { href: "/portal?auth=required", label: "Sign in" },
      { href: "/faq", label: "FAQ" }
    ]
  },
  {
    title: "Legal",
    links: [
      { href: "/legal", label: "Legal & compliance" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Use" },
      { href: "/dmca", label: "Copyright Claims" }
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
            Photography, video, audio, DJ services, tech help, merch, and project follow-up in one
            place.
          </p>
          <div className="footer-actions">
            <ThemeToggle />
            <Link href="/book" className="button">
              Start request
            </Link>
          </div>
        </div>

        <div className="footer-link-grid">
          {footerGroups.map((group) => (
            <div className="footer-link-column" key={group.title}>
              <strong>{group.title}</strong>
              {group.links.map((link) => (
                <Link href={link.href} key={`${group.title}-${link.label}`}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="footer-boilerplate-grid">
          <div>
            <strong>Contact</strong>
            <p>Use your account for service requests and project messages.</p>
            <a href="mailto:contact@blacklionstudios.com">contact@blacklionstudios.com</a>
          </div>
          <div>
            <strong>Legal</strong>
            <p>
              Public browsing does not create a booking. Quotes, deposits, usage rights,
              cancellation terms, and delivery windows are confirmed per accepted request.
            </p>
            <Link href="/terms">Terms of Use</Link>
          </div>
          <div>
            <strong>Privacy</strong>
            <p>
              Account details are used for requests, communication, scheduling, billing, delivery,
              security, and support. Do not submit sensitive payment data in text fields.
            </p>
            <Link href="/privacy">Privacy Policy</Link>
          </div>
          <div>
            <strong>Compliance</strong>
            <p>
              Government-compliance notes for consumer protection, privacy, security, email/text
              marketing, accessibility, payments, records, and copyright live in Legal.
            </p>
            <Link href="/legal">Legal & compliance</Link>
          </div>
          <div>
            <strong>Copyright</strong>
            <p>
              Claims are reviewed as allegations, not automatic proof. False, unsupported, or
              bad-faith claims may be rejected and answered with original-creation records.
            </p>
            <Link href="/dmca">Copyright claims</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <span>Copyright {year} Black Lion Studios. All rights reserved.</span>
          <span>Service availability, pricing, and delivery windows may vary by project scope.</span>
        </div>
      </div>
    </footer>
  );
}
