import { PortalAccessHeader, PortalModeSummary, PortalTrustPanel } from "../shared-ui";
import { modeItems, trustItems } from "./portal-data";

export function PortalHeroPanel() {
  return (
    <div className="panel portal-visual" style={{ backgroundImage: "url('/ai/visual-storytelling.png')" }}>
      <div className="stack-small">
        <PortalAccessHeader
          eyebrow="Sign-in"
          title="Create your account and turn interest into a real request."
          copy="Create an account, send your service request, check updates, and talk with Black Lion Studios."
          actions={[
            { href: "/portal", label: "Create access" },
            { href: "/#services", label: "Review services", variant: "secondary" }
          ]}
        />
        <PortalModeSummary items={modeItems} />
        <PortalTrustPanel title="How access is separated" items={trustItems} />
      </div>
    </div>
  );
}
