import { useState } from "react";

import { getContactTrustTier } from "../rules.js";

import { PatternLibrary, FilteredEmptyState } from "./shared.jsx";

export function HomeWorkspace({
  state,
  activeMiniApp,
  selectedThread,
  runService,
  runQrFlow,
  setActiveTab,
  openProfilePanel,
  toggleOfficialAccountSubscription,
  openOfficialThread,
  openContactThread,
  openSavedItem,
  handleWalletAction,
  reactToMoment,
  commentOnMoment,
  startShakeMatch,
  logFileTransfer,
  openLiveChannel,
  openCommunityChannel,
  resolveLocalListing,
  updateCreatorOrder,
  logDemandSignal,
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
  busy,
  boilerplateGroups
}) {
  const subscribedPosts = state.officialPosts.filter((post) => state.officialAccountSubscriptions.includes(post.accountId));
  const suggestedContacts = [...state.contacts]
    .sort((a, b) => (b.relationshipScore || 0) - (a.relationshipScore || 0))
    .slice(0, 3);
  const topCircles = (state.circles || []).slice(0, 3);
  const trustedContacts = (state.contacts || []).filter((contact) => ["AA", "A"].includes(getContactTrustTier(contact)));
  const activeNeeds = (state.listings || [])
    .filter((listing) => ["Services", "Gigs", "Community", "Jobs"].includes(listing.category))
    .slice(0, 4);
  const serviceMerchants = (state.shopProfiles || []).slice(0, 3);
  const rapportFlow = [
    {
      id: "social",
      label: "Social",
      metric: `${state.contacts.length} people`,
      detail: "Personal identity, chats, moments, and everyday presence keep the network human.",
      action: () => setActiveTab("chat")
    },
    {
      id: "rapport",
      label: "Rapport",
      metric: `${trustedContacts.length} high-trust`,
      detail: "Trust tiers, vouches, relationship scores, and verification turn contacts into confidence.",
      action: () => setActiveTab("circles")
    },
    {
      id: "communal",
      label: "Communal",
      metric: `${state.circles.length} circles`,
      detail: "Groups, circles, channels, events, and moments create places people can belong and coordinate.",
      action: () => setActiveTab("circles")
    },
    {
      id: "service",
      label: "Service / Merchant",
      metric: `${state.listings.length} listings`,
      detail: "Needs, referrals, bookings, offers, merchants, and payments grow out of trusted communities.",
      action: () => setActiveTab("market")
    }
  ];
  const rapportSignals = [
    { label: "Trusted people", value: trustedContacts.length, note: "AA/A relationship lanes" },
    { label: "Circle reach", value: topCircles.length, note: "active communal anchors" },
    { label: "Open needs", value: activeNeeds.length, note: "service-ready posts" },
    { label: "Merchant nodes", value: serviceMerchants.length, note: "shops tied to trust" }
  ];
  const featuredAccounts = state.officialAccounts.slice(0, 3);
  const threadSnapshot = selectedThread || {
    name: "FoxHub workspace",
    type: "workspace",
    messages: [],
    lastActiveLabel: "Awaiting activity"
  };
  const lastMessage = threadSnapshot.messages[threadSnapshot.messages.length - 1];
  const walletBalance = state.walletEvents.reduce((sum, event) => {
    const numeric = Number(event.amount?.replace(/[^0-9.-]/g, ""));
    return sum + (Number.isNaN(numeric) ? 0 : numeric);
  }, 0);
  const walletActions = [
    { id: "send", label: "Send", helper: "Peer transfer" },
    { id: "add", label: "Top up", helper: "Instant debit load" },
    { id: "merchant", label: "Merchant pay", helper: "QR checkout" },
    { id: "cashout", label: "Cash out", helper: "Bank payout" }
  ];
  const walletHistory = state.walletEvents;
  const localCity = state.profile?.city || "Your city";
  const memberZipCode = String(state.profile?.zipCode || state.profile?.postalCode || "").trim();
  const peopleLocalSeed = (state.peopleNearby || []).map((person) => {
    const contact = (state.contacts || []).find((item) => item.id === person.contactId);
    return {
      ...(contact || {}),
      ...person,
      name: person.name || contact?.displayName || contact?.name || "FoxHub member",
      handle: person.handle || contact?.handle || "@member",
      city: person.city || contact?.city || "",
      zipCode: person.zipCode || contact?.zipCode || contact?.postalCode || "",
      trust: person.trust || contact?.trustTier || getContactTrustTier(contact || {})
    };
  });
  const exactZipPeople = memberZipCode
    ? peopleLocalSeed.filter((person) => String(person.zipCode || person.postalCode || "").trim() === memberZipCode)
    : [];
  const cityFallbackPeople =
    memberZipCode && !exactZipPeople.length && localCity !== "Your city"
      ? peopleLocalSeed.filter((person) => String(person.city || "").toLowerCase() === String(localCity || "").toLowerCase())
      : [];
  const peopleLocalToYou = (exactZipPeople.length ? exactZipPeople : cityFallbackPeople).slice(0, 6);
  const peopleLocalBasis = exactZipPeople.length ? `Based on your ZIP code ${memberZipCode}` : cityFallbackPeople.length ? `Based on your city near ${localCity}` : "";
  const todayCompass = [
    {
      id: "social-start",
      eyebrow: "Start socially",
      title: suggestedContacts[0]?.displayName || suggestedContacts[0]?.name || "Reconnect with your network",
      detail: suggestedContacts[0]
        ? `${suggestedContacts[0].preferredSurface || suggestedContacts[0].status} · ${suggestedContacts[0].relationshipScore || 0} rapport`
        : "Open chat, check messages, and restart the people loop first.",
      cta: "Open chat",
      run: () => setActiveTab("chat")
    },
    {
      id: "trust-next",
      eyebrow: "Trust next",
      title: trustedContacts.length ? `${trustedContacts.length} trusted people ready` : "Build trust lanes",
      detail: trustedContacts.length
        ? "Review the highest-confidence contacts, vouches, and strongest introduction paths."
        : "No AA/A trust lane yet. Open circles and start building rapport.",
      cta: "Open circles",
      run: () => setActiveTab("circles")
    },
    {
      id: "service-ready",
      eyebrow: "Service when ready",
      title: activeNeeds[0]?.title || "Browse local needs",
      detail: activeNeeds[0]
        ? `${activeNeeds[0].city} · ${activeNeeds[0].category} · $${activeNeeds[0].price}`
        : "When the social layer feels right, move into trusted needs and merchant flows.",
      cta: "Open market",
      run: () => setActiveTab("market")
    },
    {
      id: "wallet-followup",
      eyebrow: "Money and follow-up",
      title: `${walletHistory.length} wallet events`,
      detail: `Current balance signal: $${walletBalance.toFixed(2)} · ${state.reliabilityQueue?.filter((item) => item.status !== "done").length || 0} queued follow-ups`,
      cta: "Open wallet",
      run: () => setActiveTab("wallet")
    }
  ];
  const homeMomentum = [
    { id: "messages", label: "Latest conversation", value: threadSnapshot.name, meta: lastMessage?.body || lastMessage?.text || threadSnapshot.lastActiveLabel || "No recent message" },
    { id: "city", label: "Local focus", value: localCity, meta: `${topCircles.length} circles · ${activeNeeds.length} active needs · ${serviceMerchants.length} merchants` },
    { id: "signals", label: "Subscribed signals", value: `${subscribedPosts.length} posts`, meta: featuredAccounts[0]?.name ? `Top account: ${featuredAccounts[0].name}` : "No official feed selected yet" },
    { id: "miniapp", label: "Mini app context", value: activeMiniApp?.name || "FoxHub core", meta: activeMiniApp?.summary || "Keep people, trust, and service actions in one flow" }
  ];
  const friendActivityItems = suggestedContacts.map((contact, index) => ({
    id: `friend-activity-${contact.id}`,
    name: contact.displayName || contact.name,
    handle: contact.handle,
    meta: contact.lastActiveLabel || contact.status || "active",
    activity: index === 0
      ? `${contact.preferredSurface || "profile"} update shared with trusted people`
      : `${contact.relationshipScore || 0} rapport · ${contact.referralSource || "direct relationship"}`,
    contactId: contact.id
  }));
  const bulletinPosts = [
    ...(state.officialPosts || []).slice(0, 2).map((post) => ({
      id: `bulletin-${post.id}`,
      title: post.title,
      body: post.summary,
      meta: post.accountName || "Official bulletin",
      action: () => openOfficialThread?.(post.accountId)
    })),
    ...(state.communityChannels || []).slice(0, 2).map((channel) => ({
      id: `bulletin-channel-${channel.id}`,
      title: channel.name,
      body: channel.topic || "Community bulletin",
      meta: `${channel.members || 0} members`,
      action: () => openCommunityChannel?.(channel.id)
    }))
  ].slice(0, 4);
  const journalPosts = [
    ...(state.storyHighlights || []).slice(0, 3).map((story) => ({
      id: `journal-${story.id}`,
      title: story.title,
      body: story.summary,
      meta: `${story.author} · ${story.tag || "journal"}`
    })),
    ...(state.savedItems || []).filter((item) => item.kind === "moment" || item.kind === "message").slice(0, 2).map((item) => ({
      id: `journal-saved-${item.id}`,
      title: item.title,
      body: item.detail,
      meta: item.meta || item.source || "saved"
    }))
  ].slice(0, 4);
  const visitorPreviewItems = [...state.contacts]
    .sort((a, b) => (b.relationshipScore || 0) - (a.relationshipScore || 0))
    .slice(0, 5)
    .map((contact) => ({
      id: `visitor-${contact.id}`,
      name: contact.displayName || contact.name,
      handle: contact.handle,
      trust: getContactTrustTier(contact),
      contactId: contact.id
    }));
  const [homeFeedSort, setHomeFeedSort] = useState("hot");
  const [homeFeedScope, setHomeFeedScope] = useState("all");
  const [homeFeedCommentDrafts, setHomeFeedCommentDrafts] = useState({});
  const triggerWalletAction = (type) => {
    if (!handleWalletAction) return;
    handleWalletAction(type);
  };
  const [platformQuery, setPlatformQuery] = useState("");
  const [platformResults, setPlatformResults] = useState([]);
  const [platformDigest, setPlatformDigest] = useState([]);
  const [platformNote, setPlatformNote] = useState("");

  const platformStatus = [
    { id: "1", title: "Find Anything", value: `${state.unifiedActionLog?.length || 0} tries` },
    { id: "2", title: "Trust Check", value: state.trustEngine?.updatedAt ? "active" : "ready" },
    { id: "3", title: "Hold And Help", value: `${state.escrows?.length || 0} holds` },
    { id: "4", title: "Good Name", value: `${Object.keys(state.reputationGraph?.endorsementsByHandle || {}).length} people` },
    { id: "5", title: "Smart Introductions", value: `${state.matchRequests?.length || 0} requests` },
    { id: "6", title: "Helper Notes", value: `${state.copilotInsights?.length || 0} notes` },
    { id: "7", title: "Important Alerts", value: state.notificationPolicy?.mode || "priority" },
    { id: "8", title: "Sign-Up Path", value: `${state.conversionFunnels?.length || 0} paths` },
    { id: "9", title: "Mini App Sessions", value: `${state.miniAppRuntimeSessions?.length || 0} sessions` },
    { id: "10", title: "Follow-Up Queue", value: `${state.reliabilityQueue?.filter((item) => item.status !== "done").length || 0} pending` },
    { id: "11", title: "What People Do", value: `${state.analyticsHub?.events?.length || 0} actions` },
    { id: "12", title: "Risk Checks", value: `${state.fraudHoldQueue?.length || 0} checks` }
  ];
  const expansionReadiness = [
    { id: "msg", title: "Messaging Stack", detail: "Voice notes, command palette, dense lists, and collaborative sync primitives are installed.", count: `${state.threads.length} threads`, action: () => setActiveTab("chat") },
    { id: "ops", title: "Ops + Moderation", detail: "Rule engine, audit-ready tooling, incident actions, and digest controls are available.", count: `${state.operatorActions?.length || 0} ops events`, action: () => setActiveTab("discover") },
    { id: "wallet", title: "Wallet + Risk", detail: "Payment rails and risk-evaluation hooks are installed for secure transfers and holds.", count: `${state.walletEvents.length} wallet events`, action: () => setActiveTab("wallet") },
    { id: "market", title: "Market + Discovery", detail: "Advanced search/index packages are in place for cross-surface discovery.", count: `${state.listings.length} listings`, action: () => setActiveTab("market") },
    { id: "runtime", title: "Mini App Sessions", detail: "Mini apps can open, remember context, and pick up where people left off.", count: `${state.miniAppRuntimeSessions?.length || 0} sessions`, action: () => setActiveTab("discover") },
    { id: "exp", title: "Try New Ideas", detail: "New ideas can be tested with small groups before everyone sees them.", count: `${state.experimentAssignments?.length || 0} assignments`, action: () => setFeatureFlag?.("discovery_v2", true) }
  ];
  const installedToolkitCards = [
    { id: "1", component: "Command + Keyboard UX", summary: "Global command palette, shortcut hooks, and dense navigation primitives.", highlight: "cmdk + react-hotkeys-hook", source: "Package install", zone: "Shell UX" },
    { id: "2", component: "Realtime + Collaboration", summary: "Device-safe sync and shared state foundations for multi-session threads.", highlight: "socket.io-client + yjs + y-webrtc + y-indexeddb", source: "Package install", zone: "Messaging core" },
    { id: "3", component: "Wallet + Compliance SDKs", summary: "Payment, identity, and policy service clients available for backend orchestration.", highlight: "Stripe + Plaid + Twilio + SendGrid + DocuSign", source: "Functions install", zone: "Payments + Ops" },
    { id: "4", component: "Search + Ranking Layer", summary: "Fast fuzzy and indexed lookup for unified search and discovery ranking.", highlight: "fuse.js + minisearch + tanstack table", source: "Package install", zone: "Discovery" },
    { id: "5", component: "Content + Safety", summary: "Markdown rendering, sanitizer, and moderation-ready rule evaluation pipeline.", highlight: "react-markdown + remark-gfm + dompurify + json-rules-engine", source: "Package install", zone: "Trust" },
    { id: "6", component: "Media + Upload", summary: "Clip uploads, compression, dropzone UX, and export/archive primitives.", highlight: "react-dropzone + browser-image-compression + jszip", source: "Package install", zone: "Creator tools" },
    { id: "7", component: "Observability + Experimentation", summary: "Crash/perf visibility and controlled rollout mechanics for safer releases.", highlight: "Sentry + web-vitals + OpenFeature + LaunchDarkly", source: "Package install", zone: "Reliability" },
    { id: "8", component: "Offline Reliability", summary: "Queue, persistence, and worker bridge setup for resilient background actions.", highlight: "dexie + idb-keyval + localforage + comlink", source: "Package install", zone: "Runtime stability" }
  ];

  function runPlatformSearch() {
    const results = runUnifiedSearch ? runUnifiedSearch(platformQuery) : [];
    setPlatformResults(results || []);
    setPlatformNote(`Unified search returned ${(results || []).length} results.`);
  }

  function runPlatformOptimizerPass() {
    recalculateTrustEngine?.();
    rebuildReputationGraph?.();
    flushReliableQueue?.(20);
    const digest = buildNotificationDigest ? buildNotificationDigest() : [];
    setPlatformDigest(digest || []);
    trackAnalyticsEvent?.({
      name: "platform_optimizer_pass",
      category: "ops",
      metadata: {
        digestCount: (digest || []).length
      }
    });
    setPlatformNote("Optimizer pass completed: trust, reputation, queue, and digest refreshed.");
  }

  const homeFeedItems = [
    ...(state.moments || []).map((moment) => {
      const reactionTotal = Object.values(moment.reactions || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
      const replyCount = moment.comments?.length || 0;
      const contact = (state.contacts || []).find((item) => item.handle === moment.handle || item.name === moment.author || item.displayName === moment.author);
      return {
        id: `moment-${moment.id}`,
        sourceId: moment.id,
        contactId: contact?.id || "",
        type: "moment",
        community: "Moments",
        author: moment.author || "FoxHub Member",
        handle: moment.handle || "@member",
        title: moment.text?.slice(0, 88) || "Photo Moment",
        body: moment.text || "Photo update",
        meta: moment.meta || "Member post",
        postedAt: moment.postedAt || "",
        score: reactionTotal + replyCount * 3,
        comments: replyCount,
        trust: "member",
        locality: moment.meta || localCity,
        attachments: moment.attachments || [],
        myReaction: moment.myReaction || ""
      };
    }),
    ...(state.officialPosts || []).map((post) => ({
      id: `official-${post.id}`,
      sourceId: post.accountId,
      type: "official",
      community: post.accountName || "Official",
      author: post.accountName || "Official account",
      handle: "official signal",
      title: post.title,
      body: post.summary,
      meta: post.meta,
      postedAt: "",
      score: state.officialAccountSubscriptions.includes(post.accountId) ? 42 : 24,
      comments: 0,
      trust: "official",
      locality: post.meta || "Platform",
      subscribed: state.officialAccountSubscriptions.includes(post.accountId)
    })),
    ...(activeNeeds || []).map((listing) => ({
      id: `need-${listing.id}`,
      sourceId: listing.id,
      type: "need",
      community: listing.category || "Needs",
      author: listing.seller || listing.owner || "Local member",
      handle: listing.verified ? "verified need" : "community ask",
      title: listing.title,
      body: listing.description || `${listing.city || localCity} · ${listing.neighborhood || "local"}`,
      meta: `${listing.city || localCity} · ${listing.neighborhood || "local"} · $${listing.price || 0}`,
      postedAt: listing.postedAt || "",
      score: (listing.verified ? 28 : 16) + (Number(listing.price) > 0 ? 4 : 0),
      comments: listing.replyCount || 0,
      trust: listing.verified ? "trusted" : "community",
      locality: listing.city || localCity
    }))
  ].filter((item) => {
    if (homeFeedScope === "all") return true;
    if (homeFeedScope === "local") return String(item.locality || "").toLowerCase().includes(String(localCity || "").toLowerCase()) || item.type === "need";
    if (homeFeedScope === "trusted") return ["official", "trusted"].includes(item.trust);
    if (homeFeedScope === "people") return item.type === "moment";
    return true;
  }).sort((a, b) => {
    if (homeFeedSort === "new") {
      return new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime();
    }
    if (homeFeedSort === "comments") return (b.comments || 0) - (a.comments || 0);
    return (b.score || 0) - (a.score || 0);
  });

  function submitHomeFeedComment(momentId) {
    const text = String(homeFeedCommentDrafts[momentId] || "").trim();
    if (!text) return;
    commentOnMoment?.(momentId, text);
    setHomeFeedCommentDrafts((current) => ({ ...current, [momentId]: "" }));
  }

  return (
    <>
      <section className="surface member-welcome" aria-label="Your daily workspace">
        <p className="card-label">Your day on FoxHub</p><h2>Welcome back{state.profile?.name ? `, ${state.profile.name}` : ""}.</h2>
        <p>Pick up a conversation, catch up with your circle, or find help nearby.</p>
        <div className="member-quick-actions">
          <button type="button" className="accent-button" onClick={() => setActiveTab("chat")}>Open messages</button>
          <button type="button" className="ghost-button" onClick={() => setActiveTab("circles")}>Visit your circles</button>
          <button type="button" className="ghost-button" onClick={() => setActiveTab("market")}>Find local help</button>
        </div>
      </section>
      <section className="surface-row">
        <article className="surface home-feed-surface">
          <div className="surface-head home-feed-head">
            <div>
              <p className="card-label">Home feed</p>
              <h3>Front page for your people, places, and trusted asks.</h3>
            </div>
            <span className="badge subtle">{homeFeedItems.length} posts</span>
          </div>
          <div className="home-feed-toolbar" aria-label="Home feed controls">
            {[
              ["hot", "Hot"],
              ["new", "New"],
              ["comments", "Discussed"]
            ].map(([value, label]) => (
              <button key={value} type="button" className={homeFeedSort === value ? "auth-pill active" : "auth-pill"} onClick={() => setHomeFeedSort(value)}>
                {label}
              </button>
            ))}
            <span className="home-feed-divider" aria-hidden="true" />
            {[
              ["all", "All"],
              ["local", "Local"],
              ["trusted", "Trusted"],
              ["people", "People"]
            ].map(([value, label]) => (
              <button key={value} type="button" className={homeFeedScope === value ? "auth-pill active" : "auth-pill"} onClick={() => setHomeFeedScope(value)}>
                {label}
              </button>
            ))}
          </div>
          <div className="home-feed-stack">
            {homeFeedItems.map((item) => (
              <article key={item.id} className={`home-feed-card ${item.type}`}>
                <div className="home-feed-vote-rail" aria-label={`${item.title} score`}>
                  <button
                    type="button"
                    className={item.myReaction === "like" ? "feed-vote active" : "feed-vote"}
                    onClick={() => item.type === "moment" ? reactToMoment?.(item.sourceId, "like") : null}
                    disabled={item.type !== "moment"}
                    aria-label="Upvote"
                  >
                    ↑
                  </button>
                  <strong>{item.score}</strong>
                  <button
                    type="button"
                    className="feed-vote"
                    onClick={() => item.type === "moment" ? reactToMoment?.(item.sourceId, "thanks") : null}
                    disabled={item.type !== "moment"}
                    aria-label="Appreciate"
                  >
                    +
                  </button>
                </div>
                <div className="home-feed-body">
                  <div className="home-feed-meta">
                    <span>{item.community}</span>
                    <span>{item.author}</span>
                    <span>{item.meta}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  {item.attachments?.length ? (
                    <div className="home-feed-photo-grid">
                      {item.attachments.slice(0, 3).map((attachment) => (
                        <img key={attachment.id || attachment.name} src={attachment.url} alt={attachment.name || "Feed attachment"} loading="lazy" decoding="async" />
                      ))}
                    </div>
                  ) : null}
                  <div className="home-feed-actions">
                    <span className="badge subtle">{item.trust}</span>
                    <span className="badge subtle">{item.comments} comments</span>
                    {item.type === "official" ? (
                      <>
                        <button type="button" className="ghost-button small" onClick={() => openOfficialThread?.(item.sourceId)}>
                          Open thread
                        </button>
                        <button type="button" className="ghost-button small" onClick={() => toggleOfficialAccountSubscription?.(item.sourceId)}>
                          {item.subscribed ? "Following" : "Follow"}
                        </button>
                      </>
                    ) : null}
                    {item.type === "need" ? (
                      <>
                        <button type="button" className="ghost-button small" onClick={() => setActiveTab("market")}>
                          View need
                        </button>
                        <button type="button" className="ghost-button small" onClick={() => logDemandSignal?.({ listingId: item.sourceId, signal: "home-feed-interest", note: item.title })}>
                          Signal interest
                        </button>
                      </>
                    ) : null}
                    {item.type === "moment" ? (
                      <>
                        <button type="button" className="ghost-button small" onClick={() => item.contactId ? openPublicProfile?.(item.contactId) : openContactThread?.(String(item.handle || "").replace("@", ""))}>
                          View profile
                        </button>
                        <button type="button" className="ghost-button small" onClick={() => openContactThread?.(String(item.handle || "").replace("@", ""))}>
                          Message
                        </button>
                      </>
                    ) : null}
                  </div>
                  {item.type === "moment" ? (
                    <div className="home-feed-comment-row">
                      <input
                        value={homeFeedCommentDrafts[item.sourceId] || ""}
                        onChange={(event) => setHomeFeedCommentDrafts((current) => ({ ...current, [item.sourceId]: event.target.value }))}
                        placeholder="Add a quick comment"
                      />
                      <button type="button" className="ghost-button small" onClick={() => submitHomeFeedComment(item.sourceId)} disabled={busy}>
                        Comment
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
      <details className="member-disclosure community-more"><summary>More from your community</summary>

      <section className="surface-row two-up home-social-row" aria-label="Home social activity">
        <article className="surface home-social-panel friend-activity-panel">
          <div className="surface-head">
            <div>
              <p className="card-label">Friend activity feed</p>
              <h3>What trusted people are doing.</h3>
            </div>
            <span className="badge subtle">{friendActivityItems.length} updates</span>
          </div>
          <div className="home-social-stack">
            {friendActivityItems.map((item) => (
              <div key={item.id} className="home-social-row-item">
                <div className="home-social-avatar" aria-hidden="true">{item.name.slice(0, 1)}</div>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.activity}</p>
                  <span>{item.handle} · {item.meta}</span>
                </div>
                <button type="button" className="ghost-button small" onClick={() => openPublicProfile?.(item.contactId)}>
                  View
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="surface home-social-panel visitor-preview-panel">
          <div className="surface-head">
            <div>
              <p className="card-label">Visitor preview</p>
              <h3>People most likely to check in.</h3>
            </div>
            <span className="badge subtle">{visitorPreviewItems.length} people</span>
          </div>
          <div className="visitor-preview-grid">
            {visitorPreviewItems.map((item) => (
              <button key={item.id} type="button" className="visitor-preview-card" onClick={() => openPublicProfile?.(item.contactId)}>
                <span className="home-social-avatar">{item.name.slice(0, 1)}</span>
                <strong>{item.name}</strong>
                <p>{item.handle}</p>
                <em>{item.trust}</em>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up home-social-row" aria-label="Home bulletin and journals">
        <article className="surface home-social-panel bulletin-board-panel">
          <div className="surface-head">
            <div>
              <p className="card-label">Bulletin board posts</p>
              <h3>Short announcements for the circle.</h3>
            </div>
            <span className="badge subtle">{bulletinPosts.length} posts</span>
          </div>
          <div className="home-social-card-list">
            {bulletinPosts.map((post) => (
              <article key={post.id} className="home-social-card">
                <div>
                  <strong>{post.title}</strong>
                  <p>{post.body}</p>
                  <span>{post.meta}</span>
                </div>
                {post.action ? (
                  <button type="button" className="ghost-button small" onClick={post.action}>
                    Open
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </article>

        <article className="surface home-social-panel journal-panel">
          <div className="surface-head">
            <div>
              <p className="card-label">Blog and journal posts</p>
              <h3>Longer notes worth saving.</h3>
            </div>
            <span className="badge subtle">{journalPosts.length} entries</span>
          </div>
          <div className="home-social-card-list">
            {journalPosts.map((post) => (
              <article key={post.id} className="home-social-card journal-card">
                <div>
                  <strong>{post.title}</strong>
                  <p>{post.body}</p>
                  <span>{post.meta}</span>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up fox-home-enriched-row">
        <article className="surface surface-strong fox-home-compass">
          <div className="surface-head">
            <p className="card-label">Today compass</p>
            <span className="badge subtle">{localCity}</span>
          </div>
          <p className="panel-copy">
            Home should answer one question quickly: what is the smartest next move right now? These paths keep FoxHub personal first and transactional second.
          </p>
          <div className="fox-home-compass-grid">
            {todayCompass.map((item) => (
              <article key={item.id} className="fox-home-compass-card">
                <span className="fox-home-kicker">{item.eyebrow}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <button type="button" className="ghost-button small" onClick={item.run}>
                  {item.cta}
                </button>
              </article>
            ))}
          </div>
        </article>

        <article className="surface fox-home-momentum">
          <div className="surface-head">
            <p className="card-label">Momentum</p>
            <span className="badge subtle">Live context</span>
          </div>
          <div className="fox-home-momentum-stack">
            {homeMomentum.map((item) => (
              <div key={item.id} className="fox-home-momentum-row">
                <div>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
                <p>{item.meta}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel rapport-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Trusted introductions</p>
            <span className="badge subtle">{suggestedContacts.length} strongest</span>
          </div>
          <div className="list-stack">
            {suggestedContacts.map((contact) => (
              <div key={contact.id} className="list-row">
                <div>
                  <strong>{contact.displayName || contact.name}</strong>
                  <p>{contact.preferredSurface || contact.status} · {contact.referralSource || "direct relationship"}</p>
                </div>
                <div className="row-meta-text">{contact.relationshipScore || 0} rapport · {getContactTrustTier(contact)}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Community-to-service bridge</p>
            <span className="badge subtle">{activeNeeds.length} active needs</span>
          </div>
          <div className="list-stack">
            {activeNeeds.map((listing) => (
              <div key={listing.id} className="list-row">
                <div>
                  <strong>{listing.title}</strong>
                  <p>{listing.city} · {listing.category} · {listing.neighborhood}</p>
                </div>
                <div className="row-meta-text">{listing.verified ? "verified" : "community"} · ${listing.price}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row three-up fox-home-social-grid">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Circle anchors</p>
            <span className="badge subtle">{topCircles.length} nearby</span>
          </div>
          <div className="list-stack">
            {topCircles.length ? topCircles.map((circle) => (
              <div key={circle.id} className="list-row">
                <div>
                  <strong>{circle.name}</strong>
                  <p>{circle.city || localCity} · {circle.topic || circle.purpose || "community room"}</p>
                </div>
                <span className="row-meta-text">{circle.memberCount || circle.members?.length || 0} members</span>
              </div>
            )) : <p className="surface-note">No circles yet. Start with social and rapport to grow local rooms.</p>}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Official signals</p>
            <span className="badge subtle">{featuredAccounts.length} accounts</span>
          </div>
          <div className="list-stack">
            {featuredAccounts.length ? featuredAccounts.map((account) => (
              <div key={account.id} className="list-row">
                <div>
                  <strong>{account.name}</strong>
                  <p>{account.category || account.type || "official account"} · {account.summary || account.tagline || "Platform updates and public signals"}</p>
                </div>
                <button type="button" className="ghost-button small" onClick={() => openOfficialThread?.(account.id)}>
                  Open
                </button>
              </div>
            )) : <p className="surface-note">No official accounts available.</p>}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Wallet shortcuts</p>
            <span className="badge subtle">${walletBalance.toFixed(2)}</span>
          </div>
          <div className="fox-home-wallet-shortcuts">
            {walletActions.map((action) => (
              <button key={action.id} type="button" className="fox-home-wallet-action" onClick={() => triggerWalletAction(action.id)}>
                <strong>{action.label}</strong>
                <span>{action.helper}</span>
              </button>
            ))}
          </div>
        </article>
      </section>

      <details className="member-disclosure"><summary>Advanced tools & diagnostics</summary>
      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Relationship order</p>
            <span className="badge subtle">Primary UX</span>
          </div>
          <div className="list-stack">
            <div className="list-row">
              <div>
                <strong>Social</strong>
                <p>Messages, group threads, moments, service channels, and voice or video calls.</p>
              </div>
              <div className="row-meta-text">{state.threads.length} threads</div>
            </div>
            <div className="list-row">
              <div>
                <strong>Rapport</strong>
                <p>People, vouches, trust tiers, introductions, endorsements, and reputation context.</p>
              </div>
              <div className="row-meta-text">{state.contacts.length} contacts</div>
            </div>
            <div className="list-row">
              <div>
                <strong>Communal</strong>
                <p>Circles, rooms, events, local programs, creators, and shared community attention.</p>
              </div>
              <div className="row-meta-text">{state.circles.length} circles</div>
            </div>
            <div className="list-row">
              <div>
                <strong>Services / Merchant</strong>
                <p>Trusted help, merchant workflows, bookings, routes, mini apps, and local search.</p>
              </div>
              <div className="row-meta-text">{state.services.length} services</div>
            </div>
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">FoxHub Helpers</p>
            <span className="badge subtle">12 ready</span>
          </div>
          <p className="panel-copy">
            A friendly control room for search, trust, money holds, reputation, introductions, alerts, sign-up paths, mini apps, follow-up, and risk checks.
          </p>
          <div className="starter-grid">
            {platformStatus.map((item) => (
              <div key={item.id} className="starter-card">
                <strong>{item.id}. {item.title}</strong>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
          <div className="inline-actions wrap">
            <input
              type="search"
              className="toolbar-search"
              placeholder="Try unified search: person, listing, service..."
              value={platformQuery}
              onChange={(event) => setPlatformQuery(event.target.value)}
            />
            <button type="button" className="ghost-button small" onClick={runPlatformSearch}>Run search</button>
            <button
              type="button"
              className="ghost-button small"
              onClick={() => {
                const first = platformResults[0];
                if (first) runUnifiedAction?.(first);
              }}
            >
              Run top action
            </button>
            <button type="button" className="ghost-button small" onClick={() => recalculateTrustEngine?.()}>Refresh trust</button>
            <button
              type="button"
              className="ghost-button small"
              onClick={() =>
                createEscrowContract?.({
                  listingId: state.listings?.[0]?.id || "listing",
                  buyerId: state.profile?.handle || "buyer",
                  sellerId: state.listings?.[0]?.seller || "seller",
                  amount: Number(state.listings?.[0]?.price || 120)
                })
              }
            >
              New escrow
            </button>
            <button
              type="button"
              className="ghost-button small"
              onClick={() => {
                const escrow = state.escrows?.[0];
                if (escrow?.milestones?.[0]?.id) releaseEscrowMilestone?.(escrow.id, escrow.milestones[0].id);
              }}
            >
              Release milestone
            </button>
            <button
              type="button"
              className="ghost-button small"
              onClick={() => {
                const escrow = state.escrows?.[0];
                openEscrowDispute?.({
                  escrowId: escrow?.id,
                  amount: `$${Number(escrow?.amount || 0).toFixed(2)}`
                });
              }}
            >
              Escrow dispute
            </button>
            <button type="button" className="ghost-button small" onClick={() => rebuildReputationGraph?.()}>Rebuild reputation</button>
            <button
              type="button"
              className="ghost-button small"
              onClick={() => runSmartMatchmaking?.({ query: "local trusted services", city: state.profile?.city })}
            >
              Run matchmaking
            </button>
            <button type="button" className="ghost-button small" onClick={() => runOperatorCopilot?.({ title: "Live operations sweep" })}>Run copilot</button>
            <button type="button" className="ghost-button small" onClick={() => setNotificationPolicy?.({ mode: "priority", muteLowPriority: true })}>Priority notifications</button>
            <button
              type="button"
              className="ghost-button small"
              onClick={() => createConversionFunnel?.({ title: "Creator offer funnel", offer: "Starter package", bookingWindow: "Mon-Fri 10-6" })}
            >
              Create funnel
            </button>
            <button
              type="button"
              className="ghost-button small"
              onClick={() => registerMiniAppRuntime?.({ appId: activeMiniApp?.id || "payments", permissions: ["profile.read", "wallet.write"] })}
            >
              Start mini app
            </button>
            <button
              type="button"
              className="ghost-button small"
              onClick={() => invokeMiniAppRuntimeEvent?.({ appId: activeMiniApp?.id || "payments", permission: "profile.read", event: "bootstrap" })}
            >
              Runtime event
            </button>
            <button
              type="button"
              className="ghost-button small"
              onClick={() => queueReliableMutation?.({ mutation: "sync_contact", payload: { id: state.contacts?.[0]?.id || "contact" } })}
            >
              Queue mutation
            </button>
            <button type="button" className="ghost-button small" onClick={() => flushReliableQueue?.(10)}>Flush queue</button>
            <button
              type="button"
              className="ghost-button small"
              onClick={() => trackAnalyticsEvent?.({ name: "home_platform_click", category: "engagement", metadata: { tab: "hub" } })}
            >
              Track event
            </button>
            <button type="button" className="ghost-button small" onClick={() => setFeatureFlag?.("new_search_ranker", true)}>Enable flag</button>
            <button type="button" className="ghost-button small" onClick={() => assignExperimentVariant?.("onboarding_flow_v2", "B")}>Assign experiment</button>
            <button
              type="button"
              className="ghost-button small"
              onClick={() =>
                evaluateWalletRisk?.({
                  amount: Number(state.listings?.[0]?.price || 1800),
                  velocity: 5,
                  geoAnomaly: true,
                  linkedAccountRisk: false
                })
              }
            >
              Run fraud check
            </button>
            <button type="button" className="accent-button" onClick={runPlatformOptimizerPass}>Optimize now</button>
          </div>
          {platformNote ? <p className="row-meta-text">{platformNote}</p> : null}
          {(platformResults.length || platformDigest.length) ? (
            <div className="list-stack">
              {platformResults.slice(0, 5).map((result) => (
                <div key={`${result.type}-${result.id}`} className="list-row">
                  <div>
                    <strong>{result.label}</strong>
                    <p>{result.type} · {result.detail || "match"}</p>
                  </div>
                  <button type="button" className="ghost-button small" onClick={() => runUnifiedAction?.(result)}>Run</button>
                </div>
              ))}
              {platformDigest.slice(0, 3).map((note) => (
                <div key={note.id} className="list-row">
                  <div>
                    <strong>{note.title}</strong>
                    <p>{note.body}</p>
                  </div>
                  <span className="badge subtle">{note.category}</span>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Expansion readiness</p>
            <span className="badge subtle">{expansionReadiness.length} capability lanes</span>
          </div>
          <p className="panel-copy">
            GUI entry points for the newly installed feature stack. Each lane maps to live surfaces or runtime hooks.
          </p>
          <div className="starter-grid">
            {expansionReadiness.map((item) => (
              <div key={item.id} className="starter-card">
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
                <div className="inline-actions wrap">
                  <span className="badge subtle">{item.count}</span>
                  <button type="button" className="ghost-button small" onClick={item.action}>
                    Open lane
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="inline-actions wrap">
            <button type="button" className="ghost-button small" onClick={() => queueReliableMutation?.({ mutation: "sync_timeline", payload: { source: "home_expansion" } })}>
              Queue reliability test
            </button>
            <button type="button" className="ghost-button small" onClick={() => flushReliableQueue?.(25)}>
              Flush queue
            </button>
            <button type="button" className="ghost-button small" onClick={() => buildNotificationDigest?.()}>
              Build digest
            </button>
            <button type="button" className="ghost-button small" onClick={() => assignExperimentVariant?.("home_expansion_lane", "A")}>
              Assign experiment
            </button>
          </div>
        </article>
      </section>

      <PatternLibrary cards={installedToolkitCards} />

      </details>
      <section className="surface-row two-up service-panel merchant-panel">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Quick services</p>
            <span className="badge subtle">Daily entry</span>
          </div>
          <div className="service-grid">
            {state.services.slice(0, 12).map((service) => (
              <button key={service.id} type="button" className="service-card" onClick={() => void runService(service.id)}>
                <p>{service.type}</p>
                <strong>{service.name}</strong>
                <span>{service.blurb}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Thread snapshot</p>
            <span className="badge subtle">{threadSnapshot.type}</span>
          </div>
          <div className="conversation-preview">
            <strong>{threadSnapshot.name}</strong>
            <p>{lastMessage?.text || "No recent message."}</p>
            <div className="meta-line">
              <span>{threadSnapshot.lastActiveLabel}</span>
              <button type="button" className="ghost-button small" onClick={() => setActiveTab("chat")}>
                Open chat
              </button>
            </div>
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <article className="surface wallet-panel">
          <div className="surface-head">
            <p className="card-label">Payments wallet</p>
            <span className="badge subtle">{state.walletEvents.length} events</span>
          </div>
          <div className="wallet-header">
            <div>
              <strong className="wallet-balance">{`${walletBalance >= 0 ? "+" : "-"}$${Math.abs(walletBalance).toFixed(2)}`}</strong>
              <p className="panel-copy">
                Full ledger view with wallet actions and QR shortcuts baked into the home workspace.
              </p>
            </div>
            <div className="wallet-actions">
              {walletActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="wallet-action"
                  onClick={() => triggerWalletAction(action.id)}
                  disabled={busy}
                >
                  <span>{action.label}</span>
                  <small>{action.helper}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="wallet-history">
            {walletHistory.map((event) => (
              <div key={event.id} className="wallet-entry">
                <div>
                  <strong>{event.title}</strong>
                  <p>{event.meta}</p>
                </div>
                <span className={`wallet-amount ${event.amount?.trim().startsWith("-") ? "neg" : "pos"}`}>{event.amount}</span>
              </div>
            ))}
          </div>
          <div className="wallet-qr-grid">
            {state.qrActions.map((action) => (
              <button key={action.id} type="button" className="mini-tile" onClick={() => void runQrFlow(action.id)}>
                <strong>{action.title}</strong>
                <p>{action.detail}</p>
              </button>
            ))}
          </div>
        </article>

        <article className="surface utility-surface">
          <UtilityDock utilities={state.utilityCards} />
        </article>
      </section>

      <section className="surface-row wechat-component-row">
        <article className="surface simple-list-surface local-people-card">
          <div className="surface-head">
            <p className="card-label">People local to you</p>
            <span className="badge subtle">{memberZipCode ? peopleLocalBasis || `Based on your ZIP code ${memberZipCode}` : "ZIP needed"}</span>
          </div>
          <p className="surface-note">
            {memberZipCode
              ? "FoxHub filters nearby members against the ZIP code saved in your account settings."
              : "Add ZIP code to unlock local people from your member profile."}
          </p>
          <ul className="minimal-list">
            {memberZipCode && peopleLocalToYou.length ? peopleLocalToYou.map((person) => (
              <li key={person.id}>
                <strong>{person.name}</strong>
                <div className="row-meta-text">
                  {person.handle} · {person.zipCode || "local"} · {person.distance} · {person.presence} · {person.activity}
                </div>
                <div className="list-actions">
                  <button type="button" className="ghost-button small" onClick={() => openContactThread(person.contactId)}>
                    Message
                  </button>
                  <button
                    type="button"
                    className="ghost-button small"
                    onClick={() =>
                      logFileTransfer({
                        title: `Docs for ${person.name}`,
                        recipient: person.name,
                        status: "Shared",
                        meta: "People Nearby share"
                      })
                    }
                  >
                    Share file
                  </button>
                </div>
              </li>
            )) : (
              <li>
                <strong>{memberZipCode ? "No ZIP matches yet" : "Add ZIP code to unlock local people"}</strong>
                <div className="row-meta-text">
                  {memberZipCode ? "FoxHub will show members as your ZIP network fills in." : "Open Profile and add the ZIP code for your local area."}
                </div>
                <div className="list-actions">
                  <button type="button" className="ghost-button small" onClick={() => openProfilePanel?.()}>
                    Open profile settings
                  </button>
                </div>
              </li>
            )}
          </ul>
          <div className="shake-result-row">
            <strong>Shake matches</strong>
            <span>{state.shakeMatches.slice(0, 3).map((match) => match.name).join(", ") || "n/a"}</span>
          </div>
          <button type="button" className="ghost-button small wide" onClick={startShakeMatch}>
            Shake to match
          </button>
        </article>
        <article className="surface simple-list-surface">
          <div className="surface-head">
            <p className="card-label">Live Channels</p>
          </div>
          <ul className="minimal-list">
            {state.channelStreams.map((channel) => (
              <li key={channel.id}>
                <strong>{channel.title}</strong>
                <div className="row-meta-text">
                  Hosted by {channel.host} · {channel.viewers} viewers · {channel.status}
                </div>
                <button type="button" className="ghost-button small" onClick={() => void openLiveChannel(channel.id)}>
                  Tune in
                </button>
              </li>
            ))}
          </ul>
          <div className="shake-result-row">
            <strong>Recent transfers</strong>
            <span>
              {state.fileTransfers.slice(0, 3).map((entry) => `${entry.title} (${entry.status})`).join(" · ") || "none yet"}
            </span>
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel compliance-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Official hubs</p>
            <span className="badge subtle">{featuredAccounts.length} featured</span>
          </div>
          <div className="official-hub-grid">
            {featuredAccounts.map((account) => {
              const subscribed = state.officialAccountSubscriptions.includes(account.id);
              return (
                <div key={account.id} className="official-hub-card">
                  <div className="official-hub-top">
                    <span className="official-hub-mark" aria-hidden="true">{account.name.charAt(0)}</span>
                    <span className="badge subtle">{account.type}</span>
                  </div>
                  <strong>{account.name}</strong>
                  <p>{account.summary}</p>
                  <div className="inline-actions wrap">
                    <button type="button" className="ghost-button small" onClick={() => void openOfficialThread(account.id)}>
                      Open thread
                    </button>
                    <button type="button" className="ghost-button small" onClick={() => toggleOfficialAccountSubscription(account.id)}>
                      {subscribed ? "Following" : "Follow"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Official updates</p>
            <span className="badge subtle">{subscribedPosts.length} subscribed</span>
          </div>
          <div className="list-stack">
            {subscribedPosts.map((post) => (
              <button key={post.id} type="button" className="list-button" onClick={() => void openOfficialThread(post.accountId)}>
                <div>
                  <strong>{post.title}</strong>
                  <p>{post.summary}</p>
                </div>
                <div className="row-meta-text">{post.meta}</div>
              </button>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Saved for later</p>
            <span className="badge subtle">{state.savedItems.length} items</span>
          </div>
          <div className="list-stack">
            {state.savedItems.map((item) => (
              <button key={item.id} type="button" className="list-button" onClick={() => openSavedItem(item)}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <div className="row-meta-text">{item.meta}</div>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel compliance-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Suggested people</p>
            <span className="badge subtle">{suggestedContacts.length} strongest</span>
          </div>
          <div className="list-stack">
            {suggestedContacts.map((contact) => (
              <button key={contact.id} type="button" className="list-button" onClick={() => void openContactThread(contact.id)}>
                <div>
                  <strong>{contact.displayName || contact.name}</strong>
                  <p>{contact.handle} · {contact.city}</p>
                </div>
                <div className="row-meta-text">{contact.relationshipScore || contact.trust}</div>
              </button>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Subscriptions</p>
            <span className="badge subtle">{state.officialAccountSubscriptions.length} following</span>
          </div>
          <div className="list-stack">
            {state.officialAccounts.map((account) => {
              const subscribed = state.officialAccountSubscriptions.includes(account.id);
              return (
                <div key={account.id} className="list-row">
                  <div>
                    <strong>{account.name}</strong>
                    <p>{account.summary}</p>
                  </div>
                  <button type="button" className="ghost-button small" onClick={() => toggleOfficialAccountSubscription(account.id)}>
                    {subscribed ? "Following" : "Follow"}
                  </button>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      {!state.services.length && !state.savedItems.length && !state.officialPosts.length ? (
        <FilteredEmptyState label="Home" />
      ) : null}
      </details>
    </>
  );
}

export function UtilityDock({ utilities = [] }) {
  const [calcInput, setCalcInput] = useState("");
  const [calcResult, setCalcResult] = useState("0");
  const [calcError, setCalcError] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [notes, setNotes] = useState([]);
  const [scheduleDraft, setScheduleDraft] = useState({ title: "", when: "" });
  const [schedules, setSchedules] = useState([]);

  const evaluateExpression = (expression) => {
    const normalized = expression.replace(/\s+/g, "");
    if (!normalized || !/^[0-9.+\-*/()%]+$/.test(normalized)) {
      throw new Error("invalid");
    }

    const tokens = normalized.match(/\d*\.?\d+|[()+\-*/%]/g) || [];
    const output = [];
    const operators = [];
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };

    tokens.forEach((token, index) => {
      if (/^\d/.test(token)) {
        output.push(Number(token));
        return;
      }

      if (token === "(") {
        operators.push(token);
        return;
      }

      if (token === ")") {
        while (operators.length && operators[operators.length - 1] !== "(") {
          output.push(operators.pop());
        }
        if (!operators.length) throw new Error("invalid");
        operators.pop();
        return;
      }

      const previous = tokens[index - 1];
      if ((token === "-" || token === "+") && (!previous || ["(", "+", "-", "*", "/", "%"].includes(previous))) {
        output.push(0);
      }

      while (
        operators.length &&
        operators[operators.length - 1] !== "(" &&
        precedence[operators[operators.length - 1]] >= precedence[token]
      ) {
        output.push(operators.pop());
      }
      operators.push(token);
    });

    while (operators.length) {
      const next = operators.pop();
      if (next === "(") throw new Error("invalid");
      output.push(next);
    }

    const stack = [];
    output.forEach((token) => {
      if (typeof token === "number") {
        stack.push(token);
        return;
      }
      const right = stack.pop();
      const left = stack.pop();
      if (left === undefined || right === undefined) throw new Error("invalid");
      if ((token === "/" || token === "%") && right === 0) throw new Error("invalid");
      switch (token) {
        case "+":
          stack.push(left + right);
          break;
        case "-":
          stack.push(left - right);
          break;
        case "*":
          stack.push(left * right);
          break;
        case "/":
          stack.push(left / right);
          break;
        case "%":
          stack.push(left % right);
          break;
        default:
          throw new Error("invalid");
      }
    });

    if (stack.length !== 1 || !Number.isFinite(stack[0])) {
      throw new Error("invalid");
    }
    return stack[0];
  };

  const handleCalculate = () => {
    const expression = calcInput.replace(/[^0-9.+*/()% \\-]/g, "");
    if (!expression) {
      setCalcResult("0");
      setCalcError("Type a math expression");
      return;
    }
    try {
      const result = evaluateExpression(expression);
      setCalcResult(String(result));
      setCalcError("");
    } catch {
      setCalcResult("Err");
      setCalcError("Check the expression");
    }
  };

  const handleSaveNote = () => {
    if (!noteDraft.trim()) return;
    setNotes((current) => [
      { id: Date.now(), text: noteDraft.trim(), stamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) },
      ...current
    ].slice(0, 4));
    setNoteDraft("");
  };

  const handleScheduleSave = () => {
    if (!scheduleDraft.title.trim() || !scheduleDraft.when) return;
    setSchedules((current) => [
      {
        id: Date.now(),
        title: scheduleDraft.title.trim(),
        when: scheduleDraft.when
      },
      ...current
    ].slice(0, 4));
    setScheduleDraft({ title: "", when: "" });
  };

  return (
    <div className="utility-suite">
      <div className="surface-head">
        <p className="card-label">Utility dock</p>
        <span className="badge subtle">Calculator · Notes · Scheduler</span>
      </div>
      <p className="surface-note">
        Keep quick tools close while planning, budgeting, and logging gigs. These helpers stay synced in the workspace.
      </p>
      <div className="utility-chip-row">
        {utilities.slice(0, 5).map((utility) => (
          <span key={utility.id} className="utility-chip">
            {utility.name}
          </span>
        ))}
      </div>
      <div className="utility-grid">
        <div className="utility-card calculator-card">
          <p className="card-label">Calculator</p>
          <input
            type="text"
            placeholder="e.g., 120 + 42 / 2"
            value={calcInput}
            onChange={(event) => setCalcInput(event.target.value)}
          />
          <div className="calculator-results">
            <strong>{calcResult}</strong>
            <span>{calcError || "Ready to calculate"}</span>
          </div>
          <button type="button" className="accent-button wide" onClick={handleCalculate}>
            Calculate
          </button>
        </div>
        <div className="utility-card note-card">
          <p className="card-label">Notes</p>
          <textarea
            placeholder="Quick jot for reminders, hosts, or performers."
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
          />
          <button type="button" className="ghost-button wide" onClick={handleSaveNote}>
            Save note
          </button>
          <div className="utility-list">
            {notes.map((note) => (
              <div key={note.id} className="utility-list-item">
                <p>{note.text}</p>
                <span>{note.stamp}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="utility-card schedule-card">
          <p className="card-label">Scheduler</p>
          <input
            type="text"
            placeholder="Title"
            value={scheduleDraft.title}
            onChange={(event) => setScheduleDraft({ ...scheduleDraft, title: event.target.value })}
          />
          <input
            type="datetime-local"
            value={scheduleDraft.when}
            onChange={(event) => setScheduleDraft({ ...scheduleDraft, when: event.target.value })}
          />
          <button type="button" className="ghost-button wide" onClick={handleScheduleSave}>
            Schedule check-in
          </button>
          <div className="utility-list">
            {schedules.map((entry) => (
              <div key={entry.id} className="utility-list-item">
                <p>{entry.title}</p>
                <span>{new Date(entry.when).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
