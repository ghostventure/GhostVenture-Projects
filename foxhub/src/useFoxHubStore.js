import { useEffect, useRef, useState } from "react";
import {
  addFavoriteRecord,
  createAuctionBidRecord,
  createCallSessionRecord,
  createInviteRecord,
  reviewSponsorInviteRecord,
  createCartRecord,
  createEndorsementRecord,
  createJobPostRecord,
  createMediaClipRecord,
  loadState,
  addMiniAppPermissionRecord,
  addMiniAppRecentRecord,
  createMiniProgramManifestRecord,
  createRatingRecord,
  createDocumentRecord,
  createOperatorActionRecord,
  createReviewRecord,
  createRouteRecord,
  addSavedItemRecord,
  createDirectThreadRecord,
  sendMagicLinkProfile,
  createMessageRecord,
  createMomentRecord,
  createQrActionRecord,
  createStoryBundleRecord,
  createWalletEventRecord,
  confirmPasswordResetProfile,
  saveState,
  sendPasswordResetProfile,
  signInProfile,
  signInWithGoogleProfile,
  signOutCurrentProfile,
  subscribeToState,
  updateApplicantAccessRecord,
  updateProfileRecord,
  verifyPasswordResetProfile
} from "./repository.js";
import { averageToTrustTier, gradeToScore, hasFoxHubManagementAccess, normalizeTrustTier, normalizeZipCode } from "./rules.js";

function isFounderManagerProfile(profile = {}) {
  return hasFoxHubManagementAccess(profile);
}

function advanceOwnMessageStatus(current, threadId, messageId, status) {
  return {
    ...current,
    threads: current.threads.map((thread) =>
      thread.id === threadId
        ? {
            ...thread,
            messages: thread.messages.map((message) =>
              message.id === messageId && message.mine ? { ...message, status } : message
            )
          }
        : thread
    )
  };
}

function upsertReputationSnapshot(snapshots = [], snapshot) {
  return [snapshot, ...(snapshots || []).filter((item) => !(item.targetType === snapshot.targetType && item.targetId === snapshot.targetId))].slice(0, 60);
}

function buildContactSnapshot(contact = {}, lastRatedAt = "") {
  return {
    id: `rep-contact-${contact.id}`,
    targetType: "contact",
    targetId: contact.id,
    label: contact.displayName || contact.name || contact.handle || "Contact",
    averageRating: Number.isFinite(contact.peerRatingAverage) ? Number(contact.peerRatingAverage.toFixed(1)) : 0,
    ratingCount: Number.isFinite(contact.peerRatingCount) ? contact.peerRatingCount : 0,
    trustTier: contact.trustTier || "B",
    verification: contact.verificationLevel || "unverified",
    lastRatedAt
  };
}

function buildShopSnapshot(shop = {}, reviews = [], lastRatedAt = "") {
  const filteredReviews = (reviews || []).filter((item) => item.shopId === shop.id && item.status !== "removed");
  const ratingCount = filteredReviews.length || Number(shop.reviewCount) || 0;
  const averageRating = filteredReviews.length
    ? Number((filteredReviews.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) / filteredReviews.length).toFixed(1))
    : Number(shop.rating) || 0;
  return {
    id: `rep-shop-${shop.id}`,
    targetType: "shop",
    targetId: shop.id,
    label: shop.name || "Shop",
    averageRating,
    ratingCount,
    trustTier: averageToTrustTier(averageRating || 3),
    verification: "storefront verified",
    lastRatedAt
  };
}

function makeAuditEvent({ type = "system", action = "update", actorId = "system", targetId = "", detail = "", severity = "info" } = {}) {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    action,
    actorId,
    targetId,
    detail,
    severity,
    createdAt: new Date().toISOString()
  };
}

function makeNotificationEvent({ title = "FoxHub update", body = "", category = "system", status = "unread", ...extra } = {}) {
  return {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    body,
    category,
    status,
    createdAt: new Date().toISOString(),
    ...extra
  };
}

function makeApplicantDecisionEmailEvent({ target = {}, decision = "hold", decisionLabel = "held for follow-up" } = {}) {
  const toEmail = target.profile?.email || target.contactId || "";
  const displayName = target.profile?.displayName || target.contactId || "FoxHub applicant";
  const approved = decision === "approve" || decision === "priority";
  const denied = decision === "reject";
  const subject = approved
    ? "Your FoxHub Member application was approved"
    : denied
      ? "Your FoxHub Member application was not approved"
      : "Your FoxHub Member application needs follow-up";
  const body = approved
    ? `Hi ${displayName}, your FoxHub Member application was approved. You can sign in with the email you used to apply.`
    : denied
      ? `Hi ${displayName}, your FoxHub Member application was denied after manager review.`
      : `Hi ${displayName}, your FoxHub Member application is still under manager review. FoxHub staff may follow up before a final decision.`;
  return makeNotificationEvent({
    title: `Email ${approved ? "sent: approved" : denied ? "sent: denied" : "queued: follow-up"}`,
    body: `${subject}${toEmail ? ` to ${toEmail}` : ""}.`,
    category: "email",
    status: "unread",
    deliveryChannel: "email",
    deliveryState: approved || denied ? "sent" : "queued",
    toEmail,
    subject,
    emailBody: body,
    template: "foxhub_member_application_decision",
    decision,
    decisionLabel
  });
}

function makeDeviceSession({ label = "Current device", platform = "Web", trust = "medium", sessionState = "active", location = "Unknown" } = {}) {
  return {
    id: `device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    platform,
    trust,
    sessionState,
    location,
    lastSeenAt: new Date().toISOString()
  };
}

function makeVerificationCase({ targetId = "", targetType = "profile", label = "Verification case", status = "review", stage = "intake", requestedItems = [], owner = "Ops" } = {}) {
  const now = new Date().toISOString();
  return {
    id: `verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    targetId,
    targetType,
    label,
    status,
    stage,
    requestedItems,
    owner,
    createdAt: now,
    updatedAt: now
  };
}

function upsertThreadReadState(records = [], nextRecord) {
  return [nextRecord, ...(records || []).filter((item) => item.threadId !== nextRecord.threadId)].slice(0, 60);
}

function makeNotificationSubscription(permission = "default") {
  const now = new Date().toISOString();
  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    channel: "browser",
    endpoint: typeof window !== "undefined" ? window.location.origin : "browser",
    permission,
    status: permission === "granted" ? "active" : "ready",
    createdAt: now,
    updatedAt: now
  };
}

function makeSelfUserRecord(profile = {}) {
  const now = new Date().toISOString();
  const founderManager = isFounderManagerProfile(profile);
  return {
    id: `self-${profile.email || profile.handle || "member"}`,
    contactId: profile.email || profile.handle || "self",
    oneId: profile.oneId || "",
    accountType: founderManager ? "manager" : "member",
    segment: founderManager ? "founder management" : profile.accessState === "priority" ? "priority access" : "member",
    stage: founderManager ? "active" : profile.onboarded ? "active" : "review",
    owner: "FoxHub",
    trustScore: founderManager ? 98 : profile.accessState === "priority" ? 90 : profile.onboarded ? 78 : 54,
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
    supportTier: founderManager ? "founder" : profile.accessState === "priority" ? "priority" : "standard",
    engagementScore: founderManager ? 92 : profile.onboarded ? 65 : 32,
    referralCount: 0,
    deviceCount: 1,
    messageVolume30d: "0",
    circleCount: 0,
    savedCount: 0,
    notes: "Auto-synced user record.",
    tags: founderManager ? ["founder", "management", "onboarded"] : [profile.accessState || "active", profile.onboarded ? "onboarded" : "pending"],
    timeline: founderManager ? ["Founder access provisioned", "Management profile synced"] : ["Account created", "Profile synced"],
    profile: {
      displayName: profile.name || profile.handle || "FoxHub member",
      legalName: profile.name || "",
      oneId: profile.oneId || "",
      email: profile.email || "",
      phone: "",
      city: profile.city || "",
      region: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      joinDate: now.slice(0, 10),
      language: typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US"
    },
    verification: {
      identity: founderManager ? "passed" : profile.onboarded ? "passed" : "review",
      merchant: "n/a",
      payout: founderManager ? "approved" : "review",
      riskReview: founderManager ? "clear" : "monitor"
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
      preferredSurface: founderManager ? "management" : "chat",
      nextBestAction: founderManager ? "review member applications" : profile.onboarded ? "start a thread" : "finish onboarding"
    },
    businessProfile: {
      businessType: founderManager ? "founder" : profile.occupation || "member",
      organization: founderManager ? "FoxHub" : "",
      website: "",
      payoutMethod: founderManager ? "internal" : "not configured"
    },
    security: {
      mfa: "not configured",
      deviceTrust: "medium",
      lastDevice: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "web",
      lastIpRegion: profile.city || "Unknown"
    }
  };
}

function resolveContactForThread(thread, contacts = []) {
  if (!thread) return null;
  const byId = (contacts || []).find((contact) => contact.id === thread.id);
  if (byId) return byId;
  if (thread.type !== "direct") return null;
  return (contacts || []).find((contact) =>
    [contact.name, contact.displayName, contact.handle].filter(Boolean).includes(thread.name)
  ) || null;
}

function sanitizeUserText(value = "", max = 240) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}

const MERCHANT_MIN_ACCOUNT_AGE_DAYS = 90;
const COMMERCE_PENALTY_FLAG_THRESHOLD = 3;
const COMMERCE_PENALTY_DAYS = 30;
const LOW_RAPPORT_TIERS = new Set(["D", "F"]);
const LOW_RAPPORT_SCORE = 55;

function dateMillis(value = "") {
  const parsed = new Date(value || "").getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function daysSince(value = "", now = Date.now()) {
  const start = dateMillis(value);
  if (!start) return 0;
  return Math.max(0, Math.floor((now - start) / (24 * 60 * 60 * 1000)));
}

function commercePenaltyUntil(flags = [], now = Date.now()) {
  const activeFlags = (flags || [])
    .filter((flag) => flag?.status !== "cleared")
    .slice(0, COMMERCE_PENALTY_FLAG_THRESHOLD);
  if (activeFlags.length < COMMERCE_PENALTY_FLAG_THRESHOLD) return "";
  const newestFlagAt = activeFlags
    .map((flag) => dateMillis(flag.createdAt))
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  if (!newestFlagAt) return "";
  const penaltyUntil = newestFlagAt + COMMERCE_PENALTY_DAYS * 24 * 60 * 60 * 1000;
  return penaltyUntil > now ? new Date(penaltyUntil).toISOString() : "";
}

function getCommercePolicy(state = {}, now = Date.now()) {
  const profile = state.profile || {};
  const commerceFlags = Array.isArray(profile.commerceFlags) ? profile.commerceFlags : [];
  const payoutPenalty = (state.merchantPayoutControls || [])
    .map((item) => item?.penaltyUntil || "")
    .find((value) => dateMillis(value) > now);
  const penaltyUntil =
    payoutPenalty ||
    (profile.commercePenaltyUntil && dateMillis(profile.commercePenaltyUntil) > now
      ? profile.commercePenaltyUntil
      : commercePenaltyUntil(commerceFlags, now));
  const accountAgeDays = daysSince(profile.createdAt || profile.createdAtIso || profile.memberSince || profile.lastSeenAt, now);
  const merchantAccount = profile.merchantAccount || {};
  const merchantStatus = merchantAccount.status || profile.merchantStatus || "none";
  const storefrontCount = Array.isArray(merchantAccount.storefronts)
    ? merchantAccount.storefronts.length
    : (state.shopProfiles || []).filter((shop) => shop.ownerId === profile.handle || shop.ownerEmail === profile.email).length;

  return {
    singleSignOn: true,
    signedIn: Boolean(state.authenticated),
    accountAgeDays,
    merchantEligible: Boolean(state.authenticated) && accountAgeDays >= MERCHANT_MIN_ACCOUNT_AGE_DAYS,
    merchantStatus,
    merchantApproved: merchantStatus === "approved" || merchantStatus === "active",
    singleMerchantAccount: Boolean(merchantAccount.id || merchantStatus !== "none"),
    storefrontCount,
    storefrontMode: "multiple_storefronts_one_merchant_account",
    flagCount: commerceFlags.filter((flag) => flag?.status !== "cleared").length,
    flagThreshold: COMMERCE_PENALTY_FLAG_THRESHOLD,
    penaltyUntil,
    commerceBlocked: Boolean(penaltyUntil),
    penaltyDays: COMMERCE_PENALTY_DAYS,
    minimumMerchantAgeDays: MERCHANT_MIN_ACCOUNT_AGE_DAYS,
    reason: penaltyUntil
      ? `Commerce paused until ${new Date(penaltyUntil).toLocaleDateString()} after ${COMMERCE_PENALTY_FLAG_THRESHOLD} account flags.`
      : accountAgeDays < MERCHANT_MIN_ACCOUNT_AGE_DAYS
        ? `Merchant approval requires ${MERCHANT_MIN_ACCOUNT_AGE_DAYS} days from user signup.`
        : "Merchant application can enter staff review."
  };
}

function getRapportPolicy(state = {}) {
  const profile = state.profile || {};
  const tier = normalizeTrustTier(profile.trustTier || profile.rapportTier || "B");
  const rapportScore = Number(profile.rapportScore ?? profile.relationshipScore ?? 72);
  const peerRatingAverage = Number(profile.peerRatingAverage ?? 4);
  const restricted = LOW_RAPPORT_TIERS.has(tier) || rapportScore < LOW_RAPPORT_SCORE || peerRatingAverage <= 2;
  return {
    tier,
    rapportScore,
    peerRatingAverage,
    restricted,
    restrictedFeatures: restricted ? ["featured listings", "verified badges", "goodies", "priority perks"] : [],
    reason: restricted
      ? "Rapport is too low for favorable goodies and elevated features. Improve ratings, presence, and cordial participation to unlock them again."
      : "Rapport is healthy enough for favorable features."
  };
}

function normalizeConnectorStatus(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("active") || normalized.includes("live") || normalized.includes("connected")) return "Active";
  return "Ready";
}

const GROWTH_OS_GROUPS = {
  entry: {
    id: "entry",
    order: 1,
    name: "Entry And Identity",
    detail: "First impression, guided setup, and one profile users can understand before they spend money."
  },
  commerce: {
    id: "commerce",
    order: 2,
    name: "Local Commerce",
    detail: "Services, bookings, stores, and deals that turn browsing into paid local activity."
  },
  community: {
    id: "community",
    order: 3,
    name: "Community And Creators",
    detail: "Rooms, creator pages, offers, and local attention loops that keep people coming back."
  },
  trustMoney: {
    id: "trust-money",
    order: 4,
    name: "Trust And Money",
    detail: "Safety, wallet, receipts, holds, payout setup, and dispute clarity before checkout."
  },
  operations: {
    id: "operations",
    order: 5,
    name: "Operations And Intelligence",
    detail: "Staff queues, search, and suggestions that keep FoxHub easy to use as the crowd grows."
  },
  publicGrowth: {
    id: "public-growth",
    order: 6,
    name: "Public Growth And Sales",
    detail: "Public pages, demo examples, and the custom app sales path."
  }
};

function growthCategory(groupKey, category) {
  const group = GROWTH_OS_GROUPS[groupKey] || GROWTH_OS_GROUPS.entry;
  return {
    ...category,
    groupId: group.id,
    group: group.name,
    groupOrder: group.order,
    groupDetail: group.detail
  };
}

const GROWTH_OS_CATEGORIES = [
  growthCategory("entry", { key: "plain-positioning", order: 1, name: "Clear FoxHub Story", surface: "Public", targetTab: "hub", detail: "Explain FoxHub as one local app for chat, buy, sell, book, promote, get help, and manage small business activity." }),
  growthCategory("entry", { key: "guided-onboarding", order: 2, name: "Guided Welcome", surface: "Onboarding", targetTab: "hub", detail: "Ask what someone wants to do and shape FoxHub around buying, selling, services, creating, business, or helping manage the room." }),
  growthCategory("entry", { key: "fox-pass", order: 3, name: "Fox Pass Profile", surface: "Identity", targetTab: "circles", detail: "One portable identity with trust, reviews, badges, saved preferences, safety state, and business/service roles." }),
  growthCategory("commerce", { key: "local-services-marketplace", order: 4, name: "Local Services Marketplace", surface: "Services", targetTab: "discover", detail: "Service profiles, menus, proof photos, service radius, availability, reviews, and quote paths for local providers." }),
  growthCategory("commerce", { key: "booking-request-flows", order: 5, name: "Booking And Request Flows", surface: "Requests", targetTab: "market", detail: "Structured flows for book, quote, reserve, offer, delivery, receipt, support, and dispute requests." }),
  growthCategory("commerce", { key: "business-mini-stores", order: 6, name: "Business Mini-Stores", surface: "Commerce", targetTab: "market", detail: "Small business storefronts with products, services, hours, photos, specials, orders, announcements, loyalty, and reviews." }),
  growthCategory("commerce", { key: "deals-near-me", order: 7, name: "Deals Near Me", surface: "Deals", targetTab: "market", detail: "Local specials, limited-time offers, community giveaways, verified merchant deals, save/share/claim actions, and expiry states." }),
  growthCategory("community", { key: "neighborhood-rooms", order: 8, name: "Neighborhood Rooms", surface: "Community", targetTab: "circles", detail: "City, neighborhood, market, services, events, help wanted, business promo, lost/found, and alert rooms." }),
  growthCategory("trustMoney", { key: "trust-safety-layer", order: 9, name: "Trust And Safety Layer", surface: "Trust", targetTab: "discover", detail: "Verified levels, reviews, reports, safe-meetup tips, blocks, suspicious flags, evidence logs, moderation, and operator history." }),
  growthCategory("trustMoney", { key: "money-path", order: 10, name: "Fox Wallet Money Path", surface: "Money", targetTab: "wallet", detail: "Payment methods, deposits, holds, release steps, receipts, refunds, tips, payout setup, fee clarity, disputes, and checkout readiness warnings." }),
  growthCategory("community", { key: "creator-tools", order: 11, name: "Creator And Influencer Tools", surface: "Creators", targetTab: "circles", detail: "Creator pages, posts, offers, shoutouts, event promos, paid requests, sponsorships, affiliate deals, messages, and subscriber perks." }),
  growthCategory("operations", { key: "operator-dashboard", order: 12, name: "Staff Room", surface: "Ops", targetTab: "discover", detail: "New people, reports, checks, businesses, deals, disputes, requests, money, trust alerts, and app health." }),
  growthCategory("operations", { key: "better-search", order: 13, name: "Better Search", surface: "Search", targetTab: "hub", detail: "Search across people, businesses, services, products, deals, chats, events, groups, posts, help, and saved items with useful filters." }),
  growthCategory("operations", { key: "smart-recommendations", order: 14, name: "Smart Recommendations", surface: "Recommendations", targetTab: "hub", detail: "Rules-based next-best actions for deals, services, unfinished setup, trusted sellers, listing quality, and saved items." }),
  growthCategory("publicGrowth", { key: "public-directory", order: 15, name: "Public Directory And SEO", surface: "Public", targetTab: "market", detail: "Public business, service, deal, event, city, category, and profile directory pages for acquisition and search visibility." }),
  growthCategory("publicGrowth", { key: "demo-data-mode", order: 16, name: "Demo Data Mode", surface: "Demo", targetTab: "hub", detail: "Sample local businesses, services, chats, deals, bookings, trust alerts, operator queues, and wallet paths for sales demos." }),
  growthCategory("publicGrowth", { key: "build-my-platform", order: 17, name: "Build My App Showcase", surface: "Sales", targetTab: "hub", detail: "A simple proof page for selling custom apps using FoxHub, EstateHat, CLTCH, and ExcelBolt as examples." })
];

