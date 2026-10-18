import ServiceAdLandingPage from "../../components/service-ad-landing";
import { findServiceAdPage } from "../../lib/services";

const page = findServiceAdPage("/dj-services");

export const metadata = {
  title: "DJ Services | Black Lion Multimedia",
  description: "Book Black Lion Multimedia DJ services for private events, launches, parties, and activations.",
  alternates: { canonical: "/dj-services" }
};

export default function DJServicesPage() {
  return <ServiceAdLandingPage page={page} />;
}
