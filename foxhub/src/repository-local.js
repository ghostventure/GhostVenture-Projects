import { isAcceptedImageDataUrl, normalizeImageType } from "./mediaUploads.js";
import { validateCaptchaProof } from "./captchaGuard.js";
import {
  apiConnectors,
  channels,
  channelStreams,
  circles,
  communityChannels,
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
  creatorOrders,
  defaultProfile,
  demandSignals,
  invites,
  favorites,
  fileTransfers,
  listingAlerts,
  listings,
  listingCategories,
  listingTags,
  listingTypes,
  localListings,
  miniAppPermissions,
  miniAppRecents,
  miniApps,
  moments,
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
  officialAccounts,
  officialAccountSubscriptions,
  officialPosts,
  peopleNearby,
  qrActions,
  qrHistory,
  reviewInsights,
  savedItems,
  savedSearches,
  searchScopes,
  serviceContinuity,
  services,
  shakeMatches,
  storyHighlights,
  threads,
  utilityCards,
  utilityBillPayPayments,
  utilityBillPayProviders,
  userSegments,
  userRecords,
  threadReadState,
  walletEvents
} from "./data.js";
import { resolveProfileOneId } from "./identity.js";
import { FOXHUB_PRIMARY_OWNER_EMAIL, getFoxHubReservedEmailBlockMessage, isAtLeast18, isFoxHubDomainEmail, isFoxHubOwnerEmail, normalizeZipCode } from "./rules.js";

const STORAGE_KEY = "foxhub-alpha-state";
const LOCAL_PROFILES_KEY = "foxhub-alpha-profiles";
const LOCAL_STAFF_MEMBERS_KEY = "foxhub-alpha-staff-members";
const RESERVED_EMAIL_ATTEMPTS_KEY = "foxhub-reserved-email-attempts";
const FOUNDER_MANAGER_EMAIL = FOXHUB_PRIMARY_OWNER_EMAIL;
const FOUNDER_MANAGER_PASSWORD_SHA256 = "a81fadac7d560848389460d47e4f0c974fb8e94b318ca3284bdc034f0b2e4879";
const INVITE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeText(value = "", max = 280) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
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

function sanitizeEmail(value = "") {
  return sanitizeText(value || "", 160).toLowerCase();
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

function keepProfileValue(existingValue, draftValue, fallbackValue = "", max = 280) {
  const existingText = sanitizeText(existingValue, max);
  if (existingText) return existingText;
  const draftText = sanitizeText(draftValue, max);
  if (draftText) return draftText;
  return sanitizeText(fallbackValue, max);
}

function keepProfileHandle(existingValue, draftValue) {
  return normalizeHandle(existingValue) || normalizeHandle(draftValue);
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
    handle: normalizeHandle(profile.handle) === FOUNDER_PROFILE_FILLER.handle ? "" : profile.handle,
    city: sanitizeText(profile.city, 80) === FOUNDER_PROFILE_FILLER.city ? "" : profile.city,
    bio: sanitizeText(profile.bio, 280) === FOUNDER_PROFILE_FILLER.bio ? "" : profile.bio,
    occupation: sanitizeText(profile.occupation, 80) === FOUNDER_PROFILE_FILLER.occupation ? "" : profile.occupation,
    demographic: sanitizeText(profile.demographic, 80) === FOUNDER_PROFILE_FILLER.demographic ? "" : profile.demographic
  };
}

function shouldScrubFounderProfile(profile = {}) {
  return isFoxHubOwnerEmail(profile.email || "") || profile.role === "founder" || profile.role === "owner";
}

