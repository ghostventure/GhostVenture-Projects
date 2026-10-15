import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  foxhubMarketSignals,
  foxhubPlaces,
  foxhubProfessionalCards,
  merchantOpsSuite,
  compliancePrograms,
  merchantServiceComponents,
  foxhubExpansionComponents,
  miniProgramMechanics,
  trustSafetyIncidents,
  miniApps,
  blueCollarServiceCategories,
  whiteCollarServiceCategories,
  blackCollarServiceCategories,
  yellowCollarServiceCategories,
  greenCollarServiceCategories,
  pinkCollarServiceCategories,
  brownCollarServiceCategories,
  purpleCollarServiceCategories,
  weChatParityInstallPacks
} from "./data.js";
import {
  TRUST_TIER_ORDER,
  THEME_OPTIONS,
  canUseTheme,
  getContactTrustTier,
  getContextActions,
  getPinnedThreads,
  getAccountEmblem,
  getThemeToggleLabel,
  hasFoxHubManagementAccess,
  getTrustRestrictionLine,
  getTrustTierMeta,
  getOwnTrustTier,
  isFoxHubOwnerEmail,
  getVisibleCount,
  getVisibleThreads
} from "./rules.js";
import { staffImprovementPacks, staffImprovementRoadmap, staffImprovementSummary } from "./staffImprovementPacks/index.js";
import { footerBoilerplateGroups, footerQuickAccessLinks, getFooterItemHref } from "./footerBoilerplates.js";
import { IMAGE_UPLOAD_ACCEPT, prepareImageAttachment } from "./mediaUploads.js";
import FoxHeadMark from "./FoxHeadMark.jsx";

const MOMENT_REACTIONS = [
  { id: "like", emoji: "👍", label: "Like" },
  { id: "love", emoji: "❤️", label: "Love" },
  { id: "haha", emoji: "😂", label: "Haha" },
  { id: "wow", emoji: "😮", label: "Wow" },
  { id: "fire", emoji: "🔥", label: "Fire" },
  { id: "support", emoji: "🙌", label: "Support" },
  { id: "thanks", emoji: "🙏", label: "Thanks" },
  { id: "eyes", emoji: "👀", label: "Watching" }
];

