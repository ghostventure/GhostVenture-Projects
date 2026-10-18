import {
  ProcessSteps,
  ShortcutRail,
  SpotlightCard,
  SupportNotice,
  SurfaceGrid
} from "../../components/shared-ui";
import { merchCollections, plugzSiteLinks } from "../../lib/merch";

const plugzLinks = [
  {
    href: plugzSiteLinks.home,
    label: "Open Plugz",
    value: "Full storefront",
    note: "Visit the live Plugz UNTD site"
  },
  {
    href: plugzSiteLinks.shop,
    label: "Shop Plugz",
    value: "Current drop",
    note: "Go straight to the Plugz shop section"
  },
  {
    href: plugzSiteLinks.account,
    label: "Plugz account",
    value: "Store account",
    note: "Open Plugz account tools when needed"
  }
];

export const metadata = {
  title: "Store | Black Lion Fashion",
  description: "Black Lion Fashion merch collections for Plugz UNTD and Plugz RNGD.",
  alternates: { canonical: "/store" }
};

export default function StorePage() {
  const storeLinks = [
    { href: "/fashion", label: "Fashion", value: "Black Lion Fashion", note: "Merch, modeling, and fashion content" },
    { href: "/portal", label: "Portal", value: "Ask about merch", note: "Sign in when you need follow-up" },
    { href: "/", label: "Home", value: "Back to services", note: "Review booking options first" }
  ];
  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel">
          <p className="label">Black Lion Fashion</p>
          <h1>Merch</h1>
          <p className="muted">Browse the Black Lion Fashion merch preview, then open Plugz for the live storefront, drop details, and account tools.</p>
          <ProcessSteps
            items={[
              "Browse the collection you like.",
              "Open the live Plugz site when you are ready to view the full drop.",
              "Use Black Lion Fashion for merch questions, product visuals, modeling context, and project follow-up."
            ]}
            className="ui-process-compact"
          />
          <ShortcutRail items={storeLinks} className="ui-shortcut-tight" />
          <div className="ui-shortcut-rail ui-shortcut-tight" aria-label="Plugz site links">
            {plugzLinks.map((link) => (
              <a
                className="ui-shortcut-card"
                href={link.href}
                key={link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>{link.label}</span>
                <strong>{link.value}</strong>
                <p>{link.note}</p>
              </a>
            ))}
          </div>
        </section>

        {merchCollections.map((collection) => (
          <section className="panel" key={collection.slug}>
            <h2>{collection.name}</h2>
            <p className="muted">{collection.description}</p>
            <SupportNotice title="Collection view" copy="Browse here, then use Plugz for the live storefront and Black Lion Fashion for merch, model, product, or campaign questions." />
            <div className="actions">
              <a className="button" href={collection.shopUrl} target="_blank" rel="noopener noreferrer">
                Shop on Plugz
              </a>
              <a className="button button-secondary" href={collection.siteUrl} target="_blank" rel="noopener noreferrer">
                Open Plugz site
              </a>
            </div>
            <SurfaceGrid className="simple-grid">
              {collection.items.map((item) => (
                <SpotlightCard
                  className="list-card"
                  key={item.name}
                  eyebrow={item.type}
                  title={item.name}
                  copy={item.details}
                >
                  <p>{item.priceLabel}</p>
                </SpotlightCard>
              ))}
            </SurfaceGrid>
          </section>
        ))}
      </main>
    </div>
  );
}