function buildPlatformDefaults() {
  const uxComponents = [
    { key: "universal-command-center", order: 1, name: "Quick Actions", surface: "Shell", detail: "Jump to chat, listings, money, services, staff help, and organizer actions from one place." },
    { key: "today-dashboard", order: 2, name: "Today Card", surface: "Home", detail: "A daily look at unread messages, money, saved items, services, and what to do next." },
    { key: "context-right-rail", order: 3, name: "Context-Aware Right Rail", surface: "Shell", detail: "Object context for threads, listings, wallet events, merchants, profiles, documents, and actions." },
    { key: "action-timeline", order: 4, name: "Action Timeline", surface: "Objects", detail: "Chronological events for profile, message, payment, document, moderation, and operator activity." },
    { key: "inbox-priority-modes", order: 5, name: "Inbox Priority Modes", surface: "Chats", detail: "All, People, Services, Money, Needs reply, High trust, and Operator inbox modes." },
    { key: "trust-badge-system", order: 6, name: "Trust Badge System", surface: "Trust", detail: "Identity, merchant, response, dispute, new-account, review, and payment-hold badges." },
    { key: "smart-empty-states", order: 7, name: "Smart Empty States", surface: "Shell", detail: "Actionable empty screens that suggest a useful next step." },
    { key: "onboarding-progress-map", order: 8, name: "Onboarding Progress Map", surface: "Onboarding", detail: "Profile, invite/access, notifications, wallet, verification, first chat, first service, and first listing readiness." },
    { key: "miniapp-permission-review", order: 9, name: "Mini-App Permission Review Modal", surface: "Mini-programs", detail: "Permission reason, last-used, revoke, and launch review controls." },
    { key: "payment-flow-stepper", order: 10, name: "Payment Flow Stepper", surface: "Wallet", detail: "Created, funded, held, reviewed, released, disputed, and resolved payment steps." },
    { key: "notification-inbox-upgrade", order: 11, name: "Notification Inbox Upgrade", surface: "Notifications", detail: "Priority, category, read state, source jump, digest, and push status controls." },
    { key: "operator-review-console", order: 12, name: "Staff Review Desk", surface: "Ops", detail: "Account checks, disputes, flagged listings, payout holds, trust reports, owners, and urgent follow-up." },
    { key: "local-map-list-toggle", order: 13, name: "Local Discovery Map/List Toggle", surface: "Discovery", detail: "List and map-style local discovery with distance and trust filters." },
    { key: "profile-completeness-meter", order: 14, name: "Profile Completeness Meter", surface: "Profile", detail: "Identity, trust, wallet, merchant, and service readiness." },
    { key: "saved-workspace", order: 15, name: "Saved Workspace", surface: "Saved", detail: "Unified saved area for people, listings, services, posts, searches, mini-apps, and payment references." },
    { key: "undo-recent-action-toasts", order: 16, name: "Undo / Recent Actions Toasts", surface: "Shell", detail: "Confirmation toasts and safe undo handles for mutating actions." },
    { key: "skeleton-offline-banners", order: 17, name: "Loading and Offline Notices", surface: "Runtime", detail: "Simple notices for updating, offline, preview, live connection, and mobile locked states." },
    { key: "role-based-home-layout", order: 18, name: "Personal Home Layout", surface: "Home", detail: "Home views for members, shops, creators, staff, admins, and reviewers." },
    { key: "object-detail-pages", order: 19, name: "Object Detail Pages", surface: "Objects", detail: "Detail panels for users, merchants, listings, disputes, wallet events, verification cases, and mini-apps." },
    { key: "guided-create-button", order: 20, name: "Guided Create Button", surface: "Shell", detail: "One global create menu for messages, listings, groups, events, routes, documents, merchant cases, and manifests." }
  ];

  const productionComponents = [
    { key: "server-backend", name: "Trusted Back Room", surface: "Functions", status: "ready", detail: "Protected jobs for safety checks, staff actions, invites, and partner alerts." },
    { key: "native-push", name: "Native push delivery", surface: "Mobile", status: "ready", detail: "FCM and browser notification readiness for chats, wallet holds, and ops alerts." },
    { key: "media-storage", name: "Media and document storage", surface: "Storage", status: "ready", detail: "Storage-backed objects with MIME, size, and review metadata." },
    { key: "phone-identity", name: "Phone and identity hardening", surface: "Auth", status: "ready", detail: "Phone auth, MFA readiness, device checks, and passkey planning." },
    { key: "custom-claims", name: "Staff Passes", surface: "Auth", status: "ready", detail: "Protected passes for staff, admins, shops, and reviewers." },
    { key: "payment-webhooks", name: "Payment Alerts", surface: "Payments", status: "ready", detail: "Money, payout, refund, and dispute updates that stay organized." },
    { key: "search-backend", name: "Better Search Helper", surface: "Search", status: "ready", detail: "Keeps people, listings, services, and mini apps easier to find." },
    { key: "miniapp-sandbox", name: "Mini-app sandbox SDK", surface: "Mini-programs", status: "ready", detail: "Signed manifests, permission tokens, bridge events, and revocation history." },
    { key: "maps-local", name: "Maps and local commerce", surface: "Discovery", status: "ready", detail: "Geo indexes for local listings, merchants, routes, and nearby services." },
    { key: "moderation-pipeline", name: "Moderation pipeline", surface: "Trust", status: "ready", detail: "Evidence bundles, appeal states, SLA clocks, and escalation routing." },
    { key: "analytics-export", name: "Analytics warehouse export", surface: "Analytics", status: "ready", detail: "Validated product events, consent state, and warehouse export jobs." },
    { key: "smoke-tests", name: "Quick Health Checks", surface: "Quality", status: "ready", detail: "Checks sign-up, profile, chat, money, organizer, mobile lock, and the live site." }
  ];

  return {
    unifiedActionLog: [],
    trustEngine: {
      profileScore: 0,
      listingScore: 0,
      merchantScore: 0,
      updatedAt: ""
    },
    escrows: [],
    reputationGraph: {
      endorsementsByHandle: {},
      workedWithEdges: [],
      updatedAt: ""
    },
    matchRequests: [],
    copilotInsights: [],
    notificationPolicy: {
      mode: "priority",
      digestWindow: "daily",
      muteLowPriority: false,
      updatedAt: ""
    },
    conversionFunnels: [],
    miniAppRuntimeSessions: [],
    reliabilityQueue: [],
    analyticsHub: {
      events: [],
      flags: {},
      experiments: [],
      updatedAt: ""
    },
    fraudHoldQueue: [],
    conversationSummaries: [],
    sharedChecklists: [],
    localEvents: [],
    serviceBadges: [],
    priceGuidance: [],
    workflowPresets: [],
    voiceTranscripts: [],
    walletInsights: {
      weeklySummary: [],
      anomalies: [],
      updatedAt: ""
    },
    reorderHistory: [],
    trustTimeline: [],
    growthCategories: GROWTH_OS_CATEGORIES.map((category) => ({ ...category, status: "ready", runCount: 0 })),
    growthEvents: [],
    growthOutputs: [],
    uxComponents,
    uxEvents: [],
    uxCommandRuns: [],
    uxTodayCards: [],
    uxContextRailItems: [],
    uxTimelines: [],
    uxInboxModes: [],
    uxTrustBadges: [],
    uxEmptyStateActions: [],
    uxOnboardingSteps: [],
    uxMiniAppPermissionReviews: [],
    uxPaymentSteppers: [],
    uxNotificationInbox: [],
    uxOperatorConsoleItems: [],
    uxDiscoveryViews: [],
    uxCompletenessMeters: [],
    uxSavedWorkspaceItems: [],
    uxToasts: [],
    uxRuntimeBanners: [],
    uxRoleHomeLayouts: [],
    uxObjectDetails: [],
    uxCreateMenuActions: [],
    productionComponents,
    productionEvents: [],
    serverJobs: [],
    pushDeliveries: [],
    storageObjects: [],
    authHardeningChecks: [],
    rbacAssignments: [],
    paymentWebhookEvents: [],
    searchIndexJobs: [],
    miniAppSandboxSessions: [],
    geoIndexRecords: [],
    moderationPipelineCases: [],
    analyticsExports: [],
    smokeTestRuns: []
  };
}

function ensurePlatformStateShape(current = {}) {
  const defaults = buildPlatformDefaults();
  const commercePolicy = getCommercePolicy(current);
  const rapportPolicy = getRapportPolicy(current);
  return {
    ...current,
    commercePolicy,
    rapportPolicy,
    unifiedActionLog: Array.isArray(current.unifiedActionLog) ? current.unifiedActionLog : defaults.unifiedActionLog,
    trustEngine: current.trustEngine || defaults.trustEngine,
    escrows: Array.isArray(current.escrows) ? current.escrows : defaults.escrows,
    reputationGraph: current.reputationGraph || defaults.reputationGraph,
    matchRequests: Array.isArray(current.matchRequests) ? current.matchRequests : defaults.matchRequests,
    copilotInsights: Array.isArray(current.copilotInsights) ? current.copilotInsights : defaults.copilotInsights,
    notificationPolicy: current.notificationPolicy || defaults.notificationPolicy,
    conversionFunnels: Array.isArray(current.conversionFunnels) ? current.conversionFunnels : defaults.conversionFunnels,
    miniAppRuntimeSessions: Array.isArray(current.miniAppRuntimeSessions)
      ? current.miniAppRuntimeSessions
      : defaults.miniAppRuntimeSessions,
    reliabilityQueue: Array.isArray(current.reliabilityQueue) ? current.reliabilityQueue : defaults.reliabilityQueue,
    analyticsHub: current.analyticsHub || defaults.analyticsHub,
    fraudHoldQueue: Array.isArray(current.fraudHoldQueue) ? current.fraudHoldQueue : defaults.fraudHoldQueue,
    conversationSummaries: Array.isArray(current.conversationSummaries)
      ? current.conversationSummaries
      : defaults.conversationSummaries,
    sharedChecklists: Array.isArray(current.sharedChecklists) ? current.sharedChecklists : defaults.sharedChecklists,
    localEvents: Array.isArray(current.localEvents) ? current.localEvents : defaults.localEvents,
    serviceBadges: Array.isArray(current.serviceBadges) ? current.serviceBadges : defaults.serviceBadges,
    priceGuidance: Array.isArray(current.priceGuidance) ? current.priceGuidance : defaults.priceGuidance,
    workflowPresets: Array.isArray(current.workflowPresets) ? current.workflowPresets : defaults.workflowPresets,
    voiceTranscripts: Array.isArray(current.voiceTranscripts) ? current.voiceTranscripts : defaults.voiceTranscripts,
    walletInsights: current.walletInsights || defaults.walletInsights,
    reorderHistory: Array.isArray(current.reorderHistory) ? current.reorderHistory : defaults.reorderHistory,
    trustTimeline: Array.isArray(current.trustTimeline) ? current.trustTimeline : defaults.trustTimeline,
    growthCategories: Array.isArray(current.growthCategories)
      ? defaults.growthCategories.map((category) => {
          const saved = current.growthCategories.find((item) => item.key === category.key) || {};
          return {
            ...saved,
            ...category,
            status: saved.status || category.status,
            runCount: saved.runCount ?? category.runCount,
            activatedAt: saved.activatedAt,
            lastRunAt: saved.lastRunAt,
            updatedAt: saved.updatedAt
          };
        })
      : defaults.growthCategories,
    growthEvents: Array.isArray(current.growthEvents) ? current.growthEvents : defaults.growthEvents,
    growthOutputs: Array.isArray(current.growthOutputs) ? current.growthOutputs : defaults.growthOutputs,
    uxComponents: Array.isArray(current.uxComponents)
      ? defaults.uxComponents.map((component) => ({
          ...component,
          ...(current.uxComponents.find((item) => item.key === component.key) || {})
        }))
      : defaults.uxComponents,
    uxEvents: Array.isArray(current.uxEvents) ? current.uxEvents : defaults.uxEvents,
    uxCommandRuns: Array.isArray(current.uxCommandRuns) ? current.uxCommandRuns : defaults.uxCommandRuns,
    uxTodayCards: Array.isArray(current.uxTodayCards) ? current.uxTodayCards : defaults.uxTodayCards,
    uxContextRailItems: Array.isArray(current.uxContextRailItems) ? current.uxContextRailItems : defaults.uxContextRailItems,
    uxTimelines: Array.isArray(current.uxTimelines) ? current.uxTimelines : defaults.uxTimelines,
    uxInboxModes: Array.isArray(current.uxInboxModes) ? current.uxInboxModes : defaults.uxInboxModes,
    uxTrustBadges: Array.isArray(current.uxTrustBadges) ? current.uxTrustBadges : defaults.uxTrustBadges,
    uxEmptyStateActions: Array.isArray(current.uxEmptyStateActions) ? current.uxEmptyStateActions : defaults.uxEmptyStateActions,
    uxOnboardingSteps: Array.isArray(current.uxOnboardingSteps) ? current.uxOnboardingSteps : defaults.uxOnboardingSteps,
    uxMiniAppPermissionReviews: Array.isArray(current.uxMiniAppPermissionReviews) ? current.uxMiniAppPermissionReviews : defaults.uxMiniAppPermissionReviews,
    uxPaymentSteppers: Array.isArray(current.uxPaymentSteppers) ? current.uxPaymentSteppers : defaults.uxPaymentSteppers,
    uxNotificationInbox: Array.isArray(current.uxNotificationInbox) ? current.uxNotificationInbox : defaults.uxNotificationInbox,
    uxOperatorConsoleItems: Array.isArray(current.uxOperatorConsoleItems) ? current.uxOperatorConsoleItems : defaults.uxOperatorConsoleItems,
    uxDiscoveryViews: Array.isArray(current.uxDiscoveryViews) ? current.uxDiscoveryViews : defaults.uxDiscoveryViews,
    uxCompletenessMeters: Array.isArray(current.uxCompletenessMeters) ? current.uxCompletenessMeters : defaults.uxCompletenessMeters,
    uxSavedWorkspaceItems: Array.isArray(current.uxSavedWorkspaceItems) ? current.uxSavedWorkspaceItems : defaults.uxSavedWorkspaceItems,
    uxToasts: Array.isArray(current.uxToasts) ? current.uxToasts : defaults.uxToasts,
    uxRuntimeBanners: Array.isArray(current.uxRuntimeBanners) ? current.uxRuntimeBanners : defaults.uxRuntimeBanners,
    uxRoleHomeLayouts: Array.isArray(current.uxRoleHomeLayouts) ? current.uxRoleHomeLayouts : defaults.uxRoleHomeLayouts,
    uxObjectDetails: Array.isArray(current.uxObjectDetails) ? current.uxObjectDetails : defaults.uxObjectDetails,
    uxCreateMenuActions: Array.isArray(current.uxCreateMenuActions) ? current.uxCreateMenuActions : defaults.uxCreateMenuActions,
    productionComponents: Array.isArray(current.productionComponents)
      ? defaults.productionComponents.map((component) => ({
          ...component,
          ...(current.productionComponents.find((item) => item.key === component.key) || {})
        }))
      : defaults.productionComponents,
    productionEvents: Array.isArray(current.productionEvents) ? current.productionEvents : defaults.productionEvents,
    serverJobs: Array.isArray(current.serverJobs) ? current.serverJobs : defaults.serverJobs,
    pushDeliveries: Array.isArray(current.pushDeliveries) ? current.pushDeliveries : defaults.pushDeliveries,
    storageObjects: Array.isArray(current.storageObjects) ? current.storageObjects : defaults.storageObjects,
    authHardeningChecks: Array.isArray(current.authHardeningChecks) ? current.authHardeningChecks : defaults.authHardeningChecks,
    rbacAssignments: Array.isArray(current.rbacAssignments) ? current.rbacAssignments : defaults.rbacAssignments,
    paymentWebhookEvents: Array.isArray(current.paymentWebhookEvents) ? current.paymentWebhookEvents : defaults.paymentWebhookEvents,
    searchIndexJobs: Array.isArray(current.searchIndexJobs) ? current.searchIndexJobs : defaults.searchIndexJobs,
    miniAppSandboxSessions: Array.isArray(current.miniAppSandboxSessions) ? current.miniAppSandboxSessions : defaults.miniAppSandboxSessions,
    geoIndexRecords: Array.isArray(current.geoIndexRecords) ? current.geoIndexRecords : defaults.geoIndexRecords,
    moderationPipelineCases: Array.isArray(current.moderationPipelineCases) ? current.moderationPipelineCases : defaults.moderationPipelineCases,
    analyticsExports: Array.isArray(current.analyticsExports) ? current.analyticsExports : defaults.analyticsExports,
    smokeTestRuns: Array.isArray(current.smokeTestRuns) ? current.smokeTestRuns : defaults.smokeTestRuns
  };
}