function FoxHubShell({
  theme,
  toggleTheme,
  setTheme,
  activeTab,
  setActiveTab,
  state,
  currentView,
  selectedThread,
  activeCircle,
  activeMiniApp,
  busy,
  openProfilePanel,
  openPublicProfile,
  runService,
  selectThread,
  handleSendMessage,
  startDirectThread,
  selectCircle,
  handleWalletAction,
  blockUser,
  selectMiniApp,
  submitMoment,
  signOut,
  handleLaunchMiniApp,
  handleSaveCurrentContext,
  runQrFlow,
  toggleOfficialAccountSubscription,
  openOfficialThread,
  openContactThread,
  openSavedItem,
  runUtilityCard,
  openContinuityItem,
  openSearchScope,
  openLiveChannel,
  openCommunityChannel,
  createGroupConversation,
  reactToMoment,
  commentOnMoment,
  respondFriendRequest,
  listings,
  savedSearches,
  listingAlerts,
  listingCategories = [],
  listingTypes = [],
  listingTags = [],
  createListing,
  flagListing,
  saveListingSearch,
  rateContactTrust,
  startShakeMatch,
  logFileTransfer,
  resolveLocalListing,
  updateCreatorOrder,
  logDemandSignal,
  saveConnectorIntent,
  openConnectorSurface,
  connectConnector,
  testConnector,
  disconnectConnector,
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
  registerBrowserNotifications,
  saveRoutePlan,
  addEndorsement,
  addJobPost,
  registerMiniProgramManifest,
  startCallSession,
  reviewMemberApplication,
  addFoxHubStaffMember,
  activateGrowthCategory,
  runGrowthCategory,
  activateAllGrowthCategories,
  activateUxComponent,
  runUxComponent,
  activateProductionComponent,
  runProductionComponent,
  updateProfile,
  tutorialAssistant
}) {
  const [quickQuery, setQuickQuery] = useState("");
  const [density, setDensity] = useState("easy");
  const [fastNavOpen, setFastNavOpen] = useState(false);
  const [quickNavQuery, setQuickNavQuery] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnectNotice, setShowReconnectNotice] = useState(false);
  const [chatFilter, setChatFilter] = useState("all");
  const [foxBoardRoom, setFoxBoardRoom] = useState("pulse");
  const [startCity, setStartCity] = useState(state.profile?.city || "");
  const [startModeNotice, setStartModeNotice] = useState("");
  const [managementCredentialPrompt, setManagementCredentialPrompt] = useState(false);
  const [managementCredentialDraft, setManagementCredentialDraft] = useState({ email: "" });
  const [managementCredentialNotice, setManagementCredentialNotice] = useState("");
  const [managementUnlocked, setManagementUnlocked] = useState(false);
  const [isWindowsBrowser, setIsWindowsBrowser] = useState(() => isWindowsBrowserRuntime());
  const deferredQuery = useDeferredValue(quickQuery);
  const deferredNavQuery = useDeferredValue(quickNavQuery);
  const unreadCount = state.threads.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0);
  const query = deferredQuery.trim().toLowerCase();
  const accessState = state.profile.accessState || (state.authenticated ? "active" : "pending");
  const accessLabel =
    accessState === "waitlist"
      ? "Waiting"
      : accessState === "priority"
        ? "Priority"
        : state.authenticated
          ? "Active"
          : "Pending";
  const connectionLabel = state.backendMode === "firebase" ? "Live" : state.backendMode === "locked" ? "Locked" : "Preview";
  const glanceItems = [
    { label: "Social", value: state.threads.length, tone: "warm" },
    { label: "Rapport", value: state.contacts.length, tone: "cool" },
    { label: "Communal", value: state.circles.length, tone: "soft" },
    { label: "Services", value: state.services.length, tone: "cool" }
  ];
  const activeConnectorCount = state.apiConnectors.filter((item) => {
    const status = String(item.status || "").toLowerCase();
    return status.includes("active") || status.includes("live") || status.includes("connected");
  }).length;
  const accountEmblem = getAccountEmblem(state.profile || {});
  const hasManagementConsole = hasFoxHubManagementAccess(state.profile || {});
  const memberNavItems = [
    { id: "hub", label: "Home", glyph: "fox", meta: "rapport loop" },
    { id: "chat", label: "Social", glyph: "S", meta: unreadCount ? `${unreadCount} unread` : `${state.threads.length} threads` },
    { id: "circles", label: "Rapport", glyph: "R", meta: `${state.contacts.length} contacts` },
    { id: "growth", label: "Communal", glyph: "C", meta: `${state.growthCategories?.length || 0} paths` },
    { id: "discover", label: "Services / Merchant", glyph: "M", meta: `${state.miniAppRecents.length} recent` },
    { id: "market", label: "Needs & Offers", glyph: "N", meta: `${state.listings.length} listings` },
    { id: "wallet", label: "Pay", glyph: "$", meta: `${state.walletEvents.length} events` },
    { id: "experience", label: "UX / Goodies", glyph: "U", meta: `${state.uxComponents?.length || 0} perks` },
    { id: "staff", label: "Management", glyph: "M", meta: `${(state.userRecords || []).filter((item) => ["review", "pending"].includes(String(item.stage || item.identityState || "").toLowerCase())).length} reviews` },
    { id: "connectors", label: "Tools", glyph: "T", meta: `${activeConnectorCount} active` },
    { id: "blueprint", label: "Organizer", glyph: "O", meta: `${foxhubExpansionComponents.length} ways` }
  ].filter((item) => {
    if (item.id !== "staff") return true;
    return hasManagementConsole;
  });
  const staffNavItems = [
    { id: "staff", label: "Management", glyph: "M", meta: `${(state.userRecords || []).filter((item) => ["review", "pending"].includes(String(item.stage || item.identityState || "").toLowerCase())).length} reviews` },
    { id: "connectors", label: "Staff Tools", glyph: "T", meta: `${activeConnectorCount} active` },
    { id: "blueprint", label: "Control Library", glyph: "O", meta: `${foxhubExpansionComponents.filter((item) => item.category === "Operator And Admin" || item.category === "Compliance And Safety").length} controls` }
  ];
  const navItems = hasManagementConsole ? staffNavItems : memberNavItems;
  const staffWorkspaceTabIds = new Set(["staff", "connectors", "blueprint"]);
  const managementGateOpen = hasManagementConsole && activeTab === "staff" && managementUnlocked;
  const openWorkspaceTab = (tabId) => {
    if (hasManagementConsole && !staffWorkspaceTabIds.has(tabId)) {
      openWorkspaceTab("staff");
      return;
    }
    if (tabId === "staff" && hasManagementConsole) {
      if (!isWindowsBrowser) {
        setManagementCredentialNotice("Management requires a Windows browser session. Android and iOS browser sessions are blocked.");
        setManagementCredentialPrompt(true);
        return;
      }
      if (!managementUnlocked) {
        setManagementCredentialDraft({ email: state.profile?.email || "" });
        setManagementCredentialNotice("Use Windows Hello or a platform security key to open Management outside the page.");
        setManagementCredentialPrompt(true);
        return;
      }
    }
    setActiveTab(tabId);
  };
  const boilerplateGroups = footerBoilerplateGroups;

  const filtered = useMemo(() => buildFilteredState(state, query), [state, query]);
  const visibleCount = getVisibleCount(activeTab, filtered);
  const contextActions = getContextActions(activeTab);
  const sectionFeedItems = useMemo(
    () => buildSectionFeedItems(activeTab, filtered, currentView),
    [activeTab, filtered, currentView]
  );
  const quickNavCandidates = useMemo(
    () =>
      [...navItems, ...contextActions]
        .filter((item) => item.label.toLowerCase().includes(deferredNavQuery.trim().toLowerCase()))
        .slice(0, 8),
    [navItems, contextActions, deferredNavQuery]
  );
  const starterActions = [
    {
      id: "social",
      label: "Start Social",
      detail: unreadCount ? `${unreadCount} unread` : "Chats, moments, groups, and calls",
      run: () => setActiveTab("chat")
    },
    {
      id: "rapport",
      label: "Build Rapport",
      detail: `${state.contacts.length} contacts and trust signals`,
      run: () => setActiveTab("circles")
    },
    {
      id: "communal",
      label: "Open Communal",
      detail: "Circles, rooms, events, and local growth",
      run: () => setActiveTab("growth")
    },
    {
      id: "service",
      label: "Find Services",
      detail: "Merchants, mini-apps, bookings, and utilities",
      run: () => setActiveTab("discover")
    }
  ];

  const commandLogEntries = (state.auditEvents || []).slice(0, 4);
  const localCity = (startCity || state.profile?.city || "").trim();
  const localCityKey = localCity.toLowerCase();
  const localListings = localCityKey
    ? state.listings.filter((item) => String(item.city || item.neighborhood || "").toLowerCase().includes(localCityKey))
    : state.listings;
  const localPeople = localCityKey
    ? state.contacts.filter((item) => String(item.city || item.region || "").toLowerCase().includes(localCityKey))
    : state.contacts;
  const startNearMeActions = [
    { id: "social", label: "Talk to my people", detail: "Chats, groups, and moments", run: () => setActiveTab("chat") },
    { id: "rapport", label: "Check trusted people", detail: `${localPeople.length} people nearby`, run: () => setActiveTab("circles") },
    { id: "communal", label: "Enter my community", detail: "Local circles and rooms", run: () => setActiveTab("growth") },
    { id: "services", label: "Find trusted help", detail: "Services and useful tools", run: () => setActiveTab("discover") },
    { id: "market", label: "Post a need or offer", detail: `${localListings.length} local matches`, run: () => setActiveTab("market") },
    { id: "business", label: "Manage merchant tools", detail: "Payments, tools, and local reach", run: () => setActiveTab("connectors") }
  ];
  async function saveStartCity() {
    const nextCity = startCity.trim();
    if (!nextCity) {
      setStartModeNotice("Type your city first.");
      return;
    }
    try {
      if (updateProfile) {
        await updateProfile({ ...state.profile, city: nextCity });
      }
      trackAnalyticsEvent?.({ name: "start_near_me_city_saved", category: "onboarding", metadata: { city: nextCity } });
      setStartModeNotice(`${nextCity} is set. FoxHub will start closer to home.`);
    } catch (error) {
      setStartModeNotice(error instanceof Error ? error.message : "FoxHub could not save that city yet.");
    }
  }
  function useBrowserLocation() {
    if (!navigator.geolocation) {
      setStartModeNotice("This browser does not offer location sharing. Type your city instead.");
      return;
    }
    setStartModeNotice("Checking your location...");
    navigator.geolocation.getCurrentPosition(
      () => {
        trackAnalyticsEvent?.({ name: "start_near_me_location_allowed", category: "onboarding" });
        setStartModeNotice("Location is on. Type your city too, so FoxHub can name the local area.");
      },
      () => setStartModeNotice("Location stayed off. Type your city and FoxHub will still work."),
      { maximumAge: 300000, timeout: 8000 }
    );
  }
  const heroNarratives = [
    `${unreadCount} unread threads ready`,
    `${state.listings.length} marketplace listings live`,
    `${state.walletEvents.length} wallet events tracked`
  ];
  const foxBoardRooms = [
    { id: "pulse", label: "Command pulse", meta: `${glanceItems.length} signals` },
    { id: "actions", label: "Quick actions", meta: `${starterActions.length} actions` },
    { id: "log", label: "Dispatch log", meta: `${commandLogEntries.length} events` },
    { id: "session", label: "Session", meta: state.authenticated ? "Signed in" : "Guest" }
  ];

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setFastNavOpen(true);
      }
      if (event.key === "Escape") {
        setFastNavOpen(false);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    setIsWindowsBrowser(isWindowsBrowserRuntime());
  }, []);

  useEffect(() => {
    if (!hasManagementConsole || activeTab !== "staff" || managementUnlocked) return;
    if (!isWindowsBrowser) {
      setManagementCredentialNotice("Management requires a Windows browser session. Android and iOS browser sessions are blocked.");
      setManagementCredentialPrompt(true);
      return;
    }
    setManagementCredentialDraft({ email: state.profile?.email || "" });
    setManagementCredentialNotice("Use Windows Hello or a platform security key to open Management outside the page.");
    setManagementCredentialPrompt(true);
  }, [activeTab, hasManagementConsole, isWindowsBrowser, managementUnlocked, state.profile?.email]);

  async function submitManagementCredentials(event) {
    event.preventDefault();
    if (!isWindowsBrowser) {
      setManagementCredentialNotice("Management requires a Windows browser session. Android and iOS browser sessions are blocked.");
      return;
    }
    const expectedEmail = String(state.profile?.email || "").trim().toLowerCase();
    const enteredEmail = String(managementCredentialDraft.email || "").trim().toLowerCase();
    if (!enteredEmail || enteredEmail !== expectedEmail) {
      setManagementCredentialNotice("Enter the signed-in staff email for this Management session.");
      return;
    }
    if (!window.PublicKeyCredential || !navigator.credentials?.create) {
      setManagementCredentialNotice("This browser does not expose Windows Hello or platform security-key verification.");
      return;
    }
    try {
      setManagementCredentialNotice("Requesting a server challenge for Management.");
      const idToken = await getCurrentFirebaseIdToken();
      if (!idToken) {
        setManagementCredentialNotice("Management backend unavailable; using Windows Hello local gate until Functions deploy is live.");
        await runLocalWindowsHelloManagementCheck({
          expectedEmail,
          displayName: state.profile?.name || state.profile?.displayName || expectedEmail
        });
        setManagementUnlocked(true);
        setManagementCredentialPrompt(false);
        setManagementCredentialNotice("");
        setManagementCredentialDraft({ email: expectedEmail });
        setActiveTab("staff");
        return;
      }
      const platform = navigator.userAgentData?.platform || navigator.platform || "Windows";
      const challengeResponse = await fetch("/api/management/webauthn/challenge", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: enteredEmail,
          displayName: state.profile?.name || state.profile?.displayName || expectedEmail,
          platform,
          userAgent: navigator.userAgent || "",
          origin: window.location.origin
        })
      });
      const challengePayload = await challengeResponse.json().catch(() => ({}));
      if (!challengeResponse.ok || !challengePayload.ok) {
        const contentType = challengeResponse.headers.get("content-type") || "";
        if (!contentType.includes("application/json") || (!challengePayload.reason && !challengePayload.error)) {
          setManagementCredentialNotice("Management backend unavailable; using Windows Hello local gate until Functions deploy is live.");
          await runLocalWindowsHelloManagementCheck({
            expectedEmail,
            displayName: state.profile?.name || state.profile?.displayName || expectedEmail
          });
          setManagementUnlocked(true);
          setManagementCredentialPrompt(false);
          setManagementCredentialNotice("");
          setManagementCredentialDraft({ email: expectedEmail });
          setActiveTab("staff");
          return;
        }
        setManagementCredentialNotice(challengePayload.reason || challengePayload.error || "Management backend challenge is unavailable.");
        return;
      }
      setManagementCredentialNotice("Opening Windows Hello. Complete the OS prompt to continue.");
      const challenge = base64UrlToBytes(challengePayload.challenge);
      const userId = base64UrlToBytes(challengePayload.user?.id || "");
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: challengePayload.rpName || "FoxHub" },
          user: {
            id: userId,
            name: challengePayload.user?.name || expectedEmail,
            displayName: challengePayload.user?.displayName || state.profile?.name || state.profile?.displayName || expectedEmail
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
        setManagementCredentialNotice("Windows Hello did not return a verified response.");
        return;
      }
      setManagementCredentialNotice("Verifying Windows Hello response with the Management backend.");
      const verifyResponse = await fetch("/api/management/webauthn/verify", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          challengeId: challengePayload.challengeId,
          credential: credentialToServerPayload(credential)
        })
      });
      const verifyPayload = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok || !verifyPayload.ok) {
        setManagementCredentialNotice(verifyPayload.reason || verifyPayload.error || "Management backend verification failed.");
        return;
      }
      setManagementUnlocked(true);
      setManagementCredentialPrompt(false);
      setManagementCredentialNotice("");
      setManagementCredentialDraft({ email: expectedEmail });
      setActiveTab("staff");
    } catch (error) {
      setManagementCredentialNotice(error instanceof Error ? error.message : "Windows Hello verification was cancelled or blocked.");
    }
  }

  useEffect(() => {
    setStartCity(state.profile?.city || "");
  }, [state.profile?.city]);

  useEffect(() => {
    let reconnectTimer;
    const updateNetworkStatus = (event) => {
      const online = window.navigator.onLine;
      setIsOnline(online);
      setShowReconnectNotice(online && event?.type === "online");
      window.clearTimeout(reconnectTimer);
      if (online) reconnectTimer = window.setTimeout(() => setShowReconnectNotice(false), 4500);
    };
    updateNetworkStatus();
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);
    return () => {
      window.clearTimeout(reconnectTimer);
      window.removeEventListener("online", updateNetworkStatus);
      window.removeEventListener("offline", updateNetworkStatus);
    };
  }, []);

  return (
    <div className={`app-shell ${density === "compact" ? "compact-ui" : ""}`}>
      <header className="app-header">
        <button
          type="button"
          className="brand-line"
          onClick={() => openWorkspaceTab(hasManagementConsole ? "staff" : "hub")}
          aria-label={hasManagementConsole ? "Go to FoxHub Management" : "Go to FoxHub Home"}
        >
          <div className="brand-mark" aria-hidden="true">
            <FoxHeadMark className="fox-head-icon" />
          </div>
          <div>
            <p className="eyebrow">FoxHub</p>
            <strong className="header-title">{hasManagementConsole ? "Staff controls and review queues" : "Simple tools for everyday tasks"}</strong>
          </div>
        </button>
        <div className="header-actions">
          <span className={`account-emblem ${accountEmblem.type}`} title="Account access emblem">
            <span aria-hidden="true">{accountEmblem.initials}</span>
            <strong>{accountEmblem.label}</strong>
          </span>
          <button type="button" className="search-chip" onClick={() => openWorkspaceTab(hasManagementConsole ? "connectors" : "discover")}>
            {hasManagementConsole ? "Open staff tools and connectors" : "Find people, services, or payments"}
          </button>
          <button type="button" className="accent-button small" onClick={() => (hasManagementConsole ? openWorkspaceTab("staff") : runUxComponent?.("guided-create-button"))}>
            {hasManagementConsole ? "Review" : "Create"}
          </button>
          <button
            type="button"
            className="ghost-button small"
            onClick={() => setFastNavOpen(true)}
            aria-label="Open quick jump"
          >
            Menu (Ctrl+K)
          </button>
          <button type="button" className="ghost-button small theme-toggle" onClick={toggleTheme}>
            {getThemeToggleLabel(theme)}
          </button>
          <label className="theme-select-label">
            <span>Theme</span>
            <select className="theme-select" value={theme} onChange={(event) => setTheme?.(event.target.value)}>
              {THEME_OPTIONS.map((item) => {
                const locked = !canUseTheme(state.profile || {}, item.id);
                return (
                  <option key={item.id} value={item.id} disabled={locked}>
                    {locked ? `${item.label} (Locked)` : item.label}
                  </option>
                );
              })}
            </select>
          </label>
          <button type="button" className="ghost-button small" onClick={openProfilePanel} disabled={!state.authenticated}>
            Profile
          </button>
          {state.authenticated ? (
            <button type="button" className="ghost-button small" onClick={() => void signOut()} disabled={busy}>
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      {!isOnline || showReconnectNotice ? (
        <div className={`network-status-notice ${isOnline ? "is-online" : "is-offline"}`} role="status" aria-live="polite">
          {isOnline ? "Connection restored. FoxHub is syncing again." : "You’re offline. FoxHub will reconnect when your connection returns."}
        </div>
      ) : null}

      <div className={activeTab === "hub" ? "operations-layout hub-layout" : "operations-layout focused-layout"}>
        <aside className="desktop-rail command-column" aria-label="Workspace navigation">
          <div className="desktop-summary command-summary">
            <p className="card-label">Workspace</p>
            <span className={`account-emblem compact ${accountEmblem.type}`}>
              <span aria-hidden="true">{accountEmblem.initials}</span>
              <strong>{accountEmblem.label}</strong>
            </span>
            <strong>{state.authenticated ? state.profile.name || state.profile.handle : "Guest mode"}</strong>
            <p className="row-meta-text">
              {state.authenticated
                ? `${state.profile.handle} · ${state.profile.city || "City pending"}`
                : "Previewing the current product shell"}
            </p>
          </div>
          <nav className="desktop-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === activeTab ? "desktop-nav-item active" : "desktop-nav-item"}
                onClick={() => openWorkspaceTab(item.id)}
              >
                <div className="nav-item-head">
                  <span className="nav-glyph" aria-hidden="true">
                    {item.glyph === "fox" ? <FoxHeadMark className="fox-head-icon" /> : item.glyph}
                  </span>
                  <strong>{item.label}</strong>
                </div>
                <span>{item.meta}</span>
              </button>
            ))}
          </nav>
          {activeTab === "hub" ? (
            <section className="fox-room-picker" aria-label="Home rooms">
              <p className="card-label">Home rooms</p>
              <div className="fox-room-list">
                {foxBoardRooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    className={foxBoardRoom === room.id ? "fox-room-tab active" : "fox-room-tab"}
                    onClick={() => setFoxBoardRoom(room.id)}
                  >
                    <strong>{room.label}</strong>
                    <span>{room.meta}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </aside>

        {activeTab === "hub" ? (
          <section className="mission-panel">
            <section className="section-hero">
              <div>
                <p className="eyebrow">FoxHub</p>
                <h1>{currentView.title}</h1>
                <p className="section-copy">{currentView.description}</p>
              </div>
              <div className="hero-status">
                <div className="status-chip">
                  <span>Connection</span>
                  <strong>{connectionLabel}</strong>
                </div>
                <div className="status-chip">
                  <span>Identity</span>
                  <strong>{state.authenticated ? state.profile.handle : "Pending"}</strong>
                </div>
                <div className="status-chip">
                  <span>Access</span>
                  <strong>{state.profile.accessNote || (state.authenticated ? "Active" : "Pending")}</strong>
                </div>
              </div>
            </section>

            <div className="fox-home-board">
              <section className="start-near-me" aria-label="Start near me">
                <div className="start-near-copy">
                  <p className="eyebrow">Start Here</p>
                  <h2>What do you want to do today?</h2>
                  <p>Pick your city, then choose one simple next step. FoxHub will point you to people, services, posts, and tools that make sense nearby.</p>
                </div>
                <div className="start-location-card">
                  <div className="surface-head">
                    <p className="card-label">Where should FoxHub look first?</p>
                    <span className="badge subtle">{localCity || "City needed"}</span>
                  </div>
                  <div className="start-location-row">
                    <input
                      type="text"
                      value={startCity}
                      onChange={(event) => setStartCity(event.target.value)}
                      placeholder="Enter your city"
                      aria-label="Enter your city"
                    />
                    <button type="button" className="accent-button small" onClick={() => void saveStartCity()}>
                      Save city
                    </button>
                    <button type="button" className="ghost-button small" onClick={useBrowserLocation}>
                      Use my location
                    </button>
                  </div>
                  {startModeNotice ? <p className="surface-note">{startModeNotice}</p> : null}
                  <div className="start-local-strip" aria-label="Local preview">
                    <span><strong>{localPeople.length}</strong> people</span>
                    <span><strong>{state.circles.length}</strong> circles</span>
                    <span><strong>{localListings.length}</strong> needs</span>
                    <span><strong>{miniApps.length}</strong> tools</span>
                  </div>
                </div>
                <div className="start-choice-grid">
                  {startNearMeActions.map((action) => (
                    <button key={action.id} type="button" className="start-choice" onClick={action.run}>
                      <strong>{action.label}</strong>
                      <span>{action.detail}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="command-hero" aria-label="Workspace overview">
                <div className="hero-copy">
                  <p className="eyebrow">Today</p>
                  <h2>Start with people, then move through trust.</h2>
                  <p>Social, rapport, communal spaces, and trusted service actions stay in that order so FoxHub feels like a relationship network first.</p>
                  <div className="hero-cta-row">
                    <button type="button" className="accent-button" onClick={() => setActiveTab("chat")}>Open Social</button>
                    <button type="button" className="ghost-button small" onClick={() => setActiveTab("circles")}>Open Rapport</button>
                  </div>
                </div>
                <div className="hero-metrics">
                  {glanceItems.map((item) => (
                    <div key={item.label} className="hero-metric">
                      <span>{item.label}</span>
                      <strong>{String(item.value).padStart(2, "0")}</strong>
                      <p className="hero-metric-note">{item.tone} signal</p>
                    </div>
                  ))}
                  <div className="hero-narratives">
                    {heroNarratives.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </div>
                </div>
              </section>

              <section className="dashboard-grid fox-board-room-content" aria-label="Home room content">
                {foxBoardRoom === "pulse" ? (
                <article className="surface">
                  <div className="surface-head">
                    <p className="card-label">Command pulse</p>
                    <span className="badge subtle">Realtime</span>
                  </div>
                  <div className="command-status-grid room-grid">
                    {glanceItems.map((item) => (
                      <div key={item.label} className={`glance-card ${item.tone}`}>
                        <span>{item.label}</span>
                        <strong>{String(item.value).padStart(2, "0")}</strong>
                        <span className="row-meta-text">{item.tone} signal</span>
                      </div>
                    ))}
                  </div>
                </article>
                ) : null}

                {foxBoardRoom === "actions" ? (
                <article className="mission-card surface">
                  <div className="surface-head">
                    <p className="card-label">Quick actions</p>
                    <span className="badge subtle">Primary</span>
                  </div>
                  <div className="mission-grid">
                    {starterActions.map((action) => (
                      <div key={action.id} className="mission-row">
                        <strong>{action.label}</strong>
                        <p>{action.detail}</p>
                        <button type="button" className="ghost-button small" onClick={action.run}>Open</button>
                      </div>
                    ))}
                  </div>
                </article>
                ) : null}

                {foxBoardRoom === "session" ? (
                <article className="intel-card surface">
                  <div className="surface-head">
                    <p className="card-label">Session</p>
                    <span className="badge subtle">{state.authenticated ? "Signed in" : "Pending"}</span>
                  </div>
                  <div className="desktop-profile-grid room-session-grid">
                    <div>
                      <span>Connection</span>
                      <strong>{connectionLabel}</strong>
                    </div>
                    <div>
                      <span>Access</span>
                      <strong>{state.profile.accessNote || (state.authenticated ? "Active" : "Pending")}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>{state.authenticated ? "Signed in" : "Pending"}</strong>
                    </div>
                    <div>
                      <span>City</span>
                      <strong>{state.profile.city || "Pending"}</strong>
                    </div>
                  </div>
                </article>
                ) : null}

                {foxBoardRoom === "log" ? (
                <article className="signal-card surface">
                  <div className="surface-head">
                    <p className="card-label">Dispatch log</p>
                    <span className="badge subtle">{commandLogEntries.length} events</span>
                  </div>
                  <div className="log-stack">
                    {commandLogEntries.length ? (
                      commandLogEntries.map((entry, index) => (
                        <div key={entry.id || entry.action || index} className="log-row">
                          <div>
                            <strong>{entry.action || entry.type || "Operational event"}</strong>
                            <p>{entry.detail || entry.note || entry.meta || entry.channel || "Event recorded"}</p>
                          </div>
                          <span className="row-meta-text">{formatAuditDate(entry.createdAt || entry.at || entry.timestamp)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="surface-note">No recent dispatches.</p>
                    )}
                  </div>
                </article>
                ) : null}
              </section>
            </div>
          </section>
        ) : null}
        <section className="tactical-panel">
          <section className="workspace-toolbar" aria-label="View controls">
            <div className="toolbar-search-wrap">
              <input
                type="search"
                className="toolbar-search"
                value={quickQuery}
                onChange={(event) => setQuickQuery(event.target.value)}
                placeholder="Search this page"
              />
              <div className="toolbar-context">
                <span>{currentView.title}</span>
                <strong>{visibleCount} results</strong>
              </div>
            </div>
            <div className="toolbar-actions">
              <button
                type="button"
                className={density === "easy" ? "ghost-button small active-soft" : "ghost-button small"}
                onClick={() => setDensity("easy")}
              >
                Easy View
              </button>
              <button
                type="button"
                className={density === "compact" ? "ghost-button small active-soft" : "ghost-button small"}
                onClick={() => setDensity("compact")}
              >
                Dense View
              </button>
            </div>
          </section>

          {activeTab === "hub" ? (
          <section className="context-rail" aria-label="Quick navigation">
            <div className="context-note">
              <p className="card-label">Next step shortcuts</p>
              <span>Tap one action instead of searching around.</span>
            </div>
            <div className="context-chip-row">
              {contextActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={action.id === activeTab ? "context-chip active" : "context-chip"}
                  onClick={() => setActiveTab(action.id)}
                >
                  <strong>{action.label}</strong>
                  <span>{action.meta}</span>
                </button>
              ))}
            </div>
          </section>
          ) : null}

          <section className="content-stack">
            {activeTab !== "hub" ? (
              <SectionFeed
                activeTab={activeTab}
                currentView={currentView}
                items={sectionFeedItems}
                busy={busy}
                setActiveTab={setActiveTab}
                selectThread={selectThread}
                startDirectThread={startDirectThread}
                openPublicProfile={openPublicProfile}
              />
            ) : null}

            {activeTab === "hub" ? (
              <>
              {tutorialAssistant}
              <MemberAccountControls
                state={filtered}
                busy={busy}
                openProfilePanel={openProfilePanel}
                setActiveTab={setActiveTab}
                respondFriendRequest={respondFriendRequest}
                markNotificationRead={markNotificationRead}
                revokeDeviceSession={revokeDeviceSession}
                openDisputeCase={openDisputeCase}
                reportTrustSafetyIncident={reportTrustSafetyIncident}
                registerBrowserNotifications={registerBrowserNotifications}
              />
              <HomeWorkspace
                state={filtered}
                activeMiniApp={activeMiniApp}
                selectedThread={selectedThread}
                runService={runService}
                runQrFlow={runQrFlow}
                setActiveTab={setActiveTab}
                openProfilePanel={openProfilePanel}
                toggleOfficialAccountSubscription={toggleOfficialAccountSubscription}
                openOfficialThread={openOfficialThread}
                openContactThread={openContactThread}
                openPublicProfile={openPublicProfile}
                openSavedItem={openSavedItem}
                handleWalletAction={handleWalletAction}
                reactToMoment={reactToMoment}
                commentOnMoment={commentOnMoment}
                startShakeMatch={startShakeMatch}
                logFileTransfer={logFileTransfer}
                openLiveChannel={openLiveChannel}
                openCommunityChannel={openCommunityChannel}
                resolveLocalListing={resolveLocalListing}
                updateCreatorOrder={updateCreatorOrder}
                logDemandSignal={logDemandSignal}
                runUnifiedSearch={runUnifiedSearch}
                runUnifiedAction={runUnifiedAction}
                recalculateTrustEngine={recalculateTrustEngine}
                createEscrowContract={createEscrowContract}
                releaseEscrowMilestone={releaseEscrowMilestone}
                openEscrowDispute={openEscrowDispute}
                rebuildReputationGraph={rebuildReputationGraph}
                runSmartMatchmaking={runSmartMatchmaking}
                runOperatorCopilot={runOperatorCopilot}
                setNotificationPolicy={setNotificationPolicy}
                buildNotificationDigest={buildNotificationDigest}
                createConversionFunnel={createConversionFunnel}
                registerMiniAppRuntime={registerMiniAppRuntime}
                invokeMiniAppRuntimeEvent={invokeMiniAppRuntimeEvent}
                queueReliableMutation={queueReliableMutation}
                flushReliableQueue={flushReliableQueue}
                trackAnalyticsEvent={trackAnalyticsEvent}
                setFeatureFlag={setFeatureFlag}
                assignExperimentVariant={assignExperimentVariant}
                evaluateWalletRisk={evaluateWalletRisk}
                busy={busy}
                boilerplateGroups={boilerplateGroups}
              />
              </>
            ) : null}

            {activeTab === "chat" ? (
              <ChatWorkspace
                state={filtered}
                selectedThread={selectedThread}
                chatFilter={chatFilter}
                setChatFilter={setChatFilter}
                busy={busy}
                selectThread={selectThread}
                handleSendMessage={handleSendMessage}
                handleSaveCurrentContext={handleSaveCurrentContext}
                startDirectThread={startDirectThread}
                setActiveTab={setActiveTab}
                handleWalletAction={handleWalletAction}
                blockUser={blockUser}
                startCallSession={startCallSession}
              />
            ) : null}

            {activeTab === "circles" ? (
              <NetworkWorkspace
                state={filtered}
                activeCircle={activeCircle}
                selectCircle={selectCircle}
                submitMoment={submitMoment}
                busy={busy}
                startDirectThread={startDirectThread}
                openPublicProfile={openPublicProfile}
                selectThread={selectThread}
                setActiveTab={setActiveTab}
                toggleOfficialAccountSubscription={toggleOfficialAccountSubscription}
                rateContactTrust={rateContactTrust}
                resolveLocalListing={resolveLocalListing}
                updateCreatorOrder={updateCreatorOrder}
                logDemandSignal={logDemandSignal}
                openCommunityChannel={openCommunityChannel}
                createGroupConversation={createGroupConversation}
                reactToMoment={reactToMoment}
                commentOnMoment={commentOnMoment}
                respondFriendRequest={respondFriendRequest}
                addEndorsement={addEndorsement}
                addJobPost={addJobPost}
                publishMediaClip={publishMediaClip}
                publishStoryBundle={publishStoryBundle}
                moderateRatingRecord={moderateRatingRecord}
              />
            ) : null}

            {activeTab === "market" ? (
              <MarketWorkspace
                state={filtered}
                listings={listings}
                savedSearches={savedSearches}
                listingAlerts={listingAlerts}
                listingCategories={listingCategories}
                listingTypes={listingTypes}
                listingTags={listingTags}
                createListing={createListing}
                flagListing={flagListing}
                saveListingSearch={saveListingSearch}
                startDirectThread={startDirectThread}
                openPublicProfile={openPublicProfile}
                busy={busy}
                placeAuctionBid={placeAuctionBid}
                upsertCart={upsertCart}
                addShopReview={addShopReview}
                moderateRatingRecord={moderateRatingRecord}
              />
            ) : null}

            {activeTab === "wallet" ? (
              <PayWorkspace
                state={filtered}
                busy={busy}
                handleWalletAction={handleWalletAction}
                runQrFlow={runQrFlow}
                runUtilityCard={runUtilityCard}
                selectedThread={selectedThread}
              />
            ) : null}

            {activeTab === "discover" ? (
              <ServicesWorkspace
                state={filtered}
                activeMiniApp={activeMiniApp}
                selectedThread={selectedThread}
                activeCircle={activeCircle}
                busy={busy}
                runService={runService}
                selectMiniApp={selectMiniApp}
                handleLaunchMiniApp={handleLaunchMiniApp}
                runQrFlow={runQrFlow}
                toggleOfficialAccountSubscription={toggleOfficialAccountSubscription}
                openOfficialThread={openOfficialThread}
                openContinuityItem={openContinuityItem}
                openSearchScope={openSearchScope}
                boilerplateGroups={boilerplateGroups}
                saveRoutePlan={saveRoutePlan}
                registerMiniProgramManifest={registerMiniProgramManifest}
                uploadDocumentEvidence={uploadDocumentEvidence}
                submitVerificationCase={submitVerificationCase}
                resolveVerificationCase={resolveVerificationCase}
                updateComplianceControl={updateComplianceControl}
                reportTrustSafetyIncident={reportTrustSafetyIncident}
                runMerchantRiskCheck={runMerchantRiskCheck}
                submitMerchantApplication={submitMerchantApplication}
                upsertMerchantInventoryItem={upsertMerchantInventoryItem}
                updateMerchantStorefrontSettings={updateMerchantStorefrontSettings}
                updateMerchantOnboarding={updateMerchantOnboarding}
                reviewMerchantSettlement={reviewMerchantSettlement}
                updateMerchantPayoutControl={updateMerchantPayoutControl}
                updateMerchantLocationStatus={updateMerchantLocationStatus}
                openDisputeCase={openDisputeCase}
                resolveDisputeCase={resolveDisputeCase}
                markNotificationRead={markNotificationRead}
                revokeDeviceSession={revokeDeviceSession}
                registerBrowserNotifications={registerBrowserNotifications}
                registerMiniAppRuntime={registerMiniAppRuntime}
                invokeMiniAppRuntimeEvent={invokeMiniAppRuntimeEvent}
                queueReliableMutation={queueReliableMutation}
                activateProductionComponent={activateProductionComponent}
                runProductionComponent={runProductionComponent}
              />
            ) : null}

            {activeTab === "experience" ? (
              <ExperienceWorkspace
                state={filtered}
                setActiveTab={setActiveTab}
                openProfilePanel={openProfilePanel}
                runUnifiedSearch={runUnifiedSearch}
                runUnifiedAction={runUnifiedAction}
                activateUxComponent={activateUxComponent}
                runUxComponent={runUxComponent}
                registerBrowserNotifications={registerBrowserNotifications}
                selectThread={selectThread}
                handleWalletAction={handleWalletAction}
                openSearchScope={openSearchScope}
                activeMiniApp={activeMiniApp}
                busy={busy}
              />
            ) : null}

            {activeTab === "growth" ? (
              <GrowthWorkspace
                state={filtered}
                busy={busy}
                setActiveTab={setActiveTab}
                activateGrowthCategory={activateGrowthCategory}
                runGrowthCategory={runGrowthCategory}
                activateAllGrowthCategories={activateAllGrowthCategories}
              />
            ) : null}

            {activeTab === "staff" && managementGateOpen ? (
              <ManagementWorkspace
                state={filtered}
                busy={busy}
                setActiveTab={openWorkspaceTab}
                startDirectThread={startDirectThread}
                resolveVerificationCase={resolveVerificationCase}
                resolveLocalListing={resolveLocalListing}
                moderateRatingRecord={moderateRatingRecord}
                reviewMemberApplication={reviewMemberApplication}
                addFoxHubStaffMember={addFoxHubStaffMember}
                runOperatorCopilot={runOperatorCopilot}
                recalculateTrustEngine={recalculateTrustEngine}
                buildNotificationDigest={buildNotificationDigest}
                setNotificationPolicy={setNotificationPolicy}
                runMerchantRiskCheck={runMerchantRiskCheck}
                updateComplianceControl={updateComplianceControl}
                reviewMerchantSettlement={reviewMerchantSettlement}
                reportTrustSafetyIncident={reportTrustSafetyIncident}
                openDisputeCase={openDisputeCase}
                resolveDisputeCase={resolveDisputeCase}
                markNotificationRead={markNotificationRead}
                revokeDeviceSession={revokeDeviceSession}
                evaluateWalletRisk={evaluateWalletRisk}
              />
            ) : null}

            {activeTab === "staff" && hasManagementConsole && !managementGateOpen ? (
              <section className="surface-row">
                <article className="surface management-gate-card">
                  <div className="surface-head">
                    <p className="card-label">Management locked</p>
                    <span className="badge subtle">Windows browser required</span>
                  </div>
                  <p className="surface-note">
                    Management opens only after staff credentials are entered from a Windows browser session. Android and iOS browser sessions are blocked.
                  </p>
                  <div className="inline-actions wrap">
                    <button type="button" className="accent-button" onClick={() => openWorkspaceTab("staff")}>
                      Enter Management credentials
                    </button>
                    <button type="button" className="ghost-button small" onClick={() => openWorkspaceTab("connectors")}>
                      Open Staff Tools
                    </button>
                  </div>
                </article>
              </section>
            ) : null}

            {activeTab === "connectors" ? (
              <ConnectorsWorkspace
                state={filtered}
                saveConnectorIntent={saveConnectorIntent}
                openConnectorSurface={openConnectorSurface}
                connectConnector={connectConnector}
                testConnector={testConnector}
                disconnectConnector={disconnectConnector}
                prepareStripeConnector={prepareStripeConnector}
              />
            ) : null}

            {activeTab === "blueprint" ? (
              <BlueprintWorkspace
                components={foxhubExpansionComponents}
                state={filtered}
                setActiveTab={setActiveTab}
                openProfilePanel={openProfilePanel}
                runUnifiedSearch={runUnifiedSearch}
                recalculateTrustEngine={recalculateTrustEngine}
                rebuildReputationGraph={rebuildReputationGraph}
                runSmartMatchmaking={runSmartMatchmaking}
                runOperatorCopilot={runOperatorCopilot}
                createConversionFunnel={createConversionFunnel}
                registerMiniAppRuntime={registerMiniAppRuntime}
                queueReliableMutation={queueReliableMutation}
                trackAnalyticsEvent={trackAnalyticsEvent}
                setFeatureFlag={setFeatureFlag}
                evaluateWalletRisk={evaluateWalletRisk}
                runMerchantRiskCheck={runMerchantRiskCheck}
                updateComplianceControl={updateComplianceControl}
              />
            ) : null}
          </section>
        </section>
      </div>

      <AppFooter boilerplateGroups={boilerplateGroups} />

      {managementCredentialPrompt ? (
        <div className="overlay management-credential-overlay" role="dialog" aria-modal="true" aria-label="Management credentials">
          <form className="profile-modal management-credential-modal" onSubmit={submitManagementCredentials}>
            <div className="panel-head">
              <div>
                <p className="card-label">Management credentials</p>
                <strong>Windows Hello staff check</strong>
              </div>
              <button
                type="button"
                className="ghost-button small"
                onClick={() => {
                  setManagementCredentialPrompt(false);
                  setManagementCredentialDraft((current) => ({ ...current }));
                }}
              >
                Close
              </button>
            </div>
            <p className="surface-note">
              This Management button opens only from a Windows browser and uses an OS-level Windows Hello or platform security-key prompt outside the page. Android and iOS browser sessions stay blocked from the staff dashboard.
            </p>
            {managementCredentialNotice ? <p className={isWindowsBrowser ? "panel-copy" : "error-text"}>{managementCredentialNotice}</p> : null}
            <label>
              Staff email
              <input
                type="email"
                autoComplete="username"
                value={managementCredentialDraft.email}
                onChange={(event) => setManagementCredentialDraft((current) => ({ ...current, email: event.target.value }))}
                placeholder="staff@foxhub.app"
                disabled={!isWindowsBrowser}
              />
            </label>
            <div className="inline-actions wrap">
              <button type="submit" className="accent-button" disabled={!isWindowsBrowser}>
                Verify with Windows Hello
              </button>
              <button
                type="button"
                className="ghost-button small"
                onClick={() => {
                  setManagementCredentialPrompt(false);
                  openWorkspaceTab("connectors");
                }}
              >
                Staff Tools instead
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <nav className="bottom-nav" aria-label="Primary">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === activeTab ? "bottom-nav-item active" : "bottom-nav-item"}
            onClick={() => openWorkspaceTab(item.id)}
          >
            <em className="nav-glyph mobile" aria-hidden="true">
              {item.glyph === "fox" ? <FoxHeadMark className="fox-head-icon" /> : item.glyph}
            </em>
            <strong>{item.label}</strong>
            <span>{item.meta}</span>
          </button>
        ))}
        {state.authenticated ? (
          <button type="button" className="bottom-nav-item utility" onClick={() => void signOut()} disabled={busy}>
            <strong>Exit</strong>
            <span>Sign out</span>
          </button>
        ) : null}
      </nav>

      {fastNavOpen ? (
        <div className="quick-nav-overlay" role="dialog" aria-modal="true" aria-label="Quick navigation">
          <div className="quick-nav-panel">
            <div className="quick-nav-head">
              <h3>Quick Menu</h3>
              <button type="button" className="ghost-button small" onClick={() => setFastNavOpen(false)}>
                Close
              </button>
            </div>
            <input
              type="search"
              className="quick-nav-search"
              value={quickNavQuery}
              onChange={(event) => setQuickNavQuery(event.target.value)}
              placeholder="Type to find an area"
            />
        <div className="quick-nav-list">
              {(state.uxComponents || []).slice(0, 20).map((component) => (
                <button
                  key={component.key}
                  type="button"
                  className="quick-nav-item"
                  onClick={() => {
                    runUxComponent?.(component.key);
                    setActiveTab("experience");
                    setFastNavOpen(false);
                  }}
                >
                  <strong>{String(component.order).padStart(2, "0")}. {component.name}</strong>
                  <span>{component.surface}</span>
                </button>
              ))}
              {quickNavCandidates.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="quick-nav-item"
                  onClick={() => {
                    openWorkspaceTab(item.id);
                    setFastNavOpen(false);
                  }}
                >
                  <strong>{item.label}</strong>
                  <span>{item.meta}</span>
                </button>
              ))}
              {quickNavCandidates.length === 0 ? <p className="panel-copy">No matches yet.</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isWindowsBrowserRuntime() {
  if (typeof navigator === "undefined") return false;
  const userAgentDataPlatform = navigator.userAgentData?.platform || "";
  const platform = userAgentDataPlatform || navigator.platform || "";
  const userAgent = navigator.userAgent || "";
  return /win/i.test(`${platform} ${userAgent}`);
}

function bytesToBase64Url(bytes) {
  const binary = Array.from(new Uint8Array(bytes))
    .map((byte) => String.fromCharCode(byte))
    .join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value = "") {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function credentialToServerPayload(credential) {
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

async function runLocalWindowsHelloManagementCheck({ expectedEmail = "", displayName = "" } = {}) {
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

async function getCurrentFirebaseIdToken() {
  const { auth } = await import("./firebase.js");
  const user = auth?.currentUser;
  return user ? user.getIdToken() : "";
}

function buildFilteredState(state, query) {
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

function trustTierBadgeClass(tier) {
  if (tier === "AA" || tier === "A") return "badge";
  if (tier === "B" || tier === "C") return "badge review";
  return "badge block";
}

function verificationBadgeModel(level = "") {
  const normalized = String(level || "").toLowerCase();
  if (normalized.includes("verified")) {
    return { className: "verification-badge verified", label: "VERIFIED USER" };
  }
  if (normalized.includes("pending") || normalized.includes("review")) {
    return { className: "verification-badge review", label: "VERIFICATION REVIEW" };
  }
  return { className: "verification-badge unverified", label: "UNVERIFIED" };
}

function PatternLibrary({ cards = [] }) {
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

function MarketplaceInfluencePanel({ selectedListing, startDirectThread, busy }) {
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

function DiscoveryInfluencePanel({ openSearchScope }) {
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

function ServiceCategoryPanel({ title, detail, categories, mode = "user", activeCategoryId, setActiveCategoryId, runService }) {
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

function normalizeFeedText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function buildSectionFeedItems(activeTab, state, currentView = {}) {
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

function SectionFeed({ activeTab, currentView, items, busy, setActiveTab, selectThread, startDirectThread, openPublicProfile }) {
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

function HomeWorkspace({
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
      <section className="rapport-hero" aria-label="Community rapport network">
        <div className="rapport-hero-copy">
          <p className="eyebrow">Community Rapport Network</p>
          <h2>People first. Trust next. Communities become the market.</h2>
          <p>
            FoxHub is organized around the relationship path: social connection, rapport, communal belonging, then useful services and merchants that orbit those bonds.
          </p>
          <div className="inline-actions wrap">
            <button type="button" className="accent-button" onClick={() => setActiveTab("circles")}>
              Open rapport graph
            </button>
            <button type="button" className="ghost-button small" onClick={() => setActiveTab("market")}>
              View trusted needs
            </button>
            <a className="ghost-button small" href="/comparison">
              Compare FoxHub
            </a>
          </div>
        </div>
        <div className="rapport-signal-grid">
          {rapportSignals.map((signal) => (
            <div key={signal.label} className="rapport-signal-card">
              <span>{signal.label}</span>
              <strong>{signal.value}</strong>
              <p>{signal.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rapport-flow-grid" aria-label="FoxHub relationship order">
        {rapportFlow.map((item, index) => (
          <article key={item.id} className="rapport-flow-card">
            <div className="rapport-flow-step">{index + 1}</div>
            <div>
              <div className="surface-head compact-head">
                <p className="card-label">{item.label}</p>
                <span className="badge subtle">{item.metric}</span>
              </div>
              <p>{item.detail}</p>
              <button type="button" className="ghost-button small" onClick={item.action}>
                Open
              </button>
            </div>
          </article>
        ))}
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
    </>
  );
}

function UtilityDock({ utilities = [] }) {
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

function MemberAccountControls({
  state,
  busy,
  openProfilePanel,
  setActiveTab,
  respondFriendRequest,
  markNotificationRead,
  revokeDeviceSession,
  openDisputeCase,
  reportTrustSafetyIncident,
  registerBrowserNotifications
}) {
  const profile = state.profile || {};
  const friendRequests = (state.friendRequests || []).slice(0, 4);
  const trustedContacts = (state.contacts || []).slice(0, 4);
  const deviceSessions = (state.deviceSessions || []).slice(0, 4);
  const unreadNotifications = (state.notificationEvents || []).filter((item) => item.status !== "read").slice(0, 4);
  const supportTarget = profile.handle || profile.email || "member";
  const complaintControls = COMPLAINT_ZERO_CONTROLS;

  function openMemberDispute() {
    openDisputeCase?.({
      merchantName: profile.name || profile.handle || "Member support",
      merchantId: supportTarget,
      amount: "$0.00",
      reason: "member_support_request",
      owner: "Member Support",
      detail: "Member opened an account, connection, payment, or service support request from Account Controls."
    });
  }

  function reportSecurityConcern() {
    reportTrustSafetyIncident?.({
      type: "member_security_concern",
      severity: "medium",
      channel: "account_controls",
      owner: "Trust Support",
      contactId: supportTarget,
      detail: "Member reported a security, fraud, impersonation, harassment, or account-access concern from Account Controls."
    });
  }

  function runComplaintControl(control) {
    if (control.id === "feed-control") {
      setActiveTab("hub");
      return;
    }
    if (control.id === "commercial-boundaries") {
      setActiveTab("market");
      return;
    }
    if (control.id === "privacy-account-control") {
      openProfilePanel?.();
      return;
    }
    if (control.id === "attention-notifications") {
      registerBrowserNotifications?.();
      return;
    }
    if (control.id === "support-disputes") {
      openMemberDispute();
      return;
    }
    if (control.id === "safety-moderation" || control.id === "trust-anti-spam") {
      reportTrustSafetyIncident?.({
        type: control.id === "trust-anti-spam" ? "spam_or_scam_report" : "member_safety_report",
        severity: control.id === "trust-anti-spam" ? "high" : "medium",
        channel: "complaint_zero_controls",
        owner: control.id === "trust-anti-spam" ? "Fraud Support" : "Trust Support",
        contactId: supportTarget,
        detail: `Member used ${control.label} for ${control.detail}`
      });
      return;
    }
    openDisputeCase?.({
      merchantName: profile.name || profile.handle || "Member feedback",
      merchantId: supportTarget,
      amount: "$0.00",
      reason: control.id,
      owner: "Product Support",
      detail: `Member submitted ${control.label}: ${control.detail}`
    });
  }

  return (
    <>
    <section className="surface-row member-control-center">
      <article className="surface surface-strong">
        <div className="surface-head">
          <p className="card-label">Account controls</p>
          <span className="badge subtle">Member self-service</span>
        </div>
        <h2>Manage your profile, security, connections, and support.</h2>
        <p className="surface-note">
          These controls are for the signed-in member. They do not expose staff review tools, but they let members manage the parts of FoxHub that belong to them.
        </p>
        <div className="member-control-grid">
          <button type="button" className="member-control-card" onClick={openProfilePanel} disabled={busy}>
            <strong>Profile and account settings</strong>
            <span>Edit your public OneID card, handle, city, links, interests, and profile memory.</span>
          </button>
          <button type="button" className="member-control-card" onClick={() => setActiveTab("circles")} disabled={busy}>
            <strong>Connection permissions</strong>
            <span>Review who wants to connect, accept trusted people, or ignore requests.</span>
          </button>
          <button type="button" className="member-control-card" onClick={() => setActiveTab("chat")} disabled={busy}>
            <strong>Messages and blocks</strong>
            <span>Open conversations, save context, or block a selected direct contact with a reason.</span>
          </button>
          <button type="button" className="member-control-card" onClick={() => registerBrowserNotifications?.()} disabled={busy}>
            <strong>Notification settings</strong>
            <span>Enable browser alerts for account, security, wallet, and support updates.</span>
          </button>
          <button type="button" className="member-control-card" onClick={openMemberDispute} disabled={busy}>
            <strong>Support or dispute help</strong>
            <span>Open a member support request for account, payment, service, or marketplace trouble.</span>
          </button>
          <button type="button" className="member-control-card" onClick={reportSecurityConcern} disabled={busy}>
            <strong>Report security concern</strong>
            <span>Send fraud, impersonation, harassment, or account-access concerns to Trust Support.</span>
          </button>
        </div>
      </article>

      <article className="surface">
        <div className="surface-head">
          <p className="card-label">Connection requests</p>
          <span className="badge subtle">{friendRequests.length} pending</span>
        </div>
        <div className="list-stack">
          {friendRequests.map((request) => (
            <div key={request.id} className="list-row compact-row">
              <div>
                <strong>{request.name}</strong>
                <p>{request.handle} · {request.city || "Unknown city"} · {request.mutualCount || 0} mutual</p>
              </div>
              <div className="inline-actions wrap">
                <button type="button" className="ghost-button small" onClick={() => respondFriendRequest?.(request.id, "accept")} disabled={busy}>
                  Accept
                </button>
                <button type="button" className="ghost-button small" onClick={() => respondFriendRequest?.(request.id, "ignore")} disabled={busy}>
                  Ignore
                </button>
              </div>
            </div>
          ))}
          {!friendRequests.length ? <p className="panel-copy">No pending connection requests.</p> : null}
        </div>
      </article>

      <article className="surface">
        <div className="surface-head">
          <p className="card-label">Security and alerts</p>
          <span className="badge subtle">{deviceSessions.length} sessions</span>
        </div>
        <div className="list-stack">
          {deviceSessions.map((item) => (
            <div key={item.id} className="list-row compact-row">
              <div>
                <strong>{item.label}</strong>
                <p>{item.platform} · {item.location} · {item.sessionState}</p>
              </div>
              {item.sessionState !== "revoked" ? (
                <button type="button" className="ghost-button small" onClick={() => revokeDeviceSession?.(item.id)} disabled={busy}>
                  Revoke
                </button>
              ) : <span className="badge subtle">Revoked</span>}
            </div>
          ))}
          {unreadNotifications.map((item) => (
            <div key={item.id} className="list-row compact-row">
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </div>
              <button type="button" className="ghost-button small" onClick={() => markNotificationRead?.(item.id)} disabled={busy}>
                Mark read
              </button>
            </div>
          ))}
          {!deviceSessions.length && !unreadNotifications.length ? <p className="panel-copy">No active security alerts.</p> : null}
        </div>
      </article>

      <article className="surface">
        <div className="surface-head">
          <p className="card-label">Trusted contacts</p>
          <span className="badge subtle">{trustedContacts.length} visible</span>
        </div>
        <div className="list-stack">
          {trustedContacts.map((contact) => (
            <div key={contact.id} className="list-row compact-row">
              <div>
                <strong>{contact.displayName || contact.name || contact.handle}</strong>
                <p>{contact.handle} · {contact.trustTier || contact.trust || "trust pending"} · {contact.status || "connected"}</p>
              </div>
              <button type="button" className="ghost-button small" onClick={() => setActiveTab("circles")} disabled={busy}>
                Manage
              </button>
            </div>
          ))}
          {!trustedContacts.length ? <p className="panel-copy">Accepted connections will appear here.</p> : null}
        </div>
      </article>
    </section>
    <section className="surface-row">
      <article className="surface">
        <div className="surface-head">
          <p className="card-label">Complaint prevention controls</p>
          <span className="badge subtle">{complaintControls.length} safeguards</span>
        </div>
        <div className="complaint-control-grid">
          {complaintControls.map((control) => (
            <button key={control.id} type="button" className="member-control-card" onClick={() => runComplaintControl(control)} disabled={busy}>
              <strong>{control.label}</strong>
              <span>{control.userAction} - {control.detail}</span>
            </button>
          ))}
        </div>
      </article>
    </section>
    </>
  );
}

function ChatWorkspace({
  state,
  selectedThread,
  chatFilter,
  setChatFilter,
  busy,
  selectThread,
  handleSendMessage,
  handleSaveCurrentContext,
  startDirectThread,
  setActiveTab,
  handleWalletAction,
  blockUser,
  startCallSession
}) {
  const [draftMessage, setDraftMessage] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [loadingAttachment, setLoadingAttachment] = useState(false);
  const [inboxLane, setInboxLane] = useState("all");
  const pinnedThreads = getPinnedThreads(state.threads);
  const baseThreads = getVisibleThreads(state.threads, chatFilter);
  const visibleThreads = useMemo(() => {
    if (inboxLane === "all") return baseThreads;
    if (inboxLane === "services") {
      return baseThreads.filter((thread) => thread.type === "official");
    }
    if (inboxLane === "groups") {
      return baseThreads.filter((thread) => thread.type === "community" || thread.type === "private-group");
    }
    if (inboxLane === "money") {
      return baseThreads.filter((thread) => {
        const content = `${thread.name} ${(thread.messages || []).map((message) => message.text).join(" ")}`.toLowerCase();
        return content.includes("wallet") || content.includes("payment") || content.includes("payout") || content.includes("transfer");
      });
    }
    return baseThreads.filter((thread) => thread.type === "direct" || thread.type === "ops");
  }, [baseThreads, inboxLane]);
  const threadMessages = selectedThread?.messages || [];
  const readStateTail = (state.threadReadState || []).slice(0, 6);
  const blockableContact = useMemo(() => {
    if (!selectedThread) return null;
    const byId = (state.contacts || []).find((contact) => contact.id === selectedThread.id);
    if (byId) return byId;
    if (selectedThread.type !== "direct") return null;
    return (state.contacts || []).find((contact) =>
      [contact.name, contact.displayName, contact.handle].filter(Boolean).includes(selectedThread.name)
    ) || null;
  }, [state.contacts, selectedThread]);

  useEffect(() => {
    setDraftMessage("");
    setAttachment(null);
    setAttachmentError("");
    setLoadingAttachment(false);
  }, [selectedThread?.id]);

  const contextActions = useMemo(() => {
    const actions = [];
    if (handleWalletAction) {
      actions.push({
        id: "chat-merchant",
        label: "Log merchant payment",
        detail: "Keeps wallet in sync",
        onClick: () => handleWalletAction("merchant")
      });
      actions.push({
        id: "chat-transfer",
        label: "Send transfer",
        detail: "Start quick move",
        onClick: () => handleWalletAction("send")
      });
    }
    actions.push({
      id: "chat-wallet",
      label: "Open wallet",
      detail: "Ledger view",
      onClick: () => setActiveTab("wallet")
    });
    actions.push({
      id: "chat-save",
      label: "Save context",
      detail: "Pin message",
      onClick: () => handleSaveCurrentContext()
    });
    return actions;
  }, [handleWalletAction, handleSaveCurrentContext, setActiveTab]);

  async function processAttachmentFile(file) {
    if (!file) return;
    setAttachmentError("");
    setLoadingAttachment(true);
    try {
      setAttachment(await prepareImageAttachment(file));
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Unable to prepare the image.");
    } finally {
      setLoadingAttachment(false);
    }
  }

  function handleAttachmentSelect(event) {
    void processAttachmentFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleAttachmentDrop(event) {
    event.preventDefault();
    void processAttachmentFile(event.dataTransfer?.files?.[0]);
  }

  async function submitMessage(event) {
    event.preventDefault();
    if (!handleSendMessage) return;
    const text = draftMessage.trim();
    if (!text && !attachment) return;
    await handleSendMessage({
      text,
      attachments: attachment ? [attachment] : []
    });
    setDraftMessage("");
    setAttachment(null);
  }

  async function launchCall(mode) {
    if (!selectedThread?.id || !startCallSession) return;
    await startCallSession({
      threadId: selectedThread.id,
      mode,
      participants: Number(selectedThread.members) || 2,
      encryptionState: "device keys established",
      status: "starting"
    });
  }

  async function handleBlockUser() {
    if (!blockUser || !blockableContact) return;
    const reason = window.prompt("Please provide a reason for blocking this user:");
    if (reason === null) return;
    if (!String(reason).trim()) {
      window.alert("A reason is required to block this user.");
      return;
    }
    await blockUser(blockableContact.id, String(reason).trim());
  }

  return (
    <>
      <section className="surface-row two-column-chat">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Chats</p>
            <span className="badge subtle">{visibleThreads.length} threads</span>
          </div>
          <div className="surface-note">Most recent and most active conversations stay together here.</div>
          <div className="chip-filter-row" aria-label="Inbox lanes">
            <button type="button" className={inboxLane === "all" ? "chip-filter active" : "chip-filter"} onClick={() => setInboxLane("all")}>
              All inbox
            </button>
            <button type="button" className={inboxLane === "primary" ? "chip-filter active" : "chip-filter"} onClick={() => setInboxLane("primary")}>
              Primary
            </button>
            <button type="button" className={inboxLane === "groups" ? "chip-filter active" : "chip-filter"} onClick={() => setInboxLane("groups")}>
              Groups
            </button>
            <button type="button" className={inboxLane === "services" ? "chip-filter active" : "chip-filter"} onClick={() => setInboxLane("services")}>
              Services
            </button>
            <button type="button" className={inboxLane === "money" ? "chip-filter active" : "chip-filter"} onClick={() => setInboxLane("money")}>
              Money
            </button>
          </div>
          <div className="chip-filter-row" aria-label="Chat filters">
            <button type="button" className={chatFilter === "all" ? "chip-filter active" : "chip-filter"} onClick={() => setChatFilter("all")}>
              All
            </button>
            <button type="button" className={chatFilter === "unread" ? "chip-filter active" : "chip-filter"} onClick={() => setChatFilter("unread")}>
              Unread
            </button>
            <button type="button" className={chatFilter === "pinned" ? "chip-filter active" : "chip-filter"} onClick={() => setChatFilter("pinned")}>
              Pinned
            </button>
          </div>
          {pinnedThreads.length ? (
            <div className="pinned-thread-strip" aria-label="Pinned threads">
              {pinnedThreads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  className={thread.id === state.selectedThreadId ? "pinned-thread-chip active" : "pinned-thread-chip"}
                  onClick={() => selectThread(thread.id)}
                >
                  <strong>{thread.name}</strong>
                  <span>{thread.unreadCount ? `${thread.unreadCount} unread` : thread.type}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="thread-list">
            {visibleThreads.map((thread) => {
              const lastMessage = thread.messages[thread.messages.length - 1];
              return (
                <button
                  key={thread.id}
                  type="button"
                  className={thread.id === state.selectedThreadId ? "thread-item active" : "thread-item"}
                  onClick={() => selectThread(thread.id)}
                >
                  <div className="thread-topline">
                    <strong>{thread.name}</strong>
                    <span className={`presence-chip ${thread.presenceState || "away"}`}>{thread.presence}</span>
                  </div>
                  <p>{lastMessage.text}</p>
                  <div className="thread-bottomline">
                    <span>{thread.lastActiveLabel || thread.type}</span>
                    {thread.unreadCount ? <b className="unread-badge">{thread.unreadCount}</b> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Service channels</p>
            <span className="badge subtle">{state.threads.filter((thread) => thread.type === "official").length} active</span>
          </div>
          <div className="list-stack">
            {state.threads
              .filter((thread) => thread.type === "official")
              .map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  className={thread.id === state.selectedThreadId ? "list-button active" : "list-button"}
                  onClick={() => {
                    selectThread(thread.id);
                    setActiveTab("chat");
                  }}
                >
                  <strong>{thread.name}</strong>
                  <p>{thread.messages[thread.messages.length - 1]?.text || "No updates yet."}</p>
                  <span>{thread.lastActiveLabel || thread.presence}</span>
                </button>
              ))}
          </div>
        </article>

        <article className="surface surface-chat">
          <div className="surface-head">
            <p className="card-label">Conversation</p>
            <span className="badge subtle">{selectedThread?.type || "thread"}</span>
          </div>
          <div className="surface-note">Keep messages, saves, and next actions close to the same thread.</div>
          <div className="chat-header">
            <div>
              <strong>{selectedThread?.name || "No thread selected"}</strong>
              <p>{selectedThread?.members ? `${selectedThread.members} members · ${selectedThread.presence}` : "Open any thread to begin"}</p>
            </div>
            <div className="inline-actions">
              <button type="button" className="ghost-button small" onClick={() => void handleSaveCurrentContext()} disabled={busy}>
                Save
              </button>
              <button type="button" className="ghost-button small" onClick={() => void startDirectThread("isa")} disabled={busy}>
                New chat
              </button>
              <button type="button" className="ghost-button small" onClick={() => void launchCall("voice")} disabled={busy || !selectedThread}>
                Voice
              </button>
              <button type="button" className="ghost-button small" onClick={() => void launchCall("video")} disabled={busy || !selectedThread}>
                Video
              </button>
              <button
                type="button"
                className="danger-button small"
                onClick={() => void handleBlockUser()}
                disabled={busy || !blockableContact}
              >
                Block user
              </button>
            </div>
          </div>
          <div className="chat-context-bar">
            <div className="chat-context-meta">
              <strong>{selectedThread?.name || "Thread context"}</strong>
              <span>{selectedThread?.type || "Chat"} · {selectedThread?.presence || "offline"}</span>
            </div>
            <div className="chat-context-actions">
              {contextActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="ghost-button small"
                  onClick={action.onClick}
                  disabled={busy}
                >
                  <strong>{action.label}</strong>
                  <span>{action.detail}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="conversation-utility-bar" aria-label="Conversation utilities">
            <button type="button" className="utility-pill" onClick={() => setActiveTab("wallet")}>
              Pay
            </button>
            <button type="button" className="utility-pill" onClick={() => setActiveTab("discover")}>
              Service
            </button>
            <button type="button" className="utility-pill" onClick={() => setActiveTab("hub")}>
              Save
            </button>
            <button type="button" className="utility-pill" onClick={() => setActiveTab("circles")}>
              People
            </button>
          </div>
          <div className="message-stack">
            {threadMessages.map((message) => (
              <div key={message.id} className={message.mine ? "message-bubble mine" : "message-bubble"}>
                <span>{message.author}</span>
                <strong>{message.text}</strong>
                {message.attachments?.length ? (
                  <div className="message-attachment-row">
                    {message.attachments.map((item) => (
                      <div key={item.id || item.name} className="message-attachment">
                        {item.url?.startsWith("data:image") ? (
                          <img src={item.url} alt={item.name || "attachment"} loading="lazy" decoding="async" />
                        ) : (
                          <span>{item.name || "Attachment"}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="message-meta">
                  <p>{message.time}</p>
                  {message.mine && message.status ? <span className="message-status">{message.status}</span> : null}
                </div>
              </div>
            ))}
          </div>
          <form className="composer" onSubmit={submitMessage}>
            <div className="composer-controls">
              <label className="attachment-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={handleAttachmentDrop}>
                <input type="file" accept={IMAGE_UPLOAD_ACCEPT} onChange={handleAttachmentSelect} />
                {loadingAttachment ? "Optimizing..." : "Attach photo"}
                <span>JPG, PNG, GIF, SVG</span>
              </label>
              <input
                type="text"
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder="Type a message"
              />
              <button type="submit" className="accent-button" disabled={busy}>
                Send
              </button>
            </div>
            {attachmentError ? <p className="error-text">{attachmentError}</p> : null}
            {attachment ? (
              <div className="attachment-preview">
                <div>
                  <strong>{attachment.name}</strong>
                  <button type="button" className="ghost-button small" onClick={() => setAttachment(null)}>
                    Remove
                  </button>
                </div>
                {attachment.url?.startsWith("data:image") ? (
                  <img src={attachment.url} alt={attachment.name} loading="lazy" decoding="async" />
                ) : (
                  <span>{attachment.name}</span>
                )}
              </div>
            ) : null}
          </form>
        </article>
      </section>
      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Read state</p>
            <span className="badge subtle">{readStateTail.length} tracked</span>
          </div>
          <div className="surface-note">
            Recent thread read markers stay visible here so message state is not buried behind unread badges only.
          </div>
          <div className="list-stack">
            {readStateTail.map((entry) => (
              <div key={entry.threadId} className="list-row">
                <div>
                  <strong>{state.threads.find((thread) => thread.id === entry.threadId)?.name || entry.threadId}</strong>
                  <p>{entry.lastReadAt ? new Date(entry.lastReadAt).toLocaleString() : "No read timestamp"}</p>
                </div>
                <div className="row-meta-text">{entry.unreadCount || 0} unread</div>
              </div>
            ))}
            {!readStateTail.length ? <p className="panel-copy">No thread read-state records yet.</p> : null}
          </div>
        </article>
      </section>
      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Call sessions</p>
            <span className="badge subtle">{(state.callSessions || []).length} active or recent</span>
          </div>
          <div className="list-stack">
            {(state.callSessions || []).slice(0, 6).map((call) => (
              <div key={call.id} className="list-row">
                <div>
                  <strong>{call.mode} call</strong>
                  <p>{call.threadId} · {call.encryptionState}</p>
                </div>
                <div className="row-meta-text">{call.status}</div>
              </div>
            ))}
          </div>
        </article>
      </section>
      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Call history</p>
            <span className="badge subtle">{(state.callLogs || []).length} saved</span>
          </div>
          <div className="list-stack">
            {(state.callLogs || []).slice(0, 6).map((entry) => (
              <div key={entry.id} className="list-row">
                <div>
                  <strong>{entry.mode} call</strong>
                  <p>{entry.contactName || entry.threadId} · {entry.durationLabel || entry.status}</p>
                </div>
                <div className="row-meta-text">{entry.endedAtLabel || entry.status}</div>
              </div>
            ))}
          </div>
        </article>
      </section>
      {!state.threads.length ? <FilteredEmptyState label="Chats" /> : null}
    </>
  );
}

function NetworkWorkspace({ state, activeCircle, selectCircle, busy, startDirectThread, openPublicProfile, selectThread, setActiveTab, rateContactTrust, createGroupConversation, respondFriendRequest, addEndorsement, addJobPost, moderateRatingRecord }) {
  const [endorsementDraft, setEndorsementDraft] = useState({ toContactId: "", skill: "", note: "" });
  const [jobDraft, setJobDraft] = useState({ title: "", team: "", location: "", type: "Contract" });
  const [groupDraft, setGroupDraft] = useState({ name: "", type: "private", topic: "", memberIds: [] });
  const suggestedContacts = [...state.contacts]
    .sort((a, b) => (b.relationshipScore || 0) - (a.relationshipScore || 0))
    .slice(0, 4);
  const profileSnapshots = (state.reputationSnapshots || [])
    .filter((item) => item.targetType === "contact")
    .slice(0, 4);
  const profileRatingQueue = (state.ratingModerationQueue || [])
    .filter((item) => item.targetType === "contact" && item.status === "open")
    .slice(0, 4);
  const memberRecords = (state.userRecords || []).slice(0, 4);
  const groupThreads = (state.threads || []).filter((thread) => thread.type === "community" || thread.type === "private-group");
  const pendingFriendRequests = (state.friendRequests || []).slice(0, 6);
  const highTrustContacts = state.contacts
    .filter((contact) => ["AAA", "AA", "A"].includes(getContactTrustTier(contact)))
    .slice(0, 6);
  const trustedCircleCount = state.circles.filter((circle) => String(circle.trust || "").toLowerCase().includes("trusted")).length;
  const privateGroupCount = groupThreads.filter((thread) => thread.type === "private-group").length;
  const rapportReviewCount = profileRatingQueue.length + pendingFriendRequests.length;
  const rapportLanes = [
    {
      id: "personal",
      label: "Personal",
      count: state.contacts.filter((contact) => ["creator", "personal"].includes(contact.accountType)).length,
      detail: "Friends, creators, family-style ties, and direct social presence."
    },
    {
      id: "professional",
      label: "Professional",
      count: (state.professionalIdentities || []).length + (state.endorsements || []).length,
      detail: "Work identity, endorsements, resumes, hiring, and expertise."
    },
    {
      id: "communal",
      label: "Communal",
      count: state.circles.length + groupThreads.length,
      detail: "Circles, private groups, community channels, moments, and shared belonging."
    },
    {
      id: "service",
      label: "Service",
      count: (state.listings || []).filter((listing) => ["Services", "Gigs", "Community"].includes(listing.category)).length,
      detail: "Needs, referrals, creators, merchants, bookings, and local work."
    }
  ];
  const strongestIntroductions = suggestedContacts.map((contact) => ({
    ...contact,
    sharedContext: `${contact.city || "Local"} · ${contact.referralSource || contact.preferredSurface || "known through FoxHub"}`
  }));
  const communityServiceSignals = (state.listings || [])
    .filter((listing) => ["Services", "Gigs", "Community", "Jobs"].includes(listing.category))
    .slice(0, 4);
  const rapportSummaryCards = [
    {
      label: "Trusted people",
      value: highTrustContacts.length,
      detail: "Contacts with A-tier or better relationship trust."
    },
    {
      label: "Introductions",
      value: strongestIntroductions.length,
      detail: "Best people to reach from your current graph."
    },
    {
      label: "Private groups",
      value: privateGroupCount,
      detail: "Smaller rooms built around known relationships."
    },
    {
      label: "Review items",
      value: rapportReviewCount,
      detail: "Friend requests and trust ratings that need a decision."
    }
  ];

  function toggleGroupMember(memberId) {
    setGroupDraft((current) => {
      const exists = current.memberIds.includes(memberId);
      return {
        ...current,
        memberIds: exists ? current.memberIds.filter((item) => item !== memberId) : [...current.memberIds, memberId]
      };
    });
  }

  async function submitEndorsement(event) {
    event.preventDefault();
    if (!endorsementDraft.toContactId || !endorsementDraft.skill.trim()) return;
    await addEndorsement({
      fromContactId: state.profile.handle || "self",
      ...endorsementDraft
    });
    setEndorsementDraft({ toContactId: "", skill: "", note: "" });
  }

  async function submitJobPost(event) {
    event.preventDefault();
    if (!jobDraft.title.trim()) return;
    await addJobPost(jobDraft);
    setJobDraft({ title: "", team: "", location: "", type: "Contract" });
  }

  async function submitGroup(event) {
    event.preventDefault();
    if (!groupDraft.name.trim()) return;
    await createGroupConversation(groupDraft);
    setGroupDraft({ name: "", type: "private", topic: "", memberIds: [] });
    setActiveTab("chat");
  }

  return (
    <>
      <section className="rapport-hero network-rapport-hero" aria-label="Rapport graph">
        <div className="rapport-hero-copy">
          <p className="eyebrow">Rapport</p>
          <h2>Know who someone is, how you know them, and what is safe to do together.</h2>
          <p>
            Rapport keeps the people layer focused: trust grades, shared circles, introductions, requests, and reputation signals are grouped here instead of mixed with the feed or market.
          </p>
          <div className="inline-actions wrap">
            <button type="button" className="accent-button" onClick={() => createGroupConversation?.({ name: "Rapport Circle", type: "private", topic: "Trusted introductions", memberIds: state.contacts.slice(0, 3).map((contact) => contact.id) })} disabled={busy}>
              Form rapport circle
            </button>
            <button type="button" className="ghost-button small" onClick={() => setActiveTab("market")}>
              Open market signals
            </button>
          </div>
        </div>
        <div className="rapport-lane-grid">
          {rapportLanes.map((lane) => (
            <article key={lane.id} className="rapport-lane-card">
              <span>{lane.label}</span>
              <strong>{lane.count}</strong>
              <p>{lane.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rapport-command-center" aria-label="Rapport command center">
        <div className="rapport-summary-grid">
          {rapportSummaryCards.map((card) => (
            <article key={card.label} className="rapport-summary-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>
        <article className="surface rapport-action-panel">
          <div className="surface-head">
            <p className="card-label">Trusted introductions</p>
            <span className="badge subtle">{trustedCircleCount} trusted circles</span>
          </div>
          <div className="list-stack">
            {highTrustContacts.slice(0, 3).map((contact) => (
              <div key={contact.id} className="list-row">
                <div>
                  <strong>{contact.displayName || contact.name}</strong>
                  <p>{contact.handle} · {contact.city || "FoxHub"}</p>
                </div>
                <div className="inline-actions wrap">
                  <span className={trustTierBadgeClass(getContactTrustTier(contact))}>{getContactTrustTier(contact)}</span>
                  <button type="button" className="ghost-button small" onClick={() => openPublicProfile?.(contact.id)}>
                    View profile
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => void startDirectThread(contact.id)}>
                    Message
                  </button>
                </div>
              </div>
            ))}
            {!highTrustContacts.length ? <p className="panel-copy">Rate contacts to build trusted introduction paths.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel rapport-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Introduction map</p>
            <span className="badge subtle">{strongestIntroductions.length} candidates</span>
          </div>
          <div className="list-stack">
            {strongestIntroductions.map((contact) => (
              <div key={contact.id} className="list-row">
                <div>
                  <strong>{contact.displayName || contact.name}</strong>
                  <p>{contact.sharedContext}</p>
                </div>
                <div className="inline-actions wrap">
                  <span className="badge subtle">{contact.relationshipScore || 0} rapport</span>
                  <button type="button" className="ghost-button small" onClick={() => openPublicProfile?.(contact.id)}>
                    View profile
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => void startDirectThread(contact.id)}>
                    Message
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Service trust signals</p>
            <span className="badge subtle">{communityServiceSignals.length} signals</span>
          </div>
          <div className="list-stack">
            {communityServiceSignals.map((listing) => (
              <div key={listing.id} className="list-row">
                <div>
                  <strong>{listing.title}</strong>
                  <p>{listing.category} · {listing.city} · {listing.description}</p>
                </div>
                <div className="row-meta-text">{listing.verified ? "trusted source" : "community ask"}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row three-up service-panel compliance-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Contacts</p>
            <span className="badge subtle">{state.contacts.length} people</span>
          </div>
          <div className="surface-note">
            Trusted people, direct entry points, and profile signals.
          </div>
          <div className="list-stack">
            {state.contacts.map((contact) => {
              const trustTier = getContactTrustTier(contact);
              const trustMeta = getTrustTierMeta(trustTier);
              const verificationBadge = verificationBadgeModel(contact.verificationLevel);
              return (
                <div key={contact.id} className="contact-card">
                  <button type="button" className="list-button contact-button" onClick={() => openPublicProfile?.(contact.id)}>
                    <div className="thread-topline">
                      <strong>{contact.displayName || contact.name}</strong>
                      <span className={`presence-chip ${contact.presenceState || "away"}`}>{contact.presenceState || "away"}</span>
                    </div>
                    <p>{contact.handle} · {contact.city}</p>
                    <div className="contact-trust-row">
                      <span className={trustTierBadgeClass(trustTier)}>{trustTier} · {trustMeta.label}</span>
                      <span className={verificationBadge.className} title={contact.verificationLevel || "Verification status"}>
                        {verificationBadge.label}
                      </span>
                    </div>
                    <span>
                      {typeof contact.peerRatingAverage === "number" ? `${contact.peerRatingAverage.toFixed(1)} / 5` : "No peer rating"} · {contact.peerRatingCount || 0} ratings
                    </span>
                    <span>{getTrustRestrictionLine(trustTier)}</span>
                  </button>
                  <div className="inline-actions wrap">
                    <button type="button" className="ghost-button small" onClick={() => openPublicProfile?.(contact.id)}>
                      View profile
                    </button>
                    <button type="button" className="ghost-button small" onClick={() => void startDirectThread(contact.id)}>
                      Message
                    </button>
                  </div>
                  <div className="trust-rating-strip">
                    {TRUST_TIER_ORDER.map((grade) => (
                      <button
                        key={grade}
                        type="button"
                        className={contact.myPeerRating === grade ? "trust-grade-chip active" : "trust-grade-chip"}
                        onClick={() => rateContactTrust(contact.id, grade)}
                        disabled={busy}
                      >
                        {grade}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Circles</p>
            <span className="badge subtle">{activeCircle?.trust || "active"}</span>
          </div>
          <div className="surface-note">
            Smaller communities and local network context.
          </div>
          <div className="list-stack">
            {state.circles.map((circle) => (
              <button
                key={circle.id}
                type="button"
                className={circle.id === state.activeCircleId ? "list-button active" : "list-button"}
                onClick={() => selectCircle(circle.id)}
              >
                <strong>{circle.name}</strong>
                <p>{circle.focus}</p>
                <span>{circle.members}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Groups</p>
            <span className="badge subtle">{groupThreads.length} active</span>
          </div>
          <div className="surface-note">
            Private groups for trusted circles, and community groups for larger open conversation.
          </div>
          <form className="market-form" onSubmit={submitGroup}>
            <label>
              Group name
              <input
                value={groupDraft.name}
                onChange={(event) => setGroupDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Weekend Creators"
              />
            </label>
            <label>
              Group type
              <select
                value={groupDraft.type}
                onChange={(event) => setGroupDraft((current) => ({ ...current, type: event.target.value }))}
              >
                <option value="private">Private group</option>
                <option value="community">Community group</option>
              </select>
            </label>
            <label>
              Topic
              <input
                value={groupDraft.topic}
                onChange={(event) => setGroupDraft((current) => ({ ...current, topic: event.target.value }))}
                placeholder="Collabs, gigs, local updates"
              />
            </label>
            <label>
              Add members
              <div className="inline-actions wrap">
                {state.contacts.slice(0, 8).map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    className={groupDraft.memberIds.includes(contact.id) ? "ghost-button small active-soft" : "ghost-button small"}
                    onClick={() => toggleGroupMember(contact.id)}
                  >
                    {contact.displayName || contact.name}
                  </button>
                ))}
              </div>
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Create group</button>
          </form>
          <div className="list-stack">
            {groupThreads.slice(0, 8).map((thread) => (
              <div key={thread.id} className="list-row">
                <button
                  type="button"
                  className="list-button inline-list-button"
                  onClick={() => {
                    selectThread(thread.id);
                    setActiveTab("chat");
                  }}
                >
                  <div>
                    <strong>{thread.name}</strong>
                    <p>{thread.type === "private-group" ? "Private group" : "Community group"}</p>
                  </div>
                  <div className="row-meta-text">{thread.members} members</div>
                </button>
              </div>
            ))}
            {!groupThreads.length ? (
              <div className="list-row">
                <div>
                  <strong>No groups yet</strong>
                  <p>Create a private or community group to start group chat.</p>
                </div>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Friend requests</p>
            <span className="badge subtle">{pendingFriendRequests.length} pending</span>
          </div>
          <div className="surface-note">
            Accept or ignore new connection requests. Accepted people move into your contacts automatically.
          </div>
          <div className="list-stack">
            {pendingFriendRequests.map((request) => (
              <div key={request.id} className="list-row">
                <div>
                  <strong>{request.name}</strong>
                  <p>{request.handle} · {request.city}</p>
                  <span>{request.mutualCount} mutual connections</span>
                </div>
                <div className="inline-actions wrap">
                  <button type="button" className="ghost-button small" onClick={() => respondFriendRequest(request.id, "accept")} disabled={busy}>
                    Accept
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => respondFriendRequest(request.id, "ignore")} disabled={busy}>
                    Ignore
                  </button>
                </div>
              </div>
            ))}
            {!pendingFriendRequests.length ? <p className="panel-copy">No pending friend requests right now.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Trust records</p>
            <span className="badge subtle">{(state.userRecords || []).length} tracked</span>
          </div>
          <div className="surface-note">
            Member identity state, support tier, and wallet status stay visible as context for rapport decisions.
          </div>
          <div className="list-stack">
            {memberRecords.map((record) => (
              <div key={record.id} className="list-row">
                <div>
                  <strong>{record.profile?.displayName || record.contactId || record.id}</strong>
                  <p>{record.accountType} · {record.stage} · {record.supportTier}</p>
                </div>
                <div className="row-meta-text">{record.identityState} · {record.walletState}</div>
              </div>
            ))}
            {!memberRecords.length ? <p className="panel-copy">No member records are available yet.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Profile reputation</p>
            <span className="badge subtle">{profileSnapshots.length} tracked</span>
          </div>
          <div className="list-stack">
            {profileSnapshots.map((snapshot) => (
              <div key={snapshot.id} className="list-row">
                <div>
                  <strong>{snapshot.label}</strong>
                  <p>{snapshot.averageRating?.toFixed ? snapshot.averageRating.toFixed(1) : snapshot.averageRating} / 5 · {snapshot.ratingCount} ratings</p>
                </div>
                <div className="row-meta-text">{snapshot.trustTier} · {snapshot.verification}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Rating review queue</p>
            <span className="badge subtle">{profileRatingQueue.length} open</span>
          </div>
          <div className="list-stack">
            {profileRatingQueue.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.targetId}</strong>
                  <p>{item.reason}</p>
                </div>
                <div className="inline-actions wrap">
                  <button type="button" className="ghost-button small" onClick={() => moderateRatingRecord(item.recordId, "approved")}>
                    Approve
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => moderateRatingRecord(item.recordId, "removed")}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {!profileRatingQueue.length ? <p className="panel-copy">No profile ratings need review.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel overview-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Profiles and resumes</p>
            <span className="badge subtle">{(state.professionalIdentities || []).length} profiles · {(state.resumeEntries || []).length} resume items</span>
          </div>
          <div className="list-stack">
            {(state.professionalIdentities || []).slice(0, 4).map((profile) => (
              <div key={profile.id} className="list-row">
                <div>
                  <strong>{profile.name}</strong>
                  <p>{profile.role} · {profile.company || profile.city || "FoxHub"}</p>
                </div>
                <div className="row-meta-text">{profile.verification || profile.trust || "active"}</div>
              </div>
            ))}
            {(state.resumeEntries || []).slice(0, 3).map((entry) => (
              <div key={entry.id} className="list-row">
                <div>
                  <strong>{entry.title}</strong>
                  <p>{entry.organization || entry.company || entry.location || "Profile record"}</p>
                </div>
                <div className="row-meta-text">{entry.period || entry.status || "saved"}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Professional graph tools</p>
            <span className="badge subtle">{(state.endorsements || []).length} endorsements · {(state.jobPosts || []).length} jobs</span>
          </div>
          <form className="market-form" onSubmit={submitEndorsement}>
            <label>
              Person
              <select value={endorsementDraft.toContactId} onChange={(event) => setEndorsementDraft((current) => ({ ...current, toContactId: event.target.value }))}>
                <option value="">Select contact</option>
                {state.contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>{contact.displayName || contact.name}</option>
                ))}
              </select>
            </label>
            <label>
              Skill
              <input value={endorsementDraft.skill} onChange={(event) => setEndorsementDraft((current) => ({ ...current, skill: event.target.value }))} />
            </label>
            <label>
              Note
              <input value={endorsementDraft.note} onChange={(event) => setEndorsementDraft((current) => ({ ...current, note: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Add endorsement</button>
          </form>
          <form className="market-form" onSubmit={submitJobPost}>
            <label>
              Job title
              <input value={jobDraft.title} onChange={(event) => setJobDraft((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label>
              Team
              <input value={jobDraft.team} onChange={(event) => setJobDraft((current) => ({ ...current, team: event.target.value }))} />
            </label>
            <label>
              Location
              <input value={jobDraft.location} onChange={(event) => setJobDraft((current) => ({ ...current, location: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Post job</button>
          </form>
          <div className="list-stack">
            {(state.endorsements || []).slice(0, 3).map((endorsement) => (
              <div key={endorsement.id} className="list-row">
                <div>
                  <strong>{endorsement.skill}</strong>
                  <p>{endorsement.note || "Professional endorsement"}</p>
                </div>
                <div className="row-meta-text">{endorsement.toContactId || endorsement.author || "saved"}</div>
              </div>
            ))}
            {(state.jobPosts || []).slice(0, 3).map((job) => (
              <div key={job.id} className="list-row">
                <div>
                  <strong>{job.title}</strong>
                  <p>{job.team || "FoxHub"} · {job.location || "Flexible"}</p>
                </div>
                <div className="row-meta-text">{job.type || "Open"}</div>
              </div>
            ))}
          </div>
        </article>
      </section>
      {!state.contacts.length && !state.circles.length && !state.channels.length ? (
        <FilteredEmptyState label="Network" />
      ) : null}
    </>
  );
}

function MarketWorkspace({
  state,
  listings = [],
  savedSearches = [],
  listingAlerts = [],
  listingCategories,
  listingTypes,
  listingTags,
  createListing,
  flagListing,
  flagCurrentAccountForCommerce,
  saveListingSearch,
  startDirectThread,
  openPublicProfile,
  busy,
  placeAuctionBid,
  upsertCart,
  addShopReview,
  moderateRatingRecord
}) {
  const [filters, setFilters] = useState({ category: "", city: "", keyword: "" });
  const [selectedListingId, setSelectedListingId] = useState(listings[0]?.id || null);
  const [savedSearchDraft, setSavedSearchDraft] = useState({ name: "", keywords: "", category: "", city: "" });
  const [bidAmount, setBidAmount] = useState("");
  const [reviewDraft, setReviewDraft] = useState({ title: "", body: "", rating: 5 });
  const [listingDraft, setListingDraft] = useState({
    title: "",
    category: listingCategories[0] || "",
    type: listingTypes[0]?.id || "offer",
    city: "",
    neighborhood: "",
    price: "",
    currency: "USD",
    description: "",
    tags: "",
    photos: "",
    contactId: state.contacts[0]?.id || "",
    featured: false,
    verified: false
  });
  const commercePolicy = state.commercePolicy || {};
  const commerceBlocked = Boolean(commercePolicy.commerceBlocked);

  useEffect(() => {
    if (!listings.length) {
      setSelectedListingId(null);
      return;
    }
    if (!selectedListingId || !listings.find((item) => item.id === selectedListingId)) {
      setSelectedListingId(listings[0].id);
    }
  }, [listings, selectedListingId]);

  const filteredListings = useMemo(() => {
    const escapedKeyword = String(filters.keyword || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = escapedKeyword ? new RegExp(escapedKeyword, "i") : null;
    return [...listings]
      .filter((listing) => {
        if (filters.category && listing.category !== filters.category) return false;
        if (filters.city && listing.city && listing.city.toLowerCase() !== filters.city.toLowerCase()) return false;
        if (pattern) {
          if (
            !pattern.test(listing.title) &&
            !pattern.test(listing.description) &&
            !(listing.tags || []).some((tag) => pattern.test(tag))
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  }, [listings, filters]);

  const selectedListing = filteredListings.find((item) => item.id === selectedListingId) || filteredListings[0] || null;
  const selectedContact = selectedListing ? state.contacts.find((contact) => contact.id === selectedListing.contactId) : null;
  const selectedRecord = selectedContact ? state.userRecords.find((record) => record.contactId === selectedContact.id) : null;
  const shopSnapshots = (state.reputationSnapshots || []).filter((item) => item.targetType === "shop").slice(0, 4);
  const shopRatingQueue = (state.ratingModerationQueue || []).filter((item) => item.targetType === "shop" && item.status === "open").slice(0, 4);
  const recentCartItems = useMemo(() => {
    const carts = Array.isArray(state.carts) ? state.carts : [];
    const normalized = carts.flatMap((cart) => Array.isArray(cart.items) ? cart.items : []);
    return normalized.slice(0, 5);
  }, [state.carts]);

  function handleFilterChange(field) {
    return (event) => setFilters((current) => ({ ...current, [field]: event.target.value }));
  }

  function handleSavedSearchSubmit(event) {
    event.preventDefault();
    if (!savedSearchDraft.name.trim()) return;
    saveListingSearch(savedSearchDraft);
    setSavedSearchDraft({ name: "", keywords: "", category: "", city: "" });
  }

  function handleListingSubmit(event) {
    event.preventDefault();
    if (commerceBlocked) return;
    createListing({
      ...listingDraft,
      price: Number(listingDraft.price) || 0,
      tags: (listingDraft.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
      photos: (listingDraft.photos || "").split(",").map((item) => item.trim()).filter(Boolean)
    });
    setListingDraft({
      title: "",
      category: listingCategories[0] || "",
      type: listingTypes[0]?.id || "offer",
      city: "",
      neighborhood: "",
      price: "",
      currency: "USD",
      description: "",
      tags: "",
      photos: "",
      contactId: state.contacts[0]?.id || "",
      featured: false,
      verified: false
    });
  }

  function renderListingBadge(status) {
    if (status === "blocked" || status === "flagged") return "badge block";
    if (status === "review") return "badge review";
    return "badge subtle";
  }

  async function submitBid() {
    if (!selectedListing || !bidAmount || commerceBlocked) return;
    const liveLot = (state.auctionLots || []).find((lot) => lot.listingId === selectedListing.id);
    if (!liveLot) return;
    await placeAuctionBid({
      lotId: liveLot.id,
      amount: Number(bidAmount),
      currency: selectedListing.currency || "USD",
      bidderId: state.profile.handle || "self",
      status: "leading"
    });
    setBidAmount("");
  }

  async function addCurrentListingToCart() {
    if (!selectedListing || commerceBlocked) return;
    const baseCart = (state.carts || [])[0];
    const items = [
      ...((baseCart && Array.isArray(baseCart.items)) ? baseCart.items : []),
      { sku: selectedListing.id, title: selectedListing.title, qty: 1, unitPrice: Number(selectedListing.price) || 0 }
    ];
    await upsertCart({
      id: baseCart?.id,
      ownerId: state.profile.handle || "self",
      currency: selectedListing.currency || "USD",
      items
    });
  }

  async function addBuyAgainItem(item) {
    if (!item || commerceBlocked) return;
    const baseCart = (state.carts || [])[0];
    const existingItems = (baseCart && Array.isArray(baseCart.items)) ? baseCart.items : [];
    const currentRow = existingItems.find((row) => row.sku === item.sku || row.title === item.title);
    const nextItems = currentRow
      ? existingItems.map((row) =>
          (row.sku === item.sku || row.title === item.title)
            ? { ...row, qty: Number(row.qty || 1) + 1 }
            : row
        )
      : [...existingItems, { sku: item.sku || `sku-${Date.now()}`, title: item.title || "Saved item", qty: 1, unitPrice: Number(item.unitPrice) || 0 }];
    await upsertCart({
      id: baseCart?.id,
      ownerId: state.profile.handle || "self",
      currency: baseCart?.currency || selectedListing?.currency || "USD",
      items: nextItems
    });
  }

  async function submitShopReview(event) {
    event.preventDefault();
    const activeShop = (state.shopProfiles || [])[0];
    if (!activeShop || !reviewDraft.title.trim()) return;
    await addShopReview({
      shopId: activeShop.id,
      author: state.profile.name || state.profile.handle || "FoxHub user",
      ...reviewDraft
    });
    setReviewDraft({ title: "", body: "", rating: 5 });
  }

  return (
    <>
      <section className="surface-row two-up service-panel compliance-panel">
        <article className="surface market-panel">
          <div className="surface-head">
            <p className="card-label">Filters & searches</p>
            <span className="badge subtle">{filteredListings.length} matches</span>
          </div>
          <div className="market-filters">
            <label>
              Category
              <select value={filters.category} onChange={handleFilterChange("category")}>
                <option value="">All categories</option>
                {listingCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              City
              <input type="text" value={filters.city} onChange={handleFilterChange("city")} placeholder="City" />
            </label>
            <label>
              Keyword
              <input type="text" value={filters.keyword} onChange={handleFilterChange("keyword")} placeholder="Keywords" />
            </label>
          </div>
          <div className="saved-searches">
            <div className="surface-head">
              <p className="card-label">Saved searches</p>
              <span className="badge subtle">{savedSearches.length} alerts</span>
            </div>
            <div className="list-stack">
              {savedSearches.map((search) => (
                <div key={search.id} className="list-row">
                  <div>
                    <strong>{search.name}</strong>
                    <p>
                      {search.category || "Any"} · {search.city || "All cities"} · {search.keywords || "Open keywords"}
                    </p>
                  </div>
                  <button type="button" className="ghost-button small" onClick={() => setFilters({ category: search.category || "", city: search.city || "", keyword: search.keywords || "" })}>
                    Apply
                  </button>
                </div>
              ))}
            </div>
            <form className="market-form" onSubmit={handleSavedSearchSubmit}>
              <label>
                Name
                <input value={savedSearchDraft.name} onChange={(event) => setSavedSearchDraft((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label>
                Keywords
                <input value={savedSearchDraft.keywords} onChange={(event) => setSavedSearchDraft((current) => ({ ...current, keywords: event.target.value }))} placeholder="DJ|artist" />
              </label>
              <label>
                City
                <input value={savedSearchDraft.city} onChange={(event) => setSavedSearchDraft((current) => ({ ...current, city: event.target.value }))} placeholder="City" />
              </label>
              <button type="submit" className="ghost-button" disabled={busy || !savedSearchDraft.name.trim()}>
                Save search
              </button>
            </form>
          </div>
          <div className="listing-alerts">
            <div className="surface-head">
              <p className="card-label">Alerts</p>
              <span className="badge subtle">{listingAlerts.length} burn-in</span>
            </div>
            <div className="list-stack">
              {listingAlerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="alert-card">
                  <strong>{alert.title}</strong>
                  <p>{alert.summary}</p>
                  <span>{new Date(alert.timestamp).toLocaleString()}</span>
                </div>
              ))}
              {!listingAlerts.length ? <p className="panel-copy">Alerts appear when a saved search matches a new listing.</p> : null}
            </div>
          </div>
        </article>
        <article className="surface market-listings">
          <div className="surface-head">
            <p className="card-label">Listings</p>
            <span className="badge subtle">{filteredListings.length} live</span>
          </div>
          <div className="list-stack">
            {filteredListings.map((listing) => (
              <button
                key={listing.id}
                type="button"
                className={`list-button ${selectedListing?.id === listing.id ? "active" : ""}`}
                onClick={() => setSelectedListingId(listing.id)}
              >
                <div className="thread-topline">
                  <strong>{listing.title}</strong>
                  <span className={renderListingBadge(listing.status)}>{listing.status}</span>
                </div>
                <p>
                  {listing.city} · {listing.neighborhood}
                </p>
                <div className="row-meta-text">
                  ${listing.price} · {listing.category}
                </div>
              </button>
            ))}
          </div>
        </article>
      </section>
      <section className="surface-row two-up service-panel compliance-panel">
        <article className="surface listing-detail">
          <div className="surface-head">
            <p className="card-label">Listing detail</p>
            <span className="badge subtle">{selectedListing?.type || "No listing selected"}</span>
          </div>
          {selectedListing ? (
            <>
              <div className="listing-hero">
                {selectedListing.photos?.[0] ? <img src={selectedListing.photos[0]} alt={selectedListing.title} loading="lazy" decoding="async" /> : null}
                <div>
                  <strong>{selectedListing.title}</strong>
                  <p>{selectedListing.description}</p>
                  <div className="listing-tags">
                    {(selectedListing.tags || []).map((tag) => (
                      <span key={tag} className="badge subtle">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="list-row">
                <div>
                  <strong>Price</strong>
                  <p>
                    ${selectedListing.price} {selectedListing.currency}
                  </p>
                </div>
                <div>
                  <strong>Category</strong>
                  <p>{selectedListing.category}</p>
                </div>
                <div>
                  <strong>Status</strong>
                  <span className={renderListingBadge(selectedListing.status)}>{selectedListing.status}</span>
                </div>
              </div>
              <div className="list-row">
                <div>
                  <strong>Seller</strong>
                  <p>{selectedContact ? selectedContact.displayName || selectedContact.name : "Unknown"}</p>
                </div>
                <div className="list-row-meta">
                  <span className={renderListingBadge(selectedContact ? selectedContact.walletState : "")}>
                    Trust {selectedContact ? getContactTrustTier(selectedContact) : "N/A"}
                  </span>
                  <p>{selectedRecord?.notes}</p>
                </div>
              </div>
              <div className="inline-actions wrap">
                <button
                  type="button"
                  className="accent-button"
                  disabled={!selectedContact}
                  onClick={() => {
                    if (selectedContact) startDirectThread(selectedContact.id);
                  }}
                >
                  Message seller
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!selectedContact}
                  onClick={() => {
                    if (selectedContact) openPublicProfile?.(selectedContact.id);
                  }}
                >
                  View seller profile
                </button>
                <button type="button" className="ghost-button" disabled={!selectedListing} onClick={() => flagListing(selectedListing.id, "market flag")}>
                  Flag listing
                </button>
              </div>
            </>
          ) : (
            <p className="panel-copy">Select or filter for a listing to view details.</p>
          )}
        </article>
        <MarketplaceInfluencePanel selectedListing={selectedListing} startDirectThread={startDirectThread} busy={busy} />
      </section>
      <section className="surface-row two-up service-panel compliance-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Auction and cart actions</p>
            <span className="badge subtle">{(state.auctionLots || []).length} lots · {(state.carts || []).length} carts</span>
          </div>
          <div className="list-stack">
            {(state.auctionLots || []).slice(0, 4).map((lot) => (
              <div key={lot.id} className="list-row">
                <div>
                  <strong>{lot.title}</strong>
                  <p>Current bid ${lot.currentBid} · {lot.bidCount} bids</p>
                </div>
                <div className="row-meta-text">{lot.status}</div>
              </div>
            ))}
          </div>
          <div className="inline-actions wrap">
            <input type="number" value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} placeholder="Bid amount" />
            <button type="button" className="ghost-button" onClick={() => void submitBid()} disabled={busy || !selectedListing || commerceBlocked}>Place bid</button>
            <button type="button" className="ghost-button" onClick={() => void addCurrentListingToCart()} disabled={busy || !selectedListing || commerceBlocked}>Add to cart</button>
          </div>
          <div className="list-stack">
            {(state.carts || []).slice(0, 2).map((cart) => (
              <div key={cart.id} className="list-row">
                <div>
                  <strong>{cart.ownerId || "Current cart"}</strong>
                  <p>{Array.isArray(cart.items) ? cart.items.length : 0} items</p>
                </div>
                <div className="row-meta-text">{cart.currency || "USD"}</div>
              </div>
            ))}
            {recentCartItems.length ? (
              <div className="list-row">
                <div>
                  <strong>Buy again</strong>
                  <p>One-tap reorder for recent cart items.</p>
                </div>
                <div className="inline-actions wrap">
                  {recentCartItems.map((item) => (
                    <button key={`${item.sku || item.title}`} type="button" className="ghost-button small" onClick={() => void addBuyAgainItem(item)} disabled={busy}>
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {(state.bidEvents || []).slice(0, 3).map((bid) => (
              <div key={bid.id} className="list-row">
                <div>
                  <strong>{bid.lotId}</strong>
                  <p>{bid.bidderId || "bidder"} · {bid.status || "submitted"}</p>
                </div>
                <div className="row-meta-text">${bid.amount}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Storefront reviews</p>
            <span className="badge subtle">{(state.shopReviews || []).length} reviews</span>
          </div>
          <div className="list-stack">
            {(state.shopProfiles || []).slice(0, 2).map((shop) => (
              <div key={shop.id} className="list-row">
                <div>
                  <strong>{shop.name}</strong>
                  <p>{shop.story || shop.summary || "Storefront profile"}</p>
                </div>
                <div className="row-meta-text">{shop.rating || shop.trust || "trusted"}</div>
              </div>
            ))}
            {(state.fulfillmentOrders || []).slice(0, 3).map((order) => (
              <div key={order.id} className="list-row">
                <div>
                  <strong>{order.orderNumber || order.id}</strong>
                  <p>{order.carrier || order.method || "Fulfillment"} · {order.destination || order.status}</p>
                </div>
                <div className="row-meta-text">{order.status || "active"}</div>
              </div>
            ))}
          </div>
          <form className="market-form" onSubmit={submitShopReview}>
            <label>
              Review title
              <input value={reviewDraft.title} onChange={(event) => setReviewDraft((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label>
              Rating
              <input type="number" min="1" max="5" value={reviewDraft.rating} onChange={(event) => setReviewDraft((current) => ({ ...current, rating: event.target.value }))} />
            </label>
            <label>
              Review
              <textarea value={reviewDraft.body} onChange={(event) => setReviewDraft((current) => ({ ...current, body: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Add review</button>
          </form>
        </article>
      </section>
      <section className="surface-row two-up service-panel routes-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Store reputation</p>
            <span className="badge subtle">{shopSnapshots.length} tracked</span>
          </div>
          <div className="list-stack">
            {shopSnapshots.map((snapshot) => (
              <div key={snapshot.id} className="list-row">
                <div>
                  <strong>{snapshot.label}</strong>
                  <p>{snapshot.averageRating?.toFixed ? snapshot.averageRating.toFixed(1) : snapshot.averageRating} / 5 · {snapshot.ratingCount} ratings</p>
                </div>
                <div className="row-meta-text">{snapshot.trustTier} · {snapshot.verification}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Store rating review</p>
            <span className="badge subtle">{shopRatingQueue.length} open</span>
          </div>
          <div className="list-stack">
            {shopRatingQueue.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.targetId}</strong>
                  <p>{item.reason}</p>
                </div>
                <div className="inline-actions wrap">
                  <button type="button" className="ghost-button small" onClick={() => moderateRatingRecord(item.recordId, "approved")}>
                    Approve
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => moderateRatingRecord(item.recordId, "removed")}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {!shopRatingQueue.length ? <p className="panel-copy">No storefront ratings need review.</p> : null}
          </div>
        </article>
      </section>
      <section className="surface-row two-up service-panel routes-panel">
        <article className="surface market-posting">
          <div className="surface-head">
            <p className="card-label">Post a listing</p>
            <span className="badge subtle">Trust tier {getOwnTrustTier(state.profile)}</span>
          </div>
          <form className="market-form" onSubmit={handleListingSubmit}>
            <label>
              Title
              <input value={listingDraft.title} onChange={(event) => setListingDraft((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label>
              Category
              <select value={listingDraft.category} onChange={(event) => setListingDraft((current) => ({ ...current, category: event.target.value }))}>
                {listingCategories.map((category) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select value={listingDraft.type} onChange={(event) => setListingDraft((current) => ({ ...current, type: event.target.value }))}>
                {listingTypes.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Contact
              <select value={listingDraft.contactId} onChange={(event) => setListingDraft((current) => ({ ...current, contactId: event.target.value }))}>
                {state.contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.displayName || contact.name} · {getContactTrustTier(contact)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              City
              <input value={listingDraft.city} onChange={(event) => setListingDraft((current) => ({ ...current, city: event.target.value }))} />
            </label>
            <label>
              Neighborhood
              <input value={listingDraft.neighborhood} onChange={(event) => setListingDraft((current) => ({ ...current, neighborhood: event.target.value }))} />
            </label>
            <label>
              Price
              <input type="number" value={listingDraft.price} onChange={(event) => setListingDraft((current) => ({ ...current, price: event.target.value }))} />
            </label>
            <label>
              Description
              <textarea value={listingDraft.description} onChange={(event) => setListingDraft((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label>
              Tags
              <input value={listingDraft.tags} onChange={(event) => setListingDraft((current) => ({ ...current, tags: event.target.value }))} placeholder={listingTags.join(", ")} />
            </label>
            <label>
              Photos
              <input value={listingDraft.photos} onChange={(event) => setListingDraft((current) => ({ ...current, photos: event.target.value }))} placeholder="Comma-separated URLs" />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={listingDraft.featured} onChange={(event) => setListingDraft((current) => ({ ...current, featured: event.target.checked }))} />
              Featured
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={listingDraft.verified} onChange={(event) => setListingDraft((current) => ({ ...current, verified: event.target.checked }))} />
              Verified badge
            </label>
            <button type="submit" className="accent-button" disabled={busy || commerceBlocked}>
              Submit listing
            </button>
            {commerceBlocked ? <p className="error-text">{commercePolicy.reason}</p> : null}
          </form>
        </article>
      </section>
    </>
  );
}

const officialAccountThreadMap = {
  "foxhub-news": "foxhub-newsroom",
  "atl-culture": "atl-culture-wire",
  "wallet-watch": "wallet-watch"
};

function moderationBadgeClass(status) {
  if (status === "block") return "badge block";
  if (status === "review") return "badge review";
  return "badge subtle";
}

function PayWorkspace({ state, busy, handleWalletAction, runQrFlow, runUtilityCard, selectedThread }) {
  const moderationCases = state.moderationCases || [];
  const blockedCount = moderationCases.filter((item) => item.status === "block").length;
  const reviewCount = moderationCases.filter((item) => item.status === "review").length;
  const activeContact =
    state.contacts.find((contact) => contact.id === selectedThread?.id) ||
    state.contacts.find((contact) => contact.name === selectedThread?.name) ||
    null;
  const activeTrustTier = getContactTrustTier(activeContact || {});
  const billPayProviders = state.utilityBillPayProviders || [];
  const billPayPayments = state.utilityBillPayPayments || [];
  const readyBillers = billPayProviders.filter((item) => item.status === "ready").length;
  return (
    <>
      <section className="surface-row two-up">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Pay</p>
            <span className="badge">Moderator live</span>
          </div>
          <div className="surface-note">
            Payment actions stay compact and close to conversation, but risky flows get intercepted before money moves.
          </div>
          {activeContact ? (
            <div className="trust-transaction-card">
              <div className="thread-topline">
                <strong>{activeContact.displayName || activeContact.name}</strong>
                <span className={trustTierBadgeClass(activeTrustTier)}>{activeTrustTier} · {getTrustTierMeta(activeTrustTier).label}</span>
              </div>
              <p>{getTrustRestrictionLine(activeTrustTier)}</p>
            </div>
          ) : null}
          <div className="wallet-card">
            <span>Available balance</span>
            <strong>$3,280.55</strong>
            <p>Keep transfers and merchant pay close to conversation so money feels like part of the thread, not a separate tool.</p>
            <div className="moderation-summary">
              <div className="moderation-pill">
                <span>In review</span>
                <strong>{reviewCount}</strong>
              </div>
              <div className="moderation-pill danger">
                <span>Blocked</span>
                <strong>{blockedCount}</strong>
              </div>
            </div>
          </div>
          <div className="inline-actions wrap">
            <button type="button" className="accent-button" onClick={() => void handleWalletAction("send")} disabled={busy}>
              Send
            </button>
            <button type="button" className="ghost-button" onClick={() => void handleWalletAction("add")} disabled={busy}>
              Add cash
            </button>
            <button type="button" className="ghost-button" onClick={() => void handleWalletAction("cashout")} disabled={busy}>
              Cash out
            </button>
            <button type="button" className="ghost-button" onClick={() => void runQrFlow("qr-pay")} disabled={busy}>
              Scan to pay
            </button>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Moderator layer</p>
            <span className={reviewCount || blockedCount ? "badge review" : "badge subtle"}>
              {moderationCases.length} cases
            </span>
          </div>
          <div className="surface-note">
            If/then rules moderate wallet actions using access state, counterparty trust, thread context, and velocity.
          </div>
          <div className="list-stack">
            <div className="moderation-rule-card">
              <strong>Moderator controls</strong>
              <p>Authenticated access, complete identity, verified thread context, counterparty trust, merchant review state, and rapid wallet velocity.</p>
            </div>
            <div className="inline-actions wrap">
              {state.utilityCards.map((card) => (
                <button key={card.id} type="button" className="ghost-button" onClick={() => void runUtilityCard(card.id)} disabled={busy}>
                  {card.name}
                </button>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="surface-row two-up">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Universal bill pay</p>
            <span className="badge">{readyBillers}/{billPayProviders.length} ready</span>
          </div>
          <div className="surface-note">
            Utility service bills share one wallet path for account checks, scheduled payments, autopay, reminders, and receipts.
          </div>
          <div className="list-stack">
            {billPayProviders.map((provider) => (
              <div key={provider.id} className="list-row">
                <div>
                  <strong>{provider.name}</strong>
                  <p>{provider.category} · Acct {provider.accountMask} · Due {provider.dueDate}</p>
                  <p>{provider.memo}</p>
                </div>
                <div className="billpay-side">
                  <div className="amount">{provider.dueAmount}</div>
                  <span className={provider.status === "ready" ? "badge subtle" : "badge review"}>
                    {provider.autopay ? "Autopay" : provider.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="inline-actions wrap">
            <button type="button" className="accent-button" onClick={() => void handleWalletAction("utility")} disabled={busy}>
              Pay next bill
            </button>
            <button type="button" className="ghost-button" onClick={() => void runUtilityCard("billpay")} disabled={busy}>
              Review billers
            </button>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Bill pay ledger</p>
            <span className="badge subtle">{billPayPayments.length} scheduled</span>
          </div>
          <div className="surface-note">
            Receipt status and payment method stay visible beside the normal wallet activity feed.
          </div>
          <div className="list-stack">
            {billPayPayments.map((payment) => (
              <div key={payment.id} className="list-row">
                <div>
                  <strong>{payment.providerName}</strong>
                  <p>{payment.method} · {payment.scheduledFor}</p>
                  <p>{payment.receiptState}</p>
                </div>
                <div className="billpay-side">
                  <div className="amount">{payment.amount}</div>
                  <span className={payment.status === "scheduled" ? "badge subtle" : "badge review"}>{payment.status}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Recent activity</p>
            <span className="badge subtle">{state.walletEvents.length} events</span>
          </div>
          <div className="list-stack">
            {state.walletEvents.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.meta}</p>
                </div>
                <div className="amount">{item.amount}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Moderator queue</p>
            <span className={blockedCount ? "badge block" : reviewCount ? "badge review" : "badge subtle"}>
              {blockedCount ? `${blockedCount} blocked` : reviewCount ? `${reviewCount} held` : "Clear"}
            </span>
          </div>
          <div className="surface-note">
            Users stay on the curated path while risky wallet attempts get logged for operator review.
          </div>
          <div className="list-stack">
            {moderationCases.length ? (
              moderationCases.slice(0, 5).map((item) => (
                <div key={item.id} className="moderation-case">
                  <div className="moderation-case-head">
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.threadName}{item.contactName ? ` · ${item.contactName}` : ""}</p>
                    </div>
                    <span className={moderationBadgeClass(item.status)}>{item.outcomeLabel || item.status}</span>
                  </div>
                  {item.trustTier ? <p className="moderation-tier">Trust tier {item.trustTier}</p> : null}
                  <p className="moderation-copy">{item.detail}</p>
                  <p className="moderation-meta">
                    {item.amount || "No amount"} · {item.createdAtLabel}
                  </p>
                  <p className="moderation-basis">{item.basis}</p>
                  <p className="moderation-next">{item.recommendedAction}</p>
                </div>
              ))
            ) : (
              <div className="moderation-rule-card">
                <strong>No moderator cases yet</strong>
                <p>Allowed wallet actions stay lightweight. Only held or blocked actions are routed into this queue.</p>
              </div>
            )}
          </div>
        </article>
      </section>
      {!state.walletEvents.length && !state.utilityCards.length ? <FilteredEmptyState label="Pay" /> : null}
    </>
  );
}

function WeChatParityPanel({ packs, runService }) {
  const featureCount = packs.reduce((sum, pack) => sum + pack.features.length, 0);

  return (
    <article className="surface surface-strong">
      <div className="surface-head">
        <p className="card-label">WeChat gap install</p>
        <span className="badge subtle">{packs.length} packs · {featureCount} items</span>
      </div>
      <div className="surface-note">
        Simple install list for the non-video WeChat gaps. Channels and video are intentionally excluded.
      </div>
      <div className="list-stack">
        {packs.map((pack) => (
          <div key={pack.id} className="list-row">
            <div>
              <div className="thread-topline">
                <strong>{pack.name}</strong>
                <span className="badge subtle">{pack.area}</span>
              </div>
              <p>{pack.summary}</p>
              <div className="tag-row">
                {pack.features.map((feature) => (
                  <span key={feature} className="template-tag">{feature}</span>
                ))}
              </div>
            </div>
            <div className="inline-actions wrap">
              <span className="badge">{pack.status}</span>
              <button type="button" className="ghost-button small" onClick={() => void runService(pack.routeServiceId)}>
                Open
              </button>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function ServicesWorkspace({ state, activeMiniApp, selectedThread, activeCircle, busy, runService, selectMiniApp, handleLaunchMiniApp, runQrFlow, toggleOfficialAccountSubscription, openOfficialThread, openContinuityItem, openSearchScope, boilerplateGroups, saveRoutePlan, registerMiniProgramManifest, uploadDocumentEvidence, submitVerificationCase, resolveVerificationCase, updateComplianceControl, reportTrustSafetyIncident, runMerchantRiskCheck, submitMerchantApplication, upsertMerchantInventoryItem, updateMerchantStorefrontSettings, updateMerchantOnboarding, reviewMerchantSettlement, updateMerchantPayoutControl, updateMerchantLocationStatus, openDisputeCase, resolveDisputeCase, markNotificationRead, revokeDeviceSession, registerBrowserNotifications, registerMiniAppRuntime, invokeMiniAppRuntimeEvent, queueReliableMutation, activateProductionComponent, runProductionComponent }) {
  const rankedMiniApps = rankMiniApps(state, selectedThread, activeCircle);
  const recentQrHistory = state.qrHistory.slice(0, 4);
  const recentMiniApps = state.miniAppRecents.slice(0, 4);
  const faqItems = [
    {
      question: "What should a new user do first?",
      answer: "Finish the profile card, start in chats, and then open one service surface. That is the shortest path to understanding how FoxHub works."
    },
    {
      question: "How do invite codes work?",
      answer: "A valid invite code gives immediate access during sign-up. Without one, the account enters the review queue until access opens."
    },
    {
      question: "Where do I manage my account details?",
      answer: "Open Profile from the header. That is where identity details, invite creation, and tutorial status live."
    },
    {
      question: "Is FoxHub mainly for chat or services?",
      answer: "Chat is the primary operating layer. Services, payments, and local discovery are attached to that identity and thread context."
    },
    {
      question: "How does FoxHub handle trust, safety, and compliance?",
      answer: "FoxHub now includes operator controls for sanctions-aware onboarding checks, dispute handling, trust and safety incident reporting, and merchant risk monitoring."
    }
  ];
  const [routeDraft, setRouteDraft] = useState({ name: "", origin: "", destination: "", stops: 0, etaMinutes: 15, mode: "drive" });
  const [manifestDraft, setManifestDraft] = useState({ appId: "", version: "1.0.0", permissions: "identity,wallet,contacts", events: "thread:return", status: "draft" });
  const [verificationDraft, setVerificationDraft] = useState({ targetId: "", targetType: "merchant", label: "", requestedItems: "government id,bank account,tax profile", owner: "Ops" });
  const [documentDraft, setDocumentDraft] = useState({ targetId: "", targetType: "profile", name: "", kind: "verification", mimeType: "application/pdf", status: "stored", source: "manual upload" });
  const [incidentDraft, setIncidentDraft] = useState({ type: "merchant_impersonation_report", severity: "medium", channel: "market", detail: "", owner: "Trust Ops" });
  const [disputeDraft, setDisputeDraft] = useState({ merchantName: "", merchantId: "", amount: "$0.00", reason: "cardholder_dispute", owner: "Payments Ops", detail: "" });
  const [merchantApplicationDraft, setMerchantApplicationDraft] = useState({
    merchantName: state.profile?.name ? `${state.profile.name} Business` : "",
    businessType: "Local services",
    category: "Services",
    city: state.profile?.city || "",
    zipCode: state.profile?.zipCode || state.profile?.postalCode || "",
    website: state.profile?.website || "",
    description: ""
  });
  const [merchantApplicationNotice, setMerchantApplicationNotice] = useState("");
  const merchantAccount = state.profile?.merchantAccount || {};
  const merchantStatus = merchantAccount.status || state.profile?.merchantStatus || "";
  const merchantApproved = ["approved", "active", "verified"].includes(String(merchantStatus).toLowerCase());
  const merchantInventory = merchantAccount.inventory || [
    { id: "starter-item-1", sku: "starter-service", title: "Starter service", price: 75, stock: 10, status: "draft" },
    { id: "starter-item-2", sku: "local-pickup", title: "Local pickup item", price: 25, stock: 24, status: "draft" }
  ];
  const merchantSettings = merchantAccount.settings || {
    storefrontStatus: "draft",
    fulfillmentMode: "local pickup",
    payoutSchedule: "weekly",
    returnsPolicy: "7-day review",
    supportContact: state.profile?.email || ""
  };
  const [inventoryDraft, setInventoryDraft] = useState({ title: "", sku: "", price: 0, stock: 0, status: "active" });
  const [storefrontSettingsDraft, setStorefrontSettingsDraft] = useState(merchantSettings);
  const [serviceTab, setServiceTab] = useState("overview");
  const [serviceCatalogQuery, setServiceCatalogQuery] = useState("");
  const [serviceCatalogType, setServiceCatalogType] = useState("all");
  const [blueCollarCategoryId, setBlueCollarCategoryId] = useState(blueCollarServiceCategories[0]?.id || "");
  const [merchantBlueCollarCategoryId, setMerchantBlueCollarCategoryId] = useState(blueCollarServiceCategories[0]?.id || "");
  const [whiteCollarCategoryId, setWhiteCollarCategoryId] = useState(whiteCollarServiceCategories[0]?.id || "");
  const [merchantWhiteCollarCategoryId, setMerchantWhiteCollarCategoryId] = useState(whiteCollarServiceCategories[0]?.id || "");
  const [blackCollarCategoryId, setBlackCollarCategoryId] = useState(blackCollarServiceCategories[0]?.id || "");
  const [merchantBlackCollarCategoryId, setMerchantBlackCollarCategoryId] = useState(blackCollarServiceCategories[0]?.id || "");
  const [yellowCollarCategoryId, setYellowCollarCategoryId] = useState(yellowCollarServiceCategories[0]?.id || "");
  const [merchantYellowCollarCategoryId, setMerchantYellowCollarCategoryId] = useState(yellowCollarServiceCategories[0]?.id || "");
  const [greenCollarCategoryId, setGreenCollarCategoryId] = useState(greenCollarServiceCategories[0]?.id || "");
  const [merchantGreenCollarCategoryId, setMerchantGreenCollarCategoryId] = useState(greenCollarServiceCategories[0]?.id || "");
  const [pinkCollarCategoryId, setPinkCollarCategoryId] = useState(pinkCollarServiceCategories[0]?.id || "");
  const [merchantPinkCollarCategoryId, setMerchantPinkCollarCategoryId] = useState(pinkCollarServiceCategories[0]?.id || "");
  const [brownCollarCategoryId, setBrownCollarCategoryId] = useState(brownCollarServiceCategories[0]?.id || "");
  const [merchantBrownCollarCategoryId, setMerchantBrownCollarCategoryId] = useState(brownCollarServiceCategories[0]?.id || "");
  const [purpleCollarCategoryId, setPurpleCollarCategoryId] = useState(purpleCollarServiceCategories[0]?.id || "");
  const [merchantPurpleCollarCategoryId, setMerchantPurpleCollarCategoryId] = useState(purpleCollarServiceCategories[0]?.id || "");
  const unreadNotifications = (state.notificationEvents || []).filter((item) => item.status !== "read").slice(0, 4);
  const verificationQueue = (state.verificationCases || []).slice(0, 6);
  const complianceTail = (state.compliancePrograms || []).slice(0, 6);
  const trustIncidentTail = (state.trustSafetyIncidents || []).slice(0, 6);
  const merchantOnboardingTail = (state.merchantOnboardingQueue || []).slice(0, 6);
  const merchantRiskTail = (state.merchantRiskSignals || []).slice(0, 6);
  const disputeTail = (state.disputeCases || []).slice(0, 6);
  const merchantSettlementTail = (state.merchantSettlements || []).slice(0, 6);
  const merchantPayoutControlTail = (state.merchantPayoutControls || []).slice(0, 6);
  const merchantLocationTail = (state.merchantLocations || []).slice(0, 6);
  const liveTerminals = merchantLocationTail.filter((item) => item.status === "live").length;
  const settlementsDue = merchantSettlementTail.filter((item) => item.status === "review" || item.status === "ready").length;
  const payoutRisk = merchantPayoutControlTail.filter((item) => item.state === "hold").length;
  const merchantSummary = merchantOpsSuite?.summary || {};
  const merchantQueueSnapshots = merchantOpsSuite?.queues || [];
  const merchantActionCards = merchantOpsSuite?.actions || [];
  const highlightedQueues = merchantQueueSnapshots.slice(0, 3);
  const complianceHighlights = compliancePrograms.slice(0, 3);
  const merchantTrustIncidents = trustSafetyIncidents
    .filter((incident) => (incident.type || "").includes("merchant") || incident.channel === "market")
    .slice(0, 3);
  const formatIncidentDate = (value) => {
    if (!value) return "Unknown";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? "Unknown"
      : parsed.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  };
  const merchantActionHandlers = {
    "merchant-pay": () => void handleWalletAction("merchant"),
    "merchant-qr": () => void runQrFlow("qr-pay"),
    "merchant-wallet": () => void runService("merchant"),
    "merchant-watch": () => void openOfficialThread("wallet-watch")
  };
  const merchantMetrics = [
    { label: "Locations", value: merchantSummary.locations ?? 0, helper: "total storefronts" },
    { label: "Live terminals", value: merchantSummary.liveTerminals ?? 0, helper: "QR lanes running" },
    { label: "Settlements due", value: merchantSummary.settlementsDue ?? "$0", helper: "awaiting release" },
    { label: "Payout risk", value: merchantSummary.payoutRisk ?? 0, helper: "on hold" }
  ];
  const merchantCoverageGroups = merchantServiceComponents.reduce((groups, component) => {
    const key = component.category || "Operations";
    return {
      ...groups,
      [key]: [...(groups[key] || []), component]
    };
  }, {});
  const miniMechanicGroups = miniProgramMechanics.reduce((groups, mechanic) => {
    const key = mechanic.area || "Runtime";
    return {
      ...groups,
      [key]: [...(groups[key] || []), mechanic]
    };
  }, {});
  const merchantCoverageScore = merchantServiceComponents.length
    ? Math.round((merchantServiceComponents.filter((component) => component.status === "installed").length / merchantServiceComponents.length) * 100)
    : 0;
  const miniCoverageScore = miniProgramMechanics.length
    ? Math.round((miniProgramMechanics.filter((mechanic) => mechanic.status === "installed").length / miniProgramMechanics.length) * 100)
    : 0;
  const serviceCatalog = state.services || [];
  const serviceTypes = useMemo(() => Array.from(new Set(serviceCatalog.map((service) => service.type))).sort(), [serviceCatalog]);
  const catalogQuery = serviceCatalogQuery.trim().toLowerCase();
  const filteredServiceCatalog = useMemo(
    () =>
      serviceCatalog.filter((service) => {
        const typeMatch = serviceCatalogType === "all" || service.type === serviceCatalogType;
        const queryMatch =
          !catalogQuery ||
          [service.name, service.type, service.blurb].some((value) => String(value || "").toLowerCase().includes(catalogQuery));
        return typeMatch && queryMatch;
      }),
    [serviceCatalog, serviceCatalogType, catalogQuery]
  );
  const merchantServiceTypes = new Set(["Business", "Money", "Market", "Food", "Events", "Work", "Mobility", "Community"]);
  const merchantSideServices = serviceCatalog.filter((service) => merchantServiceTypes.has(service.type));
  const auditTail = (state.auditEvents || []).slice(0, 6);
  const deviceTail = (state.deviceSessions || []).slice(0, 6);
  const documentTail = (state.documentVault || []).slice(0, 6);
  const operatorTail = (state.operatorActions || []).slice(0, 6);
  const operatorAccessTail = (state.operatorAccessRecords || []).slice(0, 4);
  const notificationSubscriptionTail = (state.notificationSubscriptions || []).slice(0, 4);
  const readStateTail = (state.threadReadState || []).slice(0, 4);
  const productionComponents = state.productionComponents || [];
  const activeProductionCount = productionComponents.filter((item) => item.status === "active" || item.status === "running").length;
  const productionEvents = (state.productionEvents || []).slice(0, 6);
  const productionOutputs = [
    ...(state.serverJobs || []),
    ...(state.pushDeliveries || []),
    ...(state.storageObjects || []),
    ...(state.authHardeningChecks || []),
    ...(state.rbacAssignments || []),
    ...(state.paymentWebhookEvents || []),
    ...(state.searchIndexJobs || []),
    ...(state.miniAppSandboxSessions || []),
    ...(state.geoIndexRecords || []),
    ...(state.moderationPipelineCases || []),
    ...(state.analyticsExports || []),
    ...(state.smokeTestRuns || [])
  ]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 8);
  const serviceLibraryTabs = [
    { id: "overview", label: "Overview", meta: `${state.searchScopes.length} ways to search` },
    { id: "catalog", label: "Catalog", meta: `${serviceCatalog.length} services` },
    { id: "parity", label: "Parity", meta: `${weChatParityInstallPacks.length} packs` },
    { id: "mini", label: "Mini Apps", meta: `${miniProgramMechanics.length} helpers` },
    { id: "merchant", label: "Shops", meta: `${merchantServiceComponents.length} tools` },
    { id: "compliance", label: "Safety", meta: `${complianceTail.length} checks` },
    { id: "production", label: "Back Room", meta: `${state.productionComponents?.length || 0} helpers` },
    { id: "routes", label: "Routes", meta: `${state.routePlans?.length || 0} saved` },
    { id: "channels", label: "Channels", meta: `${state.officialAccounts.length} accounts` }
  ];

  async function submitRoutePlan(event) {
    event.preventDefault();
    if (!routeDraft.name.trim()) return;
    await saveRoutePlan(routeDraft);
    setRouteDraft({ name: "", origin: "", destination: "", stops: 0, etaMinutes: 15, mode: "drive" });
  }

  async function submitManifest(event) {
    event.preventDefault();
    if (!manifestDraft.appId.trim()) return;
    await registerMiniProgramManifest({
      ...manifestDraft,
      permissions: manifestDraft.permissions.split(",").map((item) => item.trim()).filter(Boolean),
      events: manifestDraft.events.split(",").map((item) => item.trim()).filter(Boolean)
    });
    setManifestDraft({ appId: "", version: "1.0.0", permissions: "identity,wallet,contacts", events: "thread:return", status: "draft" });
  }

  function submitVerification(event) {
    event.preventDefault();
    if (!verificationDraft.targetId.trim() || !verificationDraft.label.trim()) return;
    submitVerificationCase({
      ...verificationDraft,
      requestedItems: verificationDraft.requestedItems.split(",").map((item) => item.trim()).filter(Boolean),
      status: "review",
      stage: "intake"
    });
    setVerificationDraft({ targetId: "", targetType: "merchant", label: "", requestedItems: "government id,bank account,tax profile", owner: "Ops" });
  }

  async function submitDocument(event) {
    event.preventDefault();
    if (!documentDraft.targetId.trim() || !documentDraft.name.trim()) return;
    await uploadDocumentEvidence(documentDraft);
    setDocumentDraft({ targetId: "", targetType: "profile", name: "", kind: "verification", mimeType: "application/pdf", status: "stored", source: "manual upload" });
  }

  function submitIncident(event) {
    event.preventDefault();
    if (!incidentDraft.detail.trim()) return;
    reportTrustSafetyIncident(incidentDraft);
    setIncidentDraft({ type: "merchant_impersonation_report", severity: "medium", channel: "market", detail: "", owner: "Trust Ops" });
  }

  function submitDispute(event) {
    event.preventDefault();
    if (!disputeDraft.merchantName.trim() || !disputeDraft.reason.trim()) return;
    openDisputeCase(disputeDraft);
    setDisputeDraft({ merchantName: "", merchantId: "", amount: "$0.00", reason: "cardholder_dispute", owner: "Payments Ops", detail: "" });
  }

  function submitMemberMerchantApplication(event) {
    event.preventDefault();
    if (!merchantApplicationDraft.merchantName.trim() || !merchantApplicationDraft.businessType.trim() || !merchantApplicationDraft.zipCode.trim()) return;
    submitMerchantApplication?.(merchantApplicationDraft);
    setMerchantApplicationNotice("Merchant application sent to FoxHub Management.");
    setMerchantApplicationDraft((current) => ({
      ...current,
      merchantName: "",
      description: "",
      website: current.website,
      city: current.city,
      zipCode: current.zipCode
    }));
  }

  function submitInventoryItem(event) {
    event.preventDefault();
    if (!inventoryDraft.title.trim()) return;
    upsertMerchantInventoryItem?.(inventoryDraft);
    setInventoryDraft({ title: "", sku: "", price: 0, stock: 0, status: "active" });
  }

  function submitStorefrontSettings(event) {
    event.preventDefault();
    updateMerchantStorefrontSettings?.(storefrontSettingsDraft);
  }

  return (
    <>
      <section className="service-library-tabs" aria-label="Services library tabs">
        {serviceLibraryTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={serviceTab === item.id ? "service-library-tab active" : "service-library-tab"}
            onClick={() => {
              setServiceTab(item.id);
              if (item.id === "merchant") selectMiniApp("merchantos");
            }}
          >
            <strong>{item.label}</strong>
            <span>{item.meta}</span>
          </button>
        ))}
      </section>

      <div className={`service-library service-tab-${serviceTab}`}>
      <section className="surface-row service-panel catalog-panel">
        <ServiceCategoryPanel
          title="Blue-collar cats and sub-cats"
          detail="Pick the plain category first, then choose a specific service type. Each category stays tied to quote, scheduling, proof, payment, and trust basics."
          categories={blueCollarServiceCategories}
          activeCategoryId={blueCollarCategoryId}
          setActiveCategoryId={setBlueCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row service-panel catalog-panel">
        <ServiceCategoryPanel
          title="White-collar cats and sub-cats"
          detail="Professional services stay just as simple: pick a category, choose the need, then route into documents, quotes, scheduling, and follow-up."
          categories={whiteCollarServiceCategories}
          activeCategoryId={whiteCollarCategoryId}
          setActiveCategoryId={setWhiteCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row service-panel catalog-panel">
        <ServiceCategoryPanel
          title="Black-collar cats and sub-cats"
          detail="Heavy, dirty, hazardous, industrial, energy, waste, field, and infrastructure work with safety, proof, dispatch, and service logs kept simple."
          categories={blackCollarServiceCategories}
          activeCategoryId={blackCollarCategoryId}
          setActiveCategoryId={setBlackCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row service-panel catalog-panel">
        <ServiceCategoryPanel
          title="Yellow-collar cats and sub-cats"
          detail="Creative, media, design, performance, content, style, and interactive work with briefs, rights, revisions, and delivery kept simple."
          categories={yellowCollarServiceCategories}
          activeCategoryId={yellowCollarCategoryId}
          setActiveCategoryId={setYellowCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row service-panel catalog-panel">
        <ServiceCategoryPanel
          title="Green-collar cats and sub-cats"
          detail="Environmental, clean-energy, recycling, conservation, green building, agriculture, and climate-resilience work with audits and proof kept simple."
          categories={greenCollarServiceCategories}
          activeCategoryId={greenCollarCategoryId}
          setActiveCategoryId={setGreenCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row service-panel catalog-panel">
        <ServiceCategoryPanel
          title="Pink-collar cats and sub-cats"
          detail="Care, service, teaching, hospitality, retail, admin, wellness, beauty, and household work with schedules, notes, and follow-up kept simple."
          categories={pinkCollarServiceCategories}
          activeCategoryId={pinkCollarCategoryId}
          setActiveCategoryId={setPinkCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row service-panel catalog-panel">
        <ServiceCategoryPanel
          title="Brown-collar cats and sub-cats"
          detail="Public works, civic field support, postal, uniformed support, grounds, sanitation, yard, and inspection work with route logs and proof kept simple."
          categories={brownCollarServiceCategories}
          activeCategoryId={brownCollarCategoryId}
          setActiveCategoryId={setBrownCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row service-panel catalog-panel">
        <ServiceCategoryPanel
          title="Purple-collar cats and sub-cats"
          detail="Hybrid technical work that blends hands-on operations with IT, automation, smart building, data, AV, logistics, and security support."
          categories={purpleCollarServiceCategories}
          activeCategoryId={purpleCollarCategoryId}
          setActiveCategoryId={setPurpleCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row service-panel catalog-panel">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Service catalog</p>
            <span className="badge subtle">{filteredServiceCatalog.length}/{serviceCatalog.length} services</span>
          </div>
          <div className="surface-note">
            Search every useful FoxHub service from one place. The same catalog is also available from the merchant side for business-facing work.
          </div>
          <div className="toolbar-row">
            <input
              type="search"
              className="toolbar-search"
              placeholder="Search services, payments, events, support..."
              value={serviceCatalogQuery}
              onChange={(event) => setServiceCatalogQuery(event.target.value)}
            />
            <select value={serviceCatalogType} onChange={(event) => setServiceCatalogType(event.target.value)}>
              <option value="all">All categories</option>
              {serviceTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="service-grid catalog-service-grid">
            {filteredServiceCatalog.map((service) => (
              <button key={service.id} type="button" className="service-card" onClick={() => void runService(service.id)}>
                <p>{service.type}</p>
                <strong>{service.name}</strong>
                <span>{service.blurb}</span>
              </button>
            ))}
          </div>
          {!filteredServiceCatalog.length ? <p className="panel-copy">No services match that search.</p> : null}
        </article>
      </section>

      <section className="surface-row service-panel parity-panel">
        <WeChatParityPanel packs={weChatParityInstallPacks} runService={runService} />
      </section>

      <section className="surface-row two-up service-panel production-panel">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Back Room</p>
            <span className="badge subtle">{activeProductionCount}/{productionComponents.length} active</span>
          </div>
          <div className="surface-note">
            These helpers keep FoxHub safer, smoother, and easier to support as more people use it.
          </div>
          <div className="glance-strip compact">
            <div className="glance-card warm">
              <span>Helpers</span>
              <strong>{productionComponents.length}</strong>
            </div>
            <div className="glance-card cool">
              <span>Updates</span>
              <strong>{productionOutputs.length}</strong>
            </div>
            <div className="glance-card soft">
              <span>Activity</span>
              <strong>{state.productionEvents?.length || 0}</strong>
            </div>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Recent back-room activity</p>
            <span className="badge subtle">{productionOutputs.length} updates</span>
          </div>
          <div className="list-stack">
            {productionOutputs.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.componentName || item.componentKey}</strong>
                  <p>{item.detail || item.status}</p>
                </div>
                <span className="badge subtle">{item.owner || item.status}</span>
              </div>
            ))}
            {!productionOutputs.length ? <p className="panel-copy">Try a helper to create the first update.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row service-panel production-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Turn on and try</p>
            <span className="badge subtle">{productionComponents.length} ready</span>
          </div>
          <div className="blueprint-list">
            {productionComponents.map((component) => (
              <div key={component.key} className="blueprint-component-row">
                <span className="blueprint-order">{component.surface}</span>
                <div>
                  <strong>{component.name}</strong>
                  <p>{component.detail}</p>
                </div>
                <div className="blueprint-actions">
                  <span className={component.status === "active" || component.status === "running" ? "badge" : "badge subtle"}>
                    {component.status}
                  </span>
                  <button type="button" className="ghost-button small" onClick={() => activateProductionComponent?.(component.key)} disabled={busy}>
                    Activate
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => runProductionComponent?.(component.key)} disabled={busy}>
                    Run
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel production-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Back-room activity</p>
            <span className="badge subtle">{productionEvents.length} recent</span>
          </div>
          <div className="list-stack">
            {productionEvents.map((event) => (
              <div key={event.id} className="list-row">
                <div>
                  <strong>{event.action}</strong>
                  <p>{event.detail}</p>
                </div>
                <span className="badge subtle">{event.componentKey}</span>
              </div>
            ))}
            {!productionEvents.length ? <p className="panel-copy">No back-room actions have run yet.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Phone alerts</p>
            <span className="badge">Installed</span>
          </div>
          <div className="list-stack">
            <div className="list-row">
              <div>
                <strong>@capacitor/push-notifications</strong>
                <p>Phone alerts are ready for the iPhone and Android versions.</p>
              </div>
              <span className="badge subtle">Capacitor</span>
            </div>
            <div className="list-row">
              <div>
                <strong>Support tools are ready</strong>
                <p>The payment, message, email, and document helpers are waiting in the back room.</p>
              </div>
              <span className="badge subtle">Back room</span>
            </div>
          </div>
        </article>
      </section>

      <section className="surface-row service-panel overview-panel">
        <DiscoveryInfluencePanel openSearchScope={openSearchScope} />
      </section>

      <section className="surface-row service-panel overview-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">FAQ page</p>
            <span className="badge subtle">{faqItems.length} answers</span>
          </div>
          <div className="surface-note">
            Fast answers for new people, invites, profiles, and how to get around FoxHub.
          </div>
          <div className="list-stack">
            {faqItems.map((item) => (
              <div key={item.question} className="list-row">
                <div>
                  <strong>{item.question}</strong>
                  <p>{item.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row three-up service-panel overview-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Compliance controls</p>
            <span className="badge subtle">{complianceTail.length} tracked</span>
          </div>
          <div className="surface-note">
            Core controls tied to sanctions screening, customer due diligence, payment-data security, and information-security safeguards.
          </div>
          <div className="list-stack">
            {complianceTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.framework}</strong>
                  <p>{item.control}</p>
                </div>
                <div className="inline-actions wrap">
                  <span className="row-meta-text">{item.status} · {item.cadence}</span>
                  <button type="button" className="ghost-button small" onClick={() => updateComplianceControl(item.id, "in_review")}>In review</button>
                  <button type="button" className="ghost-button small" onClick={() => updateComplianceControl(item.id, "active")}>Active</button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Trust and safety</p>
            <span className="badge subtle">{trustIncidentTail.length} incidents</span>
          </div>
          <form className="market-form" onSubmit={submitIncident}>
            <label>
              Incident type
              <select value={incidentDraft.type} onChange={(event) => setIncidentDraft((current) => ({ ...current, type: event.target.value }))}>
                <option value="account_takeover_attempt">Account takeover attempt</option>
                <option value="merchant_impersonation_report">Merchant impersonation</option>
                <option value="payment_fraud_signal">Payment fraud signal</option>
                <option value="harassment_report">Harassment report</option>
              </select>
            </label>
            <label>
              Severity
              <select value={incidentDraft.severity} onChange={(event) => setIncidentDraft((current) => ({ ...current, severity: event.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label>
              Detail
              <input value={incidentDraft.detail} onChange={(event) => setIncidentDraft((current) => ({ ...current, detail: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>File incident</button>
          </form>
          <div className="list-stack">
            {trustIncidentTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.type}</strong>
                  <p>{item.detail}</p>
                </div>
                <div className="row-meta-text">{item.severity} · {item.status}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Access and alerts</p>
            <span className="badge subtle">{notificationSubscriptionTail.length} subscriptions</span>
          </div>
          <div className="surface-note">
            Notification subscriptions and alert readiness live here with the rest of the operator and service control layer.
          </div>
          <div className="list-stack">
            {notificationSubscriptionTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.channel}</strong>
                  <p>{item.endpoint}</p>
                </div>
                <div className="row-meta-text">{item.permission} · {item.status}</div>
              </div>
            ))}
            {!notificationSubscriptionTail.length ? <p className="panel-copy">No notification subscriptions are registered yet.</p> : null}
          </div>
          <button type="button" className="ghost-button small wide" onClick={() => void registerBrowserNotifications?.()} disabled={busy}>
            Enable browser alerts
          </button>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Operator access</p>
            <span className="badge subtle">{operatorAccessTail.length} records</span>
          </div>
          <div className="list-stack">
            {operatorAccessTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.email || item.userId}</strong>
                  <p>{item.role} · {Array.isArray(item.scopes) ? item.scopes.join(", ") : "no scopes"}</p>
                </div>
                <div className="row-meta-text">{item.state || "active"}</div>
              </div>
            ))}
            {!operatorAccessTail.length ? <p className="panel-copy">No operator-access records are visible for this account.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Conversation continuity</p>
            <span className="badge subtle">{readStateTail.length} read markers</span>
          </div>
          <div className="list-stack">
            {readStateTail.map((item) => (
              <div key={item.threadId} className="list-row">
                <div>
                  <strong>{state.threads.find((thread) => thread.id === item.threadId)?.name || item.threadId}</strong>
                  <p>{item.lastReadAt ? new Date(item.lastReadAt).toLocaleString() : "No read timestamp"}</p>
                </div>
                <div className="row-meta-text">{item.unreadCount || 0} unread</div>
              </div>
            ))}
            {!readStateTail.length ? <p className="panel-copy">No read-state continuity markers yet.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <ServiceCategoryPanel
          title="Merchant cats and sub-cats"
          detail="Use the same blue-collar directory from the business side for lead intake, quotes, proof, scheduling, payout, and service follow-up."
          categories={blueCollarServiceCategories}
          mode="merchant"
          activeCategoryId={merchantBlueCollarCategoryId}
          setActiveCategoryId={setMerchantBlueCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <ServiceCategoryPanel
          title="Merchant white-collar cats"
          detail="Professional help for business admin, finance, compliance, marketing, creative work, tech, sales, hiring, real estate, and training."
          categories={whiteCollarServiceCategories}
          mode="merchant"
          activeCategoryId={merchantWhiteCollarCategoryId}
          setActiveCategoryId={setMerchantWhiteCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <ServiceCategoryPanel
          title="Merchant black-collar cats"
          detail="Industrial and field-service work for merchants, operators, facilities, yards, fleets, energy sites, and infrastructure teams."
          categories={blackCollarServiceCategories}
          mode="merchant"
          activeCategoryId={merchantBlackCollarCategoryId}
          setActiveCategoryId={setMerchantBlackCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <ServiceCategoryPanel
          title="Merchant yellow-collar cats"
          detail="Creative and media services for merchants, creators, events, campaigns, content, storefronts, and brand work."
          categories={yellowCollarServiceCategories}
          mode="merchant"
          activeCategoryId={merchantYellowCollarCategoryId}
          setActiveCategoryId={setMerchantYellowCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <ServiceCategoryPanel
          title="Merchant green-collar cats"
          detail="Environmental and sustainability services for energy, waste, water, buildings, fleets, food systems, and resilience work."
          categories={greenCollarServiceCategories}
          mode="merchant"
          activeCategoryId={merchantGreenCollarCategoryId}
          setActiveCategoryId={setMerchantGreenCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <ServiceCategoryPanel
          title="Merchant pink-collar cats"
          detail="Care, service, guest, admin, retail, education, wellness, beauty, and household support for customer-facing operators."
          categories={pinkCollarServiceCategories}
          mode="merchant"
          activeCategoryId={merchantPinkCollarCategoryId}
          setActiveCategoryId={setMerchantPinkCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <ServiceCategoryPanel
          title="Merchant brown-collar cats"
          detail="Civic, field, route, grounds, sanitation, yard, institutional, inspection, and seasonal operations for public-facing work."
          categories={brownCollarServiceCategories}
          mode="merchant"
          activeCategoryId={merchantBrownCollarCategoryId}
          setActiveCategoryId={setMerchantBrownCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <ServiceCategoryPanel
          title="Merchant purple-collar cats"
          detail="Hands-on technical services for devices, smart buildings, automation, AV, logistics systems, data operations, and cyber-physical support."
          categories={purpleCollarServiceCategories}
          mode="merchant"
          activeCategoryId={merchantPurpleCollarCategoryId}
          setActiveCategoryId={setMerchantPurpleCollarCategoryId}
          runService={runService}
        />
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Merchant service catalog</p>
            <span className="badge subtle">{merchantSideServices.length} business-ready</span>
          </div>
          <div className="surface-note">
            The merchant side gets quick access to payments, food and deals, events, local market, work requests, delivery, support, and business operations.
          </div>
          <div className="service-grid catalog-service-grid">
            {merchantSideServices.map((service) => (
              <button key={`merchant-${service.id}`} type="button" className="service-card" onClick={() => void runService(service.id)}>
                <p>{service.type}</p>
                <strong>{service.name}</strong>
                <span>{service.blurb}</span>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        {merchantApproved ? (
        <article className="surface surface-strong merchant-dashboard-card">
          <div className="surface-head">
            <p className="card-label">Merchant dashboard</p>
            <span className="badge">Approved seller tools</span>
          </div>
          <div className="surface-note">
            Approved merchants can manage storefront status, inventory, orders, payout settings, and seller operations from this dashboard.
          </div>
          <div className="starter-grid">
            <div className="starter-card">
              <strong>{merchantAccount.merchantName || state.profile?.name || "Merchant"}</strong>
              <span>{merchantStatus || "active"} · {merchantSettings.storefrontStatus || "draft"} storefront</span>
            </div>
            <div className="starter-card">
              <strong>{merchantInventory.length} items</strong>
              <span>{merchantInventory.filter((item) => Number(item.stock || 0) <= 3).length} low-stock alerts</span>
            </div>
            <div className="starter-card">
              <strong>{(state.fulfillmentOrders || []).length} orders</strong>
              <span>packing, pickup, tracking, and delivery controls</span>
            </div>
            <div className="starter-card">
              <strong>{merchantSettings.payoutSchedule || "weekly"} payouts</strong>
              <span>{merchantSettings.fulfillmentMode || "local pickup"} fulfillment</span>
            </div>
          </div>

          <div className="surface-row two-up merchant-controls-grid">
            <article className="surface">
              <div className="surface-head">
                <p className="card-label">Inventory</p>
                <span className="badge subtle">{merchantInventory.length} SKUs</span>
              </div>
              <form className="market-form" onSubmit={submitInventoryItem}>
                <label>
                  Item title
                  <input value={inventoryDraft.title} onChange={(event) => setInventoryDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Product or service" />
                </label>
                <label>
                  SKU
                  <input value={inventoryDraft.sku} onChange={(event) => setInventoryDraft((current) => ({ ...current, sku: event.target.value }))} placeholder="sku-name" />
                </label>
                <label>
                  Price
                  <input type="number" min="0" step="0.01" value={inventoryDraft.price} onChange={(event) => setInventoryDraft((current) => ({ ...current, price: event.target.value }))} />
                </label>
                <label>
                  Stock
                  <input type="number" min="0" value={inventoryDraft.stock} onChange={(event) => setInventoryDraft((current) => ({ ...current, stock: event.target.value }))} />
                </label>
                <button type="submit" className="ghost-button" disabled={busy || !inventoryDraft.title.trim()}>Save inventory item</button>
              </form>
              <div className="list-stack">
                {merchantInventory.slice(0, 6).map((item) => (
                  <div key={item.id} className="list-row">
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.sku} · ${Number(item.price || 0).toFixed(2)} · {Number(item.stock || 0)} in stock</p>
                    </div>
                    <span className={Number(item.stock || 0) <= 3 ? "badge" : "badge subtle"}>{item.status || "active"}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="surface">
              <div className="surface-head">
                <p className="card-label">Storefront settings</p>
                <span className="badge subtle">Seller setup</span>
              </div>
              <form className="market-form" onSubmit={submitStorefrontSettings}>
                <label>
                  Storefront status
                  <select value={storefrontSettingsDraft.storefrontStatus || "draft"} onChange={(event) => setStorefrontSettingsDraft((current) => ({ ...current, storefrontStatus: event.target.value }))}>
                    <option value="draft">Draft</option>
                    <option value="open">Open</option>
                    <option value="paused">Paused</option>
                  </select>
                </label>
                <label>
                  Fulfillment mode
                  <select value={storefrontSettingsDraft.fulfillmentMode || "local pickup"} onChange={(event) => setStorefrontSettingsDraft((current) => ({ ...current, fulfillmentMode: event.target.value }))}>
                    <option value="local pickup">Local pickup</option>
                    <option value="delivery">Delivery</option>
                    <option value="shipping">Shipping</option>
                    <option value="appointment">Appointment</option>
                  </select>
                </label>
                <label>
                  Payout schedule
                  <select value={storefrontSettingsDraft.payoutSchedule || "weekly"} onChange={(event) => setStorefrontSettingsDraft((current) => ({ ...current, payoutSchedule: event.target.value }))}>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="manual review">Manual review</option>
                  </select>
                </label>
                <label>
                  Returns policy
                  <input value={storefrontSettingsDraft.returnsPolicy || ""} onChange={(event) => setStorefrontSettingsDraft((current) => ({ ...current, returnsPolicy: event.target.value }))} />
                </label>
                <button type="submit" className="ghost-button" disabled={busy}>Save storefront settings</button>
              </form>
              <div className="list-stack">
                {(state.fulfillmentOrders || []).slice(0, 4).map((order) => (
                  <div key={order.id} className="list-row">
                    <div>
                      <strong>{order.trackingLabel || order.id}</strong>
                      <p>{order.carrier || "Local fulfillment"} · {order.eta || "ETA pending"}</p>
                    </div>
                    <span className="badge subtle">{order.status || "open"}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </article>
        ) : (
        <article className="surface surface-strong merchant-application-form">
          <div className="surface-head">
            <p className="card-label">Apply to become a merchant</p>
            <span className="badge subtle">{state.profile?.merchantStatus === "review" ? "In review" : "Member application"}</span>
          </div>
          <div className="surface-note">
            Submit a simple in-app application. FoxHub Management reviews business identity, tax profile, bank account confirmation, account age, and risk signals before approval.
          </div>
          {state.profile?.merchantAccount?.merchantName ? (
            <div className="entry-lock-note">
              <strong>{state.profile.merchantAccount.merchantName}</strong>
              <span>Status: {state.profile.merchantAccount.status || state.profile.merchantStatus || "review"}</span>
            </div>
          ) : null}
          <form className="market-form" onSubmit={submitMemberMerchantApplication}>
            <label>
              Business name
              <input
                value={merchantApplicationDraft.merchantName}
                onChange={(event) => setMerchantApplicationDraft((current) => ({ ...current, merchantName: event.target.value }))}
                placeholder="Business or storefront name"
              />
            </label>
            <label>
              Business type
              <select
                value={merchantApplicationDraft.businessType}
                onChange={(event) => setMerchantApplicationDraft((current) => ({ ...current, businessType: event.target.value }))}
              >
                <option value="Local services">Local services</option>
                <option value="Creator goods">Creator goods</option>
                <option value="Food and beverage">Food and beverage</option>
                <option value="Events and venues">Events and venues</option>
                <option value="Professional services">Professional services</option>
              </select>
            </label>
            <label>
              Category
              <input
                value={merchantApplicationDraft.category}
                onChange={(event) => setMerchantApplicationDraft((current) => ({ ...current, category: event.target.value }))}
                placeholder="Services, food, events..."
              />
            </label>
            <label>
              ZIP code
              <input
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                value={merchantApplicationDraft.zipCode}
                onChange={(event) => setMerchantApplicationDraft((current) => ({ ...current, zipCode: event.target.value }))}
                placeholder="30303"
              />
            </label>
            <label>
              City
              <input
                value={merchantApplicationDraft.city}
                onChange={(event) => setMerchantApplicationDraft((current) => ({ ...current, city: event.target.value }))}
                placeholder="City"
              />
            </label>
            <label>
              Website or link
              <input
                value={merchantApplicationDraft.website}
                onChange={(event) => setMerchantApplicationDraft((current) => ({ ...current, website: event.target.value }))}
                placeholder="https://example.com"
              />
            </label>
            <label>
              What will you sell or provide?
              <textarea
                rows={3}
                value={merchantApplicationDraft.description}
                onChange={(event) => setMerchantApplicationDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Briefly describe the business."
              />
            </label>
            {merchantApplicationNotice ? <p className="success-text">{merchantApplicationNotice}</p> : null}
            <button
              type="submit"
              className="accent-button wide"
              disabled={busy || !merchantApplicationDraft.merchantName.trim() || !merchantApplicationDraft.businessType.trim() || !merchantApplicationDraft.zipCode.trim()}
            >
              Submit merchant application
            </button>
          </form>
        </article>
        )}

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Merchant onboarding depth</p>
            <span className="badge subtle">{merchantOnboardingTail.length} merchants</span>
          </div>
          <div className="entry-lock-note">
            <strong>Single sign-on merchant rule</strong>
            <span>Merchants must use the signed-in FoxHub account, wait at least 90 days from user signup before approval, keep one merchant account, and attach any extra storefronts under that account.</span>
          </div>
          {state.commercePolicy?.commerceBlocked ? (
            <div className="entry-lock-note">
              <strong>Commerce penalty active</strong>
              <span>{state.commercePolicy.reason}</span>
            </div>
          ) : null}
          <div className="list-stack">
            {merchantOnboardingTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.merchantName}</strong>
                  <p>{item.stage} · {Array.isArray(item.requiredItems) ? item.requiredItems.join(", ") : "No checklist"}</p>
                  <p className="row-meta-text">
                    {item.merchantAccountId || `merchant-account-${item.merchantId}`} · {Array.isArray(item.storefronts) ? item.storefronts.length : 0} storefronts · {Number(item.accountAgeDays || 0)} / {item.minimumAccountAgeDays || 90} days
                  </p>
                </div>
                <div className="inline-actions wrap">
                  <span className="row-meta-text">{item.riskTier} risk · {item.status}</span>
                  <button type="button" className="ghost-button small" onClick={() => updateMerchantOnboarding(item.merchantId, "advance")}>Advance</button>
                  <button type="button" className="ghost-button small" onClick={() => updateMerchantOnboarding(item.merchantId, "hold")}>Hold</button>
                  <button type="button" className="ghost-button small" onClick={() => runMerchantRiskCheck(item.merchantId, "manual review")}>Risk check</button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Dispute management</p>
            <span className="badge subtle">{disputeTail.length} cases</span>
          </div>
          <form className="market-form" onSubmit={submitDispute}>
            <label>
              Merchant
              <input value={disputeDraft.merchantName} onChange={(event) => setDisputeDraft((current) => ({ ...current, merchantName: event.target.value }))} />
            </label>
            <label>
              Amount
              <input value={disputeDraft.amount} onChange={(event) => setDisputeDraft((current) => ({ ...current, amount: event.target.value }))} />
            </label>
            <label>
              Reason
              <input value={disputeDraft.reason} onChange={(event) => setDisputeDraft((current) => ({ ...current, reason: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Open dispute</button>
          </form>
          <div className="list-stack">
            {disputeTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.merchantName}</strong>
                  <p>{item.reason} · {item.amount}</p>
                </div>
                <div className="inline-actions wrap">
                  <span className="row-meta-text">{item.status}</span>
                  {item.status !== "resolved" ? (
                    <button type="button" className="ghost-button small" onClick={() => resolveDisputeCase(item.id, "resolved")}>
                      Resolve
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Merchant risk signals</p>
            <span className="badge subtle">{merchantRiskTail.length} signals</span>
          </div>
          <div className="list-stack">
            {merchantRiskTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.merchantName}</strong>
                  <p>{item.signal} · {item.detail}</p>
                </div>
                <div className="row-meta-text">score {item.score} · {item.status}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Operator queue</p>
            <span className="badge subtle">{verificationQueue.length} verification cases</span>
          </div>
          <form className="market-form" onSubmit={submitVerification}>
            <label>
              Target id
              <input value={verificationDraft.targetId} onChange={(event) => setVerificationDraft((current) => ({ ...current, targetId: event.target.value }))} />
            </label>
            <label>
              Type
              <select value={verificationDraft.targetType} onChange={(event) => setVerificationDraft((current) => ({ ...current, targetType: event.target.value }))}>
                <option value="merchant">Merchant</option>
                <option value="profile">Profile</option>
                <option value="payout">Payout</option>
              </select>
            </label>
            <label>
              Label
              <input value={verificationDraft.label} onChange={(event) => setVerificationDraft((current) => ({ ...current, label: event.target.value }))} />
            </label>
            <label>
              Requested items
              <input value={verificationDraft.requestedItems} onChange={(event) => setVerificationDraft((current) => ({ ...current, requestedItems: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Open verification case</button>
          </form>
          <div className="list-stack">
            {verificationQueue.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.targetType} · {item.status} · {item.stage}</p>
                </div>
                <div className="inline-actions wrap">
                  <button type="button" className="ghost-button small" onClick={() => resolveVerificationCase(item.id, "approved")}>
                    Approve
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => resolveVerificationCase(item.id, "follow_up")}>
                    Follow up
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Notification center</p>
            <span className="badge subtle">{(state.notificationEvents || []).length} events</span>
          </div>
          <div className="list-stack">
            {unreadNotifications.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
                <button type="button" className="ghost-button small" onClick={() => markNotificationRead(item.id)}>
                  Mark read
                </button>
              </div>
            ))}
            {!unreadNotifications.length ? <p className="panel-copy">No unread notifications.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel compliance-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Document vault</p>
            <span className="badge subtle">{(state.documentVault || []).length} stored</span>
          </div>
          <form className="market-form" onSubmit={submitDocument}>
            <label>
              Target id
              <input value={documentDraft.targetId} onChange={(event) => setDocumentDraft((current) => ({ ...current, targetId: event.target.value }))} />
            </label>
            <label>
              Target type
              <select value={documentDraft.targetType} onChange={(event) => setDocumentDraft((current) => ({ ...current, targetType: event.target.value }))}>
                <option value="profile">Profile</option>
                <option value="merchant">Merchant</option>
                <option value="thread">Thread</option>
                <option value="listing">Listing</option>
              </select>
            </label>
            <label>
              Document name
              <input value={documentDraft.name} onChange={(event) => setDocumentDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              Kind
              <input value={documentDraft.kind} onChange={(event) => setDocumentDraft((current) => ({ ...current, kind: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Add document</button>
          </form>
          <div className="list-stack">
            {documentTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.targetType} · {item.targetId}</p>
                </div>
                <div className="row-meta-text">{item.kind} · {item.status}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Operator actions</p>
            <span className="badge subtle">{(state.operatorActions || []).length} logged</span>
          </div>
          <div className="list-stack">
            {operatorTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.action}</strong>
                  <p>{item.detail}</p>
                </div>
                <div className="row-meta-text">{item.outcome}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel compliance-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Audit trail</p>
            <span className="badge subtle">{(state.auditEvents || []).length} events</span>
          </div>
          <div className="list-stack">
            {auditTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.action}</strong>
                  <p>{item.detail}</p>
                </div>
                <div className="row-meta-text">{item.type} · {item.severity}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Device sessions</p>
            <span className="badge subtle">{deviceTail.length} tracked</span>
          </div>
          <div className="list-stack">
            {deviceTail.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.platform} · {item.location}</p>
                </div>
                <div className="inline-actions wrap">
                  <span className="row-meta-text">{item.trust} · {item.sessionState}</span>
                  {item.sessionState !== "revoked" ? (
                    <button type="button" className="ghost-button small" onClick={() => revokeDeviceSession(item.id)}>
                      Revoke
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel routes-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Route planner</p>
            <span className="badge subtle">{(state.routePlans || []).length} routes</span>
          </div>
          <div className="inline-actions wrap">
            <button
              type="button"
              className="ghost-button small"
              onClick={() => setRouteDraft({ name: "Home to Venue", origin: "Home", destination: "Main Venue", stops: 1, etaMinutes: 18, mode: "drive" })}
            >
              Home to Venue
            </button>
            <button
              type="button"
              className="ghost-button small"
              onClick={() => setRouteDraft({ name: "Pickup Loop", origin: "Downtown", destination: "Event District", stops: 3, etaMinutes: 24, mode: "drive" })}
            >
              Pickup Loop
            </button>
            <button
              type="button"
              className="ghost-button small"
              onClick={() => setRouteDraft({ name: "Transit Route", origin: "Station", destination: "Venue", stops: 1, etaMinutes: 32, mode: "transit" })}
            >
              Transit Route
            </button>
          </div>
          <form className="market-form" onSubmit={submitRoutePlan}>
            <label>
              Route name
              <input value={routeDraft.name} onChange={(event) => setRouteDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              Origin
              <input value={routeDraft.origin} onChange={(event) => setRouteDraft((current) => ({ ...current, origin: event.target.value }))} />
            </label>
            <label>
              Destination
              <input value={routeDraft.destination} onChange={(event) => setRouteDraft((current) => ({ ...current, destination: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Save route</button>
          </form>
          <div className="list-stack">
            {(state.routePlans || []).slice(0, 4).map((route) => (
              <div key={route.id} className="list-row">
                <div>
                  <strong>{route.name}</strong>
                  <p>{route.origin} to {route.destination}</p>
                </div>
                <div className="row-meta-text">{route.mode || "route"}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Mini-program manifest</p>
            <span className="badge subtle">{(state.miniProgramManifests || []).length} manifests</span>
          </div>
          <form className="market-form" onSubmit={submitManifest}>
            <label>
              App id
              <input value={manifestDraft.appId} onChange={(event) => setManifestDraft((current) => ({ ...current, appId: event.target.value }))} />
            </label>
            <label>
              Permissions
              <input value={manifestDraft.permissions} onChange={(event) => setManifestDraft((current) => ({ ...current, permissions: event.target.value }))} />
            </label>
            <label>
              Events
              <input value={manifestDraft.events} onChange={(event) => setManifestDraft((current) => ({ ...current, events: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Register manifest</button>
          </form>
          <div className="list-stack">
            {(state.miniProgramManifests || []).slice(0, 4).map((manifest) => (
              <div key={manifest.id} className="list-row">
                <div>
                  <strong>{manifest.appId}</strong>
                  <p>{Array.isArray(manifest.permissions) ? manifest.permissions.join(", ") : "No permissions listed"}</p>
                </div>
                <div className="row-meta-text">{manifest.status || manifest.version || "draft"}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row service-panel mini-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Runtime sessions</p>
            <span className="badge subtle">{(state.miniAppRuntimeSessions || []).length} active</span>
          </div>
          <div className="list-stack">
            {(state.miniAppRuntimeSessions || []).slice(0, 5).map((session) => (
              <div key={session.id} className="list-row">
                <div>
                  <strong>{session.appId || session.name}</strong>
                  <p>{session.scope || session.context || "mini app session"}</p>
                </div>
                <div className="row-meta-text">{session.status || "running"}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up mini-mechanics-row service-panel mini-panel">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Mini app helpers</p>
            <span className="badge subtle">{miniCoverageScore}% covered</span>
          </div>
          <p className="surface-note">
            Mini apps need more than launch buttons. These helpers keep each app connected to the right person and the right conversation.
          </p>
          <div className="mechanic-grid">
            {Object.entries(miniMechanicGroups).map(([area, items]) => (
              <div key={area} className="mechanic-group">
                <div className="mechanic-group-head">
                  <strong>{area}</strong>
                  <span className="badge subtle">{items.length}</span>
                </div>
                <div className="list-stack">
                  {items.map((item) => (
                    <div key={item.id} className="mechanic-item">
                      <div>
                        <strong>{item.name}</strong>
                        <p>{item.detail}</p>
                      </div>
                      <span className="badge subtle">{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Mini app actions</p>
            <span className="badge subtle">{state.miniAppRuntimeSessions?.length || 0} sessions</span>
          </div>
          <p className="surface-note">
            Use these controls to make sure a mini app can open, ask for permission, send an update, and finish later if needed.
          </p>
          <div className="action-grid">
            <button type="button" className="action-pill" onClick={() => registerMiniProgramManifest?.({ appId: activeMiniApp?.id || "merchantos", version: "1.0.0", permissions: ["identity", "wallet", "contacts"], events: ["thread:return", "checkout:open"], status: "review" })} disabled={busy}>
              <strong>Save selected mini app</strong>
              <p>Saves what the app can use: money, identity, contacts, and return path.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => registerMiniAppRuntime?.({ appId: activeMiniApp?.id || "merchantos", permissions: ["profile.read", "wallet.write", "thread.return"] })} disabled={busy}>
              <strong>Open mini app session</strong>
              <p>Starts a safe session for the selected mini app.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => invokeMiniAppRuntimeEvent?.({ appId: activeMiniApp?.id || "merchantos", permission: "wallet.write", event: "checkout:open" })} disabled={busy}>
              <strong>Send checkout event</strong>
              <p>Tests event handling for a wallet or merchant checkout path.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => queueReliableMutation?.({ mutation: "mini_program_checkout", payload: { appId: activeMiniApp?.id || "merchantos", threadId: selectedThread?.id || "thread" } })} disabled={busy}>
              <strong>Queue deferred action</strong>
              <p>Adds an offline-safe mutation tied to the current mini-program.</p>
            </button>
          </div>
        </article>
      </section>

      <section className="surface-row service-panel mini-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Recent mini-programs</p>
            <span className="badge subtle">{recentMiniApps.length} recent</span>
          </div>
          <div className="recent-mini-strip">
            {recentMiniApps.map((item) => {
              const match = rankedMiniApps.find((app) => app.name === item.name);
              return (
                <button
                  key={item.name}
                  type="button"
                  className="recent-mini-card"
                  onClick={() => {
                    if (match) {
                      selectMiniApp(match.id);
                      setServiceTab(match.id === "merchantos" ? "merchant" : "mini");
                    }
                  }}
                >
                  <span>{item.meta}</span>
                  <strong>{item.name}</strong>
                </button>
              );
            })}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel mini-panel">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Mini-programs</p>
            <span className="badge subtle">{state.searchScopes.length} surfaces</span>
          </div>
          <div className="surface-note">
            Utility apps that inherit identity, payments, and contact context.
          </div>
          <div className="mini-grid">
            {rankedMiniApps.map((app) => (
              <button
                key={app.id}
                type="button"
                className={app.id === state.activeMiniAppId ? "mini-tile active" : "mini-tile"}
                onClick={() => {
                  selectMiniApp(app.id);
                  setServiceTab(app.id === "merchantos" ? "merchant" : "mini");
                }}
              >
                <strong>{app.name}</strong>
                <p>{app.summary}</p>
              </button>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Launch context</p>
            <span className="badge subtle">{activeMiniApp.type}</span>
          </div>
          <div className="surface-note">
            Where this service opens from, and what context it inherits.
          </div>
          <div className="launchpad">
            <h3>{activeMiniApp.name}</h3>
            <p className="panel-copy">{activeMiniApp.summary}</p>
            <div className="launchpad-list">
              <div className="launchpad-row">
                <span>From thread</span>
                <strong>{selectedThread?.name || "FoxHub"}</strong>
              </div>
              <div className="launchpad-row">
                <span>Circle</span>
                <strong>{activeCircle?.name || "General"}</strong>
              </div>
              <div className="launchpad-row">
                <span>Permission scope</span>
                <strong>identity, wallet, contacts</strong>
              </div>
            </div>
            <div className="inline-actions wrap">
              <button type="button" className="accent-button" onClick={() => void handleLaunchMiniApp()} disabled={busy}>
                Launch {activeMiniApp.name}
              </button>
              <button type="button" className="ghost-button" onClick={() => void runQrFlow("qr-miniapp")} disabled={busy}>
                Scan and open
              </button>
            </div>
          </div>
        </article>
      </section>

      {activeMiniApp.id === "merchantos" ? (
        <section className="surface-row merchant-service-row service-panel merchant-panel">
          <article className="surface surface-strong">
            <div className="surface-head">
              <p className="card-label">Merchant service coverage</p>
              <span className="badge subtle">{merchantCoverageScore}% covered</span>
            </div>
            <p className="surface-note">
              MerchantOS now exposes the core operating pieces a merchant section needs: onboarding, checkout, settlements, risk, locations, disputes, documents, alerts, and reporting.
            </p>
            <div className="mechanic-grid merchant-coverage-grid">
              {Object.entries(merchantCoverageGroups).map(([category, items]) => (
                <div key={category} className="mechanic-group">
                  <div className="mechanic-group-head">
                    <strong>{category}</strong>
                    <span className="badge subtle">{items.length}</span>
                  </div>
                  <div className="list-stack">
                    {items.map((item) => (
                      <div key={item.id} className="mechanic-item">
                        <div>
                          <strong>{item.name}</strong>
                          <p>{item.mechanic}</p>
                        </div>
                        <span className="badge subtle">{item.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeMiniApp.id === "merchantos" ? (
        <section className="surface-row two-up service-panel merchant-panel">
          <article className="surface surface-strong">
            <div className="surface-head">
              <p className="card-label">MerchantOS</p>
              <span className="badge subtle">{merchantLocationTail.length} locations</span>
            </div>
            <div className="surface-note">
              Merchant management stays tied to FoxHub payment context so operators can run QR checkout, settlement review, payout readiness, and store health from the same workspace.
            </div>
            <div className="glance-strip compact">
              <div className="glance-card warm">
                <span>Live terminals</span>
                <strong>{liveTerminals}</strong>
              </div>
              <div className="glance-card cool">
                <span>Settlements due</span>
                <strong>{settlementsDue}</strong>
              </div>
              <div className="glance-card soft">
                <span>Payout risk</span>
                <strong>{payoutRisk}</strong>
              </div>
            </div>
            <div className="inline-actions wrap">
              <button type="button" className="accent-button" onClick={() => void runService("merchant")} disabled={busy}>
                Run merchant pay
              </button>
              <button type="button" className="ghost-button" onClick={() => void runQrFlow("qr-pay")} disabled={busy}>
                Scan merchant QR
              </button>
              <button type="button" className="ghost-button" onClick={() => void openOfficialThread("wallet-watch")} disabled={busy}>
                Wallet Watch
              </button>
            </div>
          </article>

          <article className="surface">
            <div className="surface-head">
              <p className="card-label">Settlement controls</p>
              <span className="badge subtle">{merchantSettlementTail.length} settlements</span>
            </div>
            <div className="list-stack">
              {merchantSettlementTail.map((settlement) => (
                <div key={settlement.id} className="list-row">
                  <div>
                    <strong>{settlement.merchantName}</strong>
                    <p>{settlement.note}</p>
                  </div>
                  <div className="inline-actions wrap">
                    <span className="row-meta-text">{settlement.status} · {settlement.amount}</span>
                    <button type="button" className="ghost-button small" onClick={() => reviewMerchantSettlement(settlement.id, "approved")} disabled={busy}>Approve</button>
                    <button type="button" className="ghost-button small" onClick={() => reviewMerchantSettlement(settlement.id, "hold")} disabled={busy}>Hold</button>
                    <button type="button" className="ghost-button small" onClick={() => reviewMerchantSettlement(settlement.id, "release")} disabled={busy}>Release</button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeMiniApp.id === "merchantos" ? (
        <section className="surface-row three-up merchant-intel service-panel merchant-panel">
          <article className="surface surface-strong">
            <div className="surface-head">
              <p className="card-label">Merchant intelligence</p>
              <span className="badge subtle">{highlightedQueues.length} queues</span>
            </div>
            <div className="metrics-grid">
              {merchantMetrics.map((metric) => (
                <div key={metric.label} className="metric-card">
                  <span className="row-meta-text">{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <span className="row-meta-text metric-helper">{metric.helper}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="surface">
            <div className="surface-head">
              <p className="card-label">Queue focus</p>
              <span className="badge subtle">{merchantQueueSnapshots.length} active</span>
            </div>
            <div className="list-stack">
              {highlightedQueues.map((queue) => (
                <div key={queue.id} className="queue-card">
                  <div className="queue-head">
                    <strong>{queue.name}</strong>
                    <span className="badge subtle">{queue.status}</span>
                  </div>
                  <p className="queue-detail">{queue.detail}</p>
                  <div className="row-meta-text">{queue.volume}</div>
                </div>
              ))}
              {!highlightedQueues.length ? (
                <p className="surface-note">No queue snapshots available.</p>
              ) : null}
            </div>
          </article>

          <article className="surface">
            <div className="surface-head">
              <p className="card-label">Action center</p>
              <span className="badge subtle">{merchantActionCards.length} shortcuts</span>
            </div>
            <div className="action-grid">
              {merchantActionCards.map((action) => {
                const handler = merchantActionHandlers[action.id];
                return (
                  <button
                    key={action.id}
                    type="button"
                    className="action-pill"
                    onClick={handler}
                    disabled={!handler || busy}
                  >
                    <strong>{action.label}</strong>
                    <p>{action.detail}</p>
                  </button>
                );
              })}
              {!merchantActionCards.length ? (
                <p className="surface-note">No quick actions available.</p>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      {activeMiniApp.id === "merchantos" ? (
        <section className="surface-row two-up service-panel merchant-panel">
          <article className="surface">
            <div className="surface-head">
              <p className="card-label">Compliance programs</p>
              <span className="badge subtle">{complianceHighlights.length} monitored</span>
            </div>
            <div className="list-stack">
              {complianceHighlights.map((program) => (
                <div key={program.id} className="compliance-card">
                  <div className="queue-head">
                    <strong>{program.framework}</strong>
                    <span className="badge subtle">{program.status}</span>
                  </div>
                  <p>{program.control}</p>
                  <div className="row-meta-text">
                    {program.owner} · reviewed {program.cadence}
                  </div>
                </div>
              ))}
              {!complianceHighlights.length ? (
                <p className="surface-note">No compliance programs are lighted right now.</p>
              ) : null}
            </div>
          </article>

          <article className="surface">
            <div className="surface-head">
              <p className="card-label">Trust & safety alerts</p>
              <span className="badge subtle">{merchantTrustIncidents.length} active</span>
            </div>
            <div className="list-stack">
              {merchantTrustIncidents.length ? (
                merchantTrustIncidents.map((incident) => (
                  <div key={incident.id} className="incident-row">
                    <div>
                      <strong>{(incident.type || "").replace(/_/g, " ")}</strong>
                      <p>{incident.detail}</p>
                    </div>
                    <div className="row-meta-text">
                      {incident.severity} · {formatIncidentDate(incident.createdAt)}
                    </div>
                  </div>
                ))
              ) : (
                <p className="surface-note">No trust incidents affecting merchants in the last 24 hours.</p>
              )}
            </div>
          </article>
        </section>
      ) : null}

      {activeMiniApp.id === "merchantos" ? (
        <section className="surface-row two-up service-panel merchant-panel">
          <article className="surface">
            <div className="surface-head">
              <p className="card-label">Merchant locations</p>
              <span className="badge subtle">{merchantLocationTail.length} sites</span>
            </div>
            <div className="list-stack">
              {merchantLocationTail.map((location) => (
                <div key={location.id} className="list-row">
                  <div>
                    <strong>{location.merchantName}</strong>
                    <p>{location.city}, {location.state} · {location.terminalHealth} terminal · QR {location.qrStatus}</p>
                  </div>
                  <div className="inline-actions wrap">
                    <span className="row-meta-text">{location.status} · {location.complianceState}</span>
                    <button type="button" className="ghost-button small" onClick={() => updateMerchantLocationStatus(location.id, "live")} disabled={busy}>Live</button>
                    <button type="button" className="ghost-button small" onClick={() => updateMerchantLocationStatus(location.id, "pilot")} disabled={busy}>Pilot</button>
                    <button type="button" className="ghost-button small" onClick={() => updateMerchantLocationStatus(location.id, "review")} disabled={busy}>Review</button>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="surface">
            <div className="surface-head">
              <p className="card-label">Payout controls</p>
              <span className="badge subtle">{merchantPayoutControlTail.length} controls</span>
            </div>
            <div className="list-stack">
              {merchantPayoutControlTail.map((control) => (
                <div key={control.id} className="list-row">
                  <div>
                    <strong>{control.merchantName}</strong>
                    <p>{control.reason}</p>
                  </div>
                  <div className="inline-actions wrap">
                    <span className="row-meta-text">{control.state} · reserve {control.reservePercent}%</span>
                    <button type="button" className="ghost-button small" onClick={() => updateMerchantPayoutControl(control.merchantId, "release")} disabled={busy}>Release</button>
                    <button type="button" className="ghost-button small" onClick={() => updateMerchantPayoutControl(control.merchantId, "monitor")} disabled={busy}>Monitor</button>
                    <button type="button" className="ghost-button small" onClick={() => updateMerchantPayoutControl(control.merchantId, "hold")} disabled={busy}>Hold</button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      <section className="surface-row three-up service-panel channels-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Recent apps</p>
            <span className="badge subtle">{state.serviceContinuity.length} continuity</span>
          </div>
          <div className="list-stack">
            {state.serviceContinuity.map((item) => (
              <button key={item.id} type="button" className="list-button" onClick={() => openContinuityItem(item)}>
                <div>
                  <strong>{item.appName}</strong>
                  <p>{item.returnLabel}</p>
                </div>
                <div className="row-meta-text">{item.fromThread}</div>
              </button>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Search surfaces</p>
            <span className="badge subtle">{state.searchScopes.length} scopes</span>
          </div>
          <div className="list-stack">
            {state.searchScopes.map((scope) => (
              <button key={scope.id} type="button" className="list-button" onClick={() => openSearchScope(scope.id)}>
                <div>
                  <strong>{scope.name}</strong>
                  <p>{scope.hint}</p>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">QR history</p>
            <span className="badge subtle">{state.qrHistory.length} recent</span>
          </div>
          <div className="list-stack">
            {recentQrHistory.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <div className="row-meta-text">{item.meta}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row service-panel channels-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Channel access</p>
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
                  <div className="inline-actions">
                    <button type="button" className="ghost-button small" onClick={() => void openOfficialThread(account.id)}>
                      Open
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

      </section>
      </div>
      {!state.searchScopes.length && !state.serviceContinuity.length && !state.officialAccounts.length ? (
        <FilteredEmptyState label="Services" />
      ) : null}
    </>
  );
}

function GrowthWorkspace({ state, busy, setActiveTab, activateGrowthCategory, runGrowthCategory, activateAllGrowthCategories }) {
  const [activeGroup, setActiveGroup] = useState("All");
  const categories = state.growthCategories || [];
  const groupSummaries = [...categories.reduce((map, item) => {
    const key = item.groupId || item.group || "people";
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: item.group || "People",
        order: item.groupOrder || 99,
        detail: item.groupDetail || "Related FoxHub activity.",
        items: []
      });
    }
    map.get(key).items.push(item);
    return map;
  }, new Map()).values()].sort((a, b) => a.order - b.order);
  const visibleCategories = activeGroup === "All"
    ? categories
    : categories.filter((item) => (item.groupId || item.group || "people") === activeGroup);
  const groupedVisibleCategories = [...visibleCategories.reduce((map, item) => {
    const key = item.groupId || item.group || "people";
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: item.group || "People",
        order: item.groupOrder || 99,
        detail: item.groupDetail || "Related FoxHub activity.",
        items: []
      });
    }
    map.get(key).items.push(item);
    return map;
  }, new Map()).values()].sort((a, b) => a.order - b.order);
  const activeCount = categories.filter((item) => item.status === "active" || item.status === "running").length;
  const outputs = (state.growthOutputs || []).slice(0, 8);
  const moneyOutputs = outputs.filter((item) => item.moneyReadiness).length;
  const selectedGroup = groupSummaries.find((group) => group.id === activeGroup) || null;
  const selectedGroupCount = selectedGroup ? selectedGroup.items.length : categories.length;
  const selectedGroupActiveCount = selectedGroup
    ? selectedGroup.items.filter((item) => item.status === "active" || item.status === "running").length
    : activeCount;

  function activateVisibleCategories() {
    visibleCategories.forEach((item) => activateGrowthCategory?.(item.key));
  }

  function runVisibleCategories() {
    visibleCategories.forEach((item) => runGrowthCategory?.(item.key));
  }

  return (
    <>
      <section className="surface-row two-up">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Communal</p>
            <span className="badge">{categories.length} paths ready</span>
          </div>
          <h2 className="section-title">Seventeen community paths help people gather, coordinate, and return.</h2>
          <p className="panel-copy">
            This workspace sits after social and rapport: local rooms, creators, booking, stores, trust, money, public pages, and community growth.
          </p>
          <div className="glance-strip compact">
            <div className="glance-card warm"><span>Active</span><strong>{activeCount}/{categories.length}</strong></div>
            <div className="glance-card cool"><span>Recent wins</span><strong>{state.growthOutputs?.length || 0}</strong></div>
            <div className="glance-card soft"><span>Sections</span><strong>{groupSummaries.length}</strong></div>
          </div>
          <div className="button-row wrap">
            <button type="button" className="primary-button" onClick={() => activateAllGrowthCategories?.()} disabled={busy}>
              Turn on all 17
            </button>
            <button type="button" className="ghost-button" onClick={() => categories.forEach((item) => runGrowthCategory?.(item.key))} disabled={busy}>
              Try all 17
            </button>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Easy checkout</p>
            <span className="badge subtle">No surprises</span>
          </div>
          <div className="list-stack">
            {["Price shown before checkout", "Deposit, hold, and release steps visible", "Receipt and refund paths ready", "Provider payout setup prompted early", "Dispute path visible from wallet/request screens", "Setup warnings appear before payment"].map((item) => (
              <div key={item} className="list-row">
                <div><strong>{item}</strong><p>Built into money, booking, store, deal, creator, and demo records.</p></div>
                <span className="badge">Ready</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row three-up">
        {groupSummaries.map((group) => {
          const groupActive = group.items.filter((item) => item.status === "active" || item.status === "running").length;
          return (
            <article key={group.id} className={activeGroup === group.id ? "surface surface-strong" : "surface"}>
              <div className="surface-head">
                <p className="card-label">{String(group.order).padStart(2, "0")}</p>
                <span className="badge subtle">{groupActive}/{group.items.length} active</span>
              </div>
              <h3>{group.name}</h3>
              <p className="panel-copy">{group.detail}</p>
              <button type="button" className="ghost-button small" onClick={() => setActiveGroup(group.id)}>
                View group
              </button>
            </article>
          );
        })}
      </section>

      <section className="service-library-tabs" aria-label="Communal sections">
        <button
          type="button"
          className={activeGroup === "All" ? "service-library-tab active" : "service-library-tab"}
          onClick={() => setActiveGroup("All")}
        >
          <strong>All groups</strong>
          <span>{categories.length} items</span>
        </button>
        {groupSummaries.map((group) => (
          <button
            key={group.id}
            type="button"
            className={activeGroup === group.id ? "service-library-tab active" : "service-library-tab"}
            onClick={() => setActiveGroup(group.id)}
          >
            <strong>{group.name}</strong>
            <span>{group.items.length} items</span>
          </button>
        ))}
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Grouped categories</p>
            <span className="badge subtle">{selectedGroupActiveCount}/{selectedGroupCount} active</span>
          </div>
          <div className="button-row wrap">
            <button type="button" className="ghost-button" onClick={activateVisibleCategories} disabled={busy}>
              Turn on this section
            </button>
            <button type="button" className="ghost-button" onClick={runVisibleCategories} disabled={busy}>
              Try this section
            </button>
          </div>
          <div className="blueprint-list">
            {groupedVisibleCategories.map((group) => (
              <div key={group.id} className="list-stack">
                <div className="list-row">
                  <div>
                    <strong>{group.name}</strong>
                    <p>{group.detail}</p>
                  </div>
                  <span className="badge subtle">{group.items.length} items</span>
                </div>
                {group.items.sort((a, b) => a.order - b.order).map((category) => (
                  <div key={category.key} className="blueprint-component-row">
                    <span className="blueprint-order">{String(category.order).padStart(2, "0")}</span>
                    <div>
                      <strong>{category.name}</strong>
                      <p>{category.detail}</p>
                      <span className="row-meta-text">{category.group} · {category.surface} · Opens {category.targetTab || "hub"}</span>
                    </div>
                    <div className="blueprint-actions">
                      <span className={category.status === "active" || category.status === "running" ? "badge" : "badge subtle"}>{category.status}</span>
                      <button type="button" className="ghost-button small" onClick={() => activateGrowthCategory?.(category.key)} disabled={busy}>Activate</button>
                      <button type="button" className="ghost-button small" onClick={() => runGrowthCategory?.(category.key)} disabled={busy}>Run</button>
                      <button type="button" className="ghost-button small" onClick={() => setActiveTab(category.targetTab || "hub")}>Open</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Recent activity</p>
            <span className="badge subtle">{outputs.length} updates</span>
          </div>
          <div className="list-stack">
            {outputs.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.categoryName}</strong>
                  <p>{item.headline || item.detail || item.salesOffer?.join(", ") || item.requestTypes?.join(", ") || `${item.surface} record generated.`}</p>
                </div>
                <span className="badge subtle">{item.group || item.surface}</span>
              </div>
            ))}
            {!outputs.length ? <p className="panel-copy">Try a path to create the first update.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">What happened</p>
            <span className="badge subtle">{(state.growthEvents || []).length} total</span>
          </div>
          <div className="list-stack">
            {(state.growthEvents || []).slice(0, 8).map((event) => (
              <div key={event.id} className="list-row">
                <div><strong>{event.action}</strong><p>{event.detail}</p></div>
                <span className="badge subtle">{event.group || event.categoryKey}</span>
              </div>
            ))}
            {!(state.growthEvents || []).length ? <p className="panel-copy">Nothing has happened here yet.</p> : null}
          </div>
        </article>
      </section>
    </>
  );
}

function getUxOutputCount(state, key) {
  const outputFields = {
    "universal-command-center": "uxCommandRuns",
    "today-dashboard": "uxTodayCards",
    "context-right-rail": "uxContextRailItems",
    "action-timeline": "uxTimelines",
    "inbox-priority-modes": "uxInboxModes",
    "trust-badge-system": "uxTrustBadges",
    "smart-empty-states": "uxEmptyStateActions",
    "onboarding-progress-map": "uxOnboardingSteps",
    "miniapp-permission-review": "uxMiniAppPermissionReviews",
    "payment-flow-stepper": "uxPaymentSteppers",
    "notification-inbox-upgrade": "uxNotificationInbox",
    "operator-review-console": "uxOperatorConsoleItems",
    "local-map-list-toggle": "uxDiscoveryViews",
    "profile-completeness-meter": "uxCompletenessMeters",
    "saved-workspace": "uxSavedWorkspaceItems",
    "undo-recent-action-toasts": "uxToasts",
    "skeleton-offline-banners": "uxRuntimeBanners",
    "role-based-home-layout": "uxRoleHomeLayouts",
    "object-detail-pages": "uxObjectDetails",
    "guided-create-button": "uxCreateMenuActions"
  };
  const field = outputFields[key] || "uxEvents";
  return Array.isArray(state[field]) ? state[field].length : 0;
}

function ExperienceWorkspace({
  state,
  setActiveTab,
  openProfilePanel,
  runUnifiedSearch,
  runUnifiedAction,
  activateUxComponent,
  runUxComponent,
  registerBrowserNotifications,
  selectThread,
  handleWalletAction,
  openSearchScope,
  activeMiniApp,
  busy
}) {
  const [selectedKey, setSelectedKey] = useState(state.uxComponents?.[0]?.key || "");
  const [localView, setLocalView] = useState("list");
  const uxComponents = [...(state.uxComponents || [])].sort((a, b) => a.order - b.order);
  const selectedComponent = uxComponents.find((item) => item.key === selectedKey) || uxComponents[0] || null;
  const activeCount = uxComponents.filter((item) => item.status === "active" || item.status === "running").length;
  const recentUxEvents = (state.uxEvents || []).slice(0, 8);
  const latestOutputs = [
    ...(state.uxCommandRuns || []),
    ...(state.uxTodayCards || []),
    ...(state.uxContextRailItems || []),
    ...(state.uxTimelines || []),
    ...(state.uxInboxModes || []),
    ...(state.uxTrustBadges || []),
    ...(state.uxEmptyStateActions || []),
    ...(state.uxOnboardingSteps || []),
    ...(state.uxMiniAppPermissionReviews || []),
    ...(state.uxPaymentSteppers || []),
    ...(state.uxNotificationInbox || []),
    ...(state.uxOperatorConsoleItems || []),
    ...(state.uxDiscoveryViews || []),
    ...(state.uxCompletenessMeters || []),
    ...(state.uxSavedWorkspaceItems || []),
    ...(state.uxToasts || []),
    ...(state.uxRuntimeBanners || []),
    ...(state.uxRoleHomeLayouts || []),
    ...(state.uxObjectDetails || []),
    ...(state.uxCreateMenuActions || [])
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 8);
  const selectedOutputCount = selectedComponent ? getUxOutputCount(state, selectedComponent.key) : 0;

  function runFeature(component) {
    const output = runUxComponent?.(component.key, { appId: activeMiniApp?.id });
    if (component.key === "universal-command-center") {
      runUnifiedSearch?.("wallet");
    }
    if (component.key === "miniapp-permission-review") {
      setActiveTab("discover");
    }
    if (component.key === "notification-inbox-upgrade") {
      void registerBrowserNotifications?.();
    }
    if (component.key === "payment-flow-stepper") {
      void handleWalletAction?.("merchant");
    }
    if (component.key === "object-detail-pages" && state.selectedThreadId) {
      selectThread?.(state.selectedThreadId);
    }
    if (component.key === "local-map-list-toggle") {
      openSearchScope?.("local");
    }
    if (component.key === "profile-completeness-meter") {
      openProfilePanel?.();
    }
    if (component.key === "guided-create-button") {
      setActiveTab("market");
    }
    return output;
  }

  const inboxModes = state.uxInboxModes?.[0]?.modes || ["All", "People", "Services", "Money", "Needs reply", "High trust", "Operator"];
  const onboardingSteps = state.uxOnboardingSteps?.[0]?.steps || [];
  const paymentSteps = state.uxPaymentSteppers?.[0]?.steps || ["created", "funded", "held", "reviewed", "released", "disputed", "resolved"];
  const trustBadges = state.uxTrustBadges?.[0]?.badges || ["Verified identity", "Fast responder", "Low dispute rate", "Review pending", "Payment hold active"];
  const createActions = state.uxCreateMenuActions?.[0]?.actions || ["message", "listing", "group", "event", "route", "document", "merchant case", "mini-app manifest"];
  const runtimeBanner = state.uxRuntimeBanners?.[0] || { mode: state.backendMode, banners: ["syncing", "offline", "local-only", "firebase-connected", "native-locked"] };
  const connectionLabel = runtimeBanner.mode === "firebase" ? "Live" : runtimeBanner.mode === "locked" ? "Locked" : "Preview";
  const friendlyBanners = {
    syncing: "Updating",
    offline: "Offline",
    "local-only": "Preview only",
    "firebase-connected": "Live connection",
    "native-locked": "Mobile locked"
  };

  return (
    <>
      <section className="surface-row two-up ux-hero-row">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">UX / Goodies</p>
            <span className="badge subtle">{activeCount}/{uxComponents.length} active</span>
          </div>
          <h2>Twenty interface touches support the rapport network.</h2>
          <p className="surface-note">
            These comforts make social, rapport, communal, service, money, and profile flows easier to understand.
          </p>
          <div className="inline-actions wrap">
            <button type="button" className="accent-button" onClick={() => uxComponents.forEach((item) => activateUxComponent?.(item.key))} disabled={busy}>
              Turn on all 20
            </button>
            <button type="button" className="ghost-button" onClick={() => uxComponents.forEach((item) => runFeature(item))} disabled={busy}>
              Try all in order
            </button>
            <button type="button" className="ghost-button" onClick={() => setLocalView((current) => current === "list" ? "map" : "list")}>
              {localView === "list" ? "Map view" : "List view"}
            </button>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Connection</p>
            <span className="badge">{connectionLabel}</span>
          </div>
          <div className="glance-strip compact">
            <div className="glance-card warm">
              <span>Goodie actions</span>
              <strong>{state.uxEvents?.length || 0}</strong>
            </div>
            <div className="glance-card cool">
              <span>Updates</span>
              <strong>{latestOutputs.length}</strong>
            </div>
            <div className="glance-card soft">
              <span>View</span>
              <strong>{localView}</strong>
            </div>
          </div>
          <div className="runtime-banner-row">
            {(runtimeBanner.banners || []).map((item) => (
              <span key={item} className="badge subtle">{friendlyBanners[item] || item}</span>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row ux-layout">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Goodie list</p>
            <span className="badge subtle">{uxComponents.length} perks</span>
          </div>
          <div className="blueprint-list">
            {uxComponents.map((component) => (
              <div key={component.key} className={selectedComponent?.key === component.key ? "blueprint-component-row active-soft" : "blueprint-component-row"}>
                <span className="blueprint-order">{String(component.order).padStart(2, "0")}</span>
                <div>
                  <strong>{component.name}</strong>
                  <p>{component.detail}</p>
                  <span className="row-meta-text">{component.surface} · {getUxOutputCount(state, component.key)} outputs</span>
                </div>
                <div className="blueprint-actions">
                  <span className={component.status === "active" || component.status === "running" ? "badge" : "badge subtle"}>{component.status || "ready"}</span>
                  <button type="button" className="ghost-button small" onClick={() => { setSelectedKey(component.key); activateUxComponent?.(component.key); }} disabled={busy}>
                    Activate
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => { setSelectedKey(component.key); runFeature(component); }} disabled={busy}>
                    Run
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <aside className="surface ux-detail-panel">
          <div className="surface-head">
            <p className="card-label">Context rail</p>
            <span className="badge subtle">{selectedOutputCount} outputs</span>
          </div>
          {selectedComponent ? (
            <div className="list-stack">
              <div className="list-row">
                <div>
                  <strong>{String(selectedComponent.order).padStart(2, "0")}. {selectedComponent.name}</strong>
                  <p>{selectedComponent.detail}</p>
                </div>
              </div>
              <div className="list-row">
                <div>
                  <strong>Object context</strong>
                  <p>{state.uxContextRailItems?.[0]?.objectType || "thread"} · {state.uxContextRailItems?.[0]?.objectId || state.selectedThreadId || "current"}</p>
                </div>
                <span className="badge subtle">trust {state.uxContextRailItems?.[0]?.trust || state.trustEngine?.profileScore || 0}</span>
              </div>
              <div className="inline-actions wrap">
                <button type="button" className="ghost-button small" onClick={() => setActiveTab("chat")}>Chat</button>
                <button type="button" className="ghost-button small" onClick={() => setActiveTab("wallet")}>Money</button>
                <button type="button" className="ghost-button small" onClick={() => setActiveTab("discover")}>Services</button>
              </div>
            </div>
          ) : null}
        </aside>
      </section>

      <section className="surface-row three-up">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Today dashboard</p>
            <span className="badge subtle">{state.uxTodayCards?.length || 0} cards</span>
          </div>
          <div className="list-stack">
            {(state.uxTodayCards?.[0]?.cards || ["Run Today Dashboard to build daily cards."]).map((item) => (
              <div key={item} className="list-row"><strong>{item}</strong></div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Inbox modes</p>
            <span className="badge subtle">{inboxModes.length} modes</span>
          </div>
          <div className="context-chip-row">
            {inboxModes.map((mode) => <button key={mode} type="button" className="context-chip"><strong>{mode}</strong></button>)}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Trust badges</p>
            <span className="badge subtle">{trustBadges.length} badges</span>
          </div>
          <div className="runtime-banner-row">
            {trustBadges.map((badge) => <span key={badge} className="badge">{badge}</span>)}
          </div>
        </article>
      </section>

      <section className="surface-row three-up">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Onboarding map</p>
            <span className="badge subtle">{onboardingSteps.filter((item) => item.done).length}/{onboardingSteps.length || 5}</span>
          </div>
          <div className="list-stack">
            {(onboardingSteps.length ? onboardingSteps : [{ label: "Run Onboarding Progress Map", done: false }]).map((step) => (
              <div key={step.label} className="list-row">
                <strong>{step.label}</strong>
                <span className={step.done ? "badge" : "badge review"}>{step.done ? "Done" : "Next"}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Payment stepper</p>
            <span className="badge subtle">{state.uxPaymentSteppers?.[0]?.currentStep || "ready"}</span>
          </div>
          <div className="payment-stepper">
            {paymentSteps.map((step) => (
              <span key={step} className={step === state.uxPaymentSteppers?.[0]?.currentStep ? "payment-step active" : "payment-step"}>{step}</span>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Guided create</p>
            <span className="badge subtle">{createActions.length} actions</span>
          </div>
          <div className="context-chip-row">
            {createActions.map((action) => <button key={action} type="button" className="context-chip"><strong>{action}</strong></button>)}
          </div>
        </article>
      </section>

      <section className="surface-row two-up">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Operator review console</p>
            <span className="badge subtle">{state.uxOperatorConsoleItems?.length || 0} snapshots</span>
          </div>
          <div className="metrics-grid">
            {Object.entries(state.uxOperatorConsoleItems?.[0]?.queues || { verification: 0, disputes: 0, incidents: 0, payoutHolds: 0 }).map(([label, value]) => (
              <div key={label} className="metric-card">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Latest UX output</p>
            <span className="badge subtle">{latestOutputs.length} records</span>
          </div>
          <div className="list-stack">
            {latestOutputs.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.componentName}</strong>
                  <p>{item.result || item.nextAction || item.decision || item.defaultAction || item.status}</p>
                </div>
                <span className="badge subtle">{String(item.order || "").padStart(2, "0")}</span>
              </div>
            ))}
            {!latestOutputs.length ? <p className="panel-copy">Run UX features to populate this output stack.</p> : null}
          </div>
        </article>
      </section>
    </>
  );
}

function getBlueprintTargetTab(category = "") {
  if (category.includes("Messaging")) return "chat";
  if (category.includes("Marketplace")) return "market";
  if (category.includes("MerchantOS") || category.includes("Compliance") || category.includes("Mini-Programs") || category.includes("Discovery")) return "discover";
  if (category.includes("Wallet")) return "wallet";
  if (category.includes("Profile")) return "circles";
  if (category.includes("Operator")) return "connectors";
  return "hub";
}

function getBlueprintRunLabel(category = "") {
  if (category.includes("Navigation")) return "Map";
  if (category.includes("Profile")) return "Sync";
  if (category.includes("Messaging")) return "Thread";
  if (category.includes("Marketplace")) return "Search";
  if (category.includes("MerchantOS")) return "Risk";
  if (category.includes("Wallet")) return "Check";
  if (category.includes("Compliance")) return "Review";
  if (category.includes("Operator")) return "Triage";
  if (category.includes("Mini-Programs")) return "Runtime";
  if (category.includes("Discovery")) return "Discover";
  return "Run";
}

function BlueprintWorkspace({
  components,
  state,
  setActiveTab,
  openProfilePanel,
  runUnifiedSearch,
  recalculateTrustEngine,
  rebuildReputationGraph,
  runSmartMatchmaking,
  runOperatorCopilot,
  createConversionFunnel,
  registerMiniAppRuntime,
  queueReliableMutation,
  trackAnalyticsEvent,
  setFeatureFlag,
  evaluateWalletRisk,
  runMerchantRiskCheck,
  updateComplianceControl
}) {
  const categories = useMemo(
    () => Array.from(new Set(components.map((item) => item.category))),
    [components]
  );
  const [activeCategory, setActiveCategory] = useState(categories[0] || "All");
  const [blueprintQuery, setBlueprintQuery] = useState("");
  const [lastAction, setLastAction] = useState(null);
  const deferredBlueprintQuery = useDeferredValue(blueprintQuery);
  const normalizedQuery = deferredBlueprintQuery.trim().toLowerCase();
  const enabledFlags = state.analyticsHub?.flags || {};
  const enabledCount = components.filter((item) => enabledFlags[`component_${item.id}`]).length;
  const blueprintEvents = (state.analyticsHub?.events || []).filter((event) => event.category === "blueprint").slice(0, 6);
  const categoryCounts = useMemo(
    () =>
      categories.reduce((counts, category) => {
        counts[category] = components.filter((item) => item.category === category).length;
        return counts;
      }, {}),
    [categories, components]
  );
  const filteredComponents = useMemo(
    () =>
      components
        .filter((item) => activeCategory === "All" || item.category === activeCategory)
        .filter((item) => {
          if (!normalizedQuery) return true;
          return [item.name, item.category, item.mechanic, item.id]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
        })
        .sort((a, b) => a.order - b.order),
    [activeCategory, components, normalizedQuery]
  );
  const enableComponent = (item) => {
    const flagKey = `component_${item.id}`;
    setFeatureFlag?.(flagKey, true);
    queueReliableMutation?.({
      mutation: "enable_blueprint_component",
      payload: {
        componentId: item.id,
        order: item.order,
        category: item.category,
        targetTab: getBlueprintTargetTab(item.category)
      }
    });
    trackAnalyticsEvent?.({
      name: "blueprint_component_enabled",
      category: "blueprint",
      metadata: { componentId: item.id, category: item.category, order: item.order }
    });
    setLastAction({ label: item.name, detail: "Enabled and queued for platform sync." });
  };
  const runComponent = (item) => {
    enableComponent(item);
    const targetTab = getBlueprintTargetTab(item.category);
    if (item.category.includes("Navigation")) {
      setFeatureFlag?.(`navigation_room_${item.id}`, true);
      queueReliableMutation?.({ mutation: "refresh_navigation_component", payload: { componentId: item.id } });
    } else if (item.category.includes("Profile")) {
      recalculateTrustEngine?.();
      rebuildReputationGraph?.();
      openProfilePanel?.();
    } else if (item.category.includes("Messaging")) {
      runUnifiedSearch?.("thread");
      queueReliableMutation?.({ mutation: "thread_component_action", payload: { componentId: item.id } });
    } else if (item.category.includes("Marketplace")) {
      runUnifiedSearch?.("listing");
      queueReliableMutation?.({ mutation: "marketplace_component_action", payload: { componentId: item.id } });
    } else if (item.category.includes("MerchantOS")) {
      const merchantId = state.merchantOnboardingQueue?.[0]?.merchantId || state.merchantOnboardingQueue?.[0]?.id || "merchantos-demo";
      runMerchantRiskCheck?.(merchantId, item.name);
    } else if (item.category.includes("Wallet")) {
      evaluateWalletRisk?.({ amount: 275, velocity: 2, geoAnomaly: false, linkedAccountRisk: false });
    } else if (item.category.includes("Compliance")) {
      const controlId = state.compliancePrograms?.[0]?.id || "consumer-protection";
      updateComplianceControl?.(controlId, "in_review");
    } else if (item.category.includes("Operator")) {
      runOperatorCopilot?.({ title: item.name });
    } else if (item.category.includes("Mini-Programs")) {
      registerMiniAppRuntime?.({ appId: item.id, permissions: ["profile.read", "wallet.read", "thread:return"] });
    } else if (item.category.includes("Discovery")) {
      runUnifiedSearch?.(item.name);
      runSmartMatchmaking?.({ query: item.name, city: state.profile?.city || "" });
    }
    if (item.id.includes("conversion") || item.name.includes("Funnel")) {
      createConversionFunnel?.({ title: item.name, offer: "Blueprint conversion path" });
    }
    trackAnalyticsEvent?.({
      name: "blueprint_component_run",
      category: "blueprint",
      metadata: { componentId: item.id, category: item.category, targetTab }
    });
    setLastAction({ label: item.name, detail: `${getBlueprintRunLabel(item.category)} action completed.` });
  };

  return (
    <>
      <section className="surface-row two-up blueprint-hero-row">
        <article className="surface surface-strong blueprint-hero">
          <div className="surface-head">
            <p className="card-label">Organizer</p>
            <span className="badge">{components.length} ways</span>
          </div>
          <h2>FoxHub now has a clear place for everything.</h2>
          <p>
            The {components.length} helpful pieces are grouped by purpose, so people can move through identity, messages, buying,
            selling, shops, money, safety, support, mini apps, and discovery without guessing.
          </p>
          <div className="inline-actions wrap">
            <button type="button" className="accent-button" onClick={() => setActiveTab("discover")}>
              Open Services
            </button>
            <button type="button" className="ghost-button" onClick={() => setActiveTab("connectors")}>
              Open Tools
            </button>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Easy browsing</p>
            <span className="badge subtle">Organized</span>
          </div>
          <div className="blueprint-summary-grid">
            <div className="metric-card">
              <span className="metric-helper">Rooms</span>
              <strong>{categories.length}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-helper">Visible now</span>
              <strong>{filteredComponents.length}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-helper">Enabled</span>
              <strong>{enabledCount}</strong>
            </div>
          </div>
          <div className="surface-note">
            Instead of forcing all {components.length} into one long scroll, this room shows one section at a time and lets people search.
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Organizer rooms</p>
            <span className="badge subtle">{activeCategory}</span>
          </div>
          <div className="blueprint-toolbar">
            <input
              type="search"
              value={blueprintQuery}
              onChange={(event) => setBlueprintQuery(event.target.value)}
              placeholder="Search rooms, tools, or what you need"
              aria-label="Search organizer items"
            />
            <button type="button" className="ghost-button" onClick={() => setActiveCategory("All")}>
              Show All
            </button>
          </div>
          <div className="blueprint-category-tabs" role="tablist" aria-label="Organizer rooms">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={category === activeCategory ? "blueprint-category-tab active" : "blueprint-category-tab"}
                onClick={() => setActiveCategory(category)}
              >
                <strong>{category}</strong>
                <span>{categoryCounts[category]} ready</span>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Organizer list</p>
            <span className="badge subtle">{filteredComponents.length} shown</span>
          </div>
          {lastAction ? (
            <div className="blueprint-action-note">
              <strong>{lastAction.label}</strong>
              <span>{lastAction.detail}</span>
            </div>
          ) : null}
          <div className="blueprint-list">
            {filteredComponents.map((item) => (
              <div key={item.id} className="blueprint-component-row">
                <span className="blueprint-order">{String(item.order).padStart(2, "0")}</span>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.mechanic}</p>
                </div>
                <div className="blueprint-actions">
                  <span className={enabledFlags[`component_${item.id}`] ? "badge" : "badge subtle"}>
                    {enabledFlags[`component_${item.id}`] ? "Enabled" : item.category}
                  </span>
                  <button type="button" className="ghost-button small" onClick={() => enableComponent(item)}>
                    Enable
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => runComponent(item)}>
                    {getBlueprintRunLabel(item.category)}
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => setActiveTab(getBlueprintTargetTab(item.category))}>
                    Open
                  </button>
                </div>
              </div>
            ))}
            {filteredComponents.length === 0 ? (
              <div className="filtered-empty">
                <strong>No matching organizer items.</strong>
                <p>Try a broader search or switch rooms.</p>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="surface-row two-up">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Recent follow-up</p>
            <span className="badge subtle">{state.reliabilityQueue?.length || 0} queued</span>
          </div>
          <div className="list-stack">
            {(state.reliabilityQueue || []).slice(0, 5).map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.mutation}</strong>
                  <p>{item.status} · retries {item.retries || 0}</p>
                </div>
                <span className="badge subtle">{item.payload?.componentId || "FoxHub"}</span>
              </div>
            ))}
            {!state.reliabilityQueue?.length ? <p className="surface-note">Turn on or try an item to create the first update.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Organizer activity</p>
            <span className="badge subtle">{blueprintEvents.length} recent</span>
          </div>
          <div className="list-stack">
            {blueprintEvents.map((event) => (
              <div key={event.id} className="list-row">
                <div>
                  <strong>{event.name}</strong>
                  <p>{event.metadata?.componentId || "component"} · {event.metadata?.category || "blueprint"}</p>
                </div>
                <span className="badge subtle">{new Date(event.createdAt).toLocaleTimeString()}</span>
              </div>
            ))}
            {!blueprintEvents.length ? <p className="surface-note">Run a component to populate the action trail.</p> : null}
          </div>
        </article>
      </section>
    </>
  );
}

function normalizeConnectorStatus(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("active") || normalized.includes("live") || normalized.includes("connected")) return "Active";
  return "Ready";
}

function connectorStatusBadge(status = "") {
  return normalizeConnectorStatus(status) === "Active" ? "badge" : "badge subtle";
}

function formatConnectorDate(value) {
  if (!value) return "Not checked yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not checked yet";
  return date.toLocaleString();
}

function formatAuditDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

const STAFF_ROLE_TEMPLATES = [
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

const COMPLAINT_ZERO_CONTROLS = [
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

function ManagementWorkspace({
  state,
  busy,
  setActiveTab,
  resolveVerificationCase,
  resolveLocalListing,
  moderateRatingRecord,
  reviewMemberApplication,
  addFoxHubStaffMember,
  runOperatorCopilot,
  recalculateTrustEngine,
  buildNotificationDigest,
  setNotificationPolicy,
  runMerchantRiskCheck,
  updateComplianceControl,
  reviewMerchantSettlement,
  reportTrustSafetyIncident,
  openDisputeCase,
  resolveDisputeCase,
  markNotificationRead,
  revokeDeviceSession,
  evaluateWalletRisk
}) {
  const [staffDraft, setStaffDraft] = useState({
    name: "New FoxHub Staff Member",
    email: "support.staff@foxhub.app",
    role: "support-ops",
    title: "Support Operations Specialist",
    department: "Support Operations",
    scopes: "support, member-review, connections, notifications, account-recovery"
  });
  const reviewRecords = (state.userRecords || []).filter((record) => {
    const stage = String(record.stage || "").toLowerCase();
    const identity = String(record.identityState || "").toLowerCase();
    const tags = (record.tags || []).join(" ").toLowerCase();
    return stage === "review" || stage === "pending" || identity === "review" || tags.includes("pending") || tags.includes("waitlist");
  });
  const activeMembers = (state.userRecords || []).filter((record) => String(record.stage || "").toLowerCase() === "active");
  const applicantQueue = reviewRecords.length ? reviewRecords : (state.userRecords || []).slice(0, 6);
  const verificationQueue = (state.verificationCases || []).filter((item) => ["review", "open", "pending"].includes(String(item.status || "").toLowerCase())).slice(0, 6);
  const moderationQueue = [
    ...(state.moderationCases || []).map((item) => ({ ...item, queueType: "listing" })),
    ...(state.ratingModerationQueue || []).map((item) => ({ ...item, queueType: "rating" }))
  ].filter((item) => !["resolved", "approved", "removed"].includes(String(item.status || "").toLowerCase())).slice(0, 6);
  const applicantEmailNotices = (state.notificationEvents || [])
    .filter((item) => item.category === "email" && item.template === "foxhub_member_application_decision")
    .slice(0, 4);
  const merchantRiskQueue = (state.merchantOnboardingQueue || []).slice(0, 4);
  const settlementQueue = (state.merchantSettlements || []).filter((item) => !["settled", "released"].includes(String(item.status || "").toLowerCase())).slice(0, 4);
  const complianceQueue = (state.compliancePrograms || []).slice(0, 4);
  const auditQueue = (state.auditEvents || []).slice(0, 5);
  const operatorInsights = (state.copilotInsights || []).slice(0, 3);
  const notificationDigest = buildNotificationDigest ? buildNotificationDigest().slice(0, 4) : (state.notificationEvents || []).slice(0, 4);
  const disputeQueue = (state.disputeCases || []).filter((item) => String(item.status || "").toLowerCase() !== "resolved").slice(0, 5);
  const fraudQueue = (state.fraudHoldQueue || []).filter((item) => String(item.status || "").toLowerCase() !== "clear").slice(0, 5);
  const securityQueue = (state.trustSafetyIncidents || []).filter((item) => !["resolved", "closed"].includes(String(item.status || "").toLowerCase())).slice(0, 5);
  const supportNotifications = (state.notificationEvents || []).filter((item) =>
    ["support", "security", "safety", "payments", "risk", "compliance"].includes(String(item.category || "").toLowerCase()) && item.status !== "read"
  ).slice(0, 5);
  const deviceReviewQueue = (state.deviceSessions || []).filter((item) => String(item.sessionState || "").toLowerCase() !== "revoked").slice(0, 5);
  const pendingStaffMembers = (state.pendingStaffMembers || []).slice(0, 5);
  const staffOperatorRecords = (state.operatorAccessRecords || []).filter((item) => item.id !== "operator-access-founder").slice(0, 5);
  const supportMacros = [
    { id: "account-recovery", title: "Account recovery", detail: "Verify email, revoke risky devices, and ask for fresh sign-in." },
    { id: "payment-dispute", title: "Payment dispute", detail: "Open dispute, hold payout if needed, and request evidence." },
    { id: "fraud-report", title: "Fraud report", detail: "Create safety incident, run wallet risk, and preserve audit context." },
    { id: "harassment", title: "Harassment or abuse", detail: "Route to Trust Support, block if needed, and log moderation review." },
    { id: "merchant-onboarding", title: "Merchant onboarding", detail: "Check merchant risk, settlement readiness, and compliance notes." },
    { id: "staff-access", title: "Staff access review", detail: "Review role scope, audit trails, and account security before elevation." }
  ];
  const staffControlLoadout = [
    {
      title: "Access review",
      detail: "Create a staff copilot review for role scope, pending invites, and permission changes.",
      action: () => runOperatorCopilot?.({ title: "Staff access review" })
    },
    {
      title: "Permission audit",
      detail: "Build a notification digest and surface operator-access changes for review.",
      action: () => buildNotificationDigest?.()
    },
    {
      title: "Member application sweep",
      detail: "Run the trust engine before reviewing pending member access.",
      action: () => recalculateTrustEngine?.()
    },
    {
      title: "Fraud hold",
      detail: "Generate a wallet fraud-hold review with velocity and linked-account risk.",
      action: () => evaluateWalletRisk?.({ amount: 2400, velocity: 8, geoAnomaly: true, linkedAccountRisk: true })
    },
    {
      title: "Security incident",
      detail: "Open a high-severity security incident for account takeover or impersonation.",
      action: () => reportTrustSafetyIncident?.({ type: "account_takeover", severity: "high", channel: "staff_controls", owner: "Security Ops", detail: "Staff opened an account takeover investigation from Management." })
    },
    {
      title: "Dispute intake",
      detail: "Open a payment or service dispute case for support investigation.",
      action: () => openDisputeCase?.({ merchantName: "Staff dispute intake", merchantId: "staff-dispute-intake", amount: "$0.00", reason: "staff_dispute_intake", owner: "Dispute Ops", detail: "Staff opened a dispute intake from Management controls." })
    },
    {
      title: "Compliance review",
      detail: "Mark a compliance control reviewed and keep it visible in audit.",
      action: () => updateComplianceControl?.("kyc-program", "reviewed")
    },
    {
      title: "Merchant risk",
      detail: "Run a merchant risk check for onboarding and settlement readiness.",
      action: () => runMerchantRiskCheck?.("merchant-onboarding", "staff controls review")
    },
    {
      title: "Settlement approval",
      detail: "Approve a waiting settlement record when a queue item is available.",
      action: () => settlementQueue[0] ? reviewMerchantSettlement?.(settlementQueue[0].id || settlementQueue[0].settlementId, "approved") : runOperatorCopilot?.({ title: "Settlement readiness review" })
    },
    {
      title: "Device recovery",
      detail: "Revoke the oldest active device session in the recovery queue.",
      action: () => deviceReviewQueue[0] ? revokeDeviceSession?.(deviceReviewQueue[0].id) : reportTrustSafetyIncident?.({ type: "device_recovery_review", severity: "medium", channel: "staff_controls", owner: "Security Ops", detail: "Staff opened a device recovery review." })
    }
  ];
  const complaintZeroStats = [
    { label: "Feed Control", value: (state.uxDiscoveryViews || []).length + (state.uxRoleHomeLayouts || []).length },
    { label: "Commercial Boundaries", value: (state.merchantOnboardingQueue || []).length + (state.listings || []).filter((item) => item.featured).length },
    { label: "Safety and Moderation", value: securityQueue.length + moderationQueue.length },
    { label: "Trust and Anti-Spam", value: fraudQueue.length + (state.merchantRiskSignals || []).length },
    { label: "Privacy and Account Control", value: deviceReviewQueue.length + (state.blockedContacts || []).length },
    { label: "Attention and Notification Health", value: supportNotifications.length + (state.notificationSubscriptions || []).length },
    { label: "Support and Dispute Resolution", value: disputeQueue.length + applicantEmailNotices.length },
    { label: "Product Guardrails", value: (state.auditEvents || []).filter((item) => String(item.action || item.type || "").includes("product")).length }
  ];
  const complaintZeroLoadout = COMPLAINT_ZERO_CONTROLS.map((control) => {
    const actionMap = {
      "feed-control": () => runOperatorCopilot?.({ title: "Feed Control complaint review" }),
      "commercial-boundaries": () => runOperatorCopilot?.({ title: "Commercial boundary audit" }),
      "safety-moderation": () => reportTrustSafetyIncident?.({ type: "harmful_recommendation_review", severity: "high", channel: "complaint_zero_staff", owner: "Trust Ops", detail: "Staff opened a safety and moderation complaint-zero review." }),
      "trust-anti-spam": () => evaluateWalletRisk?.({ amount: 900, velocity: 10, geoAnomaly: false, linkedAccountRisk: true }),
      "privacy-account-control": () => reportTrustSafetyIncident?.({ type: "privacy_or_account_control_review", severity: "medium", channel: "complaint_zero_staff", owner: "Privacy Ops", detail: "Staff opened a privacy/account-control complaint review." }),
      "attention-notifications": () => setNotificationPolicy?.({ mode: "digest", muteLowPriority: true, quietHours: true }),
      "support-disputes": () => openDisputeCase?.({ merchantName: "Complaint-zero support", merchantId: "complaint-zero-support", amount: "$0.00", reason: "support_sla_review", owner: "Support Ops", detail: "Staff opened a support and dispute resolution SLA review." }),
      "product-guardrails": () => runOperatorCopilot?.({ title: "Product guardrails drift review" })
    };
    return {
      ...control,
      action: actionMap[control.id] || (() => runOperatorCopilot?.({ title: `${control.label} review` }))
    };
  });
  const staffImprovementPreview = staffImprovementRoadmap.slice(0, 12);
  const highRiskStaffImprovements = staffImprovementRoadmap.filter((item) => item.requiresApproval || item.riskLevel === "critical" || item.riskLevel === "high");
  const staffStats = [
    { label: "Applications", value: reviewRecords.length },
    { label: "Members", value: activeMembers.length },
    { label: "Verification", value: verificationQueue.length },
    { label: "Moderation", value: moderationQueue.length },
    { label: "Risk", value: (state.merchantRiskSignals || []).length },
    { label: "Support", value: disputeQueue.length + fraudQueue.length + securityQueue.length + supportNotifications.length }
  ];
  const currentProfile = state.profile || {};
  const founderManager = hasFoxHubManagementAccess(currentProfile);
  const founderOperatorRecord = (state.operatorAccessRecords || []).find((item) => item.id === "operator-access-founder" || hasFoxHubManagementAccess(item));
  const staffMemberRecord = state.staffMemberRecord || null;
  const staffDatabaseLabel = staffMemberRecord ? "staffMembers synced" : founderManager || founderOperatorRecord ? "staffMembers pending sync" : "member mode only";
  const managementScopeLabels = founderOperatorRecord?.scopes?.length
    ? founderOperatorRecord.scopes
    : ["members", "verification", "moderation", "billing"];

  function updateStaffDraft(field, value) {
    setStaffDraft((current) => ({ ...current, [field]: value }));
  }

  function applyRoleTemplate(role) {
    const template = STAFF_ROLE_TEMPLATES.find((item) => item.role === role);
    if (!template) {
      updateStaffDraft("role", role);
      return;
    }
    setStaffDraft((current) => ({
      ...current,
      role: template.role,
      title: template.title,
      department: template.department,
      scopes: template.scopes.join(", ")
    }));
  }

  function submitStaffMember(event) {
    event.preventDefault();
    const result = addFoxHubStaffMember?.({
      ...staffDraft,
      scopes: staffDraft.scopes.split(",").map((scope) => scope.trim()).filter(Boolean)
    });
    if (result?.staffRecord) {
      setStaffDraft((current) => ({
        ...current,
        email: result.staffRecord.email,
        name: result.staffRecord.name
      }));
    }
  }

  return (
    <>
      <section className="surface-row two-up staff-console-hero">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Management dashboard</p>
            <span className="badge subtle">Staff / manager / moderator</span>
          </div>
          <h2>Staff control center for access, trust, risk, and operations.</h2>
          <p className="surface-note">
            Staff and management accounts now stay in operator mode. Member social, rapport, pay, goodies, and public member content are removed from this workspace so the console focuses on review queues and controls.
          </p>
          <div className="staff-stat-grid">
            {staffStats.map((item) => (
              <div key={item.label} className="staff-stat-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">{founderManager ? "Operator identity" : "Staff identity"}</p>
            <span className="badge subtle">{founderManager ? "Primary operator" : "Scoped access"}</span>
          </div>
          {founderManager ? (
            <div className="management-profile-card">
              <div>
                <strong>{currentProfile.name || "FoxHub Founder"}</strong>
                <p>{currentProfile.email || "solidartentertainment@gmail.com"}</p>
              </div>
              <div className="staff-profile-facts">
                <span>{staffMemberRecord?.role || currentProfile.role || "founder"}</span>
                <span>{founderOperatorRecord?.state || "active"}</span>
                <span>{staffMemberRecord?.title || currentProfile.accessNote || "Founder management access"}</span>
                  <span>{currentProfile.city || "Location unset"}</span>
              </div>
              <div className="database-mode-grid" aria-label="Profile database split">
                <div>
                  <span>Member database</span>
                  <strong>users/{"{uid}"}</strong>
                  <p>Member profile and app state.</p>
                </div>
                <div>
                  <span>Staff database</span>
                  <strong>{staffDatabaseLabel}</strong>
                  <p>{staffMemberRecord?.department || "Staff identity stays separate."}</p>
                </div>
                <div>
                  <span>Permissions</span>
                  <strong>{founderOperatorRecord ? "operatorAccess active" : "operatorAccess pending"}</strong>
                  <p>Role scopes and admin access.</p>
                </div>
              </div>
              <div className="management-scope-grid">
                {managementScopeLabels.map((scope) => (
                  <span key={scope}>{scope}</span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="staff-action-grid">
            <button type="button" className="action-pill" onClick={() => recalculateTrustEngine?.()}>
              <strong>Run trust engine</strong>
              <p>Recalculate profile, listing, and merchant trust scores for review decisions.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => runOperatorCopilot?.({ title: "Staff console triage" })}>
              <strong>Run operator copilot</strong>
              <p>Create a triage recommendation from open verifications and disputes.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => setNotificationPolicy?.({ mode: "priority", muteLowPriority: true })}>
              <strong>Set priority alerts</strong>
              <p>Mute low-priority noise and keep staff attention on risk, disputes, and compliance.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => setActiveTab("connectors")}>
              <strong>Open staff tools</strong>
              <p>Manage Stripe, API connectors, checks, and integration readiness.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => setActiveTab("blueprint")}>
              <strong>Open control library</strong>
              <p>Find admin, policy, role, permission, moderation, and compliance components.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => buildNotificationDigest?.()}>
              <strong>Build notification digest</strong>
              <p>Sort the current staff notification stream by operational priority.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => reportTrustSafetyIncident?.({ type: "staff_security_sweep", severity: "high", channel: "management", owner: "Trust Ops", detail: "Staff opened a security sweep from Management." })}>
              <strong>Open security sweep</strong>
              <p>Create a trust and safety incident for fraud, impersonation, account takeover, or abuse.</p>
            </button>
            <button type="button" className="action-pill" onClick={() => evaluateWalletRisk?.({ amount: 1800, velocity: 6, geoAnomaly: true, linkedAccountRisk: true })}>
              <strong>Run fraud hold test</strong>
              <p>Generate a wallet-risk review record for fraud operations.</p>
            </button>
          </div>
        </article>
      </section>

      <section className="surface-row two-up staff-member-setup">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Add new FoxHub Staff Member</p>
            <span className="badge subtle">operatorAccess + staffMembers</span>
          </div>
          <h2>Invite staff and stage their management permissions.</h2>
          <form className="staff-member-form" onSubmit={submitStaffMember}>
            <label>
              <span>Name</span>
              <input type="text" value={staffDraft.name} onChange={(event) => updateStaffDraft("name", event.target.value)} />
            </label>
            <label>
              <span>Staff email</span>
              <input type="email" value={staffDraft.email} onChange={(event) => updateStaffDraft("email", event.target.value)} />
            </label>
            <label>
              <span>Role</span>
              <select value={staffDraft.role} onChange={(event) => applyRoleTemplate(event.target.value)}>
                {STAFF_ROLE_TEMPLATES.map((template) => (
                  <option key={template.role} value={template.role}>{template.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Title</span>
              <input type="text" value={staffDraft.title} onChange={(event) => updateStaffDraft("title", event.target.value)} />
            </label>
            <label>
              <span>Department</span>
              <input type="text" value={staffDraft.department} onChange={(event) => updateStaffDraft("department", event.target.value)} />
            </label>
            <label className="wide-field">
              <span>Permission scopes</span>
              <input type="text" value={staffDraft.scopes} onChange={(event) => updateStaffDraft("scopes", event.target.value)} />
            </label>
            <button type="submit" className="primary-action" disabled={busy || !staffDraft.email.trim()}>
              Add staff member
            </button>
          </form>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Staff setup queue</p>
            <span className="badge subtle">{pendingStaffMembers.length + staffOperatorRecords.length} staged</span>
          </div>
          <div className="list-stack">
            {pendingStaffMembers.map((member) => (
              <div key={member.id} className="list-row compact-row">
                <div>
                  <strong>{member.name}</strong>
                  <p>{member.email} - {member.title || member.role}</p>
                </div>
                <span className="badge review">{member.status || "invited"}</span>
              </div>
            ))}
            {!pendingStaffMembers.length ? (
              <div className="list-row compact-row">
                <div>
                  <strong>New FoxHub Staff Member</strong>
                  <p>support.staff@foxhub.app - Support Operations Specialist</p>
                </div>
                <span className="badge subtle">ready</span>
              </div>
            ) : null}
            {staffOperatorRecords.map((record) => (
              <div key={record.id} className="list-row compact-row">
                <div>
                  <strong>{record.email || record.userId}</strong>
                  <p>{record.role || "staff"} - {(record.scopes || []).join(", ") || "scopes pending"}</p>
                </div>
                <span className="badge subtle">{record.state || "active"}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Staff role library</p>
            <span className="badge subtle">{STAFF_ROLE_TEMPLATES.length} roles</span>
          </div>
          <div className="staff-role-grid">
            {STAFF_ROLE_TEMPLATES.map((template) => (
              <button key={template.role} type="button" className="staff-role-card" onClick={() => applyRoleTemplate(template.role)}>
                <strong>{template.label}</strong>
                <span>{template.title}</span>
                <p>{template.scopes.slice(0, 4).join(", ")}</p>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row three-up staff-support-ops">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Support operations</p>
            <span className="badge subtle">{supportNotifications.length + disputeQueue.length} active</span>
          </div>
          <h2>Support, disputes, fraud, and security stay in staff view.</h2>
          <p className="surface-note">
            These controls are intentionally staff-only. They collect member support requests, payment disputes, fraud holds, security incidents, risky devices, and unread operational alerts without sending staff back into member content.
          </p>
          <div className="staff-control-grid">
            <button type="button" className="staff-control-card" onClick={() => openDisputeCase?.({ merchantName: "Member support", merchantId: "member-support", amount: "$0.00", reason: "staff_support_case", owner: "Support Ops", detail: "Staff opened a general support case from Management." })}>
              <strong>Open support case</strong>
              <span>Create a support/dispute case for account, payment, service, or marketplace issues.</span>
            </button>
            <button type="button" className="staff-control-card" onClick={() => reportTrustSafetyIncident?.({ type: "fraud_or_security_report", severity: "high", channel: "support_ops", owner: "Trust Ops", detail: "Staff escalated a fraud, security, impersonation, or abuse concern." })}>
              <strong>Escalate fraud/security</strong>
              <span>Create a trust and safety incident for staff investigation.</span>
            </button>
            <button type="button" className="staff-control-card" onClick={() => setNotificationPolicy?.({ mode: "support-priority", muteLowPriority: true })}>
              <strong>Support priority mode</strong>
              <span>Focus alerts on disputes, fraud, security, compliance, and payment risk.</span>
            </button>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Support macros</p>
            <span className="badge subtle">{supportMacros.length} playbooks</span>
          </div>
          <div className="list-stack">
            {supportMacros.map((macro) => (
              <div key={macro.id} className="list-row compact-row">
                <div>
                  <strong>{macro.title}</strong>
                  <p>{macro.detail}</p>
                </div>
                <button type="button" className="ghost-button small" onClick={() => runOperatorCopilot?.({ title: `${macro.title} playbook` })} disabled={busy}>
                  Use
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Support alerts</p>
            <span className="badge subtle">{supportNotifications.length} unread</span>
          </div>
          <div className="list-stack">
            {supportNotifications.map((item) => (
              <div key={item.id} className="list-row compact-row">
                <div>
                  <strong>{item.title || item.subject || "Support alert"}</strong>
                  <p>{item.body || item.emailBody || item.category}</p>
                </div>
                <button type="button" className="ghost-button small" onClick={() => markNotificationRead?.(item.id)} disabled={busy}>
                  Clear
                </button>
              </div>
            ))}
            {!supportNotifications.length ? <p className="panel-copy">No unread support alerts.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Loaded staff controls</p>
            <span className="badge subtle">{staffControlLoadout.length} controls</span>
          </div>
          <div className="staff-control-grid loaded-staff-controls">
            {staffControlLoadout.map((control) => (
              <button key={control.title} type="button" className="staff-control-card" onClick={control.action} disabled={busy}>
                <strong>{control.title}</strong>
                <span>{control.detail}</span>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up complaint-zero-dashboard">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Complaint-zero dashboard</p>
            <span className="badge subtle">{complaintZeroStats.length} categories</span>
          </div>
          <h2>Track the eight complaint sources before they repeat.</h2>
          <div className="complaint-stat-grid">
            {complaintZeroStats.map((item) => (
              <div key={item.label} className="staff-stat-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Complaint-zero staff controls</p>
            <span className="badge subtle">{complaintZeroLoadout.length} actions</span>
          </div>
          <div className="complaint-control-grid">
            {complaintZeroLoadout.map((control) => (
              <button key={control.id} type="button" className="staff-control-card" onClick={control.action} disabled={busy}>
                <strong>{control.label}</strong>
                <span>{control.staffAction} - {control.detail}</span>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row two-up staff-improvement-roadmap">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Staff improvement roadmap</p>
            <span className="badge subtle">{staffImprovementSummary.total} controls</span>
          </div>
          <h2>One hundred twenty staff-side upgrades are staged across eight workstreams.</h2>
          <div className="complaint-stat-grid">
            <div className="staff-stat-card">
              <span>Packs</span>
              <strong>{staffImprovementSummary.packs}</strong>
            </div>
            <div className="staff-stat-card">
              <span>Approval required</span>
              <strong>{staffImprovementSummary.approvalRequired}</strong>
            </div>
            <div className="staff-stat-card">
              <span>High risk</span>
              <strong>{staffImprovementSummary.criticalRisk}</strong>
            </div>
            <div className="staff-stat-card">
              <span>Preview</span>
              <strong>{staffImprovementPreview.length}</strong>
            </div>
          </div>
          <div className="staff-role-grid">
            {staffImprovementPacks.map((pack) => (
              <button key={pack.id} type="button" className="staff-role-card" onClick={() => runOperatorCopilot?.({ title: `${pack.label} staff improvement review` })} disabled={busy}>
                <strong>{pack.label}</strong>
                <span>{pack.range}</span>
                <p>{pack.records.length} controls staged for Management review.</p>
              </button>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Next staff controls</p>
            <span className="badge subtle">{highRiskStaffImprovements.length} guarded</span>
          </div>
          <div className="list-stack">
            {staffImprovementPreview.map((item) => (
              <div key={item.id} className="list-row compact-row">
                <div>
                  <strong>{String(item.sequence).padStart(2, "0")}. {item.title}</strong>
                  <p>{item.description}</p>
                  <div className="row-meta-text">{item.packLabel} - {item.owner} - {item.priority}</div>
                </div>
                <button type="button" className="ghost-button small" onClick={() => runOperatorCopilot?.({ title: `${item.title} implementation review` })} disabled={busy}>
                  Review
                </button>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row three-up staff-control-center">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Operator controls</p>
            <span className="badge subtle">Actual staff actions</span>
          </div>
          <div className="staff-control-grid">
            <button type="button" className="staff-control-card" onClick={() => recalculateTrustEngine?.()}>
              <strong>Trust recalculation</strong>
              <span>Refresh trust score engine.</span>
            </button>
            <button type="button" className="staff-control-card" onClick={() => runOperatorCopilot?.({ title: "Access and safety triage" })}>
              <strong>Ops triage</strong>
              <span>Generate staff recommendations.</span>
            </button>
            <button type="button" className="staff-control-card" onClick={() => setActiveTab("connectors")}>
              <strong>Connector setup</strong>
              <span>Open integration controls.</span>
            </button>
            <button type="button" className="staff-control-card" onClick={() => setActiveTab("blueprint")}>
              <strong>Control library</strong>
              <span>Open admin components.</span>
            </button>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Notification digest</p>
            <span className="badge subtle">{notificationDigest.length} priority</span>
          </div>
          <div className="list-stack">
            {notificationDigest.map((item) => (
              <div key={item.id || item.title} className="list-row compact-row">
                <div>
                  <strong>{item.title || item.subject || "Staff notice"}</strong>
                  <p>{item.body || item.emailBody || item.category || "No detail"}</p>
                </div>
                <span className="badge subtle">{item.category || "system"}</span>
              </div>
            ))}
            {!notificationDigest.length ? <p className="panel-copy">No staff notifications are waiting.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Audit trail</p>
            <span className="badge subtle">{auditQueue.length} recent</span>
          </div>
          <div className="list-stack">
            {auditQueue.map((item) => (
              <div key={item.id || `${item.type}-${item.createdAt}`} className="list-row compact-row">
                <div>
                  <strong>{item.action || item.type || "Audit event"}</strong>
                  <p>{item.detail || item.targetId || "No detail recorded"}</p>
                </div>
                <span className={item.severity === "high" ? "badge review" : "badge subtle"}>{item.severity || "info"}</span>
              </div>
            ))}
            {!auditQueue.length ? <p className="panel-copy">Staff actions and policy events will appear here.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">FoxHub Member applications</p>
            <span className="badge subtle">{applicantQueue.length} visible</span>
          </div>
          <div className="surface-note">
            Accepting an application marks the record active; priority gives priority support. Holds and rejects stay visible with audit and notification records.
          </div>
          <div className="staff-application-grid">
            {applicantQueue.map((record) => (
              <div key={record.id} className="staff-application-card">
                <div className="staff-application-head">
                  <div>
                    <strong>{record.profile?.displayName || record.contactId || record.id}</strong>
                    <p>{record.profile?.email || record.contactId || "No email on record"}</p>
                  </div>
                  <span className={String(record.stage || "").toLowerCase() === "active" ? "badge" : "badge review"}>{record.stage || "review"}</span>
                </div>
                <div className="staff-profile-facts">
                  <span>{record.accountType || "member"}</span>
                  <span>{record.profile?.city || "Unknown city"}</span>
                  <span>{record.identityState || "review"}</span>
                  <span>{record.supportTier || "standard"}</span>
                </div>
                <p>{record.notes || "No staff notes yet."}</p>
                <div className="inline-actions wrap">
                  <button type="button" className="ghost-button small" onClick={() => reviewMemberApplication(record.id, "approve")} disabled={busy}>
                    Accept member
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => reviewMemberApplication(record.id, "priority")} disabled={busy}>
                    Priority
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => reviewMemberApplication(record.id, "hold")} disabled={busy}>
                    Hold
                  </button>
                  <button type="button" className="danger-button small" onClick={() => reviewMemberApplication(record.id, "reject")} disabled={busy}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
            {!applicantQueue.length ? <FilteredEmptyState label="member applications" /> : null}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel compliance-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Verification queue</p>
            <span className="badge subtle">{verificationQueue.length} open</span>
          </div>
          <div className="list-stack">
            {verificationQueue.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.label || item.targetId}</strong>
                  <p>{item.targetType} · {item.stage} · {item.owner}</p>
                </div>
                <div className="inline-actions wrap">
                  <button type="button" className="ghost-button small" onClick={() => resolveVerificationCase(item.id, "approved")} disabled={busy}>
                    Approve
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => resolveVerificationCase(item.id, "follow_up")} disabled={busy}>
                    Follow up
                  </button>
                </div>
              </div>
            ))}
            {!verificationQueue.length ? <p className="panel-copy">No verification cases need staff review.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Moderator queue</p>
            <span className="badge subtle">{moderationQueue.length} open</span>
          </div>
          <div className="list-stack">
            {moderationQueue.map((item) => (
              <div key={`${item.queueType}-${item.id || item.recordId}`} className="list-row">
                <div>
                  <strong>{item.title || item.targetId || item.recordId}</strong>
                  <p>{item.reason || item.detail || item.status || "Needs review"}</p>
                </div>
                <div className="inline-actions wrap">
                  {item.queueType === "rating" ? (
                    <>
                      <button type="button" className="ghost-button small" onClick={() => moderateRatingRecord(item.recordId, "approved")} disabled={busy}>
                        Approve
                      </button>
                      <button type="button" className="ghost-button small" onClick={() => moderateRatingRecord(item.recordId, "removed")} disabled={busy}>
                        Remove
                      </button>
                    </>
                  ) : (
                    <button type="button" className="ghost-button small" onClick={() => resolveLocalListing(item.listingId || item.targetId || item.id, "Cleared by staff console")} disabled={busy}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!moderationQueue.length ? <p className="panel-copy">No moderator cases need staff review.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row three-up staff-control-center">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Merchant risk controls</p>
            <span className="badge subtle">{merchantRiskQueue.length} merchants</span>
          </div>
          <div className="list-stack">
            {merchantRiskQueue.map((item) => (
              <div key={item.merchantId || item.id} className="list-row compact-row">
                <div>
                  <strong>{item.merchantName || item.name || item.merchantId || item.id}</strong>
                  <p>{item.status || item.stage || "Pending risk review"}</p>
                </div>
                <button type="button" className="ghost-button small" onClick={() => runMerchantRiskCheck?.(item.merchantId || item.id, "staff console review")} disabled={busy}>
                  Run risk
                </button>
              </div>
            ))}
            {!merchantRiskQueue.length ? <p className="panel-copy">No merchant onboarding records need risk checks.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Settlement controls</p>
            <span className="badge subtle">{settlementQueue.length} open</span>
          </div>
          <div className="list-stack">
            {settlementQueue.map((item) => (
              <div key={item.id || item.settlementId} className="list-row compact-row">
                <div>
                  <strong>{item.merchantName || item.merchantId || item.id}</strong>
                  <p>{item.amount || "Amount pending"} · {item.status || "review"}</p>
                </div>
                <button type="button" className="ghost-button small" onClick={() => reviewMerchantSettlement?.(item.id || item.settlementId, "approved")} disabled={busy}>
                  Approve
                </button>
              </div>
            ))}
            {!settlementQueue.length ? <p className="panel-copy">No settlements are waiting for staff action.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Compliance controls</p>
            <span className="badge subtle">{complianceQueue.length} controls</span>
          </div>
          <div className="list-stack">
            {complianceQueue.map((item) => (
              <div key={item.id} className="list-row compact-row">
                <div>
                  <strong>{item.name || item.title || item.id}</strong>
                  <p>{item.status || "review"} · {item.owner || "Staff"}</p>
                </div>
                <button type="button" className="ghost-button small" onClick={() => updateComplianceControl?.(item.id, "reviewed")} disabled={busy}>
                  Mark reviewed
                </button>
              </div>
            ))}
            {!complianceQueue.length ? <p className="panel-copy">No compliance controls are configured yet.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row three-up staff-support-ops">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Dispute queue</p>
            <span className="badge subtle">{disputeQueue.length} open</span>
          </div>
          <div className="list-stack">
            {disputeQueue.map((item) => (
              <div key={item.id} className="list-row compact-row">
                <div>
                  <strong>{item.merchantName || item.merchantId || item.id}</strong>
                  <p>{item.reason} · {item.amount} · {item.owner || "Support Ops"}</p>
                </div>
                <button type="button" className="ghost-button small" onClick={() => resolveDisputeCase?.(item.id, "resolved")} disabled={busy}>
                  Resolve
                </button>
              </div>
            ))}
            {!disputeQueue.length ? <p className="panel-copy">No open disputes.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Fraud hold queue</p>
            <span className="badge subtle">{fraudQueue.length} held</span>
          </div>
          <div className="list-stack">
            {fraudQueue.map((item) => (
              <div key={item.id} className="list-row compact-row">
                <div>
                  <strong>${Number(item.amount || 0).toFixed(2)} risk review</strong>
                  <p>score {item.riskScore} · velocity {item.velocity} · {item.geoAnomaly ? "geo anomaly" : "normal geo"}</p>
                </div>
                <span className={item.status === "hold" ? "badge review" : "badge subtle"}>{item.status}</span>
              </div>
            ))}
            {!fraudQueue.length ? <p className="panel-copy">No wallet fraud holds are open.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Security concerns</p>
            <span className="badge subtle">{securityQueue.length} active</span>
          </div>
          <div className="list-stack">
            {securityQueue.map((item) => (
              <div key={item.id} className="list-row compact-row">
                <div>
                  <strong>{item.type}</strong>
                  <p>{item.detail} · {item.owner || "Trust Ops"}</p>
                </div>
                <span className={item.severity === "critical" || item.severity === "high" ? "badge review" : "badge subtle"}>{item.severity}</span>
              </div>
            ))}
            {!securityQueue.length ? <p className="panel-copy">No security incidents are active.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Device and account recovery review</p>
            <span className="badge subtle">{deviceReviewQueue.length} sessions</span>
          </div>
          <div className="list-stack">
            {deviceReviewQueue.map((item) => (
              <div key={item.id} className="list-row compact-row">
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.platform} · {item.location} · {item.trust} · {item.sessionState}</p>
                </div>
                <button type="button" className="ghost-button small" onClick={() => revokeDeviceSession?.(item.id)} disabled={busy}>
                  Revoke session
                </button>
              </div>
            ))}
            {!deviceReviewQueue.length ? <p className="panel-copy">No active device sessions need review.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Operator copilot insights</p>
            <span className="badge subtle">{operatorInsights.length} recent</span>
          </div>
          <div className="list-stack">
            {operatorInsights.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </div>
                <span className="badge subtle">{formatAuditDate(item.createdAt)}</span>
              </div>
            ))}
            {!operatorInsights.length ? <p className="panel-copy">Run operator copilot to create the first triage recommendation.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Applicant email notices</p>
            <span className="badge subtle">{applicantEmailNotices.length} recent</span>
          </div>
          <div className="list-stack">
            {applicantEmailNotices.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.subject || item.title}</strong>
                  <p>{item.toEmail || "No recipient"} · {item.deliveryState || "queued"} · {item.emailBody || item.body}</p>
                </div>
                <span className={item.deliveryState === "sent" ? "badge" : "badge review"}>{item.deliveryState || "queued"}</span>
              </div>
            ))}
            {!applicantEmailNotices.length ? <p className="panel-copy">Approval and denial email notices will appear here after manager review.</p> : null}
          </div>
        </article>
      </section>
    </>
  );
}

function ConnectorsWorkspace({ state, saveConnectorIntent, openConnectorSurface, connectConnector, testConnector, disconnectConnector, prepareStripeConnector }) {
  const automationCount = state.apiConnectors.filter((item) => item.automation && item.automation !== "Manual").length;
  const activeCount = state.apiConnectors.filter((item) => normalizeConnectorStatus(item.status) === "Active").length;
  const readyCount = Math.max(state.apiConnectors.length - activeCount, 0);
  const stripeConnector = state.apiConnectors.find((item) => item.id === "stripe-connect") || null;
  const stripeReady = Boolean(stripeConnector?.stripeReady || stripeConnector?.setupComplete || normalizeConnectorStatus(stripeConnector?.status) === "Active");
  const stripeMissingFields = Array.isArray(stripeConnector?.missingProfileFields) ? stripeConnector.missingProfileFields : [];
  const stripeBillingPlans = [
    {
      id: "verified-user",
      name: "Verified user badge",
      price: "$20/mo",
      audience: "Creators, operators, local service pros",
      status: "Ready for Stripe Price ID"
    },
    {
      id: "merchant-tools",
      name: "Merchant tools",
      price: "Usage + platform fee",
      audience: "Local merchants and service providers",
      status: "Needs live checkout session"
    },
    {
      id: "mini-app-billing",
      name: "Mini-app billing",
      price: "Subscription or commission",
      audience: "Mini-app owners and marketplace partners",
      status: "Needs product mapping"
    }
  ];
  const stripeBillingReadiness = [
    { label: "Client packages", value: "@stripe/react-stripe-js + @stripe/stripe-js", state: "Installed" },
    { label: "Server package", value: "Functions stripe SDK", state: "Installed" },
    { label: "Webhook capture", value: "stripeWebhookEvents + billingSubscriptionEvents", state: "Installed" },
    { label: "Connector", value: stripeReady ? "Profile ready for account linking" : stripeMissingFields.length ? `Missing ${stripeMissingFields.join(", ")}` : "Run prepare check", state: stripeReady ? "Ready" : "Setup" }
  ];

  return (
    <>
      <section className="surface-row two-up">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">API connectors</p>
            <span className="badge subtle">{state.apiConnectors.length} tracked</span>
          </div>
          <div className="surface-note">
            One-tap connector controls for non-technical operators. Connect first, run a check, then open the matching FoxHub surface.
          </div>
          {stripeConnector ? (
            <div className="inline-actions wrap">
              <button type="button" className="accent-button" onClick={() => prepareStripeConnector()}>
                Prepare Stripe
              </button>
              <span className={connectorStatusBadge(stripeConnector.status)}>
                Stripe: {normalizeConnectorStatus(stripeConnector.status)}
              </span>
            </div>
          ) : null}
          <div className="glance-strip compact">
            <div className="glance-card warm">
              <span>Automation</span>
              <strong>{automationCount}</strong>
            </div>
            <div className="glance-card cool">
              <span>Active</span>
              <strong>{activeCount}</strong>
            </div>
            <div className="glance-card soft">
              <span>Ready</span>
              <strong>{readyCount}</strong>
            </div>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Connector logic</p>
            <span className="badge subtle">Operational view</span>
          </div>
          <div className="list-stack">
            <div className="moderation-rule-card">
              <strong>If a connector is not ready, the product should not silently depend on it.</strong>
              <p>Use this page to inspect which external rails are active, which are ready, and which surfaces in FoxHub are tied to them.</p>
            </div>
            <div className="moderation-rule-card">
              <strong>Simple flow: Connect, Check, Open surface.</strong>
              <p>Every connector now supports a full lifecycle: connect it, run a health check, and disconnect if you need to pause it.</p>
            </div>
          </div>
        </article>
      </section>

      <section className="surface-row two-up stripe-billing-section">
        <article className="surface surface-strong">
          <div className="surface-head">
            <p className="card-label">Stripe Billing</p>
            <span className={stripeReady ? "badge" : "badge review"}>{stripeReady ? "Ready to link" : "Setup needed"}</span>
          </div>
          <div className="surface-note">
            Billing components are installed as a guarded setup surface. FoxHub can show plans, readiness, and next actions now; live charges still require Stripe keys, Price IDs, and hosted checkout or portal sessions.
          </div>
          <div className="stripe-billing-readiness">
            {stripeBillingReadiness.map((item) => (
              <div key={item.label} className="stripe-readiness-card">
                <span>{item.label}</span>
                <strong>{item.state}</strong>
                <p>{item.value}</p>
              </div>
            ))}
          </div>
          <div className="inline-actions wrap">
            <button type="button" className="accent-button" onClick={() => prepareStripeConnector()}>
              Prepare Stripe billing
            </button>
            <button type="button" className="ghost-button small" onClick={() => openConnectorSurface(stripeConnector || { surface: "wallet", name: "Stripe Billing" })}>
              Open wallet billing
            </button>
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Billing plans</p>
            <span className="badge subtle">{stripeBillingPlans.length} mapped</span>
          </div>
          <div className="stripe-plan-grid">
            {stripeBillingPlans.map((plan) => (
              <div key={plan.id} className="stripe-plan-card">
                <span>{plan.audience}</span>
                <strong>{plan.name}</strong>
                <p>{plan.price}</p>
                <div className="row-meta-text">{plan.status}</div>
              </div>
            ))}
          </div>
          <div className="stripe-billing-warning">
            <strong>Live billing guard</strong>
            <p>Do not enable real checkout until `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, product Price IDs, success/cancel URLs, and legal billing copy are configured and verified.</p>
          </div>
        </article>
      </section>

      <section className="surface-row">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Connector registry</p>
            <span className="badge subtle">{state.apiConnectors.length} visible</span>
          </div>
          <div className="list-stack">
            {state.apiConnectors.map((connector) => (
              <div key={connector.id} className="list-row connector-row">
                <div>
                  <strong>{connector.name}</strong>
                  <p>{connector.summary}</p>
                  <div className="row-meta-text">
                    {connector.category} · {connector.automation} · Last check: {formatConnectorDate(connector.lastCheckedAt)}
                  </div>
                </div>
                <div className="inline-actions wrap">
                  <span className={connectorStatusBadge(connector.status)}>{normalizeConnectorStatus(connector.status)}</span>
                  {connector.id === "stripe-connect" ? (
                    <button type="button" className="ghost-button small" onClick={() => prepareStripeConnector()}>
                      Prepare Stripe
                    </button>
                  ) : null}
                  <button type="button" className="ghost-button small" onClick={() => connectConnector(connector)}>
                    Connect
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => testConnector(connector)}>
                    Run check
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => disconnectConnector(connector)}>
                    Disconnect
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => openConnectorSurface(connector)}>
                    Open surface
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => saveConnectorIntent(connector)}>
                    Save for setup
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
      {!state.apiConnectors.length ? <FilteredEmptyState label="Tools" /> : null}
    </>
  );
}

function FilteredEmptyState({ label }) {
  return (
    <section className="filtered-empty" aria-label={`${label} empty state`}>
      <p className="card-label">{label}</p>
      <strong>No visible items in this view</strong>
      <p>Adjust the filter or switch sections to bring more results back into view.</p>
    </section>
  );
}

function BoilerplateFootnotes({ title, subtitle, boilerplateGroups }) {
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

function AppFooter({ boilerplateGroups }) {
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

function rankMiniApps(state, selectedThread, activeCircle) {
  const recentOrder = new Map(state.miniAppRecents.map((item, index) => [item.name, index]));
  return [...miniApps].sort((a, b) => scoreMiniApp(b, state, selectedThread, activeCircle, recentOrder) - scoreMiniApp(a, state, selectedThread, activeCircle, recentOrder));
}

function scoreMiniApp(app, state, selectedThread, activeCircle, recentOrder) {
  let score = 0;
  if (state.serviceContinuity.some((item) => item.appId === app.id)) score += 30;
  if (recentOrder.has(app.name)) score += 20 - Math.min(recentOrder.get(app.name), 10);
  if (selectedThread?.type === "official" && app.type === "Events") score += 8;
  if (selectedThread?.type === "community" && app.type === "Payments") score += 6;
  if ((activeCircle?.name || "").toLowerCase().includes("miami") && app.name === "SplitTab") score += 5;
  if ((activeCircle?.name || "").toLowerCase().includes("atl") && app.name === "FoxTickets") score += 5;
  return score;
}

export default FoxHubShell;
