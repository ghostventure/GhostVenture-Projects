import { useState } from "react";
import { foxhubMarketSignals, foxhubPlaces, foxhubProfessionalCards, foxhubExpansionComponents, miniApps } from "../data.js";
import { getContactTrustTier } from "../rules.js";

import { footerQuickAccessLinks, getFooterItemHref } from "../footerBoilerplates.js";

export const MOMENT_REACTIONS = [
  { id: "like", emoji: "👍", label: "Like" },
  { id: "love", emoji: "❤️", label: "Love" },
  { id: "haha", emoji: "😂", label: "Haha" },
  { id: "wow", emoji: "😮", label: "Wow" },
  { id: "fire", emoji: "🔥", label: "Fire" },
  { id: "support", emoji: "🙌", label: "Support" },
  { id: "thanks", emoji: "🙏", label: "Thanks" },
  { id: "eyes", emoji: "👀", label: "Watching" }
];

export function isWindowsBrowserRuntime() {
  if (typeof navigator === "undefined") return false;
  const userAgentDataPlatform = navigator.userAgentData?.platform || "";
  const platform = userAgentDataPlatform || navigator.platform || "";
  const userAgent = navigator.userAgent || "";
  return /win/i.test(`${platform} ${userAgent}`);
}

export function bytesToBase64Url(bytes) {
  const binary = Array.from(new Uint8Array(bytes))
    .map((byte) => String.fromCharCode(byte))
    .join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value = "") {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function credentialToServerPayload(credential) {
  const response = credential?.response || {};
  return {
    id: credential?.id || "",
    type: credential?.type || "public-key",
    authenticatorAttachment: credential?.authenticatorAttachment || "platform",
    rawId: credential?.rawId ? bytesToBase64Url(credential.rawId) : "",
    response: {
      clientDataJSON: response.clientDataJSON ? bytesToBase64Url(response.clientDataJSON) : "",
      attestationObject: response.attestationObject ? bytesToBase64Url(response.attestationObject) : "",
      transports: typeof response.getTransports === "function" ? response.getTransports() : []
    }
  };
}

export async function runLocalWindowsHelloManagementCheck({ expectedEmail = "", displayName = "" } = {}) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = new TextEncoder().encode(expectedEmail || "foxhub-management");
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "FoxHub" },
      user: {
        id: userId,
        name: expectedEmail,
        displayName: displayName || expectedEmail
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 }
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "required"
      },
      timeout: 60000,
      attestation: "none"
    }
  });
  if (!credential?.id) {
    throw new Error("Windows Hello did not return a verified response.");
  }
  return credential;
}

export async function getCurrentFirebaseIdToken() {
  const { auth } = await import("../firebase.js");
  const user = auth?.currentUser;
  return user ? user.getIdToken() : "";
}

