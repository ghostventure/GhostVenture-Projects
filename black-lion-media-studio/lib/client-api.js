"use client";

import { authenticatedFetch } from "./client-session";

async function parseResponseData(response) {
  try {
    return await response.json();
  } catch {
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
