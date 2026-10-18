import ServiceAdLandingPage from "../../components/service-ad-landing";
import { findServiceAdPage } from "../../lib/services";

const page = findServiceAdPage("/pc-tech-support");

export const metadata = {
  title: "PC Tech Support | Black Lion Tech Development",
  description: "Book Black Lion Tech Development PC support for setup, troubleshooting, tune-ups, upgrades, and practical help.",
  alternates: { canonical: "/pc-tech-support" }
};

export default function PCTechSupportPage() {
  return <ServiceAdLandingPage page={page} />;
}
