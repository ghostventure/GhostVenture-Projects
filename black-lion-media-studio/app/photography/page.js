import ServiceAdLandingPage from "../../components/service-ad-landing";
import { findServiceAdPage } from "../../lib/services";

const page = findServiceAdPage("/photography");

export const metadata = {
  title: "Photography",
  description: "Book Black Lion Studios photography for portraits, products, events, and branded visual content.",
  alternates: { canonical: "/photography" }
};

export default function PhotographyPage() {
  return <ServiceAdLandingPage page={page} />;
}
