import { isAcceptedImageDataUrl, normalizeImageType } from "./mediaUploads.js";
import { validateCaptchaProof } from "./captchaGuard.js";
import {
  GoogleAuthProvider,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  deleteUser,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  verifyPasswordResetCode
} from "firebase/auth";
import { addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp, writeBatch, where } from "firebase/firestore";
import {
  channels,
  circles,
  contacts,
  friendRequests,
  shortVideos,
  storyBundles,
  auctionLots,
  bidEvents,
  carts,
  fulfillmentOrders,
  shopProfiles,
  shopReviews,
  ratingRecords,
  ratingModerationQueue,
  reputationSnapshots,
  routePlans,
  professionalIdentities,
  endorsements,
  jobPosts,
  resumeEntries,
  miniProgramManifests,
  runtimeSessions,
  callSessions,
  callLogs,
  defaultProfile,
  invites,
  favorites,
  apiConnectors,
  listings,
  savedSearches,
  listingAlerts,
  miniAppPermissions,
  miniAppRecents,
  moderationCases,
  verificationCases,
  merchantSettlements,
  merchantPayoutControls,
  merchantLocations,
  compliancePrograms,
  trustSafetyIncidents,
  merchantOnboardingQueue,
  merchantRiskSignals,
  disputeCases,
  auditEvents,
  notificationEvents,
  deviceSessions,
  documentVault,
  operatorActions,
  operatorAccessRecords,
  notificationSubscriptions,
  moments,
  officialAccounts,
  officialAccountSubscriptions,
  officialPosts,
  peopleNearby,
  channelStreams,
  shakeMatches,
  fileTransfers,
  communityChannels,
  creatorOrders,
  demandSignals,
  localListings,
  reviewInsights,
  storyHighlights,
  qrActions,
  qrHistory,
  savedItems,
  searchScopes,
  serviceContinuity,
  services,
  threads,
  utilityCards,
  utilityBillPayPayments,
  utilityBillPayProviders,
  userSegments,
  userRecords,
  threadReadState,
  walletEvents
} from "./data.js";
import { auth, db } from "./firebase.js";
import { resolveProfileOneId } from "./identity.js";
import { publicEnv } from "./public-env.js";
import { getFoxHubReservedEmailBlockMessage, hasFoxHubManagementAccess, isAtLeast18, isFoxHubDomainEmail, isFoxHubOwnerEmail, normalizeZipCode } from "./rules.js";

const PROFILE_SCHEMA_VERSION = 4;
const STAFF_SCHEMA_VERSION = 1;
const INVITE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;
const MAGIC_LINK_STORAGE_KEY = "foxhub-email-link";
const RESERVED_EMAIL_ATTEMPTS_KEY = "foxhub-reserved-email-attempts";
const SIGN_IN_PATH = "/signin";
const DEBUG_REPOSITORY_WRITES = typeof process !== "undefined" && process.env?.FOXHUB_REPOSITORY_DEBUG === "1";

function debugRepositoryWrite(label) {
  if (DEBUG_REPOSITORY_WRITES) {
    console.log(`repository-firebase:${label}`);
  }
}
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
const USER_STATE_PRIMITIVE_FIELDS = ["activeCircleId", "activeMiniAppId", "selectedThreadId"];
const PROFILE_FIELDS = [
  "name",
  "displayName",
  "oneId",
  "handle",
  "city",
  "zipCode",
  "postalCode",
  "bio",
  "occupation",
  "demographic",
  "pronouns",
  "website",
  "availability",
  "interests",
  "profilePhoto",
  "profilePhotoUrl",
  "profilePhotoName",
  "profilePhotoType",
  "email",
  "onboarded",
  "accessState",
  "accessNote",
  "inviteCode",
  "sponsorHandle",
  "waitlistEndsAt",
  "tutorialCompleted",
  "verifiedPerformerSubscribed",
  "verifiedPerformerStatus",
  "verifiedPerformerPlan",
  "verifiedPerformerSince",
  "presenceState",
  "lastSeenAt",
  "lastActiveAt",
  "authMethod",
  "schemaVersion",
  "createdAt",
  "updatedAt"
];
let lastSavedUserStateSignature = "";
let lastSavedContactsSignature = "";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableSerialize(value) {
  return JSON.stringify(value);
}

function sanitizeText(value = "", max = 280) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}

function sanitizeEmail(value = "") {
  return sanitizeText(value, 160).toLowerCase();
}

function firstProfileValue(existingValue, draftValue, fallbackValue = "", max = 280) {
  const draftText = sanitizeText(draftValue, max);
  if (draftText) return draftText;
  const existingText = sanitizeText(existingValue, max);
  if (existingText) return existingText;
  return sanitizeText(fallbackValue, max);
}

function firstProfileHandle(existingValue, draftValue) {
  return normalizeHandle(draftValue) || normalizeHandle(existingValue);
}

function isStaffProfile(profile = {}, email = "") {
  const normalizedEmail = sanitizeEmail(email || profile.email || "");
  return hasFoxHubManagementAccess({ ...profile, email: normalizedEmail });
}

function resolveAccountEmail(profile = {}, authUser = null) {
  const authEmail = sanitizeEmail(authUser?.email || "");
  const profileEmail = sanitizeEmail(profile.email || "");
  if (!isStaffProfile(profile, authEmail || profileEmail) && isFoxHubDomainEmail(profileEmail) && authEmail && !isFoxHubDomainEmail(authEmail)) {
    return authEmail;
  }
  return authEmail || profileEmail;
}

function readReservedEmailAttempts() {
  try {
    return JSON.parse(localStorage.getItem(RESERVED_EMAIL_ATTEMPTS_KEY) || "{}");
  } catch {
    return {};
  }
}

function recordReservedEmailAttempt(email = "") {
  const key = sanitizeEmail(email);
  if (!key) return 1;
  const records = readReservedEmailAttempts();
  const attempts = Number(records[key] || 0) + 1;
  records[key] = attempts;
  try {
    localStorage.setItem(RESERVED_EMAIL_ATTEMPTS_KEY, JSON.stringify(records));
  } catch {
    // Local storage may be unavailable in a locked-down browser; still block this request.
  }
  return attempts;
}

function normalizeHandle(handle = "") {
  const cleaned = String(handle).replace(/[^A-Za-z0-9_.]/g, "").slice(0, 39);
  if (!cleaned) return "";
  return cleaned.startsWith("@") ? cleaned : `@${cleaned}`;
}

function sanitizeInviteCode(value = "") {
  return String(value).replace(/[^A-Za-z0-9-]/g, "").toUpperCase().slice(0, 24);
}

function normalizeSponsorHandle(handle = "") {
  const cleaned = String(handle).replace(/[^A-Za-z0-9_.]/g, "").slice(0, 39);
  if (!cleaned) return "";
  return cleaned.startsWith("@") ? cleaned : `@${cleaned}`;
}

function mergeSeedContact(contact = {}) {
  const seedContact = contacts.find((item) => item.id === contact.id);
  return seedContact ? { ...seedContact, ...contact } : contact;
}

function currentTimestampIso() {
  return new Date().toISOString();
}

function normalizePresenceState(value = "") {
  const normalized = sanitizeText(value, 24).toLowerCase();
  return ["online", "focus", "away", "offline"].includes(normalized) ? normalized : "away";
}

const FOUNDER_PROFILE_FILLER = {
  name: "FoxHub Founder",
  handle: "@founder",
  city: "Atlanta",
  bio: "Founder-level management account for FoxHub staff review, member approvals, and moderation oversight.",
  occupation: "Founder",
  demographic: "FoxHub management"
};

function scrubFounderProfileFiller(profile = {}) {
  return {
    ...profile,
    name: sanitizeText(profile.name, 80) === FOUNDER_PROFILE_FILLER.name ? "" : profile.name,
    displayName: sanitizeText(profile.displayName, 80) === FOUNDER_PROFILE_FILLER.name ? "" : profile.displayName,
    handle: normalizeHandle(profile.handle) === FOUNDER_PROFILE_FILLER.handle ? "" : profile.handle,
    city: sanitizeText(profile.city, 80) === FOUNDER_PROFILE_FILLER.city ? "" : profile.city,
    bio: sanitizeText(profile.bio, 280) === FOUNDER_PROFILE_FILLER.bio ? "" : profile.bio,
    occupation: sanitizeText(profile.occupation, 80) === FOUNDER_PROFILE_FILLER.occupation ? "" : profile.occupation,
    demographic: sanitizeText(profile.demographic, 80) === FOUNDER_PROFILE_FILLER.demographic ? "" : profile.demographic
  };
}