export function buildFilteredState(state, query) {
  if (!query) return state;
  const match = (...parts) => parts.filter(Boolean).join(" ").toLowerCase().includes(query);

  return {
    ...state,
    threads: state.threads.filter((item) =>
      match(item.name, item.type, item.presence, item.lastActiveLabel, ...(item.messages || []).map((m) => `${m.author} ${m.text}`))
    ),
    contacts: state.contacts.filter((item) =>
      match(item.name, item.displayName, item.handle, item.city, item.verificationLevel, item.status)
    ),
    circles: state.circles.filter((item) => match(item.name, item.focus, item.trust, item.members)),
    channels: state.channels.filter((item) => match(item.name, item.summary, item.cadence)),
    officialAccounts: state.officialAccounts.filter((item) => match(item.name, item.summary, item.type)),
    officialPosts: state.officialPosts.filter((item) => match(item.title, item.summary, item.meta)),
    walletEvents: state.walletEvents.filter((item) => match(item.title, item.amount, item.meta)),
    utilityCards: state.utilityCards.filter((item) => match(item.name, item.detail)),
    utilityBillPayProviders: (state.utilityBillPayProviders || []).filter((item) =>
      match(item.name, item.category, item.accountMask, item.dueAmount, item.status, item.memo)
    ),
    utilityBillPayPayments: (state.utilityBillPayPayments || []).filter((item) =>
      match(item.providerName, item.amount, item.status, item.method, item.receiptState)
    ),
    savedItems: state.savedItems.filter((item) => match(item.title, item.detail, item.meta, item.source)),
    officialAccountSubscriptions: state.officialAccountSubscriptions,
    qrActions: state.qrActions.filter((item) => match(item.title, item.detail)),
    qrHistory: state.qrHistory.filter((item) => match(item.title, item.detail, item.meta)),
    services: state.services.filter((item) => match(item.name, item.type, item.blurb)),
    miniAppRecents: state.miniAppRecents.filter((item) => match(item.name, item.meta)),
    serviceContinuity: state.serviceContinuity.filter((item) => match(item.appName, item.fromThread, item.fromCircle, item.returnLabel, item.meta)),
    peopleNearby: state.peopleNearby.filter((item) =>
      match(item.name, item.handle, item.activity, item.presence)
    ),
    shakeMatches: state.shakeMatches.filter((item) => match(item.name, item.handle, item.matchNote, item.trust)),
    channelStreams: state.channelStreams.filter((item) => match(item.title, item.host, item.status)),
    fileTransfers: state.fileTransfers.filter((item) => match(item.title, item.recipient, item.status, item.meta)),
    searchScopes: state.searchScopes.filter((item) => match(item.name, item.hint)),
    apiConnectors: state.apiConnectors.filter((item) =>
      match(item.name, item.category, item.summary, item.status, item.automation, item.surface)
    ),
    userRecords: (state.userRecords || []).filter((item) =>
      match(item.id, item.contactId, item.accountType, item.segment, item.stage, item.supportTier, item.identityState, item.profile?.displayName, item.profile?.email, item.profile?.city, item.notes)
    ),
    verificationCases: (state.verificationCases || []).filter((item) =>
      match(item.id, item.targetId, item.targetType, item.label, item.status, item.stage, item.owner)
    ),
    moderationCases: (state.moderationCases || []).filter((item) =>
      match(item.id, item.type, item.title, item.status, item.reason, item.detail)
    ),
    ratingModerationQueue: (state.ratingModerationQueue || []).filter((item) =>
      match(item.id, item.targetId, item.targetType, item.status, item.reason)
    ),
    moments: state.moments.filter((item) => match(item.author, item.handle, item.text, item.meta))
  };
}

export function trustTierBadgeClass(tier) {
  if (tier === "AA" || tier === "A") return "badge";
  if (tier === "B" || tier === "C") return "badge review";
  return "badge block";
}

export function verificationBadgeModel(level = "") {
  const normalized = String(level || "").toLowerCase();
  if (normalized.includes("verified")) {
    return { className: "verification-badge verified", label: "VERIFIED USER" };
  }
  if (normalized.includes("pending") || normalized.includes("review")) {
    return { className: "verification-badge review", label: "VERIFICATION REVIEW" };
  }
  return { className: "verification-badge unverified", label: "UNVERIFIED" };
}

