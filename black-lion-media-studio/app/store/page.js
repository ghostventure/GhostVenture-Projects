import {
  ProcessSteps,
  ShortcutRail,
  SpotlightCard,
  SupportNotice,
  SurfaceGrid
} from "../../components/shared-ui";
import { merchCollections } from "../../lib/merch";

export const metadata = {
  title: "Store | Black Lion Studios",
  description: "Merch collections for Plugz UNTD and Plugz RNGD."
};

export default function StorePage() {
  const storeLinks = [
    { href: "/portal", label: "Portal", value: "Ask about merch", note: "Sign in when you need follow-up" },
    { href: "/", label: "Home", value: "Back to services", note: "Review booking options first" }
  ];
  return (
    <div className="page-shell">
      <main className="stack">
        <section className="panel">
          <p className="label">Store</p>
          <h1>Merch</h1>
          <p className="muted">Browse merch. Sign in when you are ready to ask about availability, payment, pickup, or shipping.</p>
          <ProcessSteps
            items={[
              "Browse the collection you like.",
              "Sign in when you want help with sizing, availability, payment, pickup, or shipping.",
              "Keep merch questions and service requests under the same account."
            ]}
            className="ui-process-compact"
          />
          <ShortcutRail items={storeLinks} className="ui-shortcut-tight" />
        </section>

        {merchCollections.map((collection) => (
          <section className="panel" key={collection.slug}>
            <h2>{collection.name}</h2>
            <p className="muted">{collection.description}</p>
            <SupportNotice title="Collection view" copy="Browse first. Use your account when you are ready to ask questions or move forward." />
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