function buildUserRecordSnapshot(profile = {}, authUser = null) {
  const email = resolveAccountEmail(profile, authUser);
  const handle = normalizeHandle(profile.handle) || "@foxhub";
  const displayName = sanitizeText(profile.name || profile.displayName || handle, 80);
  const now = currentTimestampIso();
  return {
    id: `self-${authUser?.uid || "local"}`,
    contactId: authUser?.uid || "self",
    oneId: resolveProfileOneId(profile, authUser),
    accountType: "member",
    segment: profile.accessState === "priority" ? "priority access" : "member",
    stage: profile.onboarded ? "active" : "review",
    owner: "FoxHub",
    trustScore: profile.accessState === "priority" ? 90 : profile.onboarded ? 78 : 54,
    walletVolume30d: "$0",
    lifetimeValue: "$0",
    lastOrder: "No wallet orders yet",
    lastActivity: `Profile synced ${now}`,
    acquisitionSource: profile.inviteCode ? "invite" : "direct signup",
    preferredChannel: "chat",
    paymentStatus: "not_started",
    riskState: "monitor",
    consentState: "verified",
    identityState: profile.onboarded ? "verified" : "review",
    walletState: "inactive",
    supportTier: profile.accessState === "priority" ? "priority" : "standard",
    engagementScore: profile.onboarded ? 65 : 32,
    referralCount: 0,
    deviceCount: 1,
    messageVolume30d: "0",
    circleCount: 0,
    savedCount: 0,
    notes: "Auto-synced user record.",
    tags: [profile.accessState || "active", profile.onboarded ? "onboarded" : "pending"],
    timeline: ["Account created", "Profile synced"],
    profile: {
      displayName,
      legalName: displayName || "",
      oneId: resolveProfileOneId(profile, authUser),
      email,
      phone: "",
      city: profile.city || "",
      region: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      joinDate: now.slice(0, 10),
      language: typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US"
    },
    verification: {
      identity: profile.onboarded ? "passed" : "review",
      merchant: "n/a",
      payout: "review",
      riskReview: "monitor"
    },
    preferences: {
      notifications: "important only",
      privacy: "contacts first",
      discovery: "local and trusted",
      payments: "not configured"
    },
    relationship: {
      acquisitionSource: profile.inviteCode ? "invite" : "direct signup",
      referrer: profile.sponsorHandle || "",
      owner: "FoxHub",
      preferredSurface: "chat",
      nextBestAction: profile.onboarded ? "start a thread" : "finish onboarding"
    },
    businessProfile: {
      businessType: profile.occupation || "member",
      organization: "",
      website: "",
      payoutMethod: "not configured"
    },
    security: {
      mfa: "not configured",
      deviceTrust: "medium",
      lastDevice: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "web",
      lastIpRegion: profile.city || "Unknown"
    }
  };
}

function buildInviteConnectionContact(contactId = "", profile = {}, fallback = {}) {
  const email = sanitizeEmail(profile.email || fallback.email || "");
  const handle = normalizeHandle(profile.handle || fallback.handle || (email ? email.split("@")[0] : "member")) || "@member";
  const name = sanitizeText(profile.name || profile.displayName || fallback.name || handle, 80) || "FoxHub Member";
  return {
    id: sanitizeText(contactId || profile.uid || profile.id || email || handle, 120),
    name,
    handle,
      displayName: sanitizeText(name || profile.displayName, 80),
    legalName: "",
    email,
    phone: "",
    city: sanitizeText(profile.city || fallback.city || "Unknown", 80) || "Unknown",
    region: "",
    status: "invite approved",
    accountType: sanitizeText(profile.accountType || "member", 40),
    trust: "trusted",
    trustTier: "B",
    peerRatingAverage: 4,
    peerRatingCount: 1,
    myPeerRating: "B",
    verificationLevel: "invite approved",
    presenceState: "away",
    lastActiveLabel: "connected by invite approval",
    tier: "member",
    customerStage: "active",
    relationshipScore: 74,
    lifetimeValue: "$0",
    lastTransaction: "No transactions yet",
    preferredSurface: "circles",
    tags: ["invite", "approved", "new connection"],
    joinDate: currentTimestampIso().slice(0, 10),
    referralSource: "sponsor invite",
    walletState: "inactive",
    payoutMethod: "",
    supportTier: "standard"
  };
}

