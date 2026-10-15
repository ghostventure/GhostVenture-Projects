import { footerBoilerplateGroups, footerQuickAccessLinks, getFooterItemHref } from "../footerBoilerplates.js";

export function LandingFooter() {
  return <footer className="landing-footer compact-footer" aria-label="FoxHub footer">
    <div className="footer-baseline"><strong>FoxHub</strong><span>Your people. Your circles. Your neighborhood.</span></div>
    <nav className="footer-essential-links" aria-label="Help and policies">
      {footerQuickAccessLinks.filter(link => ["Privacy Policy", "Contact Support", "Safety Center", "System Status"].includes(link.label)).map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
    </nav>
    <div className="footer-groups">
      {footerBoilerplateGroups.map(group => <details key={group.id} className="footer-group">
        <summary>{group.label}</summary>
        <nav aria-label={`${group.label} pages`}>
          {group.items.map(item => <a key={item} href={getFooterItemHref(group.id,item)}>{item}</a>)}
        </nav>
      </details>)}
    </div>
  </footer>;
}
