import ServiceAdLandingPage from "../../components/service-ad-landing";
import { findServiceAdPage } from "../../lib/services";

const page = findServiceAdPage("/membership-sites");

export const metadata = {
  title: "Membership Sites",
  description: "Book Black Lion Studios membership site setup, updates, private content support, billing setup help, and ongoing support.",
  alternates: { canonical: "/membership-sites" }
};

export default function MembershipSitesPage() {
  return <ServiceAdLandingPage page={page} />;
}
