import { BusinessLinePage } from "../../components/business-line-page";
import { findBusinessLine } from "../../lib/business-lines";

const line = findBusinessLine("multimedia");

export const metadata = {
  title: "Black Lion Multimedia",
  description:
    "Black Lion Multimedia handles photography, videography, DJ services, beat sessions, event coverage, campaign content, and creative production requests.",
  alternates: { canonical: "/multimedia" }
};

export default function MultimediaPage() {
  return <BusinessLinePage line={line} />;
}
