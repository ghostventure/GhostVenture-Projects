import { PortalConversionStrip, PortalSigninComponentSuite } from "../shared-ui";
import { PortalAccessPanel } from "./portal-access-panel";
import { signinComponentGroups } from "./portal-data";
import { PortalHeroPanel } from "./portal-hero-panel";
import { PortalQuickPathPanel } from "./portal-quick-path-panel";
import { PortalServicesPanel } from "./portal-services-panel";

export function PortalContent({ requiresAuth = false, idleReason = false }) {
  return (
    <div className="page-shell">
      <main className="stack">
        <section className="portal-split">
          <PortalHeroPanel />
          <PortalAccessPanel requiresAuth={requiresAuth} idleReason={idleReason} />
        </section>

        <PortalServicesPanel />

        <PortalSigninComponentSuite
          eyebrow="What to prepare"
          title="The short version."
          copy="Create the account, send the request, and keep follow-up in one place."
          groups={signinComponentGroups}
        />

        <PortalQuickPathPanel />

        <PortalConversionStrip
          title="Ready to send the request?"
          copy="Create the account, choose the service, and add the first details."
          href="/portal"
          actionLabel="Create account"
        />
      </main>
    </div>
  );
}