function buildStaffMemberSnapshot(profile = {}, authUser = null, operatorAccess = null, existingStaff = null) {
  const email = sanitizeEmail(authUser?.email || profile.email || operatorAccess?.email || "");
  const role = sanitizeText(operatorAccess?.role || profile.role || (isFoxHubOwnerEmail(email) ? "founder" : "staff"), 32).toLowerCase();
  const scopes = Array.isArray(operatorAccess?.scopes) ? operatorAccess.scopes.map((scope) => sanitizeText(scope, 40)).filter(Boolean).slice(0, 24) : [];
  const now = currentTimestampIso();

  return {
    schemaVersion: STAFF_SCHEMA_VERSION,
    uid: authUser?.uid || operatorAccess?.userId || "",
    email,
    name: sanitizeText(profile.name || authUser?.displayName || "FoxHub Staff", 80),
    handle: normalizeHandle(profile.handle || email.split("@")[0] || "staff"),
    oneId: sanitizeText(resolveProfileOneId(profile, authUser), 32),
    city: sanitizeText(profile.city || "", 80),
    department: sanitizeText(profile.department || (role === "founder" || role === "owner" ? "Executive" : "Operations"), 80),
    title: sanitizeText(profile.title || profile.occupation || (role === "founder" || role === "owner" ? "Founder" : "Staff"), 80),
    role,
    employmentStatus: "active",
    accountType: "staff",
    founder: role === "founder" || isFoxHubOwnerEmail(email) || operatorAccess?.role === "owner",
    managementAccess: true,
    staffAccess: true,
    operatorAccessRef: authUser?.uid ? `operatorAccess/${authUser.uid}` : "",
    memberProfileRef: authUser?.uid ? `users/${authUser.uid}` : "",
    accessState: sanitizeText(profile.accessState || "priority", 24),
    scopes,
    lastSeenAt: sanitizeText(profile.lastSeenAt || now, 64),
    lastActiveAt: sanitizeText(profile.lastActiveAt || now, 64),
    createdAt: existingStaff?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

function canonicalUserProfile(profile = {}, authUser = null) {
  const email = resolveAccountEmail(profile, authUser);
  const profilePhotoUrl = isAcceptedImageDataUrl(profile.profilePhoto?.url || profile.profilePhotoUrl)
    ? String(profile.profilePhoto?.url || profile.profilePhotoUrl)
    : "";
  const profilePhoto = profilePhotoUrl
    ? {
        id: sanitizeText(profile.profilePhoto?.id || "profile-photo", 80),
        name: sanitizeText(profile.profilePhoto?.name || profile.profilePhotoName || "Profile photo", 120),
        type: sanitizeText(normalizeImageType(profile.profilePhoto || { type: profile.profilePhotoType }) || profile.profilePhotoType || "image", 80),
        url: profilePhotoUrl,
        size: Number(profile.profilePhoto?.size || 0)
      }
    : null;
  const founderManager =
    isFoxHubOwnerEmail(email) ||
    profile.role === "founder" ||
    profile.role === "owner";
  if (founderManager) {
    const publicProfile = scrubFounderProfileFiller(profile);
    const displayName = sanitizeText(publicProfile.name || publicProfile.displayName || "", 80);
    return {
      oneId: sanitizeText(resolveProfileOneId({ ...publicProfile, email }, authUser), 32),
      name: displayName,
      displayName,
      handle: normalizeHandle(publicProfile.handle || ""),
      city: sanitizeText(publicProfile.city || "", 80),
      zipCode: normalizeZipCode(publicProfile.zipCode || publicProfile.postalCode || ""),
      postalCode: normalizeZipCode(publicProfile.zipCode || publicProfile.postalCode || ""),
      bio: sanitizeText(publicProfile.bio || "", 280),
      occupation: sanitizeText(publicProfile.occupation || "", 80),
      demographic: sanitizeText(publicProfile.demographic || "", 80),
      pronouns: sanitizeText(publicProfile.pronouns || "", 40),
      website: sanitizeText(publicProfile.website || "", 120),
      availability: sanitizeText(publicProfile.availability || "", 80),
      interests: sanitizeText(publicProfile.interests || "", 160),
      profilePhoto,
      profilePhotoUrl,
      profilePhotoName: profilePhoto?.name || "",
      profilePhotoType: profilePhoto?.type || "",
      email,
      onboarded: true,
      accessState: "priority",
      accessNote: sanitizeText(profile.accessNote || "Founder management access", 80),
      inviteCode: sanitizeInviteCode(profile.inviteCode),
      sponsorHandle: normalizeSponsorHandle(profile.sponsorHandle),
      waitlistEndsAt: "",
      tutorialCompleted: true,
      verifiedPerformerSubscribed: Boolean(profile.verifiedPerformerSubscribed),
      verifiedPerformerStatus: sanitizeText(profile.verifiedPerformerStatus || "not_subscribed", 32),
      verifiedPerformerPlan: sanitizeText(profile.verifiedPerformerPlan || "$20/month", 32),
      verifiedPerformerSince: sanitizeText(profile.verifiedPerformerSince || "", 64),
      ageVerified: Boolean(profile.ageVerified),
      ageVerifiedAt: sanitizeText(profile.ageVerifiedAt || "", 64),
      presenceState: normalizePresenceState(profile.presenceState || "online"),
      lastSeenAt: sanitizeText(profile.lastSeenAt || "", 64),
      lastActiveAt: sanitizeText(profile.lastActiveAt || profile.lastSeenAt || "", 64),
      authMethod: sanitizeText(profile.authMethod || "password", 32),
      role: "founder",
      managerAccess: true,
      staffAccess: true,
      schemaVersion: PROFILE_SCHEMA_VERSION
    };
  }
  const accessState = sanitizeText(profile.accessState || (profile.onboarded ? "active" : "waitlist"), 24) || "active";
  const lastSeenAt = sanitizeText(profile.lastSeenAt || "", 64);
  const lastActiveAt = sanitizeText(profile.lastActiveAt || lastSeenAt || "", 64);
  const displayName = sanitizeText(profile.name || profile.displayName, 80);
  return {
    oneId: sanitizeText(resolveProfileOneId(profile, authUser), 32),
    name: displayName,
    displayName,
    handle: normalizeHandle(profile.handle),
    city: sanitizeText(profile.city, 80),
    zipCode: normalizeZipCode(profile.zipCode || profile.postalCode),
    postalCode: normalizeZipCode(profile.zipCode || profile.postalCode),
    bio: sanitizeText(profile.bio || defaultProfile.bio, 280),
    occupation: sanitizeText(profile.occupation || "", 80),
    demographic: sanitizeText(profile.demographic || "", 80),
    pronouns: sanitizeText(profile.pronouns || "", 40),
    website: sanitizeText(profile.website || "", 120),
    availability: sanitizeText(profile.availability || "", 80),
    interests: sanitizeText(profile.interests || "", 160),
    profilePhoto,
    profilePhotoUrl,
    profilePhotoName: profilePhoto?.name || "",
    profilePhotoType: profilePhoto?.type || "",
    email,
    onboarded: Boolean(profile.onboarded),
    accessState,
    accessNote: sanitizeText(profile.accessNote || (accessState === "waitlist" ? "Monthly verification review" : accessState === "priority" ? "Priority access" : "Active"), 80),
    inviteCode: sanitizeInviteCode(profile.inviteCode),
    sponsorHandle: normalizeSponsorHandle(profile.sponsorHandle),
    waitlistEndsAt: sanitizeText(profile.waitlistEndsAt || "", 64),
    tutorialCompleted: Boolean(profile.tutorialCompleted),
    verifiedPerformerSubscribed: Boolean(profile.verifiedPerformerSubscribed),
    verifiedPerformerStatus: sanitizeText(profile.verifiedPerformerStatus || "not_subscribed", 32),
    verifiedPerformerPlan: sanitizeText(profile.verifiedPerformerPlan || "$20/month", 32),
    verifiedPerformerSince: sanitizeText(profile.verifiedPerformerSince || "", 64),
    ageVerified: Boolean(profile.ageVerified),
    ageVerifiedAt: sanitizeText(profile.ageVerifiedAt || "", 64),
    presenceState: normalizePresenceState(profile.presenceState || (profile.onboarded ? "online" : "away")),
    lastSeenAt,
    lastActiveAt,
    authMethod: sanitizeText(profile.authMethod || "password", 32),
    schemaVersion: PROFILE_SCHEMA_VERSION
  };
}

function inviteExpiresAtMillis(invite = {}) {
  const value = invite.expiresAt;
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isInviteExpired(invite = {}, now = Date.now()) {
  return inviteExpiresAtMillis(invite) <= now;
}

function buildProfileWrite(profile = {}, authUser = null, existingProfile = null) {
  return {
    ...canonicalUserProfile(profile, authUser),
    createdAt: existingProfile?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
    mechanicsUpdatedAt: serverTimestamp()
  };
}

function profileNeedsRepair(existingProfile, authUser = null) {
  if (!existingProfile) return true;

  const nextProfile = canonicalUserProfile(existingProfile, authUser);
  const managedFields = ["oneId", "name", "displayName", "handle", "city", "zipCode", "postalCode", "bio", "occupation", "demographic", "pronouns", "website", "availability", "interests", "profilePhotoUrl", "profilePhotoName", "profilePhotoType", "email", "onboarded", "accessState", "accessNote", "inviteCode", "sponsorHandle", "waitlistEndsAt", "tutorialCompleted", "verifiedPerformerSubscribed", "verifiedPerformerStatus", "verifiedPerformerPlan", "verifiedPerformerSince", "ageVerified", "ageVerifiedAt", "presenceState", "lastSeenAt", "lastActiveAt", "authMethod", "schemaVersion"];

  if (!existingProfile.createdAt) return true;

  return managedFields.some((field) => existingProfile[field] !== nextProfile[field]);
}

function pickPersistedUserState(state = {}) {
  const payload = {};

  USER_STATE_ARRAY_FIELDS.forEach((field) => {
    payload[field] = Array.isArray(state[field]) ? clone(state[field]) : [];
  });

  USER_STATE_PRIMITIVE_FIELDS.forEach((field) => {
    if (typeof state[field] === "string" && state[field]) {
      payload[field] = state[field];
    }
  });

  return payload;
}

function pickProfileFields(data = {}, fallbackProfile = defaultProfile) {
  const profile = { ...fallbackProfile };
  PROFILE_FIELDS.forEach((field) => {
    if (data[field] !== undefined) {
      profile[field] = data[field];
    }
  });
  profile.displayName = sanitizeText(profile.displayName || profile.name || "", 80);
  profile.name = sanitizeText(profile.name || profile.displayName || "", 80);
  profile.handle = profile.handle || "";
  return profile;
}

function mergePersistedUserState(currentState, data = {}) {
  const nextState = {
    ...currentState,
    authenticated: Boolean(data.onboarded),
    profile: pickProfileFields(data, currentState.profile)
  };

  USER_STATE_ARRAY_FIELDS.forEach((field) => {
    if (Array.isArray(data[field])) {
      nextState[field] = data[field];
    }
  });

  USER_STATE_PRIMITIVE_FIELDS.forEach((field) => {
    if (typeof data[field] === "string" && data[field]) {
      nextState[field] = data[field];
    }
  });

  return nextState;
}

async function persistContacts(uid, nextContacts = []) {
  const signature = stableSerialize(nextContacts);
  if (signature === lastSavedContactsSignature) return;

  const batch = writeBatch(db);
  nextContacts.forEach((contact) => {
    batch.set(doc(db, "users", uid, "contacts", contact.id), clone(contact), { merge: true });
  });
  await batch.commit();

  lastSavedContactsSignature = signature;
}

async function updateThreadMetadata(uid, threadId, fields = {}) {
  const payload = { ...fields };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  if (Object.keys(payload).length === 0) return;
  await setDoc(doc(db, "users", uid, "threads", threadId), payload, { merge: true });
}

function createSeedState() {
  return {
    profile: clone(defaultProfile),
    authenticated: false,
    threads: clone(threads),
    contacts: clone(contacts),
    friendRequests: clone(friendRequests),
    shortVideos: clone(shortVideos),
    storyBundles: clone(storyBundles),
    auctionLots: clone(auctionLots),
    bidEvents: clone(bidEvents),
    carts: clone(carts),
    fulfillmentOrders: clone(fulfillmentOrders),
    shopProfiles: clone(shopProfiles),
    shopReviews: clone(shopReviews),
    ratingRecords: clone(ratingRecords),
    ratingModerationQueue: clone(ratingModerationQueue),
    reputationSnapshots: clone(reputationSnapshots),
    routePlans: clone(routePlans),
    professionalIdentities: clone(professionalIdentities),
    endorsements: clone(endorsements),
    jobPosts: clone(jobPosts),
    resumeEntries: clone(resumeEntries),
    miniProgramManifests: clone(miniProgramManifests),
    runtimeSessions: clone(runtimeSessions),
    callSessions: clone(callSessions),
    callLogs: clone(callLogs),
    invites: clone(invites),
    userRecords: clone(userRecords),
    circles: clone(circles),
    walletEvents: clone(walletEvents),
    moderationCases: clone(moderationCases),
    verificationCases: clone(verificationCases),
    merchantSettlements: clone(merchantSettlements),
    merchantPayoutControls: clone(merchantPayoutControls),
    merchantLocations: clone(merchantLocations),
    compliancePrograms: clone(compliancePrograms),
    trustSafetyIncidents: clone(trustSafetyIncidents),
    merchantOnboardingQueue: clone(merchantOnboardingQueue),
    merchantRiskSignals: clone(merchantRiskSignals),
    disputeCases: clone(disputeCases),
    auditEvents: clone(auditEvents),
    notificationEvents: clone(notificationEvents),
    deviceSessions: clone(deviceSessions),
    documentVault: clone(documentVault),
    operatorActions: clone(operatorActions),
    operatorAccessRecords: clone(operatorAccessRecords),
    notificationSubscriptions: clone(notificationSubscriptions),
    blockedUsers: [],
    moments: clone(moments),
    channels: clone(channels),
    officialAccounts: clone(officialAccounts),
    officialAccountSubscriptions: clone(officialAccountSubscriptions),
    officialPosts: clone(officialPosts),
    peopleNearby: clone(peopleNearby),
    channelStreams: clone(channelStreams),
    shakeMatches: clone(shakeMatches),
    fileTransfers: clone(fileTransfers),
    communityChannels: clone(communityChannels),
    creatorOrders: clone(creatorOrders),
    localListings: clone(localListings),
    demandSignals: clone(demandSignals),
    storyHighlights: clone(storyHighlights),
    reviewInsights: clone(reviewInsights),
    apiConnectors: clone(apiConnectors),
    searchScopes: clone(searchScopes),
    services: clone(services),
    utilityCards: clone(utilityCards),
    utilityBillPayProviders: clone(utilityBillPayProviders),
    utilityBillPayPayments: clone(utilityBillPayPayments),
    userSegments: clone(userSegments),
    favorites: clone(favorites),
    savedItems: clone(savedItems),
    threadReadState: clone(threadReadState),
    miniAppRecents: clone(miniAppRecents),
    miniAppPermissions: clone(miniAppPermissions),
    qrActions: clone(qrActions),
    qrHistory: clone(qrHistory),
    serviceContinuity: clone(serviceContinuity),
    listings: clone(listings),
    savedSearches: clone(savedSearches),
    listingAlerts: clone(listingAlerts),
    activeCircleId: circles[0].id,
    activeMiniAppId: "splittab",
    selectedThreadId: threads[0].id,
    staffMemberRecord: null,
    backendMode: "firebase"
  };
}

async function ensureFirebaseUser() {
  return auth?.currentUser || null;
}

async function persistUserRecordSnapshot(uid, profile = {}, authUser = null) {
  const record = buildUserRecordSnapshot(profile, authUser);
  debugRepositoryWrite("persistUserRecordSnapshot");
  await setDoc(doc(db, "users", uid), { userRecords: [record], mechanicsUpdatedAt: serverTimestamp() }, { merge: true });
  return record;
}

async function ensureOperatorAccessDocument(uid, authUser = null) {
  const accessRef = doc(db, "operatorAccess", uid);
  const accessSnap = await getDoc(accessRef);
  const tokenResult = authUser?.getIdTokenResult ? await authUser.getIdTokenResult(true) : null;
  const founderOwner =
    tokenResult?.claims?.owner === true ||
    tokenResult?.claims?.founder === true ||
    isFoxHubOwnerEmail(authUser?.email || "");
  if (tokenResult?.claims?.platformOperator !== true && !founderOwner) return null;
  const ownerScopes = ["*", "owner", "admin", "management", "members", "verification", "moderation", "billing", "documents", "notifications", "settings", "security", "operators"];

  if (accessSnap.exists()) {
    const existingAccess = accessSnap.data();
    if (!founderOwner) return existingAccess;

    const existingScopes = Array.isArray(existingAccess.scopes) ? existingAccess.scopes : [];
    if (existingAccess.role === "owner" && existingScopes.includes("*")) return existingAccess;

    const ownerPatch = {
      userId: uid,
      email: sanitizeEmail(authUser?.email || existingAccess.email || ""),
      role: "owner",
      scopes: ownerScopes,
      state: "active",
      grantedAt: existingAccess.grantedAt || serverTimestamp(),
      grantedBy: existingAccess.grantedBy || "system",
      updatedAt: serverTimestamp()
    };
    debugRepositoryWrite("operatorAccess.ownerPatch");
    await setDoc(accessRef, ownerPatch, { merge: true });
    return { ...existingAccess, ...ownerPatch };
  }

  const record = {
    userId: uid,
    email: sanitizeEmail(authUser?.email || ""),
    role: founderOwner ? "owner" : "reviewer",
    scopes: founderOwner ? ownerScopes : ["verification", "moderation", "documents", "notifications"],
    state: "active",
    grantedAt: serverTimestamp(),
    grantedBy: "system"
  };
  debugRepositoryWrite("operatorAccess.create");
  await setDoc(accessRef, record, { merge: true });
  return record;
}

async function ensureStaffMemberDocument(uid, profile = {}, authUser = null, operatorAccess = null) {
  if (!operatorAccess && !profile?.staffAccess && !profile?.managerAccess && profile?.role !== "founder") return null;
  const staffRef = doc(db, "staffMembers", uid);
  const staffSnap = await getDoc(staffRef);
  const staffRecord = buildStaffMemberSnapshot(profile, authUser, operatorAccess, staffSnap.exists() ? staffSnap.data() : null);
  debugRepositoryWrite("staffMembers.upsert");
  await setDoc(staffRef, staffRecord, { merge: true });
  return staffRecord;
}

async function ensureFirebaseSeed(uid) {
  const profileRef = doc(db, "users", uid);
  const profileSnap = await getDoc(profileRef);
  const authUser = await ensureFirebaseUser();

  if (!profileSnap.exists()) {
    const seed = createSeedState();
    const batch = writeBatch(db);

    batch.set(profileRef, {
      ...buildProfileWrite(
        {
          name: "",
          handle: "",
          city: "",
          bio: defaultProfile.bio,
          occupation: "",
          demographic: "",
          onboarded: false,
          accessState: "active",
          accessNote: "Open access",
          inviteCode: "",
          sponsorHandle: "",
          waitlistEndsAt: "",
          presenceState: "away",
          lastSeenAt: "",
          lastActiveAt: "",
          authMethod: "password"
        },
        authUser
      ),
      ...pickPersistedUserState(seed),
      mechanicsUpdatedAt: serverTimestamp()
    });

    seed.contacts.forEach((contact) => {
      batch.set(doc(db, "users", uid, "contacts", contact.id), contact);
    });
    seed.circles.forEach((circle) => {
      batch.set(doc(db, "users", uid, "circles", circle.id), circle);
    });
    seed.channels.forEach((channel) => {
      batch.set(doc(db, "users", uid, "channels", channel.id), channel);
    });
    seed.walletEvents.forEach((event) => {
      batch.set(doc(db, "users", uid, "walletEvents", String(event.id)), event);
    });
    seed.moments.forEach((moment) => {
      batch.set(doc(db, "users", uid, "moments", String(moment.id)), moment);
    });
    seed.threads.forEach((thread) => {
      const { messages, ...threadData } = thread;
      batch.set(doc(db, "users", uid, "threads", thread.id), threadData);
      messages.forEach((message) => {
        batch.set(doc(db, "users", uid, "threads", thread.id, "messages", String(message.id)), message);
      });
    });

    debugRepositoryWrite("ensureFirebaseSeed.initialBatch");
    await batch.commit();
    await persistUserRecordSnapshot(
      uid,
      canonicalUserProfile(
        {
          ...seed.profile,
          onboarded: false,
          accessState: "active",
          accessNote: "Open access",
          authMethod: "password"
        },
        authUser
      ),
      authUser
    );
    const operatorAccess = await ensureOperatorAccessDocument(uid, authUser);
    await ensureStaffMemberDocument(uid, canonicalUserProfile({ ...seed.profile, onboarded: false, accessState: "active", accessNote: "Open access", authMethod: "password" }, authUser), authUser, operatorAccess);
    return;
  }

  const existingProfile = profileSnap.data() || {};
  const repairPayload = {};

  if (profileNeedsRepair(existingProfile, authUser)) {
    Object.assign(repairPayload, buildProfileWrite(existingProfile, authUser, existingProfile));
  }

  const seed = createSeedState();
  const persistedSeedState = pickPersistedUserState(seed);
  USER_STATE_ARRAY_FIELDS.forEach((field) => {
    if (!Array.isArray(existingProfile[field])) {
      repairPayload[field] = persistedSeedState[field];
    }
  });
  USER_STATE_PRIMITIVE_FIELDS.forEach((field) => {
    if (typeof existingProfile[field] !== "string" || !existingProfile[field]) {
      repairPayload[field] = persistedSeedState[field];
    }
  });

  if (Object.keys(repairPayload).length > 0) {
    repairPayload.mechanicsUpdatedAt = serverTimestamp();
    debugRepositoryWrite("ensureFirebaseSeed.repairProfile");
    await setDoc(profileRef, repairPayload, { merge: true });
  }

  const mergedProfile = canonicalUserProfile({ ...existingProfile, ...repairPayload }, authUser);
  await persistUserRecordSnapshot(uid, mergedProfile, authUser);
  const operatorAccess = await ensureOperatorAccessDocument(uid, authUser);
  await ensureStaffMemberDocument(uid, mergedProfile, authUser, operatorAccess);
}

export async function loadState() {
  if (typeof window !== "undefined" && isSignInWithEmailLink(auth, window.location.href)) {
    const storedEmail = window.localStorage.getItem(MAGIC_LINK_STORAGE_KEY) || "";
    if (storedEmail) {
      try {
        await signInWithEmailLink(auth, storedEmail, window.location.href);
        window.localStorage.removeItem(MAGIC_LINK_STORAGE_KEY);
      } catch {
        // Leave normal auth flows available if the link cannot be completed.
      }
    }
  }
  const user = await ensureFirebaseUser();
  if (!user) return createSeedState();
  await ensureFirebaseSeed(user.uid);
  const snap = await getDoc(doc(db, "users", user.uid));
  const staffSnap = await getDoc(doc(db, "staffMembers", user.uid));
  return {
    ...mergePersistedUserState(createSeedState(), snap.data() || {}),
    staffMemberRecord: staffSnap.exists() ? { id: staffSnap.id, ...staffSnap.data() } : null
  };
}

export async function saveState(state) {
  const user = await ensureFirebaseUser();
  if (!user?.uid || state?.backendMode !== "firebase") return;

  const persistedUserState = pickPersistedUserState(state);
  const userSignature = stableSerialize(persistedUserState);

  if (userSignature !== lastSavedUserStateSignature) {
    await setDoc(
      doc(db, "users", user.uid),
      {
        ...persistedUserState,
        mechanicsUpdatedAt: serverTimestamp()
      },
      { merge: true }
    );
    lastSavedUserStateSignature = userSignature;
  }

  if (Array.isArray(state.contacts)) {
    await persistContacts(user.uid, state.contacts);
  }
}

export async function signInProfile(profileDraft) {
  const email = profileDraft.email?.trim() || "";
  const password = profileDraft.password || "";
  const authMode = profileDraft.authMode || "signup";
  if (!email || !password) {
    throw new Error("Email and password are required.");
  }
  if (authMode === "signup" && isFoxHubDomainEmail(email)) {
    const attempts = recordReservedEmailAttempt(email);
    throw new Error(getFoxHubReservedEmailBlockMessage(attempts));
  }
  if (authMode === "signup") {
    const captchaError = validateCaptchaProof(profileDraft);
    if (captchaError) throw new Error(captchaError);
  }
  if (authMode === "signup" && !isAtLeast18(profileDraft.birthDate)) {
    throw new Error("You must be 18 or older to create a FoxHub account.");
  }

  let userCredential;
  let inviteRef = null;
  let inviteData = null;
  if (authMode === "signin") {
    userCredential = await signInWithEmailAndPassword(auth, email, password);
  } else {
    const requestedAccessState = sanitizeText(profileDraft.accessState || "active", 24) || "active";
    const inviteCode = sanitizeInviteCode(profileDraft.inviteCode);
    const wantsInviteAccess = requestedAccessState !== "waitlist";
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (error?.code === "auth/email-already-in-use") {
        throw new Error("That email is already registered. Sign in with it or use another email address.");
      }
      throw error;
    }
    if (wantsInviteAccess) {
      if (!inviteCode) {
        await deleteUser(userCredential.user);
        throw new Error("A valid invite code is required for immediate access.");
      }
      const inviteSnap = await getDocs(query(collection(db, "invites"), where("code", "==", inviteCode), limit(1)));
      const match = inviteSnap.docs[0];
      if (!match || match.data()?.status !== "active") {
        await deleteUser(userCredential.user);
        throw new Error("This invite code is invalid or has already been used.");
      }
      inviteRef = match.ref;
      inviteData = match.data() || {};
      if (isInviteExpired(inviteData)) {
        await deleteUser(userCredential.user);
        throw new Error("This invite code has expired. Ask for a new invite.");
      }
      profileDraft = {
        ...profileDraft,
        inviteCode,
        sponsorHandle: normalizeSponsorHandle(profileDraft.sponsorHandle || inviteData?.createdByHandle || "")
      };
    }
  }

  const user = userCredential.user;
  await ensureFirebaseSeed(user.uid);

  if (authMode === "signin") {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const data = userSnap.data() || {};
    const profile = canonicalUserProfile(
      {
        ...data,
        presenceState: "online",
        lastSeenAt: currentTimestampIso(),
        lastActiveAt: currentTimestampIso(),
        authMethod: data.authMethod || "password"
      },
      user
    );
    debugRepositoryWrite("signInProfile.updateProfile");
    await setDoc(doc(db, "users", user.uid), buildProfileWrite(profile, user, data), { merge: true });
    await persistUserRecordSnapshot(user.uid, profile, user);
    const operatorAccess = await ensureOperatorAccessDocument(user.uid, user);
    const staffMember = await ensureStaffMemberDocument(user.uid, profile, user, operatorAccess);
    const pendingInviteCode = sanitizeInviteCode(profile.inviteCode);
    if (profile.accessState === "waitlist" && pendingInviteCode) {
      const inviteSnap = await getDocs(query(collection(db, "invites"), where("code", "==", pendingInviteCode), limit(1)));
      const inviteDoc = inviteSnap.docs[0];
      const invite = inviteDoc?.data?.() || null;
      if (invite?.status === "redeemed" && invite?.applicantUid === user.uid) {
        const sponsorUid = sanitizeText(invite.createdBy || "", 128);
        const sponsorSnap = sponsorUid ? await getDoc(doc(db, "users", sponsorUid)) : null;
        const sponsorProfile = sponsorSnap?.data?.() || {};
        const approvedProfile = canonicalUserProfile(
          {
            ...profile,
            onboarded: true,
            accessState: "priority",
            accessNote: "Sponsor approved invite",
            waitlistEndsAt: ""
          },
          user
        );
        await setDoc(doc(db, "users", user.uid), buildProfileWrite(approvedProfile, user, data), { merge: true });
        await persistUserRecordSnapshot(user.uid, approvedProfile, user);
        if (sponsorUid) {
          await setDoc(
            doc(db, "users", user.uid, "contacts", sponsorUid),
            buildInviteConnectionContact(sponsorUid, sponsorProfile, {
              name: invite.createdByHandle || "Sponsor",
              handle: invite.createdByHandle || "@sponsor"
            }),
            { merge: true }
          );
        }
        await ensureStaffMemberDocument(user.uid, approvedProfile, user, operatorAccess);
        return {
          profile: approvedProfile,
          authenticated: true,
          staffMemberRecord: staffMember,
          backendMode: "firebase"
        };
      }
    }
    return {
      profile,
      authenticated: Boolean(profile.onboarded && profile.accessState !== "waitlist"),
      staffMemberRecord: staffMember,
      backendMode: "firebase"
    };
  }

  const accessState = inviteRef ? "waitlist" : sanitizeText(profileDraft.accessState || "active", 24) || "active";
  const nextProfile = canonicalUserProfile({
    name: sanitizeText(profileDraft.name || profileDraft.displayName, 80),
    displayName: sanitizeText(profileDraft.name || profileDraft.displayName, 80),
    handle: normalizeHandle(profileDraft.handle?.trim?.() || ""),
    city: sanitizeText(profileDraft.city, 80),
    bio: sanitizeText(defaultProfile.bio, 280),
    occupation: sanitizeText(profileDraft.occupation || "", 80),
    demographic: sanitizeText(profileDraft.demographic || "", 80),
    pronouns: sanitizeText(profileDraft.pronouns || "", 40),
    website: sanitizeText(profileDraft.website || "", 120),
    availability: sanitizeText(profileDraft.availability || "", 80),
    interests: sanitizeText(profileDraft.interests || "", 160),
    onboarded: accessState !== "waitlist",
    accessState,
    accessNote: sanitizeText(profileDraft.accessNote || (inviteRef ? "Sponsor approval pending" : accessState === "waitlist" ? "Monthly verification review" : "Priority access"), 80),
    inviteCode: sanitizeInviteCode(profileDraft.inviteCode),
    sponsorHandle: normalizeSponsorHandle(profileDraft.sponsorHandle),
    waitlistEndsAt: sanitizeText(profileDraft.waitlistEndsAt || (inviteRef ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : ""), 64),
    tutorialCompleted: Boolean(profileDraft.tutorialCompleted),
    ageVerified: true,
    ageVerifiedAt: currentTimestampIso(),
    presenceState: "online",
    lastSeenAt: currentTimestampIso(),
    lastActiveAt: currentTimestampIso(),
    authMethod: "password"
  }, user);

  const existing = (await getDoc(doc(db, "users", user.uid))).data() || null;
  debugRepositoryWrite("signInProfile.signupProfile");
  await setDoc(doc(db, "users", user.uid), buildProfileWrite(nextProfile, user, existing), { merge: true });
  await persistUserRecordSnapshot(user.uid, nextProfile, user);
  const operatorAccess = await ensureOperatorAccessDocument(user.uid, user);
  const staffMember = await ensureStaffMemberDocument(user.uid, nextProfile, user, operatorAccess);
  if (inviteRef) {
    await setDoc(inviteRef, {
      ...inviteData,
      status: "sponsor_pending",
      applicantUid: user.uid,
      applicantEmail: sanitizeEmail(user.email || email),
      applicantName: sanitizeText(nextProfile.name || nextProfile.handle || "", 80),
      sponsorDecisionAt: "",
      retentionReviewAt: "",
      rapportBoostedAt: "",
      redeemedBy: "",
      redeemedAt: ""
    });
  }

  return {
    profile: nextProfile,
    authenticated: accessState !== "waitlist",
    staffMemberRecord: staffMember,
    backendMode: "firebase"
  };
}

export async function signInWithGoogleProfile(profileDraft = {}) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const userCredential = await signInWithPopup(auth, provider);
  const user = userCredential.user;
  await ensureFirebaseSeed(user.uid);

  const accessState = sanitizeText(profileDraft.accessState || "active", 24) || "active";
  const existing = (await getDoc(doc(db, "users", user.uid))).data() || {};
  const nextProfile = canonicalUserProfile(
    {
      ...existing,
      name: sanitizeText(existing.name || existing.displayName || user.displayName || profileDraft.name || "", 80),
      displayName: sanitizeText(existing.name || existing.displayName || user.displayName || profileDraft.name || profileDraft.displayName || "", 80),
      handle: normalizeHandle(existing.handle || profileDraft.handle || user.email?.split("@")[0] || ""),
      city: sanitizeText(existing.city || profileDraft.city || "", 80),
      occupation: sanitizeText(existing.occupation || profileDraft.occupation || "", 80),
      demographic: sanitizeText(existing.demographic || profileDraft.demographic || "", 80),
      pronouns: sanitizeText(existing.pronouns || profileDraft.pronouns || "", 40),
      website: sanitizeText(existing.website || profileDraft.website || "", 120),
      availability: sanitizeText(existing.availability || profileDraft.availability || "", 80),
      interests: sanitizeText(existing.interests || profileDraft.interests || "", 160),
      onboarded: existing.onboarded || accessState !== "waitlist",
      accessState: existing.accessState || accessState,
      accessNote: existing.accessNote || sanitizeText(profileDraft.accessNote || (accessState === "waitlist" ? "Monthly verification review" : "Priority access"), 80),
      inviteCode: sanitizeInviteCode(existing.inviteCode || profileDraft.inviteCode),
      sponsorHandle: normalizeSponsorHandle(existing.sponsorHandle || profileDraft.sponsorHandle),
      waitlistEndsAt: sanitizeText(existing.waitlistEndsAt || profileDraft.waitlistEndsAt || "", 64),
      tutorialCompleted: Boolean(existing.tutorialCompleted),
      presenceState: "online",
      lastSeenAt: currentTimestampIso(),
      lastActiveAt: currentTimestampIso(),
      authMethod: "google"
    },
    user
  );

  await setDoc(doc(db, "users", user.uid), buildProfileWrite(nextProfile, user, existing), { merge: true });
  await persistUserRecordSnapshot(user.uid, nextProfile, user);
  const operatorAccess = await ensureOperatorAccessDocument(user.uid, user);
  const staffMember = await ensureStaffMemberDocument(user.uid, nextProfile, user, operatorAccess);

  return {
    profile: nextProfile,
    authenticated: Boolean(nextProfile.onboarded && nextProfile.accessState !== "waitlist"),
    staffMemberRecord: staffMember,
    backendMode: "firebase"
  };
}

export async function sendMagicLinkProfile(email = "") {
  const sanitizedEmail = sanitizeEmail(email);
  if (!sanitizedEmail) {
    throw new Error("Email is required.");
  }

  const actionCodeSettings = {
    url: typeof window !== "undefined" ? window.location.href.split("?")[0] : publicEnv.FOXHUB_PUBLIC_URL,
    handleCodeInApp: true
  };

  await sendSignInLinkToEmail(auth, sanitizedEmail, actionCodeSettings);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MAGIC_LINK_STORAGE_KEY, sanitizedEmail);
  }
  return { email: sanitizedEmail };
}

