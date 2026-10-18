import ServiceAdLandingPage from "../../components/service-ad-landing";
import { findServiceAdPage } from "../../lib/services";

export const metadata = {
  title: "AI Services & Software Development | Black Lion Tech Development",
  description: "Know about AI but unsure where to start? Get help planning and building apps, websites, and automations, or finishing an AI-assisted project. No coding experience required.",
  alternates: { canonical: "/ai-services" }
};

export default function AIServicesPage() {
  return <ServiceAdLandingPage page={findServiceAdPage("/ai-services")} />;
}
