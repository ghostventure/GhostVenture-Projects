const baseUrl = process.env.FOXHUB_LIVE_URL || "https://foxhub-superapp.web.app";
const routes = ["/", "/signin", "/management", "/feedback"];
const requiredMarkers = [
  "FoxHub",
  "Profile photo",
  "Add profile photo",
  "RuntimeErrorBoundary",
  "createRetryingLazyImport",
  "runtime-fallback",
  "Management backend unavailable",
  "using Windows Hello local gate"
];

async function fetchText(path) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return {
    body: await response.text(),
    lastModified: response.headers.get("last-modified") || ""
  };
}

for (const route of routes) {
  const response = await fetch(`${baseUrl}${route}`, { method: "HEAD" });
  if (response.status !== 200) {
    throw new Error(`${route} returned ${response.status}`);
  }
  console.log(`${route} ${response.status} last-modified:${response.headers.get("last-modified") || ""}`);
}

const { body: html } = await fetchText("/");
const mainAsset = html.match(/\/assets\/index-[^"]+\.js/)?.[0];
const cssAsset = html.match(/\/assets\/index-[^"]+\.css/)?.[0];
if (!mainAsset || !cssAsset) {
  throw new Error("Live HTML is missing expected Vite assets.");
}

const { body: mainBundle } = await fetchText(mainAsset);
const shellAssetName = mainBundle.match(/FoxHubShell-[A-Za-z0-9_-]+\.js/)?.[0];
if (!shellAssetName) {
  throw new Error("Live bundle is missing the lazy FoxHub shell asset.");
}

const [{ body: shellBundle }, { body: cssBundle }] = await Promise.all([
  fetchText(`/assets/${shellAssetName}`),
  fetchText(cssAsset)
]);
const searchable = `${html}\n${mainBundle}\n${shellBundle}\n${cssBundle}`;

for (const marker of requiredMarkers) {
  if (!searchable.includes(marker)) {
    throw new Error(`Live bundle missing marker: ${marker}`);
  }
  console.log(`marker ok: ${marker}`);
}

console.log("live smoke passed");