export async function sendPasswordResetProfile(email = "") {
  const sanitizedEmail = sanitizeEmail(email);
  if (!sanitizedEmail) {
    throw new Error("Email is required.");
  }

  const currentPath = typeof window !== "undefined" && window.location.pathname === "/management" ? "/management" : SIGN_IN_PATH;
  const resetUrl = typeof window !== "undefined" ? `${window.location.origin}${currentPath}?mode=reset` : `${publicEnv.FOXHUB_PUBLIC_URL || ""}${SIGN_IN_PATH}?mode=reset`;
  await sendPasswordResetEmail(auth, sanitizedEmail, {
    url: resetUrl,
    handleCodeInApp: true
  });
  return { email: sanitizedEmail };
}

export async function verifyPasswordResetProfile(code = "") {
  const sanitizedCode = sanitizeText(code, 512);
  if (!sanitizedCode) {
    throw new Error("Password reset code is required.");
  }
  const email = await verifyPasswordResetCode(auth, sanitizedCode);
  return { email: sanitizeEmail(email) };
}

export async function confirmPasswordResetProfile(code = "", password = "") {
  const sanitizedCode = sanitizeText(code, 512);
  if (!sanitizedCode) {
    throw new Error("Password reset code is required.");
  }
  if (!password || password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error("Use a stronger password with at least 10 characters, upper and lower case letters, and a number.");
  }
  await confirmPasswordReset(auth, sanitizedCode, password);
  return { ok: true };
}