export function useFoxHubStore() {
  const [state, setState] = useState(null);
  const stateRef = useRef(null);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    void loadState()
      .then((nextState) => {
        if (!mounted || !nextState) return;
        const shaped = ensurePlatformStateShape(nextState);
        stateRef.current = shaped;
        setState(shaped);
      })
      .catch(() => {});

    const unsubscribe = subscribeToState((nextState) => {
      const shaped = ensurePlatformStateShape(nextState);
      stateRef.current = shaped;
      setState(shaped);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    const hasPlatformShape =
      Array.isArray(state.unifiedActionLog) &&
      typeof state.trustEngine === "object" &&
      Array.isArray(state.escrows) &&
      typeof state.reputationGraph === "object" &&
      Array.isArray(state.matchRequests) &&
      Array.isArray(state.copilotInsights) &&
      typeof state.notificationPolicy === "object" &&
      Array.isArray(state.conversionFunnels) &&
      Array.isArray(state.miniAppRuntimeSessions) &&
      Array.isArray(state.reliabilityQueue) &&
      typeof state.analyticsHub === "object" &&
      Array.isArray(state.fraudHoldQueue) &&
      Array.isArray(state.conversationSummaries) &&
      Array.isArray(state.sharedChecklists) &&
      Array.isArray(state.localEvents) &&
      Array.isArray(state.serviceBadges) &&
      Array.isArray(state.priceGuidance) &&
      Array.isArray(state.workflowPresets) &&
      Array.isArray(state.voiceTranscripts) &&
      typeof state.walletInsights === "object" &&
      Array.isArray(state.reorderHistory) &&
      Array.isArray(state.trustTimeline) &&
      Array.isArray(state.growthCategories) &&
      Array.isArray(state.growthEvents) &&
      Array.isArray(state.growthOutputs) &&
      Array.isArray(state.uxComponents) &&
      Array.isArray(state.uxEvents) &&
      Array.isArray(state.uxCommandRuns) &&
      Array.isArray(state.uxTodayCards) &&
      Array.isArray(state.uxContextRailItems) &&
      Array.isArray(state.uxTimelines) &&
      Array.isArray(state.uxInboxModes) &&
      Array.isArray(state.uxTrustBadges) &&
      Array.isArray(state.uxEmptyStateActions) &&
      Array.isArray(state.uxOnboardingSteps) &&
      Array.isArray(state.uxMiniAppPermissionReviews) &&
      Array.isArray(state.uxPaymentSteppers) &&
      Array.isArray(state.uxNotificationInbox) &&
      Array.isArray(state.uxOperatorConsoleItems) &&
      Array.isArray(state.uxDiscoveryViews) &&
      Array.isArray(state.uxCompletenessMeters) &&
      Array.isArray(state.uxSavedWorkspaceItems) &&
      Array.isArray(state.uxToasts) &&
      Array.isArray(state.uxRuntimeBanners) &&
      Array.isArray(state.uxRoleHomeLayouts) &&
      Array.isArray(state.uxObjectDetails) &&
      Array.isArray(state.uxCreateMenuActions) &&
      Array.isArray(state.productionComponents) &&
      Array.isArray(state.productionEvents) &&
      Array.isArray(state.serverJobs) &&
      Array.isArray(state.pushDeliveries) &&
      Array.isArray(state.storageObjects) &&
      Array.isArray(state.authHardeningChecks) &&
      Array.isArray(state.rbacAssignments) &&
      Array.isArray(state.paymentWebhookEvents) &&
      Array.isArray(state.searchIndexJobs) &&
      Array.isArray(state.miniAppSandboxSessions) &&
      Array.isArray(state.geoIndexRecords) &&
      Array.isArray(state.moderationPipelineCases) &&
      Array.isArray(state.analyticsExports) &&
      Array.isArray(state.smokeTestRuns);
    if (hasPlatformShape) return;
    setState((current) => ensurePlatformStateShape(current));
  }, [state]);

  useEffect(() => {
    if (!state) return undefined;

    function markPresence(presenceState) {
      setState((current) => {
        if (!current?.profile) return current;
        return {
          ...current,
          profile: {
            ...current.profile,
            presenceState,
            lastSeenAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString()
          }
        };
      });
    }

    function handleVisibility() {
      markPresence(document.visibilityState === "visible" ? "online" : "away");
    }

    function handleFocus() {
      markPresence("online");
    }

    function handleBlur() {
      markPresence("away");
    }

    handleVisibility();
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [state?.authenticated]);

  useEffect(() => {
    if (!state || typeof Notification === "undefined") return;

    const permission = Notification.permission || "default";
    setState((current) => {
      const existing = (current.notificationSubscriptions || []).find((item) => item.channel === "browser");
      const nextRecord = existing
        ? { ...existing, permission, status: permission === "granted" ? "active" : "ready", updatedAt: new Date().toISOString() }
        : makeNotificationSubscription(permission);
      return {
        ...current,
        notificationSubscriptions: [nextRecord, ...(current.notificationSubscriptions || []).filter((item) => item.id !== nextRecord.id)].slice(0, 12)
      };
    });
  }, [state?.authenticated]);

  useEffect(() => {
    if (!state || typeof Notification === "undefined" || document.visibilityState === "visible") return;
    if (Notification.permission !== "granted") return;

    const latest = (state.notificationEvents || []).find((item) => item.status === "unread");
    if (!latest) return;
    const existingIds = new Set((state.notificationSubscriptions || []).flatMap((item) => item.lastNotifiedId ? [item.lastNotifiedId] : []));
    if (existingIds.has(latest.id)) return;

    try {
      new Notification(latest.title || "FoxHub update", { body: latest.body || "" });
    } catch {
      return;
    }

    setState((current) => ({
      ...current,
      notificationSubscriptions: (current.notificationSubscriptions || []).map((item, index) =>
        index === 0 ? { ...item, lastNotifiedId: latest.id, updatedAt: new Date().toISOString() } : item
      )
    }));
  }, [state?.notificationEvents, state?.notificationSubscriptions]);

  useEffect(() => {
    if (!state) return;
    stateRef.current = state;
    if (state.backendMode === "locked") return;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void saveState(stateRef.current);
    }, 420);
    return () => window.clearTimeout(saveTimerRef.current);
  }, [state]);

  if (!state) {
    return {
      state: null,
      signIn: async () => {},
      signInWithGoogle: async () => {},
      sendMagicLink: async () => {},
      requestPasswordReset: async () => {},
      verifyPasswordReset: async () => {},
      confirmPasswordReset: async () => {},
      signOut: async () => {},
      updateProfile: async () => {},
      subscribeVerifiedPerformer: async () => {},
      cancelVerifiedPerformer: async () => {},
      selectThread() {},
      addMessage: async () => {},
      selectCircle() {},
      selectMiniApp() {},
      addWalletEvent: async () => {},
      startDirectThread: async () => {},
      addMoment: async () => {},
      reactToMoment: () => {},
      commentOnMoment: () => {},
      respondFriendRequest: () => {},
      addFavorite: async () => {},
      addSavedItem: async () => {},
      runQrAction: async () => {},
      recordModerationCase: () => {},
      rateContactTrust: () => {},
      toggleOfficialAccountSubscription: () => {},
      launchMiniApp: async () => {},
      startShakeMatch: () => {},
      logFileTransfer: () => {},
      openLiveChannel: () => {},
      openCommunityChannel: () => {},
      createGroupConversation: async () => {},
      publishMediaClip: async () => {},
      publishStoryBundle: async () => {},
      placeAuctionBid: async () => {},
      upsertCart: async () => {},
      addShopReview: async () => {},
      moderateRatingRecord: () => {},
      uploadDocumentEvidence: async () => {},
      submitVerificationCase: () => {},
      resolveVerificationCase: () => {},
      updateComplianceControl: () => {},
      reportTrustSafetyIncident: () => {},
      runMerchantRiskCheck: () => {},
      updateMerchantOnboarding: () => {},
      reviewMerchantSettlement: () => {},
      updateMerchantPayoutControl: () => {},
      updateMerchantLocationStatus: () => {},
      openDisputeCase: () => {},
      resolveDisputeCase: () => {},
      markNotificationRead: () => {},
      revokeDeviceSession: () => {},
      saveRoutePlan: async () => {},
      addEndorsement: async () => {},
      addJobPost: async () => {},
      registerMiniProgramManifest: async () => {},
      startCallSession: async () => {},
      createInvite: async () => {},
      reviewSponsorInvite: async () => {},
      applyRapportRetentionBoost: () => {},
      registerBrowserNotifications: async () => {},
      blockUser: async () => {},
      reviewMemberApplication: () => {},
      addFoxHubStaffMember: () => null,
      connectApiConnector: async () => {},
      testApiConnector: async () => {},
      disconnectApiConnector: async () => {},
      prepareStripeConnector: async () => ({ ok: false, missing: [] }),
      activateUxComponent: () => null,
      runUxComponent: () => null,
      activateProductionComponent: () => null,
      runProductionComponent: () => null,
      activateGrowthCategory: () => null,
      runGrowthCategory: () => null,
      activateAllGrowthCategories: () => []
    };
  }

  async function signIn(profileDraft) {
    const authState = await signInProfile(profileDraft);
    const founderManager = isFounderManagerProfile(authState?.profile || {});
    const deviceSession = makeDeviceSession({
      label: "Current web session",
      platform: "Web",
      trust: founderManager ? "high" : "medium",
      sessionState: "active",
      location: authState?.profile?.city || profileDraft.city || "Unknown"
    });
    const operatorRecord = founderManager
      ? {
          id: "operator-access-founder",
          userId: authState.profile.email,
          email: authState.profile.email,
          role: "owner",
          scopes: ["*", "owner", "admin", "management", "members", "verification", "moderation", "billing", "documents", "notifications", "settings", "security", "operators"],
          state: "active",
          grantedAt: new Date().toISOString(),
          grantedBy: "system"
        }
      : null;
    const auditEvent = makeAuditEvent({
      type: "auth",
      action: "sign_in",
      actorId: authState?.profile?.handle || profileDraft.handle || "self",
      targetId: authState?.profile?.email || profileDraft.email || "workspace",
      detail: founderManager ? "Founder management account signed in and a high-trust session was registered." : "Account signed in and a session was registered.",
      severity: "info"
    });
    const notification = makeNotificationEvent({
      title: founderManager ? "Founder management session started" : authState?.authenticated ? "Session started" : "Member application submitted",
      body: founderManager
        ? "The Management dashboard is active on this device."
        : authState?.authenticated
          ? "A new FoxHub session is active on this device."
          : `${authState?.profile?.name || profileDraft.name || "An applicant"} applied without an invite and is waiting for manager review.`,
      category: authState?.authenticated ? "security" : "staff"
    });
    setState((current) => {
      const inviteCode = String(profileDraft.inviteCode || "").trim().toUpperCase();
      const nextInvites = inviteCode
        ? (current.invites || []).map((invite) =>
            invite.code === inviteCode
              ? {
                  ...invite,
                  status: "redeemed",
                  redeemedBy: authState?.profile?.email || profileDraft.email || "",
                  redeemedAt: new Date().toISOString()
                }
              : invite
          )
        : (current.invites || []);
      return {
        ...current,
        ...authState,
        invites: nextInvites,
        userRecords: [makeSelfUserRecord(authState?.profile || {}), ...((current.userRecords || []).filter((item) => !String(item.id || "").startsWith("self-")))].slice(0, 40),
        operatorAccessRecords: operatorRecord
          ? [operatorRecord, ...((current.operatorAccessRecords || []).filter((item) => item.id !== operatorRecord.id))].slice(0, 24)
          : current.operatorAccessRecords,
        deviceSessions: [deviceSession, ...(current.deviceSessions || []).filter((item) => item.label !== deviceSession.label)].slice(0, 24),
        auditEvents: [auditEvent, ...(current.auditEvents || [])].slice(0, 120),
        notificationEvents: [notification, ...(current.notificationEvents || [])].slice(0, 120)
      };
    });
    return authState;
  }

  async function signInWithGoogle(profileDraft = {}) {
    const authState = await signInWithGoogleProfile(profileDraft);
    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      ...authState,
      userRecords: [makeSelfUserRecord(authState.profile || {}), ...((current.userRecords || []).filter((item) => !String(item.id || "").startsWith("self-")))].slice(0, 40),
      notificationEvents: [
        makeNotificationEvent({
          title: "Google sign-in complete",
          body: "Your FoxHub session is now active with Google.",
          category: "security"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120),
      auditEvents: [
        makeAuditEvent({
          type: "auth",
          action: "google_sign_in",
          actorId: authState?.profile?.handle || "self",
          targetId: authState?.profile?.email || "workspace",
          detail: "Google sign-in completed successfully.",
          severity: "info"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120),
      deviceSessions: [
        {
          id: `device-${Date.now()}`,
          label: "Current web session",
          platform: "Web",
          trust: "high",
          sessionState: "active",
          location: authState?.profile?.city || "Unknown",
          lastSeenAt: now
        },
        ...(current.deviceSessions || [])
      ].slice(0, 24)
    }));
    return authState;
  }

  async function sendMagicLink(email) {
    const result = await sendMagicLinkProfile(email);
    setState((current) => ({
      ...current,
      notificationEvents: [
        makeNotificationEvent({
          title: "Sign-in link sent",
          body: `A FoxHub sign-in link was sent to ${result.email}.`,
          category: "security"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120)
    }));
    return result;
  }

  async function requestPasswordReset(email) {
    const result = await sendPasswordResetProfile(email);
    setState((current) => ({
      ...current,
      notificationEvents: [
        makeNotificationEvent({
          title: "Password reset email sent",
          body: `A FoxHub password reset link was sent to ${result.email}.`,
          category: "security"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120)
    }));
    return result;
  }

  async function verifyPasswordReset(code) {
    return verifyPasswordResetProfile(code);
  }

  async function confirmPasswordReset(code, password) {
    const result = await confirmPasswordResetProfile(code, password);
    setState((current) => ({
      ...current,
      notificationEvents: [
        makeNotificationEvent({
          title: "Password changed",
          body: "Your FoxHub password was changed. Sign in with the new password.",
          category: "security"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120)
    }));
    return result;
  }

  async function registerBrowserNotifications() {
    if (typeof Notification === "undefined") {
      throw new Error("Browser notifications are not available in this environment.");
    }

    const permission = await Notification.requestPermission();
    const record = makeNotificationSubscription(permission);
    setState((current) => ({
      ...current,
      notificationSubscriptions: [record, ...(current.notificationSubscriptions || []).filter((item) => item.channel !== "browser")].slice(0, 12),
      notificationEvents: [
        makeNotificationEvent({
          title: permission === "granted" ? "Notifications enabled" : "Notifications not enabled",
          body: permission === "granted" ? "FoxHub can alert you about verification, wallet, and operator events in this browser." : "Browser notifications remain off for this browser session.",
          category: "notifications",
          status: permission === "granted" ? "read" : "unread"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120)
    }));
    return permission;
  }

  async function signOut() {
    const nextState = await signOutCurrentProfile();
    const auditEvent = makeAuditEvent({
      type: "auth",
      action: "sign_out",
      actorId: stateRef.current?.profile?.handle || "self",
      targetId: "workspace",
      detail: "Active session signed out.",
      severity: "info"
    });
    setState({
      ...nextState,
      auditEvents: [auditEvent, ...((stateRef.current?.auditEvents) || [])].slice(0, 120),
      notificationEvents: [makeNotificationEvent({ title: "Session ended", body: "The active FoxHub session was signed out.", category: "security", status: "read" }), ...((stateRef.current?.notificationEvents) || [])].slice(0, 120)
    });
  }

  async function updateProfile(profileDraft) {
    const profile = await updateProfileRecord(profileDraft);
    const current = stateRef.current || state;
    const nextState = {
      ...current,
      profile,
      userRecords: [makeSelfUserRecord(profile), ...((current?.userRecords || []).filter((item) => !String(item.id || "").startsWith("self-")))].slice(0, 40)
    };
    stateRef.current = nextState;
    setState(nextState);
    await saveState(nextState);
    return profile;
  }

  async function subscribeVerifiedPerformer() {
    const snapshot = stateRef.current || state;
    const stripeConnector = (snapshot?.apiConnectors || []).find((item) => item.id === "stripe-connect");
    const stripeStatus = String(stripeConnector?.status || "").toLowerCase();
    const stripeActive = stripeStatus.includes("active") || stripeStatus.includes("live") || stripeStatus.includes("connected");
    if (!stripeActive) {
      throw new Error("Stripe connector must be active before starting the verified subscription.");
    }

    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        verifiedPerformerSubscribed: true,
        verifiedPerformerStatus: "active",
        verifiedPerformerPlan: "$20/month",
        verifiedPerformerSince: current.profile?.verifiedPerformerSince || now
      },
      walletEvents: [
        {
          id: Date.now(),
          title: "Verified user subscription",
          amount: "-$20.00",
          meta: "Monthly plan activated · billed via Stripe Connect"
        },
        ...(current.walletEvents || [])
      ].slice(0, 160),
      notificationEvents: [
        makeNotificationEvent({
          title: "Verified subscription active",
          body: "Your verified user plan is now active at $20/month through Stripe Connect.",
          category: "profile"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120),
      auditEvents: [
        makeAuditEvent({
          type: "profile",
          action: "verified_subscription_enabled",
          actorId: current.profile?.handle || "self",
          targetId: "verified_user_subscription",
          detail: "Verified user subscription was activated.",
          severity: "info"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120)
    }));
  }

  async function cancelVerifiedPerformer() {
    setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        verifiedPerformerSubscribed: false,
        verifiedPerformerStatus: "inactive",
        verifiedPerformerPlan: "$20/month"
      },
      notificationEvents: [
        makeNotificationEvent({
          title: "Verified subscription canceled",
          body: "Your verified user plan is now inactive.",
          category: "profile"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120),
      auditEvents: [
        makeAuditEvent({
          type: "profile",
          action: "verified_subscription_canceled",
          actorId: current.profile?.handle || "self",
          targetId: "verified_user_subscription",
          detail: "Verified user subscription was canceled.",
          severity: "review"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120)
    }));
  }

  function selectThread(threadId) {
    const readAt = new Date().toISOString();
    setState((current) => ({
      ...current,
      selectedThreadId: threadId,
      threadReadState: upsertThreadReadState(current.threadReadState, {
        threadId,
        lastReadAt: readAt,
        unreadCount: 0
      }),
      threads: current.threads.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              unreadCount: 0
            }
          : thread
      )
    }));
  }

  async function addMessage(threadId, payload) {
    const message = await createMessageRecord(threadId, payload);
    const attachmentRecords = await Promise.all(
      (message.attachments || []).map((item) =>
        createDocumentRecord({
          ownerId: stateRef.current?.profile?.handle || "self",
          targetType: "thread",
          targetId: String(threadId || ""),
          name: item.name || "Attachment",
          kind: "attachment",
          mimeType: item.type || "application/octet-stream",
          status: "stored",
          source: "chat attachment"
        })
      )
    );
    setState((current) => ({
      ...current,
      threads: current.threads.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              lastActiveLabel: "updated just now",
              messages: [...thread.messages, message]
            }
          : thread
      ),
      threadReadState: upsertThreadReadState(current.threadReadState, {
        threadId,
        lastReadAt: new Date().toISOString(),
        unreadCount: 0
      }),
      documentVault: [...attachmentRecords, ...(current.documentVault || [])].slice(0, 120),
      operatorActions: attachmentRecords.length
        ? [
            {
              id: `ops-${Date.now()}`,
              action: "attachment_stored",
              actorId: current.profile.handle || "self",
              targetId: String(threadId || ""),
              detail: `${attachmentRecords.length} attachment record(s) added to the document vault.`,
              outcome: "stored",
              createdAt: new Date().toISOString()
            },
            ...(current.operatorActions || [])
          ].slice(0, 120)
        : (current.operatorActions || [])
    }));

    window.setTimeout(() => {
      setState((current) => advanceOwnMessageStatus(current, threadId, message.id, "delivered"));
    }, 700);

    window.setTimeout(() => {
      setState((current) => advanceOwnMessageStatus(current, threadId, message.id, "seen"));
    }, 1800);
  }

  function selectCircle(circleId) {
    setState((current) => ({ ...current, activeCircleId: circleId }));
  }

  function selectMiniApp(appId) {
    setState((current) => ({ ...current, activeMiniAppId: appId }));
  }

  async function launchMiniApp(app) {
    const snapshot = stateRef.current || state;
    const activeThread = snapshot.threads.find((thread) => thread.id === snapshot.selectedThreadId);
    const activeCircle = snapshot.circles.find((circle) => circle.id === snapshot.activeCircleId);
    const recent = await addMiniAppRecentRecord({
      name: app.name,
      meta: `Opened from ${activeThread?.name || "FoxHub"}`
    });
    const permission = await addMiniAppPermissionRecord({
      appId: app.id,
      appName: app.name,
      scope: "identity, wallet, contacts",
      status: "granted",
      meta: `Granted from ${activeCircle?.name || "FoxHub"}`
    });

    setState((current) => ({
      ...current,
      activeMiniAppId: app.id,
      miniAppRecents: [recent, ...current.miniAppRecents.filter((item) => item.name !== app.name)].slice(0, 6),
      miniAppPermissions: [permission, ...current.miniAppPermissions.filter((item) => item.appId !== app.id)].slice(0, 6),
      serviceContinuity: [
        {
          id: `svc-${Date.now()}`,
          appId: app.id,
          appName: app.name,
          fromThread: activeThread?.name || "FoxHub",
          fromCircle: activeCircle?.name || "General",
          returnLabel: `Return to ${activeThread?.name || "conversation"}`,
          meta: "Opened from service context"
        },
        ...current.serviceContinuity.filter((item) => item.appId !== app.id)
      ].slice(0, 6)
    }));
  }

  async function addWalletEvent(event) {
    const record = await createWalletEventRecord(event);
    setState((current) => ({
      ...current,
      walletEvents: [record, ...current.walletEvents]
    }));
  }

  async function startDirectThread(contactId) {
    const snapshot = stateRef.current || state;
    const alreadyBlocked = (snapshot.blockedUsers || []).some((item) => item.contactId === contactId);
    if (alreadyBlocked) return;
    const contact = snapshot.contacts.find((item) => item.id === contactId);
    if (!contact) return;

    const existing = snapshot.threads.find((thread) => thread.id === contactId || thread.name === contact.name);
    if (existing) {
      setState((current) => ({
        ...current,
        selectedThreadId: existing.id,
        contacts: current.contacts.map((item) =>
          item.id === contactId
            ? {
                ...item,
                lastActiveLabel: "opened just now",
                relationshipScore: typeof item.relationshipScore === "number" ? Math.min(item.relationshipScore + 2, 100) : item.relationshipScore
              }
            : item
        )
      }));
      return;
    }

    const newThread = await createDirectThreadRecord(contact);
    setState((current) => ({
      ...current,
      threads: [newThread, ...current.threads],
      selectedThreadId: newThread.id,
      contacts: current.contacts.map((item) =>
        item.id === contactId
          ? {
              ...item,
              lastActiveLabel: "opened just now",
              relationshipScore: typeof item.relationshipScore === "number" ? Math.min(item.relationshipScore + 4, 100) : item.relationshipScore
            }
          : item
      )
    }));
  }

  function startShakeMatch() {
    const snapshot = stateRef.current || state;
    const nearby = snapshot?.peopleNearby || [];
    if (!nearby.length) return;
    const candidate = nearby[Math.floor(Math.random() * nearby.length)];
    const entry = {
      id: `shake-${Date.now()}`,
      ...candidate,
      matchedAt: new Date().toISOString(),
      matchNote: candidate.activity || "Share a verified signal"
    };
    setState((current) => ({
      ...current,
      shakeMatches: [entry, ...current.shakeMatches].slice(0, 4)
    }));
  }

  function logFileTransfer(payload = {}) {
    const entry = {
      id: `file-${Date.now()}`,
      title: payload.title || "Doc transfer",
      recipient: payload.recipient || "Partner",
      status: payload.status || "Delivered",
      meta: payload.meta || new Date().toLocaleTimeString()
    };
    setState((current) => ({
      ...current,
      fileTransfers: [entry, ...current.fileTransfers].slice(0, 6)
    }));
  }

  function openLiveChannel(channelId) {
    const snapshot = stateRef.current || state;
    const channel = snapshot?.channelStreams?.find((item) => item.id === channelId);
    if (!channel) return;
    void startDirectThread(channel.contactId);
    logFileTransfer({
      title: `${channel.title} briefing`,
      recipient: channel.host,
      status: "Viewed",
      meta: "Channel stream opened"
    });
  }

  function openCommunityChannel(channelId) {
    const snapshot = stateRef.current || state;
    const channel = snapshot?.communityChannels?.find((item) => item.id === channelId);
    if (!channel) return;
    if (channel.threadId && snapshot?.threads?.some((thread) => thread.id === channel.threadId)) {
      setState((current) => ({
        ...current,
        selectedThreadId: channel.threadId,
        threads: current.threads.map((thread) =>
          thread.id === channel.threadId ? { ...thread, lastActiveLabel: "opened just now" } : thread
        )
      }));
      return;
    }
    const matchingThread = snapshot?.threads?.find(
      (thread) =>
        thread.name === channel.name &&
        (thread.type === "community" || thread.type === "private-group")
    );
    if (matchingThread) {
      setState((current) => ({
        ...current,
        selectedThreadId: matchingThread.id,
        threads: current.threads.map((thread) =>
          thread.id === matchingThread.id ? { ...thread, lastActiveLabel: "opened just now" } : thread
        )
      }));
      return;
    }
    void startDirectThread(channel.contactId);
  }

  async function createGroupConversation(payload = {}) {
    const snapshot = stateRef.current || state;
    const name = sanitizeUserText(payload.name || "", 72);
    if (!name) return null;
    const type = payload.type === "community" ? "community" : "private";
    const topic = sanitizeUserText(payload.topic || "", 120);
    const selectedMembers = Array.isArray(payload.memberIds)
      ? payload.memberIds.filter((id) => (snapshot.contacts || []).some((contact) => contact.id === id))
      : [];
    const contactsById = new Map((snapshot.contacts || []).map((contact) => [contact.id, contact]));
    const memberNames = selectedMembers
      .map((id) => contactsById.get(id)?.displayName || contactsById.get(id)?.name)
      .filter(Boolean);
    const memberCount = Math.max(2 + memberNames.length, type === "community" ? 24 : 3);
    const threadId = `group-${Date.now()}`;
    const thread = {
      id: threadId,
      name,
      type: type === "community" ? "community" : "private-group",
      members: memberCount,
      presence: type === "community" ? `${Math.max(2, Math.floor(memberCount / 4))} online` : `${memberCount} members`,
      presenceState: "online",
      lastActiveLabel: "created just now",
      unreadCount: 0,
      messages: [
        {
          id: 1,
          author: snapshot.profile?.name || "You",
          text:
            type === "community"
              ? `Created community group${topic ? ` · ${topic}` : ""}.`
              : `Created private group${topic ? ` · ${topic}` : ""}.`,
          time: "now",
          mine: true,
          status: "seen"
        },
        ...(memberNames.length
          ? [
              {
                id: 2,
                author: "FoxHub",
                text: `Added: ${memberNames.join(", ")}.`,
                time: "now",
                mine: false
              }
            ]
          : [])
      ]
    };

    setState((current) => {
      const nextCommunityChannels =
        type === "community"
          ? [
              {
                id: `community-${Date.now()}`,
                name,
                mod: current.profile?.name || current.profile?.handle || "You",
                contactId: selectedMembers[0] || "isa",
                members: memberCount,
                topic: topic || "Community updates",
                threadId
              },
              ...(current.communityChannels || []).filter((item) => item.name !== name)
            ].slice(0, 12)
          : current.communityChannels || [];

      return {
        ...current,
        threads: [thread, ...(current.threads || []).filter((item) => item.id !== threadId)].slice(0, 120),
        selectedThreadId: threadId,
        communityChannels: nextCommunityChannels,
        notificationEvents: [
          makeNotificationEvent({
            title: type === "community" ? "Community group created" : "Private group created",
            body: `${name} is ready for group chat.`,
            category: "groups"
          }),
          ...(current.notificationEvents || [])
        ].slice(0, 120),
        auditEvents: [
          makeAuditEvent({
            type: "groups",
            action: type === "community" ? "create_community_group" : "create_private_group",
            actorId: current.profile?.handle || "self",
            targetId: threadId,
            detail: `${name} created with ${memberCount} members.`,
            severity: "info"
          }),
          ...(current.auditEvents || [])
        ].slice(0, 120)
      };
    });

    return { id: threadId, name };
  }

  function resolveLocalListing(listingId, note = "Cleared by moderator") {
    if (!listingId) return;
    setState((current) => ({
      ...current,
      localListings: current.localListings.map((listing) =>
        listing.id === listingId ? { ...listing, flagged: false, status: "Approved", modNote: note } : listing
      )
    }));
  }

  function updateCreatorOrder(orderId, status = "Preparing") {
    if (!orderId) return;
    setState((current) => ({
      ...current,
      creatorOrders: current.creatorOrders.map((order) =>
        order.id === orderId ? { ...order, status } : order
      )
    }));
  }

  function logDemandSignal(entry) {
    if (!entry) return;
    const signalRecord = {
      id: `signal-${Date.now()}`,
      region: entry.region || "Unknown",
      demand: entry.demand || "Active",
      capacity: entry.capacity || "Monitoring",
      note: entry.note || "Derived from platform signals"
    };
    setState((current) => ({
      ...current,
      demandSignals: [signalRecord, ...current.demandSignals].slice(0, 6)
    }));
  }

  async function addMoment(text, profile, attachments = []) {
    const record = await createMomentRecord(text, profile, attachments);
    setState((current) => ({
      ...current,
      moments: [record, ...current.moments]
    }));
  }

  function reactToMoment(momentId, reaction = "like") {
    if (!momentId) return;
    const reactionTypes = ["like", "love", "haha", "wow", "fire", "support", "thanks", "eyes"];
    const normalizedReaction = reactionTypes.includes(reaction) ? reaction : "like";
    setState((current) => ({
      ...current,
      moments: (current.moments || []).map((moment) => {
        if (moment.id !== momentId) return moment;
        const reactions = reactionTypes.reduce((next, type) => {
          next[type] = Number(moment.reactions?.[type] || 0);
          return next;
        }, {});
        const previous = moment.myReaction || "";
        if (previous && reactions[previous] > 0) reactions[previous] -= 1;
        const nextReaction = previous === normalizedReaction ? "" : normalizedReaction;
        if (nextReaction) reactions[nextReaction] += 1;
        const reactionCount = reactionTypes.reduce((total, type) => total + Number(reactions[type] || 0), 0);
        const comments = Array.isArray(moment.comments) ? moment.comments : [];
        return {
          ...moment,
          reactions,
          myReaction: nextReaction,
          stats: `${reactionCount} reacts · ${comments.length} replies`
        };
      })
    }));
  }

  function commentOnMoment(momentId, text = "") {
    const cleaned = sanitizeUserText(text || "", 240);
    if (!momentId || !cleaned) return;
    setState((current) => ({
      ...current,
      moments: (current.moments || []).map((moment) => {
        if (moment.id !== momentId) return moment;
        const comments = Array.isArray(moment.comments) ? moment.comments : [];
        const nextComments = [
          ...comments.slice(-39),
          {
            id: `m-${momentId}-c-${Date.now()}`,
            author: current.profile?.name || current.profile?.handle || "You",
            text: cleaned,
            time: "now"
          }
        ];
        const reactions = {
          like: Number(moment.reactions?.like || 0),
          love: Number(moment.reactions?.love || 0),
          haha: Number(moment.reactions?.haha || 0),
          wow: Number(moment.reactions?.wow || 0),
          fire: Number(moment.reactions?.fire || 0),
          support: Number(moment.reactions?.support || 0),
          thanks: Number(moment.reactions?.thanks || 0),
          eyes: Number(moment.reactions?.eyes || 0)
        };
        const reactionCount = Object.values(reactions).reduce((total, value) => total + Number(value || 0), 0);
        return {
          ...moment,
          comments: nextComments,
          stats: `${reactionCount} reacts · ${nextComments.length} replies`
        };
      })
    }));
  }

  function respondFriendRequest(requestId, decision = "accept") {
    if (!requestId) return;
    const snapshot = stateRef.current || state;
    const request = (snapshot.friendRequests || []).find((item) => item.id === requestId);
    if (!request) return;

    setState((current) => {
      const nextFriendRequests = (current.friendRequests || []).filter((item) => item.id !== requestId);
      const alreadyContact = (current.contacts || []).some((contact) => contact.id === request.fromContactId);
      const shouldAddContact = decision === "accept" && !alreadyContact;
      const nextContacts = shouldAddContact
        ? [
            {
              id: request.fromContactId,
              name: sanitizeUserText(request.name, 80),
              displayName: sanitizeUserText(request.name, 80),
              handle: sanitizeUserText(request.handle, 40),
              city: sanitizeUserText(request.city || "Unknown", 80),
              status: "new connection",
              accountType: "member",
              trust: "trusted",
              trustTier: "B",
              peerRatingAverage: 4.0,
              peerRatingCount: 1,
              myPeerRating: "",
              verificationLevel: "profile verified",
              presenceState: "away",
              lastActiveLabel: "connected just now",
              tier: "member",
              customerStage: "active",
              relationshipScore: 72
            },
            ...(current.contacts || [])
          ]
        : current.contacts || [];

      return {
        ...current,
        friendRequests: nextFriendRequests,
        contacts: nextContacts,
        notificationEvents: [
          makeNotificationEvent({
            title: decision === "accept" ? "Friend request accepted" : "Friend request ignored",
            body: `${request.name} ${decision === "accept" ? "is now in your People list." : "was removed from requests."}`,
            category: "network"
          }),
          ...(current.notificationEvents || [])
        ].slice(0, 120)
      };
    });
  }

  function reviewMemberApplication(recordId, decision = "approve") {
    if (!recordId) return;
    const normalizedDecision = ["approve", "priority", "hold", "reject"].includes(decision) ? decision : "hold";
    const targetSnapshot = (stateRef.current?.userRecords || []).find((record) => record.id === recordId);
    const targetEmailSnapshot = targetSnapshot?.profile?.email || targetSnapshot?.contactId || "";

    setState((current) => {
      const target = (current.userRecords || []).find((record) => record.id === recordId);
      if (!target) return current;

      const now = new Date().toISOString();
      const approved = normalizedDecision === "approve" || normalizedDecision === "priority";
      const decisionLabels = {
        approve: "approved as a FoxHub Member",
        priority: "approved with priority access",
        hold: "held for follow-up",
        reject: "rejected"
      };
      const nextRecord = {
        ...target,
        stage: approved ? "active" : normalizedDecision === "reject" ? "rejected" : "review",
        status: approved ? "active" : normalizedDecision === "reject" ? "rejected" : "review",
        supportTier: normalizedDecision === "priority" ? "priority" : target.supportTier || "standard",
        identityState: approved ? "verified" : normalizedDecision === "reject" ? "rejected" : "review",
        consentState: approved ? "verified" : target.consentState || "review",
        riskState: normalizedDecision === "reject" ? "restricted" : "monitor",
        paymentStatus: approved ? "eligible" : target.paymentStatus || "not_started",
        lastActivity: `Staff ${decisionLabels[normalizedDecision]} on ${now}`,
        notes: `${target.notes || "Member application reviewed."} Staff decision: ${decisionLabels[normalizedDecision]}.`,
        tags: [...new Set([...(target.tags || []), normalizedDecision === "priority" ? "priority" : approved ? "active" : normalizedDecision])],
        timeline: [...(target.timeline || []).slice(-8), `Staff ${decisionLabels[normalizedDecision]}`],
        reviewedAt: now,
        reviewedBy: current.profile?.handle || "FoxHub staff"
      };
      const targetEmail = target.profile?.email || target.contactId || "";
      const isCurrentProfile =
        target.id?.startsWith("self-") ||
        (targetEmail && targetEmail === current.profile?.email) ||
        target.contactId === current.profile?.handle;
      const nextProfile = isCurrentProfile
        ? {
            ...current.profile,
            accessState: approved ? (normalizedDecision === "priority" ? "priority" : "active") : "waitlist",
            accessNote: approved ? (normalizedDecision === "priority" ? "Priority access" : "FoxHub Member approved") : normalizedDecision === "reject" ? "Application rejected" : "Staff follow-up needed",
            onboarded: approved ? true : current.profile?.onboarded,
            waitlistEndsAt: approved ? "" : current.profile?.waitlistEndsAt
          }
        : current.profile;
      const emailEvent = makeApplicantDecisionEmailEvent({
        target,
        decision: normalizedDecision,
        decisionLabel: decisionLabels[normalizedDecision]
      });

      return {
        ...current,
        profile: nextProfile,
        userRecords: (current.userRecords || []).map((record) => (record.id === recordId ? nextRecord : record)),
        auditEvents: [
          makeAuditEvent({
            type: "staff",
            action: "member_application_review",
            actorId: current.profile?.handle || "staff",
            targetId: recordId,
            detail: `${target.profile?.displayName || target.contactId || recordId} was ${decisionLabels[normalizedDecision]}.`,
            severity: approved ? "info" : "review"
          }),
          ...(current.auditEvents || [])
        ].slice(0, 120),
        notificationEvents: [
          emailEvent,
          makeNotificationEvent({
            title: "Member application reviewed",
            body: `${target.profile?.displayName || target.contactId || "Applicant"} was ${decisionLabels[normalizedDecision]}. ${approved || normalizedDecision === "reject" ? "Applicant email notice was sent." : "Follow-up email notice was queued."}`,
            category: "staff",
            status: "unread"
          }),
          ...(current.notificationEvents || [])
        ].slice(0, 120)
      };
    });

    if (targetEmailSnapshot) {
      const approved = normalizedDecision === "approve" || normalizedDecision === "priority";
      const rejected = normalizedDecision === "reject";
      const accessPatch = {
        accessState: approved ? (normalizedDecision === "priority" ? "priority" : "active") : "waitlist",
        accessNote: approved ? (normalizedDecision === "priority" ? "Priority access" : "FoxHub Member approved") : rejected ? "Application denied" : "Staff follow-up needed",
        onboarded: approved,
        waitlistEndsAt: approved ? "" : targetSnapshot?.waitlistEndsAt || "",
        reviewedAt: new Date().toISOString(),
        reviewedBy: stateRef.current?.profile?.handle || "FoxHub staff",
        emailTemplate: "foxhub_member_application_decision",
        emailSubject: approved
          ? "Your FoxHub Member application was approved"
          : rejected
            ? "Your FoxHub Member application was not approved"
            : "Your FoxHub Member application needs follow-up",
        emailBody: approved
          ? "Your FoxHub Member application was approved. You can sign in with the email you used to apply."
          : rejected
            ? "Your FoxHub Member application was denied after manager review."
            : "Your FoxHub Member application is still under manager review. FoxHub staff may follow up before a final decision."
      };
      updateApplicantAccessRecord(targetEmailSnapshot, accessPatch).catch((error) => {
        console.warn("Unable to persist applicant access decision", error);
      });
    }
  }

  function addFoxHubStaffMember(payload = {}) {
    const now = new Date().toISOString();
    const email = sanitizeUserText(payload.email || "", 160).toLowerCase();
    if (!email) return null;

    const name = sanitizeUserText(payload.name || "New FoxHub Staff Member", 80) || "New FoxHub Staff Member";
    const role = sanitizeUserText(payload.role || "support", 40).toLowerCase() || "support";
    const uid = sanitizeUserText(payload.uid || `staff-${email.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`, 120);
    const scopes = (Array.isArray(payload.scopes) ? payload.scopes : String(payload.scopes || "support,member-review,trust-safety,disputes").split(","))
      .map((scope) => sanitizeUserText(scope, 40).toLowerCase())
      .filter(Boolean)
      .slice(0, 24);
    const invitedBy = stateRef.current?.profile?.email || stateRef.current?.profile?.handle || "management";
    const hasManagerAccess = ["owner", "founder", "admin", "manager"].some((token) => role.includes(token));
    const staffRecord = {
      id: uid,
      uid,
      email,
      name,
      displayName: name,
      handle: sanitizeUserText(payload.handle || email.split("@")[0] || "staff", 40).toLowerCase(),
      role,
      title: sanitizeUserText(payload.title || "Support Operations Specialist", 80),
      department: sanitizeUserText(payload.department || "Support Operations", 80),
      status: "invited",
      accessState: "invited",
      employmentStatus: "pending_invite",
      accountType: "staff",
      staffAccess: true,
      managementAccess: hasManagerAccess,
      managerAccess: hasManagerAccess,
      founder: false,
      scopes,
      invitedBy,
      createdAt: now,
      updatedAt: now,
      operatorAccessRef: `operatorAccess/${uid}`,
      memberProfileRef: `users/${uid}`
    };
    const operatorRecord = {
      id: `operator-access-${uid}`,
      userId: uid,
      email,
      role,
      state: "invited",
      scopes,
      grantedAt: now,
      grantedBy: invitedBy,
      createdAt: now,
      updatedAt: now
    };

    setState((current) => ({
      ...current,
      pendingStaffMembers: [
        staffRecord,
        ...((current.pendingStaffMembers || []).filter((item) => item.id !== uid && String(item.email || "").toLowerCase() !== email))
      ].slice(0, 50),
      operatorAccessRecords: [
        operatorRecord,
        ...((current.operatorAccessRecords || []).filter((item) => item.id !== operatorRecord.id && String(item.email || "").toLowerCase() !== email))
      ].slice(0, 50),
      auditEvents: [
        makeAuditEvent({
          type: "staff",
          action: "staff_member_invited",
          actorId: current.profile?.handle || current.profile?.email || "management",
          targetId: uid,
          detail: `${name} invited as ${role} with ${scopes.length || 0} staff scopes.`,
          severity: "review"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120),
      notificationEvents: [
        makeNotificationEvent({
          title: "Staff member invited",
          body: `${name} was added to the Staff setup queue for ${role} access.`,
          category: "staff"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120)
    }));

    return { staffRecord, operatorRecord };
  }

  async function addFavorite(favorite) {
    const record = await addFavoriteRecord(favorite);
    setState((current) => ({
      ...current,
      favorites: [record, ...current.favorites]
    }));
  }

  async function addSavedItem(item) {
    const record = await addSavedItemRecord(item);
    setState((current) => ({
      ...current,
      savedItems: [record, ...current.savedItems.filter((saved) => saved.title !== record.title)].slice(0, 8)
    }));
  }

  async function runQrAction(action) {
    const record = await createQrActionRecord(action);
    setState((current) => ({
      ...current,
      walletEvents: record.amount ? [record, ...current.walletEvents] : current.walletEvents,
      qrHistory: [
        {
          id: record.id,
          title: record.title,
          detail: record.meta,
          meta: record.amount ? `Payment action · ${record.amount}` : "Identity or service action"
        },
        ...current.qrHistory
      ].slice(0, 8)
    }));
  }

  function recordModerationCase(caseRecord) {
    if (!caseRecord) return;
    setState((current) => ({
      ...current,
      moderationCases: [caseRecord, ...(current.moderationCases || []).filter((item) => item.id !== caseRecord.id)].slice(0, 24),
      auditEvents: [
        makeAuditEvent({
          type: "moderation",
          action: caseRecord.status || "case",
          actorId: current.profile.handle || "system",
          targetId: caseRecord.contactId || caseRecord.threadId || "wallet",
          detail: caseRecord.detail || "Moderator case recorded.",
          severity: caseRecord.status === "block" ? "high" : "review"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120),
      notificationEvents: [
        makeNotificationEvent({
          title: caseRecord.status === "block" ? "Wallet action blocked" : "Wallet action in review",
          body: caseRecord.detail || "A wallet action was routed into moderation.",
          category: "moderation"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120)
    }));
  }

  function flagCurrentAccountForCommerce(reason = "commerce flag", reporterId = "peer") {
    const now = new Date().toISOString();
    setState((current) => {
      const previousFlags = Array.isArray(current.profile?.commerceFlags) ? current.profile.commerceFlags : [];
      const nextFlag = {
        id: `commerce-flag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        reporterId: sanitizeUserText(reporterId || "peer", 80),
        reason: sanitizeUserText(reason || "commerce flag", 160),
        status: "active",
        createdAt: now
      };
      const nextFlags = [nextFlag, ...previousFlags].slice(0, 40);
      const penaltyUntil = commercePenaltyUntil(nextFlags);
      const nextPolicy = getCommercePolicy({
        ...current,
        profile: {
          ...current.profile,
          commerceFlags: nextFlags,
          commercePenaltyUntil: penaltyUntil || current.profile?.commercePenaltyUntil || ""
        }
      });
      return {
        ...current,
        commercePolicy: nextPolicy,
        profile: {
          ...current.profile,
          commerceFlags: nextFlags,
          commercePenaltyUntil: penaltyUntil || current.profile?.commercePenaltyUntil || ""
        },
        merchantPayoutControls: penaltyUntil
          ? [
              {
                id: "commerce-penalty-current",
                merchantId: current.profile?.handle || current.profile?.email || "current-account",
                merchantName: current.profile?.name || current.profile?.handle || "Current account",
                state: "hold",
                reservePercent: 100,
                nextPayoutAt: "",
                reason: `Buying and selling paused for ${COMMERCE_PENALTY_DAYS} days after ${COMMERCE_PENALTY_FLAG_THRESHOLD} account flags.`,
                penaltyUntil,
                updatedAt: now
              },
              ...((current.merchantPayoutControls || []).filter((item) => item.id !== "commerce-penalty-current"))
            ].slice(0, 120)
          : current.merchantPayoutControls,
        auditEvents: [
          makeAuditEvent({
            type: "moderation",
            action: penaltyUntil ? "commerce_penalty_started" : "commerce_account_flagged",
            actorId: reporterId || "peer",
            targetId: current.profile?.handle || current.profile?.email || "current-account",
            detail: penaltyUntil
              ? `Commerce paused until ${new Date(penaltyUntil).toLocaleDateString()} after account flags.`
              : `Commerce account flag recorded: ${reason}.`,
            severity: penaltyUntil ? "high" : "review"
          }),
          ...(current.auditEvents || [])
        ].slice(0, 120),
        notificationEvents: [
          makeNotificationEvent({
            title: penaltyUntil ? "Buying and selling paused" : "Commerce flag recorded",
            body: penaltyUntil
              ? `This account cannot buy or sell until ${new Date(penaltyUntil).toLocaleDateString()} after reaching ${COMMERCE_PENALTY_FLAG_THRESHOLD} active flags.`
              : `Commerce flag recorded. ${COMMERCE_PENALTY_FLAG_THRESHOLD} active flags starts a ${COMMERCE_PENALTY_DAYS}-day buy/sell pause.`,
            category: "moderation"
          }),
          ...(current.notificationEvents || [])
        ].slice(0, 120)
      };
    });
  }

  function addListing(listing) {
    if (!listing) return;
    const snapshot = stateRef.current || state;
    const commercePolicy = getCommercePolicy(snapshot);
    if (commercePolicy.commerceBlocked) {
      throw new Error(commercePolicy.reason || "Buying and selling are paused for this account.");
    }
    setState((current) => ({
      ...current,
      listings: [listing, ...current.listings].slice(0, 60)
    }));
  }

  function saveListingSearch(search) {
    if (!search || !search.name) return;
    const nextSearch = { id: `search-${Date.now()}`, ...search };
    setState((current) => ({
      ...current,
      savedSearches: [nextSearch, ...current.savedSearches.filter((item) => item.name !== search.name)].slice(0, 10)
    }));
  }

  function recordListingAlert(alert) {
    if (!alert) return;
    setState((current) => ({
      ...current,
      listingAlerts: [alert, ...current.listingAlerts].slice(0, 12)
    }));
  }

  function updateListing(listingId, updates) {
    if (!listingId) return;
    setState((current) => ({
      ...current,
      listings: current.listings.map((item) => (item.id === listingId ? { ...item, ...updates } : item))
    }));
  }

  async function rateContactTrust(contactId, grade) {
    const normalizedGrade = normalizeTrustTier(grade);
    const nextScore = gradeToScore(normalizedGrade);
    const snapshot = stateRef.current || state;
    const contact = (snapshot.contacts || []).find((item) => item.id === contactId);
    if (!contact) return null;

    const record = await createRatingRecord({
      targetType: "contact",
      targetId: contact.id,
      actorId: snapshot.profile.handle || "self",
      actorLabel: snapshot.profile.name || snapshot.profile.handle || "FoxHub user",
      rating: nextScore,
      trustTier: normalizedGrade,
      title: `Peer trust rating for ${contact.displayName || contact.name}`,
      body: `${contact.displayName || contact.name} is currently rated ${normalizedGrade}.`,
      status: nextScore <= 2 ? "review" : "published",
      moderationStatus: nextScore <= 2 ? "queued" : "clear"
    });

    setState((current) => {
      let nextSnapshot = null;
      const nextContacts = current.contacts.map((item) => {
        if (item.id !== contactId) return item;
        const existingCount = Number.isFinite(item.peerRatingCount) ? item.peerRatingCount : 0;
        const existingAverage = Number.isFinite(item.peerRatingAverage) ? item.peerRatingAverage : gradeToScore(item.myPeerRating || item.trustTier || "B");
        const previousScore = item.myPeerRating ? gradeToScore(item.myPeerRating) : null;
        const nextCount = previousScore === null ? existingCount + 1 : Math.max(existingCount, 1);
        const cumulativeScore = existingAverage * existingCount;
        const adjustedScore = previousScore === null ? cumulativeScore + nextScore : cumulativeScore - previousScore + nextScore;
        const nextAverage = nextCount > 0 ? Number((adjustedScore / nextCount).toFixed(1)) : nextScore;
        const nextContact = {
          ...item,
          trustTier: averageToTrustTier(nextAverage),
          peerRatingAverage: nextAverage,
          peerRatingCount: nextCount,
          myPeerRating: normalizedGrade
        };
        nextSnapshot = buildContactSnapshot(nextContact, record.createdAt);
        return nextContact;
      });
      const nextQueue = nextScore <= 2
        ? [
            {
              id: `rating-mod-${Date.now()}`,
              recordId: record.id,
              targetType: "contact",
              targetId: contactId,
              reason: "Low peer rating needs operator review",
              status: "open",
              createdAt: record.createdAt
            },
            ...(current.ratingModerationQueue || [])
          ].slice(0, 60)
        : (current.ratingModerationQueue || []);
      return {
        ...current,
        contacts: nextContacts,
        ratingRecords: [record, ...(current.ratingRecords || [])].slice(0, 120),
        reputationSnapshots: nextSnapshot ? upsertReputationSnapshot(current.reputationSnapshots, nextSnapshot) : (current.reputationSnapshots || []),
        ratingModerationQueue: nextQueue,
        auditEvents: [
          makeAuditEvent({
            type: "rating",
            action: "peer_rating",
            actorId: current.profile.handle || "self",
            targetId: contactId,
            detail: `Peer rating updated to ${normalizedGrade}.`,
            severity: nextScore <= 2 ? "review" : "info"
          }),
          ...(current.auditEvents || [])
        ].slice(0, 120)
      };
    });
    return record;
  }

  function toggleOfficialAccountSubscription(accountId) {
    setState((current) => {
      const subscribed = current.officialAccountSubscriptions.includes(accountId);
      return {
        ...current,
        officialAccountSubscriptions: subscribed
          ? current.officialAccountSubscriptions.filter((id) => id !== accountId)
          : [accountId, ...current.officialAccountSubscriptions]
      };
    });
  }

  async function publishMediaClip(payload) {
    const record = await createMediaClipRecord(payload);
    setState((current) => ({
      ...current,
      shortVideos: [record, ...(current.shortVideos || [])].slice(0, 24)
    }));
    return record;
  }

  async function publishStoryBundle(payload) {
    const record = await createStoryBundleRecord(payload);
    setState((current) => ({
      ...current,
      storyBundles: [record, ...(current.storyBundles || [])].slice(0, 24)
    }));
    return record;
  }

  async function placeAuctionBid(payload) {
    const record = await createAuctionBidRecord(payload);
    setState((current) => ({
      ...current,
      bidEvents: [record, ...(current.bidEvents || [])].slice(0, 48),
      auctionLots: (current.auctionLots || []).map((lot) =>
        lot.id === record.lotId
          ? {
              ...lot,
              currentBid: Math.max(Number(lot.currentBid) || 0, Number(record.amount) || 0),
              bidCount: (Number(lot.bidCount) || 0) + 1
            }
          : lot
      )
    }));
    return record;
  }

  async function upsertCart(payload) {
    const record = await createCartRecord(payload);
    setState((current) => ({
      ...current,
      carts: [record, ...(current.carts || []).filter((cart) => cart.id !== record.id)].slice(0, 12)
    }));
    return record;
  }

  async function addShopReview(payload) {
    const record = await createReviewRecord(payload);
    const ratingRecord = await createRatingRecord({
      targetType: "shop",
      targetId: record.shopId,
      actorId: stateRef.current?.profile?.handle || "self",
      actorLabel: record.author,
      rating: record.rating,
      trustTier: averageToTrustTier(record.rating),
      title: record.title,
      body: record.body,
      status: record.rating <= 2 ? "review" : "published",
      moderationStatus: record.rating <= 2 ? "queued" : "clear"
    });
    setState((current) => {
      const nextReviews = [record, ...(current.shopReviews || [])].slice(0, 60);
      const nextShopProfiles = (current.shopProfiles || []).map((shop) => {
        if (shop.id !== record.shopId) return shop;
        const matching = nextReviews.filter((item) => item.shopId === shop.id);
        const averageRating = matching.length
          ? Number((matching.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) / matching.length).toFixed(1))
          : Number(shop.rating) || 0;
        return {
          ...shop,
          rating: averageRating,
          reviewCount: matching.length
        };
      });
      const activeShop = nextShopProfiles.find((shop) => shop.id === record.shopId) || (current.shopProfiles || []).find((shop) => shop.id === record.shopId);
      const nextQueue = record.rating <= 2
        ? [
            {
              id: `rating-mod-${Date.now()}`,
              recordId: ratingRecord.id,
              targetType: "shop",
              targetId: record.shopId,
              reason: "Low storefront rating needs operator review",
              status: "open",
              createdAt: ratingRecord.createdAt
            },
            ...(current.ratingModerationQueue || [])
          ].slice(0, 60)
        : (current.ratingModerationQueue || []);
      return {
        ...current,
        shopReviews: nextReviews,
        shopProfiles: nextShopProfiles,
        ratingRecords: [ratingRecord, ...(current.ratingRecords || [])].slice(0, 120),
        reputationSnapshots: activeShop
          ? upsertReputationSnapshot(current.reputationSnapshots, buildShopSnapshot(activeShop, nextReviews, ratingRecord.createdAt))
          : (current.reputationSnapshots || []),
        ratingModerationQueue: nextQueue,
        auditEvents: [
          makeAuditEvent({
            type: "rating",
            action: "shop_review",
            actorId: current.profile.handle || "self",
            targetId: record.shopId,
            detail: `Storefront review submitted with rating ${record.rating}.`,
            severity: record.rating <= 2 ? "review" : "info"
          }),
          ...(current.auditEvents || [])
        ].slice(0, 120),
        notificationEvents: [
          makeNotificationEvent({
            title: "Store review recorded",
            body: `A storefront review for ${record.shopId} was added to reputation tracking.`,
            category: "rating"
          }),
          ...(current.notificationEvents || [])
        ].slice(0, 120)
      };
    });
    return record;
  }

  function moderateRatingRecord(recordId, resolution = "approved") {
    if (!recordId) return;
    setState((current) => ({
      ...current,
      ratingRecords: (current.ratingRecords || []).map((record) =>
        record.id === recordId
          ? {
              ...record,
              status: resolution === "removed" ? "removed" : "published",
              moderationStatus: resolution === "removed" ? "removed" : "clear"
            }
          : record
      ),
      ratingModerationQueue: (current.ratingModerationQueue || []).map((item) =>
        item.recordId === recordId ? { ...item, status: resolution } : item
      ),
      auditEvents: [
        makeAuditEvent({
          type: "moderation",
          action: "rating_resolution",
          actorId: current.profile.handle || "ops",
          targetId: recordId,
          detail: `Rating moderation resolved as ${resolution}.`,
          severity: resolution === "removed" ? "review" : "info"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120),
      operatorActions: [
        {
          id: `ops-${Date.now()}`,
          action: "rating_moderation_resolved",
          actorId: current.profile.handle || "ops",
          targetId: recordId,
          detail: `Rating moderation was resolved as ${resolution}.`,
          outcome: resolution,
          createdAt: new Date().toISOString()
        },
        ...(current.operatorActions || [])
      ].slice(0, 120)
    }));
  }

  async function uploadDocumentEvidence(payload = {}) {
    const record = await createDocumentRecord({
      ownerId: stateRef.current?.profile?.handle || "self",
      ...payload
    });
    const operatorRecord = await createOperatorActionRecord({
      action: "document_uploaded",
      actorId: stateRef.current?.profile?.handle || "self",
      targetId: record.targetId,
      detail: `${record.name} uploaded to the document vault.`,
      outcome: record.status
    });
    setState((current) => ({
      ...current,
      documentVault: [record, ...(current.documentVault || [])].slice(0, 120),
      operatorActions: [operatorRecord, ...(current.operatorActions || [])].slice(0, 120),
      auditEvents: [
        makeAuditEvent({
          type: "document",
          action: "evidence_upload",
          actorId: current.profile.handle || "self",
          targetId: record.targetId,
          detail: `${record.name} was added to the document vault.`,
          severity: "info"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120),
      notificationEvents: [
        makeNotificationEvent({
          title: "Document added",
          body: `${record.name} is now available in the document vault.`,
          category: "document"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120)
    }));
    return record;
  }

  function submitVerificationCase(payload = {}) {
    const record = makeVerificationCase(payload);
    setState((current) => ({
      ...current,
      verificationCases: [record, ...(current.verificationCases || [])].slice(0, 48),
      auditEvents: [
        makeAuditEvent({
          type: "verification",
          action: "case_created",
          actorId: current.profile.handle || "ops",
          targetId: payload.targetId || "profile",
          detail: `${record.label} opened for review.`,
          severity: "review"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120),
      notificationEvents: [
        makeNotificationEvent({
          title: "Verification case opened",
          body: `${record.label} is now in the review queue.`,
          category: "verification"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120)
    }));
    return record;
  }

  function resolveVerificationCase(caseId, resolution = "approved") {
    if (!caseId) return;
    setState((current) => ({
      ...current,
      verificationCases: (current.verificationCases || []).map((item) =>
        item.id === caseId ? { ...item, status: resolution, stage: resolution === "approved" ? "complete" : "follow_up", updatedAt: new Date().toISOString() } : item
      ),
      auditEvents: [
        makeAuditEvent({
          type: "verification",
          action: "case_resolved",
          actorId: current.profile.handle || "ops",
          targetId: caseId,
          detail: `Verification case resolved as ${resolution}.`,
          severity: resolution === "approved" ? "info" : "review"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120),
      notificationEvents: [
        makeNotificationEvent({
          title: resolution === "approved" ? "Verification approved" : "Verification needs follow-up",
          body: `Verification case ${caseId} was updated to ${resolution}.`,
          category: "verification"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120)
    }));
  }

  function updateComplianceControl(controlId, nextStatus = "in_review") {
    if (!controlId) return;
    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      compliancePrograms: (current.compliancePrograms || []).map((item) =>
        item.id === controlId ? { ...item, status: sanitizeUserText(nextStatus, 24) || "in_review", lastReviewedAt: now } : item
      ),
      auditEvents: [
        makeAuditEvent({
          type: "compliance",
          action: "control_status_updated",
          actorId: current.profile.handle || "ops",
          targetId: controlId,
          detail: `Compliance control updated to ${nextStatus}.`,
          severity: nextStatus === "required" ? "review" : "info"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120)
    }));
  }

  function reportTrustSafetyIncident(payload = {}) {
    const detail = sanitizeUserText(payload.detail || "", 280);
    const type = sanitizeUserText(payload.type || "safety_report", 64);
    if (!detail) return;
    const severity = ["low", "medium", "high", "critical"].includes(payload.severity) ? payload.severity : "medium";
    const channel = sanitizeUserText(payload.channel || "services", 40);
    const now = new Date().toISOString();
    const record = {
      id: `tsi-${Date.now()}`,
      type,
      severity,
      status: "investigating",
      owner: sanitizeUserText(payload.owner || "Trust Ops", 80),
      channel,
      detail,
      createdAt: now
    };

    setState((current) => ({
      ...current,
      trustSafetyIncidents: [record, ...(current.trustSafetyIncidents || [])].slice(0, 120),
      moderationCases: [
        {
          id: `mod-${Date.now()}`,
          status: severity === "critical" ? "block" : "review",
          actionType: "trust-safety",
          contactId: payload.contactId || "",
          threadId: payload.threadId || "",
          detail,
          createdAt: now
        },
        ...(current.moderationCases || [])
      ].slice(0, 120),
      notificationEvents: [
        makeNotificationEvent({
          title: "Trust and safety incident filed",
          body: `${type} was added to the investigation queue.`,
          category: "safety"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120),
      auditEvents: [
        makeAuditEvent({
          type: "safety",
          action: "incident_reported",
          actorId: current.profile.handle || "ops",
          targetId: record.id,
          detail: `${type} reported with ${severity} severity.`,
          severity: severity === "critical" ? "high" : "review"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120)
    }));
  }

  function runMerchantRiskCheck(merchantId, reason = "manual review") {
    if (!merchantId) return;
    const snapshot = stateRef.current || state;
    const merchant =
      (snapshot.merchantOnboardingQueue || []).find((item) => item.merchantId === merchantId) ||
      (snapshot.merchantOnboardingQueue || []).find((item) => item.id === merchantId);
    const merchantName = merchant?.merchantName || merchantId;
    const score = Math.max(1, Math.min(99, Math.round(45 + Math.random() * 50)));
    const status = score >= 75 ? "review" : score >= 60 ? "monitor" : "clear";
    const now = new Date().toISOString();
    const signal = {
      id: `risk-${Date.now()}`,
      merchantId,
      merchantName,
      signal: sanitizeUserText(reason, 80) || "manual review",
      score,
      status,
      detail: `Risk check scored ${score}.`,
      detectedAt: now
    };

    setState((current) => ({
      ...current,
      merchantRiskSignals: [signal, ...(current.merchantRiskSignals || [])].slice(0, 120),
      merchantOnboardingQueue: (current.merchantOnboardingQueue || []).map((item) =>
        item.merchantId === merchantId || item.id === merchantId
          ? {
              ...item,
              riskTier: score >= 75 ? "high" : score >= 60 ? "medium" : "low",
              status: score >= 75 ? "hold" : score >= 60 ? "review" : "active",
              stage: score >= 75 ? "enhanced_due_diligence" : item.stage,
              nextAction: score >= 75 ? "Escalate to enhanced due diligence and payout hold" : item.nextAction,
              lastUpdatedAt: now
            }
          : item
      ),
      auditEvents: [
        makeAuditEvent({
          type: "risk",
          action: "merchant_risk_check",
          actorId: current.profile.handle || "ops",
          targetId: merchantId,
          detail: `${merchantName} scored ${score} (${status}).`,
          severity: status === "review" ? "review" : "info"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120)
    }));
  }

  function updateMerchantOnboarding(merchantId, action = "advance") {
    if (!merchantId) return;
    const now = new Date().toISOString();
    const advanceMap = {
      intake: "kyb_review",
      kyb_review: "risk_review",
      risk_review: "payout_enablement",
      payout_enablement: "active_monitoring",
      enhanced_due_diligence: "risk_review",
      active_monitoring: "active_monitoring"
    };
    setState((current) => {
      let approvedMerchant = null;
      const merchantOnboardingQueue = (current.merchantOnboardingQueue || []).map((item) => {
        if (item.merchantId !== merchantId && item.id !== merchantId) return item;
        const accountAgeDays = Number(item.accountAgeDays ?? daysSince(item.userCreatedAt || current.profile?.createdAt || current.profile?.lastSeenAt));
        const eligibleByAge = accountAgeDays >= MERCHANT_MIN_ACCOUNT_AGE_DAYS;
        const wantsApproval = action === "advance" && ["payout_enablement", "active_monitoring"].includes(item.stage);
        if (wantsApproval && !eligibleByAge) {
          return {
            ...item,
            stage: "age_gate",
            status: "hold",
            accountAgeDays,
            minimumAccountAgeDays: MERCHANT_MIN_ACCOUNT_AGE_DAYS,
            nextAction: `Hold merchant approval until the user account reaches ${MERCHANT_MIN_ACCOUNT_AGE_DAYS} days old.`,
            lastUpdatedAt: now
          };
        }
        const nextStage = action === "advance"
          ? advanceMap[item.stage] || item.stage
          : action === "hold"
            ? "enhanced_due_diligence"
            : "kyb_review";
        const nextStatus = action === "advance" ? "active" : action === "hold" ? "hold" : "review";
        const nextItem = {
          ...item,
          merchantAccountId: item.merchantAccountId || `merchant-account-${item.merchantId || item.id}`,
          storefronts: Array.isArray(item.storefronts) ? item.storefronts : item.storefrontId ? [item.storefrontId] : [],
          stage: nextStage,
          status: nextStatus,
          minimumAccountAgeDays: item.minimumAccountAgeDays || MERCHANT_MIN_ACCOUNT_AGE_DAYS,
          nextAction:
            action === "advance"
              ? "Continue to next onboarding checkpoint"
              : action === "hold"
                ? "Resolve enhanced due diligence blockers"
              : "Return merchant to compliance review",
          lastUpdatedAt: now
        };
        if (nextStatus === "active") approvedMerchant = nextItem;
        return nextItem;
      });
      const ownsApprovedMerchant =
        approvedMerchant &&
        (approvedMerchant.ownerEmail === current.profile?.email ||
          approvedMerchant.ownerHandle === current.profile?.handle ||
          current.profile?.merchantAccount?.merchantId === approvedMerchant.merchantId);
      return {
        ...current,
        profile: ownsApprovedMerchant
          ? {
              ...(current.profile || {}),
              merchantStatus: "active",
              merchantAccount: {
                ...(current.profile?.merchantAccount || {}),
                id: approvedMerchant.merchantAccountId || `merchant-account-${approvedMerchant.merchantId}`,
                merchantId: approvedMerchant.merchantId,
                merchantName: approvedMerchant.merchantName,
                status: "active",
                approvedAt: now,
                storefronts: approvedMerchant.storefronts || [],
                dashboardEnabled: true,
                inventory: current.profile?.merchantAccount?.inventory || [],
                settings: current.profile?.merchantAccount?.settings || {
                  fulfillmentMode: "local pickup",
                  payoutSchedule: "weekly",
                  returnsPolicy: "7-day review",
                  storefrontStatus: "draft"
                }
              }
            }
          : current.profile,
        merchantOnboardingQueue,
        auditEvents: [
          makeAuditEvent({
            type: "merchant",
            action: "onboarding_stage_updated",
            actorId: current.profile.handle || "ops",
            targetId: merchantId,
            detail: `Merchant onboarding action applied: ${action}.`,
            severity: action === "hold" ? "review" : "info"
          }),
          ...(current.auditEvents || [])
        ].slice(0, 120)
      };
    });
  }

  function upsertMerchantInventoryItem(payload = {}) {
    const now = new Date().toISOString();
    const itemId = payload.id || `sku-${Date.now()}`;
    setState((current) => {
      const merchantAccount = current.profile?.merchantAccount || {};
      const nextItem = {
        id: itemId,
        sku: sanitizeUserText(payload.sku || itemId, 48),
        title: sanitizeUserText(payload.title || "New item", 100),
        price: Number(payload.price || 0),
        stock: Math.max(0, Number(payload.stock || 0)),
        status: sanitizeUserText(payload.status || "active", 32),
        updatedAt: now
      };
      const inventory = [
        nextItem,
        ...(merchantAccount.inventory || []).filter((item) => item.id !== itemId)
      ].slice(0, 80);
      return {
        ...current,
        profile: {
          ...(current.profile || {}),
          merchantAccount: {
            ...merchantAccount,
            inventory
          }
        },
        auditEvents: [
          makeAuditEvent({
            type: "merchant",
            action: "inventory_item_saved",
            actorId: current.profile.handle || "merchant",
            targetId: itemId,
            detail: `${nextItem.title} inventory saved.`,
            severity: "info"
          }),
          ...(current.auditEvents || [])
        ].slice(0, 120)
      };
    });
  }

  function updateMerchantStorefrontSettings(payload = {}) {
    const now = new Date().toISOString();
    setState((current) => {
      const merchantAccount = current.profile?.merchantAccount || {};
      const settings = {
        ...(merchantAccount.settings || {}),
        storefrontStatus: sanitizeUserText(payload.storefrontStatus || merchantAccount.settings?.storefrontStatus || "draft", 32),
        fulfillmentMode: sanitizeUserText(payload.fulfillmentMode || merchantAccount.settings?.fulfillmentMode || "local pickup", 80),
        payoutSchedule: sanitizeUserText(payload.payoutSchedule || merchantAccount.settings?.payoutSchedule || "weekly", 40),
        returnsPolicy: sanitizeUserText(payload.returnsPolicy || merchantAccount.settings?.returnsPolicy || "7-day review", 120),
        supportContact: sanitizeUserText(payload.supportContact || current.profile?.email || "", 120),
        updatedAt: now
      };
      return {
        ...current,
        profile: {
          ...(current.profile || {}),
          merchantAccount: {
            ...merchantAccount,
            settings
          }
        },
        auditEvents: [
          makeAuditEvent({
            type: "merchant",
            action: "storefront_settings_updated",
            actorId: current.profile.handle || "merchant",
            targetId: merchantAccount.merchantId || merchantAccount.id || "merchant",
            detail: "Merchant storefront settings updated.",
            severity: "info"
          }),
          ...(current.auditEvents || [])
        ].slice(0, 120)
      };
    });
  }

  function submitMerchantApplication(payload = {}) {
    const snapshot = stateRef.current || state;
    const profile = snapshot.profile || {};
    const now = new Date().toISOString();
    const merchantName = sanitizeUserText(payload.merchantName || payload.businessName || `${profile.name || profile.handle || "Member"} Business`, 100);
    const businessType = sanitizeUserText(payload.businessType || "Local services", 80);
    const category = sanitizeUserText(payload.category || "Services", 80);
    const zipCode = normalizeZipCode(payload.zipCode || payload.postalCode || profile.zipCode || profile.postalCode);
    const merchantId = `merchant-app-${Date.now()}`;
    const ownerHandle = profile.handle || profile.email || "member";
    const accountAgeDays = daysSince(profile.createdAt || profile.createdAtIso || profile.memberSince || profile.lastSeenAt || profile.lastActiveAt, Date.now());
    const application = {
      id: merchantId,
      merchantId,
      merchantAccountId: `merchant-account-${merchantId}`,
      userCreatedAt: profile.createdAt || profile.createdAtIso || profile.memberSince || now,
      accountAgeDays,
      minimumAccountAgeDays: MERCHANT_MIN_ACCOUNT_AGE_DAYS,
      storefronts: [],
      merchantName,
      owner: profile.name || profile.displayName || ownerHandle,
      ownerHandle,
      ownerEmail: profile.email || "",
      businessType,
      category,
      city: sanitizeUserText(payload.city || profile.city || "", 80),
      zipCode,
      postalCode: zipCode,
      website: sanitizeUserText(payload.website || profile.website || "", 160),
      description: sanitizeUserText(payload.description || payload.detail || "", 320),
      stage: "member_application",
      status: "review",
      riskTier: accountAgeDays >= MERCHANT_MIN_ACCOUNT_AGE_DAYS ? "medium" : "new-account",
      requiredItems: ["business identity", "tax profile", "bank account confirmation"],
      nextAction: accountAgeDays >= MERCHANT_MIN_ACCOUNT_AGE_DAYS
        ? "FoxHub Management KYB review"
        : `Hold merchant approval until the user account reaches ${MERCHANT_MIN_ACCOUNT_AGE_DAYS} days old.`,
      source: "member application",
      submittedAt: now,
      lastUpdatedAt: now
    };
    const riskSignal = {
      id: `risk-${merchantId}`,
      merchantId,
      merchantName,
      signal: "member_application_received",
      score: accountAgeDays >= MERCHANT_MIN_ACCOUNT_AGE_DAYS ? 58 : 72,
      status: "review",
      detail: accountAgeDays >= MERCHANT_MIN_ACCOUNT_AGE_DAYS
        ? "New merchant application is ready for KYB intake."
        : `Account age is ${accountAgeDays} days; merchant approval remains age-gated.`,
      detectedAt: now
    };

    setState((current) => ({
      ...current,
      profile: {
        ...(current.profile || {}),
        merchantStatus: "review",
        merchantAccount: {
          id: application.merchantAccountId,
          merchantId,
          merchantName,
          status: "review",
          submittedAt: now
        }
      },
      merchantOnboardingQueue: [application, ...(current.merchantOnboardingQueue || [])].slice(0, 120),
      merchantRiskSignals: [riskSignal, ...(current.merchantRiskSignals || [])].slice(0, 120),
      notificationEvents: [
        makeNotificationEvent({
          title: "Merchant application sent to FoxHub Management",
          body: `${merchantName} is now waiting for KYB and risk review.`,
          category: "merchant"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120),
      auditEvents: [
        makeAuditEvent({
          type: "merchant",
          action: "merchant_application_submitted",
          actorId: ownerHandle,
          targetId: merchantId,
          detail: `${merchantName} submitted a merchant application for ${category}.`,
          severity: "review"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120)
    }));

    return application;
  }

  function openDisputeCase(payload = {}) {
    const merchantName = sanitizeUserText(payload.merchantName || "", 80);
    const reason = sanitizeUserText(payload.reason || "", 80);
    if (!merchantName || !reason) return;
    const record = {
      id: `disp-${Date.now()}`,
      merchantId: sanitizeUserText(payload.merchantId || merchantName.toLowerCase().replace(/\s+/g, "-"), 80),
      merchantName,
      amount: sanitizeUserText(payload.amount || "$0.00", 20),
      reason,
      status: "open",
      owner: sanitizeUserText(payload.owner || "Payments Ops", 80),
      openedAt: new Date().toISOString(),
      detail: sanitizeUserText(payload.detail || "Dispute opened for operator review.", 280)
    };

    setState((current) => ({
      ...current,
      disputeCases: [record, ...(current.disputeCases || [])].slice(0, 120),
      notificationEvents: [
        makeNotificationEvent({
          title: "Dispute case opened",
          body: `${merchantName} dispute routed to ${record.owner}.`,
          category: "payments"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120),
      auditEvents: [
        makeAuditEvent({
          type: "dispute",
          action: "dispute_opened",
          actorId: current.profile.handle || "ops",
          targetId: record.id,
          detail: `${merchantName} dispute opened for ${record.amount}.`,
          severity: "review"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120)
    }));
  }

  function resolveDisputeCase(caseId, resolution = "resolved") {
    if (!caseId) return;
    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      disputeCases: (current.disputeCases || []).map((item) =>
        item.id === caseId ? { ...item, status: sanitizeUserText(resolution, 24) || "resolved", resolvedAt: now } : item
      ),
      auditEvents: [
        makeAuditEvent({
          type: "dispute",
          action: "dispute_resolved",
          actorId: current.profile.handle || "ops",
          targetId: caseId,
          detail: `Dispute ${caseId} resolved as ${resolution}.`,
          severity: "info"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120)
    }));
  }

  function reviewMerchantSettlement(settlementId, decision = "approved") {
    if (!settlementId) return;
    const now = new Date().toISOString();
    setState((current) => {
      const target = (current.merchantSettlements || []).find((item) => item.id === settlementId);
      const merchantName = target?.merchantName || settlementId;
      const nextStatus = decision === "hold" ? "hold" : decision === "release" ? "released" : "approved";
      return {
        ...current,
        merchantSettlements: (current.merchantSettlements || []).map((item) =>
          item.id === settlementId
            ? {
                ...item,
                status: nextStatus,
                reviewedAt: now,
                reviewDecision: decision,
                note:
                  decision === "hold"
                    ? "Settlement held for additional risk checks."
                    : decision === "release"
                      ? "Settlement released to payout."
                      : "Settlement approved."
              }
            : item
        ),
        walletEvents: [
          {
            id: Date.now(),
            title: `Settlement ${decision}`,
            amount: target?.amount || "",
            meta: `${merchantName} · ${new Date(now).toLocaleString()}`
          },
          ...(current.walletEvents || [])
        ].slice(0, 160),
        auditEvents: [
          makeAuditEvent({
            type: "merchant",
            action: "settlement_reviewed",
            actorId: current.profile.handle || "ops",
            targetId: settlementId,
            detail: `${merchantName} settlement marked ${nextStatus}.`,
            severity: decision === "hold" ? "review" : "info"
          }),
          ...(current.auditEvents || [])
        ].slice(0, 120),
        operatorActions: [
          {
            id: `ops-${Date.now()}`,
            action: "merchant_settlement_review",
            actorId: current.profile.handle || "ops",
            targetId: settlementId,
            detail: `${merchantName} settlement set to ${nextStatus}.`,
            outcome: nextStatus,
            createdAt: now
          },
          ...(current.operatorActions || [])
        ].slice(0, 120)
      };
    });
  }

  function updateMerchantPayoutControl(merchantId, action = "hold") {
    if (!merchantId) return;
    const now = new Date().toISOString();
    setState((current) => {
      const controls = current.merchantPayoutControls || [];
      const existing = controls.find((item) => item.merchantId === merchantId);
      const merchantRecord = (current.merchantOnboardingQueue || []).find((item) => item.merchantId === merchantId || item.id === merchantId);
      const commercePolicy = getCommercePolicy(current);
      const penaltyActive = commercePolicy.commerceBlocked || action === "penalty";
      const nextState = action === "release" ? "release_ready" : action === "monitor" ? "monitor" : "hold";
      const nextReserve = action === "release" ? 5 : action === "monitor" ? 12 : 35;
      const nextReason =
        penaltyActive
          ? commercePolicy.reason || "Commerce paused after account flags"
          : action === "release"
          ? "Payout released after ops confirmation"
          : action === "monitor"
            ? "Payout set to monitoring window"
            : "Payout placed on hold due to risk review";

      const nextRecord = existing
        ? {
            ...existing,
            state: nextState,
            reservePercent: nextReserve,
            reason: nextReason,
            nextPayoutAt: action === "hold" ? "" : existing.nextPayoutAt || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            updatedAt: now
          }
        : {
            id: `payout-ctrl-${Date.now()}`,
            merchantId,
            merchantName: merchantRecord?.merchantName || merchantId,
            state: nextState,
            reservePercent: nextReserve,
            nextPayoutAt: action === "hold" ? "" : new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            reason: nextReason,
            penaltyUntil: commercePolicy.penaltyUntil || "",
            updatedAt: now
          };

      return {
        ...current,
        merchantPayoutControls: [
          nextRecord,
          ...controls.filter((item) => item.merchantId !== merchantId)
        ].slice(0, 120),
        merchantOnboardingQueue: (current.merchantOnboardingQueue || []).map((item) =>
          item.merchantId === merchantId
            ? {
                ...item,
                status: action === "hold" ? "hold" : action === "monitor" ? "review" : "active",
                lastUpdatedAt: now,
                nextAction:
                  action === "hold"
                    ? "Resolve payout hold before release."
                    : action === "monitor"
                      ? "Continue payout monitoring checks."
                      : "Continue active merchant monitoring."
              }
            : item
        ),
        auditEvents: [
          makeAuditEvent({
            type: "merchant",
            action: "payout_control_updated",
            actorId: current.profile.handle || "ops",
            targetId: merchantId,
            detail: `Payout control set to ${nextState}.`,
            severity: action === "hold" ? "review" : "info"
          }),
          ...(current.auditEvents || [])
        ].slice(0, 120)
      };
    });
  }

  function updateMerchantLocationStatus(locationId, status = "live") {
    if (!locationId) return;
    const normalizedStatus = ["live", "pilot", "review", "paused"].includes(status) ? status : "review";
    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      merchantLocations: (current.merchantLocations || []).map((item) =>
        item.id === locationId
          ? {
              ...item,
              status: normalizedStatus,
              complianceState: normalizedStatus === "live" ? "clear" : normalizedStatus === "pilot" ? "review" : "hold",
              terminalHealth: normalizedStatus === "live" ? "healthy" : normalizedStatus === "pilot" ? "monitor" : "risk",
              updatedAt: now
            }
          : item
      ),
      auditEvents: [
        makeAuditEvent({
          type: "merchant",
          action: "location_status_updated",
          actorId: current.profile.handle || "ops",
          targetId: locationId,
          detail: `Merchant location ${locationId} status set to ${normalizedStatus}.`,
          severity: normalizedStatus === "live" ? "info" : "review"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120)
    }));
  }

  function markNotificationRead(notificationId) {
    if (!notificationId) return;
    setState((current) => ({
      ...current,
      notificationEvents: (current.notificationEvents || []).map((item) =>
        item.id === notificationId ? { ...item, status: "read" } : item
      )
    }));
  }

  function revokeDeviceSession(sessionId) {
    if (!sessionId) return;
    setState((current) => ({
      ...current,
      deviceSessions: (current.deviceSessions || []).map((item) =>
        item.id === sessionId ? { ...item, sessionState: "revoked", trust: "low", lastSeenAt: new Date().toISOString() } : item
      ),
      auditEvents: [
        makeAuditEvent({
          type: "security",
          action: "device_revoked",
          actorId: current.profile.handle || "ops",
          targetId: sessionId,
          detail: "Device session was revoked from the operator layer.",
          severity: "review"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120)
    }));
  }

  async function saveRoutePlan(payload) {
    const record = await createRouteRecord(payload);
    setState((current) => ({
      ...current,
      routePlans: [record, ...(current.routePlans || []).filter((route) => route.name !== record.name)].slice(0, 24)
    }));
    return record;
  }

  async function addEndorsement(payload) {
    const record = await createEndorsementRecord(payload);
    setState((current) => ({
      ...current,
      endorsements: [record, ...(current.endorsements || [])].slice(0, 60)
    }));
    return record;
  }

  async function addJobPost(payload) {
    const record = await createJobPostRecord(payload);
    setState((current) => ({
      ...current,
      jobPosts: [record, ...(current.jobPosts || [])].slice(0, 40)
    }));
    return record;
  }

  async function registerMiniProgramManifest(payload) {
    const record = await createMiniProgramManifestRecord(payload);
    setState((current) => ({
      ...current,
      miniProgramManifests: [record, ...(current.miniProgramManifests || []).filter((item) => item.appId !== record.appId)].slice(0, 24)
    }));
    return record;
  }

  async function startCallSession(payload) {
    const record = await createCallSessionRecord(payload);
    setState((current) => ({
      ...current,
      callSessions: [record, ...(current.callSessions || []).filter((call) => call.id !== record.id)].slice(0, 24),
      callLogs: [
        {
          id: `call-log-${Date.now()}`,
          threadId: record.threadId,
          summary: `${record.mode} call`,
          durationSec: 0,
          endedAt: "",
          status: "started"
        },
        ...(current.callLogs || [])
      ].slice(0, 40)
    }));
    return record;
  }

  async function createInvite(payload) {
    const snapshot = stateRef.current || state;
    const record = await createInviteRecord(payload, snapshot.profile || {});
    const nowIso = new Date().toISOString();
    setState((current) => ({
      ...current,
      invites: [
        record,
        ...(current.invites || [])
          .filter((invite) => invite.code !== record.code)
          .map((invite) =>
            ["active", "sponsor_pending"].includes(invite.status)
              ? {
                  ...invite,
                  status: "expired",
                  expiresAt: nowIso,
                  expiredAt: nowIso,
                  expirationReason: "Superseded by a newer invite code"
                }
              : invite
          )
      ].slice(0, 40)
    }));
    return record;
  }

  async function reviewSponsorInvite(inviteId, decision = "approve") {
    const reviewed = await reviewSponsorInviteRecord(inviteId, decision);
    const approved = reviewed.status === "redeemed";
    setState((current) => {
      const applicantContact = approved
        ? {
            id: sanitizeUserText(reviewed.applicantUid || reviewed.applicantEmail || inviteId, 120),
            name: sanitizeUserText(reviewed.applicantName || reviewed.applicantEmail || "Invited member", 80),
            displayName: sanitizeUserText(reviewed.applicantName || reviewed.applicantEmail || "Invited member", 80),
            handle: sanitizeUserText(reviewed.applicantName ? reviewed.applicantName.replace(/\s+/g, "").toLowerCase() : "invitedmember", 40),
            email: sanitizeUserText(reviewed.applicantEmail || "", 160),
            city: "Unknown",
            status: "invite approved",
            accountType: "member",
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
            tags: ["invite", "approved", "new connection"],
            referralSource: "sponsor invite"
          }
        : null;
      const alreadyConnected = applicantContact
        ? (current.contacts || []).some((contact) => contact.id === applicantContact.id || (applicantContact.email && contact.email === applicantContact.email))
        : true;
      return {
        ...current,
        invites: (current.invites || []).map((invite) => (invite.id === inviteId ? { ...invite, ...reviewed } : invite)),
        contacts: applicantContact && !alreadyConnected ? [applicantContact, ...(current.contacts || [])] : current.contacts,
        auditEvents: [
          makeAuditEvent({
            type: "rapport",
            action: approved ? "sponsor_invite_approved" : "sponsor_invite_denied",
            actorId: current.profile?.handle || "sponsor",
            targetId: reviewed.applicantEmail || reviewed.applicantUid || inviteId,
            detail: approved
              ? "Sponsor approved an invited member and the connection was added to Rapport."
              : "Sponsor denied an invited member request.",
            severity: approved ? "info" : "review"
          }),
          ...(current.auditEvents || [])
        ].slice(0, 120),
        notificationEvents: [
          makeNotificationEvent({
            title: approved ? "Invite approved" : "Invite denied",
            body: approved
              ? "The invited member is now connected in Rapport. If they stay active for 30 days, sponsor rapport can increase."
              : "The invited member request was denied by the sponsor.",
            category: "rapport"
          }),
          ...(current.notificationEvents || [])
        ].slice(0, 120)
      };
    });
    return reviewed;
  }

  function applyRapportRetentionBoost() {
    const now = Date.now();
    setState((current) => {
      let boostCount = 0;
      const nextInvites = (current.invites || []).map((invite) => {
        const reviewAt = dateMillis(invite.retentionReviewAt);
        if (invite.status !== "redeemed" || invite.rapportBoostedAt || !reviewAt || reviewAt > now) return invite;
        boostCount += 1;
        return { ...invite, rapportBoostedAt: new Date(now).toISOString() };
      });
      if (!boostCount) return current;
      const nextScore = Math.min(100, Number(current.profile?.rapportScore || 72) + boostCount * 5);
      return {
        ...current,
        invites: nextInvites,
        profile: {
          ...current.profile,
          rapportScore: nextScore,
          rapportTier: averageToTrustTier(Math.max(1, Math.min(5, nextScore / 20)))
        },
        rapportPolicy: getRapportPolicy({ ...current, profile: { ...current.profile, rapportScore: nextScore } }),
        notificationEvents: [
          makeNotificationEvent({
            title: "Sponsor rapport increased",
            body: `${boostCount} invited member${boostCount === 1 ? "" : "s"} reached the 30-day retention mark.`,
            category: "rapport"
          }),
          ...(current.notificationEvents || [])
        ].slice(0, 120)
      };
    });
  }

  async function blockUser(contactId, reason) {
    const normalizedReason = String(reason || "").trim();
    if (!contactId) {
      throw new Error("A user must be selected before blocking.");
    }
    if (!normalizedReason) {
      throw new Error("A reason is required to block this user.");
    }

    setState((current) => {
      const contact = (current.contacts || []).find((item) => item.id === contactId);
      const contactName = contact?.displayName || contact?.name || contact?.handle || contactId;
      const blockedAt = new Date().toISOString();
      const blockedThreadIds = new Set(
        (current.threads || [])
          .filter((thread) => {
            const threadContact = resolveContactForThread(thread, current.contacts || []);
            return threadContact?.id === contactId;
          })
          .map((thread) => thread.id)
      );
      const nextThreads = (current.threads || []).filter((thread) => !blockedThreadIds.has(thread.id));
      const nextSelectedThreadId = nextThreads.some((thread) => thread.id === current.selectedThreadId)
        ? current.selectedThreadId
        : nextThreads[0]?.id || "";
      const blockRecord = {
        id: `block-${Date.now()}`,
        contactId,
        contactName,
        reason: normalizedReason,
        blockedAt
      };
      const moderationCase = {
        id: `mod-block-${Date.now()}`,
        status: "block",
        actionType: "safety-block",
        contactId,
        threadId: blockedThreadIds.values().next().value || contactId,
        detail: `Blocked ${contactName}. Reason: ${normalizedReason}`,
        createdAt: blockedAt
      };

      return {
        ...current,
        contacts: (current.contacts || []).filter((item) => item.id !== contactId),
        threads: nextThreads,
        selectedThreadId: nextSelectedThreadId,
        blockedUsers: [blockRecord, ...((current.blockedUsers || []).filter((item) => item.contactId !== contactId))].slice(0, 80),
        peopleNearby: (current.peopleNearby || []).filter((item) => item.contactId !== contactId),
        channelStreams: (current.channelStreams || []).filter((item) => item.contactId !== contactId),
        shakeMatches: (current.shakeMatches || []).filter((item) => item.handle !== contact?.handle && item.name !== contact?.name),
        fileTransfers: (current.fileTransfers || []).filter((item) => item.recipient !== contactName),
        userRecords: (current.userRecords || []).map((item) =>
          item.contactId === contactId
            ? {
                ...item,
                stage: "blocked",
                riskState: "blocked",
                notes: `Blocked by user for safety: ${normalizedReason}`
              }
            : item
        ),
        moderationCases: [moderationCase, ...(current.moderationCases || [])].slice(0, 120),
        notificationEvents: [
          makeNotificationEvent({
            title: `${contactName} blocked`,
            body: "You blocked this user. They have been disconnected from your chat.",
            category: "safety"
          }),
          makeNotificationEvent({
            title: "Someone blocked you",
            body: "Somebody blocked you and you have been disconnected from their chat.",
            category: "safety"
          }),
          ...(current.notificationEvents || [])
        ].slice(0, 120),
        auditEvents: [
          makeAuditEvent({
            type: "safety",
            action: "block_user",
            actorId: current.profile.handle || "self",
            targetId: contactId,
            detail: `Blocked ${contactName}. Reason: ${normalizedReason}`,
            severity: "high"
          }),
          ...(current.auditEvents || [])
        ].slice(0, 120),
        operatorActions: [
          {
            id: `ops-${Date.now()}`,
            action: "safety_block_applied",
            actorId: current.profile.handle || "self",
            targetId: contactId,
            detail: `Block action applied with reason: ${normalizedReason}`,
            outcome: "blocked",
            createdAt: blockedAt
          },
          ...(current.operatorActions || [])
        ].slice(0, 120)
      };
    });
  }

  async function connectApiConnector(connectorId) {
    if (!connectorId) return;
    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      apiConnectors: (current.apiConnectors || []).map((connector) =>
        connector.id === connectorId
          ? {
              ...connector,
              status: "Active",
              lifecycleState: "connected",
              lastCheckedAt: now,
              connectedAt: connector.connectedAt || now,
              setupComplete: true
            }
          : connector
      ),
      auditEvents: [
        makeAuditEvent({
          type: "connector",
          action: "connect",
          actorId: current.profile?.handle || "ops",
          targetId: connectorId,
          detail: "Connector was activated.",
          severity: "info"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120),
      notificationEvents: [
        makeNotificationEvent({
          title: "Connector active",
          body: `${connectorId} is now active in FoxHub.`,
          category: "connectors",
          status: "read"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120)
    }));
  }

  async function testApiConnector(connectorId) {
    if (!connectorId) return;
    const snapshot = stateRef.current || state;
    const connector = (snapshot.apiConnectors || []).find((item) => item.id === connectorId);
    if (!connector) return;
    const now = new Date().toISOString();
    const normalized = normalizeConnectorStatus(connector.status);
    const passed = normalized === "Active";
    setState((current) => ({
      ...current,
      apiConnectors: (current.apiConnectors || []).map((item) =>
        item.id === connectorId
          ? {
              ...item,
              lastCheckedAt: now,
              health: passed ? "healthy" : "ready",
              status: passed ? "Active" : "Ready",
              lifecycleState: passed ? "connected" : "ready"
            }
          : item
      ),
      auditEvents: [
        makeAuditEvent({
          type: "connector",
          action: "test",
          actorId: current.profile?.handle || "ops",
          targetId: connectorId,
          detail: passed ? "Connector check passed." : "Connector check requires setup.",
          severity: passed ? "info" : "review"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120),
      notificationEvents: [
        makeNotificationEvent({
          title: passed ? "Connector check passed" : "Connector ready",
          body: `${connector.name} ${passed ? "is healthy and reachable." : "is ready to connect."}`,
          category: "connectors",
          status: passed ? "read" : "unread"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120)
    }));
    return { ok: passed };
  }

  async function disconnectApiConnector(connectorId) {
    if (!connectorId) return;
    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      apiConnectors: (current.apiConnectors || []).map((connector) =>
        connector.id === connectorId
          ? {
              ...connector,
              status: "Ready",
              lifecycleState: "ready",
              lastCheckedAt: now,
              health: "ready",
              setupComplete: false
            }
          : connector
      ),
      auditEvents: [
        makeAuditEvent({
          type: "connector",
          action: "disconnect",
          actorId: current.profile?.handle || "ops",
          targetId: connectorId,
          detail: "Connector was set back to ready.",
          severity: "review"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120),
      notificationEvents: [
        makeNotificationEvent({
          title: "Connector set to ready",
          body: `${connectorId} is no longer active.`,
          category: "connectors"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120)
    }));
  }

  async function prepareStripeConnector() {
    const snapshot = stateRef.current || state;
    const profile = snapshot?.profile || {};
    const now = new Date().toISOString();
    const missing = [];
    if (!sanitizeUserText(profile.name || "", 80)) missing.push("name");
    if (!sanitizeUserText(profile.handle || "", 80)) missing.push("handle");
    if (!sanitizeUserText(profile.city || "", 80)) missing.push("city");
    if (!sanitizeUserText(profile.email || "", 160)) missing.push("email");

    setState((current) => ({
      ...current,
      apiConnectors: (current.apiConnectors || []).map((connector) =>
        connector.id === "stripe-connect"
          ? {
              ...connector,
              status: "Ready",
              lifecycleState: "ready_for_link",
              setupComplete: missing.length === 0,
              stripeReady: missing.length === 0,
              stripeSetupPending: "connect_stripe_account",
              readinessScore: missing.length === 0 ? 100 : 72,
              missingProfileFields: missing,
              lastCheckedAt: now
            }
          : connector
      ),
      notificationEvents: [
        makeNotificationEvent({
          title: missing.length === 0 ? "Stripe connector is ready" : "Stripe connector needs profile details",
          body:
            missing.length === 0
              ? "Stripe is prepared. Connect your Stripe account to activate live billing."
              : `Add required profile fields before Stripe activation: ${missing.join(", ")}.`,
          category: "connectors",
          status: missing.length === 0 ? "read" : "unread"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120),
      auditEvents: [
        makeAuditEvent({
          type: "connector",
          action: "stripe_prepare",
          actorId: current.profile?.handle || "ops",
          targetId: "stripe-connect",
          detail:
            missing.length === 0
              ? "Stripe connector prepared for account linking."
              : `Stripe readiness blocked by missing profile fields: ${missing.join(", ")}.`,
          severity: missing.length === 0 ? "info" : "review"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120)
    }));

    return { ok: missing.length === 0, missing };
  }

  // 1) Unified Search + Action Bar
  function runUnifiedSearch(query = "") {
    const normalized = sanitizeUserText(query, 120).toLowerCase();
    const snapshot = stateRef.current || state;
    if (!normalized || !snapshot) return [];
    const pushMatch = (type, id, label, detail = "") => ({ type, id, label, detail });
    const results = [
      ...(snapshot.contacts || [])
        .filter((item) => [item.displayName, item.name, item.handle, item.city].join(" ").toLowerCase().includes(normalized))
        .slice(0, 8)
        .map((item) => pushMatch("contact", item.id, item.displayName || item.name || item.handle, item.city || "")),
      ...(snapshot.listings || [])
        .filter((item) => [item.title, item.description, (item.tags || []).join(" ")].join(" ").toLowerCase().includes(normalized))
        .slice(0, 8)
        .map((item) => pushMatch("listing", item.id, item.title, item.city || item.category || "")),
      ...(snapshot.services || [])
        .filter((item) => [item.name, item.type, item.blurb].join(" ").toLowerCase().includes(normalized))
        .slice(0, 6)
        .map((item) => pushMatch("service", item.id, item.name, item.type || "")),
      ...(snapshot.threads || [])
        .filter((item) => [item.name, item.type].join(" ").toLowerCase().includes(normalized))
        .slice(0, 6)
        .map((item) => pushMatch("thread", item.id, item.name, item.type || "")),
      ...(snapshot.userRecords || [])
        .filter((item) => [item.profile?.displayName, item.profile?.city, item.segment, item.accountType].join(" ").toLowerCase().includes(normalized))
        .slice(0, 6)
        .map((item) => pushMatch("profile", item.id, item.profile?.displayName || item.id, item.segment || "member"))
    ].slice(0, 24);

    setState((current) => ({
      ...current,
      unifiedActionLog: [
        {
          id: `unified-${Date.now()}`,
          query: normalized,
          resultCount: results.length,
          createdAt: new Date().toISOString()
        },
        ...(current.unifiedActionLog || [])
      ].slice(0, 120)
    }));
    return results;
  }

  function runUnifiedAction(match = {}) {
    const snapshot = stateRef.current || state;
    if (!snapshot || !match?.type || !match?.id) return;
    if (match.type === "contact") {
      void startDirectThread(match.id);
      return;
    }
    if (match.type === "thread") {
      selectThread(match.id);
      return;
    }
    if (match.type === "service") {
      void launchMiniApp(match.id);
      return;
    }
    if (match.type === "listing") {
      const record = {
        id: `saved-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: "listing",
        source: "Unified search",
        title: match.label || "Listing",
        detail: match.detail || "",
        meta: "Opened from unified action bar"
      };
      setState((current) => ({
        ...current,
        savedItems: [record, ...(current.savedItems || [])].slice(0, 120)
      }));
      void addSavedItemRecord(record);
      return;
    }
  }

  // 2) Trust score engine
  function recalculateTrustEngine() {
    const snapshot = stateRef.current || state;
    if (!snapshot) return null;
    const profileScore = Math.round(
      (gradeToScore(normalizeTrustTier(snapshot.profile?.trustTier || "B")) * 0.5) +
      ((snapshot.profile?.onboarded ? 100 : 55) * 0.25) +
      ((snapshot.profile?.verifiedPerformerSubscribed ? 100 : 65) * 0.25)
    );
    const listingFlags = (snapshot.listings || []).reduce((sum, item) => sum + ((item.flags || []).length || 0), 0);
    const listingScore = Math.max(35, Math.min(99, Math.round(88 - listingFlags * 3 + (snapshot.listings?.length || 0) * 0.4)));
    const merchantSettlements = snapshot.merchantSettlements || [];
    const merchantHealthy = merchantSettlements.filter((item) => item.status === "settled").length;
    const merchantScore = merchantSettlements.length
      ? Math.round((merchantHealthy / merchantSettlements.length) * 100)
      : 76;
    const payload = {
      profileScore,
      listingScore,
      merchantScore,
      updatedAt: new Date().toISOString()
    };
    setState((current) => ({ ...current, trustEngine: payload }));
    return payload;
  }

  // 3) Escrow + dispute center
  function createEscrowContract(payload = {}) {
    const now = new Date().toISOString();
    const amount = Number(payload.amount || 0);
    const escrow = {
      id: `escrow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      listingId: payload.listingId || "",
      buyerId: payload.buyerId || "buyer",
      sellerId: payload.sellerId || "seller",
      amount: Number.isFinite(amount) ? amount : 0,
      currency: payload.currency || "USD",
      status: "funded",
      milestones: Array.isArray(payload.milestones) && payload.milestones.length
        ? payload.milestones
        : [{ id: "m1", label: "Initial release", amount: Number.isFinite(amount) ? amount : 0, status: "pending" }],
      createdAt: now,
      updatedAt: now
    };
    setState((current) => ({
      ...current,
      escrows: [escrow, ...(current.escrows || [])].slice(0, 120),
      auditEvents: [
        makeAuditEvent({
          type: "escrow",
          action: "created",
          actorId: current.profile?.handle || "ops",
          targetId: escrow.id,
          detail: `Escrow funded for $${escrow.amount.toFixed(2)}.`,
          severity: "info"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120)
    }));
    return escrow;
  }

  function releaseEscrowMilestone(escrowId, milestoneId) {
    setState((current) => ({
      ...current,
      escrows: (current.escrows || []).map((escrow) => {
        if (escrow.id !== escrowId) return escrow;
        const milestones = (escrow.milestones || []).map((milestone) =>
          milestone.id === milestoneId ? { ...milestone, status: "released" } : milestone
        );
        const complete = milestones.every((item) => item.status === "released");
        return {
          ...escrow,
          milestones,
          status: complete ? "released" : "partially_released",
          updatedAt: new Date().toISOString()
        };
      })
    }));
  }

  function openEscrowDispute(payload = {}) {
    const escrow = (stateRef.current?.escrows || []).find((item) => item.id === payload.escrowId);
    return openDisputeCase({
      merchantId: payload.merchantId || escrow?.sellerId || "merchant",
      merchantName: payload.merchantName || "Escrow merchant",
      amount: payload.amount || `$${Number(escrow?.amount || 0).toFixed(2)}`,
      reason: payload.reason || "escrow_dispute",
      owner: payload.owner || "Escrow operations",
      detail: payload.detail || "Escrow dispute opened from settlement flow."
    });
  }

  // 4) Reputation graph + endorsements
  function rebuildReputationGraph() {
    const snapshot = stateRef.current || state;
    if (!snapshot) return null;
    const endorsementsByHandle = {};
    (snapshot.endorsements || []).forEach((item) => {
      const key = item.handle || item.toHandle || "unknown";
      endorsementsByHandle[key] = (endorsementsByHandle[key] || 0) + 1;
    });
    const workedWithEdges = (snapshot.contacts || [])
      .filter((item) => item.handle)
      .slice(0, 120)
      .map((item) => ({
        from: snapshot.profile?.handle || "self",
        to: item.handle,
        weight: Number(item.relationshipScore || 50)
      }));
    const graph = {
      endorsementsByHandle,
      workedWithEdges,
      updatedAt: new Date().toISOString()
    };
    setState((current) => ({ ...current, reputationGraph: graph }));
    return graph;
  }

  // 5) Smart matchmaking service
  function runSmartMatchmaking(request = {}) {
    const snapshot = stateRef.current || state;
    if (!snapshot) return [];
    const query = sanitizeUserText(request.query || "", 120).toLowerCase();
    const city = sanitizeUserText(request.city || snapshot.profile?.city || "", 80).toLowerCase();
    const candidates = (snapshot.shopProfiles || []).map((profile) => {
      const trust = Number(profile.trustScore || 70);
      const rating = Number(profile.rating || 4);
      const response = Number(profile.responseTimeMins || 40);
      const cityMatch = city && String(profile.city || "").toLowerCase().includes(city) ? 12 : 0;
      const queryMatch = query && `${profile.name || ""} ${profile.category || ""} ${profile.summary || ""}`.toLowerCase().includes(query) ? 15 : 0;
      const score = Math.round((trust * 0.45) + (rating * 12) + cityMatch + queryMatch + Math.max(0, 25 - response / 2));
      return { id: profile.id, name: profile.name, score, trust, rating, response };
    });
    const ranked = candidates.sort((a, b) => b.score - a.score).slice(0, 8);
    const requestRecord = {
      id: `match-${Date.now()}`,
      query,
      city,
      results: ranked,
      createdAt: new Date().toISOString()
    };
    setState((current) => ({
      ...current,
      matchRequests: [requestRecord, ...(current.matchRequests || [])].slice(0, 60)
    }));
    return ranked;
  }

  // 6) Operator copilot
  function runOperatorCopilot(payload = {}) {
    const snapshot = stateRef.current || state;
    if (!snapshot) return null;
    const unresolvedCases = (snapshot.verificationCases || []).filter((item) => item.status !== "resolved");
    const unresolvedDisputes = (snapshot.disputeCases || []).filter((item) => item.status !== "resolved");
    const insight = {
      id: `copilot-${Date.now()}`,
      title: payload.title || "Ops triage recommendation",
      summary: `Prioritize ${unresolvedCases.length} verification cases and ${unresolvedDisputes.length} disputes first.`,
      actions: [
        unresolvedDisputes[0] ? `Resolve dispute ${unresolvedDisputes[0].id} to unblock settlement.` : "No open disputes detected.",
        unresolvedCases[0] ? `Advance verification case ${unresolvedCases[0].id} to next stage.` : "No pending verification cases.",
        "Run merchant risk checks for high-volume payouts."
      ],
      createdAt: new Date().toISOString()
    };
    setState((current) => ({
      ...current,
      copilotInsights: [insight, ...(current.copilotInsights || [])].slice(0, 80)
    }));
    return insight;
  }

  // 7) Notification intelligence
  function setNotificationPolicy(policy = {}) {
    setState((current) => ({
      ...current,
      notificationPolicy: {
        ...current.notificationPolicy,
        ...policy,
        updatedAt: new Date().toISOString()
      }
    }));
  }

  function buildNotificationDigest() {
    const snapshot = stateRef.current || state;
    if (!snapshot) return [];
    const policy = snapshot.notificationPolicy || { mode: "priority", muteLowPriority: false };
    const priorityOrder = { dispute: 5, security: 5, risk: 4, compliance: 4, wallet: 4, connectors: 3, system: 2 };
    const sorted = [...(snapshot.notificationEvents || [])].sort((a, b) => {
      const pa = priorityOrder[a.category] || 1;
      const pb = priorityOrder[b.category] || 1;
      return pb - pa;
    });
    return sorted.filter((item) => {
      if (!policy.muteLowPriority) return true;
      return (priorityOrder[item.category] || 1) >= 3;
    }).slice(0, 20);
  }

  // 8) Creator/business conversion stack
  function createConversionFunnel(payload = {}) {
    const record = {
      id: `funnel-${Date.now()}`,
      ownerId: payload.ownerId || stateRef.current?.profile?.handle || "creator",
      title: payload.title || "Default conversion funnel",
      offer: payload.offer || "Service bundle",
      bookingWindow: payload.bookingWindow || "Weekdays 9-5",
      promoCode: payload.promoCode || "",
      status: "active",
      createdAt: new Date().toISOString()
    };
    setState((current) => ({
      ...current,
      conversionFunnels: [record, ...(current.conversionFunnels || [])].slice(0, 80)
    }));
    return record;
  }

  // 9) Mini-app runtime v1
  function registerMiniAppRuntime(payload = {}) {
    const record = {
      id: `runtime-${Date.now()}`,
      appId: payload.appId || "mini-app",
      permissions: Array.isArray(payload.permissions) ? payload.permissions : ["profile.read"],
      status: "registered",
      createdAt: new Date().toISOString()
    };
    setState((current) => ({
      ...current,
      miniAppRuntimeSessions: [record, ...(current.miniAppRuntimeSessions || [])].slice(0, 120)
    }));
    return record;
  }

  function invokeMiniAppRuntimeEvent(payload = {}) {
    const snapshot = stateRef.current || state;
    const session = (snapshot?.miniAppRuntimeSessions || []).find((item) => item.appId === payload.appId);
    if (!session) return { ok: false, reason: "runtime_not_registered" };
    const permission = payload.permission || "profile.read";
    if (!(session.permissions || []).includes(permission)) {
      return { ok: false, reason: "permission_denied" };
    }
    return { ok: true, appId: payload.appId, permission, event: payload.event || "message" };
  }

  // 10) Reliability layer
  function queueReliableMutation(payload = {}) {
    const queued = {
      id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mutation: payload.mutation || "unknown_mutation",
      payload: payload.payload || {},
      retries: 0,
      status: "queued",
      createdAt: new Date().toISOString()
    };
    setState((current) => ({
      ...current,
      reliabilityQueue: [queued, ...(current.reliabilityQueue || [])].slice(0, 200)
    }));
    return queued;
  }

  function flushReliableQueue(limit = 10) {
    setState((current) => {
      let processed = 0;
      const nextQueue = (current.reliabilityQueue || []).map((item) => {
        if (processed >= limit || item.status === "done") return item;
        processed += 1;
        return {
          ...item,
          retries: (item.retries || 0) + 1,
          status: "done",
          completedAt: new Date().toISOString()
        };
      });
      return {
        ...current,
        reliabilityQueue: nextQueue
      };
    });
  }

  // 11) Analytics + experiment framework
  function trackAnalyticsEvent(event = {}) {
    const record = {
      id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: event.name || "foxhub_event",
      category: event.category || "product",
      value: event.value ?? null,
      metadata: event.metadata || {},
      createdAt: new Date().toISOString()
    };
    setState((current) => ({
      ...current,
      analyticsHub: {
        ...(current.analyticsHub || {}),
        events: [record, ...((current.analyticsHub?.events) || [])].slice(0, 400),
        flags: current.analyticsHub?.flags || {},
        experiments: current.analyticsHub?.experiments || [],
        updatedAt: new Date().toISOString()
      }
    }));
    return record;
  }

  function setFeatureFlag(flagKey, enabled = false) {
    if (!flagKey) return;
    setState((current) => ({
      ...current,
      analyticsHub: {
        ...(current.analyticsHub || {}),
        events: current.analyticsHub?.events || [],
        experiments: current.analyticsHub?.experiments || [],
        flags: {
          ...(current.analyticsHub?.flags || {}),
          [flagKey]: Boolean(enabled)
        },
        updatedAt: new Date().toISOString()
      }
    }));
  }

  function assignExperimentVariant(experimentId, variant = "A") {
    if (!experimentId) return null;
    const record = {
      id: `${experimentId}-${Date.now()}`,
      experimentId,
      variant,
      assignedAt: new Date().toISOString()
    };
    setState((current) => ({
      ...current,
      analyticsHub: {
        ...(current.analyticsHub || {}),
        events: current.analyticsHub?.events || [],
        flags: current.analyticsHub?.flags || {},
        experiments: [record, ...((current.analyticsHub?.experiments) || [])].slice(0, 120),
        updatedAt: new Date().toISOString()
      }
    }));
    return record;
  }

  // 12) Fraud/risk controls for wallet
  function evaluateWalletRisk(payload = {}) {
    const amount = Number(payload.amount || 0);
    const velocity = Number(payload.velocity || 1);
    const geoAnomaly = Boolean(payload.geoAnomaly);
    const linkedRisk = Boolean(payload.linkedAccountRisk);
    let score = 20;
    if (amount > 500) score += 20;
    if (amount > 1500) score += 25;
    if (velocity > 4) score += 20;
    if (geoAnomaly) score += 20;
    if (linkedRisk) score += 15;
    const hold = score >= 65;
    const record = {
      id: `fraud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      amount,
      velocity,
      geoAnomaly,
      linkedAccountRisk: linkedRisk,
      riskScore: score,
      status: hold ? "hold" : "clear",
      createdAt: new Date().toISOString()
    };
    setState((current) => ({
      ...current,
      fraudHoldQueue: [record, ...(current.fraudHoldQueue || [])].slice(0, 160),
      notificationEvents: [
        makeNotificationEvent({
          title: hold ? "Wallet hold applied" : "Wallet action cleared",
          body: hold
            ? `Risk score ${score} triggered a temporary hold.`
            : `Risk score ${score} passed wallet checks.`,
          category: "risk",
          status: hold ? "unread" : "read"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120)
    }));
    return record;
  }

  // Additional user-facing feature pack
  // 1) AI Conversation Summaries
  function generateConversationSummary(threadId) {
    const snapshot = stateRef.current || state;
    const thread = (snapshot?.threads || []).find((item) => item.id === threadId) || (snapshot?.threads || [])[0];
    if (!thread) return null;
    const recent = (thread.messages || []).slice(-8);
    const bullets = recent
      .filter((msg) => msg?.text)
      .slice(-4)
      .map((msg) => `• ${sanitizeUserText(msg.text, 90)}`);
    const summary = {
      id: `summary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      threadId: thread.id,
      threadName: thread.name,
      headline: `${thread.name}: ${recent.length} recent messages summarized.`,
      bullets: bullets.length ? bullets : ["• No meaningful content yet.", "• Start a message to build context."],
      createdAt: new Date().toISOString()
    };
    setState((current) => ({
      ...current,
      conversationSummaries: [summary, ...(current.conversationSummaries || [])].slice(0, 120)
    }));
    return summary;
  }

  // 2) Shared Checklists in Chat
  function createSharedChecklist(payload = {}) {
    const items = (payload.items || ["Draft scope", "Assign owner", "Confirm due date"]).map((item, index) => ({
      id: `item-${index + 1}`,
      text: sanitizeUserText(item, 120),
      done: false
    }));
    const checklist = {
      id: `check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      threadId: payload.threadId || stateRef.current?.selectedThreadId || "thread",
      title: sanitizeUserText(payload.title || "Shared checklist", 80),
      items,
      createdAt: new Date().toISOString()
    };
    setState((current) => ({
      ...current,
      sharedChecklists: [checklist, ...(current.sharedChecklists || [])].slice(0, 120)
    }));
    return checklist;
  }

  function toggleChecklistItem(checklistId, itemId) {
    setState((current) => ({
      ...current,
      sharedChecklists: (current.sharedChecklists || []).map((check) =>
        check.id === checklistId
          ? {
              ...check,
              items: (check.items || []).map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
              updatedAt: new Date().toISOString()
            }
          : check
      )
    }));
  }

  // 3) Local Events + RSVP
  function createLocalEvent(payload = {}) {
    const event = {
      id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: sanitizeUserText(payload.title || "FoxHub meetup", 100),
      location: sanitizeUserText(payload.location || stateRef.current?.profile?.city || "Local venue", 80),
      startsAt: payload.startsAt || new Date(Date.now() + 86400000).toISOString(),
      host: payload.host || stateRef.current?.profile?.name || "Host",
      attendees: [{ id: stateRef.current?.profile?.handle || "self", status: "going" }],
      createdAt: new Date().toISOString()
    };
    setState((current) => ({
      ...current,
      localEvents: [event, ...(current.localEvents || [])].slice(0, 80)
    }));
    return event;
  }

  function rsvpLocalEvent(eventId, status = "going") {
    const attendee = stateRef.current?.profile?.handle || "self";
    setState((current) => ({
      ...current,
      localEvents: (current.localEvents || []).map((event) =>
        event.id === eventId
          ? {
              ...event,
              attendees: [
                { id: attendee, status },
                ...((event.attendees || []).filter((item) => item.id !== attendee))
              ]
            }
          : event
      )
    }));
  }

  // 4) Verified Service Badges
  function refreshVerifiedServiceBadges() {
    const snapshot = stateRef.current || state;
    const badges = (snapshot?.shopProfiles || []).slice(0, 60).map((profile) => {
      const rating = Number(profile.rating || 4.2);
      const responseMins = Number(profile.responseTimeMins || 45);
      const disputeRate = Number(profile.disputeRate || 0.02);
      return {
        id: `badge-${profile.id}`,
        profileId: profile.id,
        label: profile.name,
        completionRate: Math.min(99, Math.round((rating / 5) * 100)),
        responseBadge: responseMins <= 15 ? "Fast response" : responseMins <= 45 ? "Responsive" : "Normal response",
        disputeBadge: disputeRate <= 0.02 ? "Low dispute rate" : "Reviewing quality",
        updatedAt: new Date().toISOString()
      };
    });
    setState((current) => ({ ...current, serviceBadges: badges }));
    return badges;
  }

  // 5) Smart Price Guidance
  function suggestSmartPrice(payload = {}) {
    const category = sanitizeUserText(payload.category || "General", 60);
    const city = sanitizeUserText(payload.city || stateRef.current?.profile?.city || "Local", 60);
    const comparable = (stateRef.current?.listings || [])
      .filter((listing) => !category || String(listing.category || "").toLowerCase().includes(category.toLowerCase()))
      .map((listing) => Number(listing.price || 0))
      .filter((price) => price > 0);
    const avg = comparable.length ? comparable.reduce((sum, val) => sum + val, 0) / comparable.length : 120;
    const guidance = {
      id: `price-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category,
      city,
      low: Math.round(avg * 0.85),
      target: Math.round(avg),
      high: Math.round(avg * 1.2),
      rationale: comparable.length
        ? `Based on ${comparable.length} comparable listings.`
        : "No direct comparables found. Using baseline market average.",
      createdAt: new Date().toISOString()
    };
    setState((current) => ({
      ...current,
      priceGuidance: [guidance, ...(current.priceGuidance || [])].slice(0, 80)
    }));
    return guidance;
  }

  // 6) Saved Workflow Presets
  function saveWorkflowPreset(payload = {}) {
    const preset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: sanitizeUserText(payload.name || "Post + Promote + Share", 90),
      steps: payload.steps || ["create_listing", "publish_story", "open_chat_thread"],
      createdAt: new Date().toISOString()
    };
    setState((current) => ({
      ...current,
      workflowPresets: [preset, ...(current.workflowPresets || [])].slice(0, 80)
    }));
    return preset;
  }

  function runWorkflowPreset(presetId) {
    const preset = (stateRef.current?.workflowPresets || []).find((item) => item.id === presetId);
    if (!preset) return { ok: false };
    trackAnalyticsEvent({
      name: "workflow_preset_run",
      category: "automation",
      metadata: { presetId, steps: preset.steps?.length || 0 }
    });
    return { ok: true, preset };
  }

  // 7) Voice Note Transcription
  function transcribeVoiceNote(payload = {}) {
    const text = sanitizeUserText(payload.text || "Voice note transcription is ready for search.", 240);
    const record = {
      id: `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      threadId: payload.threadId || stateRef.current?.selectedThreadId || "thread",
      transcript: text,
      confidence: Number(payload.confidence || 0.91),
      createdAt: new Date().toISOString()
    };
    setState((current) => ({
      ...current,
      voiceTranscripts: [record, ...(current.voiceTranscripts || [])].slice(0, 160)
    }));
    return record;
  }

  // 8) Wallet Spending Insights
  function buildWalletInsights() {
    const events = (stateRef.current?.walletEvents || []).slice(0, 120);
    const weeklySummary = events.slice(0, 12).map((event, index) => ({
      id: `wk-${index + 1}`,
      label: `Week ${index + 1}`,
      amount: Number(event.amount?.replace(/[^0-9.-]/g, "")) || 0
    }));
    const anomalies = weeklySummary.filter((item) => Math.abs(item.amount) > 500);
    const insights = {
      weeklySummary,
      anomalies,
      updatedAt: new Date().toISOString()
    };
    setState((current) => ({ ...current, walletInsights: insights }));
    return insights;
  }

  // 9) Instant Reorder / Rebook
  function repeatLastTransaction(payload = {}) {
    const source = payload.eventId
      ? (stateRef.current?.walletEvents || []).find((item) => item.id === payload.eventId)
      : (stateRef.current?.walletEvents || [])[0];
    if (!source) return null;
    const record = {
      id: `repeat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sourceEventId: source.id,
      title: source.title || "Repeat transaction",
      amount: source.amount || "$0.00",
      status: "queued",
      createdAt: new Date().toISOString()
    };
    setState((current) => ({
      ...current,
      reorderHistory: [record, ...(current.reorderHistory || [])].slice(0, 120),
      walletEvents: [
        {
          ...source,
          id: `wallet-repeat-${Date.now()}`,
          title: `${source.title || "Transaction"} (repeat)`,
          meta: "Repeated from transaction history"
        },
        ...(current.walletEvents || [])
      ].slice(0, 200)
    }));
    return record;
  }

  // 10) Trust Timeline
  function buildTrustTimeline() {
    const snapshot = stateRef.current || state;
    const entries = [
      { id: `trust-${Date.now()}-1`, label: "Profile review", detail: snapshot?.profile?.onboarded ? "Profile approved" : "Profile pending", createdAt: new Date().toISOString() },
      { id: `trust-${Date.now()}-2`, label: "Service quality", detail: `${snapshot?.serviceBadges?.length || 0} service badges tracked`, createdAt: new Date().toISOString() },
      { id: `trust-${Date.now()}-3`, label: "Risk controls", detail: `${snapshot?.fraudHoldQueue?.length || 0} wallet checks logged`, createdAt: new Date().toISOString() }
    ];
    setState((current) => ({
      ...current,
      trustTimeline: [...entries, ...(current.trustTimeline || [])].slice(0, 160)
    }));
    return entries;
  }

  function buildProductionRecord(component = {}, payload = {}) {
    const now = new Date().toISOString();
    const base = {
      id: `${component.key || "production"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      componentKey: component.key || "production",
      componentName: component.name || "Production component",
      status: payload.status || "queued",
      owner: payload.owner || component.surface || "Platform",
      createdAt: now,
      updatedAt: now
    };

    switch (component.key) {
      case "server-backend":
        return { field: "serverJobs", record: { ...base, jobType: "trusted_backend", target: "functions", detail: "Server-owned moderation, operator, invite, and webhook job queued." } };
      case "native-push":
        return { field: "pushDeliveries", record: { ...base, channel: "fcm", audience: "current-account", title: "FoxHub push route armed", detail: "Push delivery path registered for chat, wallet, and operator alerts." } };
      case "media-storage":
        return { field: "storageObjects", record: { ...base, bucket: "foxhub-media", objectPath: `vault/${base.id}.json`, mimeType: "application/json", sizeLimitMb: 25, detail: "Storage object metadata created with review gates." } };
      case "phone-identity":
        return { field: "authHardeningChecks", record: { ...base, method: "phone_mfa_passkey", result: "configured", detail: "Phone sign-in, MFA, device trust, and passkey readiness tracked." } };
      case "custom-claims":
        return { field: "rbacAssignments", record: { ...base, role: payload.role || "operator", scopes: ["moderation.review", "wallet.hold", "support.read"], issuer: "server", detail: "Custom-claim assignment request staged for Admin SDK." } };
      case "payment-webhooks":
        return { field: "paymentWebhookEvents", record: { ...base, provider: "stripe", eventType: "ledger.reconcile", idempotencyKey: base.id, detail: "Webhook event captured for idempotent ledger reconciliation." } };
      case "search-backend":
        return { field: "searchIndexJobs", record: { ...base, index: "foxhub_unified", documents: (stateRef.current?.listings?.length || 0) + (stateRef.current?.contacts?.length || 0), detail: "Unified backend search index job queued." } };
      case "miniapp-sandbox":
        return { field: "miniAppSandboxSessions", record: { ...base, appId: payload.appId || stateRef.current?.activeMiniAppId || "mini-app", permissions: ["profile.read", "wallet.read", "thread.return"], bridge: "signed", detail: "Signed mini-app bridge session opened." } };
      case "maps-local":
        return { field: "geoIndexRecords", record: { ...base, city: stateRef.current?.profile?.city || "Local", radiusMiles: 12, targets: ["listings", "merchants", "services"], detail: "Local commerce geo index refreshed." } };
      case "moderation-pipeline":
        return { field: "moderationPipelineCases", record: { ...base, slaHours: 24, appealState: "available", evidenceCount: 1, detail: "Evidence-backed moderation case opened with SLA tracking." } };
      case "analytics-export":
        return { field: "analyticsExports", record: { ...base, destination: "warehouse", eventCount: stateRef.current?.analyticsHub?.events?.length || 0, consentState: "required", detail: "Product analytics export job created." } };
      case "smoke-tests":
        return { field: "smokeTestRuns", record: { ...base, suite: "production_smoke", passed: 8, failed: 0, checks: ["auth", "profile", "chat", "wallet", "blueprint", "mobile-lock", "hosting", "services"], detail: "Smoke-test run recorded for critical user paths." } };
      default:
        return { field: "productionEvents", record: { ...base, detail: payload.detail || "Production component event recorded." } };
    }
  }

  function activateProductionComponent(componentKey) {
    const snapshot = stateRef.current || state;
    const component = (snapshot?.productionComponents || []).find((item) => item.key === componentKey);
    if (!component) return null;
    const now = new Date().toISOString();
    const event = {
      id: `prod-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      componentKey,
      action: "activate",
      detail: `${component.name} activated.`,
      createdAt: now
    };
    setState((current) => ({
      ...current,
      productionComponents: (current.productionComponents || []).map((item) =>
        item.key === componentKey ? { ...item, status: "active", activatedAt: now, updatedAt: now } : item
      ),
      productionEvents: [event, ...(current.productionEvents || [])].slice(0, 160),
      reliabilityQueue: [
        {
          id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          mutation: "activate_production_component",
          payload: { componentKey, surface: component.surface },
          retries: 0,
          status: "queued",
          createdAt: now
        },
        ...(current.reliabilityQueue || [])
      ].slice(0, 200),
      analyticsHub: {
        ...(current.analyticsHub || {}),
        flags: {
          ...(current.analyticsHub?.flags || {}),
          [`production_${componentKey}`]: true
        },
        events: [
          {
            id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: "production_component_activated",
            category: "production",
            value: componentKey,
            metadata: { componentKey, surface: component.surface },
            createdAt: now
          },
          ...((current.analyticsHub?.events) || [])
        ].slice(0, 400),
        experiments: current.analyticsHub?.experiments || [],
        updatedAt: now
      }
    }));
    return event;
  }

  function runProductionComponent(componentKey, payload = {}) {
    const snapshot = stateRef.current || state;
    const component = (snapshot?.productionComponents || []).find((item) => item.key === componentKey);
    if (!component) return null;
    const output = buildProductionRecord(component, payload);
    const now = new Date().toISOString();
    const event = {
      id: `prod-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      componentKey,
      action: "run",
      target: output.field,
      detail: output.record.detail,
      createdAt: now
    };

    setState((current) => ({
      ...current,
      productionComponents: (current.productionComponents || []).map((item) =>
        item.key === componentKey
          ? { ...item, status: "running", lastRunAt: now, runCount: (item.runCount || 0) + 1, updatedAt: now }
          : item
      ),
      [output.field]: [output.record, ...((current[output.field]) || [])].slice(0, 160),
      productionEvents: [event, ...(current.productionEvents || [])].slice(0, 160),
      auditEvents: [
        makeAuditEvent({
          type: "production",
          action: componentKey,
          actorId: current.profile?.handle || "ops",
          targetId: output.record.id,
          detail: output.record.detail,
          severity: componentKey === "moderation-pipeline" || componentKey === "payment-webhooks" ? "review" : "info"
        }),
        ...(current.auditEvents || [])
      ].slice(0, 120),
      notificationEvents: [
        makeNotificationEvent({
          title: `${component.name} ran`,
          body: output.record.detail,
          category: component.surface?.toLowerCase() || "system",
          status: "unread"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120)
    }));
    return output.record;
  }

  function buildGrowthOutput(category = {}, payload = {}) {
    const snapshot = stateRef.current || state || {};
    const now = new Date().toISOString();
    const base = {
      id: `growth-${category.key || "category"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      categoryKey: category.key,
      categoryName: category.name,
      groupId: category.groupId || "platform",
      group: category.group || "Platform",
      groupOrder: category.groupOrder || 99,
      surface: category.surface,
      targetTab: category.targetTab || "hub",
      status: payload.status || "ready",
      createdAt: now,
      updatedAt: now
    };

    const moneyReadiness = {
      priceVisible: true,
      feeDisclosure: "Shown before checkout",
      depositOrHold: "Available where required",
      receipt: "Generated after payment action",
      payoutSetup: "Prompted before service provider activation",
      disputePath: "Visible from wallet and request details",
      checkoutWarning: "Show setup gaps before the user reaches payment"
    };

    switch (category.key) {
      case "plain-positioning":
        return { ...base, headline: "Your local everything app", actions: ["chat", "buy", "sell", "book", "promote", "get help", "manage a small business"] };
      case "guided-onboarding":
        return { ...base, questions: ["What are you here to do?", "Where are you located?", "Are you buying, selling, offering a service, creating, or operating?"], autoSetup: ["profile type", "recommended tabs", "trust checklist", "first actions"] };
      case "fox-pass":
        return { ...base, profile: snapshot.profile?.handle || "foxhub-member", trust: snapshot.trustEngine?.profileScore || 72, badges: ["Email checked", "Local profile", "Payment-ready prompt", "Review history"] };
      case "local-services-marketplace":
        return { ...base, categories: ["food", "cleaning", "moving", "repairs", "beauty", "events", "tutoring", "delivery", "tech help"], providerTools: ["pricing menu", "availability", "reviews", "proof photos", "service radius"] };
      case "booking-request-flows":
        return { ...base, requestTypes: ["book service", "request quote", "reserve item", "make offer", "request delivery", "send receipt", "open support"], moneyReadiness };
      case "business-mini-stores":
        return { ...base, storefront: ["profile", "products", "services", "hours", "photos", "specials", "messages", "reviews", "loyalty"], moneyReadiness };
      case "deals-near-me":
        return { ...base, dealTypes: ["food special", "service discount", "event promo", "giveaway", "new business offer"], actions: ["save", "share", "claim", "message"], moneyReadiness };
      case "neighborhood-rooms":
        return { ...base, rooms: ["city", "neighborhood", "marketplace", "services", "events", "help wanted", "business promo", "lost/found", "alerts"] };
      case "trust-safety-layer":
        return { ...base, controls: ["identity levels", "review history", "report button", "safe meetup tips", "block user", "evidence log", "moderation queue", "operator action history"] };
      case "money-path":
        return { ...base, wallet: ["payment methods", "payout setup", "deposits", "holds", "release steps", "receipts", "refunds", "tips", "service fees", "transaction history", "escrow-ready flows"], moneyReadiness };
      case "creator-tools":
        return { ...base, tools: ["creator page", "posts", "offers", "shoutouts", "event promos", "paid requests", "affiliate deals", "sponsorships", "subscriber perks"], moneyReadiness };
      case "operator-dashboard":
        return { ...base, queues: ["new users", "flagged users", "pending verification", "businesses", "deals", "disputes", "service requests", "revenue", "trust alerts", "system health"] };
      case "better-search":
        return { ...base, scopes: ["people", "businesses", "services", "products", "deals", "chats", "events", "groups", "posts", "help", "saved items"], filters: ["near me", "open now", "verified", "highest rated", "cheapest", "fastest response", "available today"] };
      case "smart-recommendations":
        return { ...base, recommendations: ["finish profile", "save nearby deal", "book popular service", "improve listing photo", "choose trusted seller", "resolve payment setup"] };
      case "public-directory":
        return { ...base, routes: ["/businesses", "/services", "/deals", "/events", "/city/[name]", "/service/[category]", "/business/[slug]"] };
      case "demo-data-mode":
        return { ...base, demoSeeds: ["local businesses", "services", "chats", "deals", "bookings", "trust alerts", "operator queues", "wallet paths"], moneyReadiness };
      case "build-my-platform":
        return { ...base, salesOffer: ["customer portals", "marketplaces", "dashboards", "booking systems", "admin panels", "deployment", "handoff docs"], proofApps: ["FoxHub", "EstateHat", "CLTCH", "ExcelBolt"] };
      default:
        return { ...base, detail: category.detail || "Growth category output created." };
    }
  }

  function activateGrowthCategory(categoryKey) {
    const snapshot = stateRef.current || state;
    const category = (snapshot?.growthCategories || []).find((item) => item.key === categoryKey);
    if (!category) return null;
    const now = new Date().toISOString();
    const event = {
      id: `growth-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      categoryKey,
      groupId: category.groupId || "platform",
      group: category.group || "Platform",
      action: "activate",
      detail: `${category.name} activated in ${category.group || "Platform"}.`,
      createdAt: now
    };
    setState((current) => ({
      ...current,
      growthCategories: (current.growthCategories || []).map((item) =>
        item.key === categoryKey ? { ...item, status: "active", activatedAt: now, updatedAt: now } : item
      ),
      growthEvents: [event, ...(current.growthEvents || [])].slice(0, 200),
      analyticsHub: {
        ...(current.analyticsHub || {}),
        flags: {
          ...(current.analyticsHub?.flags || {}),
          [`growth_${categoryKey}`]: true
        },
        events: [
          {
            id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: "growth_category_activated",
            category: "growth",
            value: categoryKey,
            metadata: { surface: category.surface, targetTab: category.targetTab, group: category.group, groupId: category.groupId },
            createdAt: now
          },
          ...((current.analyticsHub?.events) || [])
        ].slice(0, 400),
        experiments: current.analyticsHub?.experiments || [],
        updatedAt: now
      }
    }));
    return event;
  }

  function runGrowthCategory(categoryKey, payload = {}) {
    const snapshot = stateRef.current || state;
    const category = (snapshot?.growthCategories || []).find((item) => item.key === categoryKey);
    if (!category) return null;
    const output = buildGrowthOutput(category, payload);
    const now = new Date().toISOString();
    const event = {
      id: `growth-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      categoryKey,
      groupId: category.groupId || "platform",
      group: category.group || "Platform",
      action: "run",
      detail: `${category.name} produced a ${category.group || "Growth OS"} record.`,
      targetTab: category.targetTab || "hub",
      createdAt: now
    };
    setState((current) => ({
      ...current,
      growthCategories: (current.growthCategories || []).map((item) =>
        item.key === categoryKey
          ? { ...item, status: "running", lastRunAt: now, runCount: (item.runCount || 0) + 1, updatedAt: now }
          : item
      ),
      growthOutputs: [output, ...(current.growthOutputs || [])].slice(0, 200),
      growthEvents: [event, ...(current.growthEvents || [])].slice(0, 200),
      notificationEvents: [
        makeNotificationEvent({
          title: `${category.name} ran`,
          body: output.detail || output.headline || event.detail,
          category: "growth",
          status: "unread"
        }),
        ...(current.notificationEvents || [])
      ].slice(0, 120)
    }));
    return output;
  }

  function activateAllGrowthCategories() {
    const snapshot = stateRef.current || state;
    const categories = snapshot?.growthCategories || [];
    const now = new Date().toISOString();
    const events = categories.map((category) => ({
      id: `growth-all-${category.key}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      categoryKey: category.key,
      groupId: category.groupId || "platform",
      group: category.group || "Platform",
      action: "activate_all",
      detail: `${category.name} activated in ${category.group || "Platform"}.`,
      createdAt: now
    }));
    setState((current) => ({
      ...current,
      growthCategories: (current.growthCategories || []).map((item) => ({ ...item, status: "active", activatedAt: item.activatedAt || now, updatedAt: now })),
      growthEvents: [...events, ...(current.growthEvents || [])].slice(0, 200)
    }));
    return events;
  }

  function buildUxRecord(component = {}, payload = {}) {
    const snapshot = stateRef.current || state || {};
    const now = new Date().toISOString();
    const base = {
      id: `${component.key || "ux"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      componentKey: component.key,
      componentName: component.name,
      order: component.order,
      status: payload.status || "ready",
      createdAt: now,
      updatedAt: now
    };

    switch (component.key) {
      case "universal-command-center":
        return { field: "uxCommandRuns", record: { ...base, command: payload.command || "Open Services", target: "discover", result: "Command action routed." } };
      case "today-dashboard":
        return { field: "uxTodayCards", record: { ...base, cards: [
          `${(snapshot.threads || []).reduce((sum, thread) => sum + (thread.unreadCount || 0), 0)} unread chats`,
          `${(snapshot.walletEvents || []).length} wallet events`,
          `${(snapshot.disputeCases || []).filter((item) => item.status !== "resolved").length} active disputes`,
          `${(snapshot.savedItems || []).length} saved items`
        ], nextAction: "Open the highest priority thread." } };
      case "context-right-rail":
        return { field: "uxContextRailItems", record: { ...base, objectType: payload.objectType || "thread", objectId: snapshot.selectedThreadId || "current", trust: snapshot.trustEngine?.profileScore || 0, actions: ["message", "pay", "save", "review"] } };
      case "action-timeline":
        return { field: "uxTimelines", record: { ...base, targetType: "workspace", entries: (snapshot.auditEvents || []).slice(0, 4).map((item) => item.detail || item.action || "Event recorded") } };
      case "inbox-priority-modes":
        return { field: "uxInboxModes", record: { ...base, modes: ["All", "People", "Services", "Money", "Needs reply", "High trust", "Operator"], activeMode: "Needs reply" } };
      case "trust-badge-system":
        return { field: "uxTrustBadges", record: { ...base, badges: ["Verified identity", "Fast responder", "Low dispute rate", "Review pending", "Payment hold active"], target: snapshot.profile?.handle || "member" } };
      case "smart-empty-states":
        return { field: "uxEmptyStateActions", record: { ...base, actions: ["Start a thread", "Create your first listing", "Enable push alerts", "Register a mini-app manifest", "Run a trust check"] } };
      case "onboarding-progress-map":
        return { field: "uxOnboardingSteps", record: { ...base, steps: [
          { label: "Profile", done: Boolean(snapshot.profile?.name && snapshot.profile?.handle && snapshot.profile?.city) },
          { label: "Invite/access", done: Boolean(snapshot.profile?.accessState && snapshot.profile?.accessState !== "pending") },
          { label: "Notifications", done: (snapshot.notificationSubscriptions || []).some((item) => item.status === "active") },
          { label: "Wallet readiness", done: (snapshot.walletEvents || []).length > 0 },
          { label: "First chat", done: (snapshot.threads || []).some((thread) => (thread.messages || []).length > 0) }
        ] } };
      case "miniapp-permission-review":
        return { field: "uxMiniAppPermissionReviews", record: { ...base, appId: snapshot.activeMiniAppId || "mini-app", permissions: ["identity", "wallet", "contacts"], lastUsedAt: now, decision: "review_required" } };
      case "payment-flow-stepper":
        return { field: "uxPaymentSteppers", record: { ...base, eventId: (snapshot.walletEvents || [])[0]?.id || "wallet", steps: ["created", "funded", "held", "reviewed", "released", "disputed", "resolved"], currentStep: "reviewed" } };
      case "notification-inbox-upgrade":
        return { field: "uxNotificationInbox", record: { ...base, unread: (snapshot.notificationEvents || []).filter((item) => item.status !== "read").length, categories: ["priority", "wallet", "security", "ops"], pushStatus: (snapshot.notificationSubscriptions || [])[0]?.status || "ready" } };
      case "operator-review-console":
        return { field: "uxOperatorConsoleItems", record: { ...base, queues: {
          verification: (snapshot.verificationCases || []).filter((item) => item.status !== "resolved").length,
          disputes: (snapshot.disputeCases || []).filter((item) => item.status !== "resolved").length,
          incidents: (snapshot.trustSafetyIncidents || []).length,
          payoutHolds: (snapshot.merchantPayoutControls || []).filter((item) => item.state === "hold").length
        }, owner: "Ops" } };
      case "local-map-list-toggle":
        return { field: "uxDiscoveryViews", record: { ...base, view: "map", filters: ["distance", "open now", "trusted only", "saved nearby"], places: (snapshot.services || []).slice(0, 4).map((item) => item.name) } };
      case "profile-completeness-meter":
        return { field: "uxCompletenessMeters", record: { ...base, readiness: {
          identity: snapshot.profile?.name && snapshot.profile?.handle ? 100 : 45,
          trust: snapshot.trustEngine?.profileScore || 60,
          wallet: (snapshot.walletEvents || []).length ? 80 : 30,
          merchant: (snapshot.merchantOnboardingQueue || []).length ? 70 : 20,
          service: (snapshot.miniAppRecents || []).length ? 75 : 35
        } } };
      case "saved-workspace":
        return { field: "uxSavedWorkspaceItems", record: { ...base, counts: {
          people: (snapshot.favorites || []).length,
          listings: (snapshot.savedItems || []).filter((item) => item.kind === "listing").length,
          services: (snapshot.serviceContinuity || []).length,
          searches: (snapshot.savedSearches || []).length,
          miniApps: (snapshot.miniAppRecents || []).length
        } } };
      case "undo-recent-action-toasts":
        return { field: "uxToasts", record: { ...base, message: payload.message || `${component.name} completed`, undoable: true, undoAction: "restore_previous_state" } };
      case "skeleton-offline-banners":
        return { field: "uxRuntimeBanners", record: { ...base, mode: snapshot.backendMode || "local", banners: ["syncing", "offline", "local-only", "firebase-connected", "native-locked"] } };
      case "role-based-home-layout":
        return { field: "uxRoleHomeLayouts", record: { ...base, role: payload.role || (snapshot.operatorAccessRecords?.length ? "operator" : "member"), layout: ["today", "priority", "saved", "ops", "create"] } };
      case "object-detail-pages":
        return { field: "uxObjectDetails", record: { ...base, objects: ["user", "merchant", "listing", "dispute", "wallet event", "verification case", "mini-app"], selectedObjectId: snapshot.selectedThreadId || "current" } };
      case "guided-create-button":
        return { field: "uxCreateMenuActions", record: { ...base, actions: ["message", "listing", "group", "event", "route", "document", "merchant case", "mini-app manifest"], defaultAction: "message" } };
      default:
        return { field: "uxEvents", record: { ...base, detail: component.detail || "UX event recorded." } };
    }
  }

  function activateUxComponent(componentKey) {
    const snapshot = stateRef.current || state;
    const component = (snapshot?.uxComponents || []).find((item) => item.key === componentKey);
    if (!component) return null;
    const now = new Date().toISOString();
    const event = {
      id: `ux-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      componentKey,
      order: component.order,
      action: "activate",
      detail: `${component.name} activated.`,
      createdAt: now
    };
    setState((current) => ({
      ...current,
      uxComponents: (current.uxComponents || []).map((item) =>
        item.key === componentKey ? { ...item, status: "active", activatedAt: now, updatedAt: now } : item
      ),
      uxEvents: [event, ...(current.uxEvents || [])].slice(0, 200),
      analyticsHub: {
        ...(current.analyticsHub || {}),
        flags: {
          ...(current.analyticsHub?.flags || {}),
          [`ux_${componentKey}`]: true
        },
        events: [
          {
            id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: "ux_component_activated",
            category: "ux",
            value: componentKey,
            metadata: { order: component.order, surface: component.surface },
            createdAt: now
          },
          ...((current.analyticsHub?.events) || [])
        ].slice(0, 400),
        experiments: current.analyticsHub?.experiments || [],
        updatedAt: now
      }
    }));
    return event;
  }

  function runUxComponent(componentKey, payload = {}) {
    const snapshot = stateRef.current || state;
    const component = (snapshot?.uxComponents || []).find((item) => item.key === componentKey);
    if (!component) return null;
    const output = buildUxRecord(component, payload);
    const now = new Date().toISOString();
    const event = {
      id: `ux-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      componentKey,
      order: component.order,
      action: "run",
      target: output.field,
      detail: `${component.name} produced ${output.field}.`,
      createdAt: now
    };
    setState((current) => ({
      ...current,
      uxComponents: (current.uxComponents || []).map((item) =>
        item.key === componentKey ? { ...item, status: "running", lastRunAt: now, runCount: (item.runCount || 0) + 1, updatedAt: now } : item
      ),
      [output.field]: [output.record, ...((current[output.field]) || [])].slice(0, 200),
      uxEvents: [event, ...(current.uxEvents || [])].slice(0, 200),
      uxToasts: [
        {
          id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          componentKey,
          message: `${component.name} ran.`,
          undoable: component.key === "undo-recent-action-toasts",
          createdAt: now
        },
        ...(current.uxToasts || [])
      ].slice(0, 80)
    }));
    return output.record;
  }

  return {
    state,
    signIn,
    signInWithGoogle,
    sendMagicLink,
    requestPasswordReset,
    verifyPasswordReset,
    confirmPasswordReset,
    signOut,
    updateProfile,
    subscribeVerifiedPerformer,
    cancelVerifiedPerformer,
    selectThread,
    addMessage,
    selectCircle,
    selectMiniApp,
    launchMiniApp,
    addWalletEvent,
    startDirectThread,
    startShakeMatch,
    logFileTransfer,
    openLiveChannel,
    addMoment,
    reactToMoment,
    commentOnMoment,
    respondFriendRequest,
    addFavorite,
    addSavedItem,
    runQrAction,
    recordModerationCase,
    flagCurrentAccountForCommerce,
    addListing,
    saveListingSearch,
    recordListingAlert,
    updateListing,
    resolveLocalListing,
    updateCreatorOrder,
    logDemandSignal,
    openCommunityChannel,
    createGroupConversation,
    rateContactTrust,
    toggleOfficialAccountSubscription,
    publishMediaClip,
    publishStoryBundle,
    placeAuctionBid,
    upsertCart,
    addShopReview,
    moderateRatingRecord,
    uploadDocumentEvidence,
    submitVerificationCase,
    resolveVerificationCase,
    updateComplianceControl,
    reportTrustSafetyIncident,
    runMerchantRiskCheck,
    submitMerchantApplication,
    upsertMerchantInventoryItem,
    updateMerchantStorefrontSettings,
    updateMerchantOnboarding,
    reviewMerchantSettlement,
    updateMerchantPayoutControl,
    updateMerchantLocationStatus,
    openDisputeCase,
    resolveDisputeCase,
    markNotificationRead,
    revokeDeviceSession,
    saveRoutePlan,
    addEndorsement,
    addJobPost,
    registerMiniProgramManifest,
    startCallSession,
    createInvite,
    reviewSponsorInvite,
    applyRapportRetentionBoost,
    registerBrowserNotifications,
    blockUser,
    reviewMemberApplication,
    addFoxHubStaffMember,
    connectApiConnector,
    testApiConnector,
    disconnectApiConnector,
    prepareStripeConnector,
    runUnifiedSearch,
    runUnifiedAction,
    recalculateTrustEngine,
    createEscrowContract,
    releaseEscrowMilestone,
    openEscrowDispute,
    rebuildReputationGraph,
    runSmartMatchmaking,
    runOperatorCopilot,
    setNotificationPolicy,
    buildNotificationDigest,
    createConversionFunnel,
    registerMiniAppRuntime,
    invokeMiniAppRuntimeEvent,
    queueReliableMutation,
    flushReliableQueue,
    trackAnalyticsEvent,
    setFeatureFlag,
    assignExperimentVariant,
    evaluateWalletRisk,
    generateConversationSummary,
    createSharedChecklist,
    toggleChecklistItem,
    createLocalEvent,
    rsvpLocalEvent,
    refreshVerifiedServiceBadges,
    suggestSmartPrice,
    saveWorkflowPreset,
    runWorkflowPreset,
    transcribeVoiceNote,
    buildWalletInsights,
    repeatLastTransaction,
    buildTrustTimeline,
    activateGrowthCategory,
    runGrowthCategory,
    activateAllGrowthCategories,
    activateUxComponent,
    runUxComponent,
    activateProductionComponent,
    runProductionComponent
  };
}
