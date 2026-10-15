const RUNTIME_EVENT_KEY = "foxhub-runtime-events";
const CHUNK_RELOAD_PREFIX = "foxhub-chunk-reload:";
const MAX_RUNTIME_EVENTS = 30;
const RETRY_DELAYS_MS = [350, 900, 1800];
export const RUNTIME_RELIABILITY_MARKERS = ["RuntimeErrorBoundary", "createRetryingLazyImport"];

function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown runtime error");
}

function isChunkLoadError(error) {
  const message = getErrorMessage(error);
  return /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|dynamically imported module/i.test(message);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function recordRuntimeEvent(type, detail = {}) {
  if (typeof window === "undefined") return;
  try {
    const current = JSON.parse(window.localStorage.getItem(RUNTIME_EVENT_KEY) || "[]");
    const event = {
      type,
      message: getErrorMessage(detail.error || detail.reason || detail.message),
      route: window.location.pathname || "/",
      online: window.navigator.onLine,
      at: new Date().toISOString()
    };
    window.localStorage.setItem(RUNTIME_EVENT_KEY, JSON.stringify([event, ...current].slice(0, MAX_RUNTIME_EVENTS)));
  } catch {
    // Reliability logging must never create a second user-facing failure.
  }
}

export function installRuntimeReliabilityGuards() {
  if (typeof window === "undefined" || window.__foxhubRuntimeReliabilityInstalled) return;
  window.__foxhubRuntimeReliabilityInstalled = true;
  window.addEventListener("error", (event) => {
    recordRuntimeEvent("window.error", { error: event.error || event.message });
  });
  window.addEventListener("unhandledrejection", (event) => {
    recordRuntimeEvent("promise.rejection", { reason: event.reason });
  });
  window.addEventListener("online", () => recordRuntimeEvent("network.online", { message: "Network restored" }));
  window.addEventListener("offline", () => recordRuntimeEvent("network.offline", { message: "Network unavailable" }));
}

export function createRetryingLazyImport(loader, chunkName = "app-shell") {
  return async function retryingLazyImport() {
    let lastError = null;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        return await loader();
      } catch (error) {
        lastError = error;
        recordRuntimeEvent("lazy.import.retry", { error });
        if (attempt < RETRY_DELAYS_MS.length) {
          await wait(RETRY_DELAYS_MS[attempt]);
        }
      }
    }

    if (isChunkLoadError(lastError) && typeof window !== "undefined") {
      const reloadKey = `${CHUNK_RELOAD_PREFIX}${chunkName}`;
      if (!window.sessionStorage.getItem(reloadKey)) {
        window.sessionStorage.setItem(reloadKey, new Date().toISOString());
        recordRuntimeEvent("lazy.import.reload", { error: lastError });
        window.location.reload();
      }
    }

    throw lastError;
  };
}