export async function updateProfileRecord(profileDraft) {
  const user = await ensureFirebaseUser();
  if (!user?.uid) {
    throw new Error("You must be signed in to update your FoxHub profile.");
  }

  const profileRef = doc(db, "users", user.uid);
  const existing = (await getDoc(profileRef)).data() || null;
  const displayName = firstProfileValue(existing?.name || existing?.displayName, profileDraft.name || profileDraft.displayName, "", 80);
  const hasDraftPhoto = Object.prototype.hasOwnProperty.call(profileDraft, "profilePhoto") || Object.prototype.hasOwnProperty.call(profileDraft, "profilePhotoUrl");
  const nextProfile = canonicalUserProfile({
    ...(existing || {}),
    name: displayName,
    displayName,
    handle: firstProfileHandle(existing?.handle, profileDraft.handle),
    city: firstProfileValue(existing?.city, profileDraft.city, "", 80),
    zipCode: normalizeZipCode(profileDraft.zipCode || profileDraft.postalCode || existing?.zipCode || existing?.postalCode),
    postalCode: normalizeZipCode(profileDraft.zipCode || profileDraft.postalCode || existing?.zipCode || existing?.postalCode),
    bio: firstProfileValue(existing?.bio, profileDraft.bio, defaultProfile.bio, 280),
    occupation: firstProfileValue(existing?.occupation, profileDraft.occupation, "", 80),
    demographic: firstProfileValue(existing?.demographic, profileDraft.demographic, "", 80),
    pronouns: firstProfileValue(existing?.pronouns, profileDraft.pronouns, "", 40),
    website: firstProfileValue(existing?.website, profileDraft.website, "", 120),
    availability: firstProfileValue(existing?.availability, profileDraft.availability, "", 80),
    interests: firstProfileValue(existing?.interests, profileDraft.interests, "", 160),
    profilePhoto: hasDraftPhoto ? profileDraft.profilePhoto : existing?.profilePhoto,
    profilePhotoUrl: hasDraftPhoto ? profileDraft.profilePhotoUrl : existing?.profilePhotoUrl,
    profilePhotoName: hasDraftPhoto ? profileDraft.profilePhotoName : existing?.profilePhotoName,
    profilePhotoType: hasDraftPhoto ? profileDraft.profilePhotoType : existing?.profilePhotoType,
    onboarded: true,
    tutorialCompleted: Boolean(profileDraft.tutorialCompleted ?? existing?.tutorialCompleted),
    presenceState: normalizePresenceState(profileDraft.presenceState || existing?.presenceState || "online"),
    lastSeenAt: sanitizeText(profileDraft.lastSeenAt || existing?.lastSeenAt || currentTimestampIso(), 64),
    lastActiveAt: sanitizeText(profileDraft.lastActiveAt || currentTimestampIso(), 64),
    authMethod: sanitizeText(existing?.authMethod || profileDraft.authMethod || "password", 32)
  }, user);

  await setDoc(profileRef, buildProfileWrite(nextProfile, user, existing), { merge: true });
  await persistUserRecordSnapshot(user.uid, nextProfile, user);

  return nextProfile;
}

