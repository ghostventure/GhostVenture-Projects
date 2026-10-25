"use client";

const legacySessionStorageKey = "bls-session-token";
const readRequestTimeoutMs = 30_000;

function removeLegacySessionToken() {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    // Remove tokens persisted by older clients. Authentication uses the
    // server-set HttpOnly cookie, never a JavaScript-readable bearer token.
    window.localStorage.removeItem(legacySessionStorageKey);
    return true;
  } catch {
    // A storage restriction does not affect the HttpOnly cookie.
    return false;
  }
}

export function clearClientSessionToken() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(legacySessionStorageKey);
    return true;
  } catch {
    return false;
  }
}

export async function authenticatedFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  removeLegacySessionToken();
  const method = String(options.method || "GET").toUpperCase();
  const useReadTimeout = !options.signal && ["GET", "HEAD"].includes(method);
  const signal = options.signal || (useReadTimeout ? AbortSignal.timeout(readRequestTimeoutMs) : undefined);

  try {
    return await fetch(url, {
      ...options,
      ...(signal ? { signal } : {}),
      headers,
      credentials: options.credentials || "same-origin"
    });
  } catch (error) {
    if (useReadTimeout && signal.aborted) {
      throw new Error("The server took too long to respond. Check your connection and refresh the page.");
    }
    throw error;
  }
}
