import { PortalQuickLinks } from "../shared-ui";
import { quickLinks } from "./portal-data";

export function PortalQuickPathPanel() {
  return (
    <section className="panel">
      <p className="label">Quick paths</p>
      <PortalQuickLinks items={quickLinks} />
    </section>
  );
}
