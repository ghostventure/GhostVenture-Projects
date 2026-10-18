"use client";

const sessionStorageKey = "bls-session-token";
const readRequestTimeoutMs = 30_000;

export function getClientSessionToken() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(sessionStorageKey);
  } catch {
    // The HttpOnly same-origin cookie remains the primary session mechanism.
    return null;
  }
}

export function storeClientSessionToken(token) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(sessionStorageKey, token);
    return true;
  } catch {
    // Login can still complete through the HttpOnly cookie set by the server.
    return false;
  }
}

export function clearClientSessionToken() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(sessionStorageKey);
    return true;
  } catch {
    return false;
  }
}

export async function authenticatedFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getClientSessionToken();
  const method = String(options.method || "GET").toUpperCase();
  const useReadTimeout = !options.signal && ["GET", "HEAD"].includes(method);
  const signal = options.signal || (useReadTimeout ? AbortSignal.timeout(readRequestTimeoutMs) : undefined);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

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
