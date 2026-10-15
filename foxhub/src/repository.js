import { publicEnv } from "./public-env.js";

const firebaseEnv = {
  apiKey: publicEnv.FIREBASE_API_KEY,
  authDomain: publicEnv.FIREBASE_AUTH_DOMAIN,
  projectId: publicEnv.FIREBASE_PROJECT_ID,
  storageBucket: publicEnv.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: publicEnv.FIREBASE_MESSAGING_SENDER_ID,
  appId: publicEnv.FIREBASE_APP_ID
};

const hasFirebaseConfig = Boolean(
  firebaseEnv.apiKey &&
    firebaseEnv.authDomain &&
    firebaseEnv.projectId &&
    firebaseEnv.storageBucket &&
    firebaseEnv.messagingSenderId &&
    firebaseEnv.appId
);

let backendPromise;

function isNativeShell() {
  return typeof window !== "undefined" && Boolean(window.Capacitor?.isNativePlatform?.());
}


function getBackend() {
  if (!backendPromise) {
    if (hasFirebaseConfig) {
      backendPromise = import("./repository-firebase.js");
    } else if (isNativeShell()) {
      backendPromise = import("./repository-locked.js");
    } else {
      backendPromise = import("./repository-local.js");
    }
  }

  return backendPromise;
}

export function getBackendMode() {
  if (hasFirebaseConfig) return "firebase";
  return isNativeShell() ? "locked" : "local";
}

export async function loadState() {
  const backend = await getBackend();
  return backend.loadState();
}

export async function saveState(state) {
  const backend = await getBackend();
  return backend.saveState(state);
}

export async function signInProfile(profileDraft) {
  const backend = await getBackend();
  return backend.signInProfile(profileDraft);
}

export async function signInWithGoogleProfile(profileDraft) {
  const backend = await getBackend();
  return backend.signInWithGoogleProfile(profileDraft);
}

export async function sendMagicLinkProfile(email) {
  const backend = await getBackend();
  return backend.sendMagicLinkProfile(email);
}

export async function sendPasswordResetProfile(email) {
  const backend = await getBackend();
  return backend.sendPasswordResetProfile(email);
}

export async function verifyPasswordResetProfile(code) {
  const backend = await getBackend();
  return backend.verifyPasswordResetProfile(code);
}

export async function confirmPasswordResetProfile(code, password) {
  const backend = await getBackend();
  return backend.confirmPasswordResetProfile(code, password);
}

export async function signOutCurrentProfile() {
  const backend = await getBackend();
  return backend.signOutCurrentProfile();
}

export async function updateProfileRecord(profileDraft) {
  const backend = await getBackend();
  return backend.updateProfileRecord(profileDraft);
}

export async function updateApplicantAccessRecord(email, accessPatch = {}) {
  const backend = await getBackend();
  return backend.updateApplicantAccessRecord?.(email, accessPatch);
}

export async function createMessageRecord(threadId, payload) {
  const backend = await getBackend();
  return backend.createMessageRecord(threadId, payload);
}

export async function createWalletEventRecord(event) {
  const backend = await getBackend();
  return backend.createWalletEventRecord(event);
}

export async function createMomentRecord(text, profile, attachments = []) {
  const backend = await getBackend();
  return backend.createMomentRecord(text, profile, attachments);
}

export async function addFavoriteRecord(favorite) {
  const backend = await getBackend();
  return backend.addFavoriteRecord(favorite);
}

export async function addSavedItemRecord(item) {
  const backend = await getBackend();
  return backend.addSavedItemRecord(item);
}

export async function addMiniAppRecentRecord(recent) {
  const backend = await getBackend();
  return backend.addMiniAppRecentRecord(recent);
}

export async function addMiniAppPermissionRecord(permission) {
  const backend = await getBackend();
  return backend.addMiniAppPermissionRecord(permission);
}

export async function createQrActionRecord(action) {
  const backend = await getBackend();
  return backend.createQrActionRecord(action);
}

export async function createDirectThreadRecord(contact) {
  const backend = await getBackend();
  return backend.createDirectThreadRecord(contact);
}

export async function createMediaClipRecord(payload) {
  const backend = await getBackend();
  return backend.createMediaClipRecord(payload);
}

export async function createStoryBundleRecord(payload) {
  const backend = await getBackend();
  return backend.createStoryBundleRecord(payload);
}

export async function createAuctionBidRecord(payload) {
  const backend = await getBackend();
  return backend.createAuctionBidRecord(payload);
}

export async function createCartRecord(payload) {
  const backend = await getBackend();
  return backend.createCartRecord(payload);
}

export async function createReviewRecord(payload) {
  const backend = await getBackend();
  return backend.createReviewRecord(payload);
}

export async function createRatingRecord(payload) {
  const backend = await getBackend();
  return backend.createRatingRecord(payload);
}

export async function createDocumentRecord(payload) {
  const backend = await getBackend();
  return backend.createDocumentRecord(payload);
}

export async function createOperatorActionRecord(payload) {
  const backend = await getBackend();
  return backend.createOperatorActionRecord(payload);
}

export async function createRouteRecord(payload) {
  const backend = await getBackend();
  return backend.createRouteRecord(payload);
}

export async function createEndorsementRecord(payload) {
  const backend = await getBackend();
  return backend.createEndorsementRecord(payload);
}

export async function createJobPostRecord(payload) {
  const backend = await getBackend();
  return backend.createJobPostRecord(payload);
}

export async function createMiniProgramManifestRecord(payload) {
  const backend = await getBackend();
  return backend.createMiniProgramManifestRecord(payload);
}

export async function createCallSessionRecord(payload) {
  const backend = await getBackend();
  return backend.createCallSessionRecord(payload);
}

export async function createInviteRecord(payload, profile) {
  const backend = await getBackend();
  return backend.createInviteRecord(payload, profile);
}

export async function reviewSponsorInviteRecord(inviteId, decision) {
  const backend = await getBackend();
  return backend.reviewSponsorInviteRecord(inviteId, decision);
}

export function subscribeToState(onState) {
  let active = true;
  let unsubscribe = () => {};

  getBackend().then((backend) => {
    if (!active) return;
    unsubscribe = backend.subscribeToState(onState);
  });

  return () => {
    active = false;
    unsubscribe();
  };
}
