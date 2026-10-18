const baseUrl = process.env.BLACK_LION_LIVE_URL || "https://black-lion-media-studio.web.app";
const response = await fetch(`${baseUrl}/api/me`, {
  cache: "no-store",
  signal: AbortSignal.timeout(10000)
});

if (response.status !== 401) {
  throw new Error(`/api/me returned HTTP ${response.status}; expected signed-out HTTP 401.`);
}

if (!response.headers.get("content-type")?.includes("application/json")) {
  throw new Error(`/api/me returned ${response.headers.get("content-type") || "no content type"}; expected JSON.`);
}

const payload = await response.json();
if (payload.error !== "Not authenticated") {
  throw new Error("/api/me returned an unexpected signed-out auth response.");
}

console.log("/api/me returned the expected signed-out JSON HTTP 401.");
