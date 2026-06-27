const baseUrl = process.env.BLACK_LION_LIVE_URL || "https://black-lion-media-studio.web.app";
const coreRoutes = [
  "/",
  "/about",
  "/services",
  "/contact",
  "/work",
  "/portfolio",
  "/portal",
  "/store",
  "/faq",
  "/privacy",
  "/terms",
  "/legal",
  "/dmca"
];

const adConversionRoutes = ["/book", "/support", "/ad-expansion"];

const serviceRoutes = [
  "/photography",
  "/videography",
  "/dj-services",
  "/beat-sessions",
  "/pc-tech-support",
  "/membership-sites"
];

const routes = [...coreRoutes, ...adConversionRoutes, ...serviceRoutes];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const route of routes) {
  const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
  const text = await response.text();
  assert(response.status === 200, `${route} returned ${response.status}`);
  assert(!/404: This page could not be found/i.test(text), `${route} rendered a framework 404`);
  console.log(`${route} ${response.status} length:${text.length}`);
}

const quoteResponse = await fetch(`${baseUrl}/quote`, { redirect: "manual" });
assert([307, 308].includes(quoteResponse.status), `/quote returned ${quoteResponse.status}`);
assert(
  quoteResponse.headers.get("location")?.includes("/#service-estimation"),
  "/quote did not redirect to the landing-page Service Estimation section"
);
console.log(`/quote ${quoteResponse.status} redirects to ${quoteResponse.headers.get("location")}`);

const home = await (await fetch(baseUrl)).text();
for (const marker of [
  "Black Lion Studios",
  "Creative Production, Tech Support, and Merch",
  'property="og:title"',
  'property="og:description"',
  'property="og:image"',
  'name="twitter:card"',
  'rel="canonical"',
  "Book appointment",
  "Create account",
  "Service Estimation",
  "Build a Service Estimation before you send the request.",
  "Travel charge over 30 miles",
  "50% deposit",
  "Appointment calendar"
]) {
  assert(home.includes(marker), `home missing marker: ${marker}`);
  console.log(`marker ok: ${marker}`);
}

const expansion = await (await fetch(`${baseUrl}/ad-expansion`)).text();
for (const marker of ["200 additional", "Campaign Conversion", "Reliability Resilience", "Compliance Trust"]) {
  assert(expansion.includes(marker), `/ad-expansion missing marker: ${marker}`);
  console.log(`expansion marker ok: ${marker}`);
}

for (const route of ["/robots.txt", "/sitemap.xml"]) {
  const response = await fetch(`${baseUrl}${route}`);
  const text = await response.text();
  assert(response.status === 200, `${route} returned ${response.status}`);
  assert(text.includes("black-lion-media-studio.web.app"), `${route} missing public URL`);
  console.log(`${route} ${response.status}`);
}

console.log("black lion live smoke passed");