function mergeDurableProfile(existingProfile = null, profileDraft = {}) {
  if (!existingProfile) return profileDraft;
  const existingBase = shouldScrubFounderProfile(existingProfile) ? scrubFounderProfileFiller(existingProfile) : existingProfile;
  const draftBase = shouldScrubFounderProfile(profileDraft) ? scrubFounderProfileFiller(profileDraft) : profileDraft;
  const displayName = keepProfileValue(existingBase.name || existingBase.displayName, draftBase.name || draftBase.displayName, "", 80);
  const profilePhotoUrl = isAcceptedImageDataUrl(draftBase.profilePhoto?.url || draftBase.profilePhotoUrl)
    ? String(draftBase.profilePhoto?.url || draftBase.profilePhotoUrl)
    : isAcceptedImageDataUrl(existingBase.profilePhoto?.url || existingBase.profilePhotoUrl)
      ? String(existingBase.profilePhoto?.url || existingBase.profilePhotoUrl)
      : "";
  const profilePhoto = profilePhotoUrl
    ? {
        id: sanitizeText(draftBase.profilePhoto?.id || existingBase.profilePhoto?.id || "profile-photo", 80),
        name: sanitizeText(draftBase.profilePhoto?.name || draftBase.profilePhotoName || existingBase.profilePhoto?.name || existingBase.profilePhotoName || "Profile photo", 120),
        type: sanitizeText(normalizeImageType(draftBase.profilePhoto || existingBase.profilePhoto || { type: draftBase.profilePhotoType || existingBase.profilePhotoType }) || draftBase.profilePhotoType || existingBase.profilePhotoType || "image", 80),
        url: profilePhotoUrl,
        size: Number(draftBase.profilePhoto?.size || existingBase.profilePhoto?.size || 0)
      }
    : null;
  return {
    ...(draftBase || {}),
    name: displayName,
    displayName,
    oneId: resolveProfileOneId({ ...(draftBase || {}), ...existingBase }),
    handle: keepProfileHandle(existingBase.handle, draftBase.handle),
    city: keepProfileValue(existingBase.city, draftBase.city, "", 80),
    zipCode: normalizeZipCode(draftBase.zipCode || draftBase.postalCode || existingBase.zipCode || existingBase.postalCode),
    postalCode: normalizeZipCode(draftBase.zipCode || draftBase.postalCode || existingBase.zipCode || existingBase.postalCode),
    bio: keepProfileValue(existingBase.bio, draftBase.bio, defaultProfile.bio, 280),
    occupation: keepProfileValue(existingBase.occupation, draftBase.occupation, "", 80),
    demographic: keepProfileValue(existingBase.demographic, draftBase.demographic, "", 80),
    pronouns: keepProfileValue(existingBase.pronouns, draftBase.pronouns, "", 40),
    website: keepProfileValue(existingBase.website, draftBase.website, "", 120),
    availability: keepProfileValue(existingBase.availability, draftBase.availability, "", 80),
    interests: keepProfileValue(existingBase.interests, draftBase.interests, "", 160),
    profilePhoto,
    profilePhotoUrl,
    profilePhotoName: profilePhoto?.name || "",
    profilePhotoType: profilePhoto?.type || "",
    email: sanitizeEmail(existingBase.email || draftBase.email || ""),
    accessState: keepProfileValue(existingBase.accessState, draftBase.accessState, "active", 24) || "active",
    accessNote: keepProfileValue(existingBase.accessNote, draftBase.accessNote, "Active", 80),
    inviteCode: sanitizeInviteCode(existingBase.inviteCode) || sanitizeInviteCode(draftBase.inviteCode),
    sponsorHandle: normalizeSponsorHandle(existingBase.sponsorHandle) || normalizeSponsorHandle(draftBase.sponsorHandle),
    waitlistEndsAt: keepProfileValue(existingBase.waitlistEndsAt, draftBase.waitlistEndsAt, "", 64),
    tutorialCompleted: Boolean(existingBase.tutorialCompleted ?? draftBase.tutorialCompleted),
    verifiedPerformerSubscribed: Boolean(existingBase.verifiedPerformerSubscribed ?? draftBase.verifiedPerformerSubscribed),
    verifiedPerformerStatus: keepProfileValue(existingBase.verifiedPerformerStatus, draftBase.verifiedPerformerStatus, "not_subscribed", 32),
    verifiedPerformerPlan: keepProfileValue(existingBase.verifiedPerformerPlan, draftBase.verifiedPerformerPlan, "$20/month", 32),
    verifiedPerformerSince: keepProfileValue(existingBase.verifiedPerformerSince, draftBase.verifiedPerformerSince, "", 64),
    ageVerified: Boolean(existingBase.ageVerified ?? draftBase.ageVerified),
    ageVerifiedAt: keepProfileValue(existingBase.ageVerifiedAt, draftBase.ageVerifiedAt, "", 64),
    role: sanitizeText(existingBase.role || draftBase.role || "", 32),
    managerAccess: Boolean(existingBase.managerAccess ?? draftBase.managerAccess),
    staffAccess: Boolean(existingBase.staffAccess ?? draftBase.staffAccess)
  };
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

async function sha256Text(value = "") {
  const bytes = new TextEncoder().encode(String(value));
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyFounderManagerPassword(password = "") {
  return (await sha256Text(password)) === FOUNDER_MANAGER_PASSWORD_SHA256;
}

function buildFounderManagerProfile(email = FOUNDER_MANAGER_EMAIL, existingProfile = null) {
  const ownerEmail = sanitizeEmail(email || existingProfile?.email || FOUNDER_MANAGER_EMAIL);
  const baseProfile = scrubFounderProfileFiller(existingProfile || {});
  const displayName = sanitizeText(baseProfile.displayName || baseProfile.name || "", 80);
  return {
    ...(baseProfile || {}),
    name: displayName,
    displayName,
    oneId: resolveProfileOneId({ ...baseProfile, email: ownerEmail }),
    handle: normalizeHandle(baseProfile.handle || ""),
    city: sanitizeText(baseProfile.city || "", 80),
    bio: sanitizeText(baseProfile.bio || "", 280),
    occupation: sanitizeText(baseProfile.occupation || "", 80),
    demographic: sanitizeText(baseProfile.demographic || "", 80),
    pronouns: sanitizeText(baseProfile.pronouns || "", 40),
    website: sanitizeText(baseProfile.website || "", 120),
    availability: sanitizeText(baseProfile.availability || "", 80),
    interests: sanitizeText(baseProfile.interests || "", 160),
    email: ownerEmail,
    accessState: "priority",
    accessNote: sanitizeText(baseProfile.accessNote || "Founder management access", 80),
    inviteCode: sanitizeInviteCode(baseProfile.inviteCode),
    sponsorHandle: normalizeSponsorHandle(baseProfile.sponsorHandle),
    waitlistEndsAt: "",
    onboarded: true,
    tutorialCompleted: true,
    role: "founder",
    managerAccess: true,
    staffAccess: true,
    verifiedPerformerSubscribed: false,
    verifiedPerformerStatus: "not_subscribed",
    verifiedPerformerPlan: "$20/month",
    verifiedPerformerSince: ""
  };
}

function buildLocalStaffMember(profile = {}) {
  const email = sanitizeEmail(profile.email || FOUNDER_MANAGER_EMAIL);
  const now = new Date().toISOString();
  return {
    id: email,
    schemaVersion: 1,
    uid: email,
    email,
    name: sanitizeText(profile.name || "FoxHub Founder", 80),
    handle: normalizeHandle(profile.handle || "@founder"),
    oneId: resolveProfileOneId(profile),
    city: sanitizeText(profile.city || "Atlanta", 80),
    department: "Executive",
    title: sanitizeText(profile.occupation || "Founder", 80),
    role: profile.role || "founder",
    employmentStatus: "active",
    accountType: "staff",
    founder: true,
    managementAccess: true,
    staffAccess: true,
    operatorAccessRef: `operatorAccess/${email}`,
    memberProfileRef: `users/${email}`,
    accessState: profile.accessState || "priority",
    scopes: ["*", "owner", "admin", "management", "members", "verification", "moderation", "billing", "documents", "notifications", "settings", "security", "operators"],
    lastSeenAt: now,
    lastActiveAt: now,
    createdAt: now,
    updatedAt: now
  };
}

function readLocalStaffMembers() {
  try {
    const stored = localStorage.getItem(LOCAL_STAFF_MEMBERS_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalStaffMembers(records) {
  localStorage.setItem(LOCAL_STAFF_MEMBERS_KEY, JSON.stringify(records && typeof records === "object" ? records : {}));
}

function upsertLocalStaffMember(profile = {}) {
  const staffMember = buildLocalStaffMember(profile);
  const records = readLocalStaffMembers();
  const previous = records[staffMember.email] || {};
  records[staffMember.email] = {
    ...previous,
    ...staffMember,
    createdAt: previous.createdAt || staffMember.createdAt,
    updatedAt: staffMember.updatedAt
  };
  writeLocalStaffMembers(records);
  return records[staffMember.email];
}

function readLocalProfiles() {
  try {
    const stored = localStorage.getItem(LOCAL_PROFILES_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalProfiles(profiles) {
  localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(profiles && typeof profiles === "object" ? profiles : {}));
}

function upsertLocalProfile(profile = {}) {
  const email = sanitizeEmail(profile.email || "");
  if (!email) return;
  const profiles = readLocalProfiles();
  profiles[email] = {
    ...(profiles[email] || {}),
    ...profile,
    email,
    updatedAt: new Date().toISOString()
  };
  writeLocalProfiles(profiles);
}

function getLocalProfileByEmail(email = "") {
  const key = sanitizeEmail(email);
  if (!key) return null;
  return readLocalProfiles()[key] || null;
}

function getLocalProfileByStableIdentity(profile = {}) {
  const byEmail = getLocalProfileByEmail(profile.email || "");
  if (byEmail) return byEmail;
  const oneId = sanitizeText(profile.oneId || "", 32);
  if (!oneId) return null;
  return Object.values(readLocalProfiles()).find((savedProfile) => sanitizeText(savedProfile.oneId || "", 32) === oneId) || null;
}

function inviteExpiresAtMillis(invite = {}) {
  const parsed = new Date(invite.expiresAt || "").getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isInviteExpired(invite = {}, now = Date.now()) {
  return inviteExpiresAtMillis(invite) <= now;
}

function expirePreviousInvite(invite = {}, nowIso = new Date().toISOString()) {
  if (!["active", "sponsor_pending"].includes(invite.status)) return invite;
  return {
    ...invite,
    status: "expired",
    expiresAt: nowIso,
    expiredAt: nowIso,
    expirationReason: "Superseded by a newer invite code"
  };
}

function mergeSeedContact(contact = {}) {
  const seedContact = contacts.find((item) => item.id === contact.id);
  return seedContact ? { ...seedContact, ...contact } : contact;
}

function buildInviteConnectionContact(profile = {}, fallback = {}) {
  const email = sanitizeEmail(profile.email || fallback.email || "");
  const handle = normalizeHandle(profile.handle || fallback.handle || (email ? email.split("@")[0] : "member"));
  const name = sanitizeText(profile.name || fallback.name || handle || "FoxHub Member", 80);
  return {
    id: sanitizeText(profile.uid || profile.id || email || handle || `contact-${Date.now()}`, 120),
    name,
    handle,
    displayName: sanitizeText(name || profile.displayName, 80),
    legalName: "",
    email,
    phone: "",
    city: sanitizeText(profile.city || fallback.city || "Unknown", 80),
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
    joinDate: new Date().toISOString().slice(0, 10),
    referralSource: "sponsor invite",
    walletState: "inactive",
    payoutMethod: "",
    supportTier: "standard"
  };
}

export function createSeedState() {
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
    moments: clone(moments),
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
    activeMiniAppId: miniApps[0].id,
    selectedThreadId: threads[0].id,
    staffMemberRecord: null,
    backendMode: "local"
  };
}

function readLocalState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return createSeedState();

    const parsed = JSON.parse(stored);
    const seed = createSeedState();

    return {
      ...seed,
      ...parsed,
      profile: {
        ...seed.profile,
        ...(parsed.profile || {}),
        oneId: resolveProfileOneId(parsed.profile || seed.profile)
      },
      threads: Array.isArray(parsed.threads) ? parsed.threads : seed.threads,
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts.map((contact) => mergeSeedContact(contact)) : seed.contacts,
      friendRequests: Array.isArray(parsed.friendRequests) ? parsed.friendRequests : seed.friendRequests,
      shortVideos: Array.isArray(parsed.shortVideos) ? parsed.shortVideos : seed.shortVideos,
      storyBundles: Array.isArray(parsed.storyBundles) ? parsed.storyBundles : seed.storyBundles,
      auctionLots: Array.isArray(parsed.auctionLots) ? parsed.auctionLots : seed.auctionLots,
      bidEvents: Array.isArray(parsed.bidEvents) ? parsed.bidEvents : seed.bidEvents,
      carts: Array.isArray(parsed.carts) ? parsed.carts : seed.carts,
      fulfillmentOrders: Array.isArray(parsed.fulfillmentOrders) ? parsed.fulfillmentOrders : seed.fulfillmentOrders,
      shopProfiles: Array.isArray(parsed.shopProfiles) ? parsed.shopProfiles : seed.shopProfiles,
      shopReviews: Array.isArray(parsed.shopReviews) ? parsed.shopReviews : seed.shopReviews,
      ratingRecords: Array.isArray(parsed.ratingRecords) ? parsed.ratingRecords : seed.ratingRecords,
      ratingModerationQueue: Array.isArray(parsed.ratingModerationQueue) ? parsed.ratingModerationQueue : seed.ratingModerationQueue,
      reputationSnapshots: Array.isArray(parsed.reputationSnapshots) ? parsed.reputationSnapshots : seed.reputationSnapshots,
      routePlans: Array.isArray(parsed.routePlans) ? parsed.routePlans : seed.routePlans,
      professionalIdentities: Array.isArray(parsed.professionalIdentities) ? parsed.professionalIdentities : seed.professionalIdentities,
      endorsements: Array.isArray(parsed.endorsements) ? parsed.endorsements : seed.endorsements,
      jobPosts: Array.isArray(parsed.jobPosts) ? parsed.jobPosts : seed.jobPosts,
      resumeEntries: Array.isArray(parsed.resumeEntries) ? parsed.resumeEntries : seed.resumeEntries,
      miniProgramManifests: Array.isArray(parsed.miniProgramManifests) ? parsed.miniProgramManifests : seed.miniProgramManifests,
      runtimeSessions: Array.isArray(parsed.runtimeSessions) ? parsed.runtimeSessions : seed.runtimeSessions,
      callSessions: Array.isArray(parsed.callSessions) ? parsed.callSessions : seed.callSessions,
      callLogs: Array.isArray(parsed.callLogs) ? parsed.callLogs : seed.callLogs,
      invites: Array.isArray(parsed.invites) ? parsed.invites : seed.invites,
      userRecords: Array.isArray(parsed.userRecords) ? parsed.userRecords : seed.userRecords,
      circles: Array.isArray(parsed.circles) ? parsed.circles : seed.circles,
      walletEvents: Array.isArray(parsed.walletEvents) ? parsed.walletEvents : seed.walletEvents,
      moments: Array.isArray(parsed.moments) ? parsed.moments : seed.moments,
      moderationCases: Array.isArray(parsed.moderationCases) ? parsed.moderationCases : seed.moderationCases,
      verificationCases: Array.isArray(parsed.verificationCases) ? parsed.verificationCases : seed.verificationCases,
      merchantSettlements: Array.isArray(parsed.merchantSettlements) ? parsed.merchantSettlements : seed.merchantSettlements,
      merchantPayoutControls: Array.isArray(parsed.merchantPayoutControls) ? parsed.merchantPayoutControls : seed.merchantPayoutControls,
      merchantLocations: Array.isArray(parsed.merchantLocations) ? parsed.merchantLocations : seed.merchantLocations,
      compliancePrograms: Array.isArray(parsed.compliancePrograms) ? parsed.compliancePrograms : seed.compliancePrograms,
      trustSafetyIncidents: Array.isArray(parsed.trustSafetyIncidents) ? parsed.trustSafetyIncidents : seed.trustSafetyIncidents,
      merchantOnboardingQueue: Array.isArray(parsed.merchantOnboardingQueue) ? parsed.merchantOnboardingQueue : seed.merchantOnboardingQueue,
      merchantRiskSignals: Array.isArray(parsed.merchantRiskSignals) ? parsed.merchantRiskSignals : seed.merchantRiskSignals,
      disputeCases: Array.isArray(parsed.disputeCases) ? parsed.disputeCases : seed.disputeCases,
      auditEvents: Array.isArray(parsed.auditEvents) ? parsed.auditEvents : seed.auditEvents,
      notificationEvents: Array.isArray(parsed.notificationEvents) ? parsed.notificationEvents : seed.notificationEvents,
      deviceSessions: Array.isArray(parsed.deviceSessions) ? parsed.deviceSessions : seed.deviceSessions,
      documentVault: Array.isArray(parsed.documentVault) ? parsed.documentVault : seed.documentVault,
      operatorActions: Array.isArray(parsed.operatorActions) ? parsed.operatorActions : seed.operatorActions,
      operatorAccessRecords: Array.isArray(parsed.operatorAccessRecords) ? parsed.operatorAccessRecords : seed.operatorAccessRecords,
      notificationSubscriptions: Array.isArray(parsed.notificationSubscriptions) ? parsed.notificationSubscriptions : seed.notificationSubscriptions,
      blockedUsers: Array.isArray(parsed.blockedUsers) ? parsed.blockedUsers : seed.blockedUsers,
      channels: Array.isArray(parsed.channels) ? parsed.channels : seed.channels,
      officialAccounts: Array.isArray(parsed.officialAccounts) ? parsed.officialAccounts : seed.officialAccounts,
      officialAccountSubscriptions: Array.isArray(parsed.officialAccountSubscriptions)
        ? parsed.officialAccountSubscriptions
        : seed.officialAccountSubscriptions,
      officialPosts: Array.isArray(parsed.officialPosts) ? parsed.officialPosts : seed.officialPosts,
      peopleNearby: Array.isArray(parsed.peopleNearby) ? parsed.peopleNearby : seed.peopleNearby,
      channelStreams: Array.isArray(parsed.channelStreams) ? parsed.channelStreams : seed.channelStreams,
      shakeMatches: Array.isArray(parsed.shakeMatches) ? parsed.shakeMatches : seed.shakeMatches,
      fileTransfers: Array.isArray(parsed.fileTransfers) ? parsed.fileTransfers : seed.fileTransfers,
      communityChannels: Array.isArray(parsed.communityChannels) ? parsed.communityChannels : seed.communityChannels,
      creatorOrders: Array.isArray(parsed.creatorOrders) ? parsed.creatorOrders : seed.creatorOrders,
      localListings: Array.isArray(parsed.localListings) ? parsed.localListings : seed.localListings,
      demandSignals: Array.isArray(parsed.demandSignals) ? parsed.demandSignals : seed.demandSignals,
      storyHighlights: Array.isArray(parsed.storyHighlights) ? parsed.storyHighlights : seed.storyHighlights,
      reviewInsights: Array.isArray(parsed.reviewInsights) ? parsed.reviewInsights : seed.reviewInsights,
      apiConnectors: Array.isArray(parsed.apiConnectors) ? parsed.apiConnectors : seed.apiConnectors,
      searchScopes: Array.isArray(parsed.searchScopes) ? parsed.searchScopes : seed.searchScopes,
      services: Array.isArray(parsed.services) && parsed.services.length >= seed.services.length ? parsed.services : seed.services,
      utilityCards: Array.isArray(parsed.utilityCards) ? parsed.utilityCards : seed.utilityCards,
      utilityBillPayProviders: Array.isArray(parsed.utilityBillPayProviders)
        ? parsed.utilityBillPayProviders
        : seed.utilityBillPayProviders,
      utilityBillPayPayments: Array.isArray(parsed.utilityBillPayPayments)
        ? parsed.utilityBillPayPayments
        : seed.utilityBillPayPayments,
      userSegments: Array.isArray(parsed.userSegments) ? parsed.userSegments : seed.userSegments,
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : seed.favorites,
      savedItems: Array.isArray(parsed.savedItems) ? parsed.savedItems : seed.savedItems,
      threadReadState: Array.isArray(parsed.threadReadState) ? parsed.threadReadState : seed.threadReadState,
      miniAppRecents: Array.isArray(parsed.miniAppRecents) ? parsed.miniAppRecents : seed.miniAppRecents,
      miniAppPermissions: Array.isArray(parsed.miniAppPermissions) ? parsed.miniAppPermissions : seed.miniAppPermissions,
      qrActions: Array.isArray(parsed.qrActions) ? parsed.qrActions : seed.qrActions,
      qrHistory: Array.isArray(parsed.qrHistory) ? parsed.qrHistory : seed.qrHistory,
      serviceContinuity: Array.isArray(parsed.serviceContinuity) ? parsed.serviceContinuity : seed.serviceContinuity
      ,
      listings: Array.isArray(parsed.listings) ? parsed.listings : seed.listings,
      savedSearches: Array.isArray(parsed.savedSearches) ? parsed.savedSearches : seed.savedSearches,
      listingAlerts: Array.isArray(parsed.listingAlerts) ? parsed.listingAlerts : seed.listingAlerts,
      staffMemberRecord: parsed.staffMemberRecord && typeof parsed.staffMemberRecord === "object" ? parsed.staffMemberRecord : seed.staffMemberRecord
    };
  } catch {
    return createSeedState();
  }
}

function writeLocalState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function loadState() {
  return readLocalState();
}

export async function saveState(state) {
  if (state?.profile?.email) {
    const existingProfile = getLocalProfileByStableIdentity(state.profile);
    const durableProfile = mergeDurableProfile(existingProfile, state.profile);
    writeLocalState({ ...state, profile: durableProfile });
    upsertLocalProfile(durableProfile);
    if (state.staffMemberRecord?.email) {
      const records = readLocalStaffMembers();
      records[state.staffMemberRecord.email] = state.staffMemberRecord;
      writeLocalStaffMembers(records);
    }
    return;
  }
  writeLocalState(state);
}

export async function signInProfile(profileDraft) {
  const authMode = profileDraft.authMode || "signup";
  const email = sanitizeEmail(profileDraft.email || "");
  const inviteCode = sanitizeInviteCode(profileDraft.inviteCode);
  if (!email) {
    throw new Error("Email is required.");
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
  if (authMode === "signup" && getLocalProfileByEmail(email)) {
    throw new Error("That email is already registered. Sign in with it or use another email address.");
  }
  if (authMode === "signin" && isFoxHubOwnerEmail(email)) {
    if (!(await verifyFounderManagerPassword(profileDraft.password || ""))) {
      throw new Error("Invalid manager credentials.");
    }
    const nextProfile = buildFounderManagerProfile(email, getLocalProfileByEmail(email));
    upsertLocalProfile(nextProfile);
    const staffMember = upsertLocalStaffMember(nextProfile);
    return {
      profile: nextProfile,
      authenticated: true,
      staffMemberRecord: staffMember,
      backendMode: "local"
    };
  }
  const savedProfile = authMode === "signin" ? getLocalProfileByEmail(email) : null;
  if (authMode === "signin") {
    if (!savedProfile) {
      throw new Error("No registered FoxHub account was found for that email.");
    }
    if (savedProfile.passwordHash && (await sha256Text(profileDraft.password || "")) !== savedProfile.passwordHash) {
      throw new Error("Invalid email or password.");
    }
    if (savedProfile.accessState === "waitlist" && savedProfile.inviteCode) {
      const currentState = readLocalState();
      const approvedInvite = (currentState.invites || []).find((invite) =>
        invite.code === savedProfile.inviteCode &&
        invite.status === "redeemed" &&
        (invite.applicantEmail === email || invite.redeemedBy === email)
      );
      if (approvedInvite) {
        const approvedProfile = {
          ...savedProfile,
          accessState: "priority",
          accessNote: "Sponsor approved invite",
          onboarded: true,
          waitlistEndsAt: ""
        };
        upsertLocalProfile(approvedProfile);
        return {
          profile: approvedProfile,
          authenticated: true,
          staffMemberRecord: null,
          backendMode: "local"
        };
      }
    }
  }
  const wantsInviteAccess = authMode === "signup" && (profileDraft.accessState || "active") !== "waitlist";
  if (wantsInviteAccess) {
    if (!inviteCode) {
      throw new Error("A valid invite code is required for immediate access.");
    }
    const currentState = readLocalState();
    const matchingInvite = (currentState.invites || []).find((invite) => invite.code === inviteCode && invite.status === "active");
    if (!matchingInvite) {
      throw new Error("This invite code is invalid or has already been used.");
    }
    if (isInviteExpired(matchingInvite)) {
      throw new Error("This invite code has expired. Ask for a new invite.");
    }
  }
  const accessState =
    authMode === "signin"
      ? "active"
      : wantsInviteAccess
        ? "waitlist"
        : sanitizeText(profileDraft.accessState || "active", 24) || "active";
  const passwordHash = authMode === "signup" && profileDraft.password ? await sha256Text(profileDraft.password) : "";
  const nextProfile = savedProfile
    ? {
        ...savedProfile,
        displayName: sanitizeText(savedProfile.displayName || savedProfile.name || "", 80),
        name: sanitizeText(savedProfile.name || savedProfile.displayName || "", 80),
        oneId: resolveProfileOneId({ ...savedProfile, email }),
        email,
        zipCode: normalizeZipCode(profileDraft.zipCode || profileDraft.postalCode || savedProfile.zipCode || savedProfile.postalCode),
        postalCode: normalizeZipCode(profileDraft.zipCode || profileDraft.postalCode || savedProfile.zipCode || savedProfile.postalCode),
        accessState: sanitizeText(savedProfile.accessState || "active", 24) || "active",
        accessNote: sanitizeText(savedProfile.accessNote || "Active", 80),
        onboarded: savedProfile.onboarded !== false
      }
    : {
      name: sanitizeText(profileDraft.name || profileDraft.displayName, 80),
      displayName: sanitizeText(profileDraft.name || profileDraft.displayName, 80),
      oneId: resolveProfileOneId(profileDraft),
      handle: normalizeHandle(profileDraft.handle),
      city: sanitizeText(profileDraft.city, 80),
      zipCode: normalizeZipCode(profileDraft.zipCode || profileDraft.postalCode),
      postalCode: normalizeZipCode(profileDraft.zipCode || profileDraft.postalCode),
      bio: sanitizeText(profileDraft.bio || defaultProfile.bio, 280),
      occupation: sanitizeText(profileDraft.occupation || "", 80),
      demographic: sanitizeText(profileDraft.demographic || "", 80),
      pronouns: sanitizeText(profileDraft.pronouns || "", 40),
      website: sanitizeText(profileDraft.website || "", 120),
      availability: sanitizeText(profileDraft.availability || "", 80),
      interests: sanitizeText(profileDraft.interests || "", 160),
      email,
      passwordHash,
      accessState,
      accessNote: sanitizeText(
        profileDraft.accessNote ||
          (wantsInviteAccess
            ? "Sponsor approval pending"
            : accessState === "waitlist"
            ? "Monthly verification review"
            : accessState === "priority"
              ? "Priority access"
              : "Active"),
        80
      ),
      inviteCode,
      sponsorHandle: normalizeSponsorHandle(profileDraft.sponsorHandle),
      waitlistEndsAt: sanitizeText(profileDraft.waitlistEndsAt || (wantsInviteAccess ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : ""), 64),
      onboarded: accessState !== "waitlist",
      tutorialCompleted: Boolean(profileDraft.tutorialCompleted),
      verifiedPerformerSubscribed: Boolean(profileDraft.verifiedPerformerSubscribed),
      verifiedPerformerStatus: sanitizeText(profileDraft.verifiedPerformerStatus || "not_subscribed", 32),
      verifiedPerformerPlan: sanitizeText(profileDraft.verifiedPerformerPlan || "$20/month", 32),
      verifiedPerformerSince: sanitizeText(profileDraft.verifiedPerformerSince || "", 64),
      ageVerified: true,
      ageVerifiedAt: new Date().toISOString()
  };
  upsertLocalProfile(nextProfile);
  if (wantsInviteAccess) {
    const currentState = readLocalState();
    writeLocalState({
      ...currentState,
      invites: (currentState.invites || []).map((invite) =>
        invite.code === inviteCode && invite.status === "active"
          ? {
              ...invite,
              status: "sponsor_pending",
              applicantUid: email,
              applicantEmail: email,
              applicantName: nextProfile.name || nextProfile.handle || "",
              sponsorDecisionAt: "",
              retentionReviewAt: "",
              rapportBoostedAt: "",
              redeemedBy: "",
              redeemedAt: ""
            }
          : invite
      )
    });
  }
  return {
    profile: nextProfile,
    authenticated: nextProfile.accessState !== "waitlist",
    staffMemberRecord: nextProfile.staffAccess || nextProfile.managerAccess || nextProfile.role === "founder" ? upsertLocalStaffMember(nextProfile) : null,
    backendMode: "local"
  };
}

export async function signInWithGoogleProfile(profileDraft = {}) {
  return signInProfile({
    ...profileDraft,
    email: profileDraft.email || "local-google@example.com",
    authMode: "signup"
  });
}

export async function sendMagicLinkProfile(email = "") {
  return {
    email: sanitizeText(email || "local-link@example.com", 160).toLowerCase()
  };
}

export async function sendPasswordResetProfile() {
  throw new Error("Password reset email is available only in the Firebase-backed live mode.");
}

export async function verifyPasswordResetProfile() {
  throw new Error("Password reset codes are available only in the Firebase-backed live mode.");
}

export async function confirmPasswordResetProfile() {
  throw new Error("Password reset is available only in the Firebase-backed live mode.");
}

export async function signOutCurrentProfile() {
  const currentState = readLocalState();
  if (currentState?.profile?.email) {
    upsertLocalProfile(currentState.profile);
  }
  return {
    ...currentState,
    authenticated: false,
    backendMode: "local"
  };
}

export async function updateProfileRecord(profileDraft) {
  const savedProfile = getLocalProfileByStableIdentity(profileDraft);
  const existingProfile = shouldScrubFounderProfile(savedProfile || profileDraft) ? scrubFounderProfileFiller(savedProfile || {}) : savedProfile;
  const draftProfile = shouldScrubFounderProfile(profileDraft) ? scrubFounderProfileFiller(profileDraft) : profileDraft;
  const displayName = firstProfileValue(existingProfile?.name || existingProfile?.displayName, draftProfile.name || draftProfile.displayName, "", 80);
  const hasDraftPhoto = Object.prototype.hasOwnProperty.call(draftProfile, "profilePhoto") || Object.prototype.hasOwnProperty.call(draftProfile, "profilePhotoUrl");
  const sourcePhoto = hasDraftPhoto ? draftProfile : existingProfile || {};
  const profilePhotoUrl = isAcceptedImageDataUrl(sourcePhoto?.profilePhoto?.url || sourcePhoto?.profilePhotoUrl)
    ? String(sourcePhoto.profilePhoto?.url || sourcePhoto.profilePhotoUrl)
    : "";
  const profilePhoto = profilePhotoUrl
    ? {
        id: sanitizeText(sourcePhoto.profilePhoto?.id || "profile-photo", 80),
        name: sanitizeText(sourcePhoto.profilePhoto?.name || sourcePhoto.profilePhotoName || "Profile photo", 120),
        type: sanitizeText(normalizeImageType(sourcePhoto.profilePhoto || { type: sourcePhoto.profilePhotoType }) || sourcePhoto.profilePhotoType || "image", 80),
        url: profilePhotoUrl,
        size: Number(sourcePhoto.profilePhoto?.size || 0)
      }
    : null;
  const nextProfile = {
    ...(existingProfile || {}),
    name: displayName,
    displayName,
    oneId: resolveProfileOneId({ ...(existingProfile || {}), ...draftProfile }),
    handle: firstProfileHandle(existingProfile?.handle, draftProfile.handle),
    city: firstProfileValue(existingProfile?.city, draftProfile.city, "", 80),
    zipCode: normalizeZipCode(draftProfile.zipCode || draftProfile.postalCode || existingProfile?.zipCode || existingProfile?.postalCode),
    postalCode: normalizeZipCode(draftProfile.zipCode || draftProfile.postalCode || existingProfile?.zipCode || existingProfile?.postalCode),
    bio: firstProfileValue(existingProfile?.bio, draftProfile.bio, defaultProfile.bio, 280),
    occupation: firstProfileValue(existingProfile?.occupation, draftProfile.occupation, "", 80),
    demographic: firstProfileValue(existingProfile?.demographic, draftProfile.demographic, "", 80),
    pronouns: firstProfileValue(existingProfile?.pronouns, draftProfile.pronouns, "", 40),
    website: firstProfileValue(existingProfile?.website, draftProfile.website, "", 120),
    availability: firstProfileValue(existingProfile?.availability, draftProfile.availability, "", 80),
    interests: firstProfileValue(existingProfile?.interests, draftProfile.interests, "", 160),
    profilePhoto,
    profilePhotoUrl,
    profilePhotoName: profilePhoto?.name || "",
    profilePhotoType: profilePhoto?.type || "",
    email: sanitizeEmail(existingProfile?.email || draftProfile.email || ""),
    accessState: firstProfileValue(existingProfile?.accessState, draftProfile.accessState, "active", 24) || "active",
    accessNote: firstProfileValue(existingProfile?.accessNote, draftProfile.accessNote, "Active", 80),
    inviteCode: sanitizeInviteCode(draftProfile.inviteCode) || sanitizeInviteCode(existingProfile?.inviteCode),
    sponsorHandle: normalizeSponsorHandle(draftProfile.sponsorHandle) || normalizeSponsorHandle(existingProfile?.sponsorHandle),
    waitlistEndsAt: firstProfileValue(existingProfile?.waitlistEndsAt, draftProfile.waitlistEndsAt, "", 64),
    onboarded: true,
    tutorialCompleted: Boolean(draftProfile.tutorialCompleted ?? existingProfile?.tutorialCompleted),
    verifiedPerformerSubscribed: Boolean(draftProfile.verifiedPerformerSubscribed ?? existingProfile?.verifiedPerformerSubscribed),
    verifiedPerformerStatus: firstProfileValue(existingProfile?.verifiedPerformerStatus, draftProfile.verifiedPerformerStatus, "not_subscribed", 32),
    verifiedPerformerPlan: firstProfileValue(existingProfile?.verifiedPerformerPlan, draftProfile.verifiedPerformerPlan, "$20/month", 32),
    verifiedPerformerSince: firstProfileValue(existingProfile?.verifiedPerformerSince, draftProfile.verifiedPerformerSince, "", 64),
    ageVerified: Boolean(draftProfile.ageVerified ?? existingProfile?.ageVerified),
    ageVerifiedAt: firstProfileValue(existingProfile?.ageVerifiedAt, draftProfile.ageVerifiedAt, "", 64),
    role: sanitizeText(existingProfile?.role || draftProfile.role || "", 32),
    managerAccess: Boolean(existingProfile?.managerAccess ?? draftProfile.managerAccess),
    staffAccess: Boolean(existingProfile?.staffAccess ?? draftProfile.staffAccess)
  };
  upsertLocalProfile(nextProfile);
  return nextProfile;
}

export async function updateApplicantAccessRecord(email = "", accessPatch = {}) {
  const key = sanitizeEmail(email);
  if (!key) return null;
  const existing = getLocalProfileByEmail(key);
  if (!existing) return null;
  const nextProfile = {
    ...existing,
    accessState: sanitizeText(accessPatch.accessState || existing.accessState || "waitlist", 24),
    accessNote: sanitizeText(accessPatch.accessNote || existing.accessNote || "Application under review", 120),
    onboarded: Boolean(accessPatch.onboarded ?? existing.onboarded),
    waitlistEndsAt: accessPatch.waitlistEndsAt === "" ? "" : sanitizeText(accessPatch.waitlistEndsAt || existing.waitlistEndsAt || "", 64),
    reviewedAt: sanitizeText(accessPatch.reviewedAt || existing.reviewedAt || "", 64),
    reviewedBy: sanitizeText(accessPatch.reviewedBy || existing.reviewedBy || "", 80)
  };
  upsertLocalProfile(nextProfile);
  return nextProfile;
}

export async function createInviteRecord(payload = {}, profile = {}) {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const code = `FOX-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const record = {
    id: `invite-${Date.now()}`,
    code,
    label: sanitizeText(payload.label || "Profile invite", 80),
    note: sanitizeText(payload.note || "Immediate-access invite", 160),
    createdBy: normalizeHandle(profile.handle) || sanitizeText(profile.name || "FoxHub member", 80),
    createdByHandle: normalizeHandle(profile.handle),
    status: "active",
    createdAt: nowIso,
    expiresAt: new Date(now + INVITE_EXPIRATION_MS).toISOString(),
    applicantUid: "",
    applicantEmail: "",
    applicantName: "",
    sponsorDecisionAt: "",
    retentionReviewAt: "",
    rapportBoostedAt: "",
    redeemedBy: "",
    redeemedAt: ""
  };
  const currentState = readLocalState();
  const nextInvites = [
    record,
    ...(currentState.invites || []).map((invite) => expirePreviousInvite(invite, nowIso))
  ].slice(0, 40);
  writeLocalState({ ...currentState, invites: nextInvites });
  return record;
}

export async function reviewSponsorInviteRecord(inviteId = "", decision = "approve") {
  const currentState = readLocalState();
  const approved = decision === "approve";
  let updatedInvite = null;
  const invites = (currentState.invites || []).map((invite) => {
    if (invite.id !== inviteId || invite.status !== "sponsor_pending") return invite;
    updatedInvite = {
      ...invite,
      status: approved ? "redeemed" : "denied",
      sponsorDecisionAt: new Date().toISOString(),
      retentionReviewAt: approved ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : "",
      rapportBoostedAt: "",
      redeemedBy: approved ? invite.applicantEmail || "" : "",
      redeemedAt: approved ? new Date().toISOString() : ""
    };
    return updatedInvite;
  });
  if (!updatedInvite) {
    throw new Error("No sponsor-pending invite was found.");
  }
  const applicantContact = approved
    ? buildInviteConnectionContact(
        {
          id: updatedInvite.applicantEmail || updatedInvite.applicantUid || "",
          email: updatedInvite.applicantEmail || "",
          name: updatedInvite.applicantName || updatedInvite.applicantEmail || "Invited member",
          handle: updatedInvite.applicantName || "invited-member"
        },
        { city: "Unknown" }
      )
    : null;
  const contacts = approved && applicantContact && !(currentState.contacts || []).some((contact) => contact.id === applicantContact.id || contact.email === applicantContact.email)
    ? [applicantContact, ...(currentState.contacts || [])]
    : (currentState.contacts || []);
  writeLocalState({ ...currentState, invites, contacts });
  return updatedInvite;
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
  return {
    id: Date.now(),
    author: "You",
    text,
    attachments,
    time: "Now",
    mine: true,
    status: "sent"
  };
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
  return {
    id: Date.now(),
    title: sanitizeText(event.title, 80),
    amount: sanitizeText(event.amount, 24),
    meta: sanitizeText(event.meta, 160)
  };
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
  return {
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
  return {
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

export function subscribeToState(onState) {
  onState(readLocalState());

  const handleStorage = () => {
    onState(readLocalState());
  };

  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}
