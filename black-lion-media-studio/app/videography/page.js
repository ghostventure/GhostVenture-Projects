import ServiceAdLandingPage from "../../components/service-ad-landing";
import { findServiceAdPage } from "../../lib/services";

const page = findServiceAdPage("/videography");

export const metadata = {
  title: "Videography",
  description: "Book Black Lion Studios videography for promotional videos, live captures, reels, interviews, and campaign footage.",
  alternates: { canonical: "/videography" }
};

export default function VideographyPage() {
  return <ServiceAdLandingPage page={page} />;
}