export async function updateApplicantAccessRecord(email = "", accessPatch = {}) {
  const targetEmail = sanitizeEmail(email);
  if (!targetEmail) return null;
  const usersSnap = await getDocs(query(collection(db, "users"), where("email", "==", targetEmail), limit(1)));
  const targetDoc = usersSnap.docs[0];
  if (!targetDoc) return null;
  const existing = targetDoc.data() || {};
  const nextPatch = {
    accessState: sanitizeText(accessPatch.accessState || existing.accessState || "waitlist", 24),
    accessNote: sanitizeText(accessPatch.accessNote || existing.accessNote || "Application under review", 120),
    onboarded: Boolean(accessPatch.onboarded ?? existing.onboarded),
    waitlistEndsAt: accessPatch.waitlistEndsAt === "" ? "" : sanitizeText(accessPatch.waitlistEndsAt || existing.waitlistEndsAt || "", 64),
    reviewedAt: sanitizeText(accessPatch.reviewedAt || existing.reviewedAt || "", 64),
    reviewedBy: sanitizeText(accessPatch.reviewedBy || existing.reviewedBy || "", 80),
    updatedAt: serverTimestamp()
  };
  await setDoc(targetDoc.ref, nextPatch, { merge: true });
  await addDoc(collection(db, "transactionalEmailEvents"), {
    to: targetEmail,
    template: accessPatch.emailTemplate || "foxhub_member_application_decision",
    subject: sanitizeText(accessPatch.emailSubject || "Your FoxHub Member application", 160),
    body: sanitizeText(accessPatch.emailBody || "Your FoxHub Member application has been reviewed.", 1000),
    status: "queued",
    source: "member_application_review",
    createdAt: serverTimestamp()
  });
  return { ...existing, ...nextPatch, email: targetEmail };
}

export async function signOutCurrentProfile() {
  const user = await ensureFirebaseUser();
  if (user?.uid) {
    const profileRef = doc(db, "users", user.uid);
    const existing = (await getDoc(profileRef)).data() || null;
    if (existing) {
      const nextProfile = canonicalUserProfile(
        {
          ...existing,
          presenceState: "offline",
          lastSeenAt: currentTimestampIso(),
          lastActiveAt: existing.lastActiveAt || currentTimestampIso()
        },
        user
      );
      await setDoc(profileRef, buildProfileWrite(nextProfile, user, existing), { merge: true });
      await persistUserRecordSnapshot(user.uid, nextProfile, user);
    }
  }
  await signOut(auth);
  return createSeedState();
}

export async function createMessageRecord(threadId, payload = {}) {
  const text = sanitizeText(payload.text || "", 2000);
  const attachments = Array.isArray(payload.attachments)
    ? payload.attachments.map((item) => ({
        id: sanitizeText(item.id || `attachment-${Date.now()}`, 80),
        name: sanitizeText(item.name || "Attachment", 120),
        type: sanitizeText(item.type || "", 80),
        url: sanitizeText(item.url || "", 5000)
      }))
    : [];
  const message = { id: Date.now(), author: "You", text, attachments, time: "Now", mine: true, status: "sent" };
  const user = await ensureFirebaseUser();
  await addDoc(collection(db, "users", user.uid, "threads", threadId, "messages"), message);
  await updateThreadMetadata(user.uid, threadId, {
    lastActiveLabel: "updated just now",
    unreadCount: 0
  });
  return message;
}

export async function createDocumentRecord(payload = {}) {
  return {
    id: `doc-${Date.now()}`,
    ownerId: sanitizeText(payload.ownerId || "self", 80),
    targetType: sanitizeText(payload.targetType || "profile", 40),
    targetId: sanitizeText(payload.targetId || "", 120),
    name: sanitizeText(payload.name || "Document", 120),
    kind: sanitizeText(payload.kind || "evidence", 40),
    mimeType: sanitizeText(payload.mimeType || "application/octet-stream", 120),
    status: sanitizeText(payload.status || "stored", 24),
    source: sanitizeText(payload.source || "manual upload", 80),
    createdAt: new Date().toISOString()
  };
}

