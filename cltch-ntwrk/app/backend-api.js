const FUNCTION_BASE_URL = "https://us-central1-cltch-ntwrk.cloudfunctions.net";
export const BACKEND_DISABLED = true;
export const BACKEND_DISABLED_MESSAGE = "This feature requires the Blaze backend setup and is temporarily disabled.";

const FUNCTION_NAMES = {
  health: "apiHealth",
  sessionBootstrap: "apiSessionBootstrap",
  stripeConfig: "stripeConfig",
  stripeCreateConnectedAccount: "stripeCreateConnectedAccount",
  stripeCreateOnboardingLink: "stripeCreateOnboardingLink",
  stripeCreateHostCheckoutIntent: "stripeCreateHostCheckoutIntent",
  plaidCreateLinkToken: "plaidCreateLinkToken",
  plaidExchangePublicToken: "plaidExchangePublicToken"
};

const SAME_ORIGIN_PATHS = {
  health: "/api/health",
  sessionBootstrap: "/api/session/bootstrap",
  stripeConfig: "/api/stripe/config",
  stripeCreateConnectedAccount: "/api/stripe/create-connected-account",
  stripeCreateOnboardingLink: "/api/stripe/create-onboarding-link",
  stripeCreateHostCheckoutIntent: "/api/stripe/create-host-checkout-intent",
  plaidCreateLinkToken: "/api/plaid/create-link-token",
  plaidExchangePublicToken: "/api/plaid/exchange-public-token"
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

export async function requestBackendJson(endpointKey, options = {}, query = "") {
  if (BACKEND_DISABLED) {
    throw new Error(BACKEND_DISABLED_MESSAGE);
  }

  const candidates = buildCandidateUrls(endpointKey, query);
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
      lastError = error instanceof Error ? error : new Error("Request failed.");
    }
  }

  throw lastError || new Error("Backend service is unavailable.");
}

export async function getBackendHealth() {
  return requestBackendJson("health", {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });
}

export async function getSessionBootstrap({ auth, role = "" } = {}) {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("You must be signed in first.");
  }

  const token = await user.getIdToken();
  const query = role ? `?role=${encodeURIComponent(role)}` : "";

  return requestBackendJson("sessionBootstrap", {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    }
  }, query);
}
