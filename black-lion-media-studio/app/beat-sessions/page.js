import ServiceAdLandingPage from "../../components/service-ad-landing";
import { findServiceAdPage } from "../../lib/services";

const page = findServiceAdPage("/beat-sessions");

export const metadata = {
  title: "Beat Sessions",
  description: "Book Black Lion Studios beat creation sessions for artists, creators, and brands.",
  alternates: { canonical: "/beat-sessions" }
};

export default function BeatSessionsPage() {
  return <ServiceAdLandingPage page={page} />;
}