export async function createOperatorActionRecord(payload = {}) {
  return {
    id: `ops-${Date.now()}`,
    action: sanitizeText(payload.action || "operator_action", 80),
    actorId: sanitizeText(payload.actorId || "system", 80),
    targetId: sanitizeText(payload.targetId || "", 120),
    detail: sanitizeText(payload.detail || "", 280),
    outcome: sanitizeText(payload.outcome || "logged", 40),
    createdAt: new Date().toISOString()
  };
}

export async function createWalletEventRecord(event) {
  const record = {
    id: Date.now(),
    title: sanitizeText(event.title, 80),
    amount: sanitizeText(event.amount, 24),
    meta: sanitizeText(event.meta, 160)
  };
  const user = await ensureFirebaseUser();
  await setDoc(doc(db, "users", user.uid, "walletEvents", String(record.id)), record);
  return record;
}

export async function createMomentRecord(text, profile, attachments = []) {
  const safeAttachments = Array.isArray(attachments)
    ? attachments.slice(0, 4).map((item) => ({
        id: sanitizeText(item.id || `moment-photo-${Date.now()}`, 80),
        name: sanitizeText(item.name || "Moment photo", 120),
        type: sanitizeText(normalizeImageType(item) || item.type || "image", 80),
        url: isAcceptedImageDataUrl(item.url) ? String(item.url) : ""
      })).filter((item) => item.url)
    : [];
  const record = {
    id: Date.now(),
    author: sanitizeText(profile.name, 80),
    handle: normalizeHandle(profile.handle),
    text: sanitizeText(text, 500),
    meta: "Now",
    stats: "0 reacts · 0 replies",
    postedAt: new Date().toISOString(),
    reactions: { like: 0, love: 0, haha: 0, wow: 0, fire: 0, support: 0, thanks: 0, eyes: 0 },
    myReaction: "",
    comments: [],
    attachments: safeAttachments
  };

  const user = await ensureFirebaseUser();
  await setDoc(doc(db, "users", user.uid, "moments", String(record.id)), record);
  return record;
}

export async function addFavoriteRecord(favorite) {
  return {
    id: `fav-${Date.now()}`,
    type: sanitizeText(favorite.type, 24),
    title: sanitizeText(favorite.title, 120),
    detail: sanitizeText(favorite.detail, 280)
  };
}

export async function addSavedItemRecord(item) {
  return {
    id: `saved-${Date.now()}`,
    kind: sanitizeText(item.kind, 24),
    source: sanitizeText(item.source, 80),
    title: sanitizeText(item.title, 120),
    detail: sanitizeText(item.detail, 280),
    meta: sanitizeText(item.meta, 120)
  };
}

export async function addMiniAppRecentRecord(recent) {
  return {
    id: `recent-${Date.now()}`,
    name: sanitizeText(recent.name, 80),
    meta: sanitizeText(recent.meta, 120)
  };
}

export async function addMiniAppPermissionRecord(permission) {
  return {
    id: `perm-${Date.now()}`,
    appId: sanitizeText(permission.appId, 80),
    appName: sanitizeText(permission.appName, 80),
    scope: sanitizeText(permission.scope, 120),
    status: sanitizeText(permission.status || "granted", 32),
    meta: sanitizeText(permission.meta, 120)
  };
}

export async function createQrActionRecord(action) {
  return {
    id: `qr-${Date.now()}`,
    title: sanitizeText(action.title, 120),
    amount: sanitizeText(action.amount || "", 24),
    meta: sanitizeText(action.meta, 160)
  };
}

export async function createDirectThreadRecord(contact) {
  const thread = {
    id: contact.id,
    name: contact.name,
    type: "direct",
    members: 2,
    presence: `${contact.city} · ${contact.trust}`,
    presenceState: contact.presenceState || "away",
    lastActiveLabel: contact.lastActiveLabel || "last active recently",
    unreadCount: 0,
    messages: [
      {
        id: Date.now(),
        author: contact.name,
        text: "Thread started. Keep this one tight and useful.",
        time: "Now",
        mine: false
      }
    ]
  };

  const user = await ensureFirebaseUser();
  const { messages, ...threadData } = thread;
  await setDoc(doc(db, "users", user.uid, "threads", thread.id), threadData, { merge: true });
  await setDoc(doc(db, "users", user.uid, "threads", thread.id, "messages", String(messages[0].id)), messages[0]);
  return thread;
}

export async function createMediaClipRecord(payload = {}) {
  return {
    id: `clip-${Date.now()}`,
    title: sanitizeText(payload.title || "New clip", 120),
    creatorId: sanitizeText(payload.creatorId || "self", 80),
    durationSec: Math.max(1, Number(payload.durationSec) || 15),
    caption: sanitizeText(payload.caption || "", 280),
    status: sanitizeText(payload.status || "draft", 24),
    views: 0,
    likes: 0,
    postedAt: new Date().toISOString()
  };
}

export async function createStoryBundleRecord(payload = {}) {
  return {
    id: `bundle-${Date.now()}`,
    ownerId: sanitizeText(payload.ownerId || "self", 80),
    title: sanitizeText(payload.title || "Story set", 120),
    frames: Math.max(1, Number(payload.frames) || 1),
    expiresAt: payload.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    viewedBy: Array.isArray(payload.viewedBy) ? payload.viewedBy : [],
    status: sanitizeText(payload.status || "live", 24)
  };
}

export async function createAuctionBidRecord(payload = {}) {
  return {
    id: `bid-${Date.now()}`,
    lotId: sanitizeText(payload.lotId, 80),
    bidderId: sanitizeText(payload.bidderId || "self", 80),
    amount: Number(payload.amount) || 0,
    currency: sanitizeText(payload.currency || "USD", 8),
    placedAt: new Date().toISOString(),
    status: sanitizeText(payload.status || "submitted", 24)
  };
}

export async function createCartRecord(payload = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const subtotal = items.reduce((sum, item) => sum + ((Number(item.unitPrice) || 0) * (Number(item.qty) || 0)), 0);
  return {
    id: payload.id || `cart-${Date.now()}`,
    ownerId: sanitizeText(payload.ownerId || "self", 80),
    itemCount: items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0),
    subtotal,
    currency: sanitizeText(payload.currency || "USD", 8),
    status: sanitizeText(payload.status || "active", 24),
    items
  };
}

export async function createReviewRecord(payload = {}) {
  return {
    id: `review-${Date.now()}`,
    shopId: sanitizeText(payload.shopId, 80),
    author: sanitizeText(payload.author || "FoxHub user", 80),
    rating: Math.max(1, Math.min(5, Number(payload.rating) || 5)),
    title: sanitizeText(payload.title || "Review", 120),
    body: sanitizeText(payload.body || "", 400),
    createdAt: new Date().toISOString()
  };
}

export async function createRatingRecord(payload = {}) {
  const numericRating = Math.max(1, Math.min(5, Number(payload.rating) || 5));
  return {
    id: `rating-${Date.now()}`,
    targetType: sanitizeText(payload.targetType || "contact", 24),
    targetId: sanitizeText(payload.targetId || "", 80),
    actorId: sanitizeText(payload.actorId || "self", 80),
    actorLabel: sanitizeText(payload.actorLabel || "FoxHub user", 80),
    rating: numericRating,
    trustTier: sanitizeText(payload.trustTier || "", 8),
    title: sanitizeText(payload.title || "Rating", 120),
    body: sanitizeText(payload.body || "", 400),
    status: sanitizeText(payload.status || "published", 24),
    moderationStatus: sanitizeText(payload.moderationStatus || "clear", 24),
    createdAt: new Date().toISOString()
  };
}

export async function createRouteRecord(payload = {}) {
  return {
    id: `route-${Date.now()}`,
    name: sanitizeText(payload.name || "Route", 120),
    origin: sanitizeText(payload.origin || "", 120),
    destination: sanitizeText(payload.destination || "", 120),
    stops: Math.max(0, Number(payload.stops) || 0),
    etaMinutes: Math.max(1, Number(payload.etaMinutes) || 15),
    mode: sanitizeText(payload.mode || "drive", 24),
    status: sanitizeText(payload.status || "ready", 24)
  };
}

export async function createEndorsementRecord(payload = {}) {
  return {
    id: `endorse-${Date.now()}`,
    fromContactId: sanitizeText(payload.fromContactId || "self", 80),
    toContactId: sanitizeText(payload.toContactId, 80),
    skill: sanitizeText(payload.skill || "", 80),
    note: sanitizeText(payload.note || "", 280),
    createdAt: new Date().toISOString()
  };
}

export async function createJobPostRecord(payload = {}) {
  return {
    id: `job-${Date.now()}`,
    title: sanitizeText(payload.title || "", 120),
    team: sanitizeText(payload.team || "", 80),
    location: sanitizeText(payload.location || "", 120),
    type: sanitizeText(payload.type || "Contract", 40),
    status: sanitizeText(payload.status || "open", 24),
    applicants: Math.max(0, Number(payload.applicants) || 0)
  };
}

export async function createMiniProgramManifestRecord(payload = {}) {
  return {
    id: `manifest-${Date.now()}`,
    appId: sanitizeText(payload.appId || "", 80),
    version: sanitizeText(payload.version || "1.0.0", 24),
    permissions: Array.isArray(payload.permissions) ? payload.permissions.map((item) => sanitizeText(item, 40)).filter(Boolean) : [],
    events: Array.isArray(payload.events) ? payload.events.map((item) => sanitizeText(item, 60)).filter(Boolean) : [],
    status: sanitizeText(payload.status || "draft", 24)
  };
}

