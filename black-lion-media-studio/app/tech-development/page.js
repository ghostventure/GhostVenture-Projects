import { BusinessLinePage } from "../../components/business-line-page";
import { findBusinessLine } from "../../lib/business-lines";

const line = findBusinessLine("tech-development");

export const metadata = {
  title: "Black Lion Tech Development",
  description:
    "Black Lion Tech Development helps you get started with AI, build software and automations, and maintain websites and computers.",
  alternates: { canonical: "/tech-development" }
};

export default function TechDevelopmentPage() {
  return <BusinessLinePage line={line} />;
}
