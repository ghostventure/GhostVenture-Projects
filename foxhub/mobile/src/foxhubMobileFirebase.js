import { initializeApp, getApp, getApps } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import {
  OWNER_EMAILS,
  createProfile,
  hasFoxHubManagementAccess,
  isAtLeast18,
  isFoxHubDomainEmail,
  isStrongSignupPassword,
  normalizeEmail
} from "./foxhubMobileCore";

export const FOXHUB_FIREBASE_PROJECT_ID = "foxhub-c984b";
export const FOXHUB_WEB_APP_URL = "https://foxhub-c984b.web.app";

const firebaseConfig = {
  apiKey: "AIzaSyCo_E3ygnO_KNhJMuwKXXVLPB7JgbGOTQI",
  authDomain: "foxhub-c984b.firebaseapp.com",
  projectId: FOXHUB_FIREBASE_PROJECT_ID,
  storageBucket: "foxhub-c984b.firebasestorage.app",
  messagingSenderId: "751583414529",
  appId: "1:751583414529:web:7f24267d610870ace83300"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

function nowIso() {
  return new Date().toISOString();
}

const PROFILE_SCHEMA_VERSION = 4;
const USER_STATE_ARRAY_FIELDS = [
  "shortVideos",
  "storyBundles",
  "auctionLots",
  "bidEvents",
  "carts",
  "fulfillmentOrders",
  "shopProfiles",
  "shopReviews",
  "ratingRecords",
  "ratingModerationQueue",
  "reputationSnapshots",
  "routePlans",
  "professionalIdentities",
  "endorsements",
  "jobPosts",
  "resumeEntries",
  "miniProgramManifests",
  "runtimeSessions",
  "callSessions",
  "callLogs",
  "invites",
  "userRecords",
  "friendRequests",
  "favorites",
  "savedItems",
  "miniAppRecents",
  "miniAppPermissions",
  "officialAccountSubscriptions",
  "qrHistory",
  "serviceContinuity",
  "utilityBillPayProviders",
  "utilityBillPayPayments",
  "listings",
  "savedSearches",
  "listingAlerts",
  "moderationCases",
  "verificationCases",
  "merchantSettlements",
  "merchantPayoutControls",
  "merchantLocations",
  "compliancePrograms",
  "trustSafetyIncidents",
  "merchantOnboardingQueue",
  "merchantRiskSignals",
  "disputeCases",
  "auditEvents",
  "notificationEvents",
  "deviceSessions",
  "documentVault",
  "operatorActions",
  "operatorAccessRecords",
  "notificationSubscriptions",
  "blockedUsers",
  "threadReadState",
  "growthCategories",
  "growthEvents",
  "growthOutputs",
  "uxComponents",
  "uxEvents",
  "uxCommandRuns",
  "uxTodayCards",
  "uxContextRailItems",
  "uxTimelines",
  "uxInboxModes",
  "uxTrustBadges",
  "uxEmptyStateActions",
  "uxOnboardingSteps",
  "uxMiniAppPermissionReviews",
  "uxPaymentSteppers",
  "uxNotificationInbox",
  "uxOperatorConsoleItems",
  "uxDiscoveryViews",
  "uxCompletenessMeters",
  "uxSavedWorkspaceItems",
  "uxToasts",
  "uxRuntimeBanners",
  "uxRoleHomeLayouts",
  "uxObjectDetails",
  "uxCreateMenuActions",
  "productionComponents",
  "productionEvents",
  "serverJobs",
  "pushDeliveries",
  "storageObjects",
  "authHardeningChecks",
  "rbacAssignments",
  "paymentWebhookEvents",
  "searchIndexJobs",
  "miniAppSandboxSessions",
  "geoIndexRecords",
  "moderationPipelineCases",
  "analyticsExports",
  "smokeTestRuns"
];

function buildEmptyUserState() {
  return USER_STATE_ARRAY_FIELDS.reduce((state, field) => {
    state[field] = [];
    return state;
  }, {});
}

function mobileOneId(user = {}) {
  const seed = String(user.uid || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase();
  return seed ? `FOX-${seed}` : "";
}

function asPlainTimestamp(value) {
  if (!value) return "";
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000).toISOString();
  return String(value);
}

function authErrorMessage(error) {
  const code = error?.code || "";
  if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
    return "No matching FoxHub account was found.";
  }
  if (code === "auth/email-already-in-use") return "This email is already registered.";
  if (code === "auth/weak-password") return "Use a stronger password for FoxHub.";
  if (code === "auth/operation-not-allowed") return "Email sign-in is not enabled for this FoxHub project yet.";
  if (code === "permission-denied") return "FoxHub could not write this profile with the current rules.";
  return error instanceof Error ? error.message : "FoxHub mobile could not reach Firebase.";
}