export async function createCallSessionRecord(payload = {}) {
  return {
    id: `call-${Date.now()}`,
    threadId: sanitizeText(payload.threadId || "", 80),
    mode: sanitizeText(payload.mode || "voice", 24),
    participants: Math.max(1, Number(payload.participants) || 1),
    encryptionState: sanitizeText(payload.encryptionState || "pending keys", 80),
    status: sanitizeText(payload.status || "starting", 24)
  };
}

export async function createInviteRecord(payload = {}, profile = {}) {
  const user = await ensureFirebaseUser();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAt = Timestamp.fromDate(new Date(now + INVITE_EXPIRATION_MS));
  const record = {
    id: `invite-${now}`,
    code: `FOX-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${now.toString(36).slice(-4).toUpperCase()}`,
    label: sanitizeText(payload.label || "Profile invite", 80),
    note: sanitizeText(payload.note || "Immediate-access invite", 160),
    createdBy: user.uid,
    createdByHandle: normalizeHandle(profile.handle || ""),
    createdAt: nowIso,
    expiresAt,
    applicantUid: "",
    applicantEmail: "",
    applicantName: "",
    sponsorDecisionAt: "",
    retentionReviewAt: "",
    rapportBoostedAt: "",
    status: "active",
    redeemedBy: "",
    redeemedAt: ""
  };
  const activeSnap = await getDocs(query(collection(db, "invites"), where("createdBy", "==", user.uid), where("status", "in", ["active", "sponsor_pending"])));
  const batch = writeBatch(db);
  activeSnap.docs.forEach((inviteDoc) => {
    const status = inviteDoc.data()?.status;
    batch.set(
      inviteDoc.ref,
      {
        status: "expired",
        expiresAt: serverTimestamp(),
        expiredAt: serverTimestamp(),
        expirationReason: "Superseded by a newer invite code"
      },
      { merge: true }
    );
  });
  batch.set(doc(db, "invites", record.id), record);
  await batch.commit();
  return record;
}

export async function reviewSponsorInviteRecord(inviteId = "", decision = "approve") {
  const user = await ensureFirebaseUser();
  const ref = doc(db, "invites", sanitizeText(inviteId, 80));
  const snap = await getDoc(ref);
  const invite = snap.data() || null;
  if (!invite || invite.createdBy !== user.uid || invite.status !== "sponsor_pending") {
    throw new Error("No sponsor-pending invite was found for this account.");
  }
  const approved = decision === "approve";
  const nextInvite = {
    ...invite,
    status: approved ? "redeemed" : "denied",
    sponsorDecisionAt: serverTimestamp(),
    retentionReviewAt: approved ? Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) : "",
    rapportBoostedAt: "",
    redeemedBy: approved ? sanitizeEmail(invite.applicantEmail || "") : "",
    redeemedAt: approved ? serverTimestamp() : ""
  };
  const batch = writeBatch(db);
  batch.set(ref, nextInvite);
  if (approved && invite.applicantUid) {
    const applicantSnap = await getDoc(doc(db, "users", sanitizeText(invite.applicantUid, 128)));
    const applicantProfile = applicantSnap.data() || {};
    batch.set(
      doc(db, "users", user.uid, "contacts", sanitizeText(invite.applicantUid, 128)),
      buildInviteConnectionContact(sanitizeText(invite.applicantUid, 128), applicantProfile, {
        email: invite.applicantEmail || "",
        name: invite.applicantName || invite.applicantEmail || "Invited member"
      }),
      { merge: true }
    );
  }
  await batch.commit();
  return {
    ...invite,
    status: nextInvite.status,
    sponsorDecisionAt: new Date().toISOString(),
    retentionReviewAt: approved ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : "",
    rapportBoostedAt: "",
    redeemedBy: approved ? sanitizeEmail(invite.applicantEmail || "") : "",
    redeemedAt: approved ? new Date().toISOString() : ""
  };
}

export function subscribeToState(onState) {
  let stopUserSnapshot = () => {};
  let stopOperatorAccessSnapshot = () => {};
  let stopStaffMemberSnapshot = () => {};
  let stopContactsSnapshot = () => {};
  let stopCirclesSnapshot = () => {};
  let stopChannelsSnapshot = () => {};
  let stopWalletSnapshot = () => {};
  let stopMomentsSnapshot = () => {};
  let stopThreadsSnapshot = () => {};
  const messageStops = new Map();
  let currentState = createSeedState();
  let emitQueued = false;

  function emit() {
    if (emitQueued) return;
    emitQueued = true;
    queueMicrotask(() => {
      emitQueued = false;
      onState({ ...currentState });
    });
  }

  function resetMessageListeners() {
    messageStops.forEach((unsubscribe) => unsubscribe());
    messageStops.clear();
  }

  const stopAuth = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      lastSavedUserStateSignature = "";
      lastSavedContactsSignature = "";
      currentState = createSeedState();
      emit();
      return;
    }

    const activeUser = user;
    await ensureFirebaseSeed(activeUser.uid);

    stopUserSnapshot();
    stopOperatorAccessSnapshot();
    stopStaffMemberSnapshot();
    stopContactsSnapshot();
    stopCirclesSnapshot();
    stopChannelsSnapshot();
    stopWalletSnapshot();
    stopMomentsSnapshot();
    stopThreadsSnapshot();
    resetMessageListeners();

    currentState = createSeedState();
    emit();

    stopUserSnapshot = onSnapshot(doc(db, "users", activeUser.uid), (snap) => {
      const data = snap.data() || {};
      currentState = mergePersistedUserState(currentState, data);
      emit();
    });

    stopOperatorAccessSnapshot = onSnapshot(doc(db, "operatorAccess", activeUser.uid), (snap) => {
      const accessRecord = snap.exists()
        ? [{ id: snap.id, ...snap.data() }]
        : [];
      currentState = { ...currentState, operatorAccessRecords: accessRecord };
      emit();
    });

    stopStaffMemberSnapshot = onSnapshot(doc(db, "staffMembers", activeUser.uid), (snap) => {
      currentState = { ...currentState, staffMemberRecord: snap.exists() ? { id: snap.id, ...snap.data() } : null };
      emit();
    });

    stopContactsSnapshot = onSnapshot(collection(db, "users", activeUser.uid, "contacts"), (snap) => {
      currentState = { ...currentState, contacts: snap.docs.map((item) => mergeSeedContact(item.data())) };
      emit();
    });

    stopCirclesSnapshot = onSnapshot(collection(db, "users", activeUser.uid, "circles"), (snap) => {
      const nextCircles = snap.docs.map((item) => item.data());
      currentState = {
        ...currentState,
        circles: nextCircles,
        activeCircleId: nextCircles[0]?.id || currentState.activeCircleId
      };
      emit();
    });

    stopChannelsSnapshot = onSnapshot(collection(db, "users", activeUser.uid, "channels"), (snap) => {
      currentState = { ...currentState, channels: snap.docs.map((item) => item.data()) };
      emit();
    });

    stopWalletSnapshot = onSnapshot(
      query(collection(db, "users", activeUser.uid, "walletEvents"), orderBy("id", "desc"), limit(25)),
      (snap) => {
        currentState = { ...currentState, walletEvents: snap.docs.map((item) => item.data()) };
        emit();
      }
    );

    stopMomentsSnapshot = onSnapshot(
      query(collection(db, "users", activeUser.uid, "moments"), orderBy("id", "desc"), limit(25)),
      (snap) => {
        currentState = { ...currentState, moments: snap.docs.map((item) => item.data()) };
        emit();
      }
    );

    stopThreadsSnapshot = onSnapshot(collection(db, "users", activeUser.uid, "threads"), (snap) => {
      const nextThreads = snap.docs.map((threadDoc) => ({
        id: threadDoc.id,
        ...threadDoc.data(),
        messages: currentState.threads.find((thread) => thread.id === threadDoc.id)?.messages || []
      }));

      const nextThreadIds = new Set(nextThreads.map((thread) => thread.id));
      Array.from(messageStops.keys()).forEach((threadId) => {
        if (!nextThreadIds.has(threadId)) {
          messageStops.get(threadId)?.();
          messageStops.delete(threadId);
        }
      });

      nextThreads.forEach((thread) => {
        if (messageStops.has(thread.id)) return;

        const stopMessages = onSnapshot(
          query(collection(db, "users", activeUser.uid, "threads", thread.id, "messages"), orderBy("id", "asc"), limit(100)),
          (messageSnap) => {
            currentState = {
              ...currentState,
              threads: currentState.threads.map((item) =>
                item.id === thread.id
                  ? { ...item, messages: messageSnap.docs.map((messageDoc) => ({ id: messageDoc.id, ...messageDoc.data() })) }
                  : item
              )
            };
            emit();
          }
        );

        messageStops.set(thread.id, stopMessages);
      });

      currentState = {
        ...currentState,
        threads: nextThreads,
        selectedThreadId:
          nextThreads.find((item) => item.id === currentState.selectedThreadId)?.id || nextThreads[0]?.id || currentState.selectedThreadId
      };
      emit();
    });
  });

  return () => {
    stopAuth();
    stopUserSnapshot();
    stopOperatorAccessSnapshot();
    stopStaffMemberSnapshot();
    stopContactsSnapshot();
    stopCirclesSnapshot();
    stopChannelsSnapshot();
    stopWalletSnapshot();
    stopMomentsSnapshot();
    stopThreadsSnapshot();
    resetMessageListeners();
  };
}
