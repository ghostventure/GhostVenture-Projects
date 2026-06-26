"use client";

const sessionStorageKey = "bls-session-token";

export function getClientSessionToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(sessionStorageKey);
}

export function storeClientSessionToken(token) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(sessionStorageKey, token);
}

export function clearClientSessionToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(sessionStorageKey);
}

export async function authenticatedFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getClientSessionToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: options.credentials || "same-origin"
  });
}