function normalizeLiveProfile(user, profile = {}, operator = {}, staff = {}) {
  const email = normalizeEmail(user?.email || profile.email);
  const management = hasFoxHubManagementAccess({ ...profile, email }) || Boolean(operator?.role || staff?.role || operator?.active || staff?.active);
  const displayName = profile.displayName || profile.name || user?.displayName || (management ? "FoxHub Management" : "FoxHub Member");
  const handleSeed = profile.handle || email.split("@")[0] || "foxhub";
  return {
    ...profile,
    id: user?.uid || profile.id || profile.oneId || email,
    uid: user?.uid || profile.uid || "",
    oneId: profile.oneId || mobileOneId(user) || "",
    email,
    name: profile.name || displayName,
    displayName,
    handle: String(handleSeed).startsWith("@") ? handleSeed : `@${handleSeed}`,
    city: profile.city || "",
    zipCode: profile.zipCode || profile.postalCode || "",
    postalCode: profile.postalCode || profile.zipCode || "",
    accountClass: management ? "management" : "member",
    accessState: management ? "owner" : profile.accessState || "waitlist",
    accessNote: management ? "Management workspace access" : profile.accessNote || "FoxHub Management review pending",
    onboarded: Boolean(management || profile.onboarded),
    lastActiveAt: asPlainTimestamp(profile.lastActiveAt) || nowIso(),
    operatorRole: operator?.role || staff?.role || "",
    staffRecord: staff || null
  };
}

function buildProfileWrite(user, draft = {}, existing = {}) {
  const base = createProfile(draft, "member");
  const displayName = base.displayName || base.name;
  const management = hasFoxHubManagementAccess({ ...existing, email: user.email });
  const timestamp = nowIso();
  return {
    ...buildEmptyUserState(),
    ...existing,
    ...base,
    uid: user.uid,
    oneId: existing.oneId || mobileOneId(user),
    id: existing.id || user.uid,
    email: normalizeEmail(user.email),
    name: displayName,
    displayName,
    handle: base.handle,
    city: base.city,
    zipCode: base.zipCode,
    postalCode: base.zipCode,
    birthDate: base.birthDate,
    inviteCode: base.inviteCode,
    sponsorHandle: base.sponsorHandle,
    accountClass: management ? "management" : "member",
    accessState: management ? "active" : base.accessState === "priority" ? "priority" : "waitlist",
    accessNote: management ? "Management workspace access" : base.accessNote,
    onboarded: management || base.onboarded,
    ageVerified: true,
    ageVerifiedAt: timestamp,
    authMethod: "password",
    schemaVersion: PROFILE_SCHEMA_VERSION,
    bio: existing.bio || String(draft.bio || "").trim().slice(0, 280),
    occupation: existing.occupation || "",
    demographic: existing.demographic || "",
    pronouns: existing.pronouns || "",
    website: existing.website || "",
    availability: existing.availability || "",
    interests: existing.interests || "",
    profilePhotoUrl: existing.profilePhotoUrl || "",
    profilePhotoName: existing.profilePhotoName || "",
    profilePhotoType: existing.profilePhotoType || "",
    waitlistEndsAt: existing.waitlistEndsAt || "",
    tutorialCompleted: Boolean(existing.tutorialCompleted),
    verifiedPerformerSubscribed: Boolean(existing.verifiedPerformerSubscribed),
    verifiedPerformerStatus: existing.verifiedPerformerStatus || "not_subscribed",
    verifiedPerformerPlan: existing.verifiedPerformerPlan || "$20/month",
    verifiedPerformerSince: existing.verifiedPerformerSince || "",
    activeCircleId: existing.activeCircleId || "",
    activeMiniAppId: existing.activeMiniAppId || "",
    selectedThreadId: existing.selectedThreadId || "",
    presenceState: "online",
    lastSeenAt: timestamp,
    lastActiveAt: timestamp,
    mechanicsUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdAt: existing.createdAt || serverTimestamp()
  };
}

