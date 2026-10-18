"use client";

import { authenticatedFetch } from "./client-session";

async function parseResponseData(response) {
  try {
    return await response.json();
  } catch (error) {
    if (response.ok) {
      if (["AbortError", "TimeoutError"].includes(error?.name)) {
        throw new Error("The server took too long to respond. Check your connection and refresh the page.");
      }
      throw new Error("The server returned an incomplete response. Please try again.");
    }
    return null;
  }
}

export async function fetchJson(url, options = {}) {
  const response = await authenticatedFetch(url, options);
  const data = await parseResponseData(response);
  return { response, data };
}

export async function requireJson(url, options = {}) {
  const { response, data } = await fetchJson(url, options);
  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error("Online account tools are temporarily unavailable. Use Square Appointments or email contact@blacklionstudios.com for now.");
    }

    throw new Error(data?.error || "Request failed");
  }

  return data;
}

export async function postJson(url, payload, options = {}) {
  return requireJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: JSON.stringify(payload),
    ...options
  });
}

export async function patchJson(url, payload, options = {}) {
  return requireJson(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: JSON.stringify(payload),
    ...options
  });
}
