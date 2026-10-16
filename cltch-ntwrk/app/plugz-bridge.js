import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  setPersistence,
  signInWithCustomToken,
  signInWithPopup,
  signInWithRedirect
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

export const plugzFirebaseConfig = {
  projectId: "plugz-untd-gear",
  appId: "1:329345923912:web:a9b7b5a474bcab3fb2d17d",
  storageBucket: "plugz-untd-gear.firebasestorage.app",
  apiKey: "AIzaSyBHUZkXjnj3v7ZeoBQDTjbZFQngixTz5DM",
  authDomain: "plugz-untd-gear.firebaseapp.com",
  messagingSenderId: "329345923912",
  measurementId: "G-2YJV38ZDCK"
};

const PLUGZ_APP_NAME = "plugz-untd-gear";
const PLUGZ_PENDING_ROLE_KEY = "cltch_plugz_bridge_role_v1";
const PLUGZ_PENDING_PROFILE_KEY = "cltch_plugz_profile_activation_v1";
export const PLUGZ_TERMS_VERSION = "plugz-cltch-bridge-2026-07-29";
const PLUGZ_BRIDGE_ENDPOINTS = [
  "/api/plugz/bridge",
  "https://us-central1-cltch-ntwrk-social.cloudfunctions.net/plugzBridge"
];

let plugzApp;
let plugzAuth;

export function getPlugzAuth() {
  if (!plugzApp) {
    plugzApp = initializeApp(plugzFirebaseConfig, PLUGZ_APP_NAME);
    plugzAuth = getAuth(plugzApp);
    setPersistence(plugzAuth, browserLocalPersistence).catch(() => {});
  }
  return plugzAuth;
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function exchangePlugzToken(plugzIdToken, role, options = {}) {
  const acceptedTerms = options.acceptedTerms === true;
  const cltchIdToken = typeof options.cltchIdToken === "string" ? options.cltchIdToken : "";
  let lastError = null;
  for (const endpoint of PLUGZ_BRIDGE_ENDPOINTS) {
    const url = endpoint.startsWith("http")
      ? endpoint
      : new URL(endpoint, window.location.origin).toString();
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          plugzIdToken,
          role,
          acceptedTerms,
          termsVersion: PLUGZ_TERMS_VERSION,
          ...(cltchIdToken ? { cltchIdToken } : {})
        })
      });
      const payload = await readJsonSafe(response);
      if (!response.ok) {
        lastError = new Error(payload.error || "Plugz bridge request failed.");
        if ([404, 405, 501, 503].includes(response.status)) continue;
        throw lastError;
      }
      return payload;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Plugz bridge request failed.");
    }
  }
  throw lastError || new Error("Plugz bridge is unavailable.");
}

export function cachePlugzBridgeRole(role) {
  localStorage.setItem(PLUGZ_PENDING_ROLE_KEY, role === "host" ? "host" : "musician");
}

export function readPlugzBridgeRole(fallback = "musician") {
  const role = localStorage.getItem(PLUGZ_PENDING_ROLE_KEY);
  return role === "host" || role === "musician" ? role : fallback;
}

export function clearPlugzBridgeRole() {
  localStorage.removeItem(PLUGZ_PENDING_ROLE_KEY);
}

export function cachePlugzProfileActivation(role = "musician") {
  localStorage.setItem(PLUGZ_PENDING_PROFILE_KEY, JSON.stringify({
    role: role === "host" ? "host" : "musician",
    acceptedTerms: true,
    termsVersion: PLUGZ_TERMS_VERSION,
    createdAt: new Date().toISOString()
  }));
}

export function readPlugzProfileActivation() {
  try {
    const pending = JSON.parse(localStorage.getItem(PLUGZ_PENDING_PROFILE_KEY) || "null");
    if (!pending || pending.acceptedTerms !== true || pending.termsVersion !== PLUGZ_TERMS_VERSION) return null;
    return {
      role: pending.role === "host" ? "host" : "musician",
      acceptedTerms: true
    };
  } catch {
    return null;
  }
}

export function clearPlugzProfileActivation() {
  localStorage.removeItem(PLUGZ_PENDING_PROFILE_KEY);
}

export async function signInToPlugzWithGoogle(role = "musician") {
  const auth = getPlugzAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (error?.code === "auth/popup-blocked") {
      cachePlugzBridgeRole(role);
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw error;
  }
}

export async function readPlugzRedirectCredential() {
  const auth = getPlugzAuth();
  return getRedirectResult(auth);
}

export async function exchangePlugzCredentialForCltch(plugzUser, role = "musician", options = {}) {
  if (!plugzUser) {
    throw new Error("Plugz sign-in did not return an account.");
  }
  if (options.acceptedTerms !== true) {
    throw new Error("Accept the CLTCH Plugz membership terms before continuing.");
  }
  const plugzIdToken = await plugzUser.getIdToken();
  return exchangePlugzToken(plugzIdToken, role === "host" ? "host" : "musician", options);
}

export async function activatePlugzMembershipForCurrentCltchUser(cltchAuth, role = "musician", options = {}) {
  const cltchUser = cltchAuth?.currentUser;
  if (!cltchUser) {
    throw new Error("Sign in to CLTCH before connecting Plugz.");
  }
  if (options.acceptedTerms !== true) {
    throw new Error("Accept the CLTCH Plugz membership terms before continuing.");
  }
  cachePlugzProfileActivation(role);
  const plugzCredential = await signInToPlugzWithGoogle(role);
  if (!plugzCredential?.user) return null;
  const [plugzIdToken, cltchIdToken] = await Promise.all([
    plugzCredential.user.getIdToken(),
    cltchUser.getIdToken()
  ]);
  const bridge = await exchangePlugzToken(plugzIdToken, role === "host" ? "host" : "musician", {
    acceptedTerms: true,
    cltchIdToken
  });
  await signInWithCustomToken(cltchAuth, bridge.customToken);
  clearPlugzProfileActivation();
  return bridge;
}

export async function finishPendingPlugzProfileActivation(cltchAuth) {
  const pending = readPlugzProfileActivation();
  if (!pending) return null;
  const redirectCredential = await readPlugzRedirectCredential();
  if (!redirectCredential?.user) return null;
  return activatePlugzMembershipForCurrentCltchUserFromUser(cltchAuth, redirectCredential.user, pending.role);
}

export async function activatePlugzMembershipForCurrentCltchUserFromUser(cltchAuth, plugzUser, role = "musician") {
  const cltchUser = cltchAuth?.currentUser;
  if (!cltchUser) {
    throw new Error("Sign in to CLTCH before connecting Plugz.");
  }
  const [plugzIdToken, cltchIdToken] = await Promise.all([
    plugzUser.getIdToken(),
    cltchUser.getIdToken()
  ]);
  const bridge = await exchangePlugzToken(plugzIdToken, role === "host" ? "host" : "musician", {
    acceptedTerms: true,
    cltchIdToken
  });
  await signInWithCustomToken(cltchAuth, bridge.customToken);
  clearPlugzProfileActivation();
  return bridge;
}
