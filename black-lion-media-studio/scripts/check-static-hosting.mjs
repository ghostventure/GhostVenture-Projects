import { readFile } from "node:fs/promises";

const [firebaseConfig, firebaseRc] = await Promise.all([
  readFile("firebase.static.json", "utf8").then(JSON.parse),
  readFile(".firebaserc", "utf8").then(JSON.parse)
]);
const hosting = firebaseConfig.hosting;
const projectId = firebaseRc.projects?.default;
const fail = (message) => {
  console.error(`Static deployment blocked: ${message}`);
  process.exitCode = 1;
};

if (!projectId || hosting.site !== projectId || hosting.site !== "black-lion-media-studio") {
  fail("firebase.static.json must target the configured Black Lion Studios Hosting site.");
}
if (hosting.public !== ".firebase/static-fast/hosting" || hosting.cleanUrls !== true) {
  fail("static output must use the generated Hosting directory and clean URLs.");
}
if (!(hosting.redirects || []).some((item) => item.source === "/quote" && item.destination === "/services#service-estimation")) {
  fail("the /quote redirect must be preserved.");
}

const headers = hosting.headers || [];
const noStore = "no-store, no-cache, must-revalidate, private";
for (const source of ["/portal", "/portal/**"]) {
  const policy = headers.find((entry) => entry.source === source)?.headers || [];
  if (!policy.some((header) => header.key.toLowerCase() === "cache-control" && header.value === noStore)) {
    fail(`${source} must preserve the portal no-store cache policy.`);
  }
}
if (!headers.some((entry) => entry.source === "**" && entry.headers?.some((header) => header.key === "Content-Security-Policy"))) {
  fail("the global Content-Security-Policy must be preserved.");
}

const expectedRoutes = ["/api/**", "/dashboard", "/dashboard/**", "/profile", "/profile/**", "/messages", "/messages/**", "/booking-manager", "/booking-manager/**"];
const rewrites = hosting.rewrites || [];
for (const route of expectedRoutes) {
  const rewrite = rewrites.find((entry) => entry.source === route);
  if (rewrite?.function?.functionId !== "ssrblacklionmediastudio" || rewrite.function.region !== "us-central1") {
    fail(`${route} must route to ssrblacklionmediastudio in us-central1.`);
  }
}

if (!process.exitCode) {
  console.log("Static Hosting target, redirects, security/cache headers, and SSR rewrites are valid.");
}