export function PatternLibrary({ cards = [] }) {
  return (
    <section className="surface-row">
      <article className="surface">
        <div className="surface-head">
          <p className="card-label">New components added</p>
          <span className="badge subtle">{cards.length} source patterns</span>
        </div>
        <div className="surface-note">
          Existing WeChat-style services, WhatsApp-like communities, Google-style search scopes, and Craigslist-like category browse were already present, so this set only covers the missing additions.
        </div>
        <div className="list-stack">
          {cards.map((card) => (
            <div key={card.id} className="list-row">
              <div>
                <strong>{card.component}</strong>
                <p>{card.summary}</p>
                <div className="row-meta-text">{card.highlight}</div>
              </div>
              <div className="inline-actions wrap">
                <span className="badge subtle">{card.source}</span>
                <span className="badge subtle">{card.zone}</span>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

export function MarketplaceInfluencePanel({ selectedListing, startDirectThread, busy }) {
  return (
    <article className="surface">
      <div className="surface-head">
        <p className="card-label">Marketplace mix</p>
        <span className="badge subtle">Craigslist · eBay · Amazon · Etsy</span>
      </div>
      <div className="list-stack">
        {foxhubMarketSignals.map((signal) => (
          <div key={signal.id} className="list-row">
            <div>
              <strong>{signal.title}</strong>
              <p>{signal.detail}</p>
            </div>
            <div className="row-meta-text">{signal.cue}</div>
          </div>
        ))}
      </div>
      <div className="wallet-card">
        <div>
          <p className="card-label">FoxHub decision box</p>
          <strong>{selectedListing?.title || "Pick a listing"}</strong>
          <p>
            {selectedListing
              ? `${selectedListing.city} · $${selectedListing.price} · ${selectedListing.category}`
              : "Select a listing to compare price, trust, and next action."}
          </p>
        </div>
        <div className="inline-actions wrap">
          <button type="button" className="accent-button" disabled={!selectedListing || busy} onClick={() => selectedListing?.contactId && startDirectThread(selectedListing.contactId)}>
            Contact now
          </button>
          <button type="button" className="ghost-button" disabled={!selectedListing}>
            Save for later
          </button>
        </div>
      </div>
    </article>
  );
}

export function DiscoveryInfluencePanel({ openSearchScope }) {
  return (
    <article className="surface">
      <div className="surface-head">
        <p className="card-label">Search and local discovery</p>
        <span className="badge subtle">Search · Maps · LinkedIn</span>
      </div>
      <div className="inline-actions wrap">
        {[
          { id: "all", label: "Everything", hint: "People, listings, services, updates" },
          { id: "people", label: "People", hint: "Profiles and reputation" },
          { id: "local", label: "Nearby", hint: "Places and services" },
          { id: "work", label: "Work", hint: "Operators and collaborators" }
        ].map((scope) => (
          <button key={scope.id} type="button" className="ghost-button small" onClick={() => openSearchScope?.(scope.id)}>
            {scope.label}
          </button>
        ))}
      </div>
      <div className="list-stack">
        {foxhubPlaces.map((place) => (
          <div key={place.id} className="list-row">
            <div className="thread-topline">
              <div>
                <strong>{place.name}</strong>
                <p>{place.type}</p>
              </div>
              <span className="badge subtle">{place.distance}</span>
            </div>
            <div className="row-meta-text">{place.status} · {place.rating} stars · {place.note}</div>
          </div>
        ))}
      </div>
      <div className="list-stack">
        {foxhubProfessionalCards.map((profile) => (
          <div key={profile.id} className="list-row">
            <div>
              <strong>{profile.name}</strong>
              <p>{profile.role}</p>
              <div className="row-meta-text">{profile.company}</div>
              <div className="row-meta-text">{profile.strength}</div>
            </div>
            <div>
              <span className="badge subtle">{profile.trust}</span>
              <div className="row-meta-text">{profile.reach}</div>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export function ServiceCategoryPanel({ title, detail, categories, mode = "user", activeCategoryId, setActiveCategoryId, runService }) {
  const activeCategory =
    categories.find((category) => category.id === activeCategoryId) ||
    categories[0];
  const categoryLabel = (category) => (mode === "merchant" ? category.merchantName : category.name);

  return (
    <article className="surface surface-strong blue-collar-panel">
      <div className="surface-head">
        <p className="card-label">{title}</p>
        <span className="badge subtle">{categories.length} cats</span>
      </div>
      <div className="surface-note">{detail}</div>
      <div className="category-chip-row" role="tablist" aria-label={`${title} categories`}>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={category.id === activeCategory.id ? "category-chip active" : "category-chip"}
            onClick={() => setActiveCategoryId(category.id)}
          >
            {categoryLabel(category)}
          </button>
        ))}
      </div>
      <div className="blue-collar-detail">
        <div>
          <h3>{categoryLabel(activeCategory)}</h3>
          <p>{activeCategory.summary}</p>
        </div>
        <button type="button" className="ghost-button small" onClick={() => void runService(activeCategory.serviceId)}>
          Open
        </button>
      </div>
      <div className="subcategory-grid">
        {activeCategory.subcategories.map((subcategory) => (
          <button key={subcategory} type="button" className="subcategory-chip" onClick={() => void runService(activeCategory.serviceId)}>
            {subcategory}
          </button>
        ))}
      </div>
      <div className="component-strip">
        {activeCategory.components.map((component) => (
          <span key={component}>{component}</span>
        ))}
      </div>
    </article>
  );
}

export function normalizeFeedText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

export function buildSectionFeedItems(activeTab, state, currentView = {}) {
  const localCity = state.profile?.city || "FoxHub";
  const builders = {
    chat: () => (state.threads || []).map((thread) => {
      const lastMessage = thread.messages?.[thread.messages.length - 1];
      return {
        id: `thread-${thread.id}`,
        sourceId: thread.id,
        type: "conversation",
        community: thread.type === "private-group" ? "Private group" : "Social",
        author: thread.name,
        title: thread.name,
        body: normalizeFeedText(lastMessage?.body || lastMessage?.text, thread.topic || thread.lastActiveLabel || "Open the conversation thread."),
        meta: `${thread.members || thread.participants?.length || 1} members · ${thread.lastActiveLabel || "active"}`,
        score: (thread.unreadCount || 0) * 10 + (thread.messages?.length || 0),
        comments: thread.messages?.length || 0,
        trust: thread.type || "thread",
        locality: thread.city || localCity,
        openThreadId: thread.id
      };
    }),
    circles: () => [
      ...(state.contacts || []).map((contact) => ({
        id: `contact-${contact.id}`,
        sourceId: contact.id,
        type: "rapport",
        community: "Trusted people",
        author: contact.displayName || contact.name,
        title: contact.displayName || contact.name,
        body: normalizeFeedText(contact.preferredSurface || contact.status || contact.referralSource, "Relationship signal ready for review."),
        meta: `${contact.handle || "member"} · ${contact.city || localCity}`,
        score: contact.relationshipScore || 0,
        comments: contact.peerRatingCount || 0,
        trust: getContactTrustTier(contact),
        locality: contact.city || localCity,
        contactId: contact.id
      })),
      ...(state.friendRequests || []).map((request) => ({
        id: `friend-request-${request.id}`,
        sourceId: request.id,
        type: "rapport",
        community: "Friend request",
        author: request.name,
        title: `${request.name} wants to connect`,
        body: `${request.mutualCount || 0} mutual connections from ${request.city || localCity}.`,
        meta: request.handle || "pending request",
        score: 18 + (request.mutualCount || 0),
        comments: request.mutualCount || 0,
        trust: "pending",
        locality: request.city || localCity
      })),
      ...(state.circles || []).map((circle) => ({
        id: `circle-${circle.id}`,
        sourceId: circle.id,
        type: "rapport",
        community: "Circle",
        author: circle.name,
        title: circle.name,
        body: normalizeFeedText(circle.focus || circle.topic || circle.purpose, "Shared relationship context."),
        meta: `${circle.members || circle.memberCount || 0} members`,
        score: Number(circle.members || circle.memberCount || 0),
        comments: 0,
        trust: circle.trust || "circle",
        locality: circle.city || localCity
      }))
    ],
    market: () => (state.listings || []).map((listing) => ({
      id: `listing-${listing.id}`,
      sourceId: listing.id,
      type: "need",
      community: listing.category || "Needs",
      author: listing.seller || listing.owner || "Local member",
      title: listing.title,
      body: normalizeFeedText(listing.description, `${listing.neighborhood || "Local"} · ${listing.type || "offer"}`),
      meta: `${listing.city || localCity} · $${listing.price || 0}`,
      score: (listing.verified ? 30 : 12) + (listing.featured ? 10 : 0),
      comments: listing.replyCount || 0,
      trust: listing.verified ? "trusted" : "community",
      locality: listing.city || localCity
    })),
    wallet: () => (state.walletEvents || []).map((event) => ({
      id: `wallet-${event.id}`,
      sourceId: event.id,
      type: "wallet",
      community: "Pay",
      author: event.counterparty || event.type || "Wallet",
      title: event.title || event.type || "Wallet event",
      body: normalizeFeedText(event.note || event.description, "Payment, transfer, or balance activity."),
      meta: `${event.amount || "$0"} · ${event.status || "recorded"}`,
      score: Number(String(event.amount || "0").replace(/[^0-9.-]/g, "")) || 1,
      comments: 0,
      trust: event.status || "wallet",
      locality: localCity
    })),
    discover: () => [
      ...(state.services || []).map((service) => ({
        id: `service-${service.id}`,
        sourceId: service.id,
        type: "service",
        community: "Services",
        author: service.category || "FoxHub service",
        title: service.name || service.title,
        body: normalizeFeedText(service.summary || service.description, "Service tool ready to launch."),
        meta: service.status || service.type || "available",
        score: service.featured ? 32 : 14,
        comments: 0,
        trust: service.status || "service",
        locality: localCity
      })),
      ...(state.miniApps || state.miniAppRecents || []).map((app) => ({
        id: `miniapp-${app.id}`,
        sourceId: app.id,
        type: "service",
        community: "Mini app",
        author: app.zone || "FoxHub",
        title: app.name,
        body: normalizeFeedText(app.summary, "Mini app surface."),
        meta: app.status || app.lastUsed || "ready",
        score: app.recent ? 24 : 10,
        comments: 0,
        trust: "mini app",
        locality: localCity
      }))
    ],
    experience: () => [
      ...(state.uxComponents || []).map((component) => ({
        id: `ux-${component.id}`,
        sourceId: component.id,
        type: "experience",
        community: "UX",
        author: component.zone || "Goodies",
        title: component.name || component.title,
        body: normalizeFeedText(component.summary || component.description, "Experience component."),
        meta: component.status || "ready",
        score: component.active ? 28 : 11,
        comments: 0,
        trust: component.status || "ux",
        locality: localCity
      })),
      ...(state.savedItems || []).map((item) => ({
        id: `saved-${item.id}`,
        sourceId: item.id,
        type: "experience",
        community: "Saved",
        author: item.source || "Saved item",
        title: item.title,
        body: normalizeFeedText(item.detail, "Saved context."),
        meta: item.meta || item.kind || "saved",
        score: 12,
        comments: 0,
        trust: item.kind || "saved",
        locality: localCity
      }))
    ],
    growth: () => [
      ...(state.growthCategories || []).map((category) => ({
        id: `growth-${category.id}`,
        sourceId: category.id,
        type: "communal",
        community: "Communal",
        author: category.owner || "FoxHub",
        title: category.name || category.title,
        body: normalizeFeedText(category.summary || category.description, "Community growth path."),
        meta: category.status || category.stage || "available",
        score: category.active ? 30 : 12,
        comments: 0,
        trust: category.status || "growth",
        locality: localCity
      })),
      ...(state.communityChannels || []).map((channel) => ({
        id: `channel-${channel.id}`,
        sourceId: channel.id,
        type: "communal",
        community: "Channel",
        author: channel.mod || "Community",
        title: channel.name,
        body: normalizeFeedText(channel.topic, "Community channel."),
        meta: `${channel.members || 0} members`,
        score: Number(channel.members || 0),
        comments: 0,
        trust: "channel",
        locality: localCity
      }))
    ],
    staff: () => [
      ...(state.memberApplications || []).map((application) => ({
        id: `member-application-${application.id}`,
        sourceId: application.id,
        type: "staff",
        community: "Member review",
        author: application.profile?.displayName || application.email || "Applicant",
        title: application.profile?.displayName || application.email || "Member application",
        body: normalizeFeedText(application.reason || application.profile?.bio, "Application needs review."),
        meta: application.status || application.stage || "pending",
        score: application.status === "pending" ? 28 : 8,
        comments: 0,
        trust: application.status || "review",
        locality: localCity
      })),
      ...(state.userRecords || []).map((record) => ({
        id: `record-${record.id}`,
        sourceId: record.id,
        type: "staff",
        community: "User record",
        author: record.profile?.displayName || record.contactId || record.id,
        title: record.profile?.displayName || record.contactId || record.id,
        body: `${record.accountType || "member"} · ${record.supportTier || "standard"} · ${record.walletState || "wallet unknown"}`,
        meta: record.identityState || record.stage || "tracked",
        score: ["review", "pending"].includes(String(record.stage || record.identityState || "").toLowerCase()) ? 20 : 6,
        comments: 0,
        trust: record.identityState || "record",
        locality: localCity
      })),
      ...(state.ratingModerationQueue || []).map((item) => ({
        id: `rating-${item.id}`,
        sourceId: item.id,
        type: "staff",
        community: "Rating review",
        author: item.targetId || "Rating target",
        title: item.reason || "Rating needs review",
        body: normalizeFeedText(item.note, "Moderation queue item."),
        meta: item.status || "open",
        score: item.status === "open" ? 22 : 5,
        comments: 0,
        trust: item.targetType || "rating",
        locality: localCity
      }))
    ],
    connectors: () => (state.apiConnectors || []).map((connector) => ({
      id: `connector-${connector.id}`,
      sourceId: connector.id,
      type: "tool",
      community: "Tools",
      author: connector.provider || connector.zone || "Connector",
      title: connector.name || connector.title,
      body: normalizeFeedText(connector.summary || connector.description, "Integration connector."),
      meta: connector.status || "available",
      score: String(connector.status || "").toLowerCase().includes("active") ? 30 : 10,
      comments: 0,
      trust: connector.status || "connector",
      locality: localCity
    })),
    blueprint: () => (foxhubExpansionComponents || []).slice(0, 80).map((component) => ({
      id: `blueprint-${component.id}`,
      sourceId: component.id,
      type: "organizer",
      community: component.track || component.category || "Organizer",
      author: component.owner || "FoxHub",
      title: component.name || component.title,
      body: normalizeFeedText(component.summary || component.description, "Installed platform component."),
      meta: component.status || component.priority || "ready",
      score: Number(component.priorityScore || component.score || 10),
      comments: 0,
      trust: component.status || "component",
      locality: localCity
    }))
  };
  const items = (builders[activeTab]?.() || []).filter((item) => item.title || item.body);
  return items.length ? items : [{
    id: `empty-${activeTab}`,
    type: "section",
    community: currentView.title || "Section",
    author: "FoxHub",
    title: `${currentView.title || "This section"} feed`,
    body: "As this workspace fills up, important updates and actions will appear here in the same feed format as Home.",
    meta: "Ready",
    score: 0,
    comments: 0,
    trust: "section",
    locality: localCity
  }];
}

export function SectionFeed({ activeTab, currentView, items, busy, setActiveTab, selectThread, startDirectThread, openPublicProfile }) {
  const [feedSort, setFeedSort] = useState("hot");
  const [feedScope, setFeedScope] = useState("all");
  const title = currentView?.title || "Section";
  const feedItems = items.filter((item) => {
    const trust = String(item.trust || item.meta || "").toLowerCase();
    if (feedScope === "all") return true;
    if (feedScope === "trusted") return ["trusted", "official", "aaa", "aa", "a", "verified", "active"].includes(trust);
    if (feedScope === "local") return Boolean(item.locality);
    if (feedScope === "open") return ["pending", "review", "open", "available", "ready"].includes(trust);
    return true;
  }).sort((a, b) => {
    if (feedSort === "new") return String(b.id).localeCompare(String(a.id));
    if (feedSort === "comments") return (b.comments || 0) - (a.comments || 0);
    return (b.score || 0) - (a.score || 0);
  }).slice(0, 12);

  function openFeedItem(item) {
    if (item.openThreadId) {
      selectThread?.(item.openThreadId);
      setActiveTab("chat");
      return;
    }
    if (item.contactId) {
      openPublicProfile?.(item.contactId);
      return;
    }
    setActiveTab(activeTab);
  }

  return (
    <section className="surface section-feed-surface home-feed-surface" aria-label={`${title} feed`}>
      <div className="surface-head home-feed-head">
        <div>
          <p className="card-label">{title} feed</p>
          <h3>Updates, actions, and signals for this workspace.</h3>
        </div>
        <span className="badge subtle">{feedItems.length} cards</span>
      </div>
      <div className="home-feed-toolbar section-feed-toolbar" aria-label={`${title} feed controls`}>
        {[
          ["hot", "Hot"],
          ["new", "New"],
          ["comments", "Discussed"]
        ].map(([value, label]) => (
          <button key={value} type="button" className={feedSort === value ? "auth-pill active" : "auth-pill"} onClick={() => setFeedSort(value)}>
            {label}
          </button>
        ))}
        <span className="home-feed-divider" aria-hidden="true" />
        {[
          ["all", "All"],
          ["trusted", "Trusted"],
          ["local", "Local"],
          ["open", "Open"]
        ].map(([value, label]) => (
          <button key={value} type="button" className={feedScope === value ? "auth-pill active" : "auth-pill"} onClick={() => setFeedScope(value)}>
            {label}
          </button>
        ))}
      </div>
      <div className="home-feed-stack section-feed-stack">
        {feedItems.map((item) => (
          <article key={item.id} className={`home-feed-card section-feed-card ${item.type || "section"}`}>
            <div className="home-feed-vote-rail" aria-label={`${item.title} score`}>
              <button type="button" className="feed-vote" disabled={busy} aria-label="Promote">↑</button>
              <strong>{item.score || 0}</strong>
              <button type="button" className="feed-vote" disabled={busy} aria-label="Save">+</button>
            </div>
            <div className="home-feed-body">
              <div className="home-feed-meta">
                <span>{item.community}</span>
                <span>{item.author}</span>
                <span>{item.meta}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <div className="home-feed-actions">
                <span className="badge subtle">{item.trust}</span>
                <span className="badge subtle">{item.comments || 0} comments</span>
                <button type="button" className="ghost-button small" onClick={() => openFeedItem(item)} disabled={busy}>
                  Open
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export const officialAccountThreadMap = {
  "foxhub-news": "foxhub-newsroom",
  "atl-culture": "atl-culture-wire",
  "wallet-watch": "wallet-watch"
};

export function normalizeConnectorStatus(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("active") || normalized.includes("live") || normalized.includes("connected")) return "Active";
  return "Ready";
}

export function connectorStatusBadge(status = "") {
  return normalizeConnectorStatus(status) === "Active" ? "badge" : "badge subtle";
}

export function formatConnectorDate(value) {
  if (!value) return "Not checked yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not checked yet";
  return date.toLocaleString();
}

export function formatAuditDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export const STAFF_ROLE_TEMPLATES = [
  {
    role: "support-ops",
    label: "Support ops",
    title: "Support Operations Specialist",
    department: "Support Operations",
    scopes: ["support", "member-review", "connections", "notifications", "account-recovery"]
  },
  {
    role: "trust-safety",
    label: "Trust and safety",
    title: "Trust and Safety Analyst",
    department: "Trust and Safety",
    scopes: ["trust-safety", "fraud-review", "abuse-reports", "security-incidents", "moderation"]
  },
  {
    role: "fraud-risk",
    label: "Fraud and risk",
    title: "Fraud Risk Analyst",
    department: "Risk Operations",
    scopes: ["fraud-review", "wallet-holds", "risk-scoring", "payments-review", "audit"]
  },
  {
    role: "disputes",
    label: "Disputes",
    title: "Dispute Resolution Specialist",
    department: "Payments Support",
    scopes: ["disputes", "refund-review", "evidence-review", "member-support", "merchant-support"]
  },
  {
    role: "compliance",
    label: "Compliance",
    title: "Compliance Operations Officer",
    department: "Compliance",
    scopes: ["compliance", "kyc-review", "policy-review", "merchant-review", "audit"]
  },
  {
    role: "moderator",
    label: "Moderator",
    title: "Community Moderator",
    department: "Community Safety",
    scopes: ["moderation", "content-review", "reports", "member-review", "policy-enforcement"]
  },
  {
    role: "merchant-ops",
    label: "Merchant ops",
    title: "Merchant Operations Specialist",
    department: "Merchant Operations",
    scopes: ["merchant-review", "settlements", "payouts", "commerce-support", "risk-review"]
  },
  {
    role: "security",
    label: "Security analyst",
    title: "Security Operations Analyst",
    department: "Security",
    scopes: ["security-incidents", "device-review", "account-recovery", "fraud-review", "audit"]
  },
  {
    role: "customer-success",
    label: "Customer success",
    title: "Customer Success Manager",
    department: "Member Success",
    scopes: ["support", "member-review", "onboarding", "retention", "communications"]
  },
  {
    role: "operations-manager",
    label: "Operations manager",
    title: "Operations Manager",
    department: "Operations",
    scopes: ["support", "trust-safety", "fraud-review", "disputes", "compliance", "merchant-review", "audit"]
  },
  {
    role: "admin",
    label: "Admin",
    title: "FoxHub Admin",
    department: "Management",
    scopes: ["admin", "operators", "staff", "permissions", "settings", "audit", "security"]
  },
  {
    role: "auditor",
    label: "Auditor",
    title: "Operations Auditor",
    department: "Compliance",
    scopes: ["audit", "reports", "read-only", "policy-review", "compliance"]
  }
];

export const COMPLAINT_ZERO_CONTROLS = [
  {
    id: "feed-control",
    label: "Feed Control",
    userAction: "Tune feed",
    staffAction: "Feed complaint sweep",
    detail: "Chronological, trusted, local, and recommended modes with recommendation resets."
  },
  {
    id: "commercial-boundaries",
    label: "Commercial Boundaries",
    userAction: "Reduce commerce",
    staffAction: "Commerce boundary audit",
    detail: "Keep ads, shops, services, and paid promotions out of the default social feed."
  },
  {
    id: "safety-moderation",
    label: "Safety and Moderation",
    userAction: "Report safety issue",
    staffAction: "Moderation appeal sweep",
    detail: "Sensitive-content defaults, clear reason codes, appeal status, and harmful-content review."
  },
  {
    id: "trust-anti-spam",
    label: "Trust and Anti-Spam",
    userAction: "Report spam/scam",
    staffAction: "Spam and scam sweep",
    detail: "Trust levels, rate limits, scam reports, duplicate-message checks, and fraud holds."
  },
  {
    id: "privacy-account-control",
    label: "Privacy and Account Control",
    userAction: "Open privacy",
    staffAction: "Privacy complaint review",
    detail: "Public/private/staff-visible data labels, export/delete controls, and device security."
  },
  {
    id: "attention-notifications",
    label: "Attention and Notification Health",
    userAction: "Set quiet mode",
    staffAction: "Notification health audit",
    detail: "Quiet hours, digest mode, caught-up states, and fewer engagement-bait notifications."
  },
  {
    id: "support-disputes",
    label: "Support and Dispute Resolution",
    userAction: "Open support case",
    staffAction: "Support SLA sweep",
    detail: "Visible case status, owner, priority, SLA, audit trail, and post-resolution satisfaction."
  },
  {
    id: "product-guardrails",
    label: "Product Guardrails",
    userAction: "Send product concern",
    staffAction: "Product drift review",
    detail: "Protect people-first social use from ads, shops, forced video, and feature bloat."
  }
];

export function FilteredEmptyState({ label }) {
  return (
    <section className="filtered-empty" aria-label={`${label} empty state`}>
      <p className="card-label">{label}</p>
      <strong>No visible items in this view</strong>
      <p>Adjust the filter or switch sections to bring more results back into view.</p>
    </section>
  );
}

export function BoilerplateFootnotes({ title, subtitle, boilerplateGroups }) {
  const totalPages = boilerplateGroups.reduce((total, group) => total + group.items.length, 0);

  return (
    <section className="boilerplate-footnotes" aria-label={title}>
      <div className="boilerplate-footnote-head">
        <div>
          <p className="card-label">{title}</p>
          <h2>Useful pages, clear rules, and support paths stay close.</h2>
          <p className="boilerplate-footnote-copy">
            FoxHub keeps the expected product, legal, help, status, and business pages in one global footer so users do not have to hunt for the basics.
          </p>
        </div>
        <div className="boilerplate-footer-summary" aria-label="Footer summary">
          <span className="badge subtle">{subtitle}</span>
          <strong>{boilerplateGroups.length} sections</strong>
          <span>{totalPages} links</span>
        </div>
      </div>
      <div className="footer-quick-access" aria-label="Quick footer access">
        {footerQuickAccessLinks.map((link) => (
          <a key={link.href} className="footer-quick-link" href={link.href}>
            <strong>{link.label}</strong>
            <span>{link.detail}</span>
          </a>
        ))}
      </div>
      <div className="boilerplate-footnote-row">
        {boilerplateGroups.map((group) => (
          <section key={group.id} className="boilerplate-footnote-item">
            <div className="boilerplate-topline">
              <span className="boilerplate-glyph" aria-hidden="true">{group.glyph}</span>
              <span className="boilerplate-accent">{group.accent}</span>
            </div>
            <div className="boilerplate-head">
              <strong>{group.label}</strong>
              <span>{group.items.length} pages</span>
            </div>
            <p className="boilerplate-copy">{group.summary}</p>
            <div className="boilerplate-meta-row">
              <span>{group.owner}</span>
              <span>{group.status}</span>
            </div>
            <div className="tag-row">
              {group.items.map((item) => (
                <a key={item} className="template-tag" href={getFooterItemHref(group.id, item)}>
                  {item}
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

export function AppFooter({ boilerplateGroups }) {
  return (
    <footer className="app-footer" aria-label="Site footer">
      <BoilerplateFootnotes
        title="Footer Links"
        subtitle="Support, Legal, Company, Product"
        boilerplateGroups={boilerplateGroups}
      />
      <div className="footer-baseline">
        <span>FoxHub</span>
        <span>Built for local trust, payments, mini apps, and community operations.</span>
      </div>
    </footer>
  );
}

export function rankMiniApps(state, selectedThread, activeCircle) {
  const recentOrder = new Map(state.miniAppRecents.map((item, index) => [item.name, index]));
  return [...miniApps].sort((a, b) => scoreMiniApp(b, state, selectedThread, activeCircle, recentOrder) - scoreMiniApp(a, state, selectedThread, activeCircle, recentOrder));
}

export function scoreMiniApp(app, state, selectedThread, activeCircle, recentOrder) {
  let score = 0;
  if (state.serviceContinuity.some((item) => item.appId === app.id)) score += 30;
  if (recentOrder.has(app.name)) score += 20 - Math.min(recentOrder.get(app.name), 10);
  if (selectedThread?.type === "official" && app.type === "Events") score += 8;
  if (selectedThread?.type === "community" && app.type === "Payments") score += 6;
  if ((activeCircle?.name || "").toLowerCase().includes("miami") && app.name === "SplitTab") score += 5;
  if ((activeCircle?.name || "").toLowerCase().includes("atl") && app.name === "FoxTickets") score += 5;
  return score;
}
