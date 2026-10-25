import ServiceAdLandingPage from "../../components/service-ad-landing";
import { findServiceAdPage } from "../../lib/services";

const page = findServiceAdPage("/photography");

export const metadata = {
  title: "Photography | Black Lion Multimedia",
  description: "Consider Black Lion Multimedia photography for portraits, products, events, and branded visual marketing.",
  alternates: { canonical: "/photography" }
};

export default function PhotographyPage() {
  return <ServiceAdLandingPage page={page} />;
}
