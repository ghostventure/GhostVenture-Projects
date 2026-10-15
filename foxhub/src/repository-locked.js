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
  favorites,
  listingAlerts,
  listings,
  savedItems,
  savedSearches,
  searchScopes,
  serviceContinuity,
  services,
  threads,
  utilityCards,
  utilityBillPayPayments,
  utilityBillPayProviders,
  userSegments,
  userRecords,
  walletEvents,
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
  officialPosts,
  qrActions
  ,
  threadReadState
} from "./data.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createLockedState() {
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
    channels: clone(channels),
    officialAccounts: clone(officialAccounts),
    officialPosts: clone(officialPosts),
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
    listings: clone(listings),
    savedSearches: clone(savedSearches),
    listingAlerts: clone(listingAlerts),
    activeCircleId: circles[0].id,
    activeMiniAppId: miniApps[0].id,
    selectedThreadId: threads[0].id,
    backendMode: "locked",
    securityLock: {
      title: "Secure mobile mode",
      detail: "This native FoxHub build does not allow the writable local repository. Connect the Firebase backend before using iOS or Android builds."
    }
  };
}

function lockedError() {
  return new Error("FoxHub native builds require the Firebase-backed secure mode. Local writable mode is disabled on iOS and Android.");
}

export async function loadState() {
  return createLockedState();
}

export async function saveState() {}

export async function signInProfile() {
  throw lockedError();
}

export async function signInWithGoogleProfile() {
  throw lockedError();
}

export async function sendMagicLinkProfile() {
  throw lockedError();
}

export async function sendPasswordResetProfile() {
  throw lockedError();
}

export async function verifyPasswordResetProfile() {
  throw lockedError();
}

export async function confirmPasswordResetProfile() {
  throw lockedError();
}

export async function signOutCurrentProfile() {
  return createLockedState();
}

export async function updateProfileRecord() {
  throw lockedError();
}

export async function updateApplicantAccessRecord() {
  throw lockedError();
}

export async function createMessageRecord() {
  throw lockedError();
}

export async function createWalletEventRecord() {
  throw lockedError();
}

export async function createMomentRecord() {
  throw lockedError();
}

export async function addFavoriteRecord() {
  throw lockedError();
}

export async function addSavedItemRecord() {
  throw lockedError();
}

export async function addMiniAppRecentRecord() {
  throw lockedError();
}

export async function addMiniAppPermissionRecord() {
  throw lockedError();
}

export async function createQrActionRecord() {
  throw lockedError();
}

export async function createDirectThreadRecord() {
  throw lockedError();
}

export async function createMediaClipRecord() {
  throw lockedError();
}

export async function createStoryBundleRecord() {
  throw lockedError();
}

export async function createAuctionBidRecord() {
  throw lockedError();
}

export async function createCartRecord() {
  throw lockedError();
}

export async function createReviewRecord() {
  throw lockedError();
}

export async function createRatingRecord() {
  throw lockedError();
}

export async function createDocumentRecord() {
  throw lockedError();
}

export async function createOperatorActionRecord() {
  throw lockedError();
}

export async function createRouteRecord() {
  throw lockedError();
}

export async function createEndorsementRecord() {
  throw lockedError();
}

export async function createJobPostRecord() {
  throw lockedError();
}

export async function createMiniProgramManifestRecord() {
  throw lockedError();
}

export async function createCallSessionRecord() {
  throw lockedError();
}

export async function createInviteRecord() {
  throw lockedError();
}

export async function reviewSponsorInviteRecord() {
  throw lockedError();
}

export function subscribeToState(onState) {
  onState(createLockedState());
  return () => {};
}
