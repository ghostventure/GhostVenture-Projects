const baseUrl = "https://black-lion-media-studio.web.app";

export default function sitemap() {
  return [
    "",
    "/ad-expansion",
    "/book",
    "/quote",
    "/about",
    "/services",
    "/contact",
    "/work",
    "/portfolio",
    "/photography",
    "/videography",
    "/models",
    "/dj-services",
    "/beat-sessions",
    "/pc-tech-support",
    "/membership-sites",
    "/portal",
    "/support",
    "/store",
    "/faq",
    "/privacy",
    "/terms",
    "/legal",
    "/dmca"
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path ? "monthly" : "weekly",
    priority: path === "" ? 1 : 0.7
  }));
}
