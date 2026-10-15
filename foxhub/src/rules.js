import { listingCategories, listingTags, listingTypes } from "./data.js";
import { buildOneId } from "./identity.js";

export function sanitizeText(value = "", max = 280) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}

export const TRUST_TIER_ORDER = ["AA", "A", "B", "C", "D", "F"];

const TRUST_TIER_META = {
  AA: {
    label: "Highly Trustworthy",
    score: 5,
    summary: "Full wallet access with elevated trust.",
    restriction: "Full peer transfer, merchant pay, and QR payment access."
  },
  A: {
    label: "Trustworthy",
    score: 4,
    summary: "Strong trust with normal transaction access.",
    restriction: "Standard peer transfer and merchant payment access."
  },
  B: {
    label: "Some Trust Issues",
    score: 3,
    summary: "Usable, but larger transactions deserve extra review.",
    restriction: "Merchant and larger payments are reviewed before release."
  },
  C: {
    label: "Needs Trust Improvement",
    score: 2,
    summary: "Restricted until trust improves.",
    restriction: "Peer transfers are low-limit only. Merchant and QR pay are held."
  },
  D: {
    label: "Take Great Caution",
    score: 1,
    summary: "High-friction counterparties with sharp restrictions.",
    restriction: "Peer sends, merchant pay, and QR pay are blocked."
  },
  F: {
    label: "Untrustworthy",
    score: 0,
    summary: "Do not transact until trust is repaired.",
    restriction: "All transaction-facing features are blocked."
  }
};

export function normalizeHandle(handle = "") {
  const cleaned = String(handle).replace(/[^A-Za-z0-9_.]/g, "").slice(0, 39);
  return cleaned ? (cleaned.startsWith("@") ? cleaned : `@${cleaned}`) : "";
}

export function sanitizeInviteCode(value = "") {
  return String(value).replace(/[^A-Za-z0-9-]/g, "").toUpperCase().slice(0, 24);
}

export function normalizeSponsorHandle(handle = "") {
  const cleaned = String(handle).replace(/[^A-Za-z0-9_.]/g, "").slice(0, 39);
  if (!cleaned) return "";
  return cleaned.startsWith("@") ? cleaned : `@${cleaned}`;
}

export function normalizeZipCode(value = "") {
  return String(value || "").replace(/[^\d-]/g, "").slice(0, 10);
}

export const FOXHUB_RESERVED_EMAIL_ATTEMPT_LIMIT = 3;
export const FOXHUB_RESERVED_EMAIL_MESSAGE =
  "Use a current personal email for member sign-up. FoxHub-domain emails are reserved for approved staff and management accounts.";
export const FOXHUB_RESERVED_EMAIL_LOCKED_MESSAGE =
  "This FoxHub-domain email is blocked from member sign-up. Staff email addresses must be approved through FoxHub management.";
export const FOXHUB_OWNER_EMAILS = ["solidartentertainment@gmail.com", "founder@foxhubapp.com", "founder@foxhub.com"];
export const FOXHUB_PRIMARY_OWNER_EMAIL = FOXHUB_OWNER_EMAILS[0];

export function isFoxHubOwnerEmail(email = "") {
  const normalized = sanitizeText(email, 160).toLowerCase();
  return FOXHUB_OWNER_EMAILS.includes(normalized);
}

export function isFoxHubStaffEmail(email = "") {
  const domain = getFoxHubEmailDomain(email);
  return domain.includes("foxhub");
}

export function hasFoxHubStaffAccess(profile = {}) {
  return isFoxHubStaffEmail(profile.email || "");
}

export function hasFoxHubManagementAccess(profile = {}) {
  return hasFoxHubStaffAccess(profile);
}

export function hasApprovedVendorAccess(profile = {}) {
  if (hasFoxHubStaffAccess(profile)) return false;
  const merchantAccount = profile.merchantAccount || {};
  const status = sanitizeText(
    merchantAccount.status ||
      profile.merchantStatus ||
      profile.vendorStatus ||
      profile.vendorApprovalStatus ||
      profile.merchantApprovalStatus ||
      "",
    32
  ).toLowerCase();
  return ["approved", "active", "verified"].includes(status);
}