async function readOptionalDoc(path, id) {
  const snapshot = await getDoc(doc(db, path, id));
  return snapshot.exists() ? snapshot.data() : {};
}

async function countOwnedCollection(uid, name) {
  try {
    const snapshot = await getDocs(query(collection(db, "users", uid, name), limit(12)));
    return snapshot.size;
  } catch {
    return 0;
  }
}

export async function loadLiveProfile(user = auth.currentUser) {
  if (!user) return null;
  const profileRef = doc(db, "users", user.uid);
  const [profileSnapshot, operator, staff] = await Promise.all([
    getDoc(profileRef),
    readOptionalDoc("operatorAccess", user.uid),
    readOptionalDoc("staffMembers", user.uid)
  ]);
  const profileData = profileSnapshot.exists() ? profileSnapshot.data() : {};
  const profile = normalizeLiveProfile(user, profileData, operator, staff);
  await setDoc(
    profileRef,
    {
      uid: user.uid,
      oneId: profile.oneId || mobileOneId(user),
      email: profile.email,
      displayName: profile.displayName,
      handle: profile.handle,
      lastSeenAt: nowIso(),
      lastActiveAt: nowIso(),
      presenceState: "online",
      mechanicsUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  const [contacts, threads, moments, walletEvents] = await Promise.all([
    countOwnedCollection(user.uid, "contacts"),
    countOwnedCollection(user.uid, "threads"),
    countOwnedCollection(user.uid, "moments"),
    countOwnedCollection(user.uid, "walletEvents")
  ]);
  return {
    ...profile,
    mobileStats: {
      contacts,
      threads,
      moments,
      walletEvents
    }
  };
}

export function watchLiveAuth(onProfile, onError) {
  return onAuthStateChanged(auth, async (user) => {
    try {
      onProfile(user ? await loadLiveProfile(user) : null);
    } catch (error) {
      onError?.(authErrorMessage(error));
    }
  });
}

export async function signInLiveProfile({ route, draft }) {
  try {
    const credential = await signInWithEmailAndPassword(auth, normalizeEmail(draft.email), String(draft.password || ""));
    const profile = await loadLiveProfile(credential.user);
    const management = hasFoxHubManagementAccess(profile);
    if (route === "management" && !management) throw new Error("Not Permitted.");
    if (route !== "management" && management) throw new Error("Not Permitted.");
    return profile;
  } catch (error) {
    if (error?.message === "Not Permitted.") throw error;
    throw new Error(authErrorMessage(error));
  }
}

export async function createLiveProfile({ route, draft }) {
  const email = normalizeEmail(draft.email);
  if (route === "management") throw new Error("Not Permitted.");
  if (isFoxHubDomainEmail(email) || OWNER_EMAILS.has(email)) throw new Error("Not Permitted.");
  if (!isStrongSignupPassword(draft.password)) throw new Error("Use a stronger password for FoxHub.");
  if (!isAtLeast18(draft.birthDate)) throw new Error("FoxHub membership requires 18+ age verification.");

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, String(draft.password || ""));
    const displayName = String(draft.name || "").trim() || "FoxHub Member";
    await updateProfile(credential.user, { displayName });
    const profileRef = doc(db, "users", credential.user.uid);
    const existingSnapshot = await getDoc(profileRef);
    await setDoc(profileRef, buildProfileWrite(credential.user, draft, existingSnapshot.exists() ? existingSnapshot.data() : {}), { merge: true });
    return loadLiveProfile(credential.user);
  } catch (error) {
    if (error?.message === "Not Permitted.") throw error;
    throw new Error(authErrorMessage(error));
  }
}

export async function signOutLiveProfile() {
  await signOut(auth);
}
