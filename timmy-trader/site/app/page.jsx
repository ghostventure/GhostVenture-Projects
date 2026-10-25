import SitePage, { getSiteMetadata } from "./SitePage";

export const metadata = getSiteMetadata("index.html");

export default function HomePage() {
  return <SitePage filename="index.html" />;
}
