const baseUrl = "https://black-lion-media-studio.web.app";

export default function sitemap() {
  return [
    "",
    "/ad-expansion",
    "/book",
    "/about",
    "/services",
    "/contact",
    "/work",
    "/portfolio",
    "/multimedia",
    "/tech-development",
    "/fashion",
    "/photography",
    "/videography",
    "/models",
    "/models/faq",
    "/dj-services",
    "/beat-sessions",
    "/ai-services",
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
