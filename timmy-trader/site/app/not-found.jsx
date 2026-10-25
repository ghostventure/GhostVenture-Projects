import SitePage, { getSiteMetadata } from "./SitePage";

export const metadata = getSiteMetadata("404.html");

export default function NotFound() {
  return <SitePage filename="404.html" />;
}