export function getAccountEmblem(profile = {}) {
  if (hasFoxHubStaffAccess(profile)) {
    return { type: "staff", label: "FoxHub Staff", initials: "FS" };
  }
  if (hasApprovedVendorAccess(profile)) {
    return { type: "vendor", label: "Vendor", initials: "V" };
  }
  return { type: "member", label: "Member", initials: "M" };
}

export function getFoxHubEmailDomain(email = "") {
  const normalized = sanitizeText(email, 160).toLowerCase();
  return normalized.includes("@") ? normalized.split("@").pop() : "";
}

export function isFoxHubDomainEmail(email = "") {
  const domain = getFoxHubEmailDomain(email);
  return domain.includes("foxhub");
}

export function getFoxHubReservedEmailBlockMessage(attempts = 1) {
  return attempts >= FOXHUB_RESERVED_EMAIL_ATTEMPT_LIMIT
    ? FOXHUB_RESERVED_EMAIL_LOCKED_MESSAGE
    : FOXHUB_RESERVED_EMAIL_MESSAGE;
}

export function isAtLeast18(birthDateInput) {
  if (!birthDateInput) return false;
  const date = new Date(`${birthDateInput}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const beforeBirthday =
    now.getMonth() < date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() < date.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 18;
}

export function normalizeProfileDraft(profile = {}) {
  const displayName = sanitizeText(profile.name || profile.displayName, 80);
  const zipCode = normalizeZipCode(profile.zipCode || profile.postalCode || "");
  const photoSource = profile.profilePhoto && typeof profile.profilePhoto === "object" ? profile.profilePhoto : {};
  const profilePhotoUrl = String(photoSource.url || profile.profilePhotoUrl || "").trim();
  const profilePhoto = profilePhotoUrl
    ? {
        id: sanitizeText(photoSource.id || "profile-photo", 80),
        name: sanitizeText(photoSource.name || profile.profilePhotoName || "Profile photo", 120),
        type: sanitizeText(photoSource.type || profile.profilePhotoType || "image", 80),
        url: profilePhotoUrl,
        size: Number(photoSource.size || profile.profilePhotoSize || 0)
      }
    : null;
  return {
    oneId: sanitizeText(profile.oneId || buildOneId(profile.email || profile.handle || displayName), 32),
    name: displayName,
    displayName,
    handle: normalizeHandle(profile.handle),
    city: sanitizeText(profile.city, 80),
    zipCode,
    postalCode: zipCode,
    bio: sanitizeText(profile.bio, 280),
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
    accessState: sanitizeText(profile.accessState || "active", 24) || "active",
    accessNote: sanitizeText(profile.accessNote || "", 80),
    inviteCode: sanitizeInviteCode(profile.inviteCode),
    sponsorHandle: normalizeSponsorHandle(profile.sponsorHandle),
    waitlistEndsAt: sanitizeText(profile.waitlistEndsAt || "", 64),
    email: sanitizeText(profile.email || "", 160).toLowerCase(),
    tutorialCompleted: Boolean(profile.tutorialCompleted),
    verifiedPerformerSubscribed: Boolean(profile.verifiedPerformerSubscribed),
    verifiedPerformerStatus: sanitizeText(profile.verifiedPerformerStatus || "not_subscribed", 32),
    verifiedPerformerPlan: sanitizeText(profile.verifiedPerformerPlan || "$20/month", 32),
    verifiedPerformerSince: sanitizeText(profile.verifiedPerformerSince || "", 64)
  };
}

export function validateRequiredProfileFields(profile = {}) {
  if (hasFoxHubManagementAccess(profile) || isFoxHubOwnerEmail(profile.email || "")) {
    return "";
  }
  const normalized = normalizeProfileDraft(profile);
  if (!normalized.name || !normalized.handle || !normalized.city) {
    return "Public display name, username, and city are required.";
  }
  return "";
}

export function buildAccessModel(draft = {}) {
  const inviteCode = sanitizeInviteCode(draft.inviteCode);
  const sponsorHandle = normalizeSponsorHandle(draft.sponsorHandle);
  if (inviteCode || sponsorHandle) {
    return {
      accessState: "priority",
      accessNote: "Priority access",
      inviteCode,
      sponsorHandle,
      waitlistEndsAt: ""
    };
  }

  const waitlistEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return {
    accessState: "waitlist",
    accessNote: "Monthly verification review",
    inviteCode: "",
    sponsorHandle: "",
    waitlistEndsAt
  };
}

export function isWaitlistProfile(profile = {}) {
  return profile.accessState === "waitlist";
}

export function canOpenOnboarding(profile = {}) {
  if (hasFoxHubManagementAccess(profile) || isFoxHubOwnerEmail(profile.email || "")) {
    return false;
  }
  return Boolean(profile.email) && !isWaitlistProfile(profile);
}

export function getAccessStatusLabel(profile = {}) {
  return isWaitlistProfile(profile) ? "Waiting" : profile.accessNote || "Open";
}

export function getAccessGateMessage(profile = {}) {
  if (!isWaitlistProfile(profile)) {
    return "Sign in or create an account first, then finish the FoxHub identity card.";
  }

  if (profile.waitlistEndsAt) {
    return `No invite was attached, so this account is in the monthly verification queue until ${new Date(profile.waitlistEndsAt).toLocaleString()}.`;
  }

  return "No invite was attached, so this account is in the monthly verification queue.";
}

export function getEntryDescription(backendMode, isLockedMode) {
  if (isLockedMode) {
    return "This mobile app needs the live FoxHub connection before people can sign in.";
  }

  if (backendMode === "firebase") {
    return "Use the email and password you created during sign-up. An invite gets you in faster. Without one, a manager reviews the account before everything opens.";
  }

  return "Try the experience with a sample identity. You can also preview how invites and account review will feel for new people.";
}

export function getAuthSubmitLabel(backendMode, authMode, hasInvite) {
  if (backendMode === "firebase") {
    if (authMode === "signup") {
      return hasInvite ? "Create account with invite" : "Request access";
    }
    return "Sign in";
  }

  return hasInvite ? "Enter alpha with invite" : "Enter monthly review";
}

export const THEME_OPTIONS = [
  { id: "green-composite", label: "Green Composite" },
  { id: "light", label: "Day" },
  { id: "dark", label: "Night" },
  { id: "matrix", label: "Matrix" },
  { id: "forest", label: "Forest" },
  { id: "ocean", label: "Ocean" },
  { id: "ember", label: "Ember" },
  { id: "slate", label: "Slate" },
  { id: "rose", label: "Rose" },
  { id: "contrast", label: "High Contrast" },
  { id: "lavender", label: "Lavender" },
  { id: "cyberpunk", label: "Cyberpunk" },
  { id: "mint", label: "Mint" },
  { id: "midnight", label: "Midnight" },
  { id: "solar", label: "Solar" },
  { id: "arctic", label: "Arctic" },
  { id: "grape", label: "Grape" },
  { id: "premium-silver", label: "Premium Silver - $10/month" },
  { id: "premium-gold", label: "Premium Gold - $20/month" },
  { id: "premium-marble", label: "Dark Marble Premium - $30/month" }
];

export const PREMIUM_THEME_IDS = ["premium-silver", "premium-gold", "premium-marble"];

export function isPremiumTheme(themeId = "") {
  return PREMIUM_THEME_IDS.includes(themeId);
}

export function getPremiumThemeEntitlements(profile = {}) {
  const sources = [
    profile.premiumThemes,
    profile.themeEntitlements,
    profile.premiumThemeAccess,
    profile.activeThemeSubscriptions,
    profile.paidThemes
  ];
  return sources
    .flatMap((source) => {
      if (Array.isArray(source)) return source;
      if (source && typeof source === "object") {
        return Object.entries(source)
          .filter(([, value]) => value === true || value === "active" || value === "paid" || value === "subscribed")
          .map(([key]) => key);
      }
      if (typeof source === "string") return [source];
      return [];
    })
    .map((item) => sanitizeText(item, 40).toLowerCase())
    .filter(Boolean);
}

export function canUseTheme(profile = {}, themeId = "") {
  if (!isPremiumTheme(themeId)) return true;
  if (hasFoxHubStaffAccess(profile)) return true;
  const entitlements = getPremiumThemeEntitlements(profile);
  return entitlements.includes("all") || entitlements.includes(themeId);
}

export function getThemeToggleLabel(theme) {
  const index = THEME_OPTIONS.findIndex((item) => item.id === theme);
  const nextTheme = THEME_OPTIONS[(index + 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length] || THEME_OPTIONS[0];
  return `${nextTheme.label} mode`;
}

export function normalizeTrustTier(value = "") {
  return TRUST_TIER_ORDER.includes(value) ? value : "B";
}

export function getTrustTierMeta(tier = "B") {
  return TRUST_TIER_META[normalizeTrustTier(tier)];
}

export function gradeToScore(grade = "B") {
  return getTrustTierMeta(grade).score;
}

export function averageToTrustTier(value) {
  if (value >= 4.75) return "AA";
  if (value >= 4) return "A";
  if (value >= 3) return "B";
  if (value >= 2) return "C";
  if (value >= 1) return "D";
  return "F";
}

export function getContactTrustTier(contact = {}) {
  if (contact.trustTier) return normalizeTrustTier(contact.trustTier);
  if (typeof contact.peerRatingAverage === "number") return averageToTrustTier(contact.peerRatingAverage);
  if ((contact.relationshipScore || 0) >= 93) return "AA";
  if ((contact.relationshipScore || 0) >= 85) return "A";
  if ((contact.relationshipScore || 0) >= 70) return "B";
  if ((contact.relationshipScore || 0) >= 55) return "C";
  if ((contact.relationshipScore || 0) >= 40) return "D";
  return "F";
}

export function getTrustTransactionPolicy(tier = "B") {
  switch (normalizeTrustTier(tier)) {
    case "AA":
    case "A":
      return {
        send: "allow",
        merchant: "allow",
        "qr-pay": "allow",
        maxPeerAmount: 2000
      };
    case "B":
      return {
        send: "review_over_limit",
        merchant: "review",
        "qr-pay": "review",
        maxPeerAmount: 500
      };
    case "C":
      return {
        send: "review_over_limit",
        merchant: "review",
        "qr-pay": "review",
        maxPeerAmount: 250
      };
    case "D":
      return {
        send: "block",
        merchant: "block",
        "qr-pay": "block",
        maxPeerAmount: 0
      };
    default:
      return {
        send: "block",
        merchant: "block",
        "qr-pay": "block",
        maxPeerAmount: 0
      };
  }
}

export function getTrustRestrictionLine(tier = "B") {
  return getTrustTierMeta(tier).restriction;
}

export function getVisibleCount(activeTab, state) {
  switch (activeTab) {
    case "hub":
      return state.services.length + state.savedItems.length + state.officialPosts.length;
    case "chat":
      return state.threads.length;
    case "circles":
      return state.contacts.length + state.circles.length + state.channels.length;
    case "wallet":
      return state.walletEvents.length + state.utilityCards.length;
    case "discover":
      return state.serviceContinuity.length + state.searchScopes.length + state.officialAccounts.length;
    case "connectors":
      return state.apiConnectors.length;
    case "staff":
      return (state.userRecords || []).length + (state.verificationCases || []).length + (state.moderationCases || []).length;
    case "market":
      return state.listings.length;
    default:
      return 0;
  }
}

export function getContextActions(activeTab) {
  const map = {
    hub: [
      { id: "chat", label: "Social", meta: "Start with people" },
      { id: "circles", label: "Rapport", meta: "Check trust context" },
      { id: "growth", label: "Communal", meta: "Open shared spaces" },
      { id: "discover", label: "Services / Merchant", meta: "Launch trusted utility" }
    ],
    market: [
      { id: "circles", label: "Rapport", meta: "Vet the person" },
      { id: "discover", label: "Services / Merchant", meta: "Book or route" },
      { id: "hub", label: "Home", meta: "Rapport loop" }
    ],
    chat: [
      { id: "chat", label: "Social", meta: "Recent threads" },
      { id: "circles", label: "Rapport", meta: "People and trust" },
      { id: "growth", label: "Communal", meta: "Shared spaces" }
    ],
    circles: [
      { id: "circles", label: "Rapport", meta: "People and circles" },
      { id: "chat", label: "Social", meta: "Message directly" },
      { id: "growth", label: "Communal", meta: "Coordinate together" },
      { id: "discover", label: "Services / Merchant", meta: "Use shared tools" }
    ],
    wallet: [
      { id: "wallet", label: "Pay", meta: "Wallet and activity" },
      { id: "circles", label: "Rapport", meta: "Trust before transfer" },
      { id: "discover", label: "Services / Merchant", meta: "Utility entry" }
    ],
    discover: [
      { id: "discover", label: "Services / Merchant", meta: "Mini-apps and tools" },
      { id: "circles", label: "Rapport", meta: "Trust context" },
      { id: "chat", label: "Social", meta: "Return to people" },
      { id: "wallet", label: "Pay", meta: "Payments nearby" }
    ],
    connectors: [
      { id: "connectors", label: "Tools", meta: "Integration readiness" },
      { id: "discover", label: "Services / Merchant", meta: "Operational surfaces" },
      { id: "wallet", label: "Pay", meta: "Transaction rails" }
    ],
    staff: [
      { id: "staff", label: "Staff", meta: "Member queue" },
      { id: "circles", label: "Rapport", meta: "People and trust" },
      { id: "discover", label: "Services / Merchant", meta: "Operator tools" },
      { id: "blueprint", label: "Organizer", meta: "Admin components" }
    ],
    growth: [
      { id: "growth", label: "Communal", meta: "Rooms and local loops" },
      { id: "chat", label: "Social", meta: "Group conversation" },
      { id: "discover", label: "Services / Merchant", meta: "Shared utility" }
    ]
  };
  return map[activeTab] || map.hub;
}

export function getPinnedThreads(threads = []) {
  return threads.filter((thread) => thread.unreadCount || thread.type === "official").slice(0, 3);
}

export function getVisibleThreads(threads = [], chatFilter = "all") {
  const pinnedThreads = getPinnedThreads(threads);
  return threads.filter((thread) => {
    if (chatFilter === "unread") return (thread.unreadCount || 0) > 0;
    if (chatFilter === "pinned") return pinnedThreads.some((pinned) => pinned.id === thread.id);
    return true;
  });
}

export function officialThreadIdForAccount(accountId) {
  const officialThreadMap = {
    "foxhub-news": "foxhub-newsroom",
    "atl-culture": "atl-culture-wire",
    "wallet-watch": "wallet-watch"
  };

  return officialThreadMap[accountId] || "";
}

export function getOwnTrustTier(profile = {}) {
  if (profile.trustTier) return normalizeTrustTier(profile.trustTier);
  if (profile.accessState === "priority") return "A";
  if (profile.accessState === "active") return "B";
  if (profile.accessState === "waitlist") return "C";
  return "B";
}

const LISTING_POSTING_POLICIES = {
  AA: {
    allowFeatured: true,
    allowVerified: true,
    reviewCategories: [],
    blockCategories: [],
    priceLimit: Infinity
  },
  A: {
    allowFeatured: true,
    allowVerified: true,
    reviewCategories: [],
    blockCategories: [],
    priceLimit: 2200
  },
  B: {
    allowFeatured: false,
    allowVerified: false,
    reviewCategories: ["Housing", "Jobs", "Gigs", "Services"],
    blockCategories: [],
    priceLimit: 1500
  },
  C: {
    allowFeatured: false,
    allowVerified: false,
    reviewCategories: ["For Sale", "Community"],
    blockCategories: ["Housing", "Jobs", "Gigs", "Services"],
    priceLimit: 800
  },
  D: {
    allowFeatured: false,
    allowVerified: false,
    reviewCategories: [],
    blockCategories: "all",
    priceLimit: 0
  },
  F: {
    allowFeatured: false,
    allowVerified: false,
    reviewCategories: [],
    blockCategories: "all",
    priceLimit: 0
  }
};

function listingReason(code, severity, message, basis) {
  return { code, severity, message, basis };
}

export function evaluateListingPost({ trustTier, category, type, price = 0, featured = false, verified = false }) {
  const normalizedTier = normalizeTrustTier(trustTier);
  const policy = LISTING_POSTING_POLICIES[normalizedTier];
  const reasons = [];
  const sanitizedCategory = typeof category === "string" ? category : "";

  if (policy.blockCategories === "all" || (Array.isArray(policy.blockCategories) && policy.blockCategories.includes(sanitizedCategory))) {
    reasons.push(
      listingReason(
        "listing_tier_block",
        "block",
        `FoxHub blocked this listing because trust tier ${normalizedTier} cannot publish ${sanitizedCategory} postings.`,
        getTrustRestrictionLine(normalizedTier)
      )
    );
  }

  if (policy.reviewCategories.includes(sanitizedCategory)) {
    reasons.push(
      listingReason(
        "listing_tier_review",
        "review",
        `FoxHub held this listing because ${sanitizedCategory} postings require review for tier ${normalizedTier}.`,
        getTrustRestrictionLine(normalizedTier)
      )
    );
  }

  if (featured && !policy.allowFeatured) {
    reasons.push(
      listingReason(
        "listing_featured_review",
        "review",
        `Featured listings are reserved for higher-trust tiers; FoxHub is holding this submission for review.`,
        getTrustRestrictionLine(normalizedTier)
      )
    );
  }

  if (verified && !policy.allowVerified) {
    reasons.push(
      listingReason(
        "listing_verified_review",
        "review",
        "FoxHub review is required before verifying this seller due to the current trust tier.",
        getTrustRestrictionLine(normalizedTier)
      )
    );
  }

  if (price > policy.priceLimit) {
    reasons.push(
      listingReason(
        "listing_price_review",
        "review",
        `FoxHub held this listing because tier ${normalizedTier} caps spikes above $${policy.priceLimit}.`,
        getTrustRestrictionLine(normalizedTier)
      )
    );
  }

  const status = reasons.some((reason) => reason.severity === "block")
    ? "block"
    : reasons.length
      ? "review"
      : "allow";

  return {
    tier: normalizedTier,
    status,
    reasons,
    maxPrice: policy.priceLimit,
    allowFeatured: policy.allowFeatured,
    allowVerified: policy.allowVerified,
    restriction: getTrustRestrictionLine(normalizedTier)
  };
}

export function getListingCategories() {
  return listingCategories;
}

export function getListingTypes() {
  return listingTypes;
}

export function getListingTags() {
  return listingTags;
}

function escapeSearchPattern(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchesListingSearch(listing = {}, search = {}) {
  if (search.category && listing.category !== search.category) return false;
  if (search.city && listing.city && listing.city.toLowerCase() !== search.city.toLowerCase()) return false;
  if (search.keywords) {
    const pattern = new RegExp(escapeSearchPattern(search.keywords), "i");
    if (!pattern.test(listing.title) && !pattern.test(listing.description) && !(listing.tags || []).some((tag) => pattern.test(tag))) {
      return false;
    }
  }
  if (search.currency && listing.currency !== search.currency) return false;
  return true;
}

export function buildListingAlert(search = {}, listing = {}) {
  return {
    id: `alert-${Date.now()}`,
    listingId: listing.id,
    title: listing.title,
    summary: `Matches ${search.name}`,
    timestamp: new Date().toISOString()
  };
}
