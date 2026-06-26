"use client";

const AUTH_EVENT_NAME = "bls-auth-changed";
const AUTH_STORAGE_KEY = "bls-auth-state";
const AUTH_CHANNEL_NAME = "bls-auth-channel";
const AUTH_ACTIVITY_EVENT_NAME = "bls-auth-activity";
const AUTH_ACTIVITY_STORAGE_KEY = "bls-auth-activity-state";
const AUTH_IDLE_TIMEOUT_MS = 20 * 60 * 1000;
const AUTH_IDLE_WARNING_MS = 60 * 1000;

function getBroadcastChannel() {
  if (typeof window === "undefined" || typeof window.BroadcastChannel === "undefined") {
    return null;
  }

  return new window.BroadcastChannel(AUTH_CHANNEL_NAME);
}

export function notifyAuthStateChange(state) {
  if (typeof window === "undefined") {
    return;
  }

  const detail = {
    state,
    timestamp: Date.now()
  };

  window.dispatchEvent(new CustomEvent(AUTH_EVENT_NAME, { detail }));

  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(detail));
  } catch {
    // Ignore localStorage failures and fall back to same-tab events.
  }

  const channel = getBroadcastChannel();
  if (channel) {
    channel.postMessage(detail);
    channel.close();
  }
}

export function notifyAuthActivity() {
  if (typeof window === "undefined") {
    return;
  }

  const detail = {
    state: "active",
    timestamp: Date.now()
  };

  window.dispatchEvent(new CustomEvent(AUTH_ACTIVITY_EVENT_NAME, { detail }));

  try {
    window.localStorage.setItem(AUTH_ACTIVITY_STORAGE_KEY, JSON.stringify(detail));
  } catch {
    // Ignore localStorage failures and fall back to same-tab events.
  }

  const channel = getBroadcastChannel();
  if (channel) {
    channel.postMessage(detail);
    channel.close();
  }
}

export {
  AUTH_ACTIVITY_EVENT_NAME,
  AUTH_ACTIVITY_STORAGE_KEY,
  AUTH_CHANNEL_NAME,
  AUTH_EVENT_NAME,
  AUTH_IDLE_TIMEOUT_MS,
  AUTH_IDLE_WARNING_MS,
  AUTH_STORAGE_KEY
};
