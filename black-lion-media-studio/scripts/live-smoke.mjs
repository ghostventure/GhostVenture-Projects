const baseUrl = process.env.BLACK_LION_LIVE_URL || "https://black-lion-media-studio.web.app";
async function fetchLive(input, init = {}) {
  const route = String(input).replace(baseUrl, "") || "/";
  try {
    return await fetch(input, {
      ...init,
      cache: "no-store",
      signal: init.signal || AbortSignal.timeout(10000)
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error(`${route} did not respond within 10 seconds.`);
    }
    throw error;
  }
}
const coreRoutes = [
  "/",
  "/about",
  "/services",
  "/contact",
  "/work",
  "/portfolio",
  "/multimedia",
  "/tech-development",
  "/fashion",
  "/portal",
  "/store",
  "/faq",
  "/privacy",
  "/terms",
  "/legal",
  "/dmca",
  "/models",
  "/models/faq"
];

const adConversionRoutes = ["/book", "/support", "/ad-expansion"];

const serviceRoutes = [
  "/photography",
  "/videography",
  "/dj-services",
  "/beat-sessions",
  "/ai-services",
  "/pc-tech-support",
  "/membership-sites"
];

const routes = [...coreRoutes, ...adConversionRoutes, ...serviceRoutes];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const route of routes) {
  const response = await fetchLive(`${baseUrl}${route}`, { redirect: "manual" });
  const text = await response.text();
  assert(response.status === 200, `${route} returned ${response.status}`);
  assert(!/404: This page could not be found/i.test(text), `${route} rendered a framework 404`);
  console.log(`${route} ${response.status} length:${text.length}`);
}

const aiServices = await (await fetchLive(`${baseUrl}/ai-services`)).text();
for (const marker of ["No coding experience", "Custom quote after consultation", "Start request", "Does my app have to include AI?"]) {
  assert(aiServices.includes(marker), `/ai-services missing marker: ${marker}`);
}
const techDevelopment = await (await fetchLive(`${baseUrl}/tech-development`)).text();
assert(techDevelopment.includes('href="/ai-services"'), "Tech Development missing AI service link");
assert(techDevelopment.includes("Computer Service &amp; Repair"), "Tech Development missing computer support");

for (const [route, slug] of [["/ai-services", "ai-services"], ["/photography", "photography"], ["/videography", "videography"], ["/dj-services", "dj-services"], ["/beat-sessions", "beat-creation-session"], ["/pc-tech-support", "pc-tech-services"], ["/membership-sites", "platform-membership-site-building-maintenance"]]) {
  const html = await (await fetchLive(`${baseUrl}${route}`)).text();
  assert(html.includes(`href="/portal?service=${slug}"`), `${route} missing shared service request entry`);
}

const quoteResponse = await fetchLive(`${baseUrl}/quote`, { redirect: "manual" });
assert([307, 308].includes(quoteResponse.status), `/quote returned ${quoteResponse.status}`);
assert(
  quoteResponse.headers.get("location")?.includes("/services#service-estimation"),
  "/quote did not redirect to the services-page Service Estimation section"
);
console.log(`/quote ${quoteResponse.status} redirects to ${quoteResponse.headers.get("location")}`);

const home = await (await fetchLive(baseUrl)).text();
for (const marker of [
  "Black Lion Studios",
  "Black Lion Multimedia",
  "Black Lion Tech Development",
  "Black Lion Fashion",
  'property="og:title"',
  'property="og:description"',
  'property="og:image"',
  'name="twitter:card"',
  'rel="canonical"',
  "Photos &amp; Video",
  "AI &amp; Software",
  "Fashion",
  "Choose a branch",
  "Detailed tools moved to the pages built for that job."
]) {
  assert(home.includes(marker), `home missing marker: ${marker}`);
  console.log(`marker ok: ${marker}`);
}

for (const marker of [
  "Book appointment",
  "Build a Service Estimation before you send the request.",
  "Production readiness",
  "I confirm this Service Estimation matches what I am looking for",
  "Travel charge over 30 miles",
  "Revision rounds after 2",
  "50% deposit",
  "Open booking windows.",
  "Security posture"
]) {
  assert(!home.includes(marker), `home still contains moved detail: ${marker}`);
  console.log(`moved detail absent from home: ${marker}`);
}

const services = await (await fetchLive(`${baseUrl}/services`)).text();
for (const marker of [
  "Build a Service Estimation before you send the request.",
  "Production readiness",
  "I confirm this Service Estimation matches what I am looking for",
  "Travel charge over 30 miles",
  "Revision rounds after 2",
  "50% deposit"
]) {
  assert(services.includes(marker), `/services missing estimator marker: ${marker}`);
  console.log(`services estimator marker ok: ${marker}`);
}

const book = await (await fetchLive(`${baseUrl}/book`)).text();
for (const marker of ["Book appointment", "Normal request windows"]) {
  assert(book.includes(marker), `/book missing booking marker: ${marker}`);
  console.log(`book marker ok: ${marker}`);
}

const legal = await (await fetchLive(`${baseUrl}/legal`)).text();
assert(legal.includes("Security framework readiness"), "/legal missing compliance marker");
console.log("legal compliance marker ok");

const expansion = await (await fetchLive(`${baseUrl}/ad-expansion`)).text();
for (const marker of ["200 additional", "Campaign Conversion", "Reliability Resilience", "Compliance Trust"]) {
  assert(expansion.includes(marker), `/ad-expansion missing marker: ${marker}`);
  console.log(`expansion marker ok: ${marker}`);
}

const models = await (await fetchLive(`${baseUrl}/models`)).text();
for (const marker of ["Black Lion Fashion model sub-site", "Start application", "Application readiness", "Scheduling and job terms", "Important terms", "Related paths"]) {
  assert(models.includes(marker), `/models missing marker: ${marker}`);
  console.log(`models marker ok: ${marker}`);
}
assert(models.includes("Full Model FAQ"), "/models missing Full Model FAQ link");
assert(!models.includes("Should I upload copyrighted work?"), "/models still contains full FAQ content");
assert(!models.includes("Application architecture"), "/models still contains internal component inventory");
assert(!models.includes("100+ model application components installed"), "/models still exposes component inventory");

const modelFaq = await (await fetchLive(`${baseUrl}/models/faq`)).text();
for (const marker of ["Questions before applying to model.", "Should I upload copyrighted work?", "Back to Model Sign-up"]) {
  assert(modelFaq.includes(marker), `/models/faq missing marker: ${marker}`);
  console.log(`model faq marker ok: ${marker}`);
}

for (const route of ["/robots.txt", "/sitemap.xml"]) {
  const response = await fetchLive(`${baseUrl}${route}`);
  const text = await response.text();
  assert(response.status === 200, `${route} returned ${response.status}`);
  assert(text.includes("black-lion-media-studio.web.app"), `${route} missing public URL`);
  console.log(`${route} ${response.status}`);
}

console.log("black lion live smoke passed");
