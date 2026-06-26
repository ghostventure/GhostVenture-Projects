import { PortalServicePreview } from "../shared-ui";
import { servicePreview } from "./portal-data";

export function PortalServicesPanel() {
  return (
    <section className="panel">
      <p className="label">Services</p>
      <PortalServicePreview items={servicePreview} />
    </section>
  );
}
