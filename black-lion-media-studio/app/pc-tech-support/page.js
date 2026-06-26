import ServiceAdLandingPage from "../../components/service-ad-landing";
import { findServiceAdPage } from "../../lib/services";

const page = findServiceAdPage("/pc-tech-support");

export const metadata = {
  title: "PC Tech Support",
  description: "Book Black Lion Studios PC tech support for setup, troubleshooting, tune-ups, upgrades, and practical help.",
  alternates: { canonical: "/pc-tech-support" }
};

export default function PCTechSupportPage() {
  return <ServiceAdLandingPage page={page} />;
}
