import { notFound } from "next/navigation";
import SitePage, { getSiteMetadata } from "../SitePage";

const pages = [
  "boilerplates",
  "brochure",
  "contact",
  "download",
  "faq",
  "legal",
  "support",
  "user-guide",
];

export const dynamicParams = false;

export function generateStaticParams() {
  return pages.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  if (!pages.includes(slug)) {
    return {};
  }
  return getSiteMetadata(`${slug}.html`);
}

export default async function ContentPage({ params }) {
  const { slug } = await params;
  if (!pages.includes(slug)) {
    notFound();
  }
  return <SitePage filename={`${slug}.html`} />;
}
