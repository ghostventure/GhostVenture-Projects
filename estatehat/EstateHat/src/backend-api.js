const FUNCTION_BASE_URL = "https://us-central1-estatehat.cloudfunctions.net";

const FUNCTION_NAMES = {
  health: "apiHealth",
  sessionBootstrap: "apiSessionBootstrap",
  listingOps: "apiListingOps",
};

const SAME_ORIGIN_PATHS = {
  health: "/api/health",
  sessionBootstrap: "/api/session/bootstrap",
  listingOps: "/api/listings",
};

function buildCandidateUrls(endpointKey, query = "") {
  const candidates = [];
  const sameOriginPath = SAME_ORIGIN_PATHS[endpointKey];
  const functionName = FUNCTION_NAMES[endpointKey];

  if (typeof window !== "undefined" && /^https?:$/.test(window.location.protocol) && sameOriginPath) {
    candidates.push(new URL(`${sameOriginPath}${query}`, window.location.origin).toString());
  }

  if (functionName) {
    candidates.push(`${FUNCTION_BASE_URL}/${functionName}${query}`);
  }

  return [...new Set(candidates)];
}

function buildStripeCandidateUrls(pathname, query = "") {
  const normalizedPath = String(pathname || "").replace(/^\//, "");
  const candidates = [];

  if (typeof window !== "undefined" && /^https?:$/.test(window.location.protocol)) {
    candidates.push(new URL(`/api/stripe/${normalizedPath}${query}`, window.location.origin).toString());
  }

  candidates.push(`${FUNCTION_BASE_URL}/stripeApi/api/stripe/${normalizedPath}${query}`);
  return [...new Set(candidates)];
}

function buildSquareCandidateUrls(pathname, query = "") {
  const normalizedPath = String(pathname || "").replace(/^\//, "");
  const candidates = [];

  if (typeof window !== "undefined" && /^https?:$/.test(window.location.protocol)) {
    candidates.push(new URL(`/api/square/${normalizedPath}${query}`, window.location.origin).toString());
  }

  candidates.push(`${FUNCTION_BASE_URL}/squareApi/api/square/${normalizedPath}${query}`);
  return [...new Set(candidates)];
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function shouldFallback(response) {
  return response.status === 404 || response.status === 405 || response.status === 501 || response.status === 503;
}

async function requestFromCandidates(candidates, options = {}) {
  let lastError = null;

  for (const url of candidates) {
    try {
      const response = await fetch(url, options);
      const payload = await parseJsonSafe(response);

      if (!response.ok) {
        const message = payload.error || "Request failed.";
        if (shouldFallback(response)) {
          lastError = new Error(message);
          continue;
        }
        throw new Error(message);
      }

      return payload;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Backend service is unavailable.");
    }
  }

  throw lastError || new Error("Backend service is unavailable.");
}

export async function requestBackendJson(endpointKey, options = {}, query = "") {
  return requestFromCandidates(buildCandidateUrls(endpointKey, query), options);
}

export async function getBackendHealth() {
  return requestBackendJson("health", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
}

export async function getSessionBootstrap({ auth } = {}) {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("You must be signed in first.");
  }

  const token = await user.getIdToken();
  return requestBackendJson("sessionBootstrap", {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getListingSubmissions({ auth } = {}) {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("You must be signed in first.");
  }

  const token = await user.getIdToken();
  return requestBackendJson("listingOps", {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  }, "/submissions");
}

export async function getListingSubmissionQueue({ auth } = {}) {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("You must be signed in first.");
  }

  const token = await user.getIdToken();
  return requestBackendJson("listingOps", {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  }, "/submissions/queue");
}

export async function postListingSubmissionReview(body = {}, { auth } = {}) {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("You must be signed in first.");
  }

  const token = await user.getIdToken();
  return requestBackendJson("listingOps", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }, "/submissions/review");
}

export async function postStripeAction(path, body = {}, { auth } = {}) {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("Sign in to continue with Stripe.");
  }

  const token = await user.getIdToken();
  return requestFromCandidates(buildStripeCandidateUrls(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

export async function postSquareAction(path, body = {}, { auth } = {}) {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("Sign in to continue with Square.");
  }

  const token = await user.getIdToken();
  return requestFromCandidates(buildSquareCandidateUrls(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}
